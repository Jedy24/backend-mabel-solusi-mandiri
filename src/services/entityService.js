const prisma = require('../config/database');

function entityFilters({ segment, search }) {
    return {
        segment,
        name: search ? { contains: search.replace(/[\\%_]/g, '\\$&') } : undefined
    };
}

async function getEntities(filters) {
    const where = { ...entityFilters(filters), isActive: true };
    const select = { id: true, name: true, type: true, segment: true, region: true };
    const orderBy = [{ name: 'asc' }, { type: 'asc' }, { id: 'asc' }];

    const master = await prisma.entity.findMany({
        where: { ...where, isMaster: true },
        select,
        orderBy
    });

    if (master.length > 0) {
        return master;
    }

    return prisma.entity.findMany({
        where: { ...where, activities: { some: {} } },
        select,
        orderBy
    });
}

module.exports = { entityFilters, getEntities };
