// 深度解析字段 #6 的嵌套 Protobuf 数据

const parser = require('./protobuf-parser.js')

// 从你提供的数据
const nestedBytesArray = [
  226, 12, 45, 10, 19, 8, 0, 32, 0, 40,
  133, 142, 251, 210, 172, 224, 146, 3, 48, 30,
  56, 0, 80, 0, 10, 13, 8, 1, 32, 0,
  40, 0, 48, 160, 56, 56, 0, 80, 0,
  40, 214, 195, 235, 223, 172, 224, 146, 3
]

console.log('='.repeat(70))
console.log('字段 #6 嵌套 Protobuf 深度解析')
console.log('='.repeat(70))

// 转换为 Buffer
const buffer = Buffer.from(nestedBytesArray)

console.log('\n📊 原始字节数据:')
console.log('十进制:', nestedBytesArray.join(', '))
console.log('\n十六进制:', Array.from(buffer).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '))

// 使用 Protobuf 解析器
const pbParser = new parser.SimpleProtobufParser(buffer)
const result = pbParser.parse()

console.log('\n✅ 解析成功\n')

console.log('📈 统计信息:')
console.log(`  - 总字段数: ${Object.keys(result.fields).length}`)
console.log(`  - 字符串字段数: ${result.strings.length}`)

console.log('\n📝 提取的字符串:')
if (result.strings.length > 0) {
  result.strings.forEach((s, i) => {
    console.log(`  ${i + 1}. 字段 #${s.field}: "${s.value}"`)
  })
} else {
  console.log('  (没有可直接读取的字符串)')
}

console.log('\n📊 所有数字字段 (varint):')
Object.entries(result.raw).forEach(([fieldNum, fieldData]) => {
  if (fieldData.type === 'varint') {
    console.log(`  字段 #${fieldNum}: ${fieldData.value} (0x${fieldData.value.toString(16).toUpperCase()})`)
    
    // 尝试转换为时间戳
    if (fieldData.value > 1000000000 && fieldData.value < 2000000000) {
      const date = new Date(fieldData.value * 1000)
      console.log(`           → 如果是时间戳: ${date.toISOString()}`)
    }
  }
})

console.log('\n🔍 完整数据结构:')
console.log(JSON.stringify(result.raw, null, 2))

// ==================== 手动 Varint 解码 ====================
console.log('\n' + '='.repeat(70))
console.log('Varint 解码详解（手动分析部分字段）')
console.log('='.repeat(70))

function decodeVarint(bytes, startIndex) {
  let result = 0
  let shift = 0
  let index = startIndex
  let decoded = []
  
  while (index < bytes.length) {
    const byte = bytes[index]
    decoded.push(byte)
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
    index++
  }
  
  return { value: result, bytes: decoded, length: decoded.length }
}

// 解析第一个 varint
console.log('\n字段 #1 (Tag: E2 0C):')
console.log('  E2 = 11100010 → Tag = 28, WireType = 2 (length-delimited)')
console.log('  0C = 00001100 → 长度 = 12 字节')

const field1Varint = decodeVarint(nestedBytesArray, 2)
console.log(`\n  首个 length 值: ${field1Varint.value} (0x${field1Varint.value.toString(16).toUpperCase()})`)
console.log(`  字节: ${field1Varint.bytes.map(b => '0x' + b.toString(16).toUpperCase()).join(' ')}`)

// 大 varint 解析 (如字段的消息值)
console.log('\n\n大数值 Varint 解码 (133, 142, 251, 210, 172, 224, 146, 3):')
const largeVarBytes = [133, 142, 251, 210, 172, 224, 146, 3]
let largeValue = 0
let largeShift = 0

largeVarBytes.forEach((byte, i) => {
  console.log(`  字节 ${i+1}: ${byte} = 0x${byte.toString(16).toUpperCase()} = ${byte.toString(2).padStart(8, '0')}`)
  largeValue |= (byte & 0x7f) << largeShift
  largeShift += 7
})

console.log(`\n  解码结果: ${largeValue} (0x${largeValue.toString(16).toUpperCase()})`)
console.log(`  如果是时间戳 (微秒): ${new Date(largeValue / 1000).toISOString()}`)

// ==================== 结构假设 ====================
console.log('\n' + '='.repeat(70))
console.log('📋 Protobuf 结构假设')
console.log('='.repeat(70))

console.log(`
可能的结构（基于数据特征）:

message ChatMessage {
  optional int32 type = 1;              // 消息类型
  optional bytes content = 2;           // 消息内容 (嵌套消息)
  optional int64 sender_id = 3;         // 发送者ID
  optional int64 receiver_id = 4;       // 接收者ID
  optional int64 timestamp_us = 5;      // 时间戳 (微秒)
  ...
}

观察到的数据:
  - 字段编号: 1, 2, 3, 4, 5, 6, 7, 8, 10...
  - 包含多个嵌套消息
  - 有大量时间戳数据
  - 可能包含消息内容/有效载荷
`)

// ==================== 字节流逐位分析 ====================
console.log('\n' + '='.repeat(70))
console.log('🔬 字节流详细分析（逐个Tag+Value）')
console.log('='.repeat(70))

let pos = 0
let msgIndex = 1

while (pos < nestedBytesArray.length && msgIndex <= 20) {
  const byte = nestedBytesArray[pos]
  const tag = byte >>> 3
  const wireType = byte & 0x7
  
  const wireTypeNames = ['Varint', 'Fixed64', 'Length-delimited', '(reserved)', 'Fixed32', '(reserved)']
  
  console.log(`\n消息 ${msgIndex}: 字节位置 ${pos}`)
  console.log(`  Tag 字节: 0x${byte.toString(16).toUpperCase()} = ${byte.toString(2).padStart(8, '0')}`)
  console.log(`  字段编号: #${tag}`)
  console.log(`  Wire Type: ${wireType} (${wireTypeNames[wireType] || '未知'})`)
  
  pos++
  
  switch (wireType) {
    case 0: // Varint
      let result = 0, shift = 0
      while (pos < nestedBytesArray.length) {
        const b = nestedBytesArray[pos]
        result |= (b & 0x7f) << shift
        console.log(`  Varint 字节: 0x${b.toString(16).toUpperCase()}`)
        pos++
        if ((b & 0x80) === 0) break
        shift += 7
      }
      console.log(`  → 值: ${result}`)
      break
      
    case 2: // Length-delimited
      if (pos < nestedBytesArray.length) {
        let len = nestedBytesArray[pos]
        console.log(`  长度字节: 0x${len.toString(16).toUpperCase()} → ${len} 字节`)
        pos++
        
        const contentStart = pos
        const contentEnd = Math.min(pos + len, nestedBytesArray.length)
        const content = nestedBytesArray.slice(contentStart, contentEnd)
        console.log(`  内容: [${content.join(', ')}]`)
        pos = contentEnd
      }
      break
      
    default:
      console.log(`  (Wire type ${wireType} 需要更多字节)`)
  }
  
  msgIndex++
}

console.log('\n' + '='.repeat(70))
