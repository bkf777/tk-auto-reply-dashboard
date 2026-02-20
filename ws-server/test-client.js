// WebSocket 测试客户端
import WebSocket from 'ws'

const WS_URL = process.env.WS_URL || 'ws://localhost:3001'

console.log(`正在连接到 ${WS_URL}...`)

const ws = new WebSocket(WS_URL)

ws.on('open', () => {
  console.log('✓ 已连接到 WebSocket 服务器')
  
  // 发送认证消息（可选）
  // ws.send(JSON.stringify({ type: 'auth', userId: 'test-user-123' }))
  
  // 开始发送心跳
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat' }))
      console.log('❤️  发送心跳')
    }
  }, 10000) // 每10秒发送一次心跳
  
  // 发送测试 ping
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }))
      console.log('📡 发送 ping')
    }
  }, 15000)
})

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString())
    console.log('📨 收到服务器消息:', message)
  } catch (error) {
    console.log('📨 收到服务器消息:', data.toString())
  }
})

ws.on('close', () => {
  console.log('❌ 连接已关闭')
  process.exit(0)
})

ws.on('error', (error) => {
  console.error('❌ WebSocket 错误:', error)
})

// 监听 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n正在关闭连接...')
  ws.close()
})
