const { Op } = require('sequelize');
const Assistant         = require('../../db/models/assistantModel');
const PunchRecord       = require('../../db/models/punchRecord');
const WorkSession       = require('../../db/models/workSession');
const ShiftNotification = require('../../db/models/shiftNotification');
const sseManager        = require('../../common/services/sseManager');
const { broadcastOnline } = require('../../common/services/attendanceBroadcast');
const {
  SHIFT_LABELS_CN,
  toDateOnly,
} = require('../../utils/attendanceConfig');

// ─── 查询所有学助的工作会话（支持多维过滤）─────────────────────
/**
 * GET /api/admin/attendance/sessions
 * query: assistantId, from, to, status, page, limit, search(name/studentId)
 */
exports.getAllSessions = async (req, res) => {
  try {
    const { assistantId, from, to, status, page = 1, limit = 20, search } = req.query;

    const where = {};
    if (assistantId) where.assistantId = assistantId;
    if (status)      where.status = status;
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to)   where.date[Op.lte] = to;
    }

    const assistantWhere = {};
    if (search) {
      assistantWhere[Op.or] = [
        { name:      { [Op.iLike]: `%${search}%` } },
        { studentId: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await WorkSession.findAndCountAll({
      where,
      order:  [['startTime', 'DESC']],
      limit:  parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
      include: [{
        model:    Assistant,
        attributes: ['id', 'name', 'studentId', 'position'],
        where:    Object.keys(assistantWhere).length ? assistantWhere : undefined,
        required: !!search,
      }],
    });

    const data = rows.map((s) => {
      const p = s.get({ plain: true });
      return {
        ...p,
        shiftLabel: SHIFT_LABELS_CN[p.shiftType] || p.shiftType,
        hours: p.durationMinutes != null ? (p.durationMinutes / 60).toFixed(2) : null,
      };
    });

    res.json({ data, total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    console.error('[admin.attendance.getAllSessions]', err);
    res.status(500).json({ message: '查询失败' });
  }
};

// ─── 待审核列表（auto_closed / pending_confirm / open 超时）────
/**
 * GET /api/admin/attendance/pending
 * 返回所有需要管理员介入的异常会话
 */
exports.getPendingReview = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const { count, rows } = await WorkSession.findAndCountAll({
      where:  { status: { [Op.in]: ['auto_closed', 'pending_confirm', 'open'] } },
      order:  [['startTime', 'DESC']],
      limit:  parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
      include: [{ model: Assistant, attributes: ['id', 'name', 'studentId', 'position'] }],
    });

    const data = rows.map((s) => {
      const p = s.get({ plain: true });
      const statusTip = {
        auto_closed:     '系统自动收口，需人工核实下班时间',
        pending_confirm: '学助未在休息时间确认下班',
        open:            '班次未关闭（可能遗漏下班打卡）',
      }[p.status] || '';
      return {
        ...p,
        shiftLabel: SHIFT_LABELS_CN[p.shiftType] || p.shiftType,
        hours:      p.durationMinutes != null ? (p.durationMinutes / 60).toFixed(2) : null,
        statusTip,
      };
    });

    res.json({ data, total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    console.error('[admin.attendance.getPendingReview]', err);
    res.status(500).json({ message: '查询失败' });
  }
};

// ─── 单个学助的所有班次记录 ────────────────────────────────────
/**
 * GET /api/admin/attendance/assistants/:id/sessions
 * query: from, to, status, page, limit
 */
exports.getAssistantSessions = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, status, page = 1, limit = 20 } = req.query;

    const assistant = await Assistant.findByPk(id, {
      attributes: ['id', 'name', 'studentId', 'position', 'hourlyRate'],
    });
    if (!assistant) return res.status(404).json({ message: '学助不存在' });

    const where = { assistantId: id };
    if (status) where.status = status;
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to)   where.date[Op.lte] = to;
    }

    const { count, rows } = await WorkSession.findAndCountAll({
      where,
      order:  [['startTime', 'DESC']],
      limit:  parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    });

    const data = rows.map((s) => {
      const p = s.get({ plain: true });
      return {
        ...p,
        shiftLabel: SHIFT_LABELS_CN[p.shiftType] || p.shiftType,
        hours:      p.durationMinutes != null ? (p.durationMinutes / 60).toFixed(2) : null,
      };
    });

    const a = assistant.get({ plain: true });
    res.json({
      assistant: {
        id: a.id, name: a.name, studentId: a.studentId,
        position: a.position, hourlyRate: a.hourlyRate != null ? String(a.hourlyRate) : '0.00',
      },
      data,
      total: count,
      page:  parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) {
    console.error('[admin.attendance.getAssistantSessions]', err);
    res.status(500).json({ message: '查询失败' });
  }
};

