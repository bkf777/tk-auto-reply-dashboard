import { NextRequest, NextResponse } from 'next/server'

// 占位：仅打印日志，后续可改为调用 /api/chat
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, payload, ts } = body
    console.log('[webhook]', { type, payload, ts })

    if (type === 'message') {
      // TODO: 转发到 /api/chat 或消息队列
      return NextResponse.json({ ok: true, note: '消息已接收（待对接 chat 接口）' })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook error]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
