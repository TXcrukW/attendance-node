require('dotenv').config();
const { sequelize, connectDB } = require('../config/db');
const AdminUser = require('../admin/models/adminUserModel');

const ADMINS = [
  { username: 'useradmin', password: 'admin123456' },
  { username: 'admin1',    password: 'admin123456' },
  { username: 'admin2',    password: 'admin123456' },
  { username: 'admin3',    password: 'admin123456' },
  { username: 'admin4',    password: 'admin123456' },
  { username: 'admin5',    password: 'admin123456' },
];

async function seed() {
  try {
    await connectDB();
    await sequelize.sync();

    for (const { username, password } of ADMINS) {
      const existing = await AdminUser.findOne({ where: { username } });
      if (existing) {
        console.log(`已存在，跳过: ${username}`);
        continue;
      }
      const admin = await AdminUser.create({ username, password });
      console.log(`✓  已创建管理员: ${admin.username}  (id: ${admin.id})`);
    }

    console.log('\n管理员账号初始化完成。');
    process.exit(0);
  } catch (err) {
    console.error('创建管理员失败:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

seed();
