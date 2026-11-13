const { Router } = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/authController');
const authenticate = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = Router();

router.post(
    '/login',
    [
        body('email')
            .isString()
            .bail()
            .trim()
            .isEmail()
            .withMessage('Enter a valid email address')
            .toLowerCase(),
        body('password')
            .isString()
            .bail()
            .isByteLength({ min: 1, max: 72 })
            .withMessage('Enter a password of up to 72 bytes')
            .hide(),
        validateRequest
    ],
    controller.login
);
router.get('/me', authenticate, controller.getCurrentUser);

module.exports = router;
