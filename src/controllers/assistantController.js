const { Op, literal } = require('sequelize');
const { sequelize } = require('../config/db');
const Assistant = require('../models/assistantModel');
const AssistantTimeLog = require('../models/assistantTimeLog');

// 列表（支持搜索、分页）
exports.listAssistants = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    if (search) {
      where[Op.or] = [
        { studentId: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (status) where.status = status;

    const { count, rows } = await Assistant.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['createdAt', 'DESC']],
      attributes: {
        include: [
          [literal(`(
            SELECT COALESCE(SUM("hours"),0) FROM "AssistantTimeLogs" AS t WHERE t."assistantId" = "Assistant"."id"
          )`), 'totalHours'],
        ],
      },
    });

    res.json({ data: rows, total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取学助列表失败' });
  }
};

// 详情（可选包含时间日志）
exports.getAssistant = async (req, res) => {
  try {
    const { id } = req.params;
    const assistant = await Assistant.findByPk(id, {
      attributes: {
        include: [
          [literal(`(
            SELECT COALESCE(SUM("hours"),0) FROM "AssistantTimeLogs" AS t WHERE t."assistantId" = "Assistant"."id"
          )`), 'totalHours'],
        ],
      },
    });
    if (!assistant) return res.status(404).json({ message: '未找到学助' });

    res.json(assistant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取学助详情失败' });
  }
};

// 新建
exports.createAssistant = async (req, res) => {
  try {
    const { studentId, name, hourlyRate = 0, status = 'active', phone, email, notes, position, isOnDuty = false } = req.body;
    if (!studentId || !name) return res.status(400).json({ message: '缺少 studentId 或 name' });

    const exists = await Assistant.findOne({ where: { studentId } });
    if (exists) return res.status(409).json({ message: '学号已存在' });

    const assistant = await Assistant.create({ studentId, name, hourlyRate, status, phone, email, notes, position, isOnDuty });
    res.status(201).json(assistant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '创建学助失败' });
  }
};

// 更新
exports.updateAssistant = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const assistant = await Assistant.findByPk(id);
    if (!assistant) return res.status(404).json({ message: '未找到学助' });

    await assistant.update(payload);
    res.json(assistant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '更新学助失败' });
  }
};

// 删除（物理删除）
exports.deleteAssistant = async (req, res) => {
  try {
    const { id } = req.params;
    const assistant = await Assistant.findByPk(id);
    if (!assistant) return res.status(404).json({ message: '未找到学助' });
    await assistant.destroy();
    res.json({ message: '已删除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '删除学助失败' });
  }
};

// 批量导入（接收 JSON 数组）
exports.bulkImport = async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ message: '请求体应为数组' });

    const toCreate = items.map((it) => ({
      studentId: it.studentId,
      name: it.name,
      hourlyRate: it.hourlyRate || 0,
      status: it.status || 'active',
      position: it.position,
      isOnDuty: typeof it.isOnDuty === 'boolean' ? it.isOnDuty : (it.isOnDuty === 'true'),
      phone: it.phone,
      email: it.email,
      notes: it.notes,
    }));

    // bulkCreate + ignore duplicates: 使用 postgres 的 ON CONFLICT 需要 raw query 或先查询
    // 简化：尝试创建并在冲突时跳过
    const results = [];
    for (const r of toCreate) {
      try {
        const existing = await Assistant.findOne({ where: { studentId: r.studentId } });
        if (existing) {
          await existing.update(r);
          results.push({ studentId: r.studentId, action: 'updated' });
        } else {
          await Assistant.create(r);
          results.push({ studentId: r.studentId, action: 'created' });
        }
      } catch (e) {
        results.push({ studentId: r.studentId, action: 'error', reason: e.message });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '批量导入失败' });
  }
};

// 时间日志：列出 / 新建
exports.listTimeLogs = async (req, res) => {
  try {
    const { assistantId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = { assistantId };
    const { count, rows } = await AssistantTimeLog.findAndCountAll({ where, limit: parseInt(limit,10), offset: parseInt(offset,10), order: [['date','DESC']] });
    res.json({ data: rows, total: count, page: parseInt(page,10), limit: parseInt(limit,10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取时间日志失败' });
  }
};

exports.createTimeLog = async (req, res) => {
  try {
    const { assistantId } = req.params;
    const { date, hours, remark } = req.body;
    if (!date || !hours) return res.status(400).json({ message: '缺少 date 或 hours' });
    const assistant = await Assistant.findByPk(assistantId);
    if (!assistant) return res.status(404).json({ message: '未找到学助' });
    const log = await AssistantTimeLog.create({ assistantId, date, hours, remark });
    res.status(201).json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '创建时间日志失败' });
  }
};

// 切换或设置在岗状态（isOnDuty），并返回更新后的对象
exports.setOnDuty = async (req, res) => {
  try {
    const { id } = req.params;
    const { isOnDuty } = req.body;
    if (typeof isOnDuty !== 'boolean') return res.status(400).json({ message: 'isOnDuty 字段必须为 boolean' });
    const assistant = await Assistant.findByPk(id);
    if (!assistant) return res.status(404).json({ message: '未找到学助' });
    await assistant.update({ isOnDuty });
    res.json(assistant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '更新在岗状态失败' });
  }
};

// 统计接口：总数、在职数、离职数、总工时
exports.stats = async (req, res) => {
  try {
    const total = await Assistant.count();
    const active = await Assistant.count({ where: { status: 'active' } });
    const inactive = total - active;
    const [[{ totalHours }]] = await sequelize.query(`SELECT COALESCE(SUM("hours"),0) AS "totalHours" FROM "AssistantTimeLogs"`);
    res.json({ total, active, inactive, totalHours: Number(totalHours) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '统计失败' });
  }
};
