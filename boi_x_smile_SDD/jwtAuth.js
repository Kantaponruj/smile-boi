// src/middleware/jwtAuth.js
// JWT Authentication + Role-Based Access Control
// Silent Block: unauthorized → 404 (not 403) เพื่อไม่เปิดเผยว่าข้อมูลมีอยู่

const jwt = require('jsonwebtoken');
const logger = require('pino')();

/**
 * Verify JWT token และ extract payload
 * ใช้เป็น middleware สำหรับ internal API calls
 */
function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, secret);
}

/**
 * Middleware: ตรวจสอบ JWT และ access ต่อ case_id
 * 
 * JWT Payload structure:
 * {
 *   user_id: "agent_001",
 *   role: "agent" | "supervisor" | "admin",
 *   team: "partner" | "general",
 *   assigned_cases: ["LINE-4591", "LINE-4592"]
 * }
 */
function accessMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header');
    return res.status(404).json({ error: 'Not found' }); // Silent block
  }

  const token = authHeader.split(' ')[1];
  let decoded;

  try {
    decoded = verifyToken(token);
  } catch (err) {
    logger.warn({ err: err.message }, 'JWT verification failed');
    return res.status(404).json({ error: 'Not found' }); // Silent block
  }

  const caseId = req.body?.case_id || req.query?.case_id;

  // Agent เห็นเฉพาะ case ที่ assigned — ห้าม cross-case access
  if (
    decoded.role === 'agent' &&
    caseId &&
    !decoded.assigned_cases?.includes(caseId)
  ) {
    logger.warn(
      { user_id: decoded.user_id, caseId, role: decoded.role },
      'Unauthorized case access attempt (silent block)'
    );
    return res.status(404).json({ error: 'Not found' }); // Silent block — ไม่ใช่ 403
  }

  // Attach decoded payload ไปใน req สำหรับ downstream use
  req.user = decoded;
  next();
}

/**
 * สร้าง JWT token สำหรับ Agent/Admin
 * ใช้ใน scripts หรือ auth service
 */
function createToken(payload) {
  const secret = process.env.JWT_SECRET;
  const expiry = process.env.JWT_EXPIRY || '8h';
  return jwt.sign(payload, secret, { expiresIn: expiry });
}

/**
 * Helper: ตรวจว่า user มีสิทธิ์เห็นข้อมูลระดับ access_level นั้นไหม
 */
function hasAccessLevel(userRole, requiredLevel) {
  const levelMap = { agent: 1, supervisor: 2, admin: 3 };
  return (levelMap[userRole] || 0) >= (levelMap[requiredLevel] || 99);
}

module.exports = { accessMiddleware, verifyToken, createToken, hasAccessLevel };
