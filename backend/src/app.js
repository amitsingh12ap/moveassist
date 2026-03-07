/**
 * MoveAssist — Express Application Setup
 *
 * Responsibilities:
 *   • Middleware registration (helmet, cors, body-parsing)
 *   • API route mounting
 *   • Static file & admin UI serving
 *   • Global error handling
 *
 * The server (listen) lives in server.js so this module
 * can be imported independently for testing.
 */
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Global Middleware ───────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth',             require('./routes/auth'));
app.use('/api/moves',            require('./routes/moves'));
app.use('/api/boxes',            require('./routes/boxes'));
app.use('/api/furniture',        require('./routes/furniture'));
app.use('/api/reports',          require('./routes/reports'));
app.use('/api/payments',         require('./routes/payments'));
app.use('/api/admin',            require('./routes/admin'));
app.use('/api/admin/pricing',    require('./routes/adminPricing'));
app.use('/api/feature-flags',    require('./routes/featureFlags'));
app.use('/api/activities',       require('./routes/activities'));
app.use('/api/notifications',    require('./routes/notifications'));
app.use('/api/disputes',         require('./routes/disputes'));
app.use('/api/ratings',          require('./routes/ratings'));
app.use('/api/documents',        require('./routes/documents'));
app.use('/api/pricing',          require('./routes/pricing'));
app.use('/api/quotes',           require('./routes/quotes'));
app.use('/api/plans',            require('./routes/plans'));
app.use('/api/agent-assignment', require('./routes/agentAssignment'));
app.use('/api/addons',           require('./routes/addons'));
app.use('/api/move-addons',      require('./routes/moveAddons'));

// ─── Static / Admin UI ──────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

app.get('/admin',         (_req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));
app.get('/admin/pricing', (_req, res) => res.sendFile(path.join(__dirname, '../public/pricing-admin.html')));
app.get('/admin/addons',  (_req, res) => res.sendFile(path.join(__dirname, '../public/addons-admin.html')));
app.get('/api-tester.html', (_req, res) => res.sendFile(path.join(__dirname, '../../docs/api-tester.html')));

// ─── Health Check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', service: 'MoveAssist API' });
});

// ─── 404 Handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
