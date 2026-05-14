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
      // 按学号升序返回，方便前端表格按学号顺序渲染
      order: [['studentId', 'ASC']],
      attributes: {
        include: [
          [literal(`(
            SELECT COALESCE(SUM("hours"),0) FROM "AssistantTimeLogs" AS t WHERE t."assistantId" = "Assistant"."id"
          )`), 'totalHours'],
        ],
      },
    });

    // 标准化返回结构，确保前端接收到固定的字段和类型
    const data = rows.map((r) => {
      const p = (typeof r.get === 'function') ? r.get({ plain: true }) : r;
      return {
        id: p.id,
        studentId: p.studentId,
        name: p.name,
        position: p.position,
        // 保持布尔值，前端按需渲染为“上班/下班”或“在岗/离岗”
        isOnDuty: Boolean(p.isOnDuty),
        status: p.status,
        phone: p.phone,
        email: p.email,
        // hourlyRate 保持字符串形式以避免精度问题
        hourlyRate: p.hourlyRate != null ? String(p.hourlyRate) : '0.00',
        // totalHours 统一为数字
        totalHours: p.totalHours != null ? Number(p.totalHours) : 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    res.json({ data, total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) });
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

    const p = assistant.get ? assistant.get({ plain: true }) : assistant;
    const payload = {
      id: p.id,
      studentId: p.studentId,
      name: p.name,
      position: p.position,
      isOnDuty: Boolean(p.isOnDuty),
      status: p.status,
      phone: p.phone,
      email: p.email,
      hourlyRate: p.hourlyRate != null ? String(p.hourlyRate) : '0.00',
      totalHours: p.totalHours != null ? Number(p.totalHours) : 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      notes: p.notes,
    };

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取学助详情失败' });
  }
};

