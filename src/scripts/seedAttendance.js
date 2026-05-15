/**
 * seedAttendance.js
 * 为 PunchRecords 和 WorkSessions 写入测试数据。
 * 运行前请确保已执行过 seedAssistants.js（需要学助数据存在）。
 *
 * 用法：node src/scripts/seedAttendance.js
 */
const dotenv = require('dotenv');
dotenv.config();

const { connectDB, sequelize } = require('../config/db');
const Assistant   = require('../db/models/assistantModel');
const PunchRecord = require('../db/models/punchRecord');
const WorkSession = require('../db/models/workSession');

// ── 工具：构造指定日期 + 时分秒的 Date 对象 ──────────────────
function d(dateStr, h, m = 0, s = 0) {
  const [y, mo, day] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, day, h, m, s);
}

async function seed() {
  await connectDB();
  await sequelize.sync({ alter: true });

  // 取前 3 个状态为 active 的学助
  const assistants = await Assistant.findAll({
    where: { status: 'active' },
    order: [['studentId', 'ASC']],
    limit: 3,
  });

  if (assistants.length === 0) {
    console.error('❌  未找到学助数据，请先运行 seedAssistants.js');
    process.exit(1);
  }

  console.log(`找到 ${assistants.length} 名学助，开始清理旧测试数据...`);

  // 仅清理这几名学助的考勤数据，不影响其他记录
  const ids = assistants.map((a) => a.id);
  await WorkSession.destroy({ where: { assistantId: ids } });
  await PunchRecord.destroy({ where: { assistantId: ids } });

  // 学助不足 3 名时循环复用，保证场景完整
  const get = (i) => assistants[i % assistants.length];
  const a1 = get(0), a2 = get(1), a3 = get(2);

  console.log('写入测试数据...');

  // ════════════════════════════════════════════════
  //  场景 1：a1（张三）—— 近 5 天正常打卡，覆盖三个班次
  // ════════════════════════════════════════════════
  const a1Cases = [
    // 2026-05-11 上午班  08:30 ~ 12:20（正常，比预计 12:30 早下班）
    { date: '2026-05-11', shiftType: 'morning',   startH: 8,  startM: 30, endH: 12, endM: 20, status: 'closed' },
    // 2026-05-12 下午班  13:00 ~ 18:05
    { date: '2026-05-12', shiftType: 'afternoon',  startH: 13, startM: 0,  endH: 18, endM: 5,  status: 'closed' },
    // 2026-05-13 晚班    19:00 ~ 21:55
    { date: '2026-05-13', shiftType: 'evening',    startH: 19, startM: 0,  endH: 21, endM: 55, status: 'closed' },
    // 2026-05-14 下午班  忘记下班 → auto_closed（系统自动收口为 18:00）
    { date: '2026-05-14', shiftType: 'afternoon',  startH: 13, startM: 30, endH: 18, endM: 0,  status: 'auto_closed',
      autoCloseReason: '系统自动收口：下午班预计 18:00 下班，超过 15 分钟宽限期仍未打卡' },
    // 2026-05-15 上午班  正常
    { date: '2026-05-15', shiftType: 'morning',   startH: 8,  startM: 45, endH: 12, endM: 25, status: 'closed' },
  ];

  for (const c of a1Cases) {
    const startTime = d(c.date, c.startH, c.startM);
    const endTime   = d(c.date, c.endH,   c.endM);
    const pIn  = await PunchRecord.create({ assistantId: a1.id, type: 'IN',  punchTime: startTime, source: 'app' });
    const pOut = await PunchRecord.create({ assistantId: a1.id, type: 'OUT', punchTime: endTime,   source: c.status === 'auto_closed' ? 'system' : 'app' });
    const durationMinutes = Math.round((endTime - startTime) / 60000);
    await WorkSession.create({
      assistantId:      a1.id,
      date:             c.date,
      shiftType:        c.shiftType,
      startTime,
      endTime,
      durationMinutes,
      status:           c.status,
      punchInId:        pIn.id,
      punchOutId:       pOut.id,
      autoCloseReason:  c.autoCloseReason || null,
    });
  }
  console.log(`✅  ${a1.name}（${a1.studentId}）：${a1Cases.length} 条`);

  // ════════════════════════════════════════════════
  //  场景 2：a2（李四）—— 含人工纠正记录
  // ════════════════════════════════════════════════
  const a2Cases = [
    // 2026-05-10  下午班  auto_closed 后管理员已纠正
    { date: '2026-05-10', shiftType: 'afternoon', startH: 14, startM: 0,  endH: 18, endM: 0,  status: 'corrected',
      correctionNote: '学助反馈 18:30 下班，已核实修正', correctedBy: null },
    // 2026-05-12  上午班  正常
    { date: '2026-05-12', shiftType: 'morning',   startH: 8,  startM: 0,  endH: 12, endM: 30, status: 'closed' },
    // 2026-05-14  晚班    正常
    { date: '2026-05-14', shiftType: 'evening',   startH: 18, startM: 30, endH: 21, endM: 50, status: 'closed' },
    // 2026-05-15  下午班  仍处于 pending_confirm（昨天休息时间到了未响应）
    { date: '2026-05-15', shiftType: 'afternoon', startH: 13, startM: 0,  endH: null, endM: null, status: 'pending_confirm' },
  ];

  for (const c of a2Cases) {
    const startTime  = d(c.date, c.startH, c.startM);
    const hasEnd     = c.endH !== null;
    const endTime    = hasEnd ? d(c.date, c.endH, c.endM) : null;
    const pIn        = await PunchRecord.create({ assistantId: a2.id, type: 'IN', punchTime: startTime, source: 'app' });
    let pOutId = null;
    if (hasEnd) {
      const pOut = await PunchRecord.create({ assistantId: a2.id, type: 'OUT', punchTime: endTime, source: 'app' });
      pOutId = pOut.id;
    }
    const durationMinutes = hasEnd ? Math.round((endTime - startTime) / 60000) : null;
    await WorkSession.create({
      assistantId:     a2.id,
      date:            c.date,
      shiftType:       c.shiftType,
      startTime,
      endTime,
      durationMinutes,
      status:          c.status,
      punchInId:       pIn.id,
      punchOutId:      pOutId,
      correctionNote:  c.correctionNote || null,
    });
  }
  console.log(`✅  ${a2.name}（${a2.studentId}）：${a2Cases.length} 条`);

  // ════════════════════════════════════════════════
  //  场景 3：a3（王五 / 第 3 名）—— 今天有正在进行的班次（open）
  // ════════════════════════════════════════════════
  const today   = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  // 历史：2026-05-13、05-14 正常
  const a3History = [
    { date: '2026-05-13', shiftType: 'morning',   startH: 9,  startM: 0,  endH: 12, endM: 30 },
    { date: '2026-05-14', shiftType: 'afternoon',  startH: 13, startM: 30, endH: 17, endM: 50 },
  ];
  for (const c of a3History) {
    const startTime = d(c.date, c.startH, c.startM);
    const endTime   = d(c.date, c.endH,   c.endM);
    const pIn  = await PunchRecord.create({ assistantId: a3.id, type: 'IN',  punchTime: startTime, source: 'app' });
    const pOut = await PunchRecord.create({ assistantId: a3.id, type: 'OUT', punchTime: endTime,   source: 'app' });
    await WorkSession.create({
      assistantId: a3.id, date: c.date, shiftType: c.shiftType,
      startTime, endTime, durationMinutes: Math.round((endTime - startTime) / 60000),
      status: 'closed', punchInId: pIn.id, punchOutId: pOut.id,
    });
  }

  // 今天：开放中的班次（上午 9 点上班，目前未下班）
  const openStart = new Date(today);
  openStart.setHours(9, 0, 0, 0);
  if (openStart > today) openStart.setDate(openStart.getDate() - 1); // 防止当前时间早于 9:00
  const pInOpen = await PunchRecord.create({ assistantId: a3.id, type: 'IN', punchTime: openStart, source: 'app' });
  await WorkSession.create({
    assistantId: a3.id,
    date:        todayStr,
    shiftType:   'morning',
    startTime:   openStart,
    endTime:     null,
    durationMinutes: null,
    status:      'open',
    punchInId:   pInOpen.id,
  });
  console.log(`✅  ${a3.name}（${a3.studentId}）：${a3History.length + 1} 条（含今日 open 班次）`);

  console.log('\n🎉  考勤测试数据写入完成！');
  console.log('─────────────────────────────────────────');
  console.log('数据表：PunchRecords、WorkSessions');
  console.log(`可用学号：${assistants.map((a) => `${a.name}(${a.studentId})`).join('、')}`);
  console.log('─────────────────────────────────────────');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌  写入失败：', err.message || err);
  process.exit(1);
});
