# 客户端接口描述（基于学号登录 /api/user）

本文档说明客户端统一采用学号作为账号的约定，所有客户端相关路由前缀为 `/api/user/`（登录、资料等）。基于代码位置：
- 路由: `src/client/routes/userRoutes.js`
- 学号登录逻辑（会话 + sid）: `src/controllers/authController.js`
- 资料接口: `src/client/controllers/userController.js`

---

**客户端更新约束（重要）**

- 客户端应用仅允许学助本人通过 `PUT /api/assistants/me` 修改自己的 **手机号** 与 **密码**；其它字段（如姓名、岗位、状态、hourlyRate、totalHours、notes 等）必须由管理后台统一维护，以避免权限混淆与重复实现。
- 管理后台应在管理端实现管理员权限的完整学助更新接口（例如 `/api/admin/assistants/:id`），负责字段校验、审计日志、变更通知以及必要的审批流程。
- 文档约定：前端仅集成与使用 `GET /api/assistants/:id`（只读）与 `PUT /api/assistants/me`（自我更新），所有会影响业务或权限的写操作请交由后台管理功能完成。

如果需要，我可以为管理后台草拟管理员 API 规范草稿并加入到项目文档中。


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

## 考勤模块（/api/attendance）

> **前置条件**：所有考勤接口均需学助账号登录后获得的 JWT token，才能调用。token 的 payload 中必须包含 `assistantId`（即该学号对应的学助 UUID），否则接口返回 403。
>
> **路由文件**：`src/routes/attendanceRoutes.js`  
> **控制器**：`src/client/controllers/attendanceController.js`  
> **数据表**：`PunchRecords`（原始打卡记录）、`WorkSessions`（班次工时记录）  
> **班次划分**（以打卡时间判断）：
> - `morning`（上午班）：00:00 ~ 12:30 前打卡
> - `afternoon`（下午班）：12:30 ~ 18:00 前打卡
> - `evening`（晚班）：18:00 ~ 22:00 前打卡
> - `other`（其他）：22:00 后打卡

---

### POST /api/attendance/punch

- **描述**：学助上班打卡（`IN`）或下班打卡（`OUT`）。打卡时间**以服务端时间为准**，不信任客户端传入的时间戳，防止篡改。
  - 上班打卡（`IN`）：系统在 `WorkSessions` 表创建一条状态为 `open` 的班次记录，同时写入 `PunchRecords`。服务端同时会将对应 `Assistant.isOnShift` 更新为 `true`。
  - 下班打卡（`OUT`）：系统关闭当前进行中的班次，计算工时，将状态更新为 `closed`，服务端会将对应 `Assistant.isOnShift` 更新为 `false`。
- **请求方式**：`POST`
- **鉴权**：`Authorization: Bearer <token>`（token payload 需含 `assistantId`）
- **请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `string` | ✅ | `IN`（上班）或 `OUT`（下班），其他值返回 400 |
| `source` | `string` | ❌ | 打卡来源标识，默认 `"app"`，可传 `"web"` / `"miniapp"` 等 |

```json
// 上班打卡
{ "type": "IN", "source": "web" }

// 下班打卡
{ "type": "OUT", "source": "web" }
```

- **成功响应**：

上班打卡成功（201）：
```json
{
  "message": "上班打卡成功（下午班）",
  "sessionId": "uuid-of-work-session",
  "shiftType": "afternoon",
  "shiftLabel": "下午班",
  "startTime": "2026-05-16T08:32:00.000Z",
  "expectedEndAt": "18:00",
  "status": "open"
}
```

下班打卡成功（200）：
```json
{
  "message": "下班打卡成功",
  "sessionId": "uuid-of-work-session",
  "shiftLabel": "下午班",
  "startTime": "2026-05-16T04:32:00.000Z",
  "endTime": "2026-05-16T09:58:00.000Z",
  "durationMinutes": 326,
  "hours": "5.43",
  "status": "closed"
}
```

- **错误响应**：

| 状态码 | 场景 |
|--------|------|
| 400 | `type` 参数缺失或不合法 |
| 403 | token 未含 `assistantId`（非学助账号） |
| 409 | 上班打卡时已有进行中的班次（未下班就再次打上班卡）；或下班打卡时当前没有进行中的班次 |
| 500 | 数据库异常 |

> **注意**：当 `IN` 冲突（409）时，响应体会附带当前进行中班次的 `sessionId` 和 `startTime`，前端可引导学助先完成下班打卡。

- **curl 示例**：

```bash
# 上班打卡
curl -X POST http://localhost:3000/api/attendance/punch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"IN","source":"web"}'

# 下班打卡
curl -X POST http://localhost:3000/api/attendance/punch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"OUT","source":"web"}'
```

