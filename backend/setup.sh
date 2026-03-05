#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
#  MoveAssist — One-shot setup script
#  Supports: macOS (Intel + Apple Silicon), Ubuntu / Debian
#
#  Usage:
#    bash setup.sh            # fresh setup
#    bash setup.sh --reset    # drop DB and start over
#    bash setup.sh --skip-db  # only install deps + .env (no DB)
# ════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Flags ────────────────────────────────────────────────────────
RESET=0; SKIP_DB=0
for arg in "$@"; do
  [[ "$arg" == "--reset"   ]] && RESET=1
  [[ "$arg" == "--skip-db" ]] && SKIP_DB=1
done

# ── Colours ──────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
TICK="${GREEN}✔${NC}"; CROSS="${RED}✖${NC}"; WARN="${YELLOW}⚠${NC}"; INFO="${CYAN}ℹ${NC}"

log()     { echo -e "  $*"; }
ok()      { log "${TICK}  $*"; }
fail()    { log "${CROSS}  $*" >&2; }
warn()    { log "${WARN}  $*"; }
info()    { log "${INFO}  $*"; }
section() { echo -e "\n${BOLD}${BLUE}▶  $*${NC}"; }
die()     { fail "$*"; exit 1; }

# ── Banner ───────────────────────────────────────────────────────
echo -e "${BOLD}${BLUE}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   MoveAssist — Developer Setup               ║"
echo "  ║   QR Tracking · Agent Portal · PDF Reports   ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"
[[ $RESET   -eq 1 ]] && warn "Mode: ${BOLD}--reset${NC}   (will drop & recreate database)"
[[ $SKIP_DB -eq 1 ]] && warn "Mode: ${BOLD}--skip-db${NC} (skipping database steps)"

# ── Resolve paths ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ════════════════════════════════════════════════════════════════
# STEP 1 — Detect OS + find tools
# ════════════════════════════════════════════════════════════════
section "System check"

OS="unknown"
[[ "$(uname)" == "Darwin" ]] && OS="macos"
[[ -f /etc/debian_version   ]] && OS="debian"
[[ -f /etc/ubuntu-release   ]] && OS="debian"
ok "OS: $OS ($(uname -m))"

# Locate psql — Homebrew paths differ between Intel and Apple Silicon
PSQL=""
for p in \
  "$(command -v psql 2>/dev/null)" \
  "/opt/homebrew/bin/psql" \
  "/opt/homebrew/opt/postgresql@16/bin/psql" \
  "/opt/homebrew/opt/postgresql@15/bin/psql" \
  "/opt/homebrew/opt/postgresql@14/bin/psql" \
  "/usr/local/bin/psql" \
  "/usr/local/opt/postgresql@16/bin/psql" \
  "/usr/bin/psql"; do
  [[ -x "$p" ]] && { PSQL="$p"; break; }
done

# Node check (≥ 18)
MISSING=0
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  NODE_MAJOR=$(echo "$NODE_VER" | tr -d 'v' | cut -d. -f1)
  if [[ "$NODE_MAJOR" -lt 18 ]]; then
    fail "Node.js $NODE_VER found but version ≥ 18 is required"
    if [[ "$OS" == "macos" ]]; then
      warn "  Install: brew install node"
    else
      warn "  Install: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
      warn "           sudo apt-get install -y nodejs"
    fi
    MISSING=1
  else
    ok "Node.js $NODE_VER"
  fi
else
  fail "Node.js not found (need ≥ 18)"
  MISSING=1
fi

# npm check
if command -v npm &>/dev/null; then
  ok "npm $(npm -v)"
else
  fail "npm not found"; MISSING=1
fi

# psql check (only if not skipping DB)
if [[ $SKIP_DB -eq 0 ]]; then
  if [[ -n "$PSQL" ]]; then
    ok "psql $("$PSQL" --version | awk '{print $3}')  →  $PSQL"
  else
    fail "psql not found — PostgreSQL 14+ is required"
    if [[ "$OS" == "macos" ]]; then
      warn "  Install: brew install postgresql@16"
      warn "           brew services start postgresql@16"
      warn "  Then add to PATH: echo 'export PATH=\"\$(brew --prefix postgresql@16)/bin:\$PATH\"' >> ~/.zshrc"
    else
      warn "  Install: sudo apt-get install -y postgresql postgresql-contrib"
      warn "           sudo service postgresql start"
    fi
    MISSING=1
  fi
