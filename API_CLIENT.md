# 客户端 API 文档（/api/user + /api/attendance）

最后核验：2026-05-18（基于当前代码）

> 本文档仅描述客户端（学助端）接口。管理后台接口请查看 `API.md`。

## 1. 通用说明

### 1.1 接口范围

- 认证与资料：`/api/user/*`
- 考勤功能：`/api/attendance/*`
- 学助资料（客户端可用）：`/api/assistants/:id`、`/api/assistants/me`

### 1.2 鉴权

- 受保护接口统一使用：`Authorization: Bearer <token>`
- 学助登录 token payload 含：`{ accountId, assistantId, username, sid }`
- 服务端校验 `sid` 与 `Account.currentSessionId`，旧 token 自动失效。

### 1.3 错误码约定

- `400` 参数错误
- `401` 未认证或 token 失效
- `403` 非学助账号或无 `assistantId`
- `404` 资源不存在
- `409` 状态冲突（重复打卡、无进行中班次）
- `410` 通知过期
- `500` 服务器错误

---

## 2. 认证接口（/api/user）

### 2.1 `POST /api/user/login`

- 功能描述：学助使用学号和密码登录，换取 JWT token。
- 使用场景：客户端登录页。
- 鉴权：无需。

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `studentId` | string | 是 | 学号（对应账户 username） |
| `password` | string | 是 | 登录密码 |

成功响应（200）：

```json
{
  "id": "account-uuid",
  "username": "2023000005",
  "assistantId": "assistant-uuid",
  "token": "jwt"
}
```

响应字段说明：

| 字段 | 说明 |
|---|---|
| `id` | 账户 ID |
| `username` | 学号 |
| `assistantId` | 关联学助 ID（无关联时可能为 null） |
| `token` | 客户端后续请求的 Bearer Token |

错误码：`400`、`401`、`500`

### 2.3 `POST /api/user/logout`

- 功能描述：学助登出，撤销当前会话使已签发的 token 失效。
- 使用场景：客户端点击“退出登录”。
- 鉴权：需要学助 token（Bearer）。

请求参数：无。

成功响应（200）：

```json
{ "message": "已登出" }
```

说明：该接口会将 `Account.currentSessionId` 清空，配合服务器端的 `sid` 校验逻辑使当前及旧的含 `sid` 的 JWT 失效。客户端在收到成功响应后应清除本地 token（localStorage / cookie / IndexedDB 等），并跳转到登录页。

错误码：`401`（未授权或 token 无效）、`403`（无权限）、`500`（服务器错误）

### 2.2 `GET /api/user/profile`

- 功能描述：获取当前登录账户信息。
- 使用场景：个人中心初始化。
- 鉴权：需要学助 token。

请求参数：无。

成功响应（200）：返回账户信息（不含密码）。

错误码：`401`、`404`、`500`

---

## 3. 考勤接口（/api/attendance）

> 所有接口都要求 token 中有 `assistantId`，否则返回 `403`。

### 3.1 `POST /api/attendance/punch`

- 功能描述：上班/下班打卡。
- 使用场景：客户端点击“上班打卡”“下班打卡”。
- 鉴权：需要学助 token。

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | string | 是 | `IN`（上班）或 `OUT`（下班） |
| `source` | string | 否 | 打卡来源，默认 `app` |

请求体示例：

```json
{ "type": "IN", "source": "web" }
```

```json
{ "type": "OUT", "source": "web" }
```

成功响应：

- `IN` 成功（201）示例：

```json
{
  "message": "上班打卡成功（下午班）",
  "sessionId": "uuid",
  "shiftType": "afternoon",
  "shiftLabel": "下午班",
  "startTime": "2026-05-18T08:00:00.000Z",
  "expectedEndAt": "18:00",
  "status": "open"
}
```

- `OUT` 成功（200）示例：

```json
{
  "message": "下班打卡成功",
  "sessionId": "uuid",
  "shiftLabel": "下午班",
  "startTime": "2026-05-18T08:00:00.000Z",
  "endTime": "2026-05-18T12:00:00.000Z",
  "durationMinutes": 240,
  "hours": "4.00",
  "status": "closed"
}
```

错误码：`400`、`403`、`409`、`500`

### 3.2 `GET /api/attendance/status`

- 功能描述：获取当前考勤状态快照。
- 使用场景：页面轮询（建议每 60 秒），判断是否弹出加班确认提醒。
- 鉴权：需要学助 token。

请求参数：无。

成功响应（200）示例：

