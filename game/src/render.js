// Night Run: Port Solano - Canvas Renderer
// Implements camera following, layered city rendering, entities, minimap, HUD, and screen overlays.

import { WORLD, DISTRICTS, PALETTE, FONT } from './config.js';
import { districtAt, isRoad } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let camX = 1600;
  let camY = 1600;
  let currentDistrict = 'Solano Bay';
  let districtToastTimer = 0;
  let lastDistrictName = '';
  const particles = [];

  function addParticle(p) {
    particles.push({ ...p, life: p.maxLife || 0.5 });
  }

  function render(world, screenState, options = {}) {
    const width = canvas.width || 1280;
    const height = canvas.height || 720;

    // Handle canvas sizing if needed
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const vw = canvas.width;
    const vh = canvas.height;

    ctx.save();
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, vw, vh);

    if (screenState === SCREEN_TITLE) {
      renderTitleScreen(ctx, vw, vh, options.hasSave);
      ctx.restore();
      return;
    }

    // Camera follow player with smooth lerp
    const targetCamX = world.player.car ? world.player.car.x : world.player.x;
    const targetCamY = world.player.car ? world.player.car.y : world.player.y;
    if (options.snapCamera) {
      camX = targetCamX;
      camY = targetCamY;
    }
    camX += (targetCamX - camX) * 0.1;
    camY += (targetCamY - camY) * 0.1;

    // Clamp camera within world bounds
    camX = Math.max(vw / 2, Math.min(WORLD.width - vw / 2, camX));
    camY = Math.max(vh / 2, Math.min(WORLD.height - vh / 2, camY));

    ctx.save();
    ctx.translate(vw / 2 - camX, vh / 2 - camY);

    // 1. Water / Beach
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, WORLD.waterY, WORLD.width, WORLD.height - WORLD.waterY);
    ctx.fillStyle = '#c2b280'; // Beach sand strip
    ctx.fillRect(0, WORLD.waterY - 30, WORLD.width, 30);

    // Bridge over water
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(1500, WORLD.waterY - 30, 200, WORLD.height - WORLD.waterY + 30);
    // Bridge stripes
    ctx.strokeStyle = '#f6e05e';
    ctx.lineWidth = 6;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(1600, WORLD.waterY - 30);
    ctx.lineTo(1600, WORLD.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Roads
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(0, 0, WORLD.width, WORLD.waterY);

    // Grid road lines & intersections
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 4;
    const blockSize = WORLD.blockSize;
    const roadWidth = WORLD.roadWidth;
    const sideWidth = WORLD.sidewalkWidth;
    const cellStride = blockSize + roadWidth + 2 * sideWidth;

    for (let gx = 0; gx < WORLD.width; gx += cellStride) {
      for (let gy = 0; gy < WORLD.waterY; gy += cellStride) {
        // Sidewalks around block
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(gx - sideWidth, gy - sideWidth, blockSize + 2 * sideWidth, blockSize + 2 * sideWidth);
        // Inner block (ground / grass / parking lot)
        ctx.fillStyle = PALETTE.ground;
        ctx.fillRect(gx, gy, blockSize, blockSize);
      }
    }

    // Road dashed centerlines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 16]);
    for (let x = roadWidth / 2; x < WORLD.width; x += cellStride) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.waterY);
      ctx.stroke();
    }
    for (let y = roadWidth / 2; y < WORLD.waterY; y += cellStride) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Building Shadows & Buildings
    for (const b of world.buildings) {
      // Shadow offset
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(b.x + 12, b.y + 12, b.w, b.h);

      // Building walls (skirt between footprint and roof)
      ctx.fillStyle = '#2d3748';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w - b.height * 0.2, b.y - b.height * 0.3);
      ctx.lineTo(b.x - b.height * 0.2, b.y - b.height * 0.3);
      ctx.closePath();
      ctx.fill();

      // Building roof
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.height * 0.2, b.y - b.height * 0.3, b.w, b.h);

      // Roof details / windows
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - b.height * 0.2, b.y - b.height * 0.3, b.w, b.h);
    }

    // 4. Props (Palms, Lamps)
    for (const prop of world.props) {
      if (prop.kind === 'palm') {
        ctx.fillStyle = '#2c5282';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.palm;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#718096';
        ctx.fillRect(prop.x - 3, prop.y - 3, 6, 6);
        ctx.fillStyle = '#f6e05e';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Cars
    for (const car of world.cars) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      // Car body
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 24, 6);
      ctx.fill();
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Windshield
      ctx.fillStyle = '#a0aec0';
      ctx.fillRect(2, -8, 12, 16);

      // Headlights / Brake lights
      ctx.fillStyle = '#f6e05e';
      ctx.fillRect(22, -10, 4, 6);
      ctx.fillRect(22, 4, 4, 6);
      ctx.fillStyle = '#e53e3e';
      ctx.fillRect(-24, -10, 3, 6);
      ctx.fillRect(-24, 4, 3, 6);

      // Police flashing lights
      if (car.classKey === 'police') {
        const flash = Math.floor(Date.now() / 150) % 2 === 0;
        ctx.fillStyle = flash ? '#3182ce' : '#e53e3e';
        ctx.fillRect(-4, -6, 8, 12);
      }

      ctx.restore();
    }

    // 6. Pedestrians & Player
    for (const ped of world.pedestrians) {
      if (ped.state === 'down') {
        ctx.fillStyle = '#718096';
        ctx.fillRect(ped.x - 10, ped.y - 5, 20, 10);
        continue;
      }
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);

      // Body
      ctx.fillStyle = ped.color || '#ffcc00';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Head direction
      ctx.fillStyle = '#d69e2e';
      ctx.fillRect(4, -3, 6, 6);

      ctx.restore();
    }

    // Player (if not in car)
    const p = world.player;
    if (!p.car) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Body / Outfit
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Gun / Hands
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(6, 4, 10, 4);

      ctx.restore();
    }

    // 7. Mission Markers & Pickups
    const curMission = world.missions.current();
    if (curMission && curMission.marker) {
      const m = curMission.marker;
      const pulse = Math.sin(Date.now() / 200) * 8;
      ctx.strokeStyle = '#f6e05e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 30 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Beacon column
      ctx.fillStyle = 'rgba(246, 224, 94, 0.3)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // Restore camera translation

    // 8. HUD & Overlays
    renderHUD(ctx, vw, vh, world, curMission);

    // District Toast check
    const currentDistObj = districtAt(world, p.x, p.y);
    if (currentDistObj.name !== lastDistrictName) {
      lastDistrictName = currentDistObj.name;
      districtToastTimer = 3.0;
    }
    if (districtToastTimer > 0) {
      districtToastTimer -= 0.016;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(vw / 2 - 180, 80, 360, 50);
      ctx.strokeStyle = PALETTE.coin;
      ctx.lineWidth = 2;
      ctx.strokeRect(vw / 2 - 180, 80, 360, 50);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Entering: ${lastDistrictName}`, vw / 2, 105);
      ctx.restore();
    }

    if (screenState === SCREEN_PAUSED) {
      renderPauseMenu(ctx, vw, vh);
    } else if (world.state === 'busted' || screenState === SCREEN_OVER && world.state === 'busted') {
      renderOverlay(ctx, vw, vh, 'BUSTED', 'Apprehended by Port Police. Fine paid.', '#3182ce');
    } else if (world.state === 'wasted' || screenState === SCREEN_OVER && world.state === 'wasted') {
      renderOverlay(ctx, vw, vh, 'WASTED', 'Hospitalized. Press R to restart run.', '#e53e3e');
    }

    ctx.restore();
  }

  function renderTitleScreen(ctx, vw, vh, hasSave) {
    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, vw, vh);

    // Decorative background cityscape silhouette
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(100, vh - 300, 200, 300);
    ctx.fillRect(350, vh - 450, 250, 450);
    ctx.fillRect(680, vh - 350, 220, 350);
    ctx.fillRect(950, vh - 500, 280, 500);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 56px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('NIGHT RUN: PORT SOLANO', vw / 2, vh / 2 - 120);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `22px ${FONT}`;
    ctx.fillText('Open-World Crime & Driving Action', vw / 2, vh / 2 - 60);

    ctx.fillStyle = PALETTE.coin;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(hasSave ? 'Press ENTER / Space to Continue or Start' : 'Press ENTER / Space to Play', vw / 2, vh / 2 + 20);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('Controls: WASD / Arrows to Move/Drive | E to Enter/Exit Car | Click/Space to Shoot', vw / 2, vh / 2 + 90);
    ctx.fillText('P to Pause | M to Mute | R to Restart', vw / 2, vh / 2 + 120);
  }

  function renderPauseMenu(ctx, vw, vh) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, vw, vh);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('GAME PAUSED', vw / 2, vh / 2 - 60);

    ctx.fillStyle = PALETTE.coin;
    ctx.font = `24px ${FONT}`;
    ctx.fillText('Press P or ESC to Resume', vw / 2, vh / 2 + 10);
    ctx.fillText('Press R to Restart Run', vw / 2, vh / 2 + 50);
  }

  function renderOverlay(ctx, vw, vh, title, subtitle, color) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, vw, vh);

    ctx.fillStyle = color;
    ctx.font = `bold 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, vw / 2, vh / 2 - 40);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `24px ${FONT}`;
    ctx.fillText(subtitle, vw / 2, vh / 2 + 20);

    ctx.fillStyle = PALETTE.coin;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('Press R to Restart', vw / 2, vh / 2 + 80);
  }

  function renderHUD(ctx, vw, vh, world, curMission) {
    const p = world.player;

    // Top-Left: Health & Money & Wanted Stars
    ctx.fillStyle = 'rgba(37, 43, 56, 0.9)';
    ctx.fillRect(20, 20, 300, 110);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 300, 110);

    // Health Bar
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('HEALTH', 35, 45);

    ctx.fillStyle = '#1a202c';
    ctx.fillRect(110, 32, 180, 16);
    ctx.fillStyle = p.health > 40 ? '#48bb78' : '#e53e3e';
    ctx.fillRect(110, 32, 180 * Math.max(0, p.health / 100), 16);

    // Money
    ctx.fillStyle = PALETTE.coin;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`$${p.money.toLocaleString()}`, 35, 80);

    // Wanted Stars
    ctx.fillStyle = PALETTE.text;
    ctx.font = `14px ${FONT}`;
    ctx.fillText('WANTED:', 170, 80);
    for (let i = 1; i <= 5; i++) {
      ctx.fillStyle = i <= world.wanted ? '#f6e05e' : '#4a5568';
      ctx.fillText('★', 240 + (i - 1) * 16, 80);
    }

    // Weapon & Ammo
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    ctx.fillText(`Weapon: ${p.weapon.toUpperCase()} (${p.ammo})`, 35, 112);

    // Top-Right: Minimap
    const mapSize = 160;
    const mapX = vw - mapSize - 25;
    const mapY = 25;

    ctx.fillStyle = 'rgba(37, 43, 56, 0.9)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    // Minimap contents (draw miniature world relative to player)
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapSize, mapSize);
    ctx.clip();

    const scale = mapSize / WORLD.width;
    // Draw player dot on minimap
    const dotX = mapX + p.x * scale;
    const dotY = mapY + p.y * scale;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw police blips
    ctx.fillStyle = '#e53e3e';
    for (const car of world.cars) {
      if (car.classKey === 'police') {
        ctx.fillRect(mapX + car.x * scale - 2, mapY + car.y * scale - 2, 4, 4);
      }
    }

    // Draw mission marker blip
    if (curMission && curMission.marker) {
      ctx.fillStyle = '#f6e05e';
      ctx.beginPath();
      ctx.arc(mapX + curMission.marker.x * scale, mapY + curMission.marker.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Bottom-Center: Mission Title & Objective Banner
    if (curMission) {
      const bannerW = 600;
      const bannerH = 64;
      const bannerX = (vw - bannerW) / 2;
      const bannerY = vh - 90;

      ctx.fillStyle = 'rgba(37, 43, 56, 0.9)';
      ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
      ctx.strokeStyle = PALETTE.coin;
      ctx.lineWidth = 2;
      ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);

      ctx.fillStyle = PALETTE.coin;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(curMission.mission ? curMission.mission.title.toUpperCase() : 'FREE ROAM', vw / 2, bannerY + 20);

      ctx.fillStyle = PALETTE.text;
      ctx.font = `14px ${FONT}`;
      ctx.fillText(curMission.objectiveText, vw / 2, bannerY + 44);
    }
  }

  return {
    render,
    addParticle,
  };
}
