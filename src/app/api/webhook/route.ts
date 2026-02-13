import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, payload, ts } = body

    // TODO: 持久化或转发到队列 / 数据库
    console.log('[webhook]', { type, payload, ts })

    // 示例：自动回复逻辑占位
    if (type === 'message') {
      // 这里可以接入大模型或规则引擎，生成回复
      const reply = `收到消息：${payload?.text || '(无内容)'}`
      return NextResponse.json({ ok: true, reply })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook error]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