```json
{
  "openSession": {
    "id": "uuid",
    "shiftType": "afternoon",
    "startTime": "2026-05-18T08:00:00.000Z",
    "status": "open"
  },
  "pendingReminder": {
    "sessionId": "uuid",
    "shiftType": "afternoon",
    "shiftLabel": "下午班",
    "restTime": "18:00",
    "startTime": "2026-05-18T08:00:00.000Z",
    "message": "您的下午班已到休息时间（18:00），请确认：是否仍在加班？"
  },
  "todaySessions": [],
  "serverTime": "2026-05-18T10:05:00.000Z"
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `openSession` | 当前进行中班次，无则 `null` |
| `pendingReminder` | 是否应弹“是否仍在加班”提醒，无则 `null` |
| `todaySessions` | 今日会话列表 |
| `serverTime` | 服务器当前时间 |

错误码：`403`、`500`

### 3.3 `GET /api/attendance/sessions`

- 功能描述：分页查询我的考勤记录。
- 使用场景：客户端“历史记录”页面。
- 鉴权：需要学助 token。

查询参数：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `from` | string | 否 | 起始日期 `YYYY-MM-DD` |
| `to` | string | 否 | 结束日期 `YYYY-MM-DD` |
| `status` | string | 否 | 会话状态过滤 |
| `page` | number | 否 | 页码，默认 `1` |
| `limit` | number | 否 | 每页条数，默认 `20` |

状态枚举：`open|closed|auto_closed|pending_confirm|corrected`

成功响应（200）示例：

```json
{
  "data": [
    {
      "id": "uuid",
      "date": "2026-05-18",
      "shiftType": "morning",
      "shiftLabel": "上午班",
      "startTime": "2026-05-18T01:10:00.000Z",
      "endTime": "2026-05-18T04:10:00.000Z",
      "durationMinutes": 180,
      "hours": "3.00",
      "status": "closed"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

错误码：`403`、`500`

### 3.4 `GET /api/attendance/summary`

- 功能描述：查询我的工时汇总。
- 使用场景：客户端“工时统计”页面。
- 鉴权：需要学助 token。

查询参数：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `from` | string | 否 | 起始日期 `YYYY-MM-DD` |
| `to` | string | 否 | 结束日期 `YYYY-MM-DD` |

统计范围：仅 `closed|auto_closed|corrected`。

成功响应（200）字段：

| 字段 | 说明 |
|---|---|
| `totalMinutes` | 总分钟数 |
| `totalHours` | 总小时数（两位小数） |
| `sessionCount` | 班次数 |
| `autoClosedCount` | 自动收口次数 |
| `hasUnconfirmed` | 是否存在自动收口 |
| `unconfirmedTip` | 提示文案（无异常时为 null） |
| `byDate` | 按天汇总 |

错误码：`403`、`500`

### 3.5 `GET /api/attendance/shift-notice`

- 功能描述：轮询管理员通知。
- 使用场景：客户端每 10 秒轮询一次，有通知则弹窗。
- 鉴权：需要学助 token。

请求参数：无。

成功响应：

- 无通知：

```json
{ "notice": null }
```

- 有通知：

```json
{
  "notice": {
    "id": "uuid",
    "action": "clock_out",
    "actionLabel": "下班",
    "expiresAt": "2026-05-18T10:00:00.000Z",
    "createdAt": "2026-05-18T09:55:00.000Z",
    "secondsLeft": 180
  }
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `id` | 通知 ID，响应时必传 |
| `action` | `clock_in` / `clock_out` |
| `actionLabel` | 中文动作名 |
| `secondsLeft` | 剩余秒数 |

错误码：`403`、`500`

### 3.6 `POST /api/attendance/shift-notice/respond`

- 功能描述：学助确认或拒绝管理员通知。
- 使用场景：弹窗点击“确认”或“拒绝”。
- 鉴权：需要学助 token。

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `notificationId` | string | 是 | 通知 ID |
| `response` | string | 是 | `confirmed` / `declined` |

请求体示例：

```json
{ "notificationId": "uuid", "response": "confirmed" }
```

成功响应：

- 确认上班（200）：返回 `sessionId`、`shiftLabel`、`startTime`
- 确认下班（200）：返回 `durationMinutes`、`hours` 等
- 拒绝（200）：

```json
{ "message": "已拒绝", "status": "declined" }
```

错误码：`400`、`403`、`404`、`409`、`410`、`500`

---

## 4. 学助资料接口（/api/assistants）

### 4.1 `GET /api/assistants/:id`

- 功能描述：获取指定学助详情。
- 使用场景：客户端个人资料展示。
- 鉴权：需要 token。

路径参数：

| 字段 | 说明 |
|---|---|
| `id` | 学助 ID |

成功响应（200）：返回学助对象（含 `studentId`、`name`、`position`、`isOnShift`、`status`、`phone`、`hourlyRate`、`totalHours`、`notes`）。

错误码：`401`、`404`、`500`

### 4.2 `PUT /api/assistants/me`

- 功能描述：学助本人更新手机号与密码。
- 使用场景：客户端“修改手机号/修改密码”。
- 鉴权：需要学助 token（必须带 `assistantId`）。

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `phone` | string | 否 | 新手机号 |
| `currentPassword` | string | 条件必填 | 修改密码时必填 |
| `newPassword` | string | 否 | 新密码 |

请求体示例：

```json
{ "phone": "13899998888" }
```

```json
{ "currentPassword": "旧密码", "newPassword": "新密码123" }
```

成功响应（200）：

```json
{ "message": "更新成功", "phone": "13899998888" }
```

错误码：`400`、`401`、`403`、`404`、`500`

---

## 5. 客户端集成建议

- 登录成功后保存 `token`，所有受保护接口统一加 `Authorization`。
- `status` 建议每 60 秒轮询。
- `shift-notice` 建议每 10 秒轮询；弹窗后调用 `shift-notice/respond`。
- 收到 `401`（token 失效）时应清理本地会话并重新登录。

---

## 6. 已核验差异说明

- 客户端文档仅保留客户端实际使用接口，不再混入管理后台接口。
- 管理后台接口说明已统一迁移到 `API.md`。
