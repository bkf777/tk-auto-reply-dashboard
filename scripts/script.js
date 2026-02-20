// ==UserScript==
// @name         TK Auto Reply
// @namespace    https://github.com/ezrealbbb/tk-auto-reply-userscript
// @version      0.2.0
// @description  自动监听 TikTok 消息并调用后台 AI 回复（需配合 dashboard 后台）
// @author       Pixel-01
// @match        https://www.tiktok.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==

;(function () {
  'use strict'

  // 配置：后台服务地址
  const BACKEND_ORIGIN = 'http://localhost:3000'

  // 简单日志
  const log = (...args) => console.log('[TK-Auto-Reply]', ...args)

  // 生成或获取本地唯一标识（用于标识脚本使用者）
  function getLocalUserId() {
    let id = GM_getValue('tk_local_user_id')
    if (!id) {
      id = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
      GM_setValue('tk_local_user_id', id)
    }
    return id
  }

  // 当前会话 ID（每个聊天窗口一个会话；占位：目前全局一个）
  let currentSessionId = null

  // 从 get_by_user_combo 获取的用户消息缓存
  let cachedReplyText = null

  // WebSocket 触发相关
  let lastAlertTime = 0
  const ALERT_DEBOUNCE_MS = 3000
  let isWaitingForAPIResponse = false

  // HTTP 心跳（用于统计活跃连接）
  const HEARTBEAT_INTERVAL_MS = 10000
  let heartbeatTimer = null

  function sendHeartbeat() {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'undefined') {
        return reject(new Error('GM_xmlhttpRequest not available'))
      }

      GM_xmlhttpRequest({
        method: 'POST',
        url: `${BACKEND_ORIGIN}/api/ws-heartbeat`,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          clientId: getLocalUserId(),
          pageUrl: location.href,
          userAgent: navigator.userAgent,
          ts: Date.now(),
        }),
        onload: (res) => {
          resolve(res)
        },
        onerror: (err) => {
          log('心跳请求失败：', err)
          reject(err)
        },
      })
    })
  }

  function startHeartbeat() {
    if (heartbeatTimer) return
    sendHeartbeat().catch(() => {})
    heartbeatTimer = setInterval(() => {
      sendHeartbeat().catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)
  }

  // 发送事件到后台（webhook 占位）
  function sendToBackend(type, payload) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'undefined') {
        log('GM_xmlhttpRequest 不可用，请确保在油猴环境中运行')
        return reject(new Error('GM_xmlhttpRequest not available'))
      }
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${BACKEND_ORIGIN}/api/webhook`,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ type, payload, ts: Date.now() }),
        onload: (res) => {
          log('后台响应：', res.status, res.responseText)
          resolve(res)
        },
        onerror: (err) => {
          log('请求后台失败：', err)
          reject(err)
        },
      })
    })
  }

  // AI 对话接口（调用后台 /api/chat）
  function chatWithAI(message, tiktokUserId, sessionId) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'undefined') {
        log('GM_xmlhttpRequest 不可用')
        return reject(new Error('GM_xmlhttpRequest not available'))
      }
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${BACKEND_ORIGIN}/api/chat`,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          tiktokUserId,
          message,
          sessionId,
        }),
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText)
            log('AI 回复：', data)
            resolve(data)
          } catch (e) {
            log('解析 AI 回复失败：', e)
            reject(e)
          }
        },
        onerror: reject,
      })
    })
  }

  // 模拟“发送回复到 TikTok 输入框”的占位实现
  // 真实实现需要分析 TikTok 聊天输入框的 DOM 并触发输入/发送事件
  async function sendReplyToTikTok(replyText) {
    log('【占位】准备发送回复到 TikTok：', replyText)
    // TODO:
    // 1. 找到 TikTok 聊天输入框（通常是 contenteditable 或 input）
    // 2. 设置值并触发 input/change 事件
    // 3. 触发发送按钮的点击事件
    // 目前仅打印日志
  }

  // 处理一条新消息
  async function handleNewMessage(text, meta = {}) {
    const tiktokUserId = getLocalUserId()
    try {
      if (!text || !text.trim()) {
        log('收到空消息，跳过处理')
        return
      }
      const res = await chatWithAI(text, tiktokUserId, currentSessionId)
      if (res.ok && res.sessionId) {
        currentSessionId = res.sessionId
      }
      if (res.reply) {
        await sendReplyToTikTok(res.reply)
      }
    } catch (e) {
      log('处理消息失败：', e)
    }
  }

  function decodeUtf8(data) {
    if (typeof data === 'string') return data
    try {
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(data)
    } catch (e) {
      log('UTF-8 解码失败：', e)
      return ''
    }
  }

  // ==================== Protobuf 解析器 ====================
  class SimpleProtobufParser {
    constructor(buffer) {
      this.buffer = new Uint8Array(buffer)
      this.pos = 0
    }

    readVarint() {
      let result = 0
      let shift = 0
      while (this.pos < this.buffer.length) {
        const byte = this.buffer[this.pos++]
        result |= (byte & 0x7f) << shift
        if ((byte & 0x80) === 0) break
        shift += 7
      }
      return result
    }

    readBytes(length) {
      const bytes = this.buffer.slice(this.pos, this.pos + length)
      this.pos += length
      return bytes
    }

    tryDecodeString(bytes) {
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        const str = decoder.decode(bytes)
        const printable = str.split('').filter(c => {
          const code = c.charCodeAt(0)
          return code >= 32 && code <= 126 || code >= 128
        }).length
        if (printable / str.length > 0.8) {
          return str
        }
      } catch (e) {}
      return null
    }

    parse() {
      const result = { fields: {}, strings: [], raw: {} }

      while (this.pos < this.buffer.length) {
        // 保存当前位置，出错时可以恢复
        const startPos = this.pos
        
        try {
          const tag = this.readVarint()
          const fieldNumber = tag >>> 3
          const wireType = tag & 0x7

          switch (wireType) {
            case 0: // Varint
              const varint = this.readVarint()
              result.fields[fieldNumber] = varint
              result.raw[fieldNumber] = { type: 'varint', value: varint }
              break

            case 1: // 64-bit
              const fixed64 = this.readBytes(8)
              result.fields[fieldNumber] = fixed64
              result.raw[fieldNumber] = { type: 'fixed64', value: Array.from(fixed64) }
              break

            case 2: // Length-delimited
              const length = this.readVarint()
              if (length < 0 || length > this.buffer.length - this.pos) {
                // 长度无效，跳过此字段
                break
              }
              const bytes = this.readBytes(length)
              
              const str = this.tryDecodeString(bytes)
              if (str) {
                result.fields[fieldNumber] = str
                result.strings.push({ field: fieldNumber, value: str })
                result.raw[fieldNumber] = { type: 'string', value: str }
              } else {
                try {
                  const nested = new SimpleProtobufParser(bytes).parse()
                  if (nested.strings.length > 0) {
                    result.fields[fieldNumber] = nested
                    result.strings.push(...nested.strings)
                    result.raw[fieldNumber] = { type: 'message', value: nested }
                  } else {
                    result.fields[fieldNumber] = bytes
                    result.raw[fieldNumber] = { type: 'bytes', value: Array.from(bytes) }
                  }
                } catch (e) {
                  result.fields[fieldNumber] = bytes
                  result.raw[fieldNumber] = { type: 'bytes', value: Array.from(bytes) }
                }
              }
              break

            case 3: // Start group (deprecated) - 跳过整个 group
              // 读取直到遇到对应的 end group (wire type 4)
              let depth = 1
              while (depth > 0 && this.pos < this.buffer.length) {
                const groupTag = this.readVarint()
                const groupWireType = groupTag & 0x7
                const groupFieldNumber = groupTag >>> 3
                
                if (groupWireType === 3 && groupFieldNumber === fieldNumber) {
                  depth++
                } else if (groupWireType === 4 && groupFieldNumber === fieldNumber) {
                  depth--
                } else {
                  // 跳过 group 内的字段
                  this.skipField(groupWireType)
                }
              }
              result.raw[fieldNumber] = { type: 'group', value: 'skipped' }
              break

            case 4: // End group (deprecated) - 应该不会单独出现
              // 如果遇到了，说明数据结构有问题，但我们还是尝试继续
              result.raw[fieldNumber] = { type: 'end_group', value: 'unexpected' }
              break

            case 5: // 32-bit
              const fixed32 = this.readBytes(4)
              result.fields[fieldNumber] = fixed32
              result.raw[fieldNumber] = { type: 'fixed32', value: Array.from(fixed32) }
              break

            default:
              // wire type 6, 7 或其他非法值
              // 这通常意味着数据损坏或解析位置错误
              // 尝试跳过一个字节继续解析
              this.pos = startPos + 1
              break
          }
        } catch (e) {
          // 解析出错，跳过当前字节继续尝试
          this.pos = startPos + 1
          if (this.pos >= this.buffer.length) break
        }
      }

      return result
    }

    // 辅助方法：跳过指定 wire type 的字段
    skipField(wireType) {
      switch (wireType) {
        case 0: // Varint
          this.readVarint()
          break
        case 1: // 64-bit
          this.pos += 8
          break
        case 2: // Length-delimited
          const length = this.readVarint()
          this.pos += length
          break
        case 5: // 32-bit
          this.pos += 4
          break
        default:
          // 未知类型，跳过一个字节
          this.pos++
      }
    }
  }

  function parseProtobufData(buffer) {
    try {
      const parser = new SimpleProtobufParser(buffer)
      const result = parser.parse()
      return {
        success: true,
        data: result,
        allStrings: result.strings.map(s => s.value),
        summary: {
          totalFields: Object.keys(result.fields).length,
          stringCount: result.strings.length,
          strings: result.strings
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  // ==================== Protobuf 解析器结束 ====================

  function findTextInJSON(value) {
    if (!value || typeof value !== 'object') return null

    if (value.aweType !== undefined && typeof value.text === 'string' && value.text.length > 0) {
      return value.text
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findTextInJSON(item)
        if (found) return found
      }
      return null
    }

    for (const key of Object.keys(value)) {
      const found = findTextInJSON(value[key])
      if (found) return found
    }

    return null
  }

  function extractTextFromGetByUserCombo(responseText) {
    try {
      const jsonData = JSON.parse(responseText)
      if (jsonData.aweType !== undefined && jsonData.text) {
        return jsonData.text
      }
      return findTextInJSON(jsonData)
    } catch (e) {
      const textMatch = responseText.match(/"text"\s*:\s*"([^"]+)"/)
      if (textMatch && textMatch[1]) return textMatch[1]
    }
    return null
  }

  // 深层递归解析 Protobuf 数据，找出聊天文本
  function extractMessageFromProtobuf(buffer, depth = 0) {
    const maxDepth = 10
    if (depth > maxDepth) return null
    
    try {
      const result = parseProtobufData(buffer)
      if (!result.success) return null
      
      // 查找所有字符串
      if (result.allStrings && result.allStrings.length > 0) {
        // 过滤掉系统字段
        const filtered = result.allStrings.filter(s => 
          s && s.length > 2 && 
          s !== 'OK' && 
          !s.includes('Singapore') &&
          !s.match(/^[0-9A-Fa-f]{32,}$/) // 不是纯 hex ID
        )
        if (filtered.length > 0) {
          return filtered[0] // 返回第一个合法的字符串
        }
      }
      
      // 递归查找嵌套的 bytes 字段
      if (result.data.raw) {
        for (const [fieldNum, fieldData] of Object.entries(result.data.raw)) {
          if (fieldData.type === 'bytes' && Array.isArray(fieldData.value)) {
            const nested = extractMessageFromProtobuf(
              new Uint8Array(fieldData.value), 
              depth + 1
            )
            if (nested) return nested
          }
        }
      }
    } catch (e) {}
    
    return null
  }

  function triggerHandleIfReady() {
    if (!cachedReplyText) return
    const text = cachedReplyText
    cachedReplyText = null
    handleNewMessage(text, { href: location.href })
  }

  function hookFetchAndXHR() {
    log('✅ [Hook] hookFetchAndXHR 开始初始化...')
    log('⏳ 注意：TikTok CSP 禁止脚本注入，/v1/message/ack (XHR) 暂无法监听，仅监听 Fetch 接口')
    
    // 不再尝试注入脚本（被 CSP 阻止），转而依赖 Fetch 拦截
    
    const originalFetch = unsafeWindow.fetch
    if (originalFetch) {
      unsafeWindow.fetch = async function (...args) {
        const url = args[0]?.toString() || ''
        const response = await originalFetch.apply(this, args)

        // 记录网络请求（调试用）
        if (url.includes('/message') || url.includes('/im') || url.includes('/chat')) {
          log('🌐 [Fetch] 请求:', url.split('?')[0].split('/').slice(-2).join('/'))
        }

        // 监听关键接口：/v1/message/get_by_user_combo（通过 Fetch 发送）
        if (url.includes('/v1/message/get_by_user_combo')) {
          try {
            const clonedResponse = response.clone()
            const responseBuffer = await clonedResponse.arrayBuffer()
            
            log('📡 [Fetch关键接口] 检测到: get_by_user_combo', '字节数:', responseBuffer.byteLength)
            
            // 尝试深层 Protobuf 解析
            const pbResult = parseProtobufData(responseBuffer)
            if (pbResult.success) {
              log('  ✓ Protobuf 解析成功，字段数:', pbResult.summary.totalFields)
              log('  ✓ 提取到字符串:', pbResult.allStrings)
            }
            
            const extractedMessage = extractMessageFromProtobuf(responseBuffer)
            if (extractedMessage) {
              log('💬 [Fetch] 成功提取消息:', extractedMessage)
              cachedReplyText = extractedMessage
              triggerHandleIfReady()
              return response
            }
            
            // 回退到 UTF-8 文本解析
            const responseText = decodeUtf8(responseBuffer)
            const extracted = extractTextFromGetByUserCombo(responseText)
            if (extracted) {
              log('💬 [Fetch] UTF-8 提取消息:', extracted)
              cachedReplyText = extracted
              triggerHandleIfReady()
            } else {
              log('  ℹ️  [Fetch] 未找到有效消息内容（可能是 heartbeat 消息）')
            }
          } catch (e) {
            log('⚠️  [Fetch] 接口处理失败:', e.message)
          }
          return response
        }

        // 其他消息接口
        if (url.includes('/message') || url.includes('/conversation') || url.includes('/im') || url.includes('/chat')) {
          try {
            const clonedResponse = response.clone()
            const responseBuffer = await clonedResponse.arrayBuffer()
            
            const pbResult = parseProtobufData(responseBuffer)
            if (pbResult.success) {
              log('  📊 [其他接口] 字段:', pbResult.summary.totalFields, '字符串:', pbResult.allStrings)
              
              const extractedMessage = extractMessageFromProtobuf(responseBuffer)
              if (extractedMessage) {
                log('💬 [其他接口] 成功提取消息:', extractedMessage)
                cachedReplyText = extractedMessage
                triggerHandleIfReady()
                return response
              }
            }
          } catch (e) {}
          
          if (isWaitingForAPIResponse) {
            isWaitingForAPIResponse = false
            setTimeout(() => {
              triggerHandleIfReady()
            }, 500)
          }
        }

        return response
      }
    }

    // Fetch 拦截完成
    log('✅ [Hook] hookFetchAndXHR 初始化完成')
    log('📌 [监听架构] /v1/message/get_by_user_combo → Fetch API (可监听)')
    log('⚠️  [限制] /v1/message/ack → XHR (TikTok CSP 禁止脚本注入，暂无法监听)')
  }

  function hookWebSocket() {
    const OriginalWebSocket = unsafeWindow.WebSocket
    if (!OriginalWebSocket) return
    unsafeWindow.OriginalWebSocket = OriginalWebSocket // 保存引用供调试使用
    function arrayBufferToString(buffer) {
      try {
        const decoder = new TextDecoder('utf-8')
        return decoder.decode(buffer)
      } catch (e) {
        const byteArray = new Uint8Array(buffer)
        return Array.from(byteArray)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ')
      }
    }

    function handleWebSocketMessage(data) {
      try {
        let isNewMessage = false

        if (data instanceof ArrayBuffer) {
          // 尝试 Protobuf 解析
          const pbResult = parseProtobufData(data)
          if (pbResult.success) {
            log('🔍 [WebSocket] Protobuf 解析成功：', pbResult.summary)
            log('📝 提取到的字符串：', pbResult.allStrings)
            
            // 如果包含消息内容，直接处理
            const messageText = pbResult.allStrings.find(s => 
              s.length > 5 && !s.includes('Singapore') && !s.includes('OK')
            )
            if (messageText) {
              log('✉️ [WebSocket] 发现消息内容：', messageText)
              cachedReplyText = messageText
              isNewMessage = true
            }
          }

          // 回退到原有的文本检测
          if (!isNewMessage) {
            const textContent = arrayBufferToString(data)
            const messageKeywords = [
              'x_frontier_msg_id',
              'msg_',
              'x_frontier_traceid',
              'message',
              'content',
            ]
            const excludeKeywords = ['ping', 'pong', 'heartbeat']
            const hasMessageKeyword = messageKeywords.some((keyword) => textContent.includes(keyword))
            const hasExcludeKeyword = excludeKeywords.some((keyword) =>
              textContent.toLowerCase().includes(keyword)
            )
            isNewMessage = hasMessageKeyword && !hasExcludeKeyword
          }
        }

        if (!isNewMessage) return

        const now = Date.now()
        if (now - lastAlertTime < ALERT_DEBOUNCE_MS) return
        lastAlertTime = now

        log('检测到新消息，等待 API 更新消息列表...')
        isWaitingForAPIResponse = true

        setTimeout(() => {
          if (isWaitingForAPIResponse) {
            log('API 响应超时，直接尝试触发处理...')
            isWaitingForAPIResponse = false
            triggerHandleIfReady()
          }
        }, 5000)
      } catch (error) {
        log('处理 WebSocket 消息失败：', error)
      }
    }

    unsafeWindow.WebSocket = function (url, protocols) {
      log('📡 [WebSocket] 检测到新的连接：', url)
      const ws = new OriginalWebSocket(url, protocols)

      const originalAddEventListener = ws.addEventListener.bind(ws)
      ws.addEventListener = function (event, handler, ...args) {
        if (event === 'open') {
          const wrappedOpenHandler = function (e) {
            log('✅ [WebSocket] 连接打开')
            sendToBackend('websocket_connected', {
              url: url,
              userId: getLocalUserId(),
              timestamp: Date.now(),
            }).catch((err) => {
              log('发送 WebSocket 连接证明失败：', err)
            })
            if (handler) handler.call(this, e)
          }
          return originalAddEventListener('open', wrappedOpenHandler, ...args)
        }
        if (event === 'message') {
          const wrappedHandler = function (e) {
            log('📨 [WebSocket] 收到消息，大小:', e.data?.byteLength || e.data?.length || 'unknown')
            log('📨 [WebSocket] 收到消息，内容:',e.data) 
            handleWebSocketMessage(e.data)
            if (handler) handler.call(this, e)
          }
          return originalAddEventListener('message', wrappedHandler, ...args)
        }
        if (event === 'close') {
          const wrappedCloseHandler = function (e) {
            log('❌ [WebSocket] 连接关闭')
            if (handler) handler.call(this, e)
          }
          return originalAddEventListener('close', wrappedCloseHandler, ...args)
        }
        return originalAddEventListener(event, handler, ...args)
      }

      let onopenHandler = null
      let onmessageHandler = null
      let oncloseHandler = null
      
      Object.defineProperty(ws, 'onopen', {
        get() {
          return onopenHandler
        },
        set(handler) {
          onopenHandler = function (e) {
            log('✅ [WebSocket] 连接打开（onopen）')
            sendToBackend('websocket_connected', {
              url: url,
              userId: getLocalUserId(),
              timestamp: Date.now(),
            }).catch((err) => {
              log('发送 WebSocket 连接证明失败：', err)
            })
            if (handler) handler.call(this, e)
          }
        },
      })
      Object.defineProperty(ws, 'onmessage', {
        get() {
          return onmessageHandler
        },
        set(handler) {
          onmessageHandler = function (e) {
            log('📨 [WebSocket] 收到消息（onmessage），大小:', e.data?.byteLength || e.data?.length || 'unknown')
            handleWebSocketMessage(e.data)
            if (handler) handler.call(this, e)
          }
        },
      })
      Object.defineProperty(ws, 'onclose', {
        get() {
          return oncloseHandler
        },
        set(handler) {
          oncloseHandler = function (e) {
            log('❌ [WebSocket] 连接关闭（onclose）')
            if (handler) handler.call(this, e)
          }
        },
      })

      return ws
    }

    unsafeWindow.WebSocket.prototype = OriginalWebSocket.prototype
    unsafeWindow.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING
    unsafeWindow.WebSocket.OPEN = OriginalWebSocket.OPEN
    unsafeWindow.WebSocket.CLOSING = OriginalWebSocket.CLOSING
    unsafeWindow.WebSocket.CLOSED = OriginalWebSocket.CLOSED
    
    // 监听 beforeunload 时设置标记，让后续 hook 也能获取已有连接
    if (typeof unsafeWindow.__tkAutoReplyWebSocketHooked === 'undefined') {
      unsafeWindow.__tkAutoReplyWebSocketHooked = true
      log('✅ [WebSocket] Hook 标记已设置，可以监听新建连接')
    }
  }

  // TODO：根据 TikTok 页面真实 DOM / 事件来监听消息
  // 下面是占位示例：监听页面点击并上报（后续改为监听聊天消息）
  function startListener() {
    log('启动监听（heartbeat + Fetch hook）...')
    startHeartbeat()
    hookFetchAndXHR()
    log('已挂载 Fetch API 监听器（WebSocket 在脚本加载时已挂载）')
  }

  // 初始化
  function init() {
    log('🚀 初始化 TK Auto Reply')
    startListener()
    log('✅ TK Auto Reply 脚本已启动，正在监听：')
    log('   - /v1/message/get_by_user_combo 接口 (Fetch)')
    log('   - WebSocket 消息')
    log('   - 后台心跳已启动')
    // 向后台发送"就绪"事件
    sendToBackend('ready', { url: location.href, title: document.title })
  }

  // 日志
  log('⏳ TK Auto Reply 脚本正在加载...')

  // ⚠️ 关键：立即安装 WebSocket hook（在任何其他代码创建连接前）
  // 必须在这个位置执行，不能延迟到 DOMContentLoaded/load
  log('🔧 [立即] 安装 WebSocket 拦截器...')
  hookWebSocket()
  log('✅ WebSocket 拦截器已安装（最高优先级）')

  // 其他监听器可以延迟安装
  if (document.readyState === 'loading') {
    // 文档仍在加载，监听 DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      log('📖 DOMContentLoaded 事件触发')
      startHeartbeat()
      hookFetchAndXHR()
      log('✅ Fetch 拦截器已安装，心跳已启动')
    })
  } else {
    // 文档已加载，直接启动其他监听器
    log('📖 文档已加载，启动其他监听器')
    startHeartbeat()
    hookFetchAndXHR()
    log('✅ Fetch 拦截器已安装，心跳已启动')
  }

  // 向后台发送"就绪"事件
  window.addEventListener('load', () => {
    log('📖 Window load 事件触发')
    sendToBackend('ready', { url: location.href, title: document.title })
  })

  // ==================== 调试工具 ====================
  // 暴露到全局作用域，方便在控制台调试
  unsafeWindow.__tkAutoReplyDebug = {
    status: () => {
      console.log('=== TK Auto Reply 状态 ===')
      console.log('脚本已加载: ✅')
      console.log('WebSocket Hook 状态:', unsafeWindow.__tkAutoReplyWebSocketHooked ? '✅ 已安装' : '❌ 未安装')
      console.log('本地用户 ID:', getLocalUserId())
      console.log('当前会话 ID:', currentSessionId)
      console.log('缓存消息:', cachedReplyText)
      console.log('心跳计时器:', heartbeatTimer ? '✅ 运行中' : '❌ 未启动')
    },
    testMessage: (text = 'test message from console') => {
      console.log('📨 模拟收到测试消息:', text)
      cachedReplyText = text
      triggerHandleIfReady()
    },
    testWebSocket: () => {
      console.log('🔍 测试 WebSocket 拦截器...')
      console.log('unsafeWindow.WebSocket:', typeof unsafeWindow.WebSocket)
      console.log('WebSocket.toString():', unsafeWindow.WebSocket.toString())
      console.log('是否为原生代码:', unsafeWindow.WebSocket.toString().includes('[native code]'))
      console.log('Hook 标记:', unsafeWindow.__tkAutoReplyWebSocketHooked)
    },
  }

  log('💡 调试工具已加载，在控制台输入以下命令使用：')
  log('   window.__tkAutoReplyDebug.status()        - 查看脚本状态')
  log('   window.__tkAutoReplyDebug.testMessage()   - 模拟收到测试消息')
  log('   window.__tkAutoReplyDebug.testWebSocket() - 测试 WebSocket 拦截器')
})()
