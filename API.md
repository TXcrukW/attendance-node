# 管理后台 API 文档（仅管理端）

最后核验：2026-05-18（基于当前代码）

> 客户端接口请查看 `API_CLIENT.md`。本文档仅包含管理后台使用的接口。

## 1. 通用说明

### 1.1 基础信息

- 管理端前缀：`/api/admin`
- 学助管理前缀：`/api/assistants`
- 数据格式：`application/json`

### 1.2 鉴权

- 受保护接口统一使用：`Authorization: Bearer <admin_token>`
- 管理员登录 token payload：`{ id, sid }`
- 服务端会校验 `sid` 与数据库 `AdminUser.currentSessionId`，旧 token 自动失效。

### 1.3 错误码约定

- `400` 参数错误
- `401` 未认证或 token 失效
- `403` 无权限（非管理员）
- `404` 资源不存在
- `409` 状态冲突
- `410` 通知过期
- `500` 服务器错误

---

## 2. 管理员认证与运维（/api/admin）

### 2.1 `POST /api/admin/login`

- 功能描述：管理员登录并获取访问 token。
- 使用场景：管理后台登录页提交用户名密码。
- 鉴权：无需。

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `username` | string | 是 | 管理员用户名 |
| `password` | string | 是 | 管理员密码 |

成功响应（200）：

```json
{
  "status": "success",
  "id": "uuid",
  "username": "admin",
  "role": "admin",
  "token": "jwt"
}
```

响应字段说明：

| 字段 | 说明 |
|---|---|
| `status` | 固定为 `success` |
| `id` | 管理员 ID |
| `username` | 管理员用户名 |
| `role` | 当前为 `admin` |
| `token` | 后续接口调用的 Bearer Token |

错误码：`400`、`401`、`500`

### 2.2 `GET /api/admin/profile`

- 功能描述：获取当前登录管理员资料。
- 使用场景：后台页面初始化时展示当前管理员信息。
- 鉴权：需要管理员 token。

请求参数：无。

成功响应（200）：返回管理员对象（不含密码）。

常见错误码：`401`、`403`、`404`、`500`

### 2.3 `POST /api/admin/sync-accounts`

- 功能描述：清理 `Accounts` 表中失联学助账户（`assistantId` 已不存在）。
- 使用场景：运维修复脏数据、后台误删后的数据对齐。
- 鉴权：需要管理员 token。

请求参数：无。

成功响应（200）示例：

```json
{
  "message": "同步完成，已删除 2 条孤立账户",
  "deleted": 2,
  "accounts": [
    { "id": "uuid", "username": "20230001", "assistantId": "uuid" }
  ]
}
```

响应字段说明：

| 字段 | 说明 |
|---|---|
| `message` | 同步结果描述 |
| `deleted` | 删除数量 |
| `accounts` | 被删除账户列表 |

错误码：`401`、`403`、`500`

---

## 3. 管理端考勤（/api/admin/attendance）

### 3.1 `GET /api/admin/attendance/online`

- 功能描述：获取当前在班看板快照。
- 使用场景：管理后台“当前在班”列表展示。
- 鉴权：需要管理员 token。

查询参数：无。

成功响应（200）示例：

