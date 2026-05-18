# 考勤系统 API 完整文档

**最后更新**：2026-05-18 | **版本**: 2.1

## 📋 快速导航

- **🔐 [管理员认证](#管理员认证)** - 登录和授权管理
- **👥 [单个学助添加](#学助管理---单个添加)** - 添加单个学助
- **📊 [批量导入](#学助管理---批量导入)** - 支持 JSON、CSV、Excel 导入
- **⚙️ [其他接口](#学助管理---其他接口)** - 查询、更新、删除等
- **🔔 [上/下班通知确认流程](#上下班通知确认流程)** - 管理员触发 → 学助弹窗确认 → 自动打卡
- **📡 [在班看板实时更新](#管理员考勤---当前在班看板)** - SSE 长连接 / 轮询两种方案
- **📁 [Excel/CSV 处理完整指南](#excelcsv-处理流程)** - **前端如何准备数据，后端如何处理文件**
- **💻 [前端集成代码](#前端集成示例)** - 完整的 HTML + JS 示例
- **🔧 [后端配置](#后端配置说明)** - 依赖、路由、中间件配置

---

# 管理员认证

## 登录 — POST /api/admin/login

**描述**：管理员使用用户名和密码登录，成功后返回 JWT 访问令牌。

**请求**：
```
POST /api/admin/login
Content-Type: application/json
```

**请求体**：
```json
{
  "username": "admin",
  "password": "123456"
}
```

**成功响应 (200)**：
```json
{
  "status": "success",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "admin",
  "role": "admin",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**错误响应**：

参数缺失 (400)：
```json
{
  "message": "用户名和密码为必填项"
}
```

认证失败 (401)：
```json
{
  "message": "用户名或密码无效"
}
```

---

## 获取管理员资料 — GET /api/admin/profile

**描述**：获取当前登录管理员的资料。

**请求**：
```
GET /api/admin/profile
Authorization: Bearer <JWT_TOKEN>
```

**成功响应 (200)**：返回管理员信息（不含密码）

### Token 说明
- 登录后返回的 `token` 为 JWT
- 所有受保护接口需在 Header 中通过 `Authorization: Bearer <token>` 携带
- 环境变量：
  - `JWT_SECRET`：签名密钥
  - `JWT_EXPIRES_IN`：过期时间（如 `168h`，即 168 小时 / 7 天）

---

# 学助管理 - 单个添加

## 创建学助 — POST /api/assistants

**描述**：添加单个学助，对应前端表单示例的需求。

**认证**：必需 `Bearer Token`

**请求**：
```
POST /api/assistants
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**请求体**：
```json
{
  "studentId": "20230001",
  "name": "张三",
  "phone": "13800138000",
  "positionLevel": "一级岗"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 | 验证规则 |
|------|------|------|------|---------|
| `studentId` | string | ✅ | 学号 | 8-12 位字母或数字 |
| `name` | string | ✅ | 姓名 | 2-50 字符，支持中英文 |
| `phone` | string | ✅ | 手机号 | 中国号码（1 开头，11 位） |
| `positionLevel` | string | ✅ | 岗位等级 | "一级岗" 或 "二级岗" |


### 岗位等级

- `一级岗` - 一级岗位
- `二级岗` - 二级岗位

**成功响应 (201)**：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "studentId": "20230001",
  "name": "张三",
  "phone": "13800138000",
  "position": "一级岗",
  "status": "active",
  "isOnShift": false,
  "createdAt": "2024-05-14T10:30:00.000Z"
}
```

**错误响应**：

验证失败 (400)：
```json
{
  "message": "数据验证失败",
  "errors": [
    "studentId 格式不正确（应为 8-12 位字母或数字）",
    "phone 格式不正确（应为有效的中国手机号）"
  ]
}
```

学号重复 (409)：
```json
{
  "message": "学号已存在",
  "existingId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

# 学助管理 - 批量导入

## JSON 批量导入 — POST /api/assistants/import

**描述**：通过 JSON 数组批量导入学助，支持两种模式。

**认证**：必需 `Bearer Token`

**请求**：
```
POST /api/assistants/import
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**请求体**：
```json
{
  "data": [
    {
      "studentId": "20230001",
      "name": "张三",
      "phone": "13800138000",
      "positionLevel": "一级岗"
    },
    {
      "studentId": "20230002",
      "name": "李四",
      "phone": "13800138001",
      "positionLevel": "二级岗"
    }
  ],
  "mode": "upsert",
  "fieldMapping": {}
}
```

### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `data` | array | ✅ | - | 学助数据数组，最多 1000 行 |
| `mode` | string | ❌ | `insert` | `insert`（仅新增）或 `upsert`（新增或更新） |
| `fieldMapping` | object | ❌ | `{}` | 字段名映射 |

### 导入模式

| 模式 | 行为 |
|------|------|
| `insert` | 仅新增：学号存在则跳过 |
| `upsert` | 新增或更新：学号存在则更新，否则新增（**推荐**） |

### 字段映射示例

如果数据来自不同格式，用 `fieldMapping` 进行列名映射：

```json
{
  "data": [...],
  "fieldMapping": {
    "员工ID": "studentId",
    "全名": "name",
    "联系方式": "phone",
    "职位级别": "positionLevel",
    "公司邮箱": "email"
  }
}
```

**成功响应 (200)**：
```json
{
  "summary": {
    "total": 10,
    "created": 8,
    "updated": 1,
    "skipped": 0,
    "failed": 1,
    "success": 9
  },
  "errors": [
    {
      "studentId": "20230010",
      "name": "王五",
      "reason": "phone 格式不正确"
    }
  ],
  "invalidRows": [
    {
      "rowIndex": 7,
      "studentId": "20230003",
      "reason": "导入数据中存在重复学号"
    }
  ],
  "message": "导入完成: 成功 9 行，失败 1 行",
  "timestamp": "2024-05-14T10:32:00.000Z"
}
```

---

## 文件上传导入 — POST /api/assistants/import-file

**描述**：上传 CSV 或 Excel 文件进行批量导入。

**认证**：必需 `Bearer Token`

**请求**：
```
POST /api/assistants/import-file
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | file | ✅ | CSV/Excel 文件（.csv, .xlsx, .xls） |
| `mode` | string | ❌ | 导入模式（insert/upsert） |
| `fieldMapping` | string | ❌ | JSON 字符串格式的字段映射 |

**支持的文件格式**：
- `.csv` — CSV 文件（UTF-8 编码，逗号分隔）
- `.xlsx` — Excel 2007+
- `.xls` — Excel 97-2003

**前端上传示例**：

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('mode', 'upsert');

const token = localStorage.getItem('token');
fetch('/api/assistants/import-file', {
  method: 'POST',
  body: formData,
  headers: { 'Authorization': `Bearer ${token}` }
})
  .then(res => res.json())
  .then(data => console.log('导入结果:', data));
```

**成功响应 (200)**：与 POST /api/assistants/import 相同

---

# 上/下班通知确认流程

> 这是 v2.1 引入的核心功能：管理后台点击"上班/下班"按钮后，学助客户端弹出确认弹窗，学助选择确认或拒绝，系统根据响应自动完成打卡，管理端实时看板同步刷新。

## 完整接口调用时序

```
管理后台                          后端服务                        学助客户端
─────────────                    ─────────                      ──────────────────────
1. 点击"下班"按钮
   POST /api/admin/assistants/:id/shift-notice
   { action:"clock_out" }
                               → 创建 ShiftNotification(pending)
                               → SSE 广播在班看板
                                                               2. 每 10s 轮询
                                                                  GET /api/attendance/shift-notice
                                                               ← { notice:{action:"clock_out",secondsLeft:280} }
                                                                  弹出确认弹窗
3. 可查询通知进度
   GET /api/admin/assistants/:id/shift-notice
   ← { notice:{ status:"pending" } }
                                                               4. 学助点"确认"
                                                                  POST /api/attendance/shift-notice/respond
                                                                  { notificationId, response:"confirmed" }
                               → 自动 OUT 打卡
                               → WorkSession closed
                               → SSE 广播刷新看板              ← { message:"下班打卡成功" }
5. 管理端看板自动刷新（无需手动操作）
```

## 管理后台需调用的接口

| 功能 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 向学助发上/下班请求 | `POST` | `/api/admin/assistants/:id/shift-notice` | **替代旧 `/api/assistants/:id/status`** |
| 查询通知响应状态 | `GET` | `/api/admin/assistants/:id/shift-notice` | 可选，SSE 连接的情况下自动感知 |
| 订阅在班看板实时推送 | `GET` | `/api/admin/attendance/online/stream` | SSE 长连接，推荐方式 |
| 获取在班快照（轮询备选） | `GET` | `/api/admin/attendance/online` | 每 30s 调一次即可 |

## 学助客户端需调用的接口

| 功能 | 方法 | 路径 | 频率 | 说明 |
|------|------|------|------|------|
| 轮询待处理通知 | `GET` | `/api/attendance/shift-notice` | 每 10s | 有通知则弹窗 |
| 响应通知 | `POST` | `/api/attendance/shift-notice/respond` | 用户操作时 | `confirmed` 自动打卡，`declined` 拒绝不打卡 |
| 学助自主打卡 | `POST` | `/api/attendance/punch` | 用户操作时 | 与通知流程独立，均产生 WorkSession |
| 查询当前考勤状态 | `GET` | `/api/attendance/status` | 页面加载 / 定时 | 获取当前班次、是否需要休息提醒 |

## 关键设计说明

> **为什么废弃 `POST /api/assistants/:id/status`？**
>
> 旧接口仅写 `Assistant.isOnShift` 布尔字段，不创建 `WorkSession` 也不创建 `PunchRecord`：
> - 在班看板查询的是 `WorkSession` 表，旧接口改动完全不可见
> - 工时统计、薪资估算均依赖 `WorkSession`，旧接口操作后无工时记录
> - SSE 广播以 `WorkSession` 变化为触发点，旧接口不触发任何广播
>
> 新流程通过通知 → 打卡的完整链路，确保数据一致性和可审计性。

---

## 管理员考勤 - 当前在班看板

### GET /api/admin/attendance/online

- 描述：返回当前所有处于进行中（`status` 为 `open` 或 `pending_confirm`）的 `WorkSession`，用于管理后台的“当前在班”看板。该接口以 `WorkSession` 为准，能实时反映谁在岗，避免依赖 `Assistant.isOnShift` 的不一致性。
- 请求方式：`GET`
- 鉴权：需管理员权限，Header 中携带 `Authorization: Bearer <admin_jwt>`。

- 成功响应（200）：

```json
{
  "data": [
    {
      "sessionId": "uuid",
      "assistantId": "uuid",
      "name": "张三",
      "studentId": "20230001",
      "position": "高年级",
      "date": "2026-05-16",
      "shiftType": "morning",
      "shiftLabel": "上午班",
      "startTime": "2026-05-16T08:05:00.000Z",
      "onlineMinutes": 95,
      "status": "open"
    }
  ],
  "total": 1,
  "serverTime": "2026-05-16T09:40:00.000Z"
}
```

- 说明：返回的条目来自 `WorkSession` 表并包含关联的 `Assistant` 基本信息；`onlineMinutes` 为从 `startTime` 到服务器当前时间的分钟数估算，便于管理端展示在岗时长。

---

### GET /api/admin/attendance/online/stream（SSE 实时推送）

- 描述：Server-Sent Events 长连接。管理前端订阅后，立即收到一次当前在班快照，此后每 30 秒或任意学助状态发生变化（打卡、通知确认/拒绝）时即时推送，无需高频轮询。
- 鉴权：同上，携带管理员 JWT。

**前端接入示例（fetch + ReadableStream，支持自定义 Authorization header）**：

```javascript
async function subscribeOnlineStream(token, onData) {
  const response = await fetch('/api/admin/attendance/online/stream', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    for (const part of parts) {
      const line = part.replace(/^data: /, '').trim();
      if (line) {
        try { onData(JSON.parse(line)); } catch (_) {}
      }
    }
  }
}

// 使用
subscribeOnlineStream(localStorage.getItem('token'), ({ data, total, serverTime }) => {
  renderOnlineTable(data);
  console.log(`在班 ${total} 人，服务端时间 ${serverTime}`);
});
```

> **轮询备选方案**：若不需要 SSE，每 30 秒调用一次 `GET /api/admin/attendance/online` 即可。

---

### POST /api/admin/assistants/:id/shift-notice（向学助发送上/下班确认请求）

- 描述：管理员向指定学助推送上班或下班确认通知，学助客户端通过轮询感知后弹出弹窗。通知有效期 **5 分钟**，发送新通知会自动作废该学助之前未处理的通知。
- 鉴权：需管理员 JWT。

**请求体**：
```json
{ "action": "clock_out" }
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `action` | string | `clock_in`（要求上班）或 `clock_out`（要求下班） |

**成功响应（201）**：
```json
{
  "message": "已向张三发送下班确认请求，等待学助响应",
  "notificationId": "uuid",
  "action": "clock_out",
  "actionLabel": "下班",
  "assistantName": "张三",
  "assistantId": "uuid",
  "expiresAt": "2026-05-16T09:45:00.000Z"
}
```

---

### GET /api/admin/assistants/:id/shift-notice（查询学助最新通知状态）

- 描述：管理员查询指定学助最近一条通知的状态，确认学助是否已响应。

**成功响应（200）**：
```json
{
  "notice": {
    "id": "uuid",
    "action": "clock_out",
    "actionLabel": "下班",
    "status": "confirmed",
    "expiresAt": "2026-05-16T09:45:00.000Z",
    "respondedAt": "2026-05-16T09:42:00.000Z",
    "createdAt": "2026-05-16T09:40:00.000Z"
  }
}
```

`status` 可能值：`pending`（待响应）、`confirmed`（已确认）、`declined`（已拒绝）、`expired`（超时作废）。

---

### GET /api/attendance/shift-notice 与 POST /api/attendance/shift-notice/respond（学助端接口）

> 📄 这两个接口属于**学助客户端**，完整参数、响应结构和前端示例代码请查阅 [API_CLIENT.md](./API_CLIENT.md) 考勤模块中的对应章节。
>
> | 接口 | 方法 | 用途 | 鉴权 |
> |------|------|------|------|
> | `/api/attendance/shift-notice` | `GET` | 学助每 10s 轮询，有通知则弹窗确认 | 学助 JWT |
> | `/api/attendance/shift-notice/respond` | `POST` | 学助提交 `confirmed`/`declined`，`confirmed` 时自动打卡并触发 SSE 广播 | 学助 JWT |

---

## 学助管理 - 其他接口

## 获取列表 — GET /api/assistants

**请求**：
```
GET /api/assistants?search=张&page=1&limit=10&status=active
Authorization: Bearer <JWT_TOKEN>
```

**查询参数**：

| 参数 | 说明 |
|------|------|
| `page` | 页码（默认 1） |
| `limit` | 每页数量（默认 10） |
| `search` | 按学号/姓名/手机/邮箱搜索 |
| `status` | 按状态过滤（`active` 或 `inactive`） |

---

## 获取详情 — GET /api/assistants/:id

**请求**：
```
GET /api/assistants/:id
Authorization: Bearer <JWT_TOKEN>
```

---

## 更新学助 — PUT /api/assistants/:id

**描述**：管理员更新学助的基本信息。**学号（studentId）不可修改**（它是学助的登录账号名）；其余字段均可按需传入，未传字段保持原值不变。

**认证**：必需 `Bearer Token`

**请求**：
```
PUT /api/assistants/:id
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**请求体**（所有字段均为可选，至少提供一个）：
```json
{
  "name": "张三",
  "phone": "13800138000",
  "positionLevel": "一级岗",
  "status": "active",
  "notes": "备注信息"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 | 验证规则 |
|------|------|------|------|---------|
| `name` | string | 可选 | 姓名 | 2-10 个字符（中英文数字） |
| `phone` | string | 可选 | 手机号 | 中国手机号（1 开头，11 位） |
| `positionLevel` | string | 可选 | 岗位等级 | `"一级岗"`（15元/h）或 `"二级岗"`（12元/h）；后端会自动转换为 `position` + `hourlyRate` |
| `status` | string | 可选 | 状态 | `"active"` 或 `"inactive"`；更改后 Account 的 `isActive` 会自动同步 |
| `notes` | string | 可选 | 备注 | 任意文本 |

**成功响应 (200)**：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "studentId": "2025010101",
  "name": "张三",
  "phone": "13800138000",
  "position": "一级岗",
  "hourlyRate": "15.00",
  "status": "active",
  "isOnShift": false,
  "notes": null,
  "updatedAt": "2026-05-16T10:30:00.000Z"
}
```

**错误响应**：

验证失败 (400)：
```json
{
  "message": "数据验证失败",
  "errors": ["phone 格式不正确（11 位有效手机号）"]
}
```

未找到学助 (404)：
```json
{ "message": "未找到学助" }
```

---

## 重置密码 — POST /api/assistants/:id/reset-password

**描述**：管理员将指定学助的登录密码重置为**学号后 6 位**，并标记 `forceChangePassword: true`（不支持管理员自定义密码）。学助下次登录后应自行修改密码。

**认证**：必需 `Bearer Token`

**请求**：
```
POST /api/assistants/:id/reset-password
Authorization: Bearer <JWT_TOKEN>
```

**请求体**：无

**成功响应 (200)**：
```json
{ "message": "密码已重置为学号后六位（已强制下次修改）" }
```

**错误响应**：

未找到学助或账户 (404)：
```json
{ "message": "未找到学助" }
```

---

## 删除学助 — DELETE /api/assistants/:id

**请求**：
```
DELETE /api/assistants/:id
Authorization: Bearer <JWT_TOKEN>
```

---

## ~~设置上/下班状态 — POST /api/assistants/:id/status~~（已废弃）

> ⚠️ **此接口已废弃，请勿在新功能中使用。**
>
> **废弃原因**：该接口仅修改 `Assistant.isOnShift` 标志字段，**不会**创建 `WorkSession` 或 `PunchRecord`，导致：
> - 在班看板（`GET /api/admin/attendance/online`）无法感知状态变化
> - 学助工时统计不产生记录，薪资核算缺失
> - SSE 实时看板不会触发广播
>
> **替代方案（管理后台"上班/下班"按钮应改为以下调用链）**：
>
> | 步骤 | 调用方 | 接口 |
> |------|--------|------|
> | 1. 管理员点击"上班"或"下班"按钮 | 管理后台 | `POST /api/admin/assistants/:id/shift-notice` |
> | 2. 学助客户端轮询收到通知弹窗 | 学助客户端 | `GET /api/attendance/shift-notice`（每 10 秒） |
> | 3. 学助点击"确认"或"拒绝" | 学助客户端 | `POST /api/attendance/shift-notice/respond` |
> | 4. 系统自动打卡，WorkSession 正常创建，看板实时刷新 | 服务端广播 | SSE `GET /api/admin/attendance/online/stream` |
>
> 若确实需要**强制覆写**状态（紧急情况、历史数据修复），可继续调用此接口，但需知晓上述副作用。

**请求体**：
```json
{
  "isOnShift": true
}
```

---

## 统计 — GET /api/assistants/stats

**请求**：
```
GET /api/assistants/stats
Authorization: Bearer <JWT_TOKEN>
```

---

## 时间日志 - 列表 — GET /api/assistants/:assistantId/timelogs

## 时间日志 - 创建 — POST /api/assistants/:assistantId/timelogs

---

## 管理员 - 数据同步 / 运维接口

### 同步孤立账户 — POST /api/admin/sync-accounts

**描述**：管理员触发的运维接口，删除 `Accounts` 表中 `assistantId` 不为空但在 `Assistants` 表中已不存在的孤立账户记录（用于修复管理后台误删导致的同步不一致）。

**认证**：必需管理员 `Bearer Token`

**请求**：
```
POST /api/admin/sync-accounts
Authorization: Bearer <JWT_TOKEN>
```

**成功响应 (200)**：
```json
{
  "message": "同步完成，已删除 2 条孤立账户",
  "deleted": 2,
  "accounts": [
    { "id": "...", "username": "2021002", "assistantId": "..." }
  ]
}
```

**无需清理示例**：
```json
{ "message": "数据已一致，无需清理", "deleted": 0 }
```

### 运维脚本 — src/scripts/syncOrphanAccounts.js

项目提供了一个临时使用的脚本用于一次性修复历史遗留数据：

- 用法（预览，不删除）：
```
node src/scripts/syncOrphanAccounts.js --dry-run
```
- 用法（正式删除）：
```
node src/scripts/syncOrphanAccounts.js
```

脚本逻辑：查找 `Accounts` 表中 `assistantId` 非空但在 `Assistants` 表中不存在的记录，打印列表并在非 `--dry-run` 模式下物理删除这些账户。


# Excel/CSV 处理流程

## 前端数据准备指南

### ⭐ 方案 A：CSV 文件（推荐）

**优点**：
- ✅ 文件最小，适合大数据量
- ✅ Excel 直接打开编辑
- ✅ 易于版本控制
- ✅ 任何操作系统都支持

**准备步骤**：

1. **标准列名**（必须完全一致，包括空格）：
   ```
   学号 | 姓名 | 手机号 | 岗位等级
   ```

2. **CSV 纯文本示例**：
   ```csv
   学号,姓名,手机号,岗位等级
   20230001,张三,13800138000,一级岗
   20230002,李四,13800138001,二级岗
   20230003,王五,13800138002,一级岗
   ```

3. **保存设置**：
   - 编码：**UTF-8**
   - 格式：CSV
   - 分隔符：逗号 `,`

### 方案 B：Excel 文件

**特点**：
- ✅ 非技术人员友好
- ✅ 支持格式和验证

**列名**（系统会自动识别这些替代名）：

| 标准 | 替代名 1 | 替代名 2 |
|------|----------|----------|
| 学号 | studentId | student_id |
| 姓名 | name | - |
| 手机号 | phone | phone_number |
| 岗位等级 | positionLevel | position_level |

---

## 前端处理流程

```html
<input type="file" id="fileInput" accept=".csv,.xlsx,.xls" />
<select id="mode">
  <option value="insert">仅新增</option>
  <option value="upsert">新增或更新（推荐）</option>
</select>
<button onclick="uploadFile()">上传</button>
```

```javascript
async function uploadFile() {
  const file = document.getElementById('fileInput').files[0];
  const mode = document.getElementById('mode').value;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/assistants/import-file', {
    method: 'POST',
    body: formData,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const result = await response.json();
  console.log('导入结果:', result);
}
```

---

## 后端处理流程

**处理步骤**：

1. **multer 中间件** - 接收文件，验证类型和大小
2. **文件解析** - 根据文件类型选择解析器
   - CSV → `parseCSV()`
   - Excel → `parseExcel()`
3. **字段映射** - `mapFieldNames()` 处理不同列名
4. **内部去重** - `deduplicateByStudentId()` 过滤重复学号
5. **数据验证** - `validateAssistantData()` 逐行验证
6. **导入处理**
   - `insert` 模式：检查存在性，存在则跳过
   - `upsert` 模式：存在则更新，否则新增
7. **返回报告** - `generateImportReport()` 汇总结果

**后端配置**：

```bash
npm install multer xlsx
```

**路由配置** (src/routes/assistantRoutes.js)：

```javascript
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    cb(allowed.includes(file.mimetype) ? null : new Error('文件类型不支持'), allowed.includes(file.mimetype));
  }
});

router.post('/import-file', protect, upload.single('file'), controller.importFile);
```

---

# 前端集成示例

## React + Vite + TailwindCSS 完整组件

**文件位置**：`src/components/BulkImportAssistant.jsx`

完整的 React 组件已创建，包含以下功能：

### ✨ 功能特性

- ✅ **单个添加**：实时表单验证和提交
- ✅ **文件导入**：支持拖拽上传 CSV/Excel 文件
- ✅ **导入模式**：可选"仅新增"或"新增/更新"
- ✅ **结果统计**：实时显示导入结果（成功/失败/更新）
- ✅ **错误提示**：详细的行级错误报告
- ✅ **TailwindCSS 样式**：响应式设计，美观易用

### 📦 使用方式

```jsx
import BulkImportAssistant from './components/BulkImportAssistant';

export default function App() {
  return <BulkImportAssistant />;
}
```

### 🔧 组件 Props（支持扩展）

当前版本使用硬编码的 API 路径和 token 从 localStorage 获取。可根据需要扩展：

```json
{
  "apiBase": "/api/assistants",
  "onSuccess": callback,
  "onError": callback
}
```

---

## Vanilla JavaScript 示例

如不使用 React，参考以下原生 JS 实现：


<!DOCTYPE html>
<html>
<head>
  <title>学助管理</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    .tabs { margin-bottom: 20px; }
    .tab-btn { padding: 10px 20px; cursor: pointer; }
    .tab-btn.active { background: #0066cc; color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    input, select { width: 100%; padding: 8px; margin: 5px 0; }
    #uploadArea { border: 2px dashed #ccc; padding: 30px; text-align: center; cursor: pointer; }
  </style>
</head>
<body>
  <h1>学助管理系统</h1>
  
  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('add')">单个添加</button>
    <button class="tab-btn" onclick="switchTab('file')">文件导入</button>
  </div>
  
  <div id="add" class="tab-content active">
    <h2>添加学助</h2>
    <form id="addForm">
      <input type="text" id="studentId" placeholder="学号" required />
      <input type="text" id="name" placeholder="姓名" required />
      <input type="tel" id="phone" placeholder="手机号" required />
      <select id="positionLevel" required>
        <option value="">选择岗位</option>
        <option value="一级岗">一级岗</option>
        <option value="二级岗">二级岗</option>
      </select>
      <button type="submit">添加</button>
    </form>
    <div id="addResult"></div>
  </div>
  
  <div id="file" class="tab-content">
    <h2>文件导入</h2>
    <div id="uploadArea">拖拽或点击选择</div>
    <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display:none" />
    <button onclick="uploadFile()">上传</button>
    <div id="fileResult"></div>
  </div>
  
  <script>
    const token = localStorage.getItem('token');
    
    function switchTab(name) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(name).classList.add('active');
      event.target.classList.add('active');
    }
    
    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        studentId: document.getElementById('studentId').value,
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        positionLevel: document.getElementById('positionLevel').value
      };
      
      const response = await fetch('/api/assistants', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      document.getElementById('addResult').innerHTML = response.ok ? '✅ 成功' : '❌ ' + result.message;
    });
    
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    let selectedFile = null;
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      selectedFile = e.dataTransfer.files[0];
      uploadArea.textContent = '✅ ' + selectedFile.name;
    });
    
    async function uploadFile() {
      if (!selectedFile) return alert('请选择文件');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mode', 'upsert');
      
      const response = await fetch('/api/assistants/import-file', {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      document.getElementById('fileResult').innerHTML = `成功: ${result.summary.success} | 失败: ${result.summary.failed}`;
    }
  </script>
</body>
</html>
```

---

# 后端配置说明

## 依赖

```bash
npm install multer xlsx
```

## 环境变量

```env
DATABASE_URL=postgresql://user:password@localhost:5432/attendance
JWT_SECRET=secret-key
PORT=3000
```

## 项目结构

```
src/
├── utils/
│   ├── validators.js
│   └── excelParser.js
├── controllers/
│   └── assistantController.js
└── routes/
    └── assistantRoutes.js
```

---

# 常见问题

| 问题 | 答案 |
|------|------|
| CSV 显示乱码 | 确保 UTF-8 编码 |
| Excel 无法解析 | 保存为 .xlsx |
| 学号重复怎么办 | 使用 upsert 模式 |
| 最多导入多少行 | 1000 行 |

---

**版本历史**: v2.0 (2024-05-14)
