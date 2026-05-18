const jwt = require('jsonwebtoken');
const AdminUser = require('../models/adminUserModel');

// 生成 JWT Token
const { v4: uuidv4 } = require('uuid');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
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
      const sid = uuidv4();
      await admin.update({ currentSessionId: sid });

      res.json({
        status: 'success',
        id: admin.id,
        username: admin.username,
        role: admin.role,
        token: generateToken({ id: admin.id, sid }),
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

// 管理员登出
const logoutAdmin = async (req, res) => {
  try {
    const admin = await AdminUser.findByPk(req.user.id);
    if (!admin) return res.status(404).json({ message: '管理员不存在' });

    // 清除当前会话 id，使携带旧 sid 的 token 失效
    await admin.update({ currentSessionId: null });

    return res.json({ message: '已登出' });
  } catch (err) {
    console.error('logoutAdmin error:', err);
    return res.status(500).json({ message: '登出失败', error: err.message });
  }
};

// POST /api/admin/sync-accounts
// 删除 Accounts 表中 assistantId 已不存在于 Assistants 表的孤立账户
const syncAccounts = async (req, res) => {
  const { Op } = require('sequelize');
  const Account = require('../../db/models/accountModel');
  const Assistant = require('../../db/models/assistantModel');
  try {
    const assistants = await Assistant.findAll({ attributes: ['id'] });
    const existingIds = assistants.map((a) => a.id);

    const orphans = await Account.findAll({
      where: {
        assistantId: {
          [Op.not]: null,
          [Op.notIn]: existingIds.length > 0 ? existingIds : ['__none__'],
        },
      },
    });

    if (orphans.length === 0) {
      return res.json({ message: '数据已一致，无需清理', deleted: 0 });
    }

    const orphanIds = orphans.map((acc) => acc.id);
    const deleted = await Account.destroy({ where: { id: { [Op.in]: orphanIds } } });

    res.json({
      message: `同步完成，已删除 ${deleted} 条孤立账户`,
      deleted,
      accounts: orphans.map((acc) => ({ id: acc.id, username: acc.username, assistantId: acc.assistantId })),
    });
  } catch (err) {
    console.error('syncAccounts error:', err);
    res.status(500).json({ message: '同步失败', error: err.message });
  }
};

module.exports = {
  loginAdmin,
  getAdminProfile,
  syncAccounts,
  logoutAdmin,
};
