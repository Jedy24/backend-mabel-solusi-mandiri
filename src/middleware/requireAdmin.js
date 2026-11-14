function requireAdmin(req, res, next) {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            message: 'Admin access is required'
        });
    }

    return next();
}

module.exports = requireAdmin;