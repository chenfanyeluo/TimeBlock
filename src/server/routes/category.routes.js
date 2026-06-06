const { Router } = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const validate = require('../middleware/validate')
const categoryController = require('../controllers/category.controller')

const router = Router()

// GET /api/categories
router.get('/', authenticate, categoryController.list)

// POST /api/categories
router.post('/', authenticate, [
  body('name').notEmpty().withMessage('分类名称不能为空'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('颜色格式不正确'),
  validate
], categoryController.create)

// PUT /api/categories/:id
router.put('/:id', authenticate, [
  body('name').optional().notEmpty().withMessage('分类名称不能为空'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('颜色格式不正确'),
  validate
], categoryController.update)

// DELETE /api/categories/:id
router.delete('/:id', authenticate, categoryController.remove)

module.exports = router
