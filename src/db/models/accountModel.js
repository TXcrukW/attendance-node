const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const bcrypt = require('bcryptjs');

const Account = sequelize.define('Account', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  assistantId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  forceChangePassword: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // 当前会话 ID，用于只认可最新分发的 token
  currentSessionId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  timestamps: true,
  hooks: {
    beforeSave: async (account) => {
      if (account.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        account.password = await bcrypt.hash(account.password, salt);
      }
    },
  },
});

Account.prototype.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = Account;
