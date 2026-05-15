/**
 * attendanceConfig.js
 * 考勤相关公共常量与工具函数，客户端/管理端控制器共用。
 */

// 各班次对应的下班时间 (HH:MM 字符串，用于展示)
const SHIFT_REST_LABELS = {
  morning:   '12:30',
  afternoon: '18:00',
  evening:   '22:00',
};

// 各班次对应的下班时间（分钟数，自 00:00 起，用于计算）
const SHIFT_REST_MINUTES = {
  morning:   12 * 60 + 30,   // 750
  afternoon: 18 * 60,         // 1080
  evening:   22 * 60,         // 1320
};

// 自动收口宽限期（分钟），可通过环境变量覆盖
const GRACE_MINUTES = parseInt(process.env.ATTENDANCE_GRACE_MINUTES || '15', 10);

// 班次中文名
const SHIFT_LABELS_CN = {
  morning:   '上午班',
  afternoon: '下午班',
  evening:   '晚班',
  other:     '其他',
};

/**
 * 根据打卡时间判断班次类型。
 * @param {Date} dt
 * @returns {'morning'|'afternoon'|'evening'|'other'}
 */
function getShiftType(dt) {
  const total = dt.getHours() * 60 + dt.getMinutes();
  if (total < SHIFT_REST_MINUTES.morning)   return 'morning';
  if (total < SHIFT_REST_MINUTES.afternoon) return 'afternoon';
  if (total < SHIFT_REST_MINUTES.evening)   return 'evening';
  return 'other';
}

/**
 * 检查当前时间是否已超过指定班次的下班时间（可选含宽限期）。
 * @param {'morning'|'afternoon'|'evening'} shiftType
 * @param {Date} now
 * @param {boolean} withGrace  是否加上宽限期
 * @returns {boolean}
 */
function isPastRestTime(shiftType, now, withGrace = false) {
  const bp = SHIFT_REST_MINUTES[shiftType];
  if (bp == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= bp + (withGrace ? GRACE_MINUTES : 0);
}

/**
 * 将 Date 转为 YYYY-MM-DD 格式（取本地日期）。
 * @param {Date} dt
 * @returns {string}
 */
function toDateOnly(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 构造指定日期（YYYY-MM-DD）+ 班次的下班时间点 Date 对象。
 * @param {string} dateStr  'YYYY-MM-DD'
 * @param {'morning'|'afternoon'|'evening'} shiftType
 * @returns {Date|null}
 */
function buildRestBreakpoint(dateStr, shiftType) {
  const bp = SHIFT_REST_MINUTES[shiftType];
  if (bp == null) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d, Math.floor(bp / 60), bp % 60, 0, 0);
}

module.exports = {
  SHIFT_REST_LABELS,
  SHIFT_REST_MINUTES,
  GRACE_MINUTES,
  SHIFT_LABELS_CN,
  getShiftType,
  isPastRestTime,
  toDateOnly,
  buildRestBreakpoint,
};
