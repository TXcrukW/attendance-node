const express = require('express');
const router  = express.Router();

const {
  punch,
  getStatus,
  getMySessions,
  getMySummary,
} = require('../client/controllers/attendanceController');

const { protect } = require('../common/middleware/authMiddleware');

// 所有路由需学助账号登录（token 中含 assistantId）
router.post('/punch',    protect, punch);
router.get('/status',    protect, getStatus);
router.get('/sessions',  protect, getMySessions);
router.get('/summary',   protect, getMySummary);

module.exports = router;
