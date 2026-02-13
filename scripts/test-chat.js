// 测试 /api/chat 接口
// 用法: node scripts/test-chat.js [message]

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const tiktokUserId = 'test-user-001'

async function main() {
  const message = process.argv[2] || '你好，请介绍一下你自己'
  let sessionId = process.argv[3] || null

  console.log('--- 测试 /api/chat ---')
  console.log('BASE_URL:', BASE_URL)
  console.log('tiktokUserId:', tiktokUserId)
  console.log('message:', message)
  if (sessionId) console.log('sessionId:', sessionId)

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tiktokUserId,
      message,
      sessionId,
      userMeta: { displayName: '测试用户' },
      maxContext: 10,
    }),
  })

  const data = await res.json()
  console.log('\n响应:')
  console.log(JSON.stringify(data, null, 2))

  if (data.ok && data.sessionId) {
    console.log('\n提示: 下次可使用该 sessionId 继续会话:')
    console.log(`node scripts/test-chat.js "你叫什么名字" ${data.sessionId}`)
  }
}

main().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
