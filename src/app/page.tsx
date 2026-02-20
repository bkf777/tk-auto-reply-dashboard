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

type WebSocketConnection = {
  id: string
  connectionId: string
  userId?: string | null
  user?: {
    id: string
    tiktokUserId: string
    displayName?: string | null
    avatarUrl?: string | null
  } | null
  userAgent?: string | null
  ipAddress?: string | null
  connectedAt: string
  disconnectedAt?: string | null
  lastHeartbeatAt: string
  status: string
  messageCount: number
}

type WSStats = {
  total: number
  active: number
  disconnected: number
}

type WSData = {
  ok: boolean
  stats: WSStats
  connections: WebSocketConnection[]
  hourlyStats: Array<{ time: string; count: number }>
  topUsers: Array<{
    id: string
    tiktokUserId: string
    displayName?: string | null
    avatarUrl?: string | null
    _count: { webSocketConnections: number }
  }>
}

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [wsData, setWsData] = useState<WSData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchUsers(), fetchWSConnections()])
      .catch((e) => console.error('Failed to fetch data:', e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchWSConnections()
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [])

  async function fetchUsers() {
    try {
      const res = await fetch('/api/user?limit=100')
      const data = await res.json()
      if (data.ok) setUsers(data.users)
    } catch (e) {
      console.error('Failed to fetch users:', e)
    }
  }

  async function fetchWSConnections() {
    try {
      const res = await fetch('/api/ws-connections')
      const data: WSData = await res.json()
      if (data.ok) setWsData(data)
    } catch (e) {
      console.error('Failed to fetch WS connections:', e)
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="总用户数" value={users.length} />
          <StatCard
            title="活跃会话"
            value={users.filter((u) => u.latestSession).length}
          />
          <StatCard
            title="总消息数"
            value={users.reduce((sum, u) => sum + (u.latestSession?._count?.messages || 0), 0)}
          />
          <StatCard
            title="活跃WebSocket"
            value={wsData?.stats.active || 0}
            highlight={true}
          />
          <StatCard
            title="总WebSocket连接"
            value={wsData?.stats.total || 0}
          />
        </div>

        {/* WebSocket 连接信息 */}
        {wsData && (
          <>
            {/* 连接趋势 */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">WebSocket 连接趋势（最近24小时）</h2>
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-end justify-between h-32 gap-1">
                  {wsData.hourlyStats.map((stat, i) => {
                    const maxCount = Math.max(...wsData.hourlyStats.map((s) => s.count))
                    const height = maxCount > 0 ? (stat.count / maxCount) * 100 : 0
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-indigo-500 rounded-t hover:bg-indigo-600 transition"
                        style={{ height: `${Math.max(height, 5)}%` }}
                        title={`${new Date(stat.time).getHours()}:00 - ${stat.count} 连接`}
                      />
                    )
                  })}
                </div>
                <div className="mt-4 text-sm text-gray-600 text-center">
                  峰值: {Math.max(...wsData.hourlyStats.map((s) => s.count))} 连接
                </div>
              </div>
            </div>

            {/* 活跃用户的连接统计 */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">活跃用户 WebSocket 连接</h2>
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                {wsData.topUsers.length === 0 ? (
                  <p className="px-4 py-4 text-gray-500">无活跃的 WebSocket 连接</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {wsData.topUsers.map((user) => (
                      <li key={user.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium">
                                {(user.displayName || user.tiktokUserId).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="ml-4">
                              <p className="text-sm font-medium text-indigo-600">
                                {user.displayName || user.tiktokUserId}
                              </p>
                              <p className="text-xs text-gray-500">{user.tiktokUserId}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              {user._count.webSocketConnections} 活跃连接
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 详细的连接列表 */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                WebSocket 连接详情（最近100个）
              </h2>
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                {wsData.connections.length === 0 ? (
                  <p className="px-4 py-4 text-gray-500">无连接记录</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            用户
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            连接ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            IP地址
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            连接时间
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            最后心跳
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            状态
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            消息数
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {wsData.connections.map((conn) => (
                          <tr key={conn.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {conn.user ? (
                                <div className="flex items-center">
                                  {conn.user.avatarUrl ? (
                                    <img
                                      src={conn.user.avatarUrl}
                                      alt=""
                                      className="h-8 w-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium">
                                      {(conn.user.displayName || conn.user.tiktokUserId)
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                  )}
                                  <span className="ml-2 text-sm text-gray-900">
                                    {conn.user.displayName || conn.user.tiktokUserId}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-500">匿名</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                              {conn.connectionId.slice(0, 8)}...
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {conn.ipAddress || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(conn.connectedAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(conn.lastHeartbeatAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  conn.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {conn.status === 'active' ? '活跃' : '断开'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {conn.messageCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

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

function StatCard({
  title,
  value,
  highlight = false,
}: {
  title: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={`overflow-hidden shadow rounded-lg ${
        highlight ? 'bg-indigo-50 border-2 border-indigo-500' : 'bg-white'
      }`}
    >
      <div className="px-4 py-5 sm:p-6">
        <dt
          className={`text-sm font-medium ${
            highlight ? 'text-indigo-600' : 'text-gray-500'
          } truncate`}
        >
          {title}
        </dt>
        <dd
          className={`mt-1 text-3xl font-semibold ${
            highlight ? 'text-indigo-900' : 'text-gray-900'
          }`}
        >
          {value}
        </dd>
      </div>
    </div>
  )
}
