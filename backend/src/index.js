import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = new Hono();
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting map
const ipRequests = new Map();

// Generate a random session ID
const generateSessionId = () => {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array, x => x.toString(16)).join('');
};

// Simple rate limiting middleware
const rateLimit = async (c, next) => {
  const ip = c.req.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 100; // max requests per window

  // Get existing requests for this IP
  const requests = ipRequests.get(ip) || [];
  
  // Filter requests within current window
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  // Add current request
  recentRequests.push(now);
  ipRequests.set(ip, recentRequests);

  return next();
};

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['X-Session-ID', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
  credentials: true,
}));

// Apply rate limiting to all routes
app.use('*', rateLimit);

// Input validation
const promptSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(5000).trim(),
  category: z.string().min(1).max(50).trim().default('General'),
});

// SQL injection prevention
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/['";\-\\]/g, '');
};

// Helper function to format prompt data
const formatPrompt = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  category: row.category,
  created_at: row.created_at,
});

// Root route handler
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'Prompt Tiles API is running',
    endpoints: {
      prompts: {
        get: '/prompts',
        post: '/prompts',
        put: '/prompts/:id',
        delete: '/prompts/:id'
      },
      settings: {
        'api-key': '/configure-api-key'
      }
    }
  });
});

// Session management
async function createSession(apiKey, env) {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_EXPIRY;

  // Store API key directly
  await env.SESSIONS_KV.put(sessionId, JSON.stringify({
    apiKey,
    expiresAt
  }), { expirationTtl: SESSION_EXPIRY / 1000 });

  return sessionId;
}

async function validateSession(sessionId, env) {
  if (!sessionId) return false;
  
  const sessionData = await env.SESSIONS_KV.get(sessionId);
  if (!sessionData) return false;

  const { expiresAt } = JSON.parse(sessionData);
  return Date.now() < expiresAt;
}

async function getApiKeyFromSession(sessionId, env) {
  if (!sessionId) return null;
  
  const sessionData = await env.SESSIONS_KV.get(sessionId);
  if (!sessionData) return null;

  const { apiKey, expiresAt } = JSON.parse(sessionData);
  if (Date.now() >= expiresAt) return null;

  return apiKey;
}

