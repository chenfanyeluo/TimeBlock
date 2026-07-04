const { Router } = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const validate = require('../middleware/validate')
const userController = require('../controllers/user.controller')

const router = Router()

// PUT /api/users/profile
router.put('/profile', authenticate, [
  body('name').optional().notEmpty().withMessage('姓名不能为空'),
  validate
], userController.updateProfile)

// PUT /api/users/password — 修改密码
router.put('/password', authenticate, [
  body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码长度至少6位'),
  validate
], userController.changePassword)

// DELETE /api/users/account — 账号注销（需密码二次确认）
router.delete('/account', authenticate, [
  body('password').notEmpty().withMessage('请输入密码以确认注销'),
  validate
], userController.deleteAccount)

module.exports = router
