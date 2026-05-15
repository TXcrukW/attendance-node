/**
 * 一次性数据修复脚本
 * 作用：删除 Accounts 表中 assistantId 已不存在于 Assistants 表的孤立账户记录
 *
 * 使用方式：
 *   node src/scripts/syncOrphanAccounts.js
 *   node src/scripts/syncOrphanAccounts.js --dry-run   # 仅预览，不执行删除
 */

const dotenv = require('dotenv');
dotenv.config();

const { connectDB, sequelize } = require('../config/db');
const Account = require('../db/models/accountModel');
const Assistant = require('../db/models/assistantModel');
const { Op } = require('sequelize');

const isDryRun = process.argv.includes('--dry-run');

async function syncOrphanAccounts() {
  await connectDB();
  try {
    await sequelize.sync();

    // 取所有当前存在的 assistantId
    const assistants = await Assistant.findAll({ attributes: ['id'] });
    const existingIds = assistants.map((a) => a.id);

    // 找出 assistantId 非空但在 Assistants 表中已不存在的 Account
    const orphans = await Account.findAll({
      where: {
        assistantId: {
          [Op.not]: null,
          [Op.notIn]: existingIds.length > 0 ? existingIds : ['__none__'],
        },
      },
    });

    if (orphans.length === 0) {
      console.log('✅ 无孤立账户，数据已一致。');
      process.exit(0);
    }

    console.log(`发现 ${orphans.length} 条孤立账户：`);
    orphans.forEach((acc) => {
      console.log(`  - id=${acc.id}  username=${acc.username}  assistantId=${acc.assistantId}`);
    });

    if (isDryRun) {
      console.log('\n[--dry-run 模式] 未执行删除。去掉 --dry-run 参数后重新运行以正式清理。');
      process.exit(0);
    }

    // 正式删除
    const orphanIds = orphans.map((acc) => acc.id);
    const deleted = await Account.destroy({ where: { id: { [Op.in]: orphanIds } } });
    console.log(`\n✅ 已删除 ${deleted} 条孤立账户。`);
    process.exit(0);
  } catch (err) {
    console.error('syncOrphanAccounts error:', err);
    process.exit(1);
  }
}

syncOrphanAccounts();
