import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientId, pageUrl, userAgent } = body || {}

    if (!clientId) {
      return NextResponse.json(
        { ok: false, error: 'clientId is required' },
        { status: 400 }
      )
    }

    const ws = (prisma as any).webSocketConnection
    const now = new Date()
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null

    await ws.upsert({
      where: { connectionId: clientId },
      create: {
        connectionId: clientId,
        status: 'active',
        connectedAt: now,
        lastHeartbeatAt: now,
        userAgent: userAgent || req.headers.get('user-agent') || null,
        ipAddress: ipAddress ? String(ipAddress) : null,
        metadata: JSON.stringify({
          pageUrl: pageUrl || null,
        }),
      },
      update: {
        status: 'active',
        lastHeartbeatAt: now,
        userAgent: userAgent || req.headers.get('user-agent') || null,
        ipAddress: ipAddress ? String(ipAddress) : null,
        metadata: JSON.stringify({
          pageUrl: pageUrl || null,
        }),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[ws-heartbeat POST error]', e)
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    )
  }
}
