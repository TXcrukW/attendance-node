const { Op } = require('sequelize');
const { sequelize } = require('../../config/db');
const Assistant         = require('../../db/models/assistantModel');
const PunchRecord       = require('../../db/models/punchRecord');
const WorkSession       = require('../../db/models/workSession');
const ShiftNotification = require('../../db/models/shiftNotification');
const { broadcastOnline } = require('../../common/services/attendanceBroadcast');
const {
  getShiftType,
  isPastRestTime,
  toDateOnly,
  SHIFT_REST_LABELS,
  SHIFT_LABELS_CN,
} = require('../../utils/attendanceConfig');

// ─── 打卡（上班 / 下班）─────────────────────────────────────────
/**
 * POST /api/attendance/punch
 * body: { type: 'IN' | 'OUT', source?: string }
 *
 * 学助账号登录后，token 中携带 assistantId。
 * 以服务端时间为准，避免客户端时间篡改。
 */
exports.punch = async (req, res) => {
  try {
    const { type, source = 'app' } = req.body;
    const assistantId = req.user && req.user.assistantId;

    if (!assistantId) {
      return res.status(403).json({ message: '请使用学助账号登录后操作' });
    }
    if (!['IN', 'OUT'].includes(type)) {
      return res.status(400).json({ message: 'type 参数必须为 IN（上班）或 OUT（下班）' });
    }

    const now = new Date();
    const t   = await sequelize.transaction();

    try {
      // 查询此学助是否有进行中的班次
      const openSession = await WorkSession.findOne({
        where: { assistantId, status: { [Op.in]: ['open', 'pending_confirm'] } },
        transaction: t,
      });

      // ── 上班打卡 ──────────────────────────────────────────────
      if (type === 'IN') {
        if (openSession) {
          await t.rollback();
          return res.status(409).json({
            message: '您已有未结束的班次，请先完成下班打卡',
            sessionId:  openSession.id,
            startTime:  openSession.startTime,
            shiftLabel: SHIFT_LABELS_CN[openSession.shiftType],
          });
        }

        const shiftType = getShiftType(now);
        const date      = toDateOnly(now);

        const punch = await PunchRecord.create(
          { assistantId, type: 'IN', punchTime: now, source, ipAddress: req.ip },
          { transaction: t },
        );

        const session = await WorkSession.create(
          { assistantId, date, shiftType, startTime: now, status: 'open', punchInId: punch.id },
          { transaction: t },
        );

        await t.commit();
        // 同步学助在班状态
        await Assistant.update({ isOnShift: true }, { where: { id: assistantId } });
        return res.status(201).json({
          message: `上班打卡成功（${SHIFT_LABELS_CN[shiftType]}）`,
          sessionId:     session.id,
          shiftType,
          shiftLabel:    SHIFT_LABELS_CN[shiftType],
          startTime:     now,
          expectedEndAt: SHIFT_REST_LABELS[shiftType] || null,
          status:        'open',
        });
      }

      // ── 下班打卡 ──────────────────────────────────────────────
      if (!openSession) {
        await t.rollback();
        return res.status(409).json({ message: '您当前没有进行中的班次，无需下班打卡' });
      }

      const durationMinutes = Math.max(0, Math.round((now - openSession.startTime) / 60000));

      const punch = await PunchRecord.create(
        { assistantId, type: 'OUT', punchTime: now, source, ipAddress: req.ip },
        { transaction: t },
      );

      await openSession.update(
        { endTime: now, durationMinutes, status: 'closed', punchOutId: punch.id },
        { transaction: t },
      );

      await t.commit();
      // 同步学助下班状态
      await Assistant.update({ isOnShift: false }, { where: { id: assistantId } });
      return res.json({
        message: '下班打卡成功',
        sessionId:      openSession.id,
        shiftLabel:     SHIFT_LABELS_CN[openSession.shiftType],
        startTime:      openSession.startTime,
        endTime:        now,
        durationMinutes,
        hours:          (durationMinutes / 60).toFixed(2),
        status:         'closed',
      });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    console.error('[attendance.punch]', err);
    res.status(500).json({ message: '打卡失败，请稍后重试' });
  }
};

// ─── 当前考勤状态（前端轮询获取提醒）──────────────────────────────
/**
 * GET /api/attendance/status
 *
 * 返回：
 *   - openSession       当前进行中的班次（若有）
 *   - pendingReminder   是否需要弹窗提醒（已过休息时间但未下班）
 *   - todaySessions     今日所有班次列表
 */
exports.getStatus = async (req, res) => {
  try {
    const assistantId = req.user && req.user.assistantId;
    if (!assistantId) return res.status(403).json({ message: '请使用学助账号登录后操作' });

    const today = toDateOnly(new Date());
    const now   = new Date();

    const todaySessions = await WorkSession.findAll({
      where: { assistantId, date: today },
      order:   [['startTime', 'ASC']],
    });

    const openSession = todaySessions.find(
      (s) => s.status === 'open' || s.status === 'pending_confirm',
    ) || null;

    let pendingReminder = null;
    if (openSession && isPastRestTime(openSession.shiftType, now, false)) {
      const restLabel = SHIFT_REST_LABELS[openSession.shiftType];
      const shiftLabel = SHIFT_LABELS_CN[openSession.shiftType];
      pendingReminder = {
        sessionId:  openSession.id,
        shiftType:  openSession.shiftType,
        shiftLabel,
        restTime:   restLabel,
        startTime:  openSession.startTime,
        message:    `您的${shiftLabel}已到休息时间（${restLabel}），请确认：是否仍在加班？`,
      };
    }

    res.json({
      openSession,
      pendingReminder,
      todaySessions,
      serverTime: now.toISOString(),
    });
  } catch (err) {
    console.error('[attendance.getStatus]', err);
    res.status(500).json({ message: '获取考勤状态失败' });
  }
};

// ─── 查询自己的历史班次 ─────────────────────────────────────────
/**
 * GET /api/attendance/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20&status=
 */
exports.getMySessions = async (req, res) => {
  try {
    const assistantId = req.user && req.user.assistantId;
    if (!assistantId) return res.status(403).json({ message: '请使用学助账号登录后操作' });

    const { from, to, page = 1, limit = 20, status } = req.query;
    const where = { assistantId };
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to)   where.date[Op.lte] = to;
    }
    if (status) where.status = status;

    const { count, rows } = await WorkSession.findAndCountAll({
      where,
      order: [['startTime', 'DESC']],
      limit:  parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    });

    // 格式化：附加可读字段
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
    console.error('[attendance.getMySessions]', err);
    res.status(500).json({ message: '查询班次记录失败' });
  }
};

