const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 8080;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
}

// PostgreSQL connection pool.
// DATABASE_URL examples:
//   Standard:  postgresql://user:password@host:5432/dbname
//   Cloud SQL: postgresql://user:password@/dbname?host=/cloudsql/INSTANCE_CONNECTION_NAME
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the table automatically on startup if it doesn't exist yet.
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      task_text TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("Database ready (tasks table verified).");
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// GET all active tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, task_text, created_at FROM tasks ORDER BY created_at ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// POST a new task
app.post("/api/tasks", async (req, res) => {
  const { task_text } = req.body;

  if (!task_text || !task_text.trim()) {
    return res.status(400).json({ error: "task_text is required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO tasks (task_text) VALUES ($1) RETURNING id, task_text, created_at",
      [task_text.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error inserting task:", err);
    res.status(500).json({ error: "Failed to add task" });
  }
});

// DELETE a task (used when a task is marked complete)
app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Simple health check (useful for Cloud Run)
app.get("/health", (req, res) => res.status(200).send("ok"));

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Daily Task Manager listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
