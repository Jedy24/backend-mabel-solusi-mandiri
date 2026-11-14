require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

async function main() {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Set BOOTSTRAP_ADMIN_EMAIL to a valid email');
    }
    if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('Use an admin password of at least 12 characters and at most 72 bytes');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
        data: { name: 'Visit Flow Admin', email, passwordHash, role: 'ADMIN' },
        select: { email: true }
    });
    console.log('Admin created for ' + user.email);
}

main()
    .catch((error) => {
        console.error(error.code === 'P2002' ? 'This email is already registered' : error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());