/**
 * clearAllData.js
 * 清空所有业务数据（测试数据），保留管理员账号（AdminUsers 表不变）。
 * 清空顺序：先清子表，再清父表，避免外键约束报错。
 *
 * 用法：node src/scripts/clearAllData.js
 */
const dotenv = require('dotenv');
dotenv.config();

const { connectDB, sequelize } = require('../config/db');
const AssistantTimeLog = require('../db/models/assistantTimeLog');
const WorkSession      = require('../db/models/workSession');
const PunchRecord      = require('../db/models/punchRecord');
const Account          = require('../db/models/accountModel');
const Assistant        = require('../db/models/assistantModel');

async function clearAll() {
  await connectDB();
  await sequelize.sync();

  console.log('开始清空所有业务数据（AdminUsers 表保留不变）...\n');

  const steps = [
    { name: 'AssistantTimeLogs（工时日志）', model: AssistantTimeLog },
    { name: 'WorkSessions（工作区间）',      model: WorkSession },
    { name: 'PunchRecords（打卡记录）',       model: PunchRecord },
    { name: 'Accounts（学助登录账户）',       model: Account },
    { name: 'Assistants（学助信息）',         model: Assistant },
  ];

  for (const { name, model } of steps) {
    const count = await model.count();
    await model.destroy({ where: {}, truncate: false });
    console.log(`✓  ${name} — 已删除 ${count} 条记录`);
  }

  console.log('\n✅  清空完成。数据库已可写入真实数据。');
  process.exit(0);
}

clearAll().catch((err) => {
  console.error('❌  清空失败：', err.message || err);
  process.exit(1);
});
