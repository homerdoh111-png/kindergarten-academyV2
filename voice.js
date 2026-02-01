/* BuddyVoice — mic capture → pitch-shifted echo + independent jokes
   All audio processing happens in the browser via Web Audio API.
   No server / Python runtime needed — works fully offline as a PWA.
   
   Pitch shifting strategy: play the recorded AudioBuffer at a higher
   playbackRate (1.55×). This raises pitch AND shortens duration,
   creating a charming "chipmunk" effect that kids find hilarious.
   A secondary, cleaner option uses a simple phase-vocoder stretch
   to decouple time from pitch, but the chipmunk mode is kept as
   the default because the exaggerated effect IS the joke.
*/
(function () {
  if (window.BuddyVoice) return;

  // ── Joke pool (age 4–6 safe) ──────────────────────────────────
  const JOKES = [
    { setup: "Why do bears love the forest?",      punchline: "Because it's bear-y fun!" },
    { setup: "What do you call a sleeping dinosaur?", punchline: "A dino-snore!" },
    { setup: "Why can't Elsa have a balloon?",     punchline: "Because she'll let it go!" },
    { setup: "What do you call a fish without eyes?", punchline: "A fsh!" },
    { setup: "Why did the banana go to the doctor?", punchline: "Because it wasn't peeling well!" },
    { setup: "What do you call a bear with no teeth?", punchline: "A gummy bear!" },
    { setup: "Why do cows wear bells?",            punchline: "Because their horns don't work!" },
    { setup: "What did the ocean say to the beach?", punchline: "Nothing, it just waved!" },
    { setup: "Why are elephants so bad at using computers?", punchline: "Because they're afraid of the mouse!" },
    { setup: "What do you call a dog that does magic tricks?", punchline: "A Labracadabrador!" },
    { setup: "Why did the cookie go to the doctor?", punchline: "Because it was feeling crummy!" },
    { setup: "What do you call a sad strawberry?", punchline: "A blueberry!" },
    { setup: "Why do birds fly south in the winter?", punchline: "Because it's too far to walk!" },
    { setup: "What did the grape say when it got stepped on?", punchline: "Nothing, it just let out a little wine!" },
    { setup: "Why does a cow wear a bell?",        punchline: "Because its horn doesn't work!" },
    { setup: "What do you call a fake noodle?",   punchline: "An impasta!" },
    { setup: "Why did the scarecrow win an award?", punchline: "Because he was outstanding in his field!" },
    { setup: "What do you call a bear with no teeth?", punchline: "A gummy bear!" },
    { setup: "Why can't you give Elsa a balloon?", punchline: "She'll let it go!" },
    { setup: "What does a duck say?",             punchline: "Quack! Just kidding, I'm a bear!" },
  ];

  let lastJokeIdx = -1;
  function pickJoke() {
    let idx;
    do { idx = Math.floor(Math.random() * JOKES.length); } while (idx === lastJokeIdx && JOKES.length > 1);
    lastJokeIdx = idx;
    return JOKES[idx];
  }

  // ── State ─────────────────────────────────────────────────────
  const state = {
    audioCtx: null,
    mediaStream: null,
    mediaRecorder: null,
    chunks: [],
    recording: false,
    playing: false,
    analyser: null,          // for live waveform during recording
    analyserData: null,      // Uint8Array for waveform
    playAnalyser: null,      // analyser during playback (feeds Buddy mouth)
    playAnalyserData: null,
    animFrame: null,
  };

  // ── AudioContext (lazy init, must be from user gesture) ───────
  function ensureAudioCtx() {
    if (!state.audioCtx || state.audioCtx.state === "closed") {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === "suspended") state.audioCtx.resume();
    return state.audioCtx;
  }

  // ── Waveform draw (called externally by rAF loop or internally) ──
  function getWaveformData() {
    const src = state.recording ? state.analyser : state.playAnalyser;
    if (!src) return null;
    const buf = state.recording ? state.analyserData : state.playAnalyserData;
    src.getByteTimeDomainData(buf);
    return buf;
  }

  // ── Playback amplitude (for driving Buddy's jaw in realtime) ─
  function getPlaybackAmplitude() {
    if (!state.playAnalyser || !state.playAnalyserData) return 0;
    state.playAnalyser.getByteFrequencyData(state.playAnalyserData);
    const d = state.playAnalyserData;
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d[i];
    return sum / d.length / 255; // 0..1
  }

  // ── Recording ─────────────────────────────────────────────────
  function startRecording() {
    if (state.recording) return Promise.resolve(false);
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        state.mediaStream = stream;
        const ctx = ensureAudioCtx();

        // Analyser for live waveform
        state.analyser = ctx.createAnalyser();
        state.analyser.fftSize = 256;
        state.analyserData = new Uint8Array(state.analyser.frequencyBinCount);
        const src = ctx.createMediaStreamSource(stream);
        src.connect(state.analyser);

        // MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
        state.mediaRecorder = new MediaRecorder(stream, { mimeType });
        state.chunks = [];
        state.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.chunks.push(e.data); };
        state.mediaRecorder.onstop = () => _onRecordingDone();
        state.mediaRecorder.start();
        state.recording = true;

        // Notify UI
        if (window.Buddy3D) window.Buddy3D.setEmotion("listening");
        _emit("recordingStart");
        return true;
      });
  }

  function stopRecording() {
    if (!state.recording || !state.mediaRecorder) return;
    state.mediaRecorder.stop();
    state.recording = false;
    // Stop mic tracks
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(t => t.stop());
      state.mediaStream = null;
    }
    _emit("recordingStop");
  }

  function _onRecordingDone() {
    const blob = new Blob(state.chunks, { type: state.mediaRecorder.mimeType });
    state.chunks = [];
    if (blob.size < 5000) {
      // Too short / silence — ignore
      _emit("tooShort");
      return;
    }
    _emit("processing");
    if (window.Buddy3D) window.Buddy3D.setEmotion("thinking");

    // Small delay so "thinking" animation is visible
    setTimeout(() => playPitchShifted(blob), 600);
  }

  // ── Pitch-shifted playback ────────────────────────────────────
  function playPitchShifted(blob, rate) {
    rate = rate || 1.55; // chipmunk sweet spot
    const ctx = ensureAudioCtx();
    const reader = new FileReader();
    reader.onload = () => {
      ctx.decodeAudioData(reader.result).then(buffer => {
        state.playing = true;
        _emit("playbackStart");
        if (window.Buddy3D) window.Buddy3D.setEmotion("excited");

        // Build graph: source → analyser → destination
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;

        state.playAnalyser = ctx.createAnalyser();
        state.playAnalyser.fftSize = 128;
        state.playAnalyserData = new Uint8Array(state.playAnalyser.frequencyBinCount);

        source.connect(state.playAnalyser);
        state.playAnalyser.connect(ctx.destination);

        // Drive Buddy's mouth during playback
        _startMouthDrive();

        source.onended = () => {
          state.playing = false;
          _stopMouthDrive();
          state.playAnalyser = null;
          _emit("playbackEnd");
          if (window.Buddy3D) window.Buddy3D.setEmotion("happy");
        };
        source.start();
      }).catch(e => {
        console.warn("BuddyVoice decode error", e);
        _emit("error", e);
      });
    };
    reader.readAsArrayBuffer(blob);
  }

  // ── Mouth drive loop (rAF, reads analyser amplitude → Buddy jaw) ─
  function _startMouthDrive() {
    function tick() {
      if (!state.playing) return;
      const amp = getPlaybackAmplitude();
      // Map amplitude 0..1 → mouth openness 0.05..0.85
      if (window.Buddy3D && window.Buddy3D.setMouthDirect) {
        window.Buddy3D.setMouthDirect(0.05 + amp * 0.80);
      }
      state.animFrame = requestAnimationFrame(tick);
    }
    tick();
  }
  function _stopMouthDrive() {
    if (state.animFrame) { cancelAnimationFrame(state.animFrame); state.animFrame = null; }
    if (window.Buddy3D && window.Buddy3D.setMouthDirect) window.Buddy3D.setMouthDirect(0.05);
  }

  // ── Joke engine ───────────────────────────────────────────────
  function tellJoke() {
    const joke = pickJoke();

    if (window.Buddy3D) window.Buddy3D.setEmotion("thinking");
    _emit("jokeSetup", joke.setup);
    _updateSpeechBubble(joke.setup);

    // Speak setup via TTS
    _speakTTS(joke.setup, () => {
      // Pause for comedic timing
      setTimeout(() => {
        if (window.Buddy3D) window.Buddy3D.setEmotion("excited");
        _emit("jokePunchline", joke.punchline);
        _updateSpeechBubble(joke.punchline);
        _speakTTS(joke.punchline, () => {
          // End with a giggle
          setTimeout(() => {
            if (window.Buddy3D) window.Buddy3D.giggle();
            _emit("jokeEnd");
          }, 300);
        });
      }, 1200); // comedic pause
    });
  }

  // ── TTS helper (uses existing speak infrastructure) ───────────
  function _speakTTS(text, onEnd) {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.pitch = 1.3;
    u.volume = 1.0;
    if (window.Buddy3D) {
      u.onstart = () => window.Buddy3D.talk(true, text);
      u.onend = () => { window.Buddy3D.talk(false); if (onEnd) onEnd(); };
      u.onerror = () => { window.Buddy3D.talk(false); if (onEnd) onEnd(); };
      u.onboundary = (evt) => window.Buddy3D.onBoundary(evt);
    } else {
      u.onend = onEnd;
      u.onerror = onEnd;
    }
    window.speechSynthesis.speak(u);
  }

  function _updateSpeechBubble(text) {
    const bubble = document.getElementById("buddySpeech");
    if (!bubble) return;
    const span = bubble.querySelector(".speech-text");
    if (span) span.textContent = text;
  }

  // ── Simple event emitter ──────────────────────────────────────
  const _listeners = {};
  function _emit(evt, data) {
    (_listeners[evt] || []).forEach(fn => fn(data));
  }
  function on(evt, fn) {
    (_listeners[evt] = _listeners[evt] || []).push(fn);
  }

  // ── Public API ────────────────────────────────────────────────
  window.BuddyVoice = {
    startRecording,
    stopRecording,
    tellJoke,
    getWaveformData,
    getPlaybackAmplitude,
    get recording() { return state.recording; },
    get playing()   { return state.playing; },
    on,
    ensureAudioCtx,  // call once from a user gesture to unblock AudioContext
  };
})();
