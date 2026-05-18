const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Account = require('../db/models/accountModel');

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

    // 生成新的会话 id（sid），写入账户，使旧 token 失效
    const sid = uuidv4();
    await account.update({ currentSessionId: sid });

    const payload = { accountId: account.id, assistantId: account.assistantId, username: account.username, sid };
    res.json({ id: account.id, username: account.username, assistantId: account.assistantId, token: generateToken(payload) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '登录失败', error: err.message });
  }
};

// POST /api/user/logout
const logout = async (req, res) => {
  try {
    // protect middleware 应当已将 req.user 注入
    if (!req.user) return res.status(401).json({ message: '未授权' });

    const accountId = req.user.accountId || req.user.id;
    const account = await Account.findByPk(accountId);
    if (!account) return res.status(404).json({ message: '账户不存在' });

    await account.update({ currentSessionId: null });

    return res.json({ message: '已登出' });
  } catch (err) {
    console.error('logout error:', err);
    return res.status(500).json({ message: '登出失败', error: err.message });
  }
};

module.exports = { login, logout };
