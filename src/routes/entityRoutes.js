const { Router } = require('express');
const controller = require('../controllers/entityController');
const validateRequest = require('../middleware/validateRequest');
const { entityQuery } = require('../validators/activityValidator');

const router = Router();

router.get('/', entityQuery, validateRequest, controller.getEntities);

module.exports = router;
