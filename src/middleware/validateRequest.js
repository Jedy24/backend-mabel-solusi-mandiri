const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
    const result = validationResult(req);
    if (result.isEmpty()) {
        return next();
    }

    const errors = {};
    for (const [field, error] of Object.entries(result.mapped())) {
        errors[field] = error.msg;
    }

    return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
    });
}

module.exports = validateRequest;
