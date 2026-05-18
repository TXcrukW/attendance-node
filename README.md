# 校园考勤系统后端

后端项目为校园考勤系统提供 RESTful API 与认证授权服务，基于 Node.js + Express + Sequelize 开发。

## 概览

- 入口：`src/app.js` — 应用初始化、路由挂载与中间件配置。
- 配置：`src/config/db.js` — 数据库连接（Sequelize）与重连策略。
- 权限与鉴权：`src/common/middleware/authMiddleware.js` — JWT 验证与权限守卫。

## 各模块与文件说明（简要）

- `src/app.js`：应用主入口，配置中间件（bodyParser、CORS、日志）、全局错误处理，并挂载各模块路由。
- `src/config/db.js`：Sequelize 数据库配置、连接初始化与重试/重连逻辑，封装导出供模型使用。


- 控制器（主要入口）：`src/app.js` 挂载以下路由与控制器。

- 管理后台（Admin）：
	- `src/admin/controllers/*` — 管理后台控制器（管理员登录、管理操作）。
	- `src/admin/models/*` — 管理后台专用模型（如 `adminUserModel.js`）。
	- `src/admin/routes/*` — 管理后台路由（通常挂载到 `/api/admin`）。

- 客户端/前端业务（Client）：
	- `src/client/controllers/*` — 面向客户端的控制器（用户、学助相关接口）。
	- `src/client/routes/*` — 客户端路由（例如 `/api/users`）。

- 数据与模型层（DB）：
	- `src/db/models/*` — 所有 Sequelize 模型集中管理（`assistantModel.js`、`accountModel.js`、`userModel.js`、`assistantTimeLog.js` 等）。
	- `src/db/seeders/*` — 数据填充脚本（种子）。

- 公共/共享组件（Common）：
	- `src/common/middleware/*` — 公共中间件（如 `authMiddleware.js`）。
	- `src/common/utils/*` — 工具函数与导入解析（如 `excelParser.js`、`validators.js`）。
	- `src/common/controllers/*` — 可复用的控制器（如 `authController.js` 已迁移至此）。

- `src/scripts/seedAdmin.js` / `src/scripts/seedAssistants.js`：数据种子脚本，用于快速创建初始管理员账号或助教测试数据（已更新以使用 `src/db/models` 或 `src/admin/models`）。

## 数据库表结构说明

数据库共 6 张表，各表用途如下：

| 表名 | 对应模型文件 | 用途 | 状态 |
|------|------------|------|------|
| `Accounts` | `src/db/models/accountModel.js` | **学助登录账户表**。存储学助的登录凭据（`username` = 学号、密码哈希）、账户激活状态（`isActive`）、当前会话 ID（`currentSessionId`，用于单点登录踢出旧 token）。与 `Assistants` 表通过 `assistantId` 外键关联，创建学助时自动生成对应账户，默认密码为学号后 6 位。 | ✅ 活跃使用 |
| `AdminUsers` | `src/admin/models/adminUserModel.js` | **管理员账户表**。存储管理后台账号的登录凭据（用户名、密码哈希）、角色（固定为 `admin`）、当前会话 ID。专用于管理后台 `/api/admin` 路由的身份认证。 | ✅ 活跃使用 |
| `Assistants` | `src/db/models/assistantModel.js` | **学助基础信息表（核心主表）**。存储学助的学号（`studentId`）、姓名、时薪（`hourlyRate`）、职位（`position`）、在班状态（`isOnShift`）、账户状态（`active` / `inactive`）、手机号、备注等。是整个考勤系统的核心实体，`PunchRecords`、`WorkSessions`、`AssistantTimeLogs` 均以此表为外键。 | ✅ 活跃使用 |
| `PunchRecords` | `src/db/models/punchRecord.js` | **原始打卡记录表（不可变日志）**。每次上班（`IN`）或下班（`OUT`）打卡写入一条记录，包含打卡时间（`punchTime`）、来源（`source`，如 app/web）、客户端 IP。作为审计依据，数据不可删改，工时计算由 `WorkSessions` 负责。 | ✅ 活跃使用 |
| `WorkSessions` | `src/db/models/workSession.js` | **工作区间表（配对后的班次记录）**。将 `PunchRecords` 中的 IN/OUT 打卡配对后生成，存储班次类型（`morning` / `afternoon` / `evening` / `other`）、开始/结束时间、工时分钟数（`durationMinutes`）、状态（`open` → `closed` / `auto_closed` / `corrected`）等。支持管理员人工纠正，纠正备注存入 `correctionNote`。 | ✅ 活跃使用 |
| `AssistantTimeLogs` | `src/db/models/assistantTimeLog.js` | **学助工时日志表（手动录入）**。按日期记录每位学助的工时小时数（`hours`）与备注（`remark`），用于统计汇总总工时。与 `Assistants` 表通过 `assistantId` 关联。 | ✅ 活跃使用 |

> **注意**：原系统曾有 `Users` 表（存储 student/teacher/admin 三种角色），已于重构时废弃并删除。学助登录账户统一由 `Accounts` 表管理，管理员账户由 `AdminUsers` 表管理。

---

## 安装与运行（快速开始）

简要说明如何快速在本地或服务器上启动后台服务，尽量减少可配置项导致的问题。

- 前提：已安装 Node.js（建议 16+）与 npm/yarn；可用的数据库（MySQL / PostgreSQL / SQLite）。