// ─── 单个学助工时汇总（含按日明细）────────────────────────────
/**
 * GET /api/admin/attendance/assistants/:id/summary
 * query: from, to
 *
 * 统计 closed + auto_closed + corrected 状态的总工时，
 * 并单独标注自动收口条数（供管理员优先核查）。
 */
exports.getAssistantSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const assistant = await Assistant.findByPk(id, {
      attributes: ['id', 'name', 'studentId', 'position', 'hourlyRate'],
    });
    if (!assistant) return res.status(404).json({ message: '学助不存在' });

    const where = {
      assistantId: id,
      status: { [Op.in]: ['closed', 'auto_closed', 'corrected'] },
    };
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to)   where.date[Op.lte] = to;
    }

    const sessions = await WorkSession.findAll({
      where,
      order: [['date', 'ASC'], ['startTime', 'ASC']],
    });

    const totalMinutes    = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const autoClosedCount = sessions.filter((s) => s.status === 'auto_closed').length;
    const correctedCount  = sessions.filter((s) => s.status === 'corrected').length;

    // 按日汇总
    const byDateMap = {};
    for (const s of sessions) {
      const key = s.date;
      if (!byDateMap[key]) byDateMap[key] = { date: key, minutes: 0, sessions: [], hasAnomalies: false };
      byDateMap[key].minutes      += s.durationMinutes || 0;
      byDateMap[key].sessions.push({
        id:           s.id,
        shiftType:    s.shiftType,
        shiftLabel:   SHIFT_LABELS_CN[s.shiftType],
        startTime:    s.startTime,
        endTime:      s.endTime,
        durationMinutes: s.durationMinutes,
        hours:        s.durationMinutes != null ? (s.durationMinutes / 60).toFixed(2) : null,
        status:       s.status,
        autoCloseReason:  s.autoCloseReason,
        correctionNote:   s.correctionNote,
      });
      if (s.status === 'auto_closed') byDateMap[key].hasAnomalies = true;
    }

    const a = assistant.get({ plain: true });
    const hourlyRate = parseFloat(a.hourlyRate || 0);

    res.json({
      assistant: {
        id: a.id, name: a.name, studentId: a.studentId,
        position: a.position, hourlyRate: String(a.hourlyRate || '0.00'),
      },
      totalMinutes,
      totalHours:      (totalMinutes / 60).toFixed(2),
      // 按时薪估算薪资（仅已核实的 closed/corrected）
      estimatedWage:   hourlyRate > 0
        ? (hourlyRate * sessions.filter((s) => s.status !== 'auto_closed').reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60).toFixed(2)
        : null,
      sessionCount:    sessions.length,
      autoClosedCount,
      correctedCount,
      byDate: Object.values(byDateMap).map((d) => ({
        date:         d.date,
        minutes:      d.minutes,
        hours:        (d.minutes / 60).toFixed(2),
        hasAnomalies: d.hasAnomalies,
        sessions:     d.sessions,
      })),
    });
  } catch (err) {
    console.error('[admin.attendance.getAssistantSummary]', err);
    res.status(500).json({ message: '查询失败' });
  }
};

// ─── 人工纠正工作会话 ───────────────────────────────────────────
/**
 * PATCH /api/admin/attendance/sessions/:id
 * body: { startTime?, endTime?, correctionNote }
 *
 * 管理员可修正上/下班时间，系统重新计算 durationMinutes。
 * 所有修改保留 correctedBy、correctionNote 字段作为审计依据。
 */
exports.correctSession = async (req, res) => {
  try {
    const { id }                            = req.params;
    const { startTime, endTime, correctionNote } = req.body;
    const adminId                           = req.user && req.user.id;

    if (!correctionNote || !correctionNote.trim()) {
      return res.status(400).json({ message: '请填写纠正原因（correctionNote）' });
    }

    const session = await WorkSession.findByPk(id, {
      include: [{ model: Assistant, attributes: ['id', 'name', 'studentId'] }],
    });
    if (!session) return res.status(404).json({ message: '工作会话不存在' });

    const updates = {
      status:         'corrected',
      correctedBy:    adminId,
      correctionNote: correctionNote.trim(),
    };

    if (startTime) updates.startTime = new Date(startTime);
    if (endTime)   updates.endTime   = new Date(endTime);

    // 重新计算工时
    const st = updates.startTime || session.startTime;
    const et = updates.endTime   || session.endTime;
    if (st && et) {
      const diff = Math.round((new Date(et) - new Date(st)) / 60000);
      if (diff < 0) return res.status(400).json({ message: '下班时间不能早于上班时间' });
      updates.durationMinutes = diff;
    }

    await session.update(updates);

    const p = session.get({ plain: true });
    res.json({
      message: '纠正成功',
      session: {
        ...p,
        shiftLabel: SHIFT_LABELS_CN[p.shiftType] || p.shiftType,
        hours:      p.durationMinutes != null ? (p.durationMinutes / 60).toFixed(2) : null,
      },
    });
  } catch (err) {
    console.error('[admin.attendance.correctSession]', err);
    res.status(500).json({ message: '纠正失败' });
  }
};

