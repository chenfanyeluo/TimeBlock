const { Router } = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const validate = require('../middleware/validate')
const noteController = require('../controllers/note.controller')

const router = Router()

// GET /api/notes
router.get('/', authenticate, noteController.list)

// POST /api/notes
router.post('/', authenticate, [
  body('name').notEmpty().withMessage('便签名称不能为空'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('颜色格式不正确'),
  validate
], noteController.create)

// PUT /api/notes/:id
router.put('/:id', authenticate, [
  body('name').optional().notEmpty().withMessage('便签名称不能为空'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('颜色格式不正确'),
  validate
], noteController.update)

// DELETE /api/notes/:id
router.delete('/:id', authenticate, noteController.remove)

module.exports = router
