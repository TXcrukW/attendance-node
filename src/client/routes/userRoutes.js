const express = require('express');
const router = express.Router();
const { getUserProfile } = require('../controllers/userController');
// 使用顶级的学号登录实现（包含 sid 会话支持）
const { login } = require('../../controllers/authController');
const { protect } = require('../../common/middleware/authMiddleware');

// 前端统一使用学号登录，路径固定为 /api/user/login，交由通用 authController 处理
router.post('/login', login);
router.get('/profile', protect, getUserProfile);

module.exports = router;
