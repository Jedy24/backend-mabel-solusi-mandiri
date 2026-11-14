const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

async function authenticate(req, res, next) {
    const match = /^Bearer ([^ ]+)$/i.exec(req.get('authorization') ?? '');
    if (!match) {
        return res.status(401).json({
            success: false,
            message: 'Authentication is required'
        });
    }

    let userId;
    try {
        const payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
        userId = payload.sub;
        if (typeof userId !== 'string' || !userId) {
            throw new Error('Invalid subject');
        }
    } catch {
        return res.status(401).json({
            success: false,
            message: 'Your session is invalid or expired'
        });
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true
        }
    });

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Your account is no longer available'
        });
    }

    req.user = user;
    req.userId = user.id;
    return next();
}

module.exports = authenticate;