// ─── 查询自己的工时汇总 ─────────────────────────────────────────
/**
 * GET /api/attendance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * 仅统计 closed / auto_closed / corrected 状态的班次。
 * auto_closed 会有 ⚠ 标注，建议提示学助联系管理员核实。
 */
exports.getMySummary = async (req, res) => {
  try {
    const assistantId = req.user && req.user.assistantId;
    if (!assistantId) return res.status(403).json({ message: '请使用学助账号登录后操作' });

    const { from, to } = req.query;
    const where = {
      assistantId,
      status: { [Op.in]: ['closed', 'auto_closed', 'corrected'] },
    };
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to)   where.date[Op.lte] = to;
    }

    const sessions = await WorkSession.findAll({ where, order: [['date', 'ASC'], ['startTime', 'ASC']] });

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const autoClosedCount = sessions.filter((s) => s.status === 'auto_closed').length;

    // 按日汇总
    const byDateMap = {};
    for (const s of sessions) {
      if (!byDateMap[s.date]) byDateMap[s.date] = { date: s.date, minutes: 0, sessionCount: 0, hasAnomalies: false };
      byDateMap[s.date].minutes      += s.durationMinutes || 0;
      byDateMap[s.date].sessionCount += 1;
      if (s.status === 'auto_closed') byDateMap[s.date].hasAnomalies = true;
    }

    res.json({
      totalMinutes,
      totalHours:       (totalMinutes / 60).toFixed(2),
      sessionCount:     sessions.length,
      autoClosedCount,
      hasUnconfirmed:   autoClosedCount > 0,
      unconfirmedTip:   autoClosedCount > 0 ? `您有 ${autoClosedCount} 条系统自动收口记录，请联系管理员核实工时` : null,
      byDate: Object.values(byDateMap).map((d) => ({
        ...d,
        hours: (d.minutes / 60).toFixed(2),
      })),
    });
  } catch (err) {
    console.error('[attendance.getMySummary]', err);
    res.status(500).json({ message: '统计工时失败' });
  }
};

// ─── 学助端：查询管理员发来的在/下班通知（轮询接口）──────────
/**
 * GET /api/attendance/shift-notice
 *
 * 学助客户端每 10 秒轮询此接口。
 * 若存在有效的 pending 通知则返回通知内容，客户端据此弹出确认弹窗；
 * 若没有则返回 { notice: null }。
 *
 * 同时会自动将已过期的 pending 通知标记为 expired。
 */
exports.getShiftNotice = async (req, res) => {
  try {
    const assistantId = req.user && req.user.assistantId;
    if (!assistantId) return res.status(403).json({ message: '请使用学助账号登录后操作' });

    const now = new Date();

    // 批量过期处理（不等待，异步进行）
    ShiftNotification.update(
      { status: 'expired' },
      { where: { assistantId, status: 'pending', expiresAt: { [Op.lt]: now } } },
    ).catch(() => {});

    const notice = await ShiftNotification.findOne({
      where: {
        assistantId,
        status:    'pending',
        expiresAt: { [Op.gt]: now },
      },
      order: [['createdAt', 'DESC']],
    });

    if (!notice) return res.json({ notice: null });

    const n = notice.get({ plain: true });
    res.json({
      notice: {
        id:          n.id,
        action:      n.action,
        actionLabel: n.action === 'clock_in' ? '上班' : '下班',
        expiresAt:   n.expiresAt,
        createdAt:   n.createdAt,
        // 剩余有效秒数，供前端倒计时展示
        secondsLeft: Math.max(0, Math.round((new Date(n.expiresAt) - now) / 1000)),
      },
    });
  } catch (err) {
    console.error('[attendance.getShiftNotice]', err);
    res.status(500).json({ message: '获取通知失败' });
  }
};

