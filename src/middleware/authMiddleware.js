const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
    const authorization = req.get('authorization') ?? '';
    const match = /^Bearer ([^ ]+)$/i.exec(authorization);

    if (!match) {
        return res.status(401).json({
            success: false,
            message: 'Authentication is required'
        });
    }

    try {
        const payload = jwt.verify(match[1], process.env.JWT_SECRET, {
            algorithms: ['HS256']
        });
        req.userId = payload.sub;
    } catch {
        return res.status(401).json({
            success: false,
            message: 'Your session is invalid or expired'
        });
    }

    return next();
}

module.exports = authenticate;
