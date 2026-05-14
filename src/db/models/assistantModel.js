const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Assistant = sequelize.define('Assistant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  hourlyRate: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isOnDuty: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  phone: DataTypes.STRING,
  notes: DataTypes.TEXT,
}, {
  timestamps: true,
});

module.exports = Assistant;
