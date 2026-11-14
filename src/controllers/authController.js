const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { matchedData } = require('express-validator');
const prisma = require('../config/database');
const { recordAudit } = require('../services/auditService');

const userFields = {
    id: true,
    name: true,
    email: true,
    role: true
};
const fallbackHash = bcrypt.hashSync('unused-password-for-missing-users', 12);

async function login(req, res) {
    const { email, password } = matchedData(req);
    const user = await prisma.user.findUnique({
        where: { email },
        select: { ...userFields, passwordHash: true }
    });

    const matches = await bcrypt.compare(password, user?.passwordHash ?? fallbackHash);
    if (!user || !matches) {
        return res.status(401).json({
            success: false,
            message: 'Email or password is incorrect'
        });
    }

    const { id, name, role } = user;
    const publicUser = { id, name, email: user.email, role };
    const token = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        subject: id,
        expiresIn: '8h'
    });

    await recordAudit(prisma, publicUser, 'LOGIN', 'User', id);

    return res.json({
        success: true,
        message: 'Login successful',
        data: { token, user: publicUser }
    });
}

function getCurrentUser(req, res) {
    return res.json({
        success: true,
        data: req.user
    });
}

module.exports = { login, getCurrentUser };
