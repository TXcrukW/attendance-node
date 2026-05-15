const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB, sequelize } = require('./config/db');
const userRoutes = require('./client/routes/userRoutes');
const adminRoutes = require('./admin/routes/adminRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
// 预加载考勤相关模型，确保 sequelize.sync() 时建表
require('./db/models/punchRecord');
require('./db/models/workSession');
const { startAttendanceScheduler } = require('./utils/attendanceScheduler');

// 加载环境变量
dotenv.config();

// 连接数据库并同步模型（不阻塞主线程，失败时会在后台重试）
connectDB()
  .then(async () => {
    try {
      await sequelize.sync({ alter: true });
      console.log('Database & tables created/updated!');
      // 数据库就绪后启动考勤自动收口调度器
      startAttendanceScheduler();
    } catch (err) {
      console.error('Error syncing database models:', err.message || err);
    }
  })
  .catch((err) => {
    console.error('connectDB error (will retry in background):', err && err.message ? err.message : err);
  });

const app = express();

// 中间件
app.use(cors());
app.use(express.json()); // 解析 JSON 格式请求体

// 路由
// 客户端统一使用 /api/user 前缀（学号登录等）
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assistants', assistantRoutes);
// 保留旧的 /api/auth 路由以兼容其他用途（可选）
app.use('/api/auth', authRoutes);
// 学助客户端考勤接口
app.use('/api/attendance', attendanceRoutes);

// 根路由测试
app.get('/', (req, res) => {
  res.send('校园考勤系统 API 正在运行...');
});

// 错误处理中间件 (捕获 404)
app.use((req, res, next) => {
  res.status(404).json({ message: '未找到该路由' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});