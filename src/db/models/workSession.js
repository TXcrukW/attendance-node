const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const Assistant = require('./assistantModel');

/**
 * WorkSession —— 配对后的工作区间
 *
 * 状态流转：
 *   open ──────────────────▶ closed        (学助正常下班打卡)
 *   open ──▶ pending_confirm ──▶ closed    (休息时间弹窗 → 确认下班)
 *   open / pending_confirm ──▶ auto_closed (超过宽限期系统自动收口)
 *   closed / auto_closed ──▶ corrected    (管理员人工纠正)
 *
 * 班次类型由上班打卡时刻决定：
 *   morning   : 00:00 – 12:29（预计 12:30 下班）
 *   afternoon : 12:30 – 17:59（预计 18:00 下班）
 *   evening   : 18:00 – 21:59（预计 22:00 下班）
 *   other     : 22:00+（深夜/跨天，需人工处理）
 */
const WorkSession = sequelize.define('WorkSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  assistantId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // 工作日期（取上班打卡的自然日 YYYY-MM-DD），便于按日查询
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  shiftType: {
    type: DataTypes.ENUM('morning', 'afternoon', 'evening', 'other'),
    allowNull: false,
    defaultValue: 'morning',
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  // 下班时间，open 状态下为 null
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // 工时（分钟），关闭时由服务端计算写入
  durationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'auto_closed', 'pending_confirm', 'corrected'),
    allowNull: false,
    defaultValue: 'open',
  },
  // 系统自动收口的原因说明
  autoCloseReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // 管理员纠正备注
  correctionNote: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // 纠正操作的管理员 ID
  correctedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // 关联原始打卡记录
  punchInId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  punchOutId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [
    // 常用查询优化
    { fields: ['assistantId', 'date'] },
    { fields: ['status'] },
  ],
});

Assistant.hasMany(WorkSession, { foreignKey: 'assistantId', sourceKey: 'id' });
WorkSession.belongsTo(Assistant, { foreignKey: 'assistantId', targetKey: 'id' });

module.exports = WorkSession;
