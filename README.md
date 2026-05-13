# 校园考勤系统后端 (Attendance System Backend)

本项目是校园考勤系统的后端部分，采用 Node.js 构建，旨在为前端（Vue 框架）提供稳定、安全的 API 服务。

## 技术栈

- **Runtime**: Node.js (推荐版本: v18.19.0)
- **Framework**: Express.js
- **Database**: MongoDB (ODM: Mongoose)
- **Authentication**: JSON Web Token (JWT)
- **Security**: bcryptjs (密码加密)
- **CORS**: 支持跨域请求，方便与 Vue 前端联调

## 目录结构

```text
attendance-node/
├── src/
│   ├── app.js             # 应用入口及中间件配置
│   ├── config/            # 配置文件 (数据库连接等)
│   ├── controllers/       # 业务逻辑处理层
│   ├── middleware/        # 自定义中间件 (JWT 鉴权等)
│   ├── models/            # 数据库模型 (Mongoose Schemas)
│   ├── routes/            # 路由定义
│   └── utils/             # 工具函数
├── .env                  # 环境变量 (如 JWT_SECRET, DB_URI)
├── .gitignore            # Git 忽略配置
├── package.json          # 项目依赖与脚本
└── README.md             # 项目说明文档
```

## 环境要求

- **Node.js**: v18.19.0 (为保持与前端开发环境一致)
- **MongoDB**: 本地或云端实例

## 快速启动

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **配置环境变量**:
   在根目录创建 `.env` 文件（或编辑现有文件）：
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/attendance_system
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

## API 接口概览

### 用户模块 (`/api/users`)
- `POST /login`: 用户登录，返回 JWT Token。
- `GET /profile`: 获取当前登录用户资料 (需要 Bearer Token 鉴权)。

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
