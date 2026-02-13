import OpenAI from 'openai'

const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const apiKey = process.env.OPENAI_API_KEY || ''
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

if (!apiKey) {
  console.warn('[AI] OPENAI_API_KEY 未设置，AI 接口将无法正常工作')
}

export const openai = new OpenAI({ apiKey, baseURL })

export async function chat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts?: { maxTokens?: number; temperature?: number }
) {
  const res = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: opts?.maxTokens ?? 256,
    temperature: opts?.temperature ?? 0.7,
  })
  const choice = res.choices[0]
  return {
    content: choice?.message?.content || '',
    usage: res.usage,
    model: res.model,
  }
}
