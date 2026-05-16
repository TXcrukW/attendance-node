const jwt = require('jsonwebtoken');
const Account = require('../../db/models/accountModel');
const AdminUser = require('../../admin/models/adminUserModel');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 如果 token 含有 sid，则校验对应模型的 currentSessionId，使旧 token 失效
      if (decoded.sid) {
        // 优先按 accountId 查找（学号登录场景）
        if (decoded.accountId) {
          const account = await Account.findByPk(decoded.accountId);
          if (!account || !account.isActive) return res.status(401).json({ message: '授权失败，账户不存在或已禁用' });
          if (!account.currentSessionId || account.currentSessionId !== decoded.sid) {
            return res.status(401).json({ message: '授权失败，token 已失效' });
          }
          req.user = { id: account.id, username: account.username, accountId: account.id, assistantId: account.assistantId };
          return next();
        }

        // 按管理员 id 查找
        if (decoded.id) {
          const admin = await AdminUser.findByPk(decoded.id);
          if (admin) {
            if (!admin.currentSessionId || admin.currentSessionId !== decoded.sid) {
              return res.status(401).json({ message: '授权失败，token 已失效' });
            }
            req.user = { id: admin.id, username: admin.username, role: admin.role };
            return next();
          }

          return res.status(401).json({ message: '授权失败，用户不存在' });
        }
      }

      // 否则保持向后兼容：把解码的 payload 直接附上（旧的 token 仍然可用）
      req.user = decoded;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: '授权失败，token 无效' });
    }
  }

  return res.status(401).json({ message: '无授权，没有 token' });
};

module.exports = { protect };
