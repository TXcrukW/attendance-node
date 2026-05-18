const express = require('express');
const router  = express.Router();

const {
  punch,
  getStatus,
  getMySessions,
  getMySummary,
  getShiftNotice,
  respondShiftNotice,
} = require('../client/controllers/attendanceController');

const { protect } = require('../common/middleware/authMiddleware');

// 所有路由需学助账号登录（token 中含 assistantId）
router.post('/punch',                  protect, punch);
router.get('/status',                  protect, getStatus);
router.get('/sessions',                protect, getMySessions);
router.get('/summary',                 protect, getMySummary);
// 管理员通知：学助轮询查询待处理通知
router.get('/shift-notice',            protect, getShiftNotice);
// 管理员通知：学助响应（确认/拒绝）
router.post('/shift-notice/respond',   protect, respondShiftNotice);

module.exports = router;
