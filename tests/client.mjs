import { createRequire } from 'node:module';
import { afterAll, inject } from 'vitest';
import request from 'supertest';

const require = createRequire(import.meta.url);
process.env.DATABASE_URL = inject('databaseUrl');
process.env.JWT_SECRET = 'a-local-key-used-only-by-automated-tests';

const app = require('../src/app');
const prisma = require('../src/config/database');

export const client = request(app);
export const demo = { email: 'demo@visitflow.test', password: 'Demo12345!' };

afterAll(() => prisma.$disconnect());
