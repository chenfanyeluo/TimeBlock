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
        "updatedAt": "2024-01-01T00:00:00Z"
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

## 7. WebDAV模块 API

### 7.1 获取WebDAV配置

**接口地址**: `GET /webdav/config`

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
    "serverUrl": "https://dav.jianguoyun.com/dav/",
    "username": "user@example.com",
    "lastSyncAt": "2024-01-01T00:00:00Z",
    "syncInterval": 30
  }
}
```

---

### 7.2 配置WebDAV

**接口地址**: `POST /webdav/config`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求参数**:
```json
{
  "serverUrl": "https://dav.jianguoyun.com/dav/",
  "username": "user@example.com",
  "password": "password123",
  "syncInterval": 30
}
```

---

### 7.3 测试WebDAV连接

**接口地址**: `POST /webdav/test`

**请求头**:
```
Authorization: Bearer {accessToken}
```

---

### 7.4 手动同步

**接口地址**: `POST /webdav/sync`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "syncId": "sync-12345",
    "status": "in_progress",
    "startedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 7.5 获取同步状态

**接口地址**: `GET /webdav/sync/:syncId`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "syncId": "sync-12345",
    "status": "completed",
    "startedAt": "2024-01-01T00:00:00Z",
    "completedAt": "2024-01-01T00:05:00Z",
    "uploaded": 10,
    "downloaded": 5,
    "conflicts": 0
  }
}
```

---

### 7.6 获取同步历史

**接口地址**: `GET /webdav/sync-history`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `page`: 页码
- `pageSize`: 每页数量

---

## 8. 数据导出/导入 API

### 8.1 导出数据

**接口地址**: `GET /export`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `format`: json / excel

---

### 8.2 导入数据

**接口地址**: `POST /import`

**请求头**:
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**请求参数**:
- `file`: 数据文件

