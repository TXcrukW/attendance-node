const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

/**
 * ShiftNotification —— 管理员向学助发送的上/下班确认通知
 *
 * 流程：
 *   1. 管理员调用 POST /api/admin/assistants/:id/shift-notice  →  创建 pending 记录
 *   2. 学助客户端轮询 GET /api/attendance/shift-notice        →  发现 pending 时弹窗
 *   3. 学助确认/拒绝 POST /api/attendance/shift-notice/respond →  状态变为 confirmed/declined
 *
 * 状态流转：
 *   pending ──▶ confirmed  (学助点击"确认")
 *   pending ──▶ declined   (学助点击"不上/下班")
 *   pending ──▶ expired    (超过 expiresAt，服务端自动标记)
 */
const ShiftNotification = sequelize.define('ShiftNotification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // 通知目标学助
  assistantId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // 发起通知的管理员 ID
  requestedBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // 期望学助执行的操作
  action: {
    type: DataTypes.ENUM('clock_in', 'clock_out'),
    allowNull: false,
  },
  // 通知当前状态
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'declined', 'expired'),
    defaultValue: 'pending',
    allowNull: false,
  },
  // 通知过期时间（创建后 5 分钟）
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  // 学助响应时间
  respondedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // 确认上班后创建的 WorkSession ID（仅 clock_in + confirmed）
  resultSessionId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [
    // 按 assistantId + status 快速查询学助的待处理通知
    { fields: ['assistantId', 'status'] },
  ],
});

module.exports = ShiftNotification;
