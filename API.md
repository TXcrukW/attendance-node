# 考勤系统 API 完整文档

**最后更新**：2024-05-14 | **版本**: 2.0

## 📋 快速导航

- **🔐 [管理员认证](#管理员认证)** - 登录和授权管理
- **👥 [单个学助添加](#学助管理---单个添加)** - 添加单个学助
- **📊 [批量导入](#学助管理---批量导入)** - 支持 JSON、CSV、Excel 导入
- **⚙️ [其他接口](#学助管理---其他接口)** - 查询、更新、删除等
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

# 学助管理 - 其他接口

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

**请求**：
```
PUT /api/assistants/:id
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 删除学助 — DELETE /api/assistants/:id

**请求**：
```
DELETE /api/assistants/:id
Authorization: Bearer <JWT_TOKEN>
```

---

## 设置上/下班状态 — POST /api/assistants/:id/status

**说明**：该接口用于管理员在后台手动设置学助的上/下班状态。现仅支持新字段 `isOnShift`（必须为 boolean）。

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
