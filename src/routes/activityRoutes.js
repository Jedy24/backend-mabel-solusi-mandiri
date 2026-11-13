const { Router } = require('express');
const controller = require('../controllers/activityController');
const validateRequest = require('../middleware/validateRequest');
const validators = require('../validators/activityValidator');

const router = Router();

router.get('/', validators.activityQuery, validateRequest, controller.getActivities);
router.post('/', validators.createActivity, validateRequest, controller.createActivity);
router.patch('/:id', validators.updateStatus, validateRequest, controller.updateStatus);

module.exports = router;
