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

## 快速运行

更多客户端接口与示例请查看完整接口文档：[API.md](API.md)。
维护者：客户端控制器实现者。
	- 500：服务器错误。

- curl 示例：

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

## 后续建议

- 已将模块化结构整理为 `src/admin`、`src/client`、`src/db` 与 `src/common`，请以此为主，避免重复模型定义与多处维护同一模型。
- 若计划运行在生产环境，建议使用 `PM2` 或 Windows 服务工具结合 `ecosystem.config.js` 做进程管理与日志收集。

---


