# MoveAssist

> Home shifting made structured — QR box tracking, agent quotes, payment gate, furniture docs, and automated move reports.

## Quick Start

```bash
git clone https://github.com/amitsingh12ap/moveassist.git
cd moveassist/backend
bash setup.sh
npm run dev
```

Open **http://localhost:3000** — that's it. `setup.sh` handles Node deps, Postgres DB creation, all migrations, and demo seed data automatically.

See [`backend/README.md`](./backend/README.md) for full setup docs, flags, and troubleshooting.

---

## Test Credentials (password: `Test@123`)

| Role | Email |
|------|-------|
| Admin | admin@moveassist.com |
| Agent | agent@moveassist.com |
| Customer | customer@moveassist.com |

---

## Project Structure

```
moveassist/
├── backend/          # Node.js + Express API + SPA frontend
│   ├── setup.sh      # ← run this on a new machine
│   ├── README.md     # full developer docs
│   ├── src/          # controllers, routes, middleware
│   ├── public/       # single-page app (HTML/CSS/JS)
│   └── migrations/   # incremental DB migrations
├── frontend/         # Flutter app (iOS, Android, Web)
└── docs/             # Architecture, API docs
```

---

## Features

- **QR Box Tracking** — Unique QR per box: Created → Packed → Loaded → In Transit → Delivered
- **Agent Quotes** — Agents submit quotes, customers approve via token payment
- **Payment Gate** — Token payment unlocks move, final payment on delivery
- **Furniture Documentation** — Photo + condition logs before/after
- **Add-on Services** — Packing, assembly, cleaning etc. with pricing
- **Move Reports** — Auto-generated PDF on completion
- **Admin Dashboard** — User management, pricing control, dispute resolution

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Single-page app (HTML / CSS / Vanilla JS) |
| Mobile | Flutter (iOS / Android / Web) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT |
| Storage | AWS S3 (optional) |
| PDF | PDFKit (server-side) |
