# 客户端接口描述（基于学号登录 /api/user）

本文档说明客户端统一采用学号作为账号的约定，所有客户端相关路由前缀为 `/api/user/`（登录、资料等）。基于代码位置：
- 路由: `src/client/routes/userRoutes.js`
- 学号登录逻辑（会话 + sid）: `src/controllers/authController.js`
- 资料接口: `src/client/controllers/userController.js`

---

## POST /api/user/login

- 描述：学号登录（前端以学号作为账号进行登录），返回 JWT token。前端请求字段为 `studentId` 与 `password`。
- 请求方式：`POST`
- 请求头：`Content-Type: application/json`
- 请求体示例：

```json
{
  "studentId": "2023000005",
  "password": "000005"
}
```

- 成功响应（200）：

```json
{
  "id": "<account-uuid>",
  "username": "2023000005",
  "assistantId": "<assistant-uuid or null>",
  "token": "<jwt-token>"
}
```

说明：返回的 `token` 为 JWT，payload 包含至少 `{ accountId, assistantId, username, sid }`（`sid` 为本次会话 ID，会写入 `accounts.currentSessionId` 用于使旧 token 失效）。服务端会对比 `sid` 与数据库中 `currentSessionId`，不匹配的 token 将被视为已失效。

- 错误响应：
  - 400：缺少 `studentId` 或 `password`。
  - 401：账户不存在、被禁用或密码不正确。
  - 500：服务器错误。

- curl 示例：

```bash
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"studentId":"2023000005","password":"000005"}'
```

---

## GET /api/user/profile

- 描述：获取当前登录账户资料，受保护，需要 `Authorization: Bearer <token>`。
- 请求方式：`GET`
- 请求头：`Authorization: Bearer <token>`

- 成功响应（200）：返回账户对象（不含 `password` 字段）。如果 token 来自学号登录（payload 含 `accountId`），接口会返回 `Account` 记录；若为其他用户类型（包含 `id` 字段），则返回 `User` 资料。

- 错误响应：
  - 401：无 token、token 无效或 token 已失效（sid 不匹配）。
  - 404：未找到对应账户/用户。
  - 500：服务器错误。

- curl 示例：

```bash
curl -X GET http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## 与之前的差异与注意事项

- 前端约定已统一：所有客户端请求前缀改为 `/api/user/`（之前文档中的 `/api/users`、`/api/auth` 的用法已做合并/对齐）。
- 登录字段：前端必须使用 `studentId`（学号）作为登录字段提交到 `/api/user/login`。模型 `accounts.username` 存储学号（字符串）。
- Token payload：包含 `sid`（会话 id），鉴权中间件 `src/common/middleware/authMiddleware.js` 会在 payload 含 `sid` 时校验 `accounts.currentSessionId`，从而实现单会话控制。
- 密码存储：数据库中 `accounts.password` 为哈希值，前端提交明文密码（学号后 6 位为默认/初始密码），服务端使用模型的 `matchPassword` 进行比较。
- 测试账户：可使用 `src/db/seeders/seedAccounts.js` 写入若干测试学号（示例 `2023000001` ~ `2023000005`，密码为学号后 6 位）。

---

维护者：客户端控制器实现者。