1) 依赖安装

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

2) 环境变量（在项目根目录创建 `.env`，项目已提供 `.env.example` 可复制为 `.env` 并根据环境修改）

最小必需变量示例：

```
PORT=3000
NODE_ENV=development
DB_DIALECT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=attendance_db
DB_USER=root
DB_PASSWORD=yourpassword
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=7d
LOG_LEVEL=info
```

- 说明：如果使用 PostgreSQL，把 `DB_DIALECT=postgres` 并修改 `DB_PORT`（通常为 5432）；使用 SQLite 可把 `DB_DIALECT=sqlite` 并在 `DB_NAME` 中写入文件路径（或使用默认配置）。

3) 数据库准备

- 在数据库管理工具中创建数据库（例如 `attendance_db`）。
- 如果项目包含 Sequelize 迁移脚本（见 `src/db/migrations/`），建议使用 Sequelize CLI 执行迁移：

```bash
# 全局或 npx 方式运行迁移（在项目根目录）
npx sequelize db:migrate
```

- 如果未使用迁移，项目通常也会在启动时通过 Sequelize `sync()` 自动创建表（取决于 `src/config/db.js` 的配置）。首次启动前请检查 `src/config/db.js` 的 `sync` 或 `force` 设置以避免误删数据。

4) 数据种子（可选，用于测试）

```bash
# 示例：创建管理员账号
node src/scripts/seedAdmin.js

# 写入示例学助数据（会清空相关表，请仅在测试环境使用）
node src/scripts/seedAssistants.js
node src/scripts/seedAttendance.js
```

5) 启动服务

```bash
# 开发（带热重载可选，若使用 nodemon）
npm run dev

# 或生产
npm start
```

6) 常见问题和注意事项

- 如果连接失败，先确认 `.env` 中 `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD` 是否正确，数据库是否允许本地连接。
- 若使用 MySQL 且遇到认证插件问题，请确保 MySQL 用户使用兼容的身份验证插件。
- 如果迁移失败但模型存在，检查 `src/db/models` 与 `src/config/db.js` 的配置是否匹配。

---

## 快速运行

更多文档：

- **客户端 API 文档（前端/学助客户端使用）**：[API_CLIENT.md](API_CLIENT.md) — 包含学号登录、考勤打卡、考勤状态与班次接口说明与示例。
- **管理后台 API 文档（管理员/运维使用）**：[API_ADMIN.md](API_ADMIN.md) — 包含学助管理、导入、手动上/下班接口与运维脚本说明。

示例：

```bash
curl -X GET http://localhost:3000/api/user/profile \
	-H "Authorization: Bearer <your-jwt-token>"
```

---

### 与之前的差异与注意事项

- 前端约定已统一：所有客户端请求前缀改为 `/api/user/`（之前文档中的 `/api/users`、`/api/auth` 的用法已做合并/对齐）。
- 登录字段：前端必须使用 `studentId`（学号）作为登录字段提交到 `/api/user/login`。模型 `accounts.username` 存储学号（字符串）。
- Token payload：包含 `sid`（会话 id），鉴权中间件 `src/common/middleware/authMiddleware.js` 会在 payload 含 `sid` 时校验 `accounts.currentSessionId`，从而实现单会话控制。
- 密码存储：数据库中 `accounts.password` 为哈希值，前端提交明文密码（学号后 6 位为默认/初始密码），服务端使用模型的 `matchPassword` 进行比较。
- 测试账户：可使用 `src/db/seeders/seedAccounts.js` 写入若干测试学号（示例 `2023000001` ~ `2023000005`，密码为学号后 6 位）。

---

维护者：客户端控制器实现者。

## 运维脚本说明

以下脚本均位于 `src/scripts/`，通过 `node src/scripts/<文件名>` 执行。

| 脚本 | 用途 | 注意事项 |
|------|------|----------|
| `seedAdmin.js` | 初始化管理员账号（`useradmin` + `admin1`~`admin5`，统一密码 `admin123456`）。已存在的账号自动跳过，可重复执行。 | 仅首次部署或账号丢失时使用 |
| `seedAssistants.js` | 写入**测试用**学助数据及工时日志（5 名虚拟学助）。 | ⚠️ 会先清空 `Assistants` 与 `AssistantTimeLogs` 表，勿在生产环境执行 |
| `seedAttendance.js` | 写入**测试用**打卡记录与工作区间。需先执行 `seedAssistants.js`。 | ⚠️ 会清空目标学助的 `PunchRecords` 与 `WorkSessions`，勿在生产环境执行 |
| `clearAllData.js` | **清空所有业务数据**：按顺序删除 `AssistantTimeLogs` → `WorkSessions` → `PunchRecords` → `Accounts` → `Assistants`，`AdminUsers` 表保留不变。 | ⛔ **谨慎使用，操作不可逆**。仅在需要彻底重置数据库（如从测试切换到生产）时执行 |
| `syncOrphanAccounts.js` | 检测并修复没有对应 `Accounts` 记录的学助（孤儿数据同步）。 | 可在数据异常时执行，不删除数据 |

---

## 后续建议

- 已将模块化结构整理为 `src/admin`、`src/client`、`src/db` 与 `src/common`，请以此为主，避免重复模型定义与多处维护同一模型。
- 若计划运行在生产环境，建议使用 `PM2` 或 Windows 服务工具结合 `ecosystem.config.js` 做进程管理与日志收集。

---


