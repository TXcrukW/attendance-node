const dotenv = require('dotenv');
dotenv.config();
const { connectDB, sequelize } = require('../config/db');
const Assistant = require('../db/models/assistantModel');
const AssistantTimeLog = require('../db/models/assistantTimeLog');

async function seed() {
  await connectDB();
  try {
    await sequelize.sync({ alter: true });

    // 清空表（谨慎，仅测试用）
    await AssistantTimeLog.destroy({ where: {} });
    await Assistant.destroy({ where: {} });

    const assistants = [
      { studentId: '2021001', name: '张三', position: '图书助理', hourlyRate: 15, isOnDuty: true, status: 'active', phone: '13800138001' },
      { studentId: '2021002', name: '李四', position: '实验助理', hourlyRate: 12, isOnDuty: true, status: 'active', phone: '13800138002' },
      { studentId: '2021003', name: '王五', position: '活动助理', hourlyRate: 18, isOnDuty: false, status: 'inactive', phone: '13800138003' },
      { studentId: '2021004', name: '赵六', position: '课程助理', hourlyRate: 15, isOnDuty: true, status: 'active', phone: '13800138004' },
      { studentId: '2021005', name: '孙七', position: '教务助理', hourlyRate: 20, isOnDuty: true, status: 'active', phone: '13800138005' },
    ];

    for (const a of assistants) {
      await Assistant.create(a);
    }

    // 添加一些时间日志以便统计（小时数汇总示例）
    const created = await Assistant.findAll();
    const logs = [
      { assistantId: created[0].id, date: '2026-05-01', hours: 4 },
      { assistantId: created[0].id, date: '2026-05-03', hours: 2 },
      { assistantId: created[1].id, date: '2026-05-02', hours: 6 },
      { assistantId: created[2].id, date: '2026-04-28', hours: 3 },
      { assistantId: created[3].id, date: '2026-05-05', hours: 5 },
      { assistantId: created[4].id, date: '2026-05-06', hours: 8 },
    ];

    for (const l of logs) {
      await AssistantTimeLog.create(l);
    }

    console.log('测试学助数据已插入');
    process.exit(0);
  } catch (err) {
    console.error('seed error', err);
    process.exit(1);
  }
}

seed();
