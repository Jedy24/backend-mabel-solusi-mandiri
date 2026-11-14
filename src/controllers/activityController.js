const { matchedData } = require('express-validator');
const activityService = require('../services/activityService');

async function getActivities(req, res) {
    const activities = await activityService.getActivities(matchedData(req));
    return res.json({
        success: true,
        data: activities
    });
}

async function createActivity(req, res) {
    const result = await activityService.createActivity(matchedData(req), req.user);
    if (result.field) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: { [result.field]: result.message }
        });
    }

    return res.status(201).json({
        success: true,
        message: 'Visit added',
        data: result.activity
    });
}

async function updateStatus(req, res) {
    const { id, status } = matchedData(req);
    const activity = await activityService.updateStatus(id, status, req.user);
    if (!activity) {
        return res.status(404).json({
            success: false,
            message: 'Visit not found'
        });
    }

    return res.json({
        success: true,
        message: 'Visit status updated',
        data: activity
    });
}

module.exports = { getActivities, createActivity, updateStatus };