---

### GET /api/attendance/status

- **描述**：查询当前学助的考勤状态快照，供前端**周期性轮询**（建议每 60 秒一次）。核心用途是判断是否需要弹出"加班提醒"弹窗——当学助已到达班次的标准下班时间但尚未打下班卡时，`pendingReminder` 字段不为 `null`，前端应弹窗询问"是否仍在加班"。
- **请求方式**：`GET`
- **鉴权**：`Authorization: Bearer <token>`

- **成功响应（200）**：

```json
{
  "openSession": {
    "id": "uuid",
    "assistantId": "uuid",
    "date": "2026-05-16",
    "shiftType": "afternoon",
    "startTime": "2026-05-16T04:32:00.000Z",
    "endTime": null,
    "durationMinutes": null,
    "status": "open"
  },
  "pendingReminder": {
    "sessionId": "uuid",
    "shiftType": "afternoon",
    "shiftLabel": "下午班",
    "restTime": "18:00",
    "startTime": "2026-05-16T04:32:00.000Z",
    "message": "您的下午班已到休息时间（18:00），请确认：是否仍在加班？"
  },
  "todaySessions": [ /* 今日所有班次，同 /sessions 结构 */ ],
  "serverTime": "2026-05-16T10:05:00.000Z"
}
```

字段说明：

| 字段 | 说明 |
|------|------|
| `openSession` | 当前进行中（`open` 或 `pending_confirm`）的班次，未打卡则为 `null` |
| `pendingReminder` | 若已过标准下班时间但未打下班卡，返回此对象；否则为 `null`。**前端收到此字段非 null 时必须弹窗** |
| `todaySessions` | 今日全部班次列表（含已关闭的），可用于展示"今日工时"摘要 |
| `serverTime` | 服务器当前时间的 ISO 字符串，前端可用于时钟校准 |

- **前端典型处理逻辑**：

```js
const { openSession, pendingReminder } = await fetch('/api/attendance/status', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

if (pendingReminder) {
  // 弹窗：确认是否还在加班？
  // 点"已下班"→ 调 POST /punch { type: 'OUT' }
  // 点"仍在加班"→ 忽略，继续轮询
}
```

- **curl 示例**：

