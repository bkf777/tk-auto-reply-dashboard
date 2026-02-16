import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/message?sessionId=xxx&limit=100&offset=0
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'sessionId 必填' }, { status: 400 })
  }

  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    skip: offset,
    take: limit,
    include: {
      user: { select: { tiktokUserId: true, displayName: true } },
    },
  })

  const total = await prisma.message.count({ where: { sessionId } })

  return NextResponse.json({
    ok: true,
    messages,
    pagination: { total, limit, offset },
  })
}
