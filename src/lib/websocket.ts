import { prisma } from './prisma'
import { randomUUID } from 'crypto'

// WebSocket 连接管理器
export class WebSocketManager {
  private static connections = new Map<string, {
    ws: any
    userId?: string
    connectedAt: Date
    lastHeartbeatAt: Date
    messageCount: number
    metadata?: any
  }>()

  // 注册新连接
  static async registerConnection(
    ws: any,
    connectionId: string,
    userId?: string,
    userAgent?: string,
    ipAddress?: string,
    metadata?: any
  ) {
    try {
      // 在数据库中创建记录
      await prisma.webSocketConnection.create({
        data: {
          connectionId,
          userId,
          userAgent,
          ipAddress,
          status: 'active',
          messageCount: 0,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      })

      // 存储在内存中
      this.connections.set(connectionId, {
        ws,
        userId,
        connectedAt: new Date(),
        lastHeartbeatAt: new Date(),
        messageCount: 0,
        metadata,
      })

      console.log(`[WS] 新连接注册: ${connectionId}, 用户: ${userId || '匿名'}, 总连接数: ${this.connections.size}`)
    } catch (error) {
      console.error('[WS] 注册连接失败:', error)
      throw error
    }
  }

  // 注销连接
  static async unregisterConnection(connectionId: string) {
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

  // 更新心跳
  static async updateHeartbeat(connectionId: string) {
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

  // 增加消息计数
  static async incrementMessageCount(connectionId: string) {
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

  // 关联用户
  static async associateUser(connectionId: string, userId: string) {
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

  // 获取活跃连接数
  static getActiveConnectionCount(): number {
    return this.connections.size
  }

  // 获取所有连接ID
  static getConnectionIds(): string[] {
    return Array.from(this.connections.keys())
  }

  // 清理过期连接（心跳超时）
  static async cleanupStaleConnections(timeoutMs: number = 5 * 60 * 1000) {
    const now = new Date()
    const staleConnections: string[] = []

    this.connections.forEach((conn, connectionId) => {
      const timeSinceHeartbeat = now.getTime() - conn.lastHeartbeatAt.getTime()
      if (timeSinceHeartbeat > timeoutMs) {
        staleConnections.push(connectionId)
      }
    })

    for (const connectionId of staleConnections) {
      console.log(`[WS] 清理过期连接: ${connectionId}`)
      await this.unregisterConnection(connectionId)
    }

    return staleConnections.length
  }

  // 广播消息给指定用户的所有连接
  static broadcastToUser(userId: string, message: any) {
    let count = 0
    this.connections.forEach((conn, connectionId) => {
      if (conn.userId === userId) {
        try {
          conn.ws.send(JSON.stringify(message))
          count++
        } catch (error) {
          console.error(`[WS] 发送消息失败 (${connectionId}):`, error)
        }
      }
    })
    return count
  }

  // 广播消息给所有连接
  static broadcastToAll(message: any) {
    let count = 0
    this.connections.forEach((conn, connectionId) => {
      try {
        conn.ws.send(JSON.stringify(message))
        count++
      } catch (error) {
        console.error(`[WS] 发送消息失败 (${connectionId}):`, error)
      }
    })
    return count
  }
}

// 定期清理过期连接
setInterval(() => {
  WebSocketManager.cleanupStaleConnections()
}, 60 * 1000) // 每分钟检查一次
