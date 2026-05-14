const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Assistant = require('./assistantModel');

const AssistantTimeLog = sequelize.define('AssistantTimeLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  assistantId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  hours: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: false,
    defaultValue: 0,
  },
  remark: DataTypes.TEXT,
}, {
  timestamps: true,
});

Assistant.hasMany(AssistantTimeLog, { foreignKey: 'assistantId', sourceKey: 'id' });
AssistantTimeLog.belongsTo(Assistant, { foreignKey: 'assistantId', targetKey: 'id' });

module.exports = AssistantTimeLog;
