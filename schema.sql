-- Daily Task Manager - PostgreSQL Schema
-- Run this once against your database (the app also creates this
-- table automatically on startup if it doesn't exist, so this file
-- is mainly here for reference / manual setup).

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    task_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
