import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // 'active' | 'disconnected' | null (all)

    // 获取总连接统计
    // prisma client may not have strongly-typed property for this model in some setups,
    // use a typed-any reference to avoid TS errors while keeping runtime behavior.
    const ws = (prisma as any).webSocketConnection
    const now = new Date()
    const heartbeatTimeoutMs = 30000
    const staleBefore = new Date(now.getTime() - heartbeatTimeoutMs)

    await ws.updateMany({
      where: {
        status: 'active',
        lastHeartbeatAt: { lt: staleBefore },
      },
      data: {
        status: 'disconnected',
        disconnectedAt: now,
      },
    })

    const totalConnections = await ws.count()
    const activeConnections = await ws.count({
      where: { status: 'active' },
    })
    const disconnectedConnections = totalConnections - activeConnections

    // 构建查询条件
    const whereCondition = status ? { status } : {}

    // 获取详细的连接列表（最近100个）
    const connections = await ws.findMany({
      where: whereCondition,
      orderBy: { connectedAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            tiktokUserId: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    // 按小时统计活跃连接趋势（最近24小时）

    const hourlyStats = []
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourStart = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours())
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

      const count = await ws.count({
        where: {
          connectedAt: { lte: hourEnd },
          OR: [
            { disconnectedAt: null },
            { disconnectedAt: { gte: hourStart } },
          ],
        },
      })

      hourlyStats.push({
        time: hourStart.toISOString(),
        count,
      })
    }

    // 按用户统计活跃连接
    const userStats = await prisma.tikTokUser.findMany({
      select: {
        id: true,
        tiktokUserId: true,
        displayName: true,
        avatarUrl: true,
        _count: {
          select: {
            webSocketConnections: {
              where: { status: 'active' },
            },
          },
        },
      },
      where: {
        webSocketConnections: {
          some: {
            status: 'active',
          },
        },
      },
      take: 20,
    })

    // 手动按活跃连接数排序
    const sortedUserStats = userStats.sort(
      (a, b) => b._count.webSocketConnections - a._count.webSocketConnections
    )

    return NextResponse.json({
      ok: true,
      stats: {
        total: totalConnections,
        active: activeConnections,
        disconnected: disconnectedConnections,
      },
      connections,
      hourlyStats,
      topUsers: sortedUserStats,
    })
  } catch (e: any) {
    console.error('[ws-connections GET error]', e)
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    )
  }
}
