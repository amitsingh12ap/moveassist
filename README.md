# MoveAssist

> Home shifting made structured. QR box tracking, furniture documentation, and automated move reports.

## Project Structure

```
moveassist/
├── backend/          # Node.js + Express API
├── frontend/         # Flutter app (iOS, Android, Web)
├── shared/           # Shared types, constants
└── docs/             # Architecture, API docs
```

## MVP Features
- **QR Box Tracking** — Unique QR per box with status flow: Created → Packed → Loaded → In Transit → Delivered
- **Furniture Documentation** — Photo + condition logs before/after move
- **Move Report PDF** — Auto-generated summary on move completion

## Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend (Flutter)
```bash
cd frontend
flutter pub get
flutter run
```

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | Flutter (iOS / Android / Web) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Storage | AWS S3 |
| Auth | JWT |
| PDF | PDFKit (server-side) |
| Hosting | AWS / Render |
