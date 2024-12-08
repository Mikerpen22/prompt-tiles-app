import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// Rate limiting map
const ipRequests = new Map();

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
app.use('/*', cors({
  origin: [
    'http://localhost:3000',
    'https://*.pages.dev',
    'https://prompt-tiles.pages.dev'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
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

// Routes with error handling and input validation
app.get('/prompts', async (c) => {
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
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID format' }, 400);
  }

  const db = c.env.DB;

  try {
    const result = await db
      .prepare('DELETE FROM prompts WHERE id = ? RETURNING *')
      .bind(id)
      .first();

    if (!result) {
      return c.json({ error: 'Prompt not found' }, 404);
    }

    return c.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return c.json({ error: 'Failed to delete prompt' }, 500);
  }
});

export default app;
