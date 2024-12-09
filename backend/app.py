from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime
import os
import google.generativeai as genai
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import secrets
import base64

load_dotenv()

app = Flask(__name__, static_folder='../frontend/build')
CORS(app)

# Load or generate encryption key
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    # Generate a new Fernet key
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    with open('.env', 'a') as f:
        f.write(f'\nENCRYPTION_KEY={ENCRYPTION_KEY}')
    load_dotenv()

cipher_suite = Fernet(ENCRYPTION_KEY.encode())

# Configure SQLite database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'prompts.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

"""
Migrations make it easier to:
1. Update database schema without losing data
2. Track schema changes like version control
3. Roll back changes if needed
4. Share schema changes with team
"""
migrate = Migrate(app, db)


### Define database models
class UserSession(db.Model):
    """
    SQLite does not have built-in DATE, TIME, or DATETIME types
    and pysqlite does not provide out of the box functionality for translating values between Python datetime objects and a SQLite-supported format.
    SQLAlchemy’s own DateTime and related types provide date formatting and parsing functionality when SQLite is used. The implementation classes are DATETIME, DATE and TIME.
    These types represent dates and times as ISO formatted strings, which also nicely support ordering.
    """
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), unique=True, nullable=False)
    encrypted_api_key = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'session_id': self.session_id,
            'created_at': self.created_at.isoformat(),
            'last_used': self.last_used.isoformat()
        }

class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    prompt_id = db.Column(db.Integer, db.ForeignKey('prompt.id'), nullable=False)
    session_id = db.Column(db.String(64), db.ForeignKey('user_session.session_id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    messages = db.relationship('Message', backref='chat', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'prompt_id': self.prompt_id,
            'created_at': self.created_at.isoformat(),
            'messages': [message.to_dict() for message in self.messages]
        }

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at.isoformat()
        }

class Prompt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    category = db.Column(db.String(100), nullable=False, default='General')
    chats = db.relationship('Chat', backref='prompt', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'category': self.category
        }

@app.route('/', methods=['GET'])
def index():
    return jsonify({'status': 'ok', 'message': 'Server is running'})

@app.route('/prompts', methods=['GET'])
def get_prompts():
    category = request.args.get('category', '').strip()
    
    # Get all prompts first
    all_prompts = Prompt.query.order_by(Prompt.created_at.desc()).all()
    
    if category:
        # Case-insensitive filtering
        filtered_prompts = [p for p in all_prompts if p.category and p.category.lower() == category.lower()]
        return jsonify([p.to_dict() for p in filtered_prompts])
    
    return jsonify([p.to_dict() for p in all_prompts])

@app.route('/prompts', methods=['POST'])
def create_prompt():
    data = request.json
    category = data.get('category', 'General')
    
    new_prompt = Prompt(
        title=data['title'],
        content=data['content'],
        category=category
    )
    db.session.add(new_prompt)
    db.session.commit()
    return jsonify(new_prompt.to_dict()), 201

@app.route('/prompts/<int:prompt_id>', methods=['PUT'])
def update_prompt(prompt_id):
    prompt = Prompt.query.get_or_404(prompt_id)
    data = request.json
    
    prompt.title = data.get('title', prompt.title)
    prompt.content = data.get('content', prompt.content)
    prompt.category = data.get('category', prompt.category)
    
    db.session.commit()
    return jsonify(prompt.to_dict())

@app.route('/prompts/<int:prompt_id>', methods=['DELETE'])
def delete_prompt(prompt_id):
    prompt = Prompt.query.get_or_404(prompt_id)
    db.session.delete(prompt)
    db.session.commit()
    return '', 204

@app.route('/chats/<int:prompt_id>', methods=['GET'])
def get_chats(prompt_id):
    chats = Chat.query.filter_by(prompt_id=prompt_id).order_by(Chat.created_at.desc()).all()
    return jsonify([chat.to_dict() for chat in chats])

@app.route('/settings/api-key', methods=['POST'])
def update_api_key():
    data = request.json
    new_key = data.get('api_key')
    
    if not new_key:
        return jsonify({"error": "API key is required"}), 400
    
    try:
        # Test the API key
        genai.configure(api_key=new_key)
        test_model = genai.GenerativeModel('gemini-pro')
        test_model.generate_content('test')
        
        # Generate a new session ID
        session_id = secrets.token_urlsafe(32)
        
        # Encrypt the API key
        encrypted_key = cipher_suite.encrypt(new_key.encode()).decode()
        
        # Store in database
        session = UserSession(
            session_id=session_id,
            encrypted_api_key=encrypted_key
        )
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            "message": "API key saved successfully",
            "session_id": session_id
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

def get_api_key_from_session(session_id):
    if not session_id:
        return None
        
    session = UserSession.query.filter_by(session_id=session_id).first()
    if not session:
        return None
        
    try:
        # Update last used timestamp
        session.last_used = datetime.utcnow()
        db.session.commit()
        
        # Decrypt and return the API key
        return cipher_suite.decrypt(session.encrypted_api_key.encode()).decode()
    except:
        return None

@app.route('/chat/stream', methods=['POST'])
def stream_chat():
    # Get session ID from header
    session_id = request.headers.get('X-Session-ID')
    api_key = get_api_key_from_session(session_id)
    
    if not api_key:
        return jsonify({"error": "Invalid or expired session. Please set your API key in settings."}), 401
        
    data = request.json
    prompt_text = data.get('prompt', '')
    user_input = data.get('message', '')
    prompt_id = data.get('prompt_id')
    chat_id = data.get('chat_id')
    
    # Configure Gemini with the current API key
    genai.configure(api_key=api_key)
    chat_model = genai.GenerativeModel('gemini-pro')
    
    # Only include prompt if it's provided (first message)
    full_prompt = f"{prompt_text}\n\nUser: {user_input}" if prompt_text else user_input
    
    # Create or get chat session
    chat = None
    if chat_id:
        chat = Chat.query.get(chat_id)
    elif prompt_id:
        chat = Chat(prompt_id=prompt_id, session_id=session_id)
        db.session.add(chat)
        db.session.commit()
    
    # Save user message
    if chat:
        message = Message(chat_id=chat.id, role='user', content=user_input)
        db.session.add(message)
        db.session.commit()
    
    def generate():
        response = chat_model.generate_content(full_prompt, stream=True)
        ai_response = ""
        
        for chunk in response:
            if chunk.text:
                ai_response += chunk.text
                yield f"data: {chunk.text}\n\n"
        
        # Save assistant message after complete response
        if chat and ai_response:
            message = Message(chat_id=chat.id, role='assistant', content=ai_response)
            db.session.add(message)
            db.session.commit()
    
    return Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5001)
