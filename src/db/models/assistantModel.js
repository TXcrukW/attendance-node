const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const crypto = require('crypto');
const Account = require('./accountModel');

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
  hooks: {
    // 创建学助时，自动为其在 Account 表创建对应账户（若不存在）
    afterCreate: async (assistant, options) => {
      try {
        const t = options.transaction;
        const username = assistant.studentId;
        // 默认密码为学号后6位（若学号长度不足，则使用全学号）
        let initialPwd = username;
        if (username && username.length >= 6) initialPwd = username.slice(-6);
        await Account.create({
          assistantId: assistant.id,
          username,
          password: initialPwd,
          isActive: assistant.status === 'active',
          forceChangePassword: false,
        }, { transaction: t });
      } catch (err) {
        // 不要抛出以免影响主流程，但记录错误以便排查
        console.error('assistantModel.afterCreate sync Account failed:', err);
      }
    },

    // 更新学助时，同步 Account 对应字段（status -> isActive, studentId -> username）
    afterUpdate: async (assistant, options) => {
      try {
        const t = options.transaction;
        const account = await Account.findOne({ where: { assistantId: assistant.id } });
        if (account) {
          const updates = {};
          if (assistant.studentId && assistant.studentId !== account.username) updates.username = assistant.studentId;
          // status: 'active' -> isActive true, 'inactive' -> false
          updates.isActive = assistant.status === 'active';
          if (Object.keys(updates).length > 0) {
            await account.update(updates, { transaction: t });
          }
        } else {
          // 若不存在 account，则创建，使用学号后6位作为默认密码
          const username = assistant.studentId;
          let initialPwd = username;
          if (username && username.length >= 6) initialPwd = username.slice(-6);
          await Account.create({
            assistantId: assistant.id,
            username,
            password: initialPwd,
            isActive: assistant.status === 'active',
            forceChangePassword: false,
          }, { transaction: t });
        }
      } catch (err) {
        console.error('assistantModel.afterUpdate sync Account failed:', err);
      }
    },

    // 学助被删除时，软删除/禁用对应 account（保留数据以便审计）
    afterDestroy: async (assistant, options) => {
      try {
        const t = options.transaction;
        const account = await Account.findOne({ where: { assistantId: assistant.id } });
        if (account) {
          await account.update({ isActive: false }, { transaction: t });
        }
      } catch (err) {
        console.error('assistantModel.afterDestroy sync Account failed:', err);
      }
    },
  },
});

module.exports = Assistant;
