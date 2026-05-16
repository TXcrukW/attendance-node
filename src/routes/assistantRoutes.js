const express = require('express');
const router = express.Router();
const controller = require('../client/controllers/assistantController');
const { protect } = require('../common/middleware/authMiddleware');

// 所有接口需要登录，写操作应由前端进一步校验 role
router.get('/', protect, controller.listAssistants);
router.get('/stats', protect, controller.stats);
router.post('/import', protect, controller.bulkImport);
router.post('/', protect, controller.createAssistant);
router.post('/:id/reset-password', protect, controller.resetPassword);
router.get('/:id', protect, controller.getAssistant);
// 客户端自我更新（仅允许手机号与密码）
router.put('/me', protect, controller.updateSelf);
// 管理员更新学助信息（name / phone / positionLevel / status / notes，学号不可改）
router.put('/:id', protect, controller.updateAssistant);
router.delete('/:id', protect, controller.deleteAssistant);

// 设置在岗状态
router.post('/:id/status', protect, controller.setOnDuty);

// 时间日志
router.get('/:assistantId/timelogs', protect, controller.listTimeLogs);
router.post('/:assistantId/timelogs', protect, controller.createTimeLog);

module.exports = router;