```bash
curl -X GET http://localhost:3000/api/attendance/status \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/attendance/sessions

- **描述**：分页查询当前学助的历史班次明细，支持按日期范围和班次状态筛选。每条记录包含上下班时间、工时、班次类型和当前状态，适合在"我的考勤记录"页面展示。
- **请求方式**：`GET`
- **鉴权**：`Authorization: Bearer <token>`

- **查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `from` | `YYYY-MM-DD` | ❌ | 查询开始日期（含），不传则不限 |
| `to` | `YYYY-MM-DD` | ❌ | 查询结束日期（含），不传则不限 |
| `status` | `string` | ❌ | 班次状态筛选，可选值见下表 |
| `page` | `number` | ❌ | 页码，默认 `1` |
| `limit` | `number` | ❌ | 每页条数，默认 `20`，最大建议 `100` |

班次状态（`status`）枚举值：

| 值 | 含义 |
|----|------|
| `open` | 进行中（已打上班卡，未打下班卡） |
| `closed` | 正常结束（学助主动打了下班卡） |
| `auto_closed` | 系统自动收口（学助忘记下班打卡，过了宽限期后由系统自动关闭） |
| `pending_confirm` | 待确认（已过下班时间，尚未响应弹窗） |
| `corrected` | 已人工纠正（管理员修正了该班次的时间） |

- **成功响应（200）**：

```json
{
  "data": [
    {
      "id": "uuid",
      "assistantId": "uuid",
      "date": "2026-05-15",
      "shiftType": "morning",
      "shiftLabel": "上午班",
      "startTime": "2026-05-15T01:10:00.000Z",
      "endTime": "2026-05-15T04:28:00.000Z",
      "durationMinutes": 198,
      "hours": "3.30",
      "status": "closed",
      "autoCloseReason": null,
      "correctionNote": null,
      "punchInId": "uuid",
      "punchOutId": "uuid"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

- **curl 示例**：

```bash
# 查询本月全部班次
curl -X GET "http://localhost:3000/api/attendance/sessions?from=2026-05-01&to=2026-05-31&page=1&limit=20" \
  -H "Authorization: Bearer <token>"

# 只查询系统自动收口的记录
curl -X GET "http://localhost:3000/api/attendance/sessions?status=auto_closed" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/attendance/summary

- **描述**：查询当前学助在指定日期范围内的工时汇总统计。仅统计状态为 `closed`、`auto_closed`、`corrected` 的已结束班次（`open` / `pending_confirm` 不计入）。返回总工时、班次总数、异常记录数，以及按日汇总的明细表，适合"我的工时统计"页面。
- **请求方式**：`GET`
- **鉴权**：`Authorization: Bearer <token>`

- **查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `from` | `YYYY-MM-DD` | ❌ | 统计开始日期（含），不传则统计全部历史 |
| `to` | `YYYY-MM-DD` | ❌ | 统计结束日期（含） |

- **成功响应（200）**：

```json
{
  "totalMinutes": 1020,
  "totalHours": "17.00",
  "sessionCount": 5,
  "autoClosedCount": 1,
  "hasUnconfirmed": true,
  "unconfirmedTip": "您有 1 条系统自动收口记录，请联系管理员核实工时",
  "byDate": [
    {
      "date": "2026-05-14",
      "minutes": 240,
      "hours": "4.00",
      "sessionCount": 1,
      "hasAnomalies": false
    },
    {
      "date": "2026-05-15",
      "minutes": 396,
      "hours": "6.60",
      "sessionCount": 2,
      "hasAnomalies": true
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
|------|------|
| `totalMinutes` | 总工时（分钟数），精确值 |
| `totalHours` | 总工时（小时，保留两位小数） |
| `sessionCount` | 已结束班次总数 |
| `autoClosedCount` | 其中系统自动收口的班次数量 |
| `hasUnconfirmed` | 是否含有自动收口记录（`autoClosedCount > 0` 时为 `true`） |
| `unconfirmedTip` | 存在自动收口时展示给学助的提示文字，`null` 表示无异常 |
| `byDate` | 按日期汇总的数组，每个元素包含当日工时 / 班次数 / 是否含异常 |

> **注意**：`auto_closed` 状态的班次工时是系统估算值（基于班次标准下班时间计算），并非实际工时，学助应联系管理员（`PATCH /api/admin/attendance/sessions/:id`）纠正后才会转为 `corrected` 状态。

- **curl 示例**：

```bash
# 查询本月工时汇总
curl -X GET "http://localhost:3000/api/attendance/summary?from=2026-05-01&to=2026-05-31" \
  -H "Authorization: Bearer <token>"

# 不传参：统计全部历史数据
curl -X GET "http://localhost:3000/api/attendance/summary" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/attendance/shift-notice（轮询管理员通知）

- **描述**：学助客户端周期性调用（建议每 **10 秒**一次），检查是否有管理员发来的上/下班确认请求。若收到通知应立即弹出确认弹窗；无通知时继续轮询。
- **请求方式**：`GET`
- **鉴权**：`Authorization: Bearer <token>`（token payload 需含 `assistantId`）

- **成功响应（200）—— 有待处理通知**：

```json
{
  "notice": {
    "id": "uuid",
    "action": "clock_out",
    "actionLabel": "下班",
    "expiresAt": "2026-05-16T09:45:00.000Z",
    "createdAt": "2026-05-16T09:40:00.000Z",
    "secondsLeft": 183
  }
}
```

- **成功响应（200）—— 无通知**：`{ "notice": null }`

字段说明：

| 字段 | 说明 |
|------|------|
| `id` | 通知 UUID，响应时需携带 |
| `action` | `clock_in`（要求上班）或 `clock_out`（要求下班） |
| `actionLabel` | 对应的中文标签（`上班` / `下班`） |
| `secondsLeft` | 通知剩余有效时间（秒），可用于倒计时展示 |

- **错误响应**：`403` token 未含 `assistantId`。

- **前端轮询 + 弹窗示例**：

```javascript
let noticePollingTimer = null;

function startNoticePolling(token) {
  async function poll() {
    try {
      const res = await fetch('/api/attendance/shift-notice', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { notice } = await res.json();
      if (notice) {
        stopNoticePolling();
        showShiftNoticeDialog(notice, token);
      }
    } catch (_) {}
  }
  poll();
  noticePollingTimer = setInterval(poll, 10000);
}

function stopNoticePolling() {
  clearInterval(noticePollingTimer);
}

async function showShiftNoticeDialog(notice, token) {
  const confirmed = window.confirm(
    `管理员请求您【${notice.actionLabel}】打卡，是否确认？\n（${notice.secondsLeft} 秒内有效）`
  );
  const response = confirmed ? 'confirmed' : 'declined';

  const res = await fetch('/api/attendance/shift-notice/respond', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationId: notice.id, response }),
  });
  const result = await res.json();
  alert(result.message);
  startNoticePolling(token); // 响应后恢复轮询
}
```

- **curl 示例**：

```bash
curl -X GET http://localhost:3000/api/attendance/shift-notice \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/attendance/shift-notice/respond（响应管理员通知）

- **描述**：学助确认或拒绝管理员发来的上/下班通知。`confirmed` 时系统自动完成打卡（等同于调用 `POST /api/attendance/punch`），并触发管理端在班看板 SSE 实时刷新；`declined` 时仅更新通知状态，不打卡。
- **请求方式**：`POST`
- **鉴权**：`Authorization: Bearer <token>`（token payload 需含 `assistantId`）
- **请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `notificationId` | `string` | ✅ | 通知 UUID（来自 `GET /shift-notice` 响应的 `id`） |
| `response` | `string` | ✅ | `confirmed`（确认打卡）或 `declined`（拒绝） |

```json
{ "notificationId": "uuid", "response": "confirmed" }
```

- **成功响应（200）—— 确认上班**：

```json
{
  "message": "上班打卡成功",
  "status": "confirmed",
  "shiftLabel": "下午班",
  "sessionId": "uuid",
  "startTime": "2026-05-16T09:40:00.000Z"
}
```

- **成功响应（200）—— 确认下班**：

```json
{
  "message": "下班打卡成功",
  "status": "confirmed",
  "shiftLabel": "上午班",
  "durationMinutes": 97,
  "hours": "1.62"
}
```

- **成功响应（200）—— 拒绝**：

```json
{ "message": "已拒绝", "status": "declined" }
```

- **错误响应**：

| 状态码 | 场景 |
|--------|------|
| 403 | token 未含 `assistantId` |
| 404 | 通知不存在或不属于当前学助 |
| 409 | 重复打卡（`confirmed` 时当前班次状态冲突） |
| 410 | 通知已超时（有效期 5 分钟） |

- **curl 示例**：

```bash
curl -X POST http://localhost:3000/api/attendance/shift-notice/respond \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notificationId":"uuid","response":"confirmed"}'
```

---

## 与之前的差异与注意事项

- 前端约定已统一：所有客户端请求前缀改为 `/api/user/`（之前文档中的 `/api/users`、`/api/auth` 的用法已做合并/对齐）。
- 登录字段：前端必须使用 `studentId`（学号）作为登录字段提交到 `/api/user/login`。模型 `accounts.username` 存储学号（字符串）。
- Token payload：包含 `sid`（会话 id），鉴权中间件 `src/common/middleware/authMiddleware.js` 会在 payload 含 `sid` 时校验 `accounts.currentSessionId`，从而实现单会话控制。
- 密码存储：数据库中 `accounts.password` 为哈希值，前端提交明文密码（学号后 6 位为默认/初始密码），服务端使用模型的 `matchPassword` 进行比较。
- 测试账户：可使用 `src/db/seeders/seedAccounts.js` 写入若干测试学号（示例 `2023000001` ~ `2023000005`，密码为学号后 6 位）。

---

## 学助资料与自我更新接口（/api/assistants）

客户端可通过学助相关接口读取学助资料并由学助本人更新有限字段（仅手机号与密码）。以下为关键接口：

### GET /api/assistants/:id

- 描述：获取指定学助的详情（受保护，需要 `Authorization: Bearer <token>`）。管理员与普通用户均可访问（但普通用户通常只能查看自己的学助记录）。
- 请求方式：`GET`
- 响应示例（200）：

```json
{
  "id": "<uuid>",
  "studentId": "2025050303",
  "name": "张三",
  "position": "二级岗",
  "isOnShift": false,
  "status": "active",
  "phone": "13812341234",
  "hourlyRate": "12.00",
  "totalHours": 24,
  "createdAt": "2026-05-16T10:51:51.202Z",
  "updatedAt": "2026-05-16T10:51:51.202Z",
  "notes": null
}
```

### PUT /api/assistants/me

- 描述：学助本人自我更新接口，仅允许更新 `phone` 和 `password`（通过关联的 `Account` 修改密码）。受保护，需要 `Authorization: Bearer <token>`，且该 token 的 payload 应包含 `assistantId`（登录时会返回）。
- 请求方式：`PUT`
- 请求头：`Authorization: Bearer <token>`、`Content-Type: application/json`
- 请求体示例：

更新手机号：
```json
{ "phone": "13899998888" }
```

修改密码（需同时提供 `currentPassword`）：
```json
{ "currentPassword": "旧密码", "newPassword": "新密码123" }
```

- 成功响应（200）：

```json
{ "message": "更新成功", "phone": "13899998888" }
```

- 错误响应与注意事项：
  - 400：修改密码时未提供 `currentPassword`。
  - 401：`currentPassword` 验证失败（当前密码不正确）。
  - 403：token 未包含 `assistantId` 或当前用户未关联学助。
  - 404：找不到对应学助或账户记录。

---