fi

[[ $MISSING -eq 1 ]] && die "Fix the missing dependencies above, then re-run setup.sh"

# ════════════════════════════════════════════════════════════════
# STEP 2 — Environment file
# ════════════════════════════════════════════════════════════════
section "Environment (.env)"

if [[ -f ".env" && $RESET -eq 0 ]]; then
  warn ".env already exists — keeping it  (delete to regenerate)"
else
  [[ $RESET -eq 1 && -f ".env" ]] && { info "Removing old .env for reset"; rm .env; }

  SYS_USER="$(whoami)"
  JWT_RAND="$(node -e "process.stdout.write(require('crypto').randomBytes(16).toString('hex'))")"

  cat > .env <<ENVEOF
PORT=3000
NODE_ENV=development

# ── Database ──────────────────────────────────────────────────
# No password needed for a local Homebrew postgres install.
# If your Postgres requires a password: postgresql://user:pass@localhost:5432/moveassist
DATABASE_URL=postgresql://${SYS_USER}@localhost:5432/moveassist

# ── JWT ───────────────────────────────────────────────────────
# Auto-generated. Replace with something stronger in production.
JWT_SECRET=ma_dev_${JWT_RAND}
JWT_EXPIRES_IN=7d

# ── AWS S3 (optional) ─────────────────────────────────────────
# Leave blank to skip photo uploads — everything else still works.
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET_NAME=moveassist-images

# ── App ───────────────────────────────────────────────────────
BASE_URL=http://localhost:3000
ENVEOF
  ok ".env created  (DB user: $SYS_USER  |  JWT: auto-generated)"
fi

# Load env vars
set -a; source .env; set +a
DB_URL="${DATABASE_URL:-}"
[[ -z "$DB_URL" ]] && die "DATABASE_URL is empty — check your .env"

# ════════════════════════════════════════════════════════════════
# STEP 3 — Node dependencies
# ════════════════════════════════════════════════════════════════
section "Node.js dependencies"

if [[ -d "node_modules" && -f "node_modules/.package-lock.json" && $RESET -eq 0 ]]; then
  info "node_modules present — running npm ci (clean reproducible install)"
  npm ci --prefer-offline --silent 2>&1 | tail -3 || npm install --silent
else
  info "Running npm install..."
  npm install --silent
fi
ok "Dependencies installed ($(node -e "const p=require('./package.json');const d=Object.keys(Object.assign({},p.dependencies,p.devDependencies||{})).length;console.log(d+' packages')"))"

# ════════════════════════════════════════════════════════════════
# STEP 4 — Database
# ════════════════════════════════════════════════════════════════
if [[ $SKIP_DB -eq 1 ]]; then
  warn "Skipping database setup (--skip-db)"
else

section "Database"

# Parse DB name from URL
DB_NAME="$(echo "$DB_URL" | sed 's|.*\/||' | cut -d'?' -f1)"
[[ -z "$DB_NAME" ]] && DB_NAME="moveassist"

# Maintenance DB URL (replace dbname with 'postgres')
ADMIN_URL="$(echo "$DB_URL" | sed "s|/${DB_NAME}\$|/postgres|")"

info "Target database: ${BOLD}${DB_NAME}${NC}"

# Verify Postgres is reachable
if ! "$PSQL" "$ADMIN_URL" -c '\q' &>/dev/null 2>&1; then
  fail "Cannot reach PostgreSQL. Is it running?"
  if [[ "$OS" == "macos" ]]; then
    warn "  Start: brew services start postgresql@16"
  else
    warn "  Start: sudo service postgresql start"
  fi
  warn "  Also verify DATABASE_URL in .env"
  exit 1
fi

