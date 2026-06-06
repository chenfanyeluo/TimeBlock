const { Router } = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const validate = require('../middleware/validate')
const authController = require('../controllers/auth.controller')

const router = Router()

// POST /api/auth/register
router.post('/register', [
  body('email').isEmail().withMessage('邮箱格式不正确'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少6位'),
  body('name').notEmpty().withMessage('姓名不能为空'),
  validate
], authController.register)

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('邮箱格式不正确'),
  body('password').notEmpty().withMessage('密码不能为空'),
  validate
], authController.login)

// POST /api/auth/refresh
router.post('/refresh', authenticate, authController.refresh)

// GET /api/auth/me
router.get('/me', authenticate, authController.me)

module.exports = router
