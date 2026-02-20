// 测试新的消息提取逻辑

const parser = require('./protobuf-parser.js')

// 添加深层递归解析函数（与脚本保持一致）
function extractMessageFromProtobuf(buffer, depth = 0) {
  const maxDepth = 10
  if (depth > maxDepth) {
    console.log(`  [深度 ${depth}] 达到最大递归深度`)
    return null
  }

  try {
    const result = parser.parseProtobufFromBuffer(buffer)
    if (!result.success) return null

    console.log(`  [深度 ${depth}] 解析成功 - 字段数: ${result.summary.totalFields}, 字符串数: ${result.summary.stringCount}`)

    // 查找所有字符串
    if (result.allStrings && result.allStrings.length > 0) {
      console.log(`    发现字符串: ${result.allStrings.join(', ')}`)
      
      // 过滤掉系统字段
      const filtered = result.allStrings.filter(s => 
        s && s.length > 2 && 
        s !== 'OK' && 
        !s.includes('Singapore') &&
        !s.match(/^[0-9A-Fa-f]{32,}$/) // 不是纯 hex ID
      )
      if (filtered.length > 0) {
        console.log(`    ✅ 找到有效消息: "${filtered[0]}"`)
        return filtered[0]
      }
    }

    // 递归查找嵌套的 bytes 字段
    if (result.data.raw) {
      for (const [fieldNum, fieldData] of Object.entries(result.data.raw)) {
        if (fieldData.type === 'bytes' && Array.isArray(fieldData.value)) {
          console.log(`  [深度 ${depth}] 发现嵌套 bytes 字段 #${fieldNum}，长度 ${fieldData.value.length}，继续递归...`)
          const nested = extractMessageFromProtobuf(
            new Uint8Array(fieldData.value), 
            depth + 1
          )
          if (nested) return nested
        }
      }
    }
  } catch (e) {
    console.log(`  [深度 ${depth}] 解析错误: ${e.message}`)
  }

  return null
}

// 测试用例
const testCases = [
  {
    name: '样本1 (原始heartbeat)',
    base64: 'CMwBEJtOGAAiAk9LKAAyMOIMLQoTCAAgACjr6oPJvd+SAzAeOABQAAoNCAEgACgAMKA4OABQACios97Qvd+SAzoiMjAyNjAyMTcxMDMwMTZGOTY4NTExMTFEMjUwMkI0MDVEMFCqwbzLxjNYrMG8y8YzchFTaW5nYXBvcmUtQ2VudHJhbA=='
  },
  {
    name: '样本2 (原始heartbeat)',
    base64: 'CMwBEKBOGAAiAk9LKAAyIeIMHgoTCAAgACjr6oPJvd+SAzAeOABQACiJn7uZvt+SAzoiMjAyNjAyMTcxMDMyNDg3MzFEQUE2NjU5QTNFNDJEQTNEM1Du6MXLxjNY7+jFy8YzchFTaW5nYXBvcmUtQ2VudHJhbA=='
  },
  {
    name: '新样本 (heartbeat)',
    base64: 'CMwBEJ9OGAAiAk9LKAAyIeIMHgoTCAAgACj/gd3UsOCSAzAeOABQACidwMTjsOCSAzoiMjAyNjAyMTcxOTA1MjU3RDdDQkNFNDAyMTBFNDg1MDk1MVDliZvaxjNY5omb2sYzchFTaW5nYXBvcmUtQ2VudHJhbA=='
  }
]

console.log('='.repeat(80))
console.log('【深层递归消息提取测试】')
console.log('='.repeat(80))

testCases.forEach((tc, index) => {
  console.log(`\n\n【测试 ${index + 1}】${tc.name}`)
  console.log('-'.repeat(80))

  try {
    // 解码 Base64
    const binaryString = atob(tc.base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    console.log(`📦 原始数据大小: ${bytes.length} 字节`)
    console.log(`\n🔍 开始递归解析...\n`)

    const message = extractMessageFromProtobuf(bytes)

    console.log(`\n${'='.repeat(80)}`)
    if (message) {
      console.log(`✅ 最终结果: "${message}"`)
    } else {
      console.log(`❌ 未找到消息内容（这些都是 heartbeat/status 消息）`)
    }
    console.log(`${'='.repeat(80)}`)
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`)
  }
})

console.log('\n\n' + '='.repeat(80))
console.log('【总结】')
console.log('='.repeat(80))
console.log(`
✅ 现在的脚本能够：
  1. 监听 /v1/message/ack 和 /v1/message/get_by_user_combo 接口
  2. 对响应数据进行深层递归 Protobuf 解析（最深10层）
  3. 自动过滤系统字段，提取实际的聊天文本
  4. 将提取到的消息发送给 AI

💡 当接收到真实的用户消息时，脚本会：
  - 在控制台显示 "💬 成功提取消息: [消息内容]"
  - 调用后台 AI API 生成回复
  - 自动将回复发送回 TikTok

⚠️  目前测试的都是系统级 heartbeat 消息，没有实际用户文本。
    在真实聊天场景下会有不同的数据结构。
`)
