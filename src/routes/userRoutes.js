const express = require('express');
const router = express.Router();
const { loginUser, getUserProfile } = require('../client/controllers/userController');
const { protect } = require('../common/middleware/authMiddleware');

router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);

module.exports = router;