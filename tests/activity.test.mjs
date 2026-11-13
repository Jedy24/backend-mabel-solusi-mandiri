import { beforeAll, describe, expect, it } from 'vitest';
import { client, demo } from './client.mjs';

let token;
const validVisit = {
    entityId: 'ent-001',
    segment: 'B2G',
    visitDate: '2026-04-01',
    salesName: 'Andi Pratama'
};

beforeAll(async () => {
    const login = await client.post('/api/auth/login').send(demo).expect(200);
    token = login.body.data.token;
});

function authorized(method, path) {
    return client[method](path).auth(token, { type: 'bearer' });
}

async function list(filters = {}) {
    const response = await authorized('get', '/api/activities').query(filters).expect(200);
    return response.body.data;
}

describe('activities', () => {
    it('lists the seeded visits, with entity details and newest dates first', async () => {
        const activities = await list();
        expect(activities).toHaveLength(26);
        expect(activities[0].visitDate).toBe('2026-03-26');
        expect(activities.at(-1).visitDate).toBe('2026-03-01');
        expect(activities.at(-1).entity.name).toBe('Kantor Layanan Melati');
    });

    it.each([
        ['segment', 'B2G'],
        ['status', 'NOT_VISITED']
    ])('filters by %s', async (field, value) => {
        const activities = await list({ [field]: value });
        expect(activities.length).toBeGreaterThan(0);
        expect(activities.length).toBeLessThan(26);
        expect(activities.every((activity) => activity[field] === value)).toBe(true);
    });

    it('includes both date boundaries and accepts one-sided ranges', async () => {
        expect(
            (await list({ from: '2026-03-05', to: '2026-03-07' })).map((row) => row.visitDate)
        ).toEqual(['2026-03-07', '2026-03-06', '2026-03-05']);
        expect(await list({ from: '2026-03-26' })).toHaveLength(1);
        expect(await list({ to: '2026-03-01' })).toHaveLength(1);
    });

    it('combines all filters and returns an empty array when none match', async () => {
        const filters = {
            segment: 'B2G',
            status: 'VISITED',
            from: '2026-03-01',
            to: '2026-03-07',
            search: 'mElAtI'
        };

        expect((await list(filters)).map((row) => row.id)).toEqual(['visit-007', 'visit-001']);
        expect(await list({ ...filters, segment: 'B2B' })).toEqual([]);
    });

    it('searches entity names case-insensitively and treats wildcards literally', async () => {
        expect(await list({ search: 'MeLaTi' })).toHaveLength(4);
        expect(await list({ search: '%' })).toEqual([]);
        expect(await list({ search: '_' })).toEqual([]);
    });

    it.each([
        { from: '2026-03-08', to: '2026-03-07' },
        { from: '2026-02-29' },
        { status: 'UNKNOWN' },
        { segment: 'B2C' }
    ])('rejects invalid filters %j', async (filters) => {
        await authorized('get', '/api/activities').query(filters).expect(400);
    });

    it('creates a visit as Not Visited and persists both status changes', async () => {
        const created = await authorized('post', '/api/activities')
            .send({ ...validVisit, status: 'VISITED' })
            .expect(201);
        const activity = created.body.data;
        expect(activity).toMatchObject({ ...validVisit, status: 'NOT_VISITED' });
        const path = '/api/activities/' + activity.id;

        for (const status of ['VISITED', 'NOT_VISITED']) {
            await authorized('patch', path).send({ status }).expect(200);
            expect(await list({ from: validVisit.visitDate, status })).toEqual([
                expect.objectContaining({ id: activity.id, status })
            ]);
        }
    });

    it.each([
        ['entityId', ''],
        ['entityId', 'missing'],
        ['entityId', 'ent-002'],
        ['segment', 'B2C'],
        ['visitDate', '2026-02-30'],
        ['salesName', '   ']
    ])('validates %s with value %j', async (field, value) => {
        const response = await authorized('post', '/api/activities')
            .send({ ...validVisit, [field]: value })
            .expect(400);
        expect(response.body.errors[field]).toBeDefined();
    });

    it('rejects invalid statuses and unknown activity IDs', async () => {
        await authorized('patch', '/api/activities/visit-001').send({ status: 'DONE' }).expect(400);
        await authorized('patch', '/api/activities/missing')
            .send({ status: 'VISITED' })
            .expect(404);
    });
});

describe('entities', () => {
    it('filters master entities by segment and search, keeping distinct IDs and types', async () => {
        const response = await authorized('get', '/api/entities')
            .query({ segment: 'B2G', search: 'MELATI' })
            .expect(200);
        expect(response.body.data.map((entity) => [entity.id, entity.type])).toEqual([
            ['ent-001', 'Instansi'],
            ['ent-007', 'Unit Wilayah']
        ]);
    });

    it('returns one history choice for an entity with multiple visits and no master match', async () => {
        const master = await authorized('get', '/api/entities')
            .query({ segment: 'B2G' })
            .expect(200);
        expect(master.body.data).toHaveLength(6);
        const history = await authorized('get', '/api/entities')
            .query({ segment: 'B2G', search: 'cemara' })
            .expect(200);
        expect(history.body.data).toEqual([expect.objectContaining({ id: 'ent-013' })]);

        const unmatched = await authorized('get', '/api/entities')
            .query({ segment: 'B2B', search: 'cemara' })
            .expect(200);
        expect(unmatched.body.data).toEqual([]);
    });
});
