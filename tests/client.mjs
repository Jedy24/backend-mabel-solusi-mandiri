import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { afterAll, inject } from 'vitest';
import request from 'supertest';

const require = createRequire(import.meta.url);
const seedDatabase = inject('databaseUrl').slice('file:./'.length);
const folder = await mkdtemp(join('prisma', '.test-'));
try {
    await copyFile(join('prisma', seedDatabase), join(folder, 'tests.db'));
} catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
}

process.env.DATABASE_URL = 'file:./' + basename(folder) + '/tests.db';
process.env.JWT_SECRET = 'a-local-key-used-only-by-automated-tests';

const app = require('../src/app');
const prisma = require('../src/config/database');

export const client = request(app);
export const demo = { email: 'demo@visitflow.test', password: 'Demo12345!' };

afterAll(async () => {
    await prisma.$disconnect();
    await rm(folder, { recursive: true, force: true });
});