// ─── 学助端：响应管理员的在/下班通知 ──────────────────────────
/**
 * POST /api/attendance/shift-notice/respond
 * body: { notificationId: string, response: 'confirmed' | 'declined' }
 *
 * confirmed → 实际执行打卡（上班或下班），逻辑与 /punch 一致
 * declined  → 仅标记通知为 declined，不做打卡操作
 *
 * 无论结果如何，都会触发一次 SSE 广播，管理端实时看板即时刷新。
 */
exports.respondShiftNotice = async (req, res) => {
  try {
    const assistantId = req.user && req.user.assistantId;
    if (!assistantId) return res.status(403).json({ message: '请使用学助账号登录后操作' });

    const { notificationId, response } = req.body;
    if (!notificationId) return res.status(400).json({ message: 'notificationId 为必填项' });
    if (!['confirmed', 'declined'].includes(response)) {
      return res.status(400).json({ message: 'response 必须为 confirmed 或 declined' });
    }

    const now    = new Date();
    const notice = await ShiftNotification.findOne({
      where: { id: notificationId, assistantId, status: 'pending' },
    });

    if (!notice) {
      return res.status(404).json({ message: '通知不存在或已处理' });
    }
    if (now > notice.expiresAt) {
      await notice.update({ status: 'expired' });
      return res.status(410).json({ message: '通知已超时（5 分钟内未响应自动失效）' });
    }

    // ── 拒绝 ─────────────────────────────────────────────────────
    if (response === 'declined') {
      await notice.update({ status: 'declined', respondedAt: now });
      broadcastOnline().catch(() => {});
      return res.json({ message: '已拒绝', status: 'declined' });
    }

    // ── 确认：执行上班或下班打卡 ─────────────────────────────────
    const t = await sequelize.transaction();
    try {
      const openSession = await WorkSession.findOne({
        where: { assistantId, status: { [Op.in]: ['open', 'pending_confirm'] } },
        transaction: t,
      });

      // clock_in
      if (notice.action === 'clock_in') {
        if (openSession) {
          await t.rollback();
          return res.status(409).json({
            message:   '您已有未结束的班次，无需重复上班',
            sessionId: openSession.id,
          });
        }

        const shiftType = getShiftType(now);
        const date      = toDateOnly(now);

        const punch = await PunchRecord.create(
          { assistantId, type: 'IN', punchTime: now, source: 'admin_notice' },
          { transaction: t },
        );
        const session = await WorkSession.create(
          { assistantId, date, shiftType, startTime: now, status: 'open', punchInId: punch.id },
          { transaction: t },
        );

        await notice.update(
          { status: 'confirmed', respondedAt: now, resultSessionId: session.id },
          { transaction: t },
        );
        await t.commit();
        await Assistant.update({ isOnShift: true }, { where: { id: assistantId } });
        broadcastOnline().catch(() => {});

        return res.json({
          message:    `上班打卡成功（${SHIFT_LABELS_CN[shiftType]}）`,
          status:     'confirmed',
          sessionId:  session.id,
          shiftLabel: SHIFT_LABELS_CN[shiftType],
          startTime:  now,
        });
      }

      // clock_out
      if (!openSession) {
        await t.rollback();
        return res.status(409).json({ message: '当前没有进行中的班次，无需下班' });
      }

      const durationMinutes = Math.max(0, Math.round((now - openSession.startTime) / 60000));
      const punch = await PunchRecord.create(
        { assistantId, type: 'OUT', punchTime: now, source: 'admin_notice' },
        { transaction: t },
      );
      await openSession.update(
        { endTime: now, durationMinutes, status: 'closed', punchOutId: punch.id },
        { transaction: t },
      );
      await notice.update(
        { status: 'confirmed', respondedAt: now },
        { transaction: t },
      );
      await t.commit();
      await Assistant.update({ isOnShift: false }, { where: { id: assistantId } });
      broadcastOnline().catch(() => {});

      return res.json({
        message:         '下班打卡成功',
        status:          'confirmed',
        shiftLabel:      SHIFT_LABELS_CN[openSession.shiftType],
        startTime:       openSession.startTime,
        endTime:         now,
        durationMinutes,
        hours:           (durationMinutes / 60).toFixed(2),
      });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    console.error('[attendance.respondShiftNotice]', err);
    res.status(500).json({ message: '处理响应失败' });
  }
};
