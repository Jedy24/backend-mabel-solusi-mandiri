const prisma = require('../config/database');
const { entityFilters } = require('./entityService');
const { recordAudit } = require('./auditService');

function formatActivity(activity) {
    return {
        ...activity,
        visitDate: activity.visitDate.toISOString().slice(0, 10)
    };
}

async function getActivities({ segment, status, from, to, search }) {
    const activities = await prisma.activity.findMany({
        where: {
            segment,
            status,
            visitDate: {
                gte: from ? new Date(from) : undefined,
                lte: to ? new Date(to) : undefined
            },
            entity: entityFilters({ search })
        },
        include: { entity: true },
        orderBy: [{ visitDate: 'desc' }, { id: 'asc' }]
    });
    return activities.map(formatActivity);
}

async function createActivity({ entityId, salesId, salesName, segment, visitDate }, actor) {
    return prisma.$transaction(async (tx) => {
        const entity = await tx.entity.findUnique({
            where: { id: entityId },
            select: { segment: true, isActive: true }
        });
        if (!entity?.isActive) {
            return { field: 'entityId', message: 'Select an active entity' };
        }
        if (entity.segment !== segment) {
            return { field: 'entityId', message: 'Select an entity in the chosen segment' };
        }

        const salesperson = salesId ? await tx.salesperson.findUnique({ where: { id: salesId } }) : null;
        if (salesId && !salesperson?.isActive) {
            return { field: 'salesId', message: 'Select an active salesperson' };
        }

        const activity = await tx.activity.create({
            data: {
                entityId,
                salesId,
                salesName: salesperson?.name ?? salesName,
                segment,
                visitDate: new Date(visitDate)
            },
            include: { entity: true }
        });
        await recordAudit(tx, actor, 'CREATE', 'Activity', activity.id, {
            after: {
                entityId,
                salesId: activity.salesId,
                salesName: activity.salesName,
                segment,
                visitDate,
                status: activity.status
            }
        });

        return { activity: formatActivity(activity) };
    });
}

async function updateStatus(id, status, actor) {
    return prisma.$transaction(async (tx) => {
        const before = await tx.activity.findUnique({
            where: { id },
            include: { entity: true }
        });
        if (!before) {
            return null;
        }
        if (before.status === status) {
            return formatActivity(before);
        }

        const activity = await tx.activity.update({
            where: { id },
            data: { status },
            include: { entity: true }
        });
        await recordAudit(tx, actor, 'UPDATE_STATUS', 'Activity', id, {
            before: { status: before.status },
            after: { status }
        });

        return formatActivity(activity);
    });
}

module.exports = { getActivities, createActivity, updateStatus };
