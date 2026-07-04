# 时间块记录器 - API设计文档

## 1. API 概述

### 1.1 基本信息
- **Base URL**: `https://api.timeblock.com/api/v1
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **字符编码**: UTF-8

### 1.2 通用响应格式

#### 成功响应
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

#### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  }
}
```

#### 分页响应
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 1.3 错误码

| 错误码 | HTTP状态码 | 描述 |
|--------|----------|------|
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| UNAUTHORIZED | 401 | 未授权 |
| FORBIDDEN | 403 | 无权限访问 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

---

## 2. 认证模块 API

### 2.1 用户注册

**接口地址**: `POST /auth/register`

**请求参数**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "张三"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "张三",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

---

### 2.2 用户登录

**接口地址**: `POST /auth/login`

**请求参数**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "张三",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

---

### 2.3 刷新Token

**接口地址**: `POST /auth/refresh`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### 2.4 获取当前用户信息

**接口地址**: `GET /auth/me`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "张三",
    "avatar": "https://example.com/avatar.jpg",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 2.5 密码找回

**接口地址**: `POST /auth/forgot-password`

**请求参数**:
```json
{
  "email": "user@example.com"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "message": "重置Token已生成",
    "expiresIn": 3600
  }
}
```

---

### 2.6 重置密码

**接口地址**: `POST /auth/reset-password`

**请求参数**:
```json
{
  "token": "abc123...",
  "newPassword": "newpassword456"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "张三"
    },
    "message": "密码已重置成功"
  }
}
```

---

## 3. 用户模块 API

### 3.1 更新用户信息

**接口地址**: `PUT /users/profile`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "name": "李四",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

---

### 3.2 修改密码

**接口地址**: `PUT /users/password`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "oldPassword": "password123",
  "newPassword": "newpassword456"
}
```

---

## 4. 便签模块 API

### 4.1 获取便签列表

**接口地址**: `GET /notes`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "工作",
      "color": "#409eff",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 4.2 创建便签

**接口地址**: `POST /notes`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "name": "学习",
  "color": "#67c23a"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "学习",
    "color": "#67c23a",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 4.3 更新便签

**接口地址**: `PUT /notes/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "name": "学习",
  "color": "#67c23a"
}
```

---

### 4.4 删除便签

**接口地址**: `DELETE /notes/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**业务规则**: 删除便签时，关联时间块的 `note_id` 置空（不级联删除时间块）

---

## 5. 时间块模块 API

### 5.1 获取时间块列表

**接口地址**: `GET /time-blocks`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `startDate`: 开始日期 (ISO 2024-01-01)
- `endDate`: 结束日期
- `noteId`: 便签ID
- `page`: 页码
- `pageSize`: 每页数量

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "title": "开发需求分析",
        "description": "完成项目需求分析文档",
        "noteId": 1,
        "note": {
          "id": 1,
          "name": "工作",
          "color": "#409eff"
        },
        "startTime": "2024-01-01T09:00:00Z",
        "endTime": "2024-01-01T11:00:00Z",
        "isCompleted": false,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
        "deletedAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

### 5.2 创建时间块

**接口地址**: `POST /time-blocks`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "title": "开发需求分析",
  "description": "完成项目需求分析文档",
  "noteId": 1,
  "startTime": "2024-01-01T09:00:00Z",
  "endTime": "2024-01-01T11:00:00Z",
  "isCompleted": false
}
```

---

### 5.3 更新时间块

**接口地址**: `PUT /time-blocks/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "title": "开发需求分析",
  "description": "完成项目需求分析文档",
  "noteId": 1,
  "startTime": "2024-01-01T09:00:00Z",
  "endTime": "2024-01-01T11:00:00Z",
  "isCompleted": true
}
```

---

### 5.4 删除时间块

**接口地址**: `DELETE /time-blocks/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

---

### 5.5 搜索时间块

**接口地址**: `GET /time-blocks/search`

**说明**: 使用 MySQL FULLTEXT 全文索引进行搜索，支持中文分词（ngram parser），性能远优于 LIKE 模糊匹配。

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `keyword`: 搜索关键词
- `startDate`: 开始日期
- `endDate`: 结束日期
- `noteId`: 便签ID

---

## 6. 统计模块 API

### 6.1 日统计

**接口地址**: `GET /statistics/daily`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `date`: 日期 (ISO 2024-01-01)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "date": "2024-01-01",
    "totalDuration": 28800,
    "notes": [
      {
        "noteId": 1,
        "noteName": "工作",
        "color": "#409eff",
        "duration": 14400,
        "percentage": 50
      }
    ]
  }
}
```

---

### 6.2 周统计

**接口地址**: `GET /statistics/weekly`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `startDate`: 开始日期
- `endDate`: 结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "days": [
      {
        "date": "2024-01-01",
        "totalDuration": 28800
      }
    ],
    "notes": [
      {
        "noteId": 1,
        "noteName": "工作",
        "color": "#409eff",
        "totalDuration": 72000
      }
    ]
  }
}
```

---

### 6.3 月统计

**接口地址**: `GET /statistics/monthly`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `year`: 年份
- `month`: 月份 (1-12)

---

## 7. 数据导出/导入 API

### 8.1 导出数据

**接口地址**: `GET /export`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `format`: json / excel

---

### 7.2 导入数据

**接口地址**: `POST /import`

**请求头**:
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**请求参数**:
- `file`: 数据文件

---

## 8. 数据同步模块 API

### 8.1 上传本地变更

**接口地址**: `POST /sync/upload`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "changes": {
    "notes": [...],
    "timeBlocks": [...]
  },
  "lastSyncAt": "2024-01-01T00:00:00Z",
  "deviceId": "web-client"
}
```

---

### 8.2 下载云端变更

**接口地址**: `GET /sync/download`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `lastSyncAt`: 上次同步时间（可选）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "serverTime": "2024-01-01T12:00:00Z",
    "notes": [...],
    "timeBlocks": [...]
  }
}
```

---

### 8.3 获取同步状态

**接口地址**: `GET /sync/status`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "lastSyncAt": "2024-01-01T00:00:00Z",
    "lastSyncId": 123,
    "totalSyncs": 10,
    "failedSyncs": 0,
    "isOnline": true
  }
}
```

---

### 8.4 获取同步日志

**接口地址**: `GET /sync/logs`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `page`: 页码
- `pageSize`: 每页数量

---

## 9. 错误码补充

| 错误码 | HTTP状态码 | 描述 | 触发场景 |
|--------|----------|------|---------|
| INVALID_TOKEN | 400 | 重置Token无效或已过期 | 调用 POST /auth/reset-password 时 |
| NETWORK_ERROR | - | 网络连接失败 | 同步操作时 |
| SYNC_CONFLICT | 409 | 数据同步冲突 | 上传/下载时检测到冲突 |

