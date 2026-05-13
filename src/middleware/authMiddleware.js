const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  let token;

  // 检查 Authorization 头是否存在且以 Bearer 开头
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // 获取 token
      token = req.headers.authorization.split(' ')[1];

      // 验证 token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 将用户信息附加到请求对象
      req.user = decoded;

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: '授权失败，token 无效' });
    }
  }

  if (!token) {
    res.status(401).json({ message: '无授权，没有 token' });
  }
};

module.exports = { protect };