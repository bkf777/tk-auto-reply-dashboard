// 比对所有样本，找出差异模式

const parser = require('./protobuf-parser.js')

const samples = {
  '样本1-原始': 'CMwBEJtOGAAiAk9LKAAyMOIMLQoTCAAgACjr6oPJvd+SAzAeOABQAAoNCAEgACgAMKA4OABQACios97Qvd+SAzoiMjAyNjAyMTcxMDMwMTZGOTY4NTExMTFEMjUwMkI0MDVEMFCqwbzLxjNYrMG8y8YzchFTaW5nYXBvcmUtQ2VudHJhbA==',
  '样本2-原始': 'CMwBEKBOGAAiAk9LKAAyIeIMHgoTCAAgACjr6oPJvd+SAzAeOABQACiJn7uZvt+SAzoiMjAyNjAyMTcxMDMyNDg3MzFEQUE2NjU5QTNFNDJEQTNEM1Du6MXLxjNY7+jFy8YzchFTaW5nYXBvcmUtQ2VudHJhbA==',
  '新样本': 'CMwBEJ9OGAAiAk9LKAAyIeIMHgoTCAAgACj/gd3UsOCSAzAeOABQACidwMTjsOCSAzoiMjAyNjAyMTcxOTA1MjU3RDdDQkNFNDAyMTBFNDg1MDk1MVDliZvaxjNY5omb2sYzchFTaW5nYXBvcmUtQ2VudHJhbA=='
}

console.log('='.repeat(80))
console.log('多样本对比分析')
console.log('='.repeat(80))

const analysisResults = {}

Object.entries(samples).forEach(([name, base64]) => {
  console.log(`\n\n【${name}】`)
  console.log('-'.repeat(80))
  
  const result = parser.parseProtobufFromBase64(base64)
  
  if (result.success) {
    analysisResults[name] = {
      field1: result.data.raw['1']?.value,
      field2: result.data.raw['2']?.value,
      field6Bytes: result.data.raw['6']?.value,
      field7: result.data.raw['7']?.value,
      field10: result.data.raw['10']?.value,
      allStrings: result.allStrings
    }
    
    console.log(`字段 #1 (消息类型): ${result.data.raw['1'].value}`)
    console.log(`字段 #2 (序列号): ${result.data.raw['2'].value}`)
    console.log(`字段 #6 (字节数): ${Array.isArray(result.data.raw['6'].value) ? result.data.raw['6'].value.length : '?'}`)
    console.log(`字段 #7 (消息ID): ${result.data.raw['7'].value}`)
    console.log(`字段 #10 (时间戳): ${result.data.raw['10'].value}`)
    
    console.log('\n字段 #6 的字节数组:')
    const field6Bytes = result.data.raw['6'].value
    if (Array.isArray(field6Bytes)) {
      console.log(field6Bytes.join(', '))
    }
  }
})

console.log('\n\n' + '='.repeat(80))
console.log('【对比分析】\n')
console.log('-'.repeat(80))

// 比对字段 #6 的差异
console.log('\n📊 字段 #6 的变化:')
Object.entries(analysisResults).forEach(([name, data]) => {
  if (data.field6Bytes && Array.isArray(data.field6Bytes)) {
    const hex = data.field6Bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
    console.log(`\n${name}:`)
    console.log(`  十进制: ${data.field6Bytes.join(', ')}`)
    console.log(`  十六进制: ${hex}`)
    console.log(`  字节数: ${data.field6Bytes.length}`)
  }
})

console.log('\n\n' + '='.repeat(80))
console.log('【结论】\n')
console.log('-'.repeat(80))

console.log(`
所有样本都是"系统心跳/状态消息"的特征：
  ✓ 字段 #4 都是 "OK"
  ✓ 字段 #14 都是 "Singapore-Central"
  ✓ 字段 #7 是消息ID（时间戳+随机）
  ✓ 没有找到聊天文本

这些数据包含的是：
  - 消息路由信息（时间戳、服务器区域）
  - 消息元数据（序列号、ID）
  - 但没有实际的用户聊天内容

📌 要找到真正的聊天消息，需要：
  1. 抓取用户之间的真实对话
  2. 找一个包含非"OK"状态或有实际文本内容的样本
  3. 或者需要 TikTok IM 的完整 Protobuf schema
`)
