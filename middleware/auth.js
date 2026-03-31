const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  // Check for token in cookies or session
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.redirect('/admin/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.redirect('/admin/login');
  }
}

module.exports = { requireAdmin };