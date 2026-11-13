const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { matchedData } = require('express-validator');
const prisma = require('../config/database');

const userFields = { id: true, name: true, email: true };
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

    const { id, name } = user;
    const token = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        subject: id,
        expiresIn: '8h'
    });

    return res.json({
        success: true,
        message: 'Login successful',
        data: { token, user: { id, name, email } }
    });
}

async function getCurrentUser(req, res) {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: userFields
    });

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Your account is no longer available'
        });
    }

    return res.json({ success: true, data: user });
}

module.exports = { login, getCurrentUser };
