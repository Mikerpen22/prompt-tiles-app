DROP TABLE IF EXISTS prompts;
CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
