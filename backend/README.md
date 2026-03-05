# MoveAssist — Backend

> QR box tracking · Agent quotes · Payment gate · PDF reports · Add-on services

---

## Quick start (new machine)

```bash
git clone <repo-url>
cd moveassist/backend
bash setup.sh
npm run dev
```

Open **http://localhost:3000** — that's it.

---

## Prerequisites

| Tool | Min version | macOS | Ubuntu |
|------|-------------|-------|--------|
| **Node.js** | 18 LTS | `brew install node` | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| **PostgreSQL** | 14 | `brew install postgresql@16 && brew services start postgresql@16` | `sudo apt-get install -y postgresql postgresql-contrib && sudo service postgresql start` |

> **Apple Silicon (M1/M2/M3):** Homebrew installs to `/opt/homebrew/bin`. Add it to PATH:
> ```bash
> echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
> ```

---

## What `setup.sh` does

| Step | What happens |
|------|-------------|
| 1 | Checks Node ≥ 18, npm, and psql — with install hints if missing |
| 2 | Creates `.env` with a random JWT secret (skipped if already exists) |
| 3 | Runs `npm install` / `npm ci` |
| 4 | Creates the `moveassist` Postgres database if missing |
| 5 | Runs all 12 migrations in dependency order (all idempotent) |
| 6 | Seeds admin, agent, and customer demo accounts |
| 7 | Validates DB tables and prints row counts |

**Safe to re-run** — every step is idempotent.

### Flags

```bash
bash setup.sh               # normal setup (skips steps already done)
bash setup.sh --reset       # ⚠ drops database, starts from scratch
bash setup.sh --skip-db     # only installs deps + .env (no DB)
```

---

## Test credentials

All demo accounts use password **`Test@123`**

| Role | Email |
|------|-------|
| Admin | admin@moveassist.com |
| Agent | agent@moveassist.com |
| Customer | customer@moveassist.com |

---

## Manual setup (without the script)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit DATABASE_URL to match your local Postgres

# 3. Create DB
createdb moveassist

# 4. Run migrations in order
psql moveassist -f src/utils/schema.sql
psql moveassist -f src/utils/payment_migration.sql
psql moveassist -f src/utils/token_quote_migration.sql
psql moveassist -f src/utils/move_plan_migration.sql
psql moveassist -f setup_agent_profiles.sql
psql moveassist -f setup_pricing_system.sql
psql moveassist -f setup_feature_flags.sql
psql moveassist -f migrations/addon_services_schema.sql
psql moveassist -f setup_addon_services.sql
psql moveassist -f migrations/004_add_delivered_boxes.sql
psql moveassist -f migrations/005_notifications.sql
psql moveassist -f migrations/006_missing_tables.sql

# 5. Start
npm run dev
```

---

## Development

```bash
npm run dev     # nodemon — auto-restarts on file changes
npm start       # production (no auto-restart)
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `JWT_SECRET` | ✅ | Must be changed in production |
| `PORT` | ❌ | Defaults to `3000` |
| `AWS_ACCESS_KEY_ID` | ❌ | S3 photo uploads (disabled if blank) |
| `AWS_SECRET_ACCESS_KEY` | ❌ | S3 photo uploads |
| `S3_BUCKET_NAME` | ❌ | Defaults to `moveassist-images` |

---

## Project structure

```
backend/
├── src/
│   ├── server.js          # entry point
│   ├── app.js             # Express setup, middleware
│   ├── routes/            # one file per resource
│   ├── controllers/       # business logic
│   ├── middleware/         # auth, error handling
│   └── utils/
│       ├── schema.sql     # core tables
│       ├── payment_migration.sql
│       ├── token_quote_migration.sql
│       └── move_plan_migration.sql
├── migrations/            # incremental migrations
│   ├── addon_services_schema.sql
│   ├── 004_add_delivered_boxes.sql
│   ├── 005_notifications.sql
│   └── 006_missing_tables.sql
├── public/                # frontend SPA (HTML/CSS/JS)
├── setup.sh               # ← run this on a new machine
├── .env.example           # template — copy to .env
└── package.json
```

---

## Common issues

**`psql: command not found` on macOS**
```bash
# Find your Homebrew postgres bin path:
brew --prefix postgresql@16
# Add to PATH — example for Apple Silicon:
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
```

**`FATAL: role "username" does not exist`**
```bash
# Create a superuser matching your system username:
createuser -s $(whoami)
```

**`database "moveassist" does not exist`**
```bash
createdb moveassist
# Or re-run: bash setup.sh
```

**Port 3000 already in use**
```bash
# Find what's using it:
lsof -i :3000
# Or change PORT in .env
```
