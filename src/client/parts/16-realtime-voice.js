    // ── Real-time voice input ───────────────────────────────────────────────
    // The official voice bundle records first and transcribes only on Stop. This
    // button records the microphone itself and writes a live transcript into the
    // composer draft through `inputActions.setDraft`.
    //
    // Audio path: microphone → AudioWorklet (ScriptProcessor fallback) → 16 kHz
    // mono float samples. The Host validates each upload as a canonical 16 kHz
    // mono PCM16 WAV (`validateWave` in the speech-to-text package), so capture
    // resamples explicitly instead of trusting `AudioContext({ sampleRate })`.
    // Only audio added since the previous transcript is uploaded, with a short
    // overlap that the text merger removes; Stop runs one full-recording
    // transcription whose result replaces the incremental preview. That keeps
    // encoding/upload linear instead of re-encoding the whole recording per tick.
    //
    // It is only mounted when the speech Remote is available; otherwise the
    // official microphone stays visible and untouched.
    const LIVE_VOICE_CLASS = 'dsh-live-voice'
    const VOICE_SAMPLE_RATE = 16000
    const VOICE_MAX_SECONDS = 60
    const VOICE_CHUNK_SAMPLES = VOICE_SAMPLE_RATE * 1.2
    const VOICE_OVERLAP_SAMPLES = VOICE_SAMPLE_RATE * 0.4
    const VOICE_MIN_CHUNK_SAMPLES = VOICE_SAMPLE_RATE * 0.5
    const VOICE_TICK_MS = 200
    const VOICE_SILENCE_STOP_MS = 5000
    const VOICE_NO_SPEECH_STOP_MS = 6000
    const VOICE_SPEECH_RMS = 0.01
    const VOICE_MAX_FAILURES = 3
    const VOICE_FLUSH_TIMEOUT_MS = 160
    // Microphone constraints, richest first; every entry degrades one processing
    // feature so a picky driver still yields a usable 16 kHz mono stream.
    const VOICE_MIC_ATTEMPTS = [
      { audio: { channelCount: { ideal: 1 }, echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, autoGainControl: { ideal: true } } },
      { audio: { channelCount: { ideal: 1 }, echoCancellation: { ideal: true }, noiseSuppression: { ideal: true } } },
      { audio: { channelCount: { ideal: 1 }, echoCancellation: { ideal: true } } },
      { audio: { channelCount: { ideal: 1 } } },
      { audio: true },
    ]

    /** True when the OS asks for reduced motion (no continuous animation). */
    const prefersReducedMotion = () => {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
      } catch {
        return false
      }
    }

    /**
     * Best-effort identity of the visible session: the host store first, then the
     * selected sidebar row. Used to release the microphone when the user switches
     * conversations while recording.
     */
    const currentSessionKey = () => {
      try {
        const id = bridge.currentSessionId
        if (typeof id === 'string' && id !== '') return id
      } catch {
        // Bridge not mounted on this page.
      }
      try {
        const row = document.querySelector(
          '[role="treeitem"][data-row-key^="session:"][aria-selected="true"],[role="treeitem"][data-row-key^="session:"][class*="selected"]',
        )
        const key = row === null ? '' : (row.getAttribute('data-row-key') ?? '')
        if (key.startsWith('session:')) return key.slice('session:'.length)
      } catch {
        // Restricted document.
      }
      return ''
    }

    // The worklet runs on the audio thread: resample to 16 kHz with a linear
    // interpolator that carries its phase across render quanta, and post ~64 ms
    // float chunks plus an RMS level. The main thread therefore does no
    // per-sample work during recording.
    const VOICE_WORKLET_SOURCE = [
      'class DshVoiceCaptureProcessor extends AudioWorkletProcessor {',
      '  constructor() {',
      '    super()',
      '    const rate = typeof sampleRate === "number" && sampleRate > 0 ? sampleRate : 48000',
      '    this.ratio = Math.max(0.0001, rate / 16000)',
      '    this.prev2 = 0',
      '    this.prev = 0',
      '    this.pos = 0',
      '    this.pending = new Float32Array(1024)',
      '    this.pendingLength = 0',
      '    this.port.onmessage = (event) => {',
      '      const data = event.data',
      '      if (data === null || typeof data !== "object") return',
      '      if (data.type === "flush") {',
      '        this.flush()',
      '        this.port.postMessage({ type: "flushed" })',
      '      }',
      '    }',
      '  }',
      '  flush() {',
      '    if (this.pendingLength === 0) return',
      '    const out = this.pending.slice(0, this.pendingLength)',
      '    let sum = 0',
      '    for (let i = 0; i < out.length; i += 1) sum += out[i] * out[i]',
      '    this.port.postMessage({ type: "pcm", pcm: out.buffer, rms: Math.sqrt(sum / out.length) }, [out.buffer])',
      '    this.pendingLength = 0',
      '  }',
      '  push(sample) {',
      '    if (this.pendingLength === this.pending.length) this.flush()',
      '    this.pending[this.pendingLength] = sample',
      '    this.pendingLength += 1',
      '  }',
      '  process(inputs) {',
      '    const channels = inputs[0]',
      '    if (channels === undefined || channels.length === 0) return true',
      '    const input = channels[0]',
      '    const length = input.length',
      '    if (length < 2) return true',
      '    const ratio = this.ratio',
      '    let pos = this.pos',
      '    while (pos <= length - 2) {',
      '      const index = Math.floor(pos)',
      '      let value',
      '      if (index === -1) value = this.prev + (input[0] - this.prev) * (pos + 1)',
      '      else if (index < -1) value = this.prev2 + (this.prev - this.prev2) * (pos + 2)',
      '      else value = input[index] + (input[index + 1] - input[index]) * (pos - index)',
      '      this.push(value)',
      '      pos += ratio',
      '    }',
      '    this.prev2 = this.prev',
      '    this.prev = input[length - 1]',
      '    this.pos = pos - length',
      '    return true',
      '  }',
      '}',
      'registerProcessor("dsh-voice-capture", DshVoiceCaptureProcessor)',
    ].join('\n')

    function mountRealtimeVoice(ctx) {
      let speech = null
      try {
        speech = ctx.remote?.speech ?? null
      } catch {
        speech = null
      }
      if (speech === null || typeof speech.transcribe !== 'function') return () => {}

      let catalogPromise = null
      const getCatalog = (refresh = false) => {
        if (refresh || catalogPromise === null) {
          catalogPromise = Promise.resolve()
            .then(() => (typeof speech.catalog === 'function' ? speech.catalog() : null))
            .catch(() => null)
        }
        return catalogPromise
      }

      /** Linear-interpolation resampler for the ScriptProcessor fallback. */
      class VoiceResampler {
        constructor(inputRate, outputRate) {
          this.ratio = inputRate > 0 ? inputRate / outputRate : 1
          this.prev2 = 0
          this.prev = 0
          this.pos = 0
        }

        push(input) {
          const length = input.length
          if (length < 2) return null
          const out = new Float32Array(Math.ceil(length / this.ratio) + 2)
          let count = 0
          let pos = this.pos
          while (pos <= length - 2) {
            const index = Math.floor(pos)
            let value
            if (index === -1) value = this.prev + (input[0] - this.prev) * (pos + 1)
            else if (index < -1) value = this.prev2 + (this.prev - this.prev2) * (pos + 2)
            else value = input[index] + (input[index + 1] - input[index]) * (pos - index)
            out[count] = value
            count += 1
            pos += this.ratio
          }
          this.prev2 = this.prev
          this.prev = input[length - 1]
          this.pos = pos - length
          return count === 0 ? null : out.subarray(0, count)
        }
      }

      /** Canonical 16 kHz mono PCM16 WAV → canonical base64 (Host requirement). */
      const encodeWavBase64 = (samples) => {
        const bytes = new Uint8Array(44 + samples.length * 2)
        const view = new DataView(bytes.buffer)
        const writeText = (offset, text) => {
          for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i)
        }
        writeText(0, 'RIFF')
        view.setUint32(4, bytes.length - 8, true)
        writeText(8, 'WAVE')
        writeText(12, 'fmt ')
        view.setUint32(16, 16, true)
        view.setUint16(20, 1, true)
        view.setUint16(22, 1, true)
        view.setUint32(24, VOICE_SAMPLE_RATE, true)
        view.setUint32(28, VOICE_SAMPLE_RATE * 2, true)
        view.setUint16(32, 2, true)
        view.setUint16(34, 16, true)
        writeText(36, 'data')
        view.setUint32(40, samples.length * 2, true)
        for (let i = 0; i < samples.length; i += 1) {
          const value = Math.max(-1, Math.min(1, samples[i]))
          view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 0x8000 : 0x7fff)), true)
        }
        let binary = ''
        const block = 0x2000
        for (let offset = 0; offset < bytes.length; offset += block) {
          binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + block))
        }
        return btoa(binary)
      }

      /** Concatenate the [from, to) sample range of a chunk list. */
      const sliceSamples = (chunks, from, to) => {
        const start = Math.max(0, from)
        const end = Math.max(start, to)
        const out = new Float32Array(end - start)
        let cursor = 0
        let offset = 0
        for (const chunk of chunks) {
          const chunkStart = cursor
          const chunkEnd = cursor + chunk.length
          cursor = chunkEnd
          if (chunkEnd <= start) continue
          if (chunkStart >= end) break
          const localStart = Math.max(start, chunkStart) - chunkStart
          const localEnd = Math.min(end, chunkEnd) - chunkStart
          out.set(chunk.subarray(localStart, localEnd), offset)
          offset += localEnd - localStart
        }
        // Never fabricate trailing silence for a range past the captured audio.
        return offset === out.length ? out : out.subarray(0, offset)
      }

      const VOICE_MATCH_PUNCTUATION = /[\s,，。.!！?？;；:：、'"“”‘’()（）\[\]【】{}<>《》〈〉…—–~～`·]/

      /** Strip punctuation/spaces so overlap matching survives ASR drift. */
      const normalizeTranscript = (text) => {
        let output = ''
        const map = []
        for (let i = 0; i < text.length; i += 1) {
          const character = text[i]
          if (VOICE_MATCH_PUNCTUATION.test(character)) continue
          output += character.toLowerCase()
          map.push(i)
        }
        return { text: output, map }
      }

      /**
       * Append only the new tail of an overlapping chunk transcript. Chunks share
       * ~0.4 s of audio, so their texts share a suffix/prefix seam; matching that
       * seam (exactly first, then punctuation-insensitively) removes the words a
       * naive concatenation would duplicate.
       */
      const mergeTranscript = (committed, incoming) => {
        const base = typeof committed === 'string' ? committed : ''
        const next = typeof incoming === 'string' ? incoming.trim() : ''
        if (next === '') return base
        if (base === '') return next
        if (base === next || base.endsWith(next)) return base
        const maxExact = Math.min(base.length, next.length, 48)
        for (let size = maxExact; size >= 2; size -= 1) {
          if (base.slice(base.length - size) === next.slice(0, size)) return base + next.slice(size)
        }
        const baseNormalized = normalizeTranscript(base)
        const nextNormalized = normalizeTranscript(next)
        const maxNormalized = Math.min(baseNormalized.text.length, nextNormalized.text.length, 48)
        for (let size = maxNormalized; size >= 2; size -= 1) {
          if (baseNormalized.text.slice(baseNormalized.text.length - size) === nextNormalized.text.slice(0, size)) {
            const consumed = nextNormalized.map[size - 1] + 1
            return base + next.slice(consumed)
          }
        }
        if (next.startsWith(base)) return next
        const needsSpace = /[A-Za-z0-9]$/.test(base) && /^[A-Za-z0-9]/.test(next)
        return needsSpace ? base + ' ' + next : base + next
      }

      const readComposerText = () => {
        const editor = document.querySelector('[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]) [contenteditable="true"]')
        if (editor === null) return ''
        // Lexical's contenteditable innerText carries trailing/duplicate line
        // breaks; feeding those back makes the composer grow on every recording.
        return (editor.innerText ?? '')
          .replace(/\u200b/g, '')
          .replace(/\r/g, '')
          .replace(/\n+/g, '\n')
          .replace(/^\n+/, '')
          .replace(/\n+$/, '')
      }

      function RealtimeVoiceButton(props) {
        const inputActions = props.inputActions
        const [recording, setRecording] = React.useState(false)
        const [error, setError] = React.useState('')
        const sessionRef = React.useRef(null)
        const stopRef = React.useRef(null)
        const barsRef = React.useRef([null, null, null])
        const ringRef = React.useRef(null)

        const commitDraft = (session, text) => {
          if (inputActions === undefined || typeof inputActions.setDraft !== 'function') return
          if (session !== undefined && session !== null && session.revealedText === text) return
          try {
            inputActions.setDraft(text)
            if (session !== undefined && session !== null) session.revealedText = text
          } catch {
            // The composer may be submitting; skip this tick.
          }
        }

        // Smooth the block-level transcribe results into a typewriter reveal so
        // the draft grows a few characters at a time instead of jumping a whole
        // phrase at once (the speech Remote has no token stream).
        const applyDraft = (text, session, immediate = false) => {
          if (inputActions === undefined || typeof inputActions.setDraft !== 'function') return
          if (session === undefined || session === null) {
            commitDraft(session, text)
            return
          }
          session.targetText = text
          const current = session.revealedText ?? session.base ?? ''
          // Reduced motion: no typewriter reveal, insert the transcript at once.
          if (immediate || prefersReducedMotion() || !text.startsWith(current)) {
            if (session.revealTimer) {
              window.clearInterval(session.revealTimer)
              session.revealTimer = 0
            }
            commitDraft(session, text)
            return
          }
          if (text === current) return
          if (session.revealTimer) return
          session.revealTimer = window.setInterval(() => {
            const revealed = session.revealedText ?? ''
            const target = session.targetText ?? ''
            if (revealed === target) {
              window.clearInterval(session.revealTimer)
              session.revealTimer = 0
              return
            }
            if (!target.startsWith(revealed)) {
              window.clearInterval(session.revealTimer)
              session.revealTimer = 0
              commitDraft(session, target)
              return
            }
            const step = Math.min(2, target.length - revealed.length)
            commitDraft(session, revealed + target.slice(revealed.length, revealed.length + step))
          }, 22)
        }

        const releaseReveal = (session) => {
          if (session !== null && session.revealTimer !== 0) {
            window.clearInterval(session.revealTimer)
            session.revealTimer = 0
          }
        }

        /** Disconnect every capture node and stop the microphone tracks. */
        const disposeCapture = (session) => {
          session.released = true
          const node = session.workletNode
          session.workletNode = null
          if (node !== null) {
            try {
              node.port.onmessage = null
            } catch {
              // Port already closed.
            }
            try {
              node.disconnect()
            } catch {
              // Already disconnected.
            }
          }
          const processor = session.processor
          session.processor = null
          if (processor !== null) {
            try {
              processor.onaudioprocess = null
            } catch {
              // Already released.
            }
            try {
              processor.disconnect()
            } catch {
              // Already disconnected.
            }
          }
          const source = session.source
          session.source = null
          if (source !== null) {
            try {
              source.disconnect()
            } catch {
              // Already disconnected.
            }
          }
          const silentGain = session.silentGain
          session.silentGain = null
          if (silentGain !== null) {
            try {
              silentGain.disconnect()
            } catch {
              // Already disconnected.
            }
          }
          const stream = session.stream
          session.stream = null
          if (stream !== null) {
            for (const track of stream.getTracks()) {
              try {
                track.stop()
              } catch {
                // Track already ended.
              }
            }
          }
        }

        const closeAudioContext = async (session) => {
          const context = session.audioContext
          session.audioContext = null
          if (context === null || context.state === 'closed') return
          try {
            await context.close()
          } catch {
            // Closing a suspended context can reject; nothing left to release.
          }
        }

        /** Ask the worklet to post its partial buffer, bounded by a timeout. */
        const flushWorklet = (session) => {
          const node = session.workletNode
          if (node === null || session.usingWorklet !== true) return Promise.resolve()
          return new Promise((resolve) => {
            let settled = false
            const finish = () => {
              if (settled) return
              settled = true
              if (session.flushResolve === finish) session.flushResolve = null
              resolve()
            }
            session.flushResolve = finish
            try {
              node.port.postMessage({ type: 'flush' })
            } catch {
              finish()
              return
            }
            window.setTimeout(finish, VOICE_FLUSH_TIMEOUT_MS)
          })
        }

        /** Append one resampled 16 kHz block and track speech energy. */
        const onPcm = (session, samples, rms) => {
          // `released` (not `stopping`) is the cutoff: Stop flushes the worklet
          // before releasing, so the final ~64 ms still reaches the final pass.
          if (sessionRef.current !== session || session.released) return
          if (samples.length === 0) return
          session.chunks.push(samples)
          session.total += samples.length
          session.level = rms
          if (rms > VOICE_SPEECH_RMS) {
            session.lastVoiceAt = performance.now()
            session.voiceSinceCursor = true
          }
        }

        /** Map the Host catalog onto the request fields the provider accepts. */
        const resolveSelection = (catalog) => {
          const selection = catalog !== null && typeof catalog === 'object' ? catalog.selection : null
          const providerId = typeof selection?.providerId === 'string' ? selection.providerId : ''
          const providers = Array.isArray(catalog?.providers) ? catalog.providers : []
          const provider = providers.find((item) => item !== null && typeof item === 'object' && item.id === providerId) ?? null
          const languages = Array.isArray(provider?.languages) ? provider.languages : []
          const requested = typeof selection?.language === 'string' ? selection.language : ''
          const language = requested !== '' && (languages.length === 0 || languages.includes(requested)) ? requested : ''
          const catalogSeconds = typeof catalog?.maxDurationSeconds === 'number' && catalog.maxDurationSeconds > 0
            ? catalog.maxDurationSeconds
            : VOICE_MAX_SECONDS
          const maxBytes = typeof catalog?.maxAudioBytes === 'number' && catalog.maxAudioBytes > 44
            ? catalog.maxAudioBytes
            : 4 * 1024 * 1024
          const byteSeconds = Math.floor((maxBytes - 44) / (VOICE_SAMPLE_RATE * 2))
          return {
            providerId,
            language,
            maxSeconds: Math.max(1, Math.min(VOICE_MAX_SECONDS, catalogSeconds, byteSeconds)),
            maxBytes,
          }
        }

        /** One Host transcription; failures are returned instead of thrown. */
        const transcribe = async (session, audioBase64) => {
          try {
            const request = { audioBase64 }
            if (session.selection.providerId !== '') request.providerId = session.selection.providerId
            if (session.selection.language !== '') request.language = session.selection.language
            const result = await speech.transcribe(request)
            const text = typeof result === 'string' ? result : (typeof result?.text === 'string' ? result.text : '')
            return { text: text.trim(), failure: null }
          } catch (reason) {
            return { text: '', failure: reason instanceof Error ? reason : new Error(String(reason)) }
          }
        }

        const applyIncremental = (session, text) => {
          if (text === '') return
          const merged = mergeTranscript(session.committedText, text)
          if (merged === session.committedText) return
          session.committedText = merged
          session.lastText = merged
          applyDraft(session.base + merged, session)
        }

        /**
         * Upload only the audio added since the last accepted chunk, plus the
         * overlap samples needed to rebuild the seam. A chunk that carries no
         * voice-level audio is skipped locally (no request, hallucination-proof).
         */
        const maybeTranscribe = (session) => {
          if (session.busy || session.stopping) return
          if (session.total - session.cursor < VOICE_CHUNK_SAMPLES) return
          const end = session.total
          const start = Math.max(0, session.cursor - VOICE_OVERLAP_SAMPLES)
          if (end - start < VOICE_MIN_CHUNK_SAMPLES) return
          const samples = sliceSamples(session.chunks, start, end)
          if (samples.length < VOICE_MIN_CHUNK_SAMPLES) return
          if (session.voiceSinceCursor !== true) {
            session.cursor = end
            return
          }
          session.voiceSinceCursor = false
          session.busy = true
          const audioBase64 = encodeWavBase64(samples)
          transcribe(session, audioBase64)
            .then((outcome) => {
              if (sessionRef.current !== session) return
              if (outcome.failure !== null) {
                session.failures += 1
                if (session.failures >= VOICE_MAX_FAILURES) {
                  setError(outcome.failure.message.slice(0, 80))
                  void stop('error')
                }
                return
              }
              session.failures = 0
              session.cursor = end
              applyIncremental(session, outcome.text)
            })
            .finally(() => {
              session.busy = false
            })
        }

        const stop = async (reason = 'user') => {
          const session = sessionRef.current
          if (session === null || session.stopping) return
          session.stopping = true
          setRecording(false)
          if (session.tickTimer !== 0) {
            window.clearInterval(session.tickTimer)
            session.tickTimer = 0
          }
          // Free the microphone before the final inference: the device is never
          // held open while the Host transcribes.
          await flushWorklet(session)
          disposeCapture(session)
          for (let attempt = 0; attempt < 30 && session.busy; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 100))
          }
          const applyFinal = reason === 'user' || reason === 'limit' || reason === 'silence' || reason === 'empty' || reason === 'hidden'
          if (applyFinal && session.total > 0) {
            // One full-recording pass: whole context, no chunk seams. This result
            // replaces the incremental preview and is the text that stays.
            const samples = sliceSamples(session.chunks, 0, session.total)
            const maxSamples = Math.max(1, Math.floor((session.maxBytes - 44) / 2))
            const tail = samples.length > maxSamples ? samples.subarray(samples.length - maxSamples) : samples
            const outcome = await transcribe(session, encodeWavBase64(tail))
            if (outcome.failure !== null) {
              setError(outcome.failure.message.slice(0, 80))
              if (session.lastText !== '') applyDraft(session.base + session.lastText, session, true)
              // Transcription failed: give the official microphone back.
              document.documentElement.removeAttribute('data-dsh-realtime-voice')
            } else if (outcome.text !== '') {
              session.committedText = outcome.text
              session.lastText = outcome.text
              applyDraft(session.base + outcome.text, session, true)
            } else if (session.lastText !== '') {
              applyDraft(session.base + session.lastText, session, true)
            }
          }
          // Repeated chunk failures mean the recognition path is broken: stop and
          // hand the official microphone back instead of hiding it forever.
          if (reason === 'error') document.documentElement.removeAttribute('data-dsh-realtime-voice')
          releaseReveal(session)
          await closeAudioContext(session)
          if (sessionRef.current === session) sessionRef.current = null
        }
        stopRef.current = stop

        const acquireMicrophone = async () => {
          const devices = navigator.mediaDevices
          if (devices === undefined || typeof devices.getUserMedia !== 'function') {
            throw new Error('当前环境不支持麦克风')
          }
          let lastError = null
          for (const constraints of VOICE_MIC_ATTEMPTS) {
            try {
              return await devices.getUserMedia(constraints)
            } catch (reason) {
              lastError = reason
              // A denied permission never becomes a granted one by retrying.
              if (reason instanceof DOMException && reason.name === 'NotAllowedError') break
            }
          }
          throw lastError instanceof Error ? lastError : new Error('无法访问麦克风')
        }

        /** AudioWorklet first, ScriptProcessor fallback, both resampled to 16 kHz. */
        const startCapture = async (session) => {
          const Ctor = window.AudioContext ?? window.webkitAudioContext
          if (typeof Ctor !== 'function') throw new Error('当前环境不支持录音')
          let context = null
          try {
            context = new Ctor({ sampleRate: VOICE_SAMPLE_RATE, latencyHint: 'interactive' })
          } catch {
            context = new Ctor({ latencyHint: 'interactive' })
          }
          session.audioContext = context
          if (context.state === 'suspended') {
            try {
              await context.resume()
            } catch {
              // A user gesture normally resumes it; capture still connects.
            }
          }
          const source = context.createMediaStreamSource(session.stream)
          session.source = source
          const silentGain = context.createGain()
          silentGain.gain.value = 0
          session.silentGain = silentGain
          let worklet = null
          if (context.audioWorklet !== undefined && typeof AudioWorkletNode === 'function') {
            try {
              const url = URL.createObjectURL(new Blob([VOICE_WORKLET_SOURCE], { type: 'application/javascript' }))
              try {
                await context.audioWorklet.addModule(url)
              } finally {
                URL.revokeObjectURL(url)
              }
              worklet = new AudioWorkletNode(context, 'dsh-voice-capture', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [1],
                channelCount: 1,
                channelCountMode: 'explicit',
                channelInterpretation: 'speakers',
              })
            } catch (reason) {
              // CSP-blocked blob module, unsupported worklet, or registration
              // failure: keep the already-created context and use the fallback.
              worklet = null
              session.workletError = reason instanceof Error ? reason.message : String(reason)
              console.info('[dsh-live-voice] AudioWorklet unavailable, using ScriptProcessor fallback:', session.workletError)
            }
          }
          if (worklet !== null) {
            session.workletNode = worklet
            session.usingWorklet = true
            worklet.port.onmessage = (event) => {
              const data = event.data
              if (data === null || typeof data !== 'object') return
              if (data.type === 'pcm') {
                onPcm(session, new Float32Array(data.pcm), typeof data.rms === 'number' ? data.rms : 0)
              } else if (data.type === 'flushed' && typeof session.flushResolve === 'function') {
                session.flushResolve()
              }
            }
            source.connect(worklet)
            worklet.connect(silentGain)
            silentGain.connect(context.destination)
            return
          }
          const processor = context.createScriptProcessor(4096, 1, 1)
          session.processor = processor
          session.usingWorklet = false
          session.resampler = new VoiceResampler(context.sampleRate, VOICE_SAMPLE_RATE)
          processor.onaudioprocess = (event) => {
            if (sessionRef.current !== session || session.stopping) return
            const input = event.inputBuffer.getChannelData(0)
            const resampled = session.resampler === null ? input : session.resampler.push(input)
            if (resampled === null || resampled.length === 0) return
            let sum = 0
            for (let i = 0; i < resampled.length; i += 1) sum += resampled[i] * resampled[i]
            onPcm(session, resampled, Math.sqrt(sum / resampled.length))
          }
          source.connect(processor)
          processor.connect(silentGain)
          silentGain.connect(context.destination)
        }

        const start = async () => {
          if (sessionRef.current !== null) return
          setError('')
          const base = readComposerText()
          const session = {
            base,
            chunks: [],
            total: 0,
            level: 0,
            levelSmooth: 0,
            busy: false,
            stopping: false,
            released: false,
            cursor: 0,
            committedText: '',
            lastText: '',
            revealedText: base,
            targetText: base,
            revealTimer: 0,
            failures: 0,
            lastVoiceAt: performance.now(),
            voiceSinceCursor: false,
            maxSeconds: VOICE_MAX_SECONDS,
            maxBytes: 4 * 1024 * 1024,
            selection: { providerId: '', language: '' },
            sessionKey: currentSessionKey(),
            audioContext: null,
            source: null,
            silentGain: null,
            workletNode: null,
            processor: null,
            resampler: null,
            usingWorklet: false,
            flushResolve: null,
            stream: null,
            tickTimer: 0,
          }
          sessionRef.current = session
          try {
            const catalog = await getCatalog(true)
            session.selection = resolveSelection(catalog)
            session.maxSeconds = session.selection.maxSeconds
            session.maxBytes = session.selection.maxBytes
            const stream = await acquireMicrophone()
            if (sessionRef.current !== session || session.stopping) {
              for (const track of stream.getTracks()) {
                try {
                  track.stop()
                } catch {
                  // Track already ended.
                }
              }
              if (sessionRef.current === session) sessionRef.current = null
              return
            }
            session.stream = stream
            await startCapture(session)
            if (sessionRef.current !== session || session.stopping) {
              disposeCapture(session)
              await closeAudioContext(session)
              return
            }
            session.tickTimer = window.setInterval(() => tick(session), VOICE_TICK_MS)
            document.documentElement.setAttribute('data-dsh-realtime-voice', '1')
            setRecording(true)
          } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason)
            if (sessionRef.current === session) sessionRef.current = null
            session.stopping = true
            disposeCapture(session)
            await closeAudioContext(session)
            setRecording(false)
            setError(message.slice(0, 80))
            // Permission or capture failure: give the official microphone back.
            document.documentElement.removeAttribute('data-dsh-realtime-voice')
          }
        }

        const tick = (session) => {
          if (sessionRef.current !== session || session.stopping) return
          if (document.visibilityState === 'hidden') {
            void stop('hidden')
            return
          }
          const now = performance.now()
          const elapsed = session.total / VOICE_SAMPLE_RATE
          // If the user edited the draft by hand mid-recording, never overwrite
          // their edit with the next transcript slice.
          const currentText = readComposerText().replace(/\s+$/, '')
          const revealed = (session.revealedText ?? '').replace(/\s+$/, '')
          if (currentText !== '' && revealed !== '' && currentText !== revealed) {
            void stop('edited')
            return
          }
          const sessionKey = currentSessionKey()
          if (session.sessionKey !== '' && sessionKey !== '' && sessionKey !== session.sessionKey) {
            void stop('session')
            return
          }
          // Hard caps: advertised duration/byte limit and our own 60 s ceiling.
          if (elapsed > session.maxSeconds) {
            void stop('limit')
            return
          }
          if (elapsed * 1000 > VOICE_NO_SPEECH_STOP_MS && session.committedText === '' && session.busy === false) {
            void stop('empty')
            return
          }
          if (elapsed > 1.2 && now - session.lastVoiceAt > VOICE_SILENCE_STOP_MS) {
            void stop('silence')
            return
          }
          maybeTranscribe(session)
        }

        React.useEffect(() => {
          let alive = true
          getCatalog().then((catalog) => {
            if (!alive) return
            if (catalog === null) document.documentElement.removeAttribute('data-dsh-realtime-voice')
            else document.documentElement.setAttribute('data-dsh-realtime-voice', '1')
          })
          return () => { alive = false }
        }, [])

        // Hidden window / app switch: release the microphone immediately. The
        // final transcript is still written after the device is freed.
        React.useEffect(() => {
          const stopHidden = () => {
            const session = sessionRef.current
            if (session === null) return
            const stopCurrent = stopRef.current
            if (typeof stopCurrent === 'function') void stopCurrent('hidden')
          }
          const onVisibility = () => {
            if (document.visibilityState === 'hidden') stopHidden()
          }
          document.addEventListener('visibilitychange', onVisibility)
          window.addEventListener('pagehide', stopHidden)
          return () => {
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('pagehide', stopHidden)
          }
        }, [])

        // Unmount: no final inference (the composer may belong to another
        // session now); just release every device and timer.
        React.useEffect(() => () => {
          const session = sessionRef.current
          sessionRef.current = null
          if (session !== null) {
            session.stopping = true
            if (session.tickTimer !== 0) window.clearInterval(session.tickTimer)
            releaseReveal(session)
            disposeCapture(session)
            void closeAudioContext(session)
          }
          document.documentElement.removeAttribute('data-dsh-realtime-voice')
        }, [])

        // 60 fps level meter: rAF loop writing only transform/opacity on
        // pre-existing nodes (no layout reads, no React state per frame).
        React.useEffect(() => {
          if (!recording) return undefined
          let raf = 0
          let alive = true
          const reduced = prefersReducedMotion()
          const ring = ringRef.current
          const bars = barsRef.current ?? []
          const paint = () => {
            if (!alive) return
            const session = sessionRef.current
            if (session !== null) {
              session.levelSmooth += (session.level - session.levelSmooth) * 0.24
            }
            const level = session === null ? 0 : Math.max(0, Math.min(1, session.levelSmooth * 14))
            const amp = reduced ? 0.5 : 0.2 + level * 0.8
            const shapes = [0.55, 1, 0.75]
            for (let i = 0; i < bars.length; i += 1) {
              const bar = bars[i]
              if (bar === null || bar === undefined) continue
              const scale = Math.max(0.14, Math.min(1, amp * (shapes[i] ?? 1)))
              bar.style.transform = 'scaleY(' + scale.toFixed(3) + ')'
            }
            if (ring !== null) {
              const phase = reduced ? 0.25 : (performance.now() % 1400) / 1400
              ring.style.opacity = ((1 - phase) * 0.5).toFixed(3)
              ring.style.transform = 'scale(' + (1 + phase * 0.4).toFixed(3) + ')'
            }
            if (!reduced) raf = window.requestAnimationFrame(paint)
          }
          paint()
          return () => {
            alive = false
            if (raf !== 0) window.cancelAnimationFrame(raf)
            for (const bar of bars) {
              if (bar !== null && bar !== undefined) bar.style.removeProperty('transform')
            }
            if (ring !== null) {
              ring.style.removeProperty('opacity')
              ring.style.removeProperty('transform')
            }
          }
        }, [recording])

        const title = recording ? '点击停止并插入' : (error === '' ? '实时语音输入' : '语音输入错误：' + error)
        const barRef = (index) => (node) => {
          if (barsRef.current !== null) barsRef.current[index] = node
        }
        return React.createElement(
          'span',
          { className: 'dsh-live-voice-wrap' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: LIVE_VOICE_CLASS,
              'data-recording': recording ? 'true' : 'false',
              'aria-pressed': recording ? 'true' : 'false',
              title,
              'aria-label': recording ? '停止实时语音输入' : '实时语音输入',
              onClick: () => { if (recording) void stop('user'); else void start() },
            },
            React.createElement('span', { className: 'dsh-live-voice-ring', 'aria-hidden': 'true', ref: ringRef }),
            React.createElement('span', { className: 'dsh-live-voice-icon' },
              React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
                React.createElement('rect', { x: 9, y: 3, width: 6, height: 12, rx: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }),
                React.createElement('path', { d: 'M5 11a7 7 0 0 0 14 0M12 18v3', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
              ),
            ),
            React.createElement('span', { className: 'dsh-live-voice-bars', 'aria-hidden': 'true' },
              React.createElement('i', { className: 'dsh-live-voice-bar', ref: barRef(0) }),
              React.createElement('i', { className: 'dsh-live-voice-bar', ref: barRef(1) }),
              React.createElement('i', { className: 'dsh-live-voice-bar', ref: barRef(2) }),
            ),
            recording ? React.createElement('span', { className: 'dsh-live-voice-dot' }) : null,
          ),
        )
      }
      const dispose = ctx.slots.inject('conversation.input.right', () =>
        ctx.slots.register({
          name: 'conversation.input.right',
          id: 'dsh-theme-live-voice',
          order: 45,
          label: () => '实时语音输入',
        }, RealtimeVoiceButton),
      )
      return () => {
        try { dispose?.() } catch { /* ignore */ }
        document.documentElement.removeAttribute('data-dsh-realtime-voice')
      }
    }

