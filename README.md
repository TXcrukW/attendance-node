# 校园考勤系统后端 (Attendance System Backend)

本项目是校园考勤系统的后端部分，采用 Node.js 构建，旨在为前端（Vue 框架）提供稳定、安全的 API 服务。

## API 端点

- **管理后台 API**: [管理后台 API 文档](API.md) — 包含管理员登录（POST /api/admin/login）与获取资料（GET /api/admin/profile）等接口说明、请求示例与响应示例。

你可以在 GitHub 仓库主页直接点击上方链接查看完整端点文档。

## 技术栈

- **Runtime**: Node.js (推荐版本: v18+)
- **Framework**: Express.js
- **ORM**: Sequelize（PostgreSQL）
- **Authentication**: JSON Web Token (JWT)
- **Security**: bcryptjs (密码加密)
- **CORS**: 支持跨域请求，方便与前端联调

## 目录结构（已模块化）

```text
attendance-node/
├── src/
│   ├── app.js                     # 应用入口及中间件配置
│   ├── config/                    # 配置文件 (数据库连接等)
│   ├── modules/                   # 按业务模块划分
│   │   ├── frontend/              # 前端/用户相关业务
│   │   │   ├── controllers/
│   │   │   ├── models/
│   │   │   └── routes/
│   │   └── admin/                 # 管理后台业务
│   │       ├── controllers/
│   │       ├── models/
│   │       └── routes/
│   ├── middleware/                # 公共中间件 (鉴权等)
│   └── utils/                     # 工具函数
├── .env                          # 环境变量 (如 JWT_SECRET, DATABASE_URL)
├── package.json                  # 项目依赖与脚本
└── README.md                     # 项目说明文档
```

## 环境要求

- **Node.js**: v18+（推荐）
- **数据库**: PostgreSQL（也可配置其他 Sequelize 支持的数据库）

## 快速启动

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **配置环境变量**:
   在根目录创建 `.env` 文件（或编辑现有文件）。至少需要以下配置：
   ```env
   PORT=3000
   DATABASE_URL=postgres://user:password@localhost:5432/attendance_db
   JWT_SECRET=your_secret_key
   JWT_EXPIRES_IN=24h
   NODE_ENV=development
   ```

3. **启动项目**:
   - 开发模式 (使用 nodemon 自动重启):
     ```bash
     npm run dev
     ```
   - 生产模式:
     ```bash
     npm start
     ```

4. **快速验证（无前端）**:
   在服务器启动后，访问 `GET /` 应返回服务运行信息；也可访问模块路由：
   - 用户模块: `POST /api/users/login`, `GET /api/users/profile`
   - 管理模块: `POST /api/admin/login`, `GET /api/admin/profile`

## 注意事项

- 本仓库中使用了 Sequelize 与 PostgreSQL（请确保 `DATABASE_URL` 正确），如果你希望使用 SQLite 或其他 DB，请在 `src/config/db.js` 中调整配置。
- 若当前未配置数据库或连接失败，服务器会在启动时打印错误并退出。要仅验证路由结构，可先设置一个可用的 `DATABASE_URL`（或在本地启动 PostgreSQL）。
 
### 守护进程与进程管理（推荐）

为保证后端稳定运行并在崩溃时自动重启，推荐使用进程管理工具。下面给出两个常用方案：

- 使用 `PM2`（跨平台，常用）:
  1. 全局安装（或按需使用项目内安装）:
     ```bash
     npm install -g pm2
     ```
  2. 启动（生产环境）:
     ```bash
     npm run start:pm2
     ```
  3. 查看进程与日志:
     ```bash
     pm2 ls
     pm2 logs attendance-node
     ```
  4. 将 PM2 注册为系统服务以随系统启动（Windows 下可使用 `pm2-startup` 指令或 `pm2 save` + `pm2-startup`，详见 PM2 文档）。

- Windows 服务（可选）:
  - `nssm` 或 `node-windows` 可以将 `node src/app.js` 注册为 Windows 服务并设置自动重启策略。

我已经在仓库添加了 `ecosystem.config.js`（适用于 PM2）和 `package.json` 的 `start:pm2` / `stop:pm2` 脚本。

### 稳定的数据库连接与自动重连

为降低 DB 连接波动导致进程退出的风险，项目已将 `src/config/db.js` 增强为：

- 初始连接尝试带有重试（默认 5 次，每次间隔 5s）；
- 初始重试失败后会启动后台循环继续尝试重连，避免直接 `process.exit`，从而保证进程在数据库短暂不可用时仍保持运行并在 DB 恢复后自动连接。

如果你希望服务在数据库不可用时不接收请求，可以把启动服务器逻辑改为在首次成功连接后再启动（我也可以帮你修改）。

## 鉴权说明
受保护的路由需要在 HTTP 请求头中添加以下信息：
```text
Authorization: Bearer <your_jwt_token_here>
```

## 后续迭代计划
- [ ] 考勤统计功能
- [ ] 课程表同步与展示
- [ ] 请假申请审批流
- [ ] 实时点名推送功能
