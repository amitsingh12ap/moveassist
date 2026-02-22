# MoveAssist MVP Sprint Plan

## Sprint 1 — Foundation (Week 1-2)
**Goal:** Auth + Move project CRUD working end-to-end

### Backend
- [ ] PostgreSQL setup + schema migration
- [ ] Auth routes: register, login (JWT)
- [ ] Moves CRUD API
- [ ] Basic error handling + validation

### Flutter
- [ ] Project setup + GoRouter + Riverpod
- [ ] Login + Register screens
- [ ] Move list + Create move screen
- [ ] API client with JWT interceptor

---

## Sprint 2 — QR Box Tracking (Week 3-4)
**Goal:** Full box lifecycle working with QR scan

### Backend
- [ ] Boxes API (create, list, update status)
- [ ] QR generation with UUID
- [ ] Scan logging endpoint
- [ ] Box scan history query

### Flutter
- [ ] Box list screen with status badges
- [ ] QR display screen (for printing)
- [ ] QR scanner screen (mobile_scanner)
- [ ] Scan status update flow

---

## Sprint 3 — Furniture Documentation (Week 5-6)
**Goal:** Full photo + condition documentation flow

### Backend
- [ ] Furniture CRUD API
- [ ] S3 upload middleware (multer-s3)
- [ ] Photo association to furniture items
- [ ] Condition before/after update

### Flutter
- [ ] Furniture list screen
- [ ] Add furniture form (name, category, condition)
- [ ] Photo capture flow (camera + gallery)
- [ ] Photo grid display
- [ ] Condition after update screen

---

## Sprint 4 — Reports + Polish (Week 7-8)
**Goal:** PDF generation + pilot-ready app

### Backend
- [ ] PDFKit report generation
- [ ] Report includes: boxes, scans, furniture, photos
- [ ] Performance test: < 10s target
- [ ] Report history table

### Flutter
- [ ] Report screen with generate button
- [ ] PDF viewer integration
- [ ] Move completion flow
- [ ] Loading states + error handling
- [ ] Onboarding flow (< 3 min target)

---

## Pilot Launch Checklist
- [ ] AWS hosting deployed (EC2 or Render)
- [ ] PostgreSQL on RDS
- [ ] S3 bucket configured
- [ ] App TestFlight (iOS) + Play Store internal track
- [ ] 10 beta testers for dry run
- [ ] 100 pilot users targeted
