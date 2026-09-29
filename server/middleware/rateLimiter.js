// ==============================================================
// In-Memory Rate Limiter Middleware (Security Checklist #2 & #5)
// Protects against DoS, brute force, and abuse without external Redis.
// ==============================================================

function createRateLimiter({ windowMs = 60 * 1000, maxRequests = 100, message = 'Too many requests. Please try again later.' } = {}) {
  const ipRequests = new Map();

  // Periodic cleanup every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipRequests.entries()) {
      if (now - data.startTime > windowMs) {
        ipRequests.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  return function rateLimiter(req, res, next) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = ipRequests.get(clientIp);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      ipRequests.set(clientIp, record);
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - record.startTime)) / 1000));
      return res.status(429).json({
        error: message,
        retryAfterSeconds: Math.ceil((windowMs - (now - record.startTime)) / 1000),
      });
    }

    next();
  };
}

// Preset Limiters
const standardLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 120 });
const strictWebhookLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 60, message: 'Webhook rate limit exceeded.' });

module.exports = {
  createRateLimiter,
  standardLimiter,
  strictWebhookLimiter,
};
