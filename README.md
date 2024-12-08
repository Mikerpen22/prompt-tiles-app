# Prompt Tiles App

A modern web application for managing AI prompts with Cloudflare Workers and D1.

## Deployment Instructions

### Backend (Cloudflare Workers + D1)

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Create a D1 Database:
```bash
wrangler d1 create prompt_tiles_db
```

4. Update wrangler.toml with your database ID from the previous command.

5. Initialize the database schema:
```bash
npm run init-db
```

6. Deploy the Worker:
```bash
npm run deploy
```

### Frontend (React)

1. Update .env.production with your Worker URL:
```bash
REACT_APP_API_BASE_URL=https://your-worker-subdomain.workers.dev
```

2. Build and deploy:
```bash
npm run build
```

3. Deploy the build folder to your preferred hosting service (e.g., Cloudflare Pages)

## Development Setup

### Backend

1. Install dependencies:
```bash
cd backend
npm install
```

2. Start local development:
```bash
npm run dev
```

### Frontend

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start development server:
```bash
npm start
```

## Project Structure

```
prompt-tiles-app/
├── backend/
│   ├── src/
│   │   └── index.js      # Worker entry point
│   ├── schema.sql        # D1 database schema
│   ├── wrangler.toml     # Cloudflare configuration
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   └── App.js
    ├── .env.development
    ├── .env.production
    └── package.json
```

## Features

- Create, read, update, and delete prompts
- Category-based filtering
- Smooth animations
- Responsive design
- Secure API endpoints
- Production-ready configuration

## Tech Stack

- Frontend: React, Tailwind CSS, Framer Motion
- Backend: Cloudflare Workers, D1 (SQLite)
- API: Hono framework with Zod validation
- Deployment: Cloudflare Workers/Pages
