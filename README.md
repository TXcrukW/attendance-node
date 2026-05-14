# 校园考勤系统后端

后端项目为校园考勤系统提供 RESTful API 与认证授权服务，基于 Node.js + Express + Sequelize 开发。

## 概览

- 入口：`src/app.js` — 应用初始化、路由挂载与中间件配置。
- 配置：`src/config/db.js` — 数据库连接（Sequelize）与重连策略。
- 权限与鉴权：`src/middleware/authMiddleware.js` — JWT 验证与权限守卫。

## 各模块与文件说明（简要）

- `src/app.js`：应用主入口，配置中间件（bodyParser、CORS、日志）、全局错误处理，并挂载各模块路由。
- `src/config/db.js`：Sequelize 数据库配置、连接初始化与重试/重连逻辑，封装导出供模型使用。

- `src/controllers/assistantController.js`：助教/考勤助手相关的请求处理逻辑（如注册、状态查询等接口）。
- `src/controllers/userController.js`：通用用户相关控制器（用户登录、获取资料等），供顶层或模块路由使用。

- `src/middleware/authMiddleware.js`：解析 `Authorization` 头、验证 JWT、在请求中注入用户信息并控制受保护路由访问。

- `src/models/assistantModel.js`：助教/设备等主体的数据模型定义（Sequelize model）。
- `src/models/assistantTimeLog.js`：记录助教或设备时间线/打卡记录的模型（考勤日志）。
- `src/models/userModel.js`：用户（学生/教师/管理员）数据模型，包含认证字段与权限字段。

- `src/routes/assistantRoutes.js`：助教相关路由定义，映射到 `assistantController`。
- `src/routes/userRoutes.js`：用户模块路由（登录、个人信息、前端用户功能等）。

- `src/modules/admin/controllers/adminController.js`：管理后台业务控制器（管理员登录、统计、管理操作）。
- `src/modules/admin/models/adminUserModel.js`：管理员用户模型，存储管理员账户与权限。
- `src/modules/admin/routes/adminRoutes.js`：管理后台专属路由集合，通常挂载到 `/api/admin` 前缀下。

- `src/modules/frontend/controllers/userController.js`：面向前端的用户业务（前端页面所需的接口适配层）。
- `src/modules/frontend/models/userModel.js`：若前端模块有自己扩展的用户数据结构，会放在这里（与全局 `userModel` 可互补或共享）。
- `src/modules/frontend/routes/userRoutes.js`：前端用户相关路由（挂载点可为 `/api/users` 或前端约定的前缀）。

- `src/scripts/seedAdmin.js` / `src/scripts/seedAssistants.js`：数据种子脚本，用于快速创建初始管理员账号或助教测试数据。

## 快速运行

1. 安装依赖：
```
npm install
```
2. 配置 `.env`（示例）：
```
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/attendance_db
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h
NODE_ENV=development
```
3. 启动：
```
npm run dev
```

## 常见路由（示例）

- 管理员登录：`POST /api/admin/login`
- 管理员信息：`GET /api/admin/profile`
- 用户登录：`POST /api/users/login`
- 用户信息：`GET /api/users/profile`

（具体接口与请求/响应格式参见 `API.md`）

## 后续建议

- 根据需用将 `src/modules/frontend` 与顶层 `controllers` / `models` 做进一步分离或合并，避免重复模型定义。
- 若计划运行在生产环境，建议使用 `PM2` 或 Windows 服务工具结合 `ecosystem.config.js` 做进程管理与日志收集。

---

如果你希望我把 README 扩展为英文版、或把每个接口逐一列出（从 `API.md` 自动同步），我可以继续帮你生成。
