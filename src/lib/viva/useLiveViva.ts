// Client controller for one voice viva: Gemini Live session, push-to-talk,
// tool execution with the pure functions, phase machine, transcript, latency.
import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleGenAI, type LiveServerMessage, type Session } from '@google/genai'
import { lookupFinding, getHistory, type SingleResult, type FindingResult, type HistoryResult } from '../case/findings'
import { CONTROL } from './liveConfig'
import { vivaReducer, initialVivaState, toolsAllowed, isSpokenReady, type VivaEvent, type VivaState } from './phase'
import { MicCapture, PcmPlayer } from './audio'
import { LatencyLog } from './latency'
import { getLiveToken, chooseFollowUp } from '../../server/live'

export type Status = 'idle' | 'connecting' | 'your_turn' | 'recording' | 'thinking' | 'speaking' | 'ended' | 'error'
export type Line = { role: 'examiner' | 'trainee'; text: string; ts: number }
export type Card =
  | { kind: 'available'; id: string; eye: string | null; label: string; value: string; method: string | null; display: string; ts: number }
  | { kind: 'unavailable'; id: string; eye: string | null; label: string; reason: string; display: string; ts: number }
  | { kind: 'history'; id: string; label: string; display: string; text: string; ts: number }
  | { kind: 'not_in_case'; id: string; label: string; display: string; ts: number }

export type VivaHooks = {
  getIdToken: () => Promise<string>
  onLine?: (l: Line) => void
  onCard?: (c: Card) => void
  onPhase?: (s: VivaState) => void
  onDone?: (s: VivaState, transcript: Line[]) => void
}

function toCards(fr: FindingResult | HistoryResult, name: string): Card[] {
  const ts = Date.now()
  if (fr.status === 'not_in_case') return [{ kind: 'not_in_case', id: `nic-${ts}`, label: fr.query, display: fr.display, ts }]
  if (fr.status === 'both_eyes') return fr.results.flatMap((r) => toCards(r, name))
  if (name === 'get_history' && 'topic' in fr) return [{ kind: 'history', id: fr.topic, label: fr.label, text: fr.text, display: fr.display, ts }]
  const r = fr as SingleResult
  if (r.status === 'unavailable') return [{ kind: 'unavailable', id: r.id, eye: r.eye, label: r.label, reason: r.reason, display: r.display, ts }]
  return [{ kind: 'available', id: r.id, eye: r.eye, label: r.label, value: r.valueText, method: r.method, display: r.display, ts }]
}

