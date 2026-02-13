import { NextRequest, NextResponse } from 'next/server'
import { ensureUser, getOrCreateSession, addMessage, getSessionContext, touchSession } from '@/lib/session'
import { chat } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tiktokUserId, message, sessionId, userMeta, maxContext = 20 } = body || {}

    if (!tiktokUserId || !message) {
      return NextResponse.json({ ok: false, error: 'tiktokUserId 和 message 为必填' }, { status: 400 })
    }

    // 1. 确保 TikTok 用户存在
    const user = await ensureUser(tiktokUserId, userMeta)

    // 2. 获取或创建会话
    const session = await getOrCreateSession(user.id, sessionId)

    // 3. 添加用户消息
    await addMessage(session.id, 'user', message, user.id)

    // 4. 拉取上下文（最近 N 条）
    const context = await getSessionContext(session.id, maxContext)

    // 5. 调用 AI
    const aiRes = await chat(context)

    // 6. 保存 AI 回复
    await addMessage(session.id, 'assistant', aiRes.content)

    // 7. 更新会话活跃时间
    await touchSession(session.id)

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      reply: aiRes.content,
      usage: aiRes.usage,
      model: aiRes.model,
    })
  } catch (e: any) {
    console.error('[chat error]', e)
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
