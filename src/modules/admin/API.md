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
