import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/session?userId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ ok: false, error: '缺少 userId' }, { status: 400 })
  }
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { lastActiveAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ ok: true, sessions })
}

// DELETE /api/session?sessionId=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: '缺少 sessionId' }, { status: 400 })
  }
  await prisma.session.delete({ where: { id: sessionId } })
  return NextResponse.json({ ok: true })
}
