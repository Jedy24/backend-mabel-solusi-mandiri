const { Router } = require('express');
const { matchedData } = require('express-validator');
const prisma = require('../config/database');
const validateRequest = require('../middleware/validateRequest');
const { searchQuery } = require('../validators/activityValidator');

const router = Router();

router.get('/', searchQuery, validateRequest, async (req, res) => {
    const { search } = matchedData(req);
    const name = search ? { contains: search.replace(/[\\%_]/g, '\\$&') } : undefined;
    const salespeople = await prisma.salesperson.findMany({
        where: { name },
        orderBy: { name: 'asc' }
    });

    return res.json({
        success: true,
        data: salespeople
    });
});

module.exports = router;
