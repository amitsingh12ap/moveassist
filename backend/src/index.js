require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const moveRoutes = require('./routes/moves');
const boxRoutes = require('./routes/boxes');
const furnitureRoutes = require('./routes/furniture');
const reportRoutes = require('./routes/reports');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const adminPricingRoutes = require('./routes/adminPricing');
const featureFlagsRoutes = require('./routes/featureFlags');
const activitiesRoutes = require('./routes/activities');
const notificationsRoutes = require('./routes/notifications');
const disputesRoutes = require('./routes/disputes');
const ratingsRoutes = require('./routes/ratings');
const documentsRoutes = require('./routes/documents');
const pricingRoutes = require('./routes/pricing');
const quotesRoutes = require('./routes/quotes');
const plansRoutes  = require('./routes/plans');
const agentAssignmentRoutes = require('./routes/agentAssignment');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // disabled so the browser tester can run inline scripts + fetch
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/moves', moveRoutes);
app.use('/api/boxes', boxRoutes);
app.use('/api/furniture', furnitureRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/pricing', adminPricingRoutes);
app.use('/api/feature-flags', featureFlagsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/disputes', disputesRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/plans',  plansRoutes);
app.use('/api/agent-assignment', agentAssignmentRoutes);

// Serve PWA static files (manifest, sw, icons, index)
app.use(express.static(path.join(__dirname, '../public')));

// Admin Panel UI
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Pricing Admin UI
app.get('/admin/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pricing-admin.html'));
});

// API Tester UI
app.get('/api-tester.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../docs/api-tester.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', service: 'MoveAssist API' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MoveAssist API running on port ${PORT}`);
});

module.exports = app;
