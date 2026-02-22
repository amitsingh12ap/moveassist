// Restrict routes to specific roles
// Usage: require('./roleGuard')(['admin']) or roleGuard(['admin','agent'])
module.exports = (allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'forbidden',
      message: `Access restricted to: ${allowedRoles.join(', ')}`,
      your_role: req.user.role,
    });
  }
  next();
};
