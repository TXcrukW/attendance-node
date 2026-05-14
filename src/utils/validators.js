/**
 * 数据验证工具类
 */

// 岗位等级与小时费率映射
const POSITION_LEVEL_MAPPING = {
  '一级岗': { position: '一级岗', hourlyRate: 15 },
  '二级岗': { position: '二级岗', hourlyRate: 12 },
};

/**
 * 验证学号格式
 * @param {string} studentId - 学号
 * @returns {boolean}
 */
function validateStudentId(studentId) {
  if (!studentId || typeof studentId !== 'string') return false;
  // 学号通常为 8-12 位数字或字母
  return /^[A-Za-z0-9]{8,12}$/.test(studentId.trim());
}

/**
 * 验证姓名
 * @param {string} name - 姓名
 * @returns {boolean}
 */
function validateName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  // 允许中文、英文、数字和空格，长度 2-50
  return /^[\u4E00-\u9FA5a-zA-Z0-9\s]{2,50}$/.test(trimmed);
}

/**
 * 验证手机号
 * @param {string} phone - 手机号
 * @returns {boolean}
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // 中国手机号: 1 开头，11 位数字
  return /^1[3-9]\d{9}$/.test(phone.trim());
}

/**
 * 验证岗位等级
 * @param {string} positionLevel - 岗位等级（"一级岗" 或 "二级岗"）
 * @returns {boolean}
 */
function validatePositionLevel(positionLevel) {
  if (!positionLevel || typeof positionLevel !== 'string') return false;
  return positionLevel.trim() in POSITION_LEVEL_MAPPING;
}

/**
 * 验证邮箱
 * @param {string} email - 邮箱
 * @returns {boolean}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * 验证单条学助数据（单个添加）
 * @param {object} data - 学助数据
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateAssistantData(data) {
  const errors = [];

  // 必填字段验证
  if (!validateStudentId(data.studentId)) {
    errors.push('studentId 格式不正确（应为 8-12 位字母或数字）');
  }

  if (!validateName(data.name)) {
    errors.push('name 格式不正确（应为 2-50 个字符）');
  }

  if (!validatePhone(data.phone)) {
    errors.push('phone 格式不正确（应为有效的中国手机号）');
  }

  if (!validatePositionLevel(data.positionLevel)) {
    errors.push('positionLevel 无效（应为"一级岗"或"二级岗"）');
  }

  // 可选字段验证
  if (data.email && !validateEmail(data.email)) {
    errors.push('email 格式不正确');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证批量导入数据
 * @param {array} data - 学助数据数组
 * @returns {object} { valid: boolean, errors: array }
 */
function validateBatchData(data) {
  if (!Array.isArray(data)) {
    return { valid: false, errors: ['data 必须是数组'] };
  }

  if (data.length === 0) {
    return { valid: false, errors: ['data 不能为空'] };
  }

  const errors = [];
  const maxRows = 1000; // 单次导入最多行数

  if (data.length > maxRows) {
    return { valid: false, errors: [`单次导入不能超过 ${maxRows} 行`] };
  }

  // 逐行验证
  data.forEach((row, index) => {
    const rowNumber = index + 1;

    if (!validateStudentId(row.studentId)) {
      errors.push(`第 ${rowNumber} 行：studentId 格式不正确`);
    }

    if (!validateName(row.name)) {
      errors.push(`第 ${rowNumber} 行：name 格式不正确`);
    }

    if (!validatePhone(row.phone)) {
      errors.push(`第 ${rowNumber} 行：phone 格式不正确`);
    }

    if (!validatePositionLevel(row.positionLevel)) {
      errors.push(`第 ${rowNumber} 行：positionLevel 无效`);
    }

    if (row.email && !validateEmail(row.email)) {
      errors.push(`第 ${rowNumber} 行：email 格式不正确`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    validRows: data.length - errors.length, // 有效行数（近似）
  };
}

/**
 * 转换岗位等级为模型字段
 * @param {string} positionLevel - 岗位等级
 * @returns {object} { position: string, hourlyRate: number }
 */
function convertPositionLevel(positionLevel) {
  const normalized = positionLevel.trim();
  return POSITION_LEVEL_MAPPING[normalized] || { position: '', hourlyRate: 0 };
}

/**
 * 规范化学助数据
 * @param {object} rawData - 原始数据
 * @returns {object} 规范化后的数据
 */
function normalizeAssistantData(rawData) {
  const { position, hourlyRate } = convertPositionLevel(rawData.positionLevel);

  return {
    studentId: rawData.studentId.trim(),
    name: rawData.name.trim(),
    phone: rawData.phone.trim(),
    email: rawData.email ? rawData.email.trim() : null,
    position,
    hourlyRate,
    status: 'active',
    isOnDuty: false,
    notes: rawData.notes ? rawData.notes.trim() : null,
  };
}

module.exports = {
  validateStudentId,
  validateName,
  validatePhone,
  validatePositionLevel,
  validateEmail,
  validateAssistantData,
  validateBatchData,
  convertPositionLevel,
  normalizeAssistantData,
  POSITION_LEVEL_MAPPING,
};
