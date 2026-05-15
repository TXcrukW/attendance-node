const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const Assistant = require('./assistantModel');

/**
 * PunchRecord —— 原始打卡事件（不可变日志）
 * 每次上班/下班打卡写入一条记录，作为审计依据。
 * 工时计算依赖 WorkSession，后者由本表配对生成。
 */
const PunchRecord = sequelize.define('PunchRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  assistantId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // IN = 上班打卡, OUT = 下班打卡
  type: {
    type: DataTypes.ENUM('IN', 'OUT'),
    allowNull: false,
  },
  // 服务端接收时间（以服务器时钟为准，不接受客户端篡改）
  punchTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  // 来源标识（如 app / web）
  source: {
    type: DataTypes.STRING(50),
    defaultValue: 'app',
  },
  // 客户端 IP，便于审计
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
}, {
  timestamps: true,
});

Assistant.hasMany(PunchRecord, { foreignKey: 'assistantId', sourceKey: 'id' });
PunchRecord.belongsTo(Assistant, { foreignKey: 'assistantId', targetKey: 'id' });

module.exports = PunchRecord;
