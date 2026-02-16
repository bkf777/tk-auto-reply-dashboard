'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

type Message = {
  id: string
  role: string
  content: string
  createdAt: string
  metadata?: string | null
  user?: { tiktokUserId: string; displayName?: string | null } | null
}

type Session = {
  id: string
  title?: string | null
  lastActiveAt: string
  createdAt: string
  _count?: { messages: number }
}

export default function UserSessionsPage() {
  const params = useParams()
  const userId = params?.userId as string

  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) fetchSessions()
  }, [userId])

  async function fetchSessions() {
    try {
      const res = await fetch(`/api/session?userId=${userId}`)
      const data = await res.json()
      if (data.ok) {
        setSessions(data.sessions)
        if (data.sessions.length > 0) {
          setSelectedSession(data.sessions[0].id)
        }
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedSession) fetchMessages()
  }, [selectedSession])

  async function fetchMessages() {
    if (!selectedSession) return
    try {
      const res = await fetch(`/api/message?sessionId=${selectedSession}&limit=500`)
      const data = await res.json()
      if (data.ok) setMessages(data.messages)
    } catch (e) {
      console.error('Failed to fetch messages:', e)
    }
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('确定删除该会话？')) return
    try {
      const res = await fetch(`/api/session?sessionId=${sessionId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        setSessions(sessions.filter((s) => s.id !== sessionId))
        if (selectedSession === sessionId) {
          setSelectedSession(sessions.length > 1 ? sessions[0].id : null)
        }
      }
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
  }

  if (loading) return <div className="p-8">加载中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="text-sm text-indigo-600 hover:text-indigo-500">
            ← 返回首页
          </a>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">会话详情</h1>
          <p className="mt-1 text-sm text-gray-500">用户 ID: {userId}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 会话列表 */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-medium text-gray-900 mb-4">会话列表</h2>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无会话</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      selectedSession === session.id
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white hover:bg-gray-50 border-gray-200'
                    }`}
                    onClick={() => setSelectedSession(session.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {session.title || '无标题会话'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          消息数: {session._count?.messages || 0}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(session.lastActiveAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSession(session.id)
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 消息列表 */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              消息记录 {selectedSession && `(${selectedSession.slice(0, 8)})`}
            </h2>
            {selectedSession && messages.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无消息</p>
            ) : !selectedSession ? (
              <p className="text-gray-500 text-sm">请选择一个会话</p>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <ul className="divide-y divide-gray-200">
                  {messages.map((msg) => (
                    <li key={msg.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${
                                msg.role === 'user'
                                  ? 'bg-blue-100 text-blue-800'
                                  : msg.role === 'assistant'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {msg.role}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(msg.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
