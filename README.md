# Daily Task Manager

A very simple full-stack task manager: Node.js + Express backend, plain HTML/CSS/JS frontend, PostgreSQL database. Built to be deployed on Google Cloud Run with the minimum possible moving parts.

## What it does

- Add a task (text input + Add button)
- View all active tasks on the homepage
- Click "✔ Complete" to remove a task from the UI **and** delete it from the database
- No login, no extra pages, one screen

## Folder structure

```
daily-task-manager/
├── Dockerfile
├── .dockerignore
├── package.json
├── schema.sql
├── server.js
├── public/
│   └── index.html
└── README.md
```

## How it works

- `server.js` — Express app. Serves `public/index.html` and exposes 3 JSON endpoints:
  - `GET /api/tasks` — list tasks
  - `POST /api/tasks` — add a task (`{ "task_text": "..." }`)
  - `DELETE /api/tasks/:id` — delete a task (called when you click Complete)
- On startup, the server automatically runs `CREATE TABLE IF NOT EXISTS tasks ...`, so you don't have to manually run `schema.sql` — it's included for reference/manual setup if you prefer.
- The database connection is configured entirely through one environment variable: `DATABASE_URL`. Nothing is hardcoded.
- The server listens on `process.env.PORT` (Cloud Run sets this automatically — defaults to `8080` locally).

## SQL schema (`schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    task_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

# Deployment guide (Cloud Console + Cloud Shell + Artifact Registry + Cloud Run)

This assumes you already have a Google Cloud project with billing enabled. Replace placeholders like `YOUR_PROJECT_ID` with your real values throughout.

## Step 0 — Open Cloud Shell

In the Google Cloud Console, click the **Cloud Shell** icon (top right, `>_`). All commands below run there.

Set your project once:

```bash
gcloud config set project YOUR_PROJECT_ID
export PROJECT_ID=YOUR_PROJECT_ID
export REGION=us-central1
```

## Step 1 — Create a PostgreSQL database (Cloud SQL)

Enable the API and create a small Postgres instance:

```bash
gcloud services enable sqladmin.googleapis.com

gcloud sql instances create task-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password=CHOOSE_A_ROOT_PASSWORD
```

This takes a few minutes. Once it's ready, create the database and a user:

```bash
gcloud sql databases create tasksdb --instance=task-db

gcloud sql users create taskuser \
  --instance=task-db \
  --password=CHOOSE_A_USER_PASSWORD
```

Get the instance connection name (you'll need it for `DATABASE_URL`):

```bash
gcloud sql instances describe task-db --format="value(connectionName)"
```

This prints something like `YOUR_PROJECT_ID:us-central1:task-db` — copy it.

> Cloud Run will connect to Cloud SQL over a secure Unix socket, so your `DATABASE_URL` will look like:
> `postgresql://taskuser:CHOOSE_A_USER_PASSWORD@/tasksdb?host=/cloudsql/YOUR_PROJECT_ID:us-central1:task-db`

## Step 2 — Get the project files into Cloud Shell

Pick whichever is easiest for you:

**Option A — Upload a zip:** In Cloud Shell, click the three-dot menu → **Upload** → select a zip of the `daily-task-manager` folder, then:

```bash
unzip daily-task-manager.zip
cd daily-task-manager
```

**Option B — Git:** if you've pushed this folder to a GitHub repo:

```bash
git clone YOUR_REPO_URL
cd daily-task-manager
```

## Step 3 — Create an Artifact Registry repository

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com

gcloud artifacts repositories create task-repo \
  --repository-format=docker \
  --location=$REGION
```

## Step 4 — Build the container image and push it to Artifact Registry

The easiest way (no local Docker needed — Cloud Build does it for you):

```bash
gcloud builds submit \
  --tag $REGION-docker.pkg.dev/$PROJECT_ID/task-repo/daily-task-manager
```

Run this from inside the `daily-task-manager` folder (where the `Dockerfile` is).

## Step 5 — Deploy to Cloud Run

```bash
gcloud run deploy daily-task-manager \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/task-repo/daily-task-manager \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:task-db \
  --set-env-vars="DATABASE_URL=postgresql://taskuser:CHOOSE_A_USER_PASSWORD@/tasksdb?host=/cloudsql/YOUR_PROJECT_ID:us-central1:task-db"
```

Replace the password and connection name with your actual values from Step 1.

When it finishes, `gcloud` prints a **Service URL** — open it in your browser. That's your live Daily Task Manager.

## Updating the app later

After editing any file, just repeat Step 4 and Step 5 (build + deploy). Cloud Run will roll out the new revision automatically.

## Notes

- `--allow-unauthenticated` makes the URL public, matching the "no authentication" requirement. Remove it if you later want to restrict access.
- `db-f1-micro` is the smallest/cheapest Cloud SQL tier — fine for learning, not for production load.
- If you'd rather skip Cloud SQL entirely while learning, any reachable Postgres instance works — just set `DATABASE_URL` to its standard connection string (e.g. `postgresql://user:pass@host:5432/dbname`) and drop the `--add-cloudsql-instances` flag.
