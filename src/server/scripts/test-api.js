/**
 * TimeBlock 服务器 API 健康检查测试
 *
 * 用于 CI/CD 流程中验证服务器是否正常启动
 */

const http = require('http')

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const TIMEOUT = 30000 // 30秒超时

// 测试用例
const TESTS = [
  {
    name: '健康检查',
    path: '/api/health',
    method: 'GET',
    expectedStatus: 200,
    validate: (data) => data.success === true && data.data?.status === 'ok'
  },
  {
    name: 'API 404 处理',
    path: '/api/not-exist',
    method: 'GET',
    expectedStatus: 404,
    validate: (data) => data.success === false && data.error?.code === 'NOT_FOUND'
  }
]

// HTTP 请求函数
function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: method,
      timeout: TIMEOUT
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve({ status: res.statusCode, data: json })
        } catch (e) {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })

    req.end()
  })
}

// 运行测试
async function runTests() {
  console.log('========================================')
  console.log('  TimeBlock API 测试')
  console.log('========================================')
  console.log(`测试地址: ${BASE_URL}`)
  console.log(`测试数量: ${TESTS.length}`)
  console.log('')

  let passed = 0
  let failed = 0

  for (const test of TESTS) {
    console.log(`运行: ${test.name}`)
    console.log(`  请求: ${test.method} ${test.path}`)

    try {
      const result = await request(test.path, test.method)
      console.log(`  状态码: ${result.status}`)

      // 验证状态码
      if (result.status !== test.expectedStatus) {
        console.log(`  ❌ 状态码不匹配 (期望: ${test.expectedStatus})`)
        failed++
        continue
      }

      // 验证响应数据
      if (test.validate && !test.validate(result.data)) {
        console.log(`  ❌ 响应数据验证失败`)
        console.log(`  响应: ${JSON.stringify(result.data)}`)
        failed++
        continue
      }

      console.log(`  ✅ 通过`)
      passed++

    } catch (err) {
      console.log(`  ❌ 请求失败: ${err.message}`)
      failed++
    }

    console.log('')
  }

  console.log('========================================')
  console.log(`  结果: ${passed} 通过, ${failed} 失败`)
  console.log('========================================')

  if (failed > 0) {
    process.exit(1)
  }
}

// 等待服务器启动
async function waitForServer() {
  console.log('等待服务器启动...')

  const maxRetries = 30
  const retryDelay = 1000

  for (let i = 0; i < maxRetries; i++) {
    try {
      await request('/api/health')
      console.log('服务器已就绪')
      return true
    } catch {
      await new Promise(r => setTimeout(r, retryDelay))
    }
  }

  throw new Error('服务器启动超时')
}

// 主流程
async function main() {
  try {
    // 如果设置了等待标志，先等待服务器启动
    if (process.env.WAIT_FOR_SERVER === 'true') {
      await waitForServer()
    }

    await runTests()
  } catch (err) {
    console.error(`测试失败: ${err.message}`)
    process.exit(1)
  }
}

main()