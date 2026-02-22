# MoveAssist Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Flutter App                              │
│         iOS │ Android │ Web (Single Codebase)               │
└─────────────────────┬───────────────────────────────────────┘
                       │ HTTPS / JWT
┌─────────────────────▼───────────────────────────────────────┐
│              Node.js + Express API                           │
│  /auth  /moves  /boxes  /furniture  /reports                 │
└──────┬──────────────┬──────────────────────┬────────────────┘
       │              │                      │
┌──────▼──────┐ ┌─────▼──────┐  ┌──────────▼──────────┐
│ PostgreSQL  │ │  AWS S3    │  │   PDF Generation     │
│  (data)     │ │  (images)  │  │   (PDFKit, server)   │
└─────────────┘ └────────────┘  └─────────────────────┘
```

## Data Flow

### QR Box Tracking Flow
1. User creates move → generates boxes with UUID-based QR codes
2. QR image stored as base64 data URL in DB
3. Flutter app renders QR for printing
4. On scan: POST /api/boxes/scan/:qrCode with new status
5. Scan logged with timestamp + user + location
6. Box status updated in real time

### Furniture Documentation Flow
1. User adds furniture item with name, category, condition
2. Photos uploaded via multipart form → stored in S3
3. Photo URL + metadata saved in furniture_photos table
4. After move: condition_after updated per item
5. Damage items flagged for report

### Report Generation Flow
1. POST /api/reports/generate/:moveId triggered
2. Server fetches: move details, all boxes + scan logs, furniture + photos
3. PDFKit generates structured PDF in memory
4. PDF streamed directly to client (no temp storage)
5. Generation time logged for performance tracking (target: <10s)

## API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Get JWT token |
| GET | /api/moves | List user's moves |
| POST | /api/moves | Create move project |
| GET | /api/moves/:id | Move detail |
| GET | /api/boxes/move/:moveId | All boxes for move |
| POST | /api/boxes/move/:moveId | Create box + QR |
| POST | /api/boxes/scan/:qrCode | Log QR scan |
| GET | /api/furniture/move/:moveId | All furniture |
| POST | /api/furniture/move/:moveId | Add furniture item |
| POST | /api/furniture/:id/photos | Upload photos |
| POST | /api/reports/generate/:moveId | Generate PDF |

## Security
- JWT with 7d expiry
- Passwords bcrypt hashed (cost 12)
- S3 objects public-read (photos need to be viewable in PDF)
- All routes except QR lookup require auth
- Helmet.js headers on all responses

## Success Metrics Tracking
| Metric | Target | How Measured |
|--------|--------|--------------|
| Onboarding time | < 3 min | Client-side timer |
| Report generation | < 10s | generation_time_ms column |
| Lost boxes | 0 | missing boxes in report |
| Pilot users | 100 | users table count |
