const jwt = require('jsonwebtoken');
const AdminUser = require('../models/adminUserModel');

// 生成 JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// 管理员登录
const loginAdmin = async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码为必填项' });
    }
    const admin = await AdminUser.findOne({ where: { username } });
    if (admin && (await admin.matchPassword(password))) {
      res.json({
        status: 'success',
        id: admin.id,
        username: admin.username,
        role: admin.role,
        token: generateToken(admin.id),
      });
    } else {
      res.status(401).json({ message: '用户名或密码无效' });
    }
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

// 获取管理员资料
const getAdminProfile = async (req, res) => {
  try {
    const admin = await AdminUser.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    if (admin) return res.json(admin);
    res.status(404).json({ message: '未找到管理员' });
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

module.exports = {
  loginAdmin,
  getAdminProfile,
};
