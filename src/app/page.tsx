'use client'

import { useState, useEffect } from 'react'

type Session = {
  id: string
  title?: string | null
  lastActiveAt: string
  _count?: { messages: number }
}

type User = {
  id: string
  tiktokUserId: string
  displayName?: string | null
  avatarUrl?: string | null
  notes?: string | null
  createdAt: string
  sessionCount: number
  latestSession: Session | null
}

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const res = await fetch('/api/user?limit=100')
      const data = await res.json()
      if (data.ok) setUsers(data.users)
    } catch (e) {
      console.error('Failed to fetch users:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">TK Auto Reply Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">管理 TikTok 用户、会话和消息记录</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="总用户数" value={users.length} />
          <StatCard
            title="活跃会话"
            value={users.filter((u) => u.latestSession).length}
          />
          <StatCard
            title="总消息数"
            value={users.reduce((sum, u) => sum + (u.latestSession?._count?.messages || 0), 0)}
          />
        </div>

        {/* 用户列表 */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">用户列表</h2>
          {loading ? (
            <p>加载中...</p>
          ) : users.length === 0 ? (
            <p className="text-gray-500">暂无用户数据</p>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {users.map((user) => (
                  <li key={user.id}>
                    <a href={`/session/${user.id}`} className="block hover:bg-gray-50">
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt=""
                                className="h-10 w-10 rounded-full"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                                {(user.displayName || user.tiktokUserId).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="ml-4">
                              <p className="text-sm font-medium text-indigo-600 truncate">
                                {user.displayName || user.tiktokUserId}
                              </p>
                              <p className="text-sm text-gray-500">
                                会话数: {user.sessionCount}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {user.latestSession && (
                              <>
                                <p className="text-sm text-gray-900">
                                  最近会话: {user.latestSession.title || '无标题'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  消息数: {user.latestSession._count?.messages || 0}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(user.latestSession.lastActiveAt).toLocaleString()}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
        <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
      </div>
    </div>
  )
}
