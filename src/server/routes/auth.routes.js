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

// POST /api/auth/forgot-password — 忘记密码，发送重置令牌
router.post('/forgot-password', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  validate
], authController.forgotPassword)

// POST /api/auth/reset-password — 使用令牌重置密码
router.post('/reset-password', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('token').notEmpty().withMessage('重置令牌不能为空'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码长度至少6位'),
  validate
], authController.resetPassword)

// POST /api/auth/refresh
router.post('/refresh', authenticate, authController.refresh)

// GET /api/auth/me
router.get('/me', authenticate, authController.me)

module.exports = router
