const ExcelJS = require('exceljs')
const { TimeBlock, Note } = require('../models')
const { success, error } = require('../utils/response')

/**
 * GET /api/export
 * 导出数据 — 支持 JSON 和 Excel (xlsx) 两种格式
 *
 * ?format=json  → 返回 JSON 格式（默认）
 * ?format=excel → 返回 .xlsx 文件下载
 */
async function exportData(req, res, next) {
  try {
    const { format = 'json' } = req.query

    // 查询用户所有数据
    const [notes, timeBlocks] = await Promise.all([
      Note.findAll({ where: { user_id: req.user.id, deleted_at: null } }),
      TimeBlock.findAll({
        where: { user_id: req.user.id, deleted_at: null },
        include: [{ model: Note, as: 'note', attributes: ['id', 'name', 'color'] }],
        order: [['start_time', 'DESC']]
      })
    ])

    if (format === 'excel' || format === 'xlsx') {
      return exportExcel(res, req.user, notes, timeBlocks)
    }

    // JSON 格式直接返回
    const exportPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      userId: req.user.id,
      notes: notes.map(n => ({
        name: n.name,
        color: n.color
      })),
      timeBlocks: timeBlocks.map(tb => ({
        title: tb.title,
        description: tb.description,
        noteName: tb.note?.name || null,
        startTime: tb.start_time,
        endTime: tb.end_time,
        isCompleted: tb.is_completed
      }))
    }

    return success(res, exportPayload, '数据导出成功')

  } catch (err) {
    next(err)
  }
}

/**
 * Excel 格式导出（使用 exceljs）
 *
 * 生成两个工作表：
 * - 时间块记录：标题、描述、便签名称、开始时间、结束时间、时长(h)、是否完成
 * - 便签列表： 名称、颜色、时间块数量
 */
async function exportExcel(res, user, notes, timeBlocks) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'TimeBlock'
  workbook.created = new Date()

  // =============================================
  // 工作表 1: 时间块记录
  // =============================================
  const blocksSheet = workbook.addWorksheet('时间块记录', {
    properties: { tabColor: { argb: '409EFF' } }
  })

  // 设置列
  blocksSheet.columns = [
    { header: '序号', key: 'index', width: 6 },
    { header: '标题', key: 'title', width: 24 },
    { header: '描述/备注', key: 'description', width: 36 },
    { header: '便签', key: 'noteName', width: 12 },
    { header: '开始时间', key: 'startTime', width: 20 },
    { header: '结束时间', key: 'endTime', width: 20 },
    { header: '时长(小时)', key: 'duration', width: 12 },
    { header: '已完成', key: 'isCompleted', width: 10 }
  ]

  // 标题行样式
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '409EFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
  blocksSheet.getRow(1).eachCell(cell => {
    cell.font = headerStyle.font
    cell.fill = headerStyle.fill
    cell.alignment = headerStyle.alignment
    cell.border = headerStyle.border
  })
  blocksSheet.getRow(1).height = 22

  // 填充数据行
  timeBlocks.forEach((tb, idx) => {
    const startTime = new Date(tb.start_time)
    const endTime = new Date(tb.end_time)
    const durationHours = ((endTime - startTime) / (1000 * 60 * 60)).toFixed(2)

    const row = blocksSheet.addRow({
      index: idx + 1,
      title: tb.title,
      description: tb.description || '',
      noteName: tb.note?.name || '—',
      startTime: formatDateTime(startTime),
      endTime: formatDateTime(endTime),
      duration: parseFloat(durationHours),
      isCompleted: tb.is_completed ? '是' : '否'
    })

    // 交替行背景色
    if (idx % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F7FA' } }
      })
    }

    // 行边框
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })
  })

  // 冻结首行
  blocksSheet.views = [{ state: 'frozen', ySplit: 1 }]

  // =============================================
  // 工作表 2: 便签统计
  // =============================================
  const notesSheet = workbook.addWorksheet('便签列表', {
    properties: { tabColor: { argb: '67C23A' } }
  })

  notesSheet.columns = [
    { header: '便签名称', key: 'name', width: 16 },
    { header: '颜色', key: 'color', width: 12 },
    { header: '时间块数量', key: 'blockCount', width: 14 },
    { header: '总时长(小时)', key: 'totalDuration', width: 16 }
  ]

  notesSheet.getRow(1).eachCell(cell => {
    cell.font = headerStyle.font
    cell.fill = { ...headerStyle.fill, fgColor: { argb: '67C23A' } }
    cell.alignment = headerStyle.alignment
    cell.border = headerStyle.border
  })
  notesSheet.getRow(1).height = 22

  // 统计每个便签的时间块数量和总时长
  notes.forEach((note, idx) => {
    const noteBlocks = timeBlocks.filter(tb => tb.note_id === note.id)
    const totalDuration = noteBlocks.reduce((sum, tb) => {
      const durationMs = new Date(tb.end_time) - new Date(tb.start_time)
      return sum + durationMs / (1000 * 60 * 60)
    }, 0)

    const row = notesSheet.addRow({
      name: note.name,
      color: note.color,
      blockCount: noteBlocks.length,
      totalDuration: parseFloat(totalDuration.toFixed(2))
    })

    // 颜色标记单元格
    const colorCell = row.getCell('color')
    try {
      const hex = note.color.replace('#', '')
      colorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hex } }
      // 根据颜色亮度选择文字颜色
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      colorCell.font = { color: { argb: brightness > 150 ? '000000' : 'FFFFFF' }, bold: true }
      colorCell.alignment = { horizontal: 'center', vertical: 'middle' }
    } catch { /* 忽略颜色解析错误 */ }

    if (idx % 2 === 0) {
      row.eachCell(cell => {
        if (cell.col !== 2) { // 不覆盖颜色标记
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F7FA' } }
        }
      })
    }

    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })
  })

  notesSheet.views = [{ state: 'frozen', ySplit: 1 }]

  // =============================================
  // 输出 Excel 文件
  // =============================================
  const fileName = `TimeBlock_${user.name || user.email}_${formatDate(new Date())}.xlsx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)

  await workbook.xlsx.write(res)
  res.end()
}

/**
 * 格式化日期时间
 */
function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

/**
 * 格式化日期（用于文件名）
 */
function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * POST /api/import
 * 导入数据 (JSON 格式)
 */
async function importData(req, res, next) {
  try {
    const importPayload = req.body

    if (!importPayload || !importPayload.timeBlocks) {
      return error(res, 'VALIDATION_ERROR', '无效的导入数据格式', 400)
    }

    let imported = 0
    let skipped = 0

    for (const block of importPayload.timeBlocks) {
      try {
        // 查找或创建匹配的便签
        let noteId = null
        if (block.noteName) {
          const [note] = await Note.findOrCreate({
            where: {
              user_id: req.user.id,
              name: block.noteName
            },
            defaults: {
              user_id: req.user.id,
              name: block.noteName,
              color: '#409eff'
            }
          })
          noteId = note.id
        }

        await TimeBlock.create({
          user_id: req.user.id,
          note_id: noteId,
          title: block.title || '未命名',
          description: block.description || null,
          start_time: new Date(block.startTime),
          end_time: new Date(block.endTime),
          is_completed: block.isCompleted || false
        })

        imported++
      } catch {
        skipped++
      }
    }

    return success(res, {
      imported,
      skipped,
      total: importPayload.timeBlocks.length
    }, `成功导入 ${imported} 条，跳过 ${skipped} 条`)

  } catch (err) {
    next(err)
  }
}

module.exports = { exportData, importData }
