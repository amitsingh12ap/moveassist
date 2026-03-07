/**
 * MoveAssist — Server Entry Point
 *
 * Starts the HTTP server. App configuration lives in app.js
 * so the Express instance can be imported for testing without
 * binding to a port.
 */
require('dotenv').config({ override: true });

const app    = require('./app');
const config = require('../config');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`MoveAssist API running on port ${PORT} [${config.nodeEnv}]`);
});
