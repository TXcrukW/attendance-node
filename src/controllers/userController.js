const jwt = require('jsonwebtoken');
const User = require('../db/models/userModel');

// 生成 JWT Token
const { v4: uuidv4 } = require('uuid');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// @desc    用户登录
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ where: { username } });

    if (user && (await user.matchPassword(password))) {
      // 生成新的会话 id，并保存到用户表，使旧 token 失效
      const sid = uuidv4();
      await user.update({ currentSessionId: sid });

      res.json({
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