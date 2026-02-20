// 测试 Protobuf 解析器

const parser = require('./protobuf-parser.js')

// 测试样本
const samples = [
    "CMIFEJlOGAAiAk9LKAAyBpIsAwi8DzoiMjAyNjAyMTcxODQ2NTk2NjVDQzA0ODIyMkFGODlCOTdBNlCvwtfZxjNYr8LX2cYzchFTaW5nYXBvcmUtQ2VudHJhbA==",
    "CMwBEJpOGAAiAk9LKAAyMOIMLQoTCAAgACiFjvvSrOCSAzAeOABQAAoNCAEgACgAMKA4OABQACjWw+vfrOCSAzoiMjAyNjAyMTcxODQ3MjRDMTQ1QkJGMjI2Qjg5NkZBQzM0NVDSiNnZxjNY1YjZ2cYzchFTaW5nYXBvcmUtQ2VudHJhbA=="
]
console.log('='.repeat(60))
console.log('Protobuf 解析测试')
console.log('='.repeat(60))

samples.forEach((sample, index) => {
  console.log(`\n样本 ${index + 1}:`)
  console.log('-'.repeat(60))
  
  const result = parser.parseProtobufFromBase64(sample)
  
  if (result.success) {
    console.log('✅ 解析成功')
    console.log('\n📊 统计信息:')
    console.log(`  - 总字段数: ${result.summary.totalFields}`)
    console.log(`  - 字符串字段数: ${result.summary.stringCount}`)
    
    console.log('\n📝 提取的字符串:')
    result.allStrings.forEach((str, i) => {
      console.log(`  ${i + 1}. "${str}"`)
    })
    
    console.log('\n🔍 详细字段信息:')
    result.summary.strings.forEach(s => {
      console.log(`  字段 #${s.field}: "${s.value}"`)
    })
    
    console.log('\n🗂️  完整数据结构:')
    console.log(JSON.stringify(result.data.raw, null, 2))
  } else {
    console.log('❌ 解析失败:', result.error)
  }
})

console.log('\n' + '='.repeat(60))
