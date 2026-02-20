// Protobuf 解析工具 - 用于解析 TikTok 二进制响应
// 无需 .proto 文件，自动提取所有可读字段

/**
 * 简易 Protobuf 解析器（不依赖 .proto）
 * 支持提取：varint、length-delimited（字符串/嵌套消息）、fixed32/64
 */
class SimpleProtobufParser {
  constructor(buffer) {
    this.buffer = new Uint8Array(buffer)
    this.pos = 0
  }

  // 读取 varint（变长整数）
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

  // 读取固定长度字节
  readBytes(length) {
    const bytes = this.buffer.slice(this.pos, this.pos + length)
    this.pos += length
    return bytes
  }

  // 尝试将字节解码为 UTF-8 字符串
  tryDecodeString(bytes) {
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true })
      const str = decoder.decode(bytes)
      // 只保留可打印字符占比 > 80% 的字符串
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

  // 解析整个消息
  parse() {
    const result = {
      fields: {},
      strings: [],
      raw: {}
    }

    while (this.pos < this.buffer.length) {
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

        case 2: // Length-delimited (字符串/嵌套消息/字节)
          const length = this.readVarint()
          const bytes = this.readBytes(length)
          
          // 尝试解码为字符串
          const str = this.tryDecodeString(bytes)
          if (str) {
            result.fields[fieldNumber] = str
            result.strings.push({ field: fieldNumber, value: str })
            result.raw[fieldNumber] = { type: 'string', value: str }
          } else {
            // 可能是嵌套消息，递归解析
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

        case 5: // 32-bit
          const fixed32 = this.readBytes(4)
          result.fields[fieldNumber] = fixed32
          result.raw[fieldNumber] = { type: 'fixed32', value: Array.from(fixed32) }
          break

        default:
          throw new Error(`Unknown wire type: ${wireType}`)
      }
    }

    return result
  }
}

/**
 * 从 Base64 解析 Protobuf 数据
 * @param {string} base64 - Base64 编码的数据
 * @returns {object} 解析结果
 */
function parseProtobufFromBase64(base64) {
  try {
    // Base64 解码
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // 解析 Protobuf
    const parser = new SimpleProtobufParser(bytes)
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
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 从 ArrayBuffer 解析 Protobuf 数据
 * @param {ArrayBuffer} buffer - 二进制数据
 * @returns {object} 解析结果
 */
function parseProtobufFromBuffer(buffer) {
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
    return {
      success: false,
      error: error.message
    }
  }
}

// 导出（用于 Node.js 环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SimpleProtobufParser,
    parseProtobufFromBase64,
    parseProtobufFromBuffer
  }
}
