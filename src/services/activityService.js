const prisma = require('../config/database');
const { entityFilters } = require('./entityService');

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

async function createActivity({ entityId, salesId, salesName, segment, visitDate }) {
    const entity = await prisma.entity.findUnique({
        where: { id: entityId },
        select: { segment: true }
    });

    if (!entity) {
        return { field: 'entityId', message: 'The selected entity does not exist' };
    }

    if (entity.segment !== segment) {
        return { field: 'entityId', message: 'Select an entity in the chosen segment' };
    }

    const salesperson = salesId
        ? await prisma.salesperson.findUnique({ where: { id: salesId } })
        : null;
    if (salesId && !salesperson) {
        return { field: 'salesId', message: 'The selected salesperson does not exist' };
    }

    const activity = await prisma.activity.create({
        data: {
            entityId,
            salesId,
            salesName: salesperson?.name ?? salesName,
            segment,
            visitDate: new Date(visitDate)
        },
        include: { entity: true }
    });
    return { activity: formatActivity(activity) };
}

async function updateStatus(id, status) {
    try {
        const activity = await prisma.activity.update({
            where: { id },
            data: { status },
            include: { entity: true }
        });
        return formatActivity(activity);
    } catch (error) {
        if (error.code === 'P2025') {
            return null;
        }
        throw error;
    }
}

module.exports = { getActivities, createActivity, updateStatus };