// 新建单个学助
exports.createAssistant = async (req, res) => {
  try {
    const {
      studentId,
      name,
      phone,
      positionLevel,
      email,
      notes,
    } = req.body;

    // 引入验证工具
    const {
      validateAssistantData,
      normalizeAssistantData,
    } = require('../utils/validators');

    // 数据验证
    const validation = validateAssistantData({
      studentId,
      name,
      phone,
      positionLevel,
      email,
      notes,
    });

    if (!validation.valid) {
      return res.status(400).json({
        message: '数据验证失败',
        errors: validation.errors,
      });
    }

    // 检查学号唯一性
    const exists = await Assistant.findOne({ where: { studentId: studentId.trim() } });
    if (exists) {
      return res.status(409).json({
        message: '学号已存在',
        existingId: exists.id,
      });
    }

    // 规范化数据
    const normalizedData = normalizeAssistantData({
      studentId,
      name,
      phone,
      positionLevel,
      email,
      notes,
    });

    // 创建学助
    const assistant = await Assistant.create(normalizedData);

    // 返回标准格式
    const p = assistant.get({ plain: true });
    res.status(201).json({
      id: p.id,
      studentId: p.studentId,
      name: p.name,
      phone: p.phone,
      position: p.position,
      hourlyRate: String(p.hourlyRate),
      email: p.email,
      status: p.status,
      isOnDuty: Boolean(p.isOnDuty),
      notes: p.notes,
      createdAt: p.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '创建学助失败', error: err.message });
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
// 批量导入学助
// 支持多种导入模式：insert（新增）、upsert（新增或更新）
exports.bulkImport = async (req, res) => {
  try {
    const { data, mode = 'insert', fieldMapping = {} } = req.body;

    // 验证输入
    if (!Array.isArray(data)) {
      return res.status(400).json({
        message: '请求体 data 字段必须为数组',
      });
    }

    if (data.length === 0) {
      return res.status(400).json({
        message: 'data 数组不能为空',
      });
    }

    const maxRows = 1000;
    if (data.length > maxRows) {
      return res.status(400).json({
        message: `单次导入不能超过 ${maxRows} 行`,
      });
    }

    // 引入工具函数
    const {
      validateAssistantData,
      normalizeAssistantData,
    } = require('../utils/validators');
    const {
      mapFieldNamesForBatch,
      deduplicateByStudentId,
      generateImportReport,
    } = require('../utils/excelParser');

    // 第 1 步：字段名映射（处理不同表头）
    const mappedData = mapFieldNamesForBatch(data, fieldMapping);

    // 第 2 步：去重（内部去重）
    const { deduped, duplicates: internalDuplicates } = deduplicateByStudentId(mappedData);

    // 第 3 步：验证每一行
    const validRows = [];
    const invalidRows = [];

    internalDuplicates.forEach((dup) => {
      invalidRows.push({
        rowIndex: dup.rowIndex,
        studentId: dup.studentId,
        reason: '导入数据中存在重复学号',
      });
    });

    deduped.forEach((row, index) => {
      const validation = validateAssistantData(row);
      if (validation.valid) {
        validRows.push({
          originalIndex: index,
          data: row,
        });
      } else {
        invalidRows.push({
          rowIndex: index + 1,
          studentId: row.studentId || '无',
          reason: validation.errors.join('; '),
        });
      }
    });

    if (validRows.length === 0) {
      return res.status(400).json({
        message: '无有效数据行，导入失败',
        invalidRows,
      });
    }

    // 第 4 步：执行导入（根据模式）
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const { data: rawData } of validRows) {
      try {
        const normalizedData = normalizeAssistantData(rawData);

        if (mode === 'insert') {
          // 仅新增模式
          const existing = await Assistant.findOne({
            where: { studentId: normalizedData.studentId },
          });

          if (existing) {
            results.skipped += 1;
          } else {
            await Assistant.create(normalizedData);
            results.created += 1;
          }
        } else if (mode === 'upsert') {
          // upsert 模式：新增或更新
          const [assistant, created] = await Assistant.findOrCreate({
            where: { studentId: normalizedData.studentId },
            defaults: normalizedData,
          });

          if (!created) {
            // 存在则更新
            await assistant.update(normalizedData);
            results.updated += 1;
          } else {
            results.created += 1;
          }
        }
      } catch (err) {
        results.failed += 1;
        results.errors.push({
          studentId: rawData.studentId,
          name: rawData.name,
          reason: err.message,
        });
      }
    }

    // 生成报告
    const report = generateImportReport({
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      failed: results.failed,
      errors: results.errors,
    });

    res.json({
      ...report,
      invalidRows,
      message: `导入完成: 成功 ${report.summary.success} 行，失败 ${results.failed} 行`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: '批量导入失败',
      error: err.message,
    });
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
    const p = assistant.get ? assistant.get({ plain: true }) : assistant;
    res.json({
      id: p.id,
      studentId: p.studentId,
      name: p.name,
      position: p.position,
      isOnDuty: Boolean(p.isOnDuty),
      status: p.status,
      phone: p.phone,
      email: p.email,
    });
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

// 文件上传导入接口（支持 CSV、Excel）
// 前端需配合 multer/formidable 上传文件
// 使用示例：
// const formData = new FormData();
// formData.append('file', fileObject);
// formData.append('mode', 'upsert');
// fetch('/api/assistants/import-file', { method: 'POST', body: formData, headers: { Authorization: 'Bearer token' } })
exports.importFile = async (req, res) => {
  try {
    // 注：需在路由中配置 multer 中间件来处理文件上传
    // 这里假设文件内容已通过中间件处理，存储在 req.file.buffer 或 req.fileContent
    if (!req.file && !req.fileContent) {
      return res.status(400).json({
        message: '未找到上传的文件',
      });
    }

    const fileBuffer = req.file?.buffer || Buffer.from(req.fileContent, 'utf8');
    const mimeType = req.file?.mimetype || 'text/csv';
    const { mode = 'insert', fieldMapping = {} } = req.body;

    const { parseCSV, parseExcel } = require('../utils/excelParser');

    let data = [];

    // 根据文件类型选择解析方式
    if (mimeType === 'text/csv' || mimeType === 'application/csv') {
      const csvContent = fileBuffer.toString('utf-8');
      data = parseCSV(csvContent, { delimiter: ',' });
    } else if (
      mimeType === 'application/vnd.ms-excel'
      || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      data = parseExcel(fileBuffer, { sheetIndex: 0 });
    } else {
      return res.status(400).json({
        message: '不支持的文件类型，请上传 CSV 或 Excel 文件',
      });
    }

    // 调用 bulkImport 逻辑
    req.body = { data, mode, fieldMapping };
    await exports.bulkImport(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: '文件导入失败',
      error: err.message,
    });
  }
};
