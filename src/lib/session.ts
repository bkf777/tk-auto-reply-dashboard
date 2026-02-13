import { prisma } from './prisma'

export type MessageRole = 'user' | 'assistant' | 'system'

export async function ensureUser(tiktokUserId: string, meta?: { displayName?: string; avatarUrl?: string }) {
  return prisma.tikTokUser.upsert({
    where: { tiktokUserId },
    create: {
      tiktokUserId,
      displayName: meta?.displayName,
      avatarUrl: meta?.avatarUrl,
    },
    update: {
      displayName: meta?.displayName ?? undefined,
      avatarUrl: meta?.avatarUrl ?? undefined,
    },
  })
}

export async function getOrCreateSession(userId: string, sessionId?: string) {
  if (sessionId) {
    const existing = await prisma.session.findUnique({ where: { id: sessionId } })
    if (existing && existing.userId === userId) return existing
  }
  return prisma.session.create({
    data: { userId },
  })
}

export async function addMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  userId?: string,
  metadata?: Record<string, any>
) {
  return prisma.message.create({
    data: {
      sessionId,
      userId: role === 'user' ? userId : null,
      role,
      content,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })
}

export async function getSessionContext(sessionId: string, maxMessages = 20) {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: maxMessages,
  })
  return messages.map((m) => ({
    role: m.role as MessageRole,
    content: m.content,
  }))
}

export async function touchSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActiveAt: new Date() },
  })
}
