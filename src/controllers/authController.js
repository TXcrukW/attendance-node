const jwt = require('jsonwebtoken');
const Account = require('../models/accountModel');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};

// POST /api/auth/login
const login = async (req, res) => {
  const { studentId, password } = req.body;
  if (!studentId || !password) return res.status(400).json({ message: '学号和密码为必填项' });

  try {
    const account = await Account.findOne({ where: { username: studentId } });
    if (!account || !account.isActive) return res.status(401).json({ message: '账户不存在或已禁用' });

    const match = await account.matchPassword(password);
    if (!match) return res.status(401).json({ message: '学号或密码不正确' });

    const payload = { accountId: account.id, assistantId: account.assistantId, username: account.username };
    res.json({ id: account.id, username: account.username, assistantId: account.assistantId, token: generateToken(payload) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '登录失败', error: err.message });
  }
};

module.exports = { login };
