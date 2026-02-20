// 解析用户提供的十六进制数据

const parser = require('./protobuf-parser.js')

const hexString = '08c205109a4e180022024f4b28003206922c0308f0043a223230323630323137313931383538463238333333433541433946464445453445314550bbd4ccdac63358bbd4ccdac633721153696e6761706f72652d43656e7472616c'

console.log('='.repeat(80))
console.log('解析用户提供的十六进制数据')
console.log('='.repeat(80))

// 转换十六进制为 Uint8Array
const bytes = new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))

console.log(`\n📊 数据信息:`)
console.log(`  - 十六进制: ${hexString}`)
console.log(`  - 字节数: ${bytes.length}`)
console.log(`  - Base64: ${Buffer.from(bytes).toString('base64')}`)

// 解析 Protobuf
const result = parser.parseProtobufFromBuffer(bytes.buffer)

if (result.success) {
  console.log('\n✅ 解析成功\n')
  
  console.log('📊 统计:')
  console.log(`  - 字段数: ${result.summary.totalFields}`)
  console.log(`  - 字符串数: ${result.summary.stringCount}`)
  
  console.log('\n📝 所有字符串:')
  result.allStrings.forEach((str, i) => {
    console.log(`  ${i + 1}. "${str}"`)
  })
  
  console.log('\n🗂️  字段详情:')
  Object.entries(result.data.raw).forEach(([fieldNum, data]) => {
    if (data.type === 'varint') {
      console.log(`  字段 #${fieldNum}: ${data.value} (varint)`)
    } else if (data.type === 'string') {
      console.log(`  字段 #${fieldNum}: "${data.value}" (string)`)
    } else {
      console.log(`  字段 #${fieldNum}: ${data.type}`)
    }
  })
  
  console.log('\n\n' + '='.repeat(80))
  console.log('【调试信息】')
  console.log('='.repeat(80))
  
  console.log(`\n这个数据是否会被脚本捕获？`)
  
  // 检查是否符合打印条件
  const hasOK = result.allStrings.includes('OK')
  const hasSystemField = result.allStrings.some(s => s.includes('Singapore') || s.includes('OK'))
  const hasHexID = result.allStrings.some(s => s.match(/^[0-9A-Fa-f]{32,}$/))
  
  console.log(`\n  ✓ 包含 "OK": ${hasOK}`)
  console.log(`  ✓ 包含系统字段: ${hasSystemField}`)
  console.log(`  ✓ 包含纯 Hex ID: ${hasHexID}`)
  
  // 检查深层递归是否能找到消息
  function extractMessageFromProtobuf(buffer, depth = 0) {
    const maxDepth = 10
    if (depth > maxDepth) return null
    
    try {
      const res = parser.parseProtobufFromBuffer(buffer)
      if (!res.success) return null
      
      if (res.allStrings && res.allStrings.length > 0) {
        const filtered = res.allStrings.filter(s => 
          s && s.length > 2 && 
          s !== 'OK' && 
          !s.includes('Singapore') &&
          !s.match(/^[0-9A-Fa-f]{32,}$/)
        )
        if (filtered.length > 0) {
          console.log(`\n  [深度 ${depth}] 找到消息: "${filtered[0]}"`)
          return filtered[0]
        }
      }
      
      if (res.data.raw) {
        for (const [fieldNum, fieldData] of Object.entries(res.data.raw)) {
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
  
  console.log('\n  尝试深层递归提取消息...')
  const message = extractMessageFromProtobuf(bytes.buffer)
  
  if (message) {
    console.log(`\n  ✅ 成功提取: "${message}"`)
    console.log(`\n  脚本会输出: [TK-Auto-Reply] 💬 成功提取消息: ${message}`)
  } else {
    console.log(`\n  ❌ 未找到消息内容`)
    console.log(`\n  脚本不会输出任何消息提取日志`)
  }
  
} else {
  console.log('❌ 解析失败:', result.error)
}

console.log('\n' + '='.repeat(80))
