const { Router } = require('express');
const { body, matchedData, param, query } = require('express-validator');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const validateRequest = require('../middleware/validateRequest');
const { recordAudit } = require('../services/auditService');

const router = Router();
const userFields = { id: true, name: true, email: true, role: true, createdAt: true };

function text(field, max = 100) {
    return body(field).isString().bail().trim().isLength({ min: 1, max })
        .withMessage('Enter a valid ' + field);
}

function ok(res, data, status = 200) {
    return res.status(status).json({
        success: true,
        data
    });
}

function fail(res, status, message) {
    return res.status(status).json({
        success: false,
        message
    });
}

router.get('/users', async (req, res) => {
    const users = await prisma.user.findMany({
        select: userFields,
        orderBy: {
            email: 'asc'
        }
    });
    return ok(res, users);
});

router.post(
    '/users',
    [
        text('name'),
        body('email').isString().bail().trim().isEmail().bail().toLowerCase(),
        body('password').isString().bail().isLength({ min: 12 }).bail()
            .isByteLength({ max: 72 }).withMessage('Password must be at least 12 characters and at most 72 bytes')
            .hide(),
        body('role').isString().bail().isIn(['ADMIN', 'USER']),
        validateRequest
    ],
    async (req, res) => {
        const { name, email, role, password } = matchedData(req);
        const passwordHash = await bcrypt.hash(password, 12);

        try {
            const user = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        name,
                        email,
                        role,
                        passwordHash
                    },
                    select: userFields
                });
                await recordAudit(tx, req.user, 'CREATE', 'User', created.id, {
                    after: { name, email, role }
                });
                return created;
            });
            return ok(res, user, 201);
        } catch (error) {
            if (error.code === 'P2002') {
                return fail(res, 409, 'This email is already registered');
            }
            throw error;
        }
    }
);

const catalogs = [
    {
        path: '/entities',
        model: 'entity',
        target: 'Entity',
        fields: [
            text('name'),
            text('type'),
            body('segment').isString().bail().isIn(['B2G', 'B2B']),
            text('region'),
            body('isMaster').optional().custom((value) => typeof value === 'boolean')
        ]
    },
    {
        path: '/sales',
        model: 'salesperson',
        target: 'Salesperson',
        fields: [text('name')]
    }
];

for (const { path, model, target, fields } of catalogs) {
    const itemPath = path + '/:id';
    const idRule = param('id').isLength({ min: 1, max: 100 });

    router.get(path, async (req, res) => {
        return ok(res, await prisma[model].findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] }));
    });

    router.post(path, fields, validateRequest, async (req, res) => {
        const data = matchedData(req);
        try {
            const item = await prisma.$transaction(async (tx) => {
                const created = await tx[model].create({ data });
                await recordAudit(tx, req.user, 'CREATE', target, created.id, { after: created });
                return created;
            });
            return ok(res, item, 201);
        } catch (error) {
            if (error.code === 'P2002') {
                return fail(res, 409, 'This name is already in the catalog');
            }
            throw error;
        }
    });

    router.patch(
        itemPath,
        idRule,
        fields,
        body('isActive').optional().custom((value) => typeof value === 'boolean'),
        validateRequest,
        async (req, res) => {
            const { id, ...data } = matchedData(req);
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const before = await tx[model].findUnique({ where: { id } });
                    if (!before) {
                        return { status: 404, message: 'Catalog item not found' };
                    }

                    if (model === 'entity' && data.segment !== before.segment) {
                        const usage = await tx.activity.findFirst({
                            where: { entityId: id },
                            select: { id: true }
                        });
                        if (usage) {
                            return {
                                status: 409,
                                message: 'An entity with visits must keep its segment'
                            };
                        }
                    }

                    const after = await tx[model].update({ where: { id }, data });
                    await recordAudit(tx, req.user, 'UPDATE', target, id, { before, after });
                    return { item: after };
                });

                if (result.status) {
                    return fail(res, result.status, result.message);
                }
                return ok(res, result.item);
            } catch (error) {
                if (error.code === 'P2002') {
                    return fail(
                        res,
                        409,
                        'This name is already in the catalog'
                    );
                }
                throw error;
            }
        }
    );

    router.delete(itemPath, idRule, validateRequest, async (req, res) => {
        const { id } = matchedData(req);
        const item = await prisma.$transaction(async (tx) => {
            const before = await tx[model].findUnique({ where: { id } });
            if (!before || !before.isActive) {
                return before;
            }

            const after = await tx[model].update({ where: { id }, data: { isActive: false } });
            await recordAudit(tx, req.user, 'ARCHIVE', target, id, {
                before: { isActive: true },
                after: { isActive: false }
            });
            return after;
        });

        return item ? ok(res, item) : fail(res, 404, 'Catalog item not found');
    });
}

router.get(
    '/audit',
    query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
    validateRequest,
    async (req, res) => {
        const { page = 1 } = matchedData(req);
        const pageSize = 25;
        const rows = await prisma.auditLog.findMany({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * pageSize,
            take: pageSize + 1
        });

        return ok(res, {
            rows: rows.slice(0, pageSize).map(({ changes, ...entry }) => ({
                ...entry,
                changes: changes ? JSON.parse(changes) : null
            })),
            hasNext: rows.length > pageSize
        });
    }
);

module.exports = router;