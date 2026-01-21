// Middleware to check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please login to access this page');
  res.redirect('/auth/login');
};

// Middleware to check if user is admin
exports.isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.account_type === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admin privileges required.');
  res.redirect('/dashboard');
};

// Middleware to check if user is attorney or admin
exports.isAttorneyOrAdmin = (req, res, next) => {
  if (req.isAuthenticated() && 
      (req.user.account_type === 'admin' || req.user.account_type === 'attorney')) {
    return next();
  }
  req.flash('error', 'Access denied. Attorney privileges required.');
  res.redirect('/dashboard');
};

// Middleware to check specific account types
exports.hasRole = (...roles) => {
  return (req, res, next) => {
    if (req.isAuthenticated() && roles.includes(req.user.account_type)) {
      return next();
    }
    req.flash('error', 'Access denied. Insufficient privileges.');
    res.redirect('/dashboard');
  };
};
