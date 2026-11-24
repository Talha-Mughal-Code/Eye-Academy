// Browser audio: mic capture -> 16-bit PCM chunks, and gapless playback of 24 kHz PCM from Live.

const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) this.port.postMessage(ch.slice(0))
    return true
  }
}
registerProcessor('pcm-capture', Capture)
`

function floatToPcm16Base64(chunks: Float32Array[]): string {
  const len = chunks.reduce((n, c) => n + c.length, 0)
  const buf = new ArrayBuffer(len * 2)
  const view = new DataView(buf)
  let o = 0
  for (const c of chunks)
    for (let i = 0; i < c.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, c[i]))
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export class MicCapture {
  private ctx?: AudioContext
  private stream?: MediaStream
  private node?: AudioWorkletNode
  private pending: Float32Array[] = []
  private timer?: ReturnType<typeof setInterval>
  recording = false

  /** Captures at the device's native rate; the mime type states the rate and the API resamples. */
  async start(onChunk: (base64: string, mimeType: string) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
    this.ctx = new AudioContext()
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
    await this.ctx.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)
    const src = this.ctx.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(this.ctx, 'pcm-capture')
    this.node.port.onmessage = (e) => {
      if (this.recording) this.pending.push(e.data as Float32Array)
    }
    src.connect(this.node)
    const mime = `audio/pcm;rate=${this.ctx.sampleRate}`
    this.timer = setInterval(() => this.flush(onChunk, mime), 100)
    this.flushNow = () => this.flush(onChunk, mime)
  }
  flushNow: () => void = () => {}
  private flush(onChunk: (b: string, m: string) => void, mime: string) {
    if (!this.pending.length) return
    const chunks = this.pending
    this.pending = []
    onChunk(floatToPcm16Base64(chunks), mime)
  }
  stop() {
    clearInterval(this.timer)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close().catch(() => {})
  }
}

export class PcmPlayer {
  private ctx: AudioContext
  private nextAt = 0
  private live = 0
  /** Called once per examiner turn when that turn's first audio actually starts playing. */
  onFirstAudio: (playingAtPerfNow: number) => void = () => {}
  onDrained: () => void = () => {}
  private turnStarted = false

  constructor() {
    this.ctx = new AudioContext({ sampleRate: 24000 })
  }
  resume() {
    return this.ctx.resume()
  }
  newTurn() {
    this.turnStarted = false
  }
  get playing() {
    return this.live > 0
  }
  enqueue(base64: string) {
    const bin = atob(base64)
    const n = bin.length >> 1
    const data = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const v = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16 >> 16
      data[i] = v / 0x8000
    }
    const buf = this.ctx.createBuffer(1, n, 24000)
    buf.copyToChannel(data, 0)
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.ctx.destination)
    const now = this.ctx.currentTime
    const at = Math.max(now, this.nextAt)
    src.start(at)
    this.nextAt = at + buf.duration
    this.live++
    if (!this.turnStarted) {
      this.turnStarted = true
      // Time the first sample is scheduled to reach the audio graph (excludes device output latency).
      this.onFirstAudio(performance.now() + (at - now) * 1000)
    }
    src.onended = () => {
      this.live--
      if (this.live === 0) this.onDrained()
    }
  }
  close() {
    this.ctx.close().catch(() => {})
  }
}
