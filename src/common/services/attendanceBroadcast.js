/**
 * 考勤广播服务 —— 将在班快照通过 SSE 推送给所有已连接的管理端
 *
 * 被 admin/controllers/attendanceController.js（管理员发通知）
 * 和 client/controllers/attendanceController.js（学助响应打卡）共同调用，
 * 以确保任意状态变更后管理端实时看板都能及时刷新。
 */

const { Op }     = require('sequelize');
const Assistant  = require('../../db/models/assistantModel');
const WorkSession = require('../../db/models/workSession');
const sseManager = require('./sseManager');

// 延迟加载 SHIFT_LABELS_CN，避免循环引用时模块未就绪
let SHIFT_LABELS_CN;
function getLabels() {
  if (!SHIFT_LABELS_CN) {
    ({ SHIFT_LABELS_CN } = require('../../utils/attendanceConfig'));
  }
  return SHIFT_LABELS_CN;
}

/**
 * 查询当前所有在班 WorkSession，组装快照并通过 SSE 广播给管理端。
 * 此函数不抛出异常——调用方无需包裹 try/catch。
 */
async function broadcastOnline() {
  try {
    const labels = getLabels();
    const now    = new Date();

    const sessions = await WorkSession.findAll({
      where:  { status: { [Op.in]: ['open', 'pending_confirm'] } },
      order:  [['startTime', 'ASC']],
      include: [{ model: Assistant, attributes: ['id', 'name', 'studentId', 'position'] }],
    });

    const data = sessions.map((s) => {
      const p = s.get({ plain: true });
      return {
        sessionId:    p.id,
        assistantId:  p.assistantId,
        name:         p.Assistant ? p.Assistant.name : null,
        studentId:    p.Assistant ? p.Assistant.studentId : null,
        position:     p.Assistant ? p.Assistant.position : null,
        date:         p.date,
        shiftType:    p.shiftType,
        shiftLabel:   labels[p.shiftType] || p.shiftType,
        startTime:    p.startTime,
        onlineMinutes: Math.round((now - new Date(p.startTime)) / 60000),
        status:       p.status,
      };
    });

    sseManager.broadcast({
      event:      'online',
      data,
      total:      data.length,
      serverTime: now.toISOString(),
    });
  } catch (err) {
    console.error('[attendanceBroadcast.broadcastOnline]', err);
  }
}

module.exports = { broadcastOnline };