# --reset: drop existing DB
if [[ $RESET -eq 1 ]]; then
  if "$PSQL" "$DB_URL" -c '\q' &>/dev/null 2>&1; then
    warn "Dropping database '$DB_NAME'..."
    "$PSQL" "$ADMIN_URL" -c "DROP DATABASE \"$DB_NAME\";" &>/dev/null
    ok "Dropped '$DB_NAME'"
  fi
fi

# Create DB if missing
if "$PSQL" "$DB_URL" -c '\q' &>/dev/null 2>&1; then
  ok "Database '$DB_NAME' already exists"
else
  "$PSQL" "$ADMIN_URL" -c "CREATE DATABASE \"$DB_NAME\";" &>/dev/null
  ok "Database '$DB_NAME' created"
fi

# ════════════════════════════════════════════════════════════════
# STEP 5 — Migrations (idempotent — safe to re-run)
# ════════════════════════════════════════════════════════════════
section "Database migrations"

run_sql() {
  local file="$1" label="$2"
  if [[ ! -f "$file" ]]; then
    warn "SKIP  $label  (file not found: $file)"; return 0
  fi
  local out
  if out=$("$PSQL" "$DB_URL" -v ON_ERROR_STOP=1 -f "$file" 2>&1); then
    ok "$label"
  else
    # Tolerate "already exists" — migrations are idempotent
    if echo "$out" | grep -qiE "\bERROR\b|\bFATAL\b" && \
       ! echo "$out" | grep -qiE "already exists|duplicate key|column .* already|table .* already"; then
      fail "$label"
      echo "$out" | grep -iE "ERROR|FATAL" | head -5 | sed 's/^/     /'
      return 1
    else
      warn "$label  (already applied)"
    fi
  fi
}

run_sql "src/utils/schema.sql"                    "01  Core schema          (users, moves, boxes, furniture)"
run_sql "src/utils/payment_migration.sql"         "02  Payment gate         (payments, move_pricing)"
run_sql "src/utils/token_quote_migration.sql"     "03  Token & quote        (token_amount, agent_quotes)"
run_sql "src/utils/move_plan_migration.sql"       "04  Move plans           (move_plans table)"

# Add 'role' column to users before agent profiles (base schema doesn't include it)
"$PSQL" "$DB_URL" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'customer';" &>/dev/null \
  && ok "04b Role column         (users.role)" \
  || warn "04b Role column         (already present)"

run_sql "setup_agent_profiles.sql"                "05  Agent profiles       (user_profiles, auto-assignment)"
run_sql "setup_pricing_system.sql"                "06  Pricing system       (pricing_configs, overrides)"
run_sql "setup_feature_flags.sql"                 "07  Feature flags        (feature_flags table)"
run_sql "migrations/addon_services_schema.sql"    "08  Add-on schema        (addon_services, move_addons)"

# Step 09: only seed if table is empty (INSERT has no ON CONFLICT guard)
ADDON_COUNT=$("$PSQL" "$DB_URL" -tAc "SELECT COUNT(*) FROM addon_services;" 2>/dev/null || echo "0")
if [[ "$ADDON_COUNT" -eq 0 ]]; then
  run_sql "setup_addon_services.sql"              "09  Add-on seed data     (default service catalog)"
else
  ok "09  Add-on seed data     (${ADDON_COUNT} services already present — skipped)"
fi
run_sql "migrations/004_add_delivered_boxes.sql"  "10  Delivered boxes col  (moves.delivered_boxes)"
run_sql "migrations/005_notifications.sql"        "11  Notifications table  (notifications)"
run_sql "migrations/006_missing_tables.sql"       "12  Missing tables       (move_activities, disputes, move_documents, move_items)"

# ════════════════════════════════════════════════════════════════
# STEP 6 — Seed users (idempotent)
# ════════════════════════════════════════════════════════════════
section "Seed users"

# bcrypt hash of "Test@123" (cost=10) — safe to hardcode for dev seeds
HASH='$2a$10$yoRw4rtXZiu.06iQiFwg4OzpL4gqoo3ogrsxEA3wsvueKt4pkWVxW'

