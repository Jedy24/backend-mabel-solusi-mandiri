import jwt from 'jsonwebtoken';
import { expect, it } from 'vitest';
import { client, demo } from './client.mjs';

it('logs in and returns the current user without their password hash', async () => {
    const login = await client.post('/api/auth/login').send(demo).expect(200);
    expect(login.body.data.user).toEqual({
        id: 'user-001',
        name: 'Demo User',
        email: demo.email
    });

    const me = await client
        .get('/api/auth/me')
        .auth(login.body.data.token, { type: 'bearer' })
        .expect(200);
    expect(me.body.data).toEqual(login.body.data.user);
});

it('rejects invalid login credentials', async () => {
    await client
        .post('/api/auth/login')
        .send({ ...demo, password: 'invalid' })
        .expect(401);
});

it.each(['/api/auth/me', '/api/activities', '/api/entities'])(
    'requires authentication for %s',
    async (path) => {
        await client.get(path).expect(401);
    }
);

it('rejects anonymous writes, malformed tokens, and expired tokens', async () => {
    const expired = jwt.sign({}, process.env.JWT_SECRET, { subject: 'user-001', expiresIn: -1 });
    await client.post('/api/activities').send({}).expect(401);
    await client.patch('/api/activities/visit-001').send({ status: 'VISITED' }).expect(401);
    await client.get('/api/activities').auth('invalid', { type: 'bearer' }).expect(401);
    await client.get('/api/activities').auth(expired, { type: 'bearer' }).expect(401);
});
