const Sound = (() => {
  const LEVELS = { low: 0.35, medium: 0.65, high: 1 }
  // Purring stays soft and typing softer still: it can go on for a long while.
  // Picked up, the cat gives only a faint little mew.
  const GAINS = { purr: 0.28, typing: 0.22, meow: 0.7, mew: 0.09 }
  const SHOTS = {
    meow: ['sounds/meow.wav'],
    mew: ['sounds/mew.wav'],
  }
  const FADE_STEP_MS = 30
  const FADE_STEPS = 10
  // Between two mews the chatter's voice should have moved on this far at least.
  const STUCK_AFTER_MS = 250
  // Talking, the cat chatters in little mews cut from its meow, each pitched a
  // little up or down at random, in bursts with a breath between, tuned by
  // ear. Times are in seconds.
  const CHATTER = {
    gain: 0.2,
    speed: 2,
    semitones: 4,
    from: 0.2,
    length: 0.055,
    gap: 0.12,
    mostInBreath: 5,
    breath: 0.35,
  }

  const makeLoop = source => {
    const audio = new Audio(source)
    audio.loop = true
    audio.volume = 0

    return { audio, wanted: false, fade: null }
  }

  const loops = {
    purr: makeLoop('sounds/purr.wav'),
    typing: makeLoop('sounds/typing.wav'),
  }
  const played = { meow: 0, mew: 0, chatter: 0, renewedVoice: 0 }
  let isEnabled = true
  let level = LEVELS.medium

  // The chatter needs the meow's own samples, to cut and pitch each mew. Its
  // voice can fall silent after the cat has run a long while, its sound output
  // changed under it: closed, stuck asleep, or saying it plays while its clock
  // stands still. The chatter then speaks through a new one; the samples, once
  // read, serve any voice.
  let voice = new AudioContext()
  let lastMew = null
  let meowSamples = null

  function renewVoice() {
    voice.close().catch(() => {})
    voice = new AudioContext()
    lastMew = null
    played.renewedVoice += 1
  }

  const isStuck = () =>
    voice.state === 'closed' ||
    (lastMew !== null &&
      performance.now() - lastMew.at >= STUCK_AFTER_MS &&
      voice.currentTime <= lastMew.clock)

  // Speakers or headphones plugged in or out: start afresh on what plays now.
  navigator.mediaDevices?.addEventListener('devicechange', renewVoice)
  const loadRequest = new XMLHttpRequest()
  loadRequest.open('GET', 'sounds/meow.wav')
  loadRequest.responseType = 'arraybuffer'
  loadRequest.onload = () =>
    voice.decodeAudioData(loadRequest.response).then(samples => {
      meowSamples = samples
      settleChatter()
    }, () => {})
  loadRequest.send()

  const chatter = { wanted: false, timer: null, leftInBreath: 0 }
  // Not quite even, the way speech is not.
  const roughly = seconds => seconds * (0.75 + Math.random() * 0.5)
  const breathLength = () => 2 + Math.floor(Math.random() * (CHATTER.mostInBreath - 1))

  function chatterMew() {
    if (isStuck()) {
      renewVoice()
    }

    const speed = CHATTER.speed * 2 ** (((Math.random() * 2 - 1) * CHATTER.semitones) / 12)
    const volume = CHATTER.gain * level
    const fadeOut = Math.min(0.04, CHATTER.length / 2)
    const source = voice.createBufferSource()
    source.buffer = meowSamples
    source.playbackRate.value = speed
    const loudness = voice.createGain()
    const now = voice.currentTime
    // Only enough of a fade in to keep from clicking, and a quick fade out.
    loudness.gain.setValueAtTime(0, now)
    loudness.gain.linearRampToValueAtTime(volume, now + 0.004)
    loudness.gain.setValueAtTime(volume, now + CHATTER.length - fadeOut)
    loudness.gain.linearRampToValueAtTime(0, now + CHATTER.length)
    source.connect(loudness).connect(voice.destination)
    source.start(now, CHATTER.from, CHATTER.length * speed)
    lastMew = { at: performance.now(), clock: now }
    played.chatter += 1
  }

  function nextChatter() {
    chatterMew()
    chatter.leftInBreath -= 1
    let wait = CHATTER.gap

    if (chatter.leftInBreath <= 0) {
      chatter.leftInBreath = breathLength()
      wait = CHATTER.breath
    }

    chatter.timer = setTimeout(nextChatter, roughly(wait) * 1000)
  }

  function settleChatter() {
    const isOn = isEnabled && chatter.wanted && meowSamples !== null

    if (isOn && chatter.timer === null) {
      if (voice.state === 'closed') {
        renewVoice()
      }

      voice.resume().catch(() => {})
      chatter.leftInBreath = breathLength()
      nextChatter()
    } else if (!isOn && chatter.timer !== null) {
      clearTimeout(chatter.timer)
      chatter.timer = null
    }
  }

  function settleLoop(name) {
    const loop = loops[name]
    const target = isEnabled && loop.wanted ? GAINS[name] * level : 0
    const start = loop.audio.volume
    let step = 0

    clearInterval(loop.fade)

    if (target > 0 && loop.audio.paused) {
      loop.audio.play().catch(() => {})
    }

    loop.fade = setInterval(() => {
      step += 1
      loop.audio.volume = start + ((target - start) * step) / FADE_STEPS

      if (step === FADE_STEPS) {
        clearInterval(loop.fade)

        if (target === 0) {
          loop.audio.pause()
        }
      }
    }, FADE_STEP_MS)
  }

  return {
    setLoop(name, isOn) {
      if (loops[name].wanted !== isOn) {
        loops[name].wanted = isOn
        settleLoop(name)
      }
    },

    setChatter(isOn) {
      chatter.wanted = isOn
      settleChatter()
    },

    shot(name) {
      if (isEnabled) {
        const choices = SHOTS[name]
        const audio = new Audio(choices[Math.floor(Math.random() * choices.length)])
        audio.volume = GAINS[name] * level
        audio.play().catch(() => {})
        played[name] += 1
      }
    },

    configure({ enabled, volume }) {
      isEnabled = enabled === true
      level = LEVELS[volume] ?? LEVELS.medium
      Object.keys(loops).forEach(settleLoop)
      settleChatter()
    },

    state() {
      return {
        purr: !loops.purr.audio.paused,
        typing: !loops.typing.audio.paused,
        chattering: chatter.timer !== null,
        chatterReady: meowSamples !== null,
        purrSeconds: loops.purr.audio.duration,
        typingSeconds: loops.typing.audio.duration,
        ...played,
      }
    },
  }
})()
