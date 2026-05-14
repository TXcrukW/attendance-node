const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB, sequelize } = require('./config/db');
const userRoutes = require('./modules/frontend/routes/userRoutes');
const adminRoutes = require('./modules/admin/routes/adminRoutes');
const assistantRoutes = require('./routes/assistantRoutes');

// 加载环境变量
dotenv.config();

// 连接数据库并同步模型（不阻塞主线程，失败时会在后台重试）
connectDB()
  .then(async () => {
    try {
      await sequelize.sync({ alter: true });
      console.log('Database & tables created/updated!');
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
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assistants', assistantRoutes);

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