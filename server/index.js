// ==============================================================
// RescueBridge Production Backend Server
// Hardened Node.js/Express API with Security Best Practices
// ==============================================================

const path = require('path');
const dotenv = require('dotenv');

// 1. Load Environment Variables (Checks server/.env first, then root .env)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const securityHeaders = require('./middleware/securityHeaders');
const { standardLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const { startCron, stopCron } = require('./automation/googleSheetsSync');

// Routes
const webhookRoutes = require('./routes/webhookRoutes');
const sheetSyncRoutes = require('./routes/sheetSyncRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

// 2. Security Headers (Checklist #7)
app.use(securityHeaders);

// 3. CORS Configuration (Checklist #5 - Explicit allowed origins)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://localhost:5001')
  .split(',')
  .map((origin) => origin.trim().toLowerCase());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server Apps Script)
      if (!origin) return callback(null, true);
      const normalized = origin.trim().toLowerCase();
      if (allowedOrigins.includes(normalized) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      logger.warn('Blocked by CORS policy', { origin });
      return callback(new Error('Blocked by CORS policy: Origin not allowed.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Requested-With'],
    credentials: true,
  })
);

// 4. Request Body Parsing with strict size limits (Checklist #4)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Global Rate Limiter (Checklist #5)
app.use(standardLimiter);

// 6. Request Logger
app.use((req, res, next) => {
  if (req.path !== '/health') {
    logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  }
  next();
});

// 7. Mount API Routes
app.use('/api', webhookRoutes);
app.use('/api', sheetSyncRoutes);
app.use('/', healthRoutes);

// 8. Serve Frontend Static Assets in Production (Render Deployment)
const fs = require('fs');
const distPath = path.join(__dirname, '..', 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA Catch-all middleware for React Router (Express 5 compatible)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// 404 Handler for unresolved API or asset routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// 9. Global Error Handler (Checklist #5: No stack trace leaks in responses)
app.use((err, req, res, next) => {
  logger.error('Unhandled server error', err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProd ? 'Internal Server Error' : (err.message || 'Unknown Error'),
  });
});

// 10. Start Server and Background Automation
const server = app.listen(PORT, () => {
  logger.info(`RescueBridge Backend running securely on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start background auto-sync cron
  try {
    startCron();
  } catch (cronErr) {
    logger.error('Failed to start Google Sheets auto-sync cron', cronErr);
  }
});

// Graceful Shutdown
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  stopCron();
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = app;
