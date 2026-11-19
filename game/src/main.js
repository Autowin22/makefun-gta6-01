// Night Run: Port Solano - Main Entry Point & Game Loop
// Manages game states, fixed-timestep simulation, audio triggers, localStorage saves, and screenshot gating.

import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { initAudio, play, updateSound, toggleMute } from './sound.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'night-run.save';

function loadGameSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // LocalStorage blocked or unavailable
  }
  return null;
}

function saveGameData(world) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world.toSave()));
  } catch (e) {
    // Ignore storage errors
  }
}

function main() {
  const canvas = document.getElementById('game');
  if (!canvas) return;

  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  const world = createWorld(12345);

  let currentState = SCREEN_TITLE;
  let hasSave = loadGameSave() !== null;

  // Check URL query for screenshot mode ?shot=<name>&seed=<n>
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const seedParam = params.get('seed');

  if (shotName) {
    const seed = seedParam ? parseInt(seedParam, 10) : 6;
    const res = stageShot(shotName, world, seed);
    currentState = res.screen;
    if (res.hasSave) hasSave = true;
    // Render once with snapCamera and set shot-ready
    renderer.render(world, currentState, { hasSave, snapCamera: true });
    document.title = 'shot-ready';
    return;
  }

  let lastTime = performance.now();
  let accumulator = 0;
  const STEP = 1 / 60;

  function loop(timestamp) {
    const dt = Math.min(0.1, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    const polledInput = input.poll();

    if (polledInput.mute) {
      toggleMute();
    }

    if (polledInput.restart || polledInput.takeActions() & 4 /* restart */) {
      world.reset();
      currentState = SCREEN_PLAY;
      play('start');
    }

    if (currentState === SCREEN_TITLE) {
      if (polledInput.pause || (polledInput.takeActions() & 1 /* confirm */)) {
        initAudio();
        const save = loadGameSave();
        if (save) {
          world.loadSave(save);
        }
        currentState = SCREEN_PLAY;
        play('start');
      }
    } else if (currentState === SCREEN_PAUSED) {
      if (polledInput.pause) {
        currentState = SCREEN_PLAY;
      }
    } else if (currentState === SCREEN_PLAY) {
      if (polledInput.pause) {
        currentState = SCREEN_PAUSED;
        saveGameData(world);
      } else {
        // Fixed timestep simulation
        accumulator += dt;
        while (accumulator >= STEP) {
          const events = [];
          world.update(STEP, polledInput, events, { x: polledInput.mouseX, y: polledInput.mouseY });

          // Handle sound events
          for (const ev of events) {
            if (ev.type === 'shot') play('gunshot');
            else if (ev.type === 'melee') play('melee');
            else if (ev.type === 'pickup' || ev.type === 'cash') play('pickup');
            else if (ev.type === 'mission-done') play('mission-done');
            else if (ev.type === 'busted') play('busted');
            else if (ev.type === 'wasted') play('wasted');
          }

          if (world.state === 'busted' || world.state === 'wasted') {
            currentState = SCREEN_OVER;
          }

          accumulator -= STEP;
        }

        updateSound(world);
      }
    } else if (currentState === SCREEN_OVER) {
      if (polledInput.restart || polledInput.pause) {
        world.reset();
        currentState = SCREEN_PLAY;
        play('start');
      }
    }

    renderer.render(world, currentState, { hasSave });
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', main);
