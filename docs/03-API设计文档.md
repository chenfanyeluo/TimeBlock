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

## 4. 分类模块 API

### 4.1 获取分类列表

**接口地址**: `GET /categories`

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
      "color": "#1890ff",
      "icon": "briefcase",
      "sortOrder": 1,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 4.2 创建分类

**接口地址**: `POST /categories`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "name": "学习",
  "color": "#52c41a",
  "icon": "book"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "学习",
    "color": "#52c41a",
    "icon": "book",
    "sortOrder": 2,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 4.3 更新分类

**接口地址**: `PUT /categories/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "name": "学习",
  "color": "#52c41a",
  "icon": "book"
}
```

---

### 4.4 删除分类

**接口地址**: `DELETE /categories/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `action`: `cascade` (级联删除) 或 `transfer` (转移)
- `transferTo`: 目标分类ID (当action为transfer时必填)

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
- `categoryId`: 分类ID
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
        "categoryId": 1,
        "category": {
          "id": 1,
          "name": "工作",
          "color": "#1890ff"
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
  "categoryId": 1,
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
  "categoryId": 1,
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
- `categoryId`: 分类ID

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
    "categories": [
      {
        "categoryId": 1,
        "categoryName": "工作",
        "color": "#1890ff",
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
    "categories": [
      {
        "categoryId": 1,
        "categoryName": "工作",
        "color": "#1890ff",
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

## 8. 计时器模块 API

> 对应数据库表：`active_timers`（每用户同时仅一个运行中的计时器）

### 8.1 开始计时

**接口地址**: `POST /timers/start`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "title": "开发需求分析",
  "categoryId": 1
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "title": "开发需求分析",
    "categoryId": 1,
    "startedAt": "2024-06-07T09:30:00Z",
    "isPaused": false,
    "elapsedPaused": 0,
    "createdAt": "2024-06-07T09:30:00Z"
  }
}
```

**业务规则**:
- 如果该用户已有运行中的计时器，返回 `409 CONFLICT`（需先停止当前计时器）
- `categoryId` 为可选，不传则创建无分类的计时器

---

### 8.2 停止计时

**接口地址**: `POST /timers/stop`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**（可选，停止时可修改最终信息）:
```json
{
  "title": "开发需求分析（已完成）",
  "categoryId": 1,
  "description": "完成项目需求分析文档"
}
```

**响应示例**: 返回新创建的时间块记录
```json
{
  "success": true,
  "data": {
    "timeBlockId": 42,
    "title": "开发需求分析（已完成）",
    "startTime": "2024-06-07T09:30:00Z",
    "endTime": "2024-06-07T11:15:23Z",
    "durationSeconds": 6323,
    "message": "已保存为时间块"
  }
}
```

**业务规则**:
- 自动计算总耗时 = `(now - started_at) - elapsed_paused`
- 将结果写入 `time_blocks` 表（start_time=started_at, end_time=now）
- 删除 `active_timers` 中对应记录
- 若用户无运行中的计时器，返回 `404 NOT_FOUND`

---

### 8.3 暂停计时

**接口地址**: `POST /timers/pause`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "isPaused": true,
    "elapsedPaused": 600,
    "message": "已暂停，累计暂停时长 10 分钟"
  }
}
```

**业务规则**:
- 更新 `active_timers.is_paused = 1`
- 累加本次暂停时长到 `elapsed_paused`
- 已暂停的计时器再次调用幂等返回当前状态

---

### 8.4 恢复计时

**接口地址**: `POST /timers/resume`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "isPaused": false,
    "elapsedPaused": 600,
    "message": "已恢复计时"
  }
}
```

**业务规则**:
- 设置 `active_timers.is_paused = 0`
- 未在暂停状态时调用幂等返回当前状态

---

### 8.5 查询运行中计时器

**接口地址**: `GET /timers/active`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例 - 有运行中的计时器**:
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "timeBlockId": null,
    "title": "开发需求分析",
    "categoryId": 1,
    "category": { "id": 1, "name": "工作", "color": "#1890ff" },
    "startedAt": "2024-06-07T09:30:00Z",
    "isPaused": false,
    "elapsedPaused": 0,
    "elapsedTotal": 3600,
    "createdAt": "2024-06-07T09:30:00Z"
  }
}
```

**响应示例 - 无运行中的计时器**:
```json
{
  "success": true,
  "data": null
}
```

**说明**:
- `elapsedTotal` 由服务端实时计算：`(now - started_at) - elapsed_paused`（未暂停时）或直接取 `elapsed_paused`（已暂停时）
- 此接口用于：应用启动时检查是否有需要恢复的计时器、跨设备同步计时器状态

---

## 9. 错误码补充

| 错误码 | HTTP状态码 | 描述 | 触发场景 |
|--------|----------|------|---------|
| TIMER_ALREADY_RUNNING | 409 | 用户已有运行中的计时器 | 调用 POST /timers/start 时 |
| TIMER_NOT_FOUND | 404 | 无运行中的计时器 | 调用 stop/pause/resume 时 |

