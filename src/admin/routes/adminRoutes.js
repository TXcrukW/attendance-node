const express = require('express');
const router = express.Router();
const { loginAdmin, getAdminProfile, syncAccounts } = require('../controllers/adminController');
const { protect } = require('../../common/middleware/authMiddleware');

router.post('/login', loginAdmin);
router.get('/profile', protect, getAdminProfile);
// 同步删除 Accounts 表中已不存在对应学助的孤立账户
router.post('/sync-accounts', protect, syncAccounts);

module.exports = router;