SEED_SQL="
DO \$\$
BEGIN
  -- Ensure role column exists (may be missing on very old schemas)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='role'
  ) THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'customer';
  END IF;

  -- Admin
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@moveassist.com') THEN
    INSERT INTO users (name, email, password_hash, phone, role)
    VALUES ('Admin', 'admin@moveassist.com', '${HASH}', '+91-9777777777', 'admin');
    RAISE NOTICE 'CREATED  admin@moveassist.com';
  ELSE
    RAISE NOTICE 'EXISTS   admin@moveassist.com';
  END IF;

  -- Demo agent
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'agent@moveassist.com') THEN
    INSERT INTO users (name, email, password_hash, phone, role)
    VALUES ('Demo Agent', 'agent@moveassist.com', '${HASH}', '9888888888', 'agent');
    RAISE NOTICE 'CREATED  agent@moveassist.com';
  ELSE
    RAISE NOTICE 'EXISTS   agent@moveassist.com';
  END IF;

  -- Demo customer
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'customer@moveassist.com') THEN
    INSERT INTO users (name, email, password_hash, phone, role)
    VALUES ('Demo Customer', 'customer@moveassist.com', '${HASH}', '9777777777', 'customer');
    RAISE NOTICE 'CREATED  customer@moveassist.com';
  ELSE
    RAISE NOTICE 'EXISTS   customer@moveassist.com';
  END IF;
END\$\$;
"

SEED_OUT=$("$PSQL" "$DB_URL" -c "$SEED_SQL" 2>&1)
echo "$SEED_OUT" | grep "NOTICE:" | sed 's/.*NOTICE: //' | while read -r msg; do
  if echo "$msg" | grep -q "CREATED"; then ok "$msg"; else info "$msg"; fi
done

# ════════════════════════════════════════════════════════════════
# STEP 7 — Validate DB state
# ════════════════════════════════════════════════════════════════
section "Validating database"

node --no-warnings -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const checks = [
  ['users',          'SELECT COUNT(*) FROM users'],
  ['moves',          'SELECT COUNT(*) FROM moves'],
  ['boxes',          'SELECT COUNT(*) FROM boxes'],
  ['payments',       'SELECT COUNT(*) FROM payments'],
  ['addon_services', 'SELECT COUNT(*) FROM addon_services WHERE is_active = true'],
];

Promise.all(checks.map(([name, sql]) =>
  pool.query(sql).then(r => [name, r.rows[0].count])
)).then(results => {
  results.forEach(([name, count]) =>
    console.log('  \x1b[32m✔\x1b[0m  ' + name.padEnd(18) + count + ' rows')
  );
  pool.end();
}).catch(e => {
  console.error('  \x1b[31m✖\x1b[0m  DB validation failed:', e.message);
  pool.end();
  process.exit(1);
});
"

fi  # end SKIP_DB block

# ════════════════════════════════════════════════════════════════
# Done
# ════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}  ════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}   ✅  Setup complete!${NC}"
echo -e "${BOLD}${GREEN}  ════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Start the server${NC}"
echo -e "    ${CYAN}npm run dev${NC}      →  with auto-reload (development)"
echo -e "    ${CYAN}npm start${NC}        →  production"
echo ""
echo -e "  ${BOLD}Open in browser${NC}   ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "  ${BOLD}Test credentials${NC}  (all use password: ${YELLOW}Test@123${NC})"
echo -e "    ${YELLOW}Admin${NC}     admin@moveassist.com"
echo -e "    ${YELLOW}Agent${NC}     agent@moveassist.com"
echo -e "    ${YELLOW}Customer${NC}  customer@moveassist.com"
echo ""
echo -e "  ${BOLD}Re-run options${NC}"
echo -e "    ${CYAN}bash setup.sh --reset${NC}    →  drop DB and start fresh"
echo -e "    ${CYAN}bash setup.sh --skip-db${NC}  →  deps + .env only"
echo ""
[[ -z "${AWS_ACCESS_KEY_ID:-}" ]] && \
  warn "AWS S3 keys not set — photo uploads are disabled (add to .env to enable)"
echo ""
