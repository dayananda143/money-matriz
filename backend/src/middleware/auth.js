const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function requireType(...types) {
  return (req, res, next) => {
    if (!types.includes(req.user.user_type)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Allows the given admin roles through, OR any shareholder (user_type === 'shareholder'),
// regardless of their role. Used for read-only endpoints that shareholders should be able
// to view but not mutate — clients are NOT granted access by this.
function requireRoleOrShareholder(...adminRoles) {
  return (req, res, next) => {
    if (adminRoles.includes(req.user.role) || req.user.user_type === 'shareholder') {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  };
}

module.exports = { authenticate, requireRole, requireType, requireRoleOrShareholder };
