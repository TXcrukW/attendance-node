require('dotenv').config();
const { sequelize, connectDB } = require('../config/db');
const AdminUser = require('../modules/admin/models/adminUserModel');

async function seed() {
  try {
    await connectDB();
    // 确保模型同步（不破坏已有数据）
    await sequelize.sync();

    const username = 'useradmin';
    const password = 'admin123456';

    const existing = await AdminUser.findOne({ where: { username } });
    if (existing) {
      console.log(`管理员用户已存在: ${username}`);
      process.exit(0);
    }

    const admin = await AdminUser.create({ username, password });
    console.log('已创建管理员用户:');
    console.log({ id: admin.id, username: admin.username, role: admin.role });
    process.exit(0);
  } catch (err) {
    console.error('创建管理员失败:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

seed();
