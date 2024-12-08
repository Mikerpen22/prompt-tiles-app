import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: [
    'http://localhost:3000',
    'https://*.pages.dev',  // Allow all Cloudflare Pages subdomains
    'https://prompt-tiles.pages.dev'  // Your specific Pages domain
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Root endpoint for health check
app.get('/', (c) => c.json({ status: 'ok' }));

// Schema validation
const promptSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().default('General'),
});

// Helper function to format prompt data
const formatPrompt = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  category: row.category,
  created_at: row.created_at,
});

// Routes
app.get('/prompts', async (c) => {
  const { category } = c.req.query();
  const db = c.env.DB;

  try {
    let query = 'SELECT * FROM prompts ORDER BY created_at DESC';
    let params = [];

    if (category) {
      query = 'SELECT * FROM prompts WHERE LOWER(category) = LOWER(?) ORDER BY created_at DESC';
      params = [category];
    }

    console.log('Executing query:', query);
    const prompts = await db.prepare(query).bind(...params).all();
    console.log('Query results:', prompts);

    if (!prompts.results) {
      return c.json({ error: 'No results property in response', raw_response: prompts }, 500);
    }

    return c.json(prompts.results.map(formatPrompt));
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return c.json({ 
      error: 'Failed to fetch prompts',
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

app.post('/prompts', zValidator('json', promptSchema), async (c) => {
  const data = await c.req.json();
  const db = c.env.DB;

  try {
    console.log('Creating prompt:', data);
    const result = await db
      .prepare('INSERT INTO prompts (title, content, category) VALUES (?, ?, ?) RETURNING *')
      .bind(data.title, data.content, data.category)
      .first();
    console.log('Created prompt:', result);

    return c.json(formatPrompt(result), 201);
  } catch (error) {
    console.error('Error creating prompt:', error);
    return c.json({ 
      error: 'Failed to create prompt',
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

app.put('/prompts/:id', zValidator('json', promptSchema), async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const db = c.env.DB;

  try {
    console.log('Updating prompt:', id, data);
    const result = await db
      .prepare('UPDATE prompts SET title = ?, content = ?, category = ? WHERE id = ? RETURNING *')
      .bind(data.title, data.content, data.category, id)
      .first();

    if (!result) {
      return c.json({ error: 'Prompt not found' }, 404);
    }

    console.log('Updated prompt:', result);
    return c.json(formatPrompt(result));
  } catch (error) {
    console.error('Error updating prompt:', error);
    return c.json({ 
      error: 'Failed to update prompt',
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

app.delete('/prompts/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;

  try {
    console.log('Deleting prompt:', id);
    const result = await db
      .prepare('DELETE FROM prompts WHERE id = ? RETURNING *')
      .bind(id)
      .first();

    if (!result) {
      return c.json({ error: 'Prompt not found' }, 404);
    }

    console.log('Deleted prompt:', result);
    return c.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return c.json({ 
      error: 'Failed to delete prompt',
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

export default app;
