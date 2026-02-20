// 递归解析字段 #28 的内部结构

const parser = require('./protobuf-parser.js')

// 字段 #28 的内部 bytes 数据
const field28InnerBytes = [
  45, 10, 19, 8, 0, 32, 0, 40,
  133, 142, 251, 210, 172, 224, 146, 3,
  48, 30, 56, 0, 80, 0, 10, 13,
  8, 1, 32, 0, 40, 0, 48, 160,
  56, 56, 0, 80, 0, 40, 214, 195,
  235, 223, 172, 224, 146, 3
]

console.log('='.repeat(70))
console.log('【第二层递归解析】字段 #28 的内部结构')
console.log('='.repeat(70))

console.log('\n📊 字段 #28 的原始数据:')
console.log('十进制:', field28InnerBytes.join(', '))

const hex = field28InnerBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
console.log('\n十六进制:', hex)

// 递归解析
const buffer = new Uint8Array(field28InnerBytes)
const { SimpleProtobufParser } = parser
const level2Parser = new SimpleProtobufParser(buffer)
const result = level2Parser.parse()

console.log('\n✅ 第二层解析成功\n')

console.log('📈 统计:')
console.log(`  - 字段数: ${Object.keys(result.fields).length}`)
console.log(`  - 字符串数: ${result.strings.length}`)

console.log('\n📝 字符串字段:')
if (result.strings.length > 0) {
  result.strings.forEach(s => {
    console.log(`  字段 #${s.field}: "${s.value}"`)
  })
} else {
  console.log('  (无)')
}

console.log('\n🗂️  字段详情:')
Object.entries(result.raw).forEach(([fieldNum, data]) => {
  console.log(`\n  字段 #${fieldNum}:`)
  console.log(`    - 类型: ${data.type}`)
  
  if (data.type === 'varint') {
    console.log(`    - 值: ${data.value}`)
    // 尝试作为时间戳
    if (data.value > 0 && data.value < 2000000) {
      const microsToMs = data.value / 1000
      const date = new Date(microsToMs)
      console.log(`    - 时间戳解析: ${date.toISOString()}`)
    }
  } else if (data.type === 'string') {
    console.log(`    - 值: "${data.value}"`)
  } else if (data.type === 'bytes') {
    console.log(`    - 字节数: ${Array.isArray(data.value) ? data.value.length : data.value.byteLength}`)
    console.log(`    - 前20字节: ${Array.from(data.value || []).slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
  } else if (data.type === 'message') {
    console.log(`    - 嵌套消息，字段数: ${Object.keys(data.value.fields).length}`)
  }
})

console.log('\n\n' + '='.repeat(70))
console.log('【第三层递归尝试】继续解析嵌套的字节字段')
console.log('='.repeat(70))

// 查找嵌套的 bytes 字段并递归解析
Object.entries(result.raw).forEach(([fieldNum, data]) => {
  if (data.type === 'bytes' && Array.isArray(data.value)) {
    console.log(`\n🔍 尝试解析字段 #${fieldNum} 的 bytes 数据...`)
    try {
      const bufferLevel3 = new Uint8Array(data.value)
      const level3Parser = new SimpleProtobufParser(bufferLevel3)
      const level3Result = level3Parser.parse()
      
      console.log(`✅ 解析成功！`)
      console.log(`  - 字段数: ${Object.keys(level3Result.fields).length}`)
      console.log(`  - 字符串数: ${level3Result.strings.length}`)
      
      if (level3Result.strings.length > 0) {
        console.log('  - 发现字符串:')
        level3Result.strings.forEach(s => {
          console.log(`    字段 #${s.field}: "${s.value}"`)
        })
      }
    } catch (e) {
      console.log(`⚠️  解析失败: ${e.message}`)
    }
  }
})

console.log('\n' + '='.repeat(70))
