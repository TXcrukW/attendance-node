const Account = require('../../db/models/accountModel');

// @desc    获取当前登录账户资料
// @route   GET /api/user/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const accountId = req.user && req.user.accountId;
    if (!accountId) return res.status(401).json({ message: '授权失败，无法识别账户' });

    const account = await Account.findByPk(accountId, { attributes: { exclude: ['password'] } });
    if (account) return res.json(account);
    return res.status(404).json({ message: '未找到账户' });
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

module.exports = { getUserProfile };
