// Dev smoke test for the Live path without a microphone:
// mint an ephemeral token, connect with it (as the browser does), send typed
// text, execute tool calls with the pure functions, and print what comes back.
// Usage: npx tsx --env-file=.env scripts/live-smoke.ts ["question"]
import { GoogleGenAI } from '@google/genai'
import { mintLiveToken } from '../src/lib/viva/mintToken'
import { lookupFinding, getHistory } from '../src/lib/case/findings'
import { CONTROL } from '../src/lib/viva/liveConfig'

const question = process.argv[2] ?? "What's the pressure in the right eye?"
const t0 = performance.now()
const { token, model, apiVersion } = await mintLiveToken()
console.log(`token minted (${apiVersion}) in ${(performance.now() - t0).toFixed(0)} ms; key prefix hidden, token prefix ${token.slice(0, 12)}…`)

const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion } })
let out = ''
let turns = 0
let audioBytes = 0
let sentQuestion = false
const done = new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), 45000)
  ai.live
    .connect({
      model,
      config: { responseModalities: ['AUDIO'] as never },
      callbacks: {
        onopen: () => console.log('socket open'),
        onerror: (e) => reject(new Error(String((e as ErrorEvent).message ?? e))),
        onclose: (e) => console.log('closed', (e as CloseEvent).code, (e as CloseEvent).reason),
        onmessage: (m) => {
          if (m.setupComplete) console.log('setupComplete')
          if (m.toolCall?.functionCalls) {
            const functionResponses = m.toolCall.functionCalls.map((fc) => {
              const args = (fc.args ?? {}) as Record<string, string>
              const result = fc.name === 'get_finding' ? lookupFinding(args as never) : getHistory(args as never)
              console.log('TOOL CALL', fc.name, JSON.stringify(args), '->', JSON.stringify(result))
              return { id: fc.id, name: fc.name, response: { result } }
            })
            session.sendToolResponse({ functionResponses })
          }
          const sc = m.serverContent
          for (const p of sc?.modelTurn?.parts ?? []) if (p.inlineData?.data) audioBytes += p.inlineData.data.length
          if (sc?.outputTranscription?.text) out += sc.outputTranscription.text
          // A turn that only issued a tool call completes with no audio; the readback follows in a new turn.
          if (sc?.turnComplete && audioBytes === 0) console.log('(turn complete with no audio: tool-call turn)')
          if (sc?.turnComplete && audioBytes > 0) {
            turns++
            console.log(`EXAMINER (turn ${turns}): ${out.trim()}  [audio b64 chars: ${audioBytes}]`)
            out = ''
            audioBytes = 0
            if (!sentQuestion) {
              sentQuestion = true
              console.log(`TRAINEE (typed): ${question}`)
              session.sendRealtimeInput({ text: question })
            } else {
              clearTimeout(timer)
              resolve()
            }
          }
        },
      },
    })
    .then((s) => {
      // setupComplete can arrive before connect() resolves, so start here.
      session = s
      s.sendRealtimeInput({ text: CONTROL.start })
    }, reject)
})
let session: Awaited<ReturnType<typeof ai.live.connect>>
await done
session!.close()
console.log(`total ${(performance.now() - t0).toFixed(0)} ms`)
process.exit(0)