```json
{
  "data": [
    {
      "sessionId": "uuid",
      "assistantId": "uuid",
      "name": "张三",
      "studentId": "20230001",
      "position": "一级岗",
      "date": "2026-05-18",
      "shiftType": "afternoon",
      "shiftLabel": "下午班",
      "startTime": "2026-05-18T08:00:00.000Z",
      "onlineMinutes": 90,
      "status": "open"
    }
  ],
  "total": 1,
  "serverTime": "2026-05-18T09:30:00.000Z"
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `data` | 在班会话列表（`open/pending_confirm`） |
| `total` | 在班人数 |
| `serverTime` | 服务器时间 |

错误码：`401`、`403`、`500`

### 3.2 `GET /api/admin/attendance/online/stream`

- 功能描述：通过 SSE 持续推送在班快照。
- 使用场景：看板实时刷新，减少轮询压力。
- 鉴权：需要管理员 token。

请求参数：无。

推送说明：

| 项目 | 说明 |
|---|---|
| 首次连接 | 立即推送一次快照 |
| 心跳/定时 | 每 30 秒推送一次 |
| 事件触发 | 打卡、通知响应后会立即推送 |

推送事件名：`online`

错误码：`401`、`403`

### 3.3 `GET /api/admin/attendance/sessions`

- 功能描述：分页查询全局班次记录。
- 使用场景：管理端考勤流水查询页。
- 鉴权：需要管理员 token。

查询参数：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `assistantId` | string | 否 | 指定学助 |
| `from` | string | 否 | 起始日期 `YYYY-MM-DD` |
| `to` | string | 否 | 结束日期 `YYYY-MM-DD` |
| `status` | string | 否 | 班次状态过滤 |
| `search` | string | 否 | 按学号/姓名模糊搜索 |
| `page` | number | 否 | 页码，默认 `1` |
| `limit` | number | 否 | 每页条数，默认 `20` |

成功响应（200）：

```json
{
  "data": [
    {
      "id": "uuid",
      "assistantId": "uuid",
      "date": "2026-05-18",
      "shiftType": "morning",
      "shiftLabel": "上午班",
      "durationMinutes": 180,
      "hours": "3.00",
      "status": "closed",
      "Assistant": {
        "id": "uuid",
        "name": "张三",
        "studentId": "20230001",
        "position": "一级岗"
      }
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

错误码：`401`、`403`、`500`

### 3.4 `GET /api/admin/attendance/pending`

- 功能描述：查询待审核异常会话。
- 使用场景：管理端异常处理列表。
- 鉴权：需要管理员 token。

查询参数：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `page` | number | 否 | 页码，默认 `1` |
| `limit` | number | 否 | 每页条数，默认 `20` |

成功响应（200）：返回 `status in (auto_closed, pending_confirm, open)` 的会话。

补充字段：

| 字段 | 说明 |
|---|---|
| `statusTip` | 状态中文提示，便于前端直接展示 |

错误码：`401`、`403`、`500`

### 3.5 `GET /api/admin/attendance/report`

- 功能描述：按学助维度查询工时报表。
- 使用场景：工时统计、薪资估算页面。
- 鉴权：需要管理员 token。

查询参数：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `from` | string | 否 | 统计起始日期 |
| `to` | string | 否 | 统计结束日期 |
| `page` | number | 否 | 页码，默认 `1` |
| `limit` | number | 否 | 每页条数，默认 `50` |

成功响应（200）字段：

| 字段 | 说明 |
|---|---|
| `id/studentId/name/position` | 学助基本信息 |
| `hourlyRate` | 时薪字符串 |
| `totalMinutes/totalHours` | 工时统计 |
| `estimatedWage` | 估算工资 |
| `autoClosedCount` | 自动收口数量 |
| `hasAnomalies` | 是否存在异常 |

错误码：`401`、`403`、`500`

### 3.6 `GET /api/admin/attendance/assistants/:id/sessions`

- 功能描述：查询单个学助的班次明细。
- 使用场景：学助详情页查看历史班次。
- 鉴权：需要管理员 token。

路径参数：

| 字段 | 说明 |
|---|---|
| `id` | 学助 ID |

查询参数：`from`、`to`、`status`、`page`、`limit`

成功响应（200）：

```json
{
  "assistant": {
    "id": "uuid",
    "name": "张三",
    "studentId": "20230001",
    "position": "一级岗",
    "hourlyRate": "15.00"
  },
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

错误码：`401`、`403`、`404`、`500`

### 3.7 `GET /api/admin/attendance/assistants/:id/summary`

- 功能描述：查询单个学助工时汇总（含按日明细）。
- 使用场景：核算某学助的工时与估算工资。
- 鉴权：需要管理员 token。

路径参数：`id`（学助 ID）

查询参数：`from`、`to`

成功响应（200）关键字段：

| 字段 | 说明 |
|---|---|
| `assistant` | 学助信息 |
| `totalMinutes/totalHours` | 总工时 |
| `estimatedWage` | 估算工资（不含 `auto_closed`） |
| `sessionCount` | 会话总数 |
| `autoClosedCount` | 自动收口条数 |
| `correctedCount` | 人工纠正条数 |
| `byDate` | 按日汇总与会话列表 |

错误码：`401`、`403`、`404`、`500`

### 3.8 `PATCH /api/admin/attendance/sessions/:id`

- 功能描述：人工纠正班次时间并记录纠正原因。
- 使用场景：补录漏打卡、纠正错误时间。
- 鉴权：需要管理员 token。

路径参数：

| 字段 | 说明 |
|---|---|
| `id` | WorkSession ID |

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `startTime` | string | 否 | 新上班时间（ISO） |
| `endTime` | string | 否 | 新下班时间（ISO） |
| `correctionNote` | string | 是 | 纠正原因 |

成功响应（200）示例：

```json
{
  "message": "纠正成功",
  "session": {
    "id": "uuid",
    "status": "corrected",
    "correctionNote": "学助漏打卡，按值班记录修正",
    "durationMinutes": 240,
    "hours": "4.00"
  }
}
```

错误码：`400`、`401`、`403`、`404`、`500`

---

## 4. 管理员通知学助打卡（/api/admin/assistants）

### 4.1 `POST /api/admin/assistants/:id/shift-notice`

- 功能描述：向指定学助发送上/下班确认通知。
- 使用场景：管理员催促学助上班或下班。
- 鉴权：需要管理员 token。

路径参数：`id`（学助 ID）

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `action` | string | 是 | `clock_in` 或 `clock_out` |

成功响应（201）示例：

```json
{
  "message": "已向 张三 发送下班确认请求，等待学助响应",
  "notificationId": "uuid",
  "action": "clock_out",
  "actionLabel": "下班",
  "assistantName": "张三",
  "assistantId": "uuid",
  "expiresAt": "2026-05-18T10:00:00.000Z"
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `notificationId` | 通知 ID |
| `expiresAt` | 过期时间（5 分钟） |

错误码：`400`、`401`、`403`、`404`、`500`

### 4.2 `GET /api/admin/assistants/:id/shift-notice`

- 功能描述：查询指定学助最近一条通知状态。
- 使用场景：管理端查看通知处理进度。
- 鉴权：需要管理员 token。

路径参数：`id`（学助 ID）

成功响应（200）示例：

```json
{
  "notice": {
    "id": "uuid",
    "action": "clock_out",
    "actionLabel": "下班",
    "status": "confirmed",
    "expiresAt": "2026-05-18T10:00:00.000Z",
    "respondedAt": "2026-05-18T09:57:00.000Z",
    "createdAt": "2026-05-18T09:55:00.000Z"
  }
}
```

`status` 枚举：`pending|confirmed|declined|expired`

错误码：`401`、`403`、`500`

---

## 5. 学助管理（后台使用，前缀 /api/assistants）

### 5.1 `GET /api/assistants`

- 功能描述：分页查询学助列表。
- 使用场景：学助管理列表页。
- 鉴权：需要登录 token（管理后台使用管理员 token）。

查询参数：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `page` | number | 否 | 页码，默认 `1` |
| `limit` | number | 否 | 每页条数，默认 `10` |
| `search` | string | 否 | 按学号/姓名/手机号搜索 |
| `status` | string | 否 | `active` / `inactive` |

成功响应（200）：`{ data, total, page, limit }`

错误码：`401`、`500`

### 5.2 `GET /api/assistants/stats`

- 功能描述：获取学助统计信息。
- 使用场景：后台首页统计卡片。
- 鉴权：需要登录 token。

成功响应（200）：

```json
{
  "total": 20,
  "active": 18,
  "inactive": 2,
  "totalHours": 345.5
}
```

错误码：`401`、`500`

### 5.3 `POST /api/assistants`

- 功能描述：创建单个学助（并自动创建关联账户）。
- 使用场景：后台手动新增学助。
- 鉴权：需要登录 token。

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `studentId` | string | 是 | 学号，当前规则为 10 位数字 |
| `name` | string | 是 | 姓名（2-10 字符） |
| `phone` | string | 是 | 11 位手机号 |
| `positionLevel` | string | 是 | `一级岗` / `二级岗` |
| `notes` | string | 否 | 备注 |

成功响应（201）：返回新建学助对象。

错误码：`400`、`409`、`500`

### 5.4 `POST /api/assistants/import`

- 功能描述：JSON 批量导入学助。
- 使用场景：批量初始化或批量更新。
- 鉴权：需要登录 token。

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `data` | array | 是 | 导入数组，最多 1000 条 |
| `mode` | string | 否 | `insert` 或 `upsert`，默认 `insert` |
| `fieldMapping` | object | 否 | 字段映射 |

成功响应（200）字段：

| 字段 | 说明 |
|---|---|
| `summary` | 汇总统计（created/updated/skipped/failed/success） |
| `errors` | 失败明细 |
| `invalidRows` | 校验失败行 |
| `message` | 文本摘要 |

错误码：`400`、`500`

### 5.5 `GET /api/assistants/:id`

- 功能描述：查询学助详情。
- 使用场景：学助详情页。
- 鉴权：需要登录 token。

路径参数：`id`（学助 ID）

成功响应（200）：返回学助详情对象。

错误码：`401`、`404`、`500`

### 5.6 `PUT /api/assistants/:id`

- 功能描述：更新学助信息。
- 使用场景：后台编辑学助信息。
- 鉴权：需要登录 token。

路径参数：`id`（学助 ID）

请求体可选字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 姓名 |
| `phone` | string | 手机号 |
| `positionLevel` | string | `一级岗` / `二级岗` |
| `status` | string | `active` / `inactive` |
| `notes` | string | 备注 |

成功响应（200）：返回更新后的学助信息。

错误码：`400`、`404`、`500`

### 5.7 `DELETE /api/assistants/:id`

- 功能描述：删除学助（并删除关联账户）。
- 使用场景：离岗学助清理。
- 鉴权：需要登录 token。

路径参数：`id`（学助 ID）

成功响应（200）：

```json
{ "message": "已删除" }
```

错误码：`401`、`404`、`500`

### 5.8 `POST /api/assistants/:id/reset-password`

- 功能描述：重置学助密码为“学号后 6 位”，并设置强制改密标志。
- 使用场景：忘记密码处理。
- 鉴权：需要登录 token。

路径参数：`id`（学助 ID）

成功响应（200）：

```json
{ "message": "密码已重置为学号后六位（已强制下次修改）" }
```

错误码：`401`、`404`、`500`

### 5.9 `POST /api/assistants/:id/status`（不推荐）

- 功能描述：直接修改 `isOnShift`。
- 使用场景：紧急修复状态。
- 鉴权：需要登录 token。

路径参数：`id`（学助 ID）

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `isOnShift` | boolean | 是 | 是否在岗 |

成功响应（200）：返回简化后的学助信息。

风险说明：不会写入 `WorkSession` / `PunchRecord`，可能导致看板与工时统计不一致。

错误码：`400`、`404`、`500`

### 5.10 `GET /api/assistants/:assistantId/timelogs`

- 功能描述：分页查询学助时间日志。
- 使用场景：补充工时记录查询。
- 鉴权：需要登录 token。

路径参数：`assistantId`

查询参数：`page`、`limit`

成功响应（200）：`{ data, total, page, limit }`

错误码：`401`、`500`

### 5.11 `POST /api/assistants/:assistantId/timelogs`

- 功能描述：新增学助时间日志。
- 使用场景：人工登记工时。
- 鉴权：需要登录 token。

路径参数：`assistantId`

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `date` | string | 是 | 日期 |
| `hours` | number | 是 | 工时 |
| `remark` | string | 否 | 备注 |

成功响应（201）：返回新建日志对象。

错误码：`400`、`404`、`500`

---

## 6. 已核验差异说明

- `POST /api/assistants/import-file`：当前控制器中有实现，但路由未挂载，默认不可用。
- 学助客户端相关接口（`/api/user/*`、`/api/attendance/*`）已全部迁移至 `API_CLIENT.md`。
