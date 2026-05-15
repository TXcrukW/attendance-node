const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../../db/models/userModel');
const Account = require('../../db/models/accountModel');

// 生成 JWT Token（接受 payload）
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// @desc    用户登录（支持 sid 会话机制）
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码为必填项' });
    }

    const user = await User.findOne({ where: { username } });

    if (user && (await user.matchPassword(password))) {
      const sid = uuidv4();
      await user.update({ currentSessionId: sid });

      res.json({
        status: 'success',
        id: user.id,
        username: user.username,
        role: user.role,
        token: generateToken({ id: user.id, sid }),
      });
    } else {
      res.status(401).json({ message: '用户名或密码无效' });
    }
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

// @desc    获取用户个人资料
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    // 如果是学号登录场景（token payload 包含 accountId），返回 Account 资料
    if (req.user && req.user.accountId) {
      const account = await Account.findByPk(req.user.accountId, { attributes: { exclude: ['password'] } });
      if (account) return res.json(account);
      return res.status(404).json({ message: '未找到账户' });
    }

    // 否则按普通 User 返回
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: '未找到用户' });
    }
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

module.exports = {
  loginUser,
  getUserProfile,
};
