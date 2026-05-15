/**
 * attendanceScheduler.js
 * 考勤自动收口调度器
 *
 * 每 5 分钟扫描一次，将已超过各班次下班时间 + 宽限期仍未关闭的
 * WorkSession 自动标记为 auto_closed，并填写估算下班时间。
 *
 * 策略：
 *   - today 的 session：若 now > 班次休息时间 + GRACE_MINUTES，自动收口
 *   - 跨天未关闭（昨天或更早）：直接自动收口（下班时间 = 班次休息时间点）
 *
 * 使用方式：
 *   在 app.js 中调用 startAttendanceScheduler() 即可随服务启动。
 */

const { Op } = require('sequelize');
const WorkSession = require('../db/models/workSession');
const {
  SHIFT_REST_MINUTES,
  SHIFT_LABELS_CN,
  GRACE_MINUTES,
  toDateOnly,
  buildRestBreakpoint,
} = require('./attendanceConfig');

const INTERVAL_MS = parseInt(process.env.ATTENDANCE_SCHEDULER_INTERVAL_MS || String(5 * 60 * 1000), 10);

/**
 * 主逻辑：扫描并自动收口超期会话。
 * 可单独 await 调用（用于测试或脚本模式）。
 * @returns {Promise<number>} 本次收口的会话数量
 */
async function autoCloseSessions() {
  const now     = new Date();
  const today   = toDateOnly(now);
  const nowMin  = now.getHours() * 60 + now.getMinutes();

  // 查询所有未关闭会话
  const openSessions = await WorkSession.findAll({
    where: { status: { [Op.in]: ['open', 'pending_confirm'] } },
  });

  let closedCount = 0;

  for (const session of openSessions) {
    const sessionDate = session.date; // 'YYYY-MM-DD'
    const shiftType   = session.shiftType;
    const restMin     = SHIFT_REST_MINUTES[shiftType];

    // 'other' 班次没有固定休息时间，跳过自动收口
    if (restMin == null) continue;

    const isToday   = sessionDate === today;
    const isPastDay = sessionDate < today;

    // 判断是否到了收口时机
    const shouldClose =
      isPastDay ||                                       // 昨天或更早，直接收口
      (isToday && nowMin >= restMin + GRACE_MINUTES);   // 今天已过宽限期

    if (!shouldClose) continue;

    // 计算估算下班时间：优先取班次的标准休息时间点
    const restBreakpoint = buildRestBreakpoint(sessionDate, shiftType);
    // 若上班时间比休息时间点还晚（极端情况），用当前时间兜底
    const effectiveEnd = (restBreakpoint && restBreakpoint > session.startTime)
      ? restBreakpoint
      : now;

    const durationMinutes = Math.max(0, Math.round((effectiveEnd - session.startTime) / 60000));
    const shiftLabel      = SHIFT_LABELS_CN[shiftType] || shiftType;
    const restLabel       = `${String(Math.floor(restMin / 60)).padStart(2, '0')}:${String(restMin % 60).padStart(2, '0')}`;

    await session.update({
      endTime:         effectiveEnd,
      durationMinutes,
      status:          'auto_closed',
      autoCloseReason: `系统自动收口：${shiftLabel}预计 ${restLabel} 下班，超过 ${GRACE_MINUTES} 分钟宽限期仍未打卡`,
    });

    closedCount++;
    console.log(
      `[AttendanceScheduler] auto_closed session ${session.id}` +
      ` (${session.assistantId}, ${shiftLabel}, ${sessionDate}, end=${effectiveEnd.toISOString()})`,
    );
  }

  return closedCount;
}

/**
 * 启动定时调度器（随服务进程生命周期运行）。
 * 服务启动时立即执行一次，此后每 INTERVAL_MS 执行一次。
 */
function startAttendanceScheduler() {
  const run = async () => {
    try {
      const count = await autoCloseSessions();
      if (count > 0) {
        console.log(`[AttendanceScheduler] 本次自动收口 ${count} 条会话`);
      }
    } catch (err) {
      console.error('[AttendanceScheduler] 执行出错:', err.message || err);
    }
  };

  // 启动时立即检查一次（处理服务重启期间积压的未关闭会话）
  run();

  const timer = setInterval(run, INTERVAL_MS);
  console.log(`[AttendanceScheduler] 已启动，每 ${INTERVAL_MS / 60000} 分钟检查一次`);

  return timer; // 返回 timer 便于测试时 clearInterval
}

module.exports = { autoCloseSessions, startAttendanceScheduler };
