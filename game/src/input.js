// Input management for keyboard and mouse, supporting both open-world actions
// and starter kit compatibility functions.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let screenMouseX = 0;
  let screenMouseY = 0;
  let mouseLeftDown = false;
  let mouseLeftPressed = false;
  let lastActions = 0;

  const gameKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyR', 'KeyP', 'KeyM', 'Space', 'ShiftLeft', 'ShiftRight', 'Escape']);

  window.addEventListener('keydown', (e) => {
    if (gameKeys.has(e.code) || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
    }
    if (!keys.has(e.code)) {
      pressed.add(e.code);
    }
    keys.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    if (gameKeys.has(e.code) || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
    }
    keys.delete(e.code);
  });

  if (canvas) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      screenMouseX = e.clientX - rect.left;
      screenMouseY = e.clientY - rect.top;
      mouseX = (screenMouseX / rect.width) * 1280;
      mouseY = (screenMouseY / rect.height) * 720;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        mouseLeftDown = true;
        mouseLeftPressed = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        mouseLeftDown = false;
      }
    });

    canvas.addEventListener('click', () => {
      lastActions |= ACTION_CONFIRM;
    });
  }

  function isDown(code) {
    return keys.has(code) || keys.has(code.replace('Key', ''));
  }

  function isPressed(code) {
    const active = pressed.has(code) || pressed.has(code.replace('Key', ''));
    pressed.delete(code);
    pressed.delete(code.replace('Key', ''));
    return active;
  }

  function poll() {
    let act = lastActions;
    lastActions = 0;

    if (isPressed('KeyP') || isPressed('Escape')) {
      act |= ACTION_PAUSE;
    }
    if (isPressed('Space') || isPressed('Enter')) {
      act |= ACTION_CONFIRM;
    }

    const shoot = mouseLeftPressed || isDown('Space');
    mouseLeftPressed = false;

    let moveX = 0;
    let moveY = 0;
    if (isDown('ArrowLeft') || isDown('KeyA')) moveX -= 1;
    if (isDown('ArrowRight') || isDown('KeyD')) moveX += 1;
    if (isDown('ArrowUp') || isDown('KeyW')) moveY -= 1;
    if (isDown('ArrowDown') || isDown('KeyS')) moveY += 1;

    return {
      moveX,
      moveY,
      sprint: isDown('ShiftLeft') || isDown('ShiftRight'),
      interact: isPressed('KeyE'),
      shoot,
      pause: isPressed('KeyP') || isPressed('Escape'),
      mute: isPressed('KeyM'),
      restart: isPressed('KeyR'),
      mouseX,
      mouseY,
      mouseLeftDown,
      // Compatibility methods for starter kit
      takeActions() {
        let res = act;
        act = 0;
        return res;
      },
      direction() {
        return moveX;
      },
    };
  }

  return {
    poll,
    takeActions() {
      let res = lastActions;
      lastActions = 0;
      if (isPressed('KeyP') || isPressed('Escape')) res |= ACTION_PAUSE;
      if (isPressed('Space') || isPressed('Enter')) res |= ACTION_CONFIRM;
      return res;
    },
    direction() {
      if (isDown('ArrowLeft') || isDown('KeyA')) return -1;
      if (isDown('ArrowRight') || isDown('KeyD')) return 1;
      return 0;
    },
  };
}
