// src/middleware/jwtAuth.js
const jwt = require('jsonwebtoken');
const logger = require('pino')();

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, secret);
}

function accessMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header');
    return res.status(404).json({ error: 'Not found' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    logger.warn({ err: err.message }, 'JWT verification failed');
    return res.status(404).json({ error: 'Not found' });
  }

  const caseId = req.body?.case_id || req.query?.case_id;
  if (decoded.role === 'agent' && caseId && !decoded.assigned_cases?.includes(caseId)) {
    logger.warn({ user_id: decoded.user_id, caseId }, 'Unauthorized case access (silent block)');
    return res.status(404).json({ error: 'Not found' });
  }

  req.user = decoded;
  next();
}

function createToken(payload) {
  const secret = process.env.JWT_SECRET;
  const expiry = process.env.JWT_EXPIRY || '8h';
  return jwt.sign(payload, secret, { expiresIn: expiry });
}

function hasAccessLevel(userRole, requiredLevel) {
  const levelMap = { agent: 1, supervisor: 2, admin: 3 };
  return (levelMap[userRole] || 0) >= (levelMap[requiredLevel] || 99);
}

module.exports = { accessMiddleware, verifyToken, createToken, hasAccessLevel };