export function useLiveViva(hooks: VivaHooks) {
  const [status, setStatusState] = useState<Status>('idle')
  const [viva, setViva] = useState<VivaState>(initialVivaState)
  const [transcript, setTranscript] = useState<Line[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [error, setError] = useState<string | null>(null)
  const [latencyTurns, setLatencyTurns] = useState(0)

  const statusRef = useRef<Status>('idle')
  const vivaRef = useRef<VivaState>(initialVivaState)
  const transcriptRef = useRef<Line[]>([])
  const hooksRef = useRef(hooks)
  hooksRef.current = hooks
  const sessionRef = useRef<Session | null>(null)
  const micRef = useRef<MicCapture | null>(null)
  const playerRef = useRef<PcmPlayer | null>(null)
  const latencyRef = useRef(new LatencyLog())
  const buf = useRef({ user: '', exam: '', turnHadAudio: false, turnComplete: false, closing: false })

  const setStatus = (s: Status) => {
    statusRef.current = s
    setStatusState(s)
  }
  const dispatch = (e: VivaEvent) => {
    const next = vivaReducer(vivaRef.current, e)
    if (next !== vivaRef.current) {
      vivaRef.current = next
      setViva(next)
      hooksRef.current.onPhase?.(next)
    }
  }
  const addLine = (role: Line['role'], text: string) => {
    const t = text.replace(/\s+/g, ' ').trim()
    if (!t) return
    const l = { role, text: t, ts: Date.now() }
    transcriptRef.current = [...transcriptRef.current, l]
    setTranscript(transcriptRef.current)
    hooksRef.current.onLine?.(l)
  }
  const sendText = (text: string) => sessionRef.current?.sendRealtimeInput({ text })

  const endSession = useCallback(() => {
    if (statusRef.current === 'ended') return
    setStatus('ended')
    try {
      sessionRef.current?.close()
    } catch {}
    sessionRef.current = null
    micRef.current?.stop()
    playerRef.current?.close()
    hooksRef.current.onDone?.(vivaRef.current, transcriptRef.current)
  }, [])

  const goReady = useCallback(() => {
    if (vivaRef.current.phase !== 'findings' || !sessionRef.current) return
    dispatch({ type: 'READY' })
    sendText(CONTROL.answer)
    setStatus('thinking')
  }, [])

  const finalizeUser = () => {
    const text = buf.current.user
    buf.current.user = ''
    if (!text.trim()) return
    addLine('trainee', text)
    const phase = vivaRef.current.phase
    if (phase === 'answer') dispatch({ type: 'TRAINEE_TURN_DONE', text })
    if (phase === 'findings' && isSpokenReady(text)) goReady()
  }

  const onExaminerTurnEnd = async () => {
    addLine('examiner', buf.current.exam)
    buf.current = { ...buf.current, exam: '', turnHadAudio: false, turnComplete: false }
    playerRef.current?.newTurn()
    const s = vivaRef.current
    if (buf.current.closing || s.phase === 'done') return endSession()
    if (s.phase === 'answer' && s.answerText) {
      setStatus('thinking')
      try {
        const f = await chooseFollowUp({ data: { idToken: await hooksRef.current.getIdToken(), answer: s.answerText } })
        dispatch({ type: 'FOLLOWUP_CHOSEN', question: f.question })
        sendText(CONTROL.followUp(f.question))
      } catch (e) {
        setError(`Could not choose follow-up: ${(e as Error).message}`)
        setStatus('your_turn')
      }
      return
    }
    if (s.phase === 'followup' && !s.followUpAsked) dispatch({ type: 'EXAMINER_TURN_DONE' })
    setStatus('your_turn')
  }

  const onMessage = (m: LiveServerMessage) => {
    const session = sessionRef.current
    if (m.toolCall?.functionCalls && session) {
      latencyRef.current.markToolCall()
      const allowed = toolsAllowed(vivaRef.current.phase)
      const functionResponses = m.toolCall.functionCalls.map((fc) => {
        const args = (fc.args ?? {}) as Record<string, string>
        if (!allowed) return { id: fc.id, name: fc.name, response: { result: { status: 'blocked', message: 'The findings phase is over. Do not look up findings.' } } }
        const result = fc.name === 'get_history' ? getHistory({ topic: args.topic }) : lookupFinding({ finding: args.finding, eye: args.eye })
        const newCards = toCards(result, fc.name ?? '')
        setCards((c) => [...c, ...newCards])
        newCards.forEach((c) => hooksRef.current.onCard?.(c))
        return { id: fc.id, name: fc.name, response: { result } }
      })
      session.sendToolResponse({ functionResponses })
    }
    const sc = m.serverContent
    if (!sc) return
    if (sc.inputTranscription?.text) buf.current.user += sc.inputTranscription.text
    if (sc.outputTranscription?.text) buf.current.exam += sc.outputTranscription.text
    for (const p of sc.modelTurn?.parts ?? []) {
      if (p.inlineData?.data && statusRef.current !== 'ended') {
        buf.current.turnHadAudio = true
        playerRef.current?.enqueue(p.inlineData.data)
      }
    }
    if (sc.turnComplete) {
      finalizeUser()
      // A turn that only issued a tool call completes without audio; keep "thinking".
      if (!buf.current.turnHadAudio) return
      buf.current.turnComplete = true
      if (!playerRef.current?.playing) onExaminerTurnEnd()
    }
  }

  const start = useCallback(async () => {
    setError(null)
    setStatus('connecting')
    try {
      const player = new PcmPlayer() // created inside the click so audio may autoplay
      await player.resume()
      player.onFirstAudio = (at) => {
        latencyRef.current.firstAudio(at)
        setLatencyTurns(latencyRef.current.turns.length)
        setStatus('speaking')
      }
      player.onDrained = () => {
        if (buf.current.turnComplete) onExaminerTurnEnd()
      }
      playerRef.current = player

      const mic = new MicCapture()
      await mic.start((data, mimeType) => sessionRef.current?.sendRealtimeInput({ audio: { data, mimeType } }))
      micRef.current = mic

      const { token, model, apiVersion } = await getLiveToken({ data: { idToken: await hooksRef.current.getIdToken() } })
      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion } })
      // Config is locked into the token server-side; responseModalities repeated for the SDK.
      const session = await ai.live.connect({
        model,
        config: { responseModalities: ['AUDIO'] as never },
        callbacks: {
          onmessage: onMessage,
          onerror: (e) => {
            setError(`Live error: ${(e as ErrorEvent).message ?? 'unknown'}`)
          },
          onclose: (e) => {
            if (statusRef.current !== 'ended') {
              setError(`Connection closed${e.reason ? `: ${e.reason}` : ''} (code ${e.code})`)
              setStatus('error')
              micRef.current?.stop()
            }
          },
        },
      })
      sessionRef.current = session
      sendText(CONTROL.start)
      setStatus('thinking')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
      micRef.current?.stop()
    }
  }, [])

  const pressStart = useCallback(() => {
    if (statusRef.current !== 'your_turn' || !sessionRef.current || !micRef.current) return
    sessionRef.current.sendRealtimeInput({ activityStart: {} })
    micRef.current.recording = true
    setStatus('recording')
  }, [])

  const pressEnd = useCallback(() => {
    if (statusRef.current !== 'recording' || !sessionRef.current || !micRef.current) return
    micRef.current.recording = false
    micRef.current.flushNow()
    sessionRef.current.sendRealtimeInput({ activityEnd: {} })
    latencyRef.current.start(vivaRef.current.phase)
    setStatus('thinking')
    const s = vivaRef.current
    if (s.phase === 'followup' && s.followUpAsked) {
      // The trainee has answered the single follow-up: end the viva (enforced in code).
      dispatch({ type: 'TRAINEE_TURN_DONE', text: '' })
      buf.current.closing = true
      sendText(CONTROL.close)
    }
  }, [])

  useEffect(() => () => {
    try {
      sessionRef.current?.close()
    } catch {}
    micRef.current?.stop()
    playerRef.current?.close()
  }, [])

  return {
    status,
    viva,
    transcript,
    cards,
    error,
    latency: latencyRef.current,
    latencyTurns,
    start,
    pressStart,
    pressEnd,
    ready: goReady,
    canTalk: status === 'your_turn' || status === 'recording',
  }
}