// Configure API key endpoint
app.post('/configure-api-key', async (c) => {
  const { apiKey } = await c.req.json();
  
  if (!apiKey) {
    return c.json({ error: 'API key is required' }, 400);
  }

  try {
    const sessionId = await createSession(apiKey, c.env);
    return c.json({ session_id: sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    return c.json({ error: 'Failed to create session' }, 500);
  }
});

// Verify session endpoint
app.get('/verify-session', async (c) => {
  const sessionId = c.req.header('X-Session-ID');
  
  if (!sessionId) {
    return c.json({ error: 'Session ID is required' }, 401);
  }

  try {
    const isValid = await validateSession(sessionId, c.env);
    if (!isValid) {
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    const apiKey = await getApiKeyFromSession(sessionId, c.env);
    if (!apiKey) {
      return c.json({ error: 'Session expired' }, 401);
    }

    return c.json({ valid: true });
  } catch (error) {
    console.error('Error verifying session:', error);
    return c.json({ error: 'Failed to verify session' }, 500);
  }
});

// Helper function to stream Gemini response
async function* streamGeminiResponse(apiKey, prompt, message) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nUser: ${message}` }] }],
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) yield chunkText;
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

// Routes with error handling and input validation
app.get('/prompts', async (c) => {
  const sessionId = c.req.header('X-Session-ID');
  if (!await validateSession(sessionId, c.env)) {
    return c.json({ error: 'Unauthorized - Invalid or missing session ID' }, 401);
  }

  const { category } = c.req.query();
  const db = c.env.DB;

  try {
    let query = 'SELECT * FROM prompts ORDER BY created_at DESC';
    let params = [];

    if (category) {
      const sanitizedCategory = sanitizeInput(category);
      query = 'SELECT * FROM prompts WHERE LOWER(category) = LOWER(?) ORDER BY created_at DESC';
      params = [sanitizedCategory];
    }

    const prompts = await db.prepare(query).bind(...params).all();
    return c.json(prompts.results.map(formatPrompt));
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return c.json({ error: 'Failed to fetch prompts' }, 500);
  }
});

app.post('/prompts', zValidator('json', promptSchema), async (c) => {
  const sessionId = c.req.header('X-Session-ID');
  if (!await validateSession(sessionId, c.env)) {
    return c.json({ error: 'Unauthorized - Invalid or missing session ID' }, 401);
  }

  const data = await c.req.json();
  const db = c.env.DB;

  try {
    const result = await db
      .prepare('INSERT INTO prompts (title, content, category) VALUES (?, ?, ?) RETURNING *')
      .bind(
        sanitizeInput(data.title),
        sanitizeInput(data.content),
        sanitizeInput(data.category)
      )
      .first();

    return c.json(formatPrompt(result), 201);
  } catch (error) {
    console.error('Error creating prompt:', error);
    return c.json({ error: 'Failed to create prompt' }, 500);
  }
});

app.put('/prompts/:id', zValidator('json', promptSchema), async (c) => {
  const sessionId = c.req.header('X-Session-ID');
  if (!await validateSession(sessionId, c.env)) {
    return c.json({ error: 'Unauthorized - Invalid or missing session ID' }, 401);
  }

  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID format' }, 400);
  }

  const data = await c.req.json();
  const db = c.env.DB;

  try {
    const result = await db
      .prepare('UPDATE prompts SET title = ?, content = ?, category = ? WHERE id = ? RETURNING *')
      .bind(
        sanitizeInput(data.title),
        sanitizeInput(data.content),
        sanitizeInput(data.category),
        id
      )
      .first();

    if (!result) {
      return c.json({ error: 'Prompt not found' }, 404);
    }

    return c.json(formatPrompt(result));
  } catch (error) {
    console.error('Error updating prompt:', error);
    return c.json({ error: 'Failed to update prompt' }, 500);
  }
});

app.delete('/prompts/:id', async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    console.log('Delete request received for session:', sessionId);
    
    if (!await validateSession(sessionId, c.env)) {
      console.log('Session validation failed');
      return c.json({ error: 'Unauthorized - Invalid or missing session ID' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    console.log('Attempting to delete prompt:', id);
    
    if (isNaN(id)) {
      console.log('Invalid ID format:', c.req.param('id'));
      return c.json({ error: 'Invalid ID format' }, 400);
    }

    const db = c.env.DB;

    try {
      // First check if the prompt exists
      const prompt = await db.prepare('SELECT id FROM prompts WHERE id = ?').bind(id).first();

      if (!prompt) {
        console.log('Prompt not found:', id);
        return c.json({ error: 'Prompt not found' }, 404);
      }

      // Get related chat IDs first
      console.log('Finding related chats...');
      const chatIds = await db.prepare('SELECT id FROM chats WHERE prompt_id = ?').bind(id).all();
      
      console.log('Found chat IDs:', chatIds);

      // Delete messages for each chat
      if (chatIds.results && chatIds.results.length > 0) {
        console.log('Deleting messages for chats...');
        for (const chat of chatIds.results) {
          try {
            await db.prepare('DELETE FROM messages WHERE chat_id = ?').bind(chat.id).run();
            console.log('Deleted messages for chat:', chat.id);
          } catch (err) {
            console.error('Error deleting messages for chat:', chat.id, err);
          }
        }
      }

      // Delete chats
      try {
        console.log('Deleting chats...');
        await db.prepare('DELETE FROM chats WHERE prompt_id = ?').bind(id).run();
        console.log('Deleted all chats for prompt:', id);
      } catch (err) {
        console.error('Error deleting chats:', err);
      }

      // Finally delete the prompt
      try {
        console.log('Deleting prompt...');
        await db.prepare('DELETE FROM prompts WHERE id = ?').bind(id).run();
        console.log('Prompt deleted successfully:', id);
      } catch (err) {
        console.error('Error deleting prompt:', err);
        throw err;
      }

      return c.json({ message: 'Prompt deleted successfully' });
    } catch (dbError) {
      console.error('Database error:', {
        error: dbError,
        message: dbError.message,
        cause: dbError.cause,
        stack: dbError.stack
      });
      throw dbError;
    }
  } catch (error) {
    console.error('Error deleting prompt:', {
      error: error,
      message: error.message,
      cause: error.cause,
      stack: error.stack
    });
    return c.json({ 
      error: 'Failed to delete prompt',
      details: error.message,
      cause: error.cause
    }, 500);
  }
});

// Get chat history for a prompt
app.get('/chats/:promptId', async (c) => {
  const sessionId = c.req.header('X-Session-ID');
  if (!await validateSession(sessionId, c.env)) {
    return c.json({ error: 'Unauthorized - Invalid or missing session ID' }, 401);
  }

  const promptId = c.req.param('promptId');
  const db = c.env.DB;

  try {
    const chats = await db.prepare(`
      SELECT c.id, c.created_at, 
             json_group_array(
               json_object(
                 'role', m.role,
                 'content', m.content
               )
             ) as messages
      FROM chats c
      LEFT JOIN messages m ON c.id = m.chat_id
      WHERE c.prompt_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 1
    `).bind(promptId).all();

    if (!chats.results || chats.results.length === 0) {
      return c.json([]);
    }

    // Parse the messages JSON string for each chat
    const formattedChats = chats.results.map(chat => ({
      ...chat,
      messages: JSON.parse(chat.messages)
    }));

    return c.json(formattedChats);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return c.json({ error: 'Failed to fetch chat history' }, 500);
  }
});

// Chat stream endpoint
app.post('/chat/stream', async (c) => {
  const sessionId = c.req.header('X-Session-ID');
  console.log('Chat request received for session:', sessionId);

  if (!await validateSession(sessionId, c.env)) {
    console.log('Session validation failed');
    return c.json({ error: 'Unauthorized - Invalid or missing session ID' }, 401);
  }

  try {
    const data = await c.req.json();
    const { message, prompt_id, chat_id, prompt: promptContent } = data;
    
    // Validate required fields
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }
    if (!prompt_id) {
      return c.json({ error: 'Prompt ID is required' }, 400);
    }

    const apiKey = await getApiKeyFromSession(sessionId, c.env);
    if (!apiKey) {
      console.log('No API key found for session:', sessionId);
      return c.json({ error: 'No API key found. Please set your Gemini API key in Settings.' }, 401);
    }

    console.log('API Key found:', apiKey.slice(0, 5) + '...');

    // Get the prompt content from database if not provided in request
    let finalPromptContent = promptContent;
    if (!finalPromptContent) {
      const promptResult = await c.env.DB.prepare(
        'SELECT content FROM prompts WHERE id = ?'
      ).bind(prompt_id).first();
      
      if (!promptResult) {
        return c.json({ error: 'Prompt not found' }, 404);
      }
      finalPromptContent = promptResult.content;
    }

    // Create or get chat_id
    let currentChatId = chat_id;
    if (!currentChatId) {
      const result = await c.env.DB.prepare(
        'INSERT INTO chats (prompt_id) VALUES (?)'
      ).bind(prompt_id).run();
      
      if (!result?.meta?.last_row_id) {
        throw new Error('Failed to create chat');
      }
      currentChatId = result.meta.last_row_id;
    }

    // Prepare the content for Gemini API
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Context from prompt:
${finalPromptContent}

User message:
${message}`
            }
          ]
        }
      ]
    };

    console.log('Sending request to Gemini:', JSON.stringify(requestBody, null, 2));
    console.log('API URL:', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent');

    try {
      // Call Gemini API
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('Raw Gemini API response:', responseText);

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} - ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed Gemini API response:', JSON.stringify(result, null, 2));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error(`Failed to parse Gemini API response: ${parseError.message}`);
      }

      if (!result?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error('Invalid response structure:', result);
        throw new Error('Invalid response format from Gemini API');
      }

      const aiResponse = result.candidates[0].content.parts[0].text;

      // Save the messages
      const stmt = await c.env.DB.prepare(
        'INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)'
      );
      
      // Save user message
      await stmt.bind(currentChatId, 'user', message).run();
      // Save AI response
      await stmt.bind(currentChatId, 'assistant', aiResponse).run();

      // Create a ReadableStream for streaming the response
      const stream = new ReadableStream({
        start(controller) {
          // Send the initial response with chat_id
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            chat_id: currentChatId
          }) + '\n'));

          // Send the AI response
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            content: aiResponse
          }) + '\n'));

          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } catch (apiError) {
      console.error('API call error:', apiError);
      throw apiError;
    }
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ 
      error: 'Failed to process chat request',
      details: error.message 
    }, 500);
  }
});

export default app;
