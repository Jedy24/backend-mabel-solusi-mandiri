import { createRequire } from 'node:module';
import bcrypt from 'bcryptjs';
import { beforeAll, expect, it } from 'vitest';
import { client, demo } from './client.mjs';

const require = createRequire(import.meta.url);
const prisma = require('../src/config/database');
const admin = { email: 'admin-test@visitflow.test', password: 'FixtureAdmin123!' };
const adminId = 'test-admin';
let adminToken;
let userToken;

beforeAll(async () => {
    await prisma.user.create({
        data: {
            id: adminId,
            email: admin.email,
            name: 'Test Admin',
            role: 'ADMIN',
            passwordHash: await bcrypt.hash(admin.password, 12)
        }
    });
    const loginAdmin = await client.post('/api/auth/login').send(admin).expect(200);
    const loginUser = await client.post('/api/auth/login').send(demo).expect(200);
    adminToken = loginAdmin.body.data.token;
    userToken = loginUser.body.data.token;
}, 15000);

function asAdmin(method, path) {
    return client[method](path).auth(adminToken, { type: 'bearer' });
}

it('requires authentication and blocks all admin sections and writes for a USER', async () => {
    for (const section of ['users', 'entities', 'sales', 'audit']) {
        const path = '/api/admin/' + section;
        await client.get(path).expect(401);
        await client.get(path).auth(userToken, { type: 'bearer' }).expect(403);
        await asAdmin('get', path).expect(200);
    }

    await client
        .post('/api/admin/users')
        .auth(userToken, { type: 'bearer' })
        .send({ role: 'ADMIN' })
        .expect(403);
});

it('creates both account roles and excludes passwords and hashes from the API and audit', async () => {
    const password = 'AccountFixture123!';
    for (const role of ['USER', 'ADMIN']) {
        const payload = { name: role, email: role + '@visitflow.test', password, role };
        const created = await asAdmin('post', '/api/admin/users').send(payload).expect(201);
        expect(created.body.data).toMatchObject({ role, email: payload.email.toLowerCase() });
        expect(created.body.data).not.toHaveProperty('passwordHash');
        await asAdmin('post', '/api/admin/users').send(payload).expect(409);

        const login = await client
            .post('/api/auth/login')
            .send({ email: payload.email, password })
            .expect(200);
        expect(login.body.data.user.role).toBe(role);
    }

    const audit = await asAdmin('get', '/api/admin/audit').expect(200);
    expect(
        audit.body.data.rows.filter((row) => row.targetType === 'User' && row.action === 'CREATE')
    ).toHaveLength(2);
    expect(JSON.stringify(audit.body)).not.toMatch(
        /AccountFixture123|passwordHash|"password"|FixtureAdmin123/
    );
}, 15000);

it('manages catalogs, keeps history, and attributes visit changes to both roles', async () => {
    const entityData = { name: 'Test Office', type: 'Office', segment: 'B2G', region: 'Bandung' };
    const entity = await asAdmin('post', '/api/admin/entities').send(entityData).expect(201);
    const sale = await asAdmin('post', '/api/admin/sales').send({ name: 'Test Sales' }).expect(201);
    const entityId = entity.body.data.id;
    const salesId = sale.body.data.id;
    const entityPath = '/api/admin/entities/' + entityId;
    const salesPath = '/api/admin/sales/' + salesId;
    await asAdmin('patch', entityPath)
        .send({ ...entityData, region: 'Bogor' })
        .expect(200);

    const visitData = { entityId, salesId, segment: 'B2G', visitDate: '2026-11-14' };
    const visit = await asAdmin('post', '/api/activities').send(visitData).expect(201);
    const visitId = visit.body.data.id;
    await asAdmin('patch', salesPath).send({ name: 'Renamed Sales' }).expect(200);
    await asAdmin('patch', entityPath)
        .send({ ...entityData, segment: 'B2B' })
        .expect(409);

    const activityPath = '/api/activities/' + visitId;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        await client
            .patch(activityPath)
            .auth(userToken, { type: 'bearer' })
            .send({ status: 'VISITED' })
            .expect(200);
    }
    await asAdmin('delete', salesPath).expect(200);
    await asAdmin('delete', salesPath).expect(200);
    const rejectedSale = await asAdmin('post', '/api/activities').send(visitData).expect(400);
    expect(rejectedSale.body.errors.salesId).toBeDefined();
    await asAdmin('delete', entityPath).expect(200);

    const entities = await asAdmin('get', '/api/entities')
        .query({ search: 'Test Office' })
        .expect(200);
    const sales = await asAdmin('get', '/api/sales').query({ search: 'Renamed Sales' }).expect(200);
    expect(entities.body.data).toEqual([]);
    expect(sales.body.data).toEqual([]);

    const history = await asAdmin('get', '/api/activities')
        .query({ search: 'Test Office' })
        .expect(200);
    expect(history.body.data).toEqual([
        expect.objectContaining({ salesName: 'Test Sales', status: 'VISITED', id: visitId })
    ]);

    const audit = await asAdmin('get', '/api/admin/audit').expect(200);
    const entries = audit.body.data.rows;
    expect(entries).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ action: 'LOGIN', actorId: adminId }),
            expect.objectContaining({ action: 'UPDATE', targetId: entityId, actorId: adminId }),
            expect.objectContaining({
                action: 'CREATE',
                targetId: visitId,
                actorId: adminId,
                actorRole: 'ADMIN'
            }),
            expect.objectContaining({
                action: 'UPDATE_STATUS',
                targetId: visitId,
                actorEmail: demo.email,
                actorRole: 'USER',
                changes: { before: { status: 'NOT_VISITED' }, after: { status: 'VISITED' } }
            })
        ])
    );
    expect(entries.filter((row) => row.targetId === visitId)).toHaveLength(2);
    expect(
        entries.filter((row) => row.targetId === salesId && row.action === 'ARCHIVE')
    ).toHaveLength(1);

    await asAdmin('patch', entityPath)
        .send({ ...entityData, isActive: true })
        .expect(200);
    await asAdmin('patch', salesPath).send({ name: 'Renamed Sales', isActive: true }).expect(200);
    await asAdmin('post', '/api/activities').send(visitData).expect(201);
}, 15000);
