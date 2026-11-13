const { matchedData } = require('express-validator');
const entityService = require('../services/entityService');

async function getEntities(req, res) {
    const entities = await entityService.getEntities(matchedData(req));
    return res.json({
        success: true,
        data: entities
    });
}

module.exports = { getEntities };
