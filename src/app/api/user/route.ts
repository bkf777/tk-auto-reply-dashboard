import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/user - 获取用户列表及最近会话
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  const users = await prisma.tikTokUser.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      sessions: {
        orderBy: { lastActiveAt: 'desc' },
        take: 1,
        select: {
          id: true,
          title: true,
          lastActiveAt: true,
          _count: { select: { messages: true } },
        },
      },
      _count: { select: { sessions: true } },
    },
  })

  const data = users.map((u: any) => ({
    id: u.id,
    tiktokUserId: u.tiktokUserId,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    notes: u.notes,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    sessionCount: u._count.sessions,
    latestSession: u.sessions[0] || null,
  }))

  return NextResponse.json({ ok: true, users: data })
}

// POST /api/user - 更新用户备注
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tiktokUserId, notes } = body
    if (!tiktokUserId) {
      return NextResponse.json({ ok: false, error: 'tiktokUserId 必填' }, { status: 400 })
    }
    const user = await prisma.tikTokUser.update({
      where: { tiktokUserId },
      data: { notes },
    })
    return NextResponse.json({ ok: true, user })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
