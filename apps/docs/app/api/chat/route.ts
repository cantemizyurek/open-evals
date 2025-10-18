import { convertToModelMessages } from 'ai'
import { docAssistant } from '@open-evals/doc-assistant'

export const runtime = 'edge'

export async function POST(req: Request) {
  const reqJson = await req.json()

  const messages = convertToModelMessages(reqJson.messages, {
    ignoreIncompleteToolCalls: true,
  })

  const result = docAssistant.stream({ messages })

  return result.toUIMessageStreamResponse()
}
