// 快速解析新样本

const parser = require('./protobuf-parser.js')

const newSample = 'CMwBEJ9OGAAiAk9LKAAyIeIMHgoTCAAgACj/gd3UsOCSAzAeOABQACidwMTjsOCSAzoiMjAyNjAyMTcxOTA1MjU3RDdDQkNFNDAyMTBFNDg1MDk1MVDliZvaxjNY5omb2sYzchFTaW5nYXBvcmUtQ2VudHJhbA=='

console.log('='.repeat(70))
console.log('新样本解析 - 第一层')
console.log('='.repeat(70))

const result1 = parser.parseProtobufFromBase64(newSample)

if (result1.success) {
  console.log('\n✅ 解析成功')
  console.log('\n📊 统计:')
  console.log(`  - 字段数: ${result1.summary.totalFields}`)
  console.log(`  - 字符串数: ${result1.summary.stringCount}`)
  
  console.log('\n📝 所有字符串:')
  result1.allStrings.forEach((str, i) => {
    console.log(`  ${i + 1}. "${str}"`)
  })
  
  console.log('\n🗂️  字段详情:')
  Object.entries(result1.data.raw).forEach(([fieldNum, data]) => {
    if (data.type === 'string') {
      console.log(`  字段 #${fieldNum}: "${data.value}"`)
    } else if (data.type === 'varint') {
      console.log(`  字段 #${fieldNum}: ${data.value} (0x${data.value.toString(16)})`)
    } else if (data.type === 'bytes') {
      console.log(`  字段 #${fieldNum}: ${Array.isArray(data.value) ? data.value.length : '?'} 字节`)
      
      // 尝试递归解析这个 bytes 字段
      if (Array.isArray(data.value)) {
        console.log('\n    🔍 尝试递归解析这个 bytes 字段...')
        try {
          const bufferLevel2 = new Uint8Array(data.value)
          const level2Parser = new parser.SimpleProtobufParser(bufferLevel2)
          const level2Result = level2Parser.parse()
          
          console.log(`    ✅ 解析成功! 包含 ${Object.keys(level2Result.fields).length} 个字段`)
          
          // 打印第二层的所有字符串
          if (level2Result.strings.length > 0) {
            console.log(`    📝 找到字符串数: ${level2Result.strings.length}`)
            level2Result.strings.forEach(s => {
              console.log(`      字段 #${s.field}: "${s.value}"`)
            })
          }
          
          // 打印第二层的数值字段
          Object.entries(level2Result.raw).forEach(([fn, d]) => {
            if (d.type === 'varint') {
              console.log(`      字段 #${fn}: ${d.value}`)
            } else if (d.type === 'string') {
              console.log(`      字段 #${fn}: "${d.value}"`)
            }
          })
        } catch (e) {
          console.log(`    ❌ 递归解析失败: ${e.message}`)
        }
      }
    }
  })
}

console.log('\n' + '='.repeat(70))
console.log('完整 JSON 结构')
console.log('='.repeat(70))
console.log(JSON.stringify(result1.data.raw, null, 2))
