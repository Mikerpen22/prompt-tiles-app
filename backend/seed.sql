-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- Create prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Insert sample prompts
INSERT INTO prompts (title, content, category, created_at) VALUES
('Basic Chat', 'You are a helpful AI assistant. Help the user with their questions.', 'General', CURRENT_TIMESTAMP),
('Code Review', 'Review the following code and suggest improvements: {code}', 'Development', CURRENT_TIMESTAMP),
('Blog Post', 'Write a blog post about {topic} with the following sections: Introduction, Main Points, Conclusion', 'Writing', CURRENT_TIMESTAMP);