// ─── 全部学助工时汇总（报表）──────────────────────────────────
/**
 * GET /api/admin/attendance/report
 * query: from, to, page, limit
 *
 * 返回每位学助的工时合计，用于管理后台报表展示。
 */
exports.getReport = async (req, res) => {
  try {
    const { from, to, page = 1, limit = 50 } = req.query;

    const sessionWhere = {
      status: { [Op.in]: ['closed', 'auto_closed', 'corrected'] },
    };
    if (from || to) {
      sessionWhere.date = {};
      if (from) sessionWhere.date[Op.gte] = from;
      if (to)   sessionWhere.date[Op.lte] = to;
    }

    // 获取所有在职学助（分页）
    const { count, rows: assistants } = await Assistant.findAndCountAll({
      where:  { status: 'active' },
      order:  [['studentId', 'ASC']],
      limit:  parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
      attributes: ['id', 'name', 'studentId', 'position', 'hourlyRate'],
    });

    // 批量查询每位学助的会话工时
    const assistantIds = assistants.map((a) => a.id);
    const sessions = await WorkSession.findAll({
      where: { ...sessionWhere, assistantId: { [Op.in]: assistantIds } },
      attributes: ['assistantId', 'durationMinutes', 'status'],
    });

    // 按学助聚合
    const statsMap = {};
    for (const s of sessions) {
      if (!statsMap[s.assistantId]) statsMap[s.assistantId] = { totalMinutes: 0, autoClosedCount: 0 };
      statsMap[s.assistantId].totalMinutes    += s.durationMinutes || 0;
      if (s.status === 'auto_closed') statsMap[s.assistantId].autoClosedCount += 1;
    }

    const data = assistants.map((a) => {
      const ap           = a.get({ plain: true });
      const stats        = statsMap[ap.id] || { totalMinutes: 0, autoClosedCount: 0 };
      const totalMinutes = stats.totalMinutes;
      const hourlyRate   = parseFloat(ap.hourlyRate || 0);
      return {
        id:             ap.id,
        studentId:      ap.studentId,
        name:           ap.name,
        position:       ap.position,
        hourlyRate:     String(ap.hourlyRate || '0.00'),
        totalMinutes,
        totalHours:     (totalMinutes / 60).toFixed(2),
        estimatedWage:  hourlyRate > 0 ? (hourlyRate * totalMinutes / 60).toFixed(2) : null,
        autoClosedCount: stats.autoClosedCount,
        hasAnomalies:   stats.autoClosedCount > 0,
      };
    });

    res.json({ data, total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    console.error('[admin.attendance.getReport]', err);
    res.status(500).json({ message: '报表查询失败' });
  }
};

// ─── 当前在班看板 ──────────────────────────────────────────────
/**
 * GET /api/admin/attendance/online
 *
 * 返回当前所有 status 为 open / pending_confirm 的学助及其班次信息，
 * 以 WorkSession 为准（不依赖 Assistant.isOnShift），保证实时准确。
 */
exports.getOnlineAssistants = async (req, res) => {
  try {
    const now = new Date();

    const sessions = await WorkSession.findAll({
      where:  { status: { [Op.in]: ['open', 'pending_confirm'] } },
      order:  [['startTime', 'ASC']],
      include: [{
        model:      Assistant,
        attributes: ['id', 'name', 'studentId', 'position'],
      }],
    });

    const data = sessions.map((s) => {
      const p = s.get({ plain: true });
      const onlineMinutes = Math.round((now - new Date(p.startTime)) / 60000);
      return {
        sessionId:     p.id,
        assistantId:   p.assistantId,
        name:          p.Assistant ? p.Assistant.name : null,
        studentId:     p.Assistant ? p.Assistant.studentId : null,
        position:      p.Assistant ? p.Assistant.position : null,
        date:          p.date,
        shiftType:     p.shiftType,
        shiftLabel:    SHIFT_LABELS_CN[p.shiftType] || p.shiftType,
        startTime:     p.startTime,
        onlineMinutes,
        status:        p.status,
      };
    });

    res.json({ data, total: data.length, serverTime: now.toISOString() });
  } catch (err) {
    console.error('[admin.attendance.getOnlineAssistants]', err);
    res.status(500).json({ message: '查询在班列表失败' });
  }
};

// ─── 在班看板 SSE 实时推送 ─────────────────────────────────────
/**
 * GET /api/admin/attendance/online/stream
 *
 * Server-Sent Events 长连接，管理前端订阅此接口后：
 *   1. 立即收到一次当前在班数据（event: online）
 *   2. 每 30 秒自动推送最新快照
 *   3. 当任意学助状态变化（打卡、通知确认等）时即时推送
 *
 * 前端示例：
 *   const es = new EventSource('/api/admin/attendance/online/stream', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 *   // 注意：原生 EventSource 不支持自定义 header，生产环境推荐使用
 *   // token 作为 query 参数（?token=xxx）并在此处验证，或改用 fetch + ReadableStream
 *   es.addEventListener('online', e => {
 *     const { data, total, serverTime } = JSON.parse(e.data);
 *     renderOnlineTable(data);
 *   });
 */
/** 内部辅助：构建在班快照并通过 SSE 广播（委托给共享服务）*/
exports.broadcastOnline = broadcastOnline;

exports.onlineStream = (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // 立即推送一次当前快照
  broadcastOnline();

  // 注册此连接到 sseManager（disconnect 时自动移除）
  sseManager.addClient(res);

  // 每 30s 推送最新快照（心跳 + 数据刷新）
  const timer = setInterval(() => broadcastOnline(), 30000);
  res.on('close', () => clearInterval(timer));
};

// ─── 管理员发送上/下班确认通知给学助 ──────────────────────────
/**
 * POST /api/admin/assistants/:id/shift-notice
 * body: { action: 'clock_in' | 'clock_out' }
 *
 * 1. 将该学助所有未处理通知置为 expired
 * 2. 创建新通知（5 分钟内有效）
 * 3. 通过 SSE 广播在班看板最新状态（让管理端看到"等待确认"状态）
 */
exports.requestShiftChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!['clock_in', 'clock_out'].includes(action)) {
      return res.status(400).json({ message: 'action 必须为 clock_in（上班）或 clock_out（下班）' });
    }

    const assistant = await Assistant.findByPk(id, { attributes: ['id', 'name', 'studentId'] });
    if (!assistant) return res.status(404).json({ message: '学助不存在' });

    // 废除该学助旧的待处理通知
    await ShiftNotification.update(
      { status: 'expired' },
      { where: { assistantId: id, status: 'pending' } },
    );

    // 创建新通知（5 分钟有效）
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const notice = await ShiftNotification.create({
      assistantId: id,
      requestedBy: req.user.id,
      action,
      status:     'pending',
      expiresAt,
    });

    // 广播在班看板（管理端可看到"通知已发出"）
    broadcastOnline().catch(() => {});

    const actionLabel = action === 'clock_in' ? '上班' : '下班';
    return res.status(201).json({
      message:        `已向 ${assistant.name} 发送${actionLabel}确认请求，等待学助响应`,
      notificationId: notice.id,
      action,
      actionLabel,
      assistantName:  assistant.name,
      assistantId:    assistant.id,
      expiresAt,
    });
  } catch (err) {
    console.error('[admin.requestShiftChange]', err);
    res.status(500).json({ message: '发送通知失败' });
  }
};

// ─── 查询指定学助的通知状态（管理端查询结果用）─────────────────
/**
 * GET /api/admin/assistants/:id/shift-notice
 * 返回该学助最近一条通知（任意状态），供管理端展示请求结果。
 */
exports.getAssistantNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await ShiftNotification.findOne({
      where: { assistantId: id },
      order: [['createdAt', 'DESC']],
    });
    if (!notice) return res.json({ notice: null });

    const n = notice.get({ plain: true });
    res.json({
      notice: {
        id:          n.id,
        action:      n.action,
        actionLabel: n.action === 'clock_in' ? '上班' : '下班',
        status:      n.status,
        expiresAt:   n.expiresAt,
        respondedAt: n.respondedAt,
        createdAt:   n.createdAt,
      },
    });
  } catch (err) {
    console.error('[admin.getAssistantNotice]', err);
    res.status(500).json({ message: '查询通知失败' });
  }
};
