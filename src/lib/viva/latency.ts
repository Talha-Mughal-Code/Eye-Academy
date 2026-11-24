// Voice-turn latency. Start = push-to-talk released (activityEnd sent).
// Stop = first examiner audio of the reply scheduled to play (performance.now()).
// Excludes mic hardware/capture delay and audio-device output latency.

export type LatencyTurn = { turn: number; phase: string; toolCall: boolean; startMs: number; firstAudioMs: number; latencyMs: number }

export class LatencyLog {
  turns: LatencyTurn[] = []
  private open: { phase: string; start: number; toolCall: boolean } | null = null

  start(phase: string) {
    this.open = { phase, start: performance.now(), toolCall: false }
  }
  markToolCall() {
    if (this.open) this.open.toolCall = true
  }
  firstAudio(at: number) {
    if (!this.open) return
    const t: LatencyTurn = {
      turn: this.turns.length + 1,
      phase: this.open.phase,
      toolCall: this.open.toolCall,
      startMs: Math.round(this.open.start),
      firstAudioMs: Math.round(at),
      latencyMs: Math.round(at - this.open.start),
    }
    this.turns.push(t)
    this.open = null
    console.table(this.turns)
  }
  summary() {
    const stats = (xs: number[]) => {
      if (!xs.length) return { n: 0, median: null as number | null, max: null as number | null }
      const s = [...xs].sort((a, b) => a - b)
      const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
      return { n: s.length, median: Math.round(m), max: s[s.length - 1] }
    }
    return {
      toolCall: stats(this.turns.filter((t) => t.toolCall).map((t) => t.latencyMs)),
      plain: stats(this.turns.filter((t) => !t.toolCall).map((t) => t.latencyMs)),
    }
  }
  exportJson() {
    const blob = new Blob(
      [JSON.stringify({ definition: 'start=push-to-talk released; stop=first examiner audio scheduled to play; excludes mic and output-device latency', summary: this.summary(), turns: this.turns }, null, 2)],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `latency-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
}
