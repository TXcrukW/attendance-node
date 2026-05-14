# 管理后台 API 文档

本文档记录管理后台相关的 API（用于开发者参考）。

## 登录 — POST /api/admin/login

- 描述：管理员使用用户名和密码登录，成功后返回 JWT 访问令牌。
- 请求地址：`POST /api/admin/login`
- 请求头：`Content-Type: application/json`
- 请求体（JSON）：

```
{
  "username": "admin 用户名",
  "password": "admin 密码"
}
```

- 返回：
  - 成功（200）

```
{
  "status": "success",
  "id": "管理员 id",
  "username": "管理员用户名",
  "role": "admin",
  "token": "<JWT_TOKEN>"
}
```

  - 请求参数缺失（400）

```
{
  "message": "用户名和密码为必填项"
}
```

  - 认证失败（401）

```
{
  "message": "用户名或密码无效"
}
```

  - 服务器错误（500）

```
{
  "message": "服务器错误",
  "error": "错误详情"
}
```

## 获取管理员资料 — GET /api/admin/profile

- 描述：获取当前登录管理员的资料，需要在请求头中携带 Bearer Token。
- 请求地址：`GET /api/admin/profile`
- 请求头：

```
Authorization: Bearer <JWT_TOKEN>
```

- 返回：
  - 成功（200）返回管理员信息（不含密码）
  - 未授权或 Token 无效（401）
  - 未找到管理员（404）

## 认证与 Token

- 登录成功后返回的 `token` 为 JWT，需要在后续受保护接口中通过 `Authorization: Bearer <token>` 方式携带。
- 环境变量：
  - `JWT_SECRET`：用于签名的密钥
  - `JWT_EXPIRES_IN`：Token 过期时间（如 `1d`, `7d` 等）

## 注意事项

- 登录接口只接受 `username` 与 `password` 两个字段。为空时会返回 400。
- 密码在模型保存时会被 `bcrypt` 加密。
- 若需要支持更多管理员字段或额外登录策略（如多因子），请在本模块中扩展。

## 示例：完整流程

- 登录并获取 token：

```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

成功响应示例：

```json
{
  "status": "success",
  "id": "...",
  "username": "admin",
  "role": "admin",
  "token": "<JWT_TOKEN>"
}
```

- 使用 token 访问受保护接口：

```bash
curl -X GET http://localhost:3000/api/admin/profile \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

若 token 无效或未提供，请求将返回 401 未授权。

## 学助管理（Assistants）

所有学助管理接口均需在请求头中携带 `Authorization: Bearer <JWT_TOKEN>`。

### 列表 — GET /api/assistants
- 描述：分页获取学助列表，支持搜索和状态过滤。
- 请求示例：`GET /api/assistants?search=张&page=1&limit=10&status=active`
- 返回（200）：

```json
{
  "data": [
    {
      "id": "...",
      "studentId": "2021001",
      "name": "张三",
      "position": "图书助理",
      "isOnDuty": true,
      "status": "active",
      "phone": "13800138001",
      "email": "zhangsan@campus.edu",
      "hourlyRate": "15.00",
      "totalHours": "6.00"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 10
}
```

### 详情 — GET /api/assistants/:id
- 描述：获取单个学助详情（含聚合的 `totalHours` 字段）。

### 新建 — POST /api/assistants
- 请求头：`Authorization: Bearer <JWT_TOKEN>`
- 请求体（JSON）：

```json
{
  "studentId": "2021006",
  "name": "周八",
  "position": "活动助理",
  "hourlyRate": 16,
  "isOnDuty": true,
  "phone": "13800138006",
  "email": "zhoub@campus.edu"
}
```

### 更新 — PUT /api/assistants/:id
- 描述：更新学助字段（可传任意可更新字段）。

### 删除 — DELETE /api/assistants/:id

### 设置在岗状态 — POST /api/assistants/:id/status
- 描述：设置 `isOnDuty`（上班/下班）状态。
- 请求体：`{ "isOnDuty": true }`

### 批量导入 — POST /api/assistants/import
- 描述：接收 JSON 数组（或后续可扩展为 CSV 上传），对已有学号进行更新或创建新记录。

### 时间日志
- 列表：GET `/api/assistants/:assistantId/timelogs`
- 创建：POST `/api/assistants/:assistantId/timelogs` body `{ date, hours, remark }`

### 统计 — GET /api/assistants/stats
- 描述：返回统计数据：`total`、`active`、`inactive`、`totalHours`。

---

说明：前端表格可按下列字段渲染（红框从左到右）：`studentId`、`name`、`position`、`isOnDuty`（渲染为“上班/下班”）、`phone`、操作按钮（编辑/设为离岗/重置密码等）。
