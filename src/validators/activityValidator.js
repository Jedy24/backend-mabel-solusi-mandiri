const { body, query, param } = require('express-validator');

const segments = ['B2G', 'B2B'];
const statuses = ['NOT_VISITED', 'VISITED'];

function isCalendarDate(value) {
    if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
        return false;
    }

    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function textField(field, message, max) {
    return body(field)
        .if((value, { req }) => field !== 'salesName' || req.body?.salesId === undefined)
        .isString()
        .withMessage(message)
        .bail()
        .trim()
        .isLength({ min: 1, max })
        .withMessage(message)
        .hide();
}

const searchQuery = query('search')
    .optional()
    .isString()
    .bail()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Search can contain up to 120 characters');

const entityQuery = [
    query('segment').optional().isString().bail().isIn(segments).withMessage('Select B2G or B2B'),
    searchQuery
];

const activityQuery = [
    ...entityQuery,
    query('status')
        .optional()
        .isString()
        .bail()
        .isIn(statuses)
        .withMessage('Select a valid visit status'),
    query('from').optional().custom(isCalendarDate).withMessage('Enter a valid start date'),
    query('to')
        .optional()
        .custom(isCalendarDate)
        .withMessage('Enter a valid end date')
        .bail()
        .custom((value, { req }) => !isCalendarDate(req.query.from) || value >= req.query.from)
        .withMessage('End date must be on or after the start date')
];

const createActivity = [
    textField('entityId', 'Select an entity', 100),
    body('segment').isString().bail().isIn(segments).withMessage('Select B2G or B2B'),
    body('visitDate').custom(isCalendarDate).withMessage('Enter a valid visit date'),
    textField('salesId', 'Select a salesperson', 100).optional(),
    textField('salesName', 'Enter a sales name of up to 100 characters', 100)
];

const updateStatus = [
    param('id').isLength({ min: 1, max: 100 }).withMessage('Enter a valid activity ID'),
    body('status').isString().bail().isIn(statuses).withMessage('Select a valid visit status')
];

module.exports = { activityQuery, createActivity, entityQuery, searchQuery, updateStatus };
