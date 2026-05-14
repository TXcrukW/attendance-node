/**
 * 导入助手工具类
 * 处理 CSV、Excel、JSON 等多种格式的数据解析和导入
 */

const XLSX = require('xlsx');

/**
 * 解析 CSV 字符串为对象数组
 * 支持 UTF-8 和 GBK 编码
 * @param {string} csvContent - CSV 内容
 * @param {object} options - 配置项
 * @returns {array} 解析后的数据数组
 */
function parseCSV(csvContent, options = {}) {
  const {
    delimiter = ',',
    hasHeader = true,
    encoding = 'utf-8',
  } = options;

  const lines = csvContent.split('\n').filter((line) => line.trim());

  if (lines.length === 0) return [];

  const header = hasHeader ? lines[0].split(delimiter).map((h) => h.trim()) : null;
  const startIndex = hasHeader ? 1 : 0;

  const data = lines.slice(startIndex).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim());
    if (!header) return values;

    const obj = {};
    header.forEach((col, idx) => {
      obj[col] = values[idx] || null;
    });
    return obj;
  });

  return data;
}

/**
 * 解析 Excel 文件为对象数组
 * @param {buffer} fileBuffer - 文件二进制内容
 * @param {object} options - 配置项
 * @returns {array} 解析后的数据数组
 */
function parseExcel(fileBuffer, options = {}) {
  const {
    sheetIndex = 0,
    hasHeader = true,
  } = options;

  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[sheetIndex];

    if (!sheetName) {
      throw new Error(`指定的 sheet 索引 ${sheetIndex} 不存在`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      blankrows: false,
    });

    return data;
  } catch (err) {
    throw new Error(`Excel 解析失败: ${err.message}`);
  }
}

/**
 * 字段名映射
 * 处理不同的表头名称，统一为标准字段名
 * @param {object} row - 原始行数据
 * @param {object} mapping - 字段映射表
 * @returns {object} 映射后的数据
 */
function mapFieldNames(row, mapping = {}) {
  const defaultMapping = {
    '学号': 'studentId',
    'StudentId': 'studentId',
    'student_id': 'studentId',
    '姓名': 'name',
    'Name': 'name',
    '手机': 'phone',
    '手机号': 'phone',
    'Phone': 'phone',
    'phone_number': 'phone',
    '岗位等级': 'positionLevel',
    '等级': 'positionLevel',
    'PositionLevel': 'positionLevel',
    'position_level': 'positionLevel',
    '邮箱': 'email',
    'Email': 'email',
    '备注': 'notes',
    'Notes': 'notes',
    '说明': 'notes',
  };

  // 合并用户自定义映射
  const finalMapping = { ...defaultMapping, ...mapping };

  const mapped = {};
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = finalMapping[key] || key;
    mapped[mappedKey] = value;
  });

  return mapped;
}

/**
 * 批量映射字段名
 * @param {array} rows - 行数据数组
 * @param {object} mapping - 字段映射表
 * @returns {array} 映射后的数据数组
 */
function mapFieldNamesForBatch(rows, mapping = {}) {
  return rows.map((row) => mapFieldNames(row, mapping));
}

/**
 * 去重学号
 * @param {array} data - 数据数组
 * @returns {object} { deduped: array, duplicates: array }
 */
function deduplicateByStudentId(data) {
  const seen = new Set();
  const deduped = [];
  const duplicates = [];

  data.forEach((row, index) => {
    const studentId = row.studentId?.toString().trim();
    if (seen.has(studentId)) {
      duplicates.push({
        rowIndex: index + 1,
        studentId,
        name: row.name,
      });
    } else {
      seen.add(studentId);
      deduped.push(row);
    }
  });

  return { deduped, duplicates };
}

/**
 * 导入模式定义
 */
const IMPORT_MODES = {
  // 仅新增，如果学号已存在则跳过
  INSERT: 'insert',
  // 可选：新增或更新（upsert），学号存在则更新
  UPSERT: 'upsert',
  // 替换模式（删除所有现有记录，然后新增）- 谨慎使用
  REPLACE: 'replace',
};

/**
 * 生成导入报告
 * @param {object} results - 导入结果
 * @returns {object} 格式化的报告
 */
function generateImportReport(results) {
  const { created = 0, updated = 0, skipped = 0, failed = 0, errors = [] } = results;

  return {
    summary: {
      total: created + updated + skipped + failed,
      created,
      updated,
      skipped,
      failed,
      success: created + updated,
    },
    errors: errors.slice(0, 50), // 只返回前 50 个错误
    errorCount: errors.length > 50 ? `共 ${errors.length} 个错误，仅显示前 50 个` : null,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  parseCSV,
  parseExcel,
  mapFieldNames,
  mapFieldNamesForBatch,
  deduplicateByStudentId,
  generateImportReport,
  IMPORT_MODES,
};
