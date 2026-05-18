const express = require('express');
const router = express.Router();
const { loginAdmin, getAdminProfile, syncAccounts, logoutAdmin } = require('../controllers/adminController');
const { protect } = require('../../common/middleware/authMiddleware');
const attendanceCtrl = require('../controllers/attendanceController');

// 仅管理员可访问的路由守卫
const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ message: '仅管理员可访问' });
  }
  return next();
};

router.post('/login', loginAdmin);
// 登出
router.post('/logout', protect, adminOnly, logoutAdmin);
router.get('/profile', protect, getAdminProfile);
// 同步删除 Accounts 表中已不存在对应学助的孤立账户
router.post('/sync-accounts', protect, adminOnly, syncAccounts);

// ── 考勤管理路由 ──────────────────────────────────────────────
// 当前在班学助看板（以 WorkSession 为准，实时准确）
router.get('/attendance/online',                       protect, adminOnly, attendanceCtrl.getOnlineAssistants);
// 在班看板 SSE 实时推送（长连接，管理端订阅后自动接收状态变化）
router.get('/attendance/online/stream',                protect, adminOnly, attendanceCtrl.onlineStream);
// 查询所有学助工作会话（支持 assistantId / from / to / status / search 过滤）
router.get('/attendance/sessions',                     protect, adminOnly, attendanceCtrl.getAllSessions);
// 待审核列表（auto_closed / pending_confirm / 长期未关闭）
router.get('/attendance/pending',                      protect, adminOnly, attendanceCtrl.getPendingReview);
// 全体学助工时报表（按分页）
router.get('/attendance/report',                       protect, adminOnly, attendanceCtrl.getReport);
// 单个学助所有班次
router.get('/attendance/assistants/:id/sessions',      protect, adminOnly, attendanceCtrl.getAssistantSessions);
// 单个学助工时汇总（含按日明细及估算薪资）
router.get('/attendance/assistants/:id/summary',       protect, adminOnly, attendanceCtrl.getAssistantSummary);
// 人工纠正指定会话（需提供 correctionNote）
router.patch('/attendance/sessions/:id',               protect, adminOnly, attendanceCtrl.correctSession);
// 向学助发送上/下班确认通知
router.post('/assistants/:id/shift-notice',            protect, adminOnly, attendanceCtrl.requestShiftChange);
// 查询学助最近一条通知状态（管理端轮询或 SSE 广播后查询用）
router.get('/assistants/:id/shift-notice',             protect, adminOnly, attendanceCtrl.getAssistantNotice);

module.exports = router;
