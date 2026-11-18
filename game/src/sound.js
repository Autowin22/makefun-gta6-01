// Night Run: Port Solano - WebAudio Sound System
// Implements synthetic audio effects and engine hum without external assets.

let audioCtx = null;
let masterGain = null;
let muted = false;
let engineOsc = null;
let engineGain = null;

export function initAudio() {
  if (audioCtx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
  } catch (e) {
    // AudioContext blocked or unsupported
  }
}

export function toggleMute() {
  muted = !muted;
  if (masterGain && audioCtx) {
    masterGain.gain.value = muted ? 0 : 0.3;
  }
  return muted;
}

export function isMuted() {
  return muted;
}

export function play(name) {
  if (muted) return;
  initAudio();
  if (!audioCtx || audioCtx.state !== 'running') {
    if (audioCtx && audioCtx.resume) audioCtx.resume().catch(() => {});
    return;
  }

  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);

    if (name === 'gunshot') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (name === 'melee' || name === 'hit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (name === 'pickup' || name === 'cash' || name === 'blip') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (name === 'mission-done') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (name === 'busted' || name === 'wasted') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.6);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (name === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(440, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    // Ignore audio errors
  }
}

export function updateSound(world) {
  if (muted || !audioCtx) return;
  try {
    if (audioCtx.state === 'running' && world.player.car) {
      if (!engineOsc) {
        engineOsc = audioCtx.createOscillator();
        engineGain = audioCtx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 80;
        engineGain.gain.value = 0.08;
        engineOsc.connect(engineGain);
        engineGain.connect(masterGain);
        engineOsc.start();
      }
      const carSpeed = Math.abs(world.player.car.speed);
      engineOsc.frequency.setTargetAtTime(60 + carSpeed * 0.3, audioCtx.currentTime, 0.1);
    } else if (engineOsc) {
      engineOsc.stop();
      engineOsc.disconnect();
      engineOsc = null;
      engineGain = null;
    }
  } catch (e) {
    // Ignore audio updates
  }
}
