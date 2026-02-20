import { WebSocketServer } from 'ws'
import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PORT = process.env.WS_PORT || 3001

// 连接管理器
class ConnectionManager {
  constructor() {
    this.connections = new Map()
  }

  async register(ws, connectionId, userAgent, ipAddress) {
    try {
      // 在数据库中创建记录
      await prisma.webSocketConnection.create({
        data: {
          connectionId,
          userAgent,
          ipAddress,
          status: 'active',
          messageCount: 0,
        },
      })

      // 存储在内存中
      this.connections.set(connectionId, {
        ws,
        userId: null,
        connectedAt: new Date(),
        lastHeartbeatAt: new Date(),
        messageCount: 0,
      })

      console.log(`[WS] 新连接注册: ${connectionId}, 总连接数: ${this.connections.size}`)
      return true
    } catch (error) {
      console.error('[WS] 注册连接失败:', error)
      return false
    }
  }

  async unregister(connectionId) {
    try {
      const conn = this.connections.get(connectionId)
      if (!conn) return

      // 更新数据库记录
      await prisma.webSocketConnection.update({
        where: { connectionId },
        data: {
          status: 'disconnected',
          disconnectedAt: new Date(),
        },
      })

      // 从内存中移除
      this.connections.delete(connectionId)

      console.log(`[WS] 连接断开: ${connectionId}, 剩余连接数: ${this.connections.size}`)
    } catch (error) {
      console.error('[WS] 注销连接失败:', error)
    }
  }

  async updateHeartbeat(connectionId) {
    try {
      const conn = this.connections.get(connectionId)
      if (!conn) return

      conn.lastHeartbeatAt = new Date()

      // 更新数据库
      await prisma.webSocketConnection.update({
        where: { connectionId },
        data: { lastHeartbeatAt: new Date() },
      })
    } catch (error) {
      console.error('[WS] 更新心跳失败:', error)
    }
  }

  async incrementMessageCount(connectionId) {
    try {
      const conn = this.connections.get(connectionId)
      if (!conn) return

      conn.messageCount++

      // 更新数据库
      await prisma.webSocketConnection.update({
        where: { connectionId },
        data: { messageCount: { increment: 1 } },
      })
    } catch (error) {
      console.error('[WS] 更新消息计数失败:', error)
    }
  }

  async associateUser(connectionId, userId) {
    try {
      const conn = this.connections.get(connectionId)
      if (!conn) return

      conn.userId = userId

      // 更新数据库
      await prisma.webSocketConnection.update({
        where: { connectionId },
        data: { userId },
      })

      console.log(`[WS] 连接 ${connectionId} 已关联用户 ${userId}`)
    } catch (error) {
      console.error('[WS] 关联用户失败:', error)
    }
  }

  getActiveCount() {
    return this.connections.size
  }

  async cleanupStale(timeoutMs = 5 * 60 * 1000) {
    const now = new Date()
    const staleConnections = []

    this.connections.forEach((conn, connectionId) => {
      const timeSinceHeartbeat = now.getTime() - conn.lastHeartbeatAt.getTime()
      if (timeSinceHeartbeat > timeoutMs) {
        staleConnections.push(connectionId)
      }
    })

    for (const connectionId of staleConnections) {
      console.log(`[WS] 清理过期连接: ${connectionId}`)
      await this.unregister(connectionId)
    }

    return staleConnections.length
  }

  broadcastToUser(userId, message) {
    let count = 0
    this.connections.forEach((conn) => {
      if (conn.userId === userId) {
        try {
          conn.ws.send(JSON.stringify(message))
          count++
        } catch (error) {
          console.error('[WS] 发送消息失败:', error)
        }
      }
    })
    return count
  }

  broadcastToAll(message) {
    let count = 0
    this.connections.forEach((conn) => {
      try {
        conn.ws.send(JSON.stringify(message))
        count++
      } catch (error) {
        console.error('[WS] 发送消息失败:', error)
      }
    })
    return count
  }
}

const manager = new ConnectionManager()

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ port: PORT })

wss.on('connection', async (ws, req) => {
  const connectionId = randomUUID()
  const userAgent = req.headers['user-agent']
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  console.log(`[WS] 新连接: ${connectionId} from ${ipAddress}`)

  const registered = await manager.register(
    ws,
    connectionId,
    userAgent,
    typeof ipAddress === 'string' ? ipAddress : ipAddress?.[0]
  )

  if (!registered) {
    ws.close()
    return
  }

  // 发送连接成功消息
  ws.send(JSON.stringify({
    type: 'connected',
    connectionId,
    timestamp: new Date().toISOString(),
  }))

  // 处理收到的消息
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString())
      
      // 增加消息计数
      await manager.incrementMessageCount(connectionId)

      // 处理不同类型的消息
      switch (message.type) {
        case 'heartbeat':
          // 心跳
          await manager.updateHeartbeat(connectionId)
          ws.send(JSON.stringify({ 
            type: 'heartbeat_ack', 
            timestamp: new Date().toISOString() 
          }))
          break

        case 'auth':
          // 用户认证，关联用户ID
          if (message.userId) {
            await manager.associateUser(connectionId, message.userId)
            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              userId: message.userId,
              timestamp: new Date().toISOString(),
            }))
          }
          break

        case 'ping':
          // 简单的 ping/pong
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: new Date().toISOString() 
          }))
          break

        case 'broadcast':
          // 广播消息
          if (message.target === 'all') {
            const count = manager.broadcastToAll(message.data)
            ws.send(JSON.stringify({ 
              type: 'broadcast_success', 
              count,
              timestamp: new Date().toISOString() 
            }))
          }
          break

        default:
          console.log(`[WS] 收到消息 (${connectionId}):`, message.type)
      }
    } catch (error) {
      console.error(`[WS] 处理消息失败 (${connectionId}):`, error)
    }
  })

  // 处理连接关闭
  ws.on('close', async () => {
    console.log(`[WS] 连接关闭: ${connectionId}`)
    await manager.unregister(connectionId)
  })

  // 处理错误
  ws.on('error', async (error) => {
    console.error(`[WS] 连接错误 (${connectionId}):`, error)
    await manager.unregister(connectionId)
  })
})

// 定期清理过期连接
setInterval(() => {
  manager.cleanupStale()
}, 60 * 1000) // 每分钟检查一次

// 定期打印统计信息
setInterval(() => {
  console.log(`[WS] 当前活跃连接数: ${manager.getActiveCount()}`)
}, 30 * 1000) // 每30秒打印一次

console.log(`✓ WebSocket Server 已启动在端口 ${PORT}`)
console.log(`✓ 可以通过 ws://localhost:${PORT} 连接`)

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing WebSocket server')
  wss.close()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('\nSIGINT signal received: closing WebSocket server')
  wss.close()
  await prisma.$disconnect()
  process.exit(0)
})
