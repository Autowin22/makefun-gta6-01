// Night Run: Port Solano - World Core & Simulation
// Implements city generation, car physics, pedestrian AI, player movement, combat, police/wanted integration, missions, and world state.

import { WORLD, DISTRICTS, PLAYER, VEHICLE_CLASSES, WANTED, WEAPONS, PALETTE } from './config.js';
import { createRandom } from './random.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';

export const KIND_BLOCK = 0;
export const KIND_COIN = 1;

export const EVENT_HIT = 1;
export const EVENT_COIN = 2;
export const EVENT_OVER = 4;

export function districtAt(world, x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x < d.maxX && y >= d.minY && y < d.maxY) return d;
  }
  return DISTRICTS[0];
}

export function isRoad(world, x, y) {
  let px = x;
  let py = y;
  if (typeof world === 'number' && typeof x === 'number') {
    py = x;
    px = world;
  }
  if (py >= WORLD.waterY) {
    return px >= 1520 && px <= 1680;
  }
  const rx = Math.abs((px + 180) % 360 - 180);
  const ry = Math.abs((py + 180) % 360 - 180);
  return rx <= WORLD.roadWidth / 2 || ry <= WORLD.roadWidth / 2;
}

export function createWorld(seedOrRandom) {
  const rng = typeof seedOrRandom === 'number' ? createRandom(seedOrRandom) : seedOrRandom;

  const buildings = [];
  const props = [];
  const cars = [];
  const pedestrians = [];

  const player = {
    x: 1600,
    y: 1600,
    width: PLAYER.width,
    height: PLAYER.height,
    angle: 0,
    speed: 0,
    health: PLAYER.healthMax,
    money: 500,
    weapon: 'pistol',
    ammo: WEAPONS.pistol.ammo,
    car: null,
    bustedMeter: 0,
    invulnTimer: 0,
  };

  let stateVal = 'playing';
  let time = 0;
  let crimeHeat = 0;
  let missionIndexVal = 0;
  let campaignDoneVal = false;
  let wantedVal = 0;

  // Generate City Buildings & Props
  const blockSize = WORLD.blockSize; // 360
  const roadWidth = WORLD.roadWidth; // 96
  const sideWidth = WORLD.sidewalkWidth; // 28
  const cellStride = blockSize + roadWidth + 2 * sideWidth; // 512

  for (let gx = 0; gx < WORLD.width; gx += cellStride) {
    for (let gy = 0; gy < WORLD.waterY; gy += cellStride) {
      if (gx + blockSize <= WORLD.width && gy + blockSize <= WORLD.waterY) {
        // Build 1-4 buildings per block
        const count = rng.int(1, 4);
        const subW = (blockSize - 20) / (count > 2 ? 2 : 1);
        const subH = (blockSize - 20) / (count > 1 ? 2 : 1);
        
        for (let i = 0; i < count; i++) {
          const bx = gx + 10 + (i % 2) * subW;
          const by = gy + 10 + Math.floor(i / 2) * subH;
          const bw = subW - 10;
          const bh = subH - 10;
          const height = rng.range(40, 160);
          const color = rng.pick(['#e0a96d', '#d9a066', '#c49a6c', '#b08968', '#a3816a', '#967866', '#877063']);
          buildings.push({ x: bx, y: by, w: bw, h: bh, height, color, roof: rng.pick(['flat', 'sloped']) });
        }

        // Add props on sidewalks
        if (rng.chance(0.6)) {
          props.push({ x: gx - sideWidth / 2, y: gy + blockSize / 2, kind: rng.chance(0.5) ? 'palm' : 'lamp' });
        }
        if (rng.chance(0.6)) {
          props.push({ x: gx + blockSize + sideWidth / 2, y: gy + blockSize / 2, kind: rng.chance(0.5) ? 'palm' : 'lamp' });
        }
      }
    }
  }

  // Helper for road spawning with up to 40 retries and fallback
  function getRoadSpawn() {
    for (let attempt = 0; attempt < 40; attempt++) {
      const rx = rng.range(200, WORLD.width - 200);
      const ry = rng.range(200, WORLD.waterY - 200);
      if (isRoad(null, rx, ry)) {
        return { x: rx, y: ry };
      }
    }
    return { x: 1600, y: 1600 };
  }

  // Spawn Parked Cars (~18) along curbs
  const carClasses = Object.keys(VEHICLE_CLASSES);
  for (let i = 0; i < 18; i++) {
    const pos = getRoadSpawn();
    const classKey = rng.pick(carClasses);
    const conf = VEHICLE_CLASSES[classKey];
    cars.push({
      x: pos.x,
      y: pos.y,
      angle: rng.range(0, Math.PI * 2),
      speed: 0,
      classKey,
      color: conf.color,
      health: conf.durability,
      driver: null,
    });
  }

  // Spawn Traffic Cars (~16) on roads
  for (let i = 0; i < 16; i++) {
    const pos = getRoadSpawn();
    const classKey = rng.pick(carClasses);
    const conf = VEHICLE_CLASSES[classKey];
    cars.push({
      x: pos.x,
      y: pos.y,
      angle: rng.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]),
      speed: rng.range(100, 250),
      classKey,
      color: conf.color,
      health: conf.durability,
      driver: 'ai',
    });
  }

  // Spawn Pedestrians (~44) on roads/sidewalks
  for (let i = 0; i < 44; i++) {
    const pos = getRoadSpawn();
    pedestrians.push({
      x: pos.x,
      y: pos.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(30, 60),
      color: rng.pick(['#ffcc00', '#3366ff', '#ff3366', '#33cc66', '#cc33ff']),
      state: 'walk', // walk, flee, down
      health: 20,
      targetX: rng.range(100, WORLD.width - 100),
      targetY: rng.range(100, WORLD.waterY - 100),
      fleeTimer: 0,
    });
  }

  const worldObj = {
    player,
    buildings,
    props,
    cars,
    pedestrians,
    get state() { return stateVal; },
    set state(v) { stateVal = v; },
    get time() { return time; },
    get crimeHeat() { return crimeHeat; },
    set crimeHeat(v) { crimeHeat = v; },
    get missionIndex() { return missionIndexVal; },
    set missionIndex(v) { missionIndexVal = v; },
    get campaignDone() { return campaignDoneVal; },
    set campaignDone(v) { campaignDoneVal = v; },
    get wanted() { return wantedVal; },
    set wanted(v) { wantedVal = v; },
  };

  worldObj.police = createPolice(worldObj);
  worldObj.missions = createMissions(worldObj);

  function commitCrime(events, kind, x, y) {
    crimeHeat += 1;
    if (worldObj.police) {
      worldObj.police.addCrime(kind, x, y);
    }
    if (events) {
      events.push({ type: 'crime', kind, x, y });
    }
  }

  function hurtPedestrian(ped, amount, events, cause) {
    if (ped.state === 'down') return;
    ped.health -= amount;
    ped.state = 'flee';
    ped.fleeTimer = 5.0;
    if (ped.health <= 0) {
      ped.state = 'down';
      commitCrime(events, 'assault', ped.x, ped.y);
    } else {
      commitCrime(events, 'pedestrian-hit', ped.x, ped.y);
    }
  }

  function playerShoot(events, aimWorld) {
    const aimAngle = aimWorld ? Math.atan2(aimWorld.y - player.y, aimWorld.x - player.x) : player.angle;
    player.angle = aimAngle;

    if (player.weapon === 'pistol') {
      if (player.ammo <= 0) return;
      player.ammo -= 1;
      if (events) events.push({ type: 'shot', x: player.x, y: player.y });
      commitCrime(events, 'gunfire', player.x, player.y);

      // Hitscan ray
      const rayLen = WEAPONS.pistol.range;
      const endX = player.x + Math.cos(aimAngle) * rayLen;
      const endY = player.y + Math.sin(aimAngle) * rayLen;

      // Check pedestrian hit
      for (const ped of pedestrians) {
        if (ped.state !== 'down') {
          const dist = Math.hypot(ped.x - player.x, ped.y - player.y);
          if (dist <= rayLen) {
            const pedAngle = Math.atan2(ped.y - player.y, ped.x - player.x);
            if (Math.abs(pedAngle - aimAngle) < 0.3) {
              hurtPedestrian(ped, WEAPONS.pistol.damage, events, 'shot');
              break;
            }
          }
        }
      }
    } else if (player.weapon === 'fists') {
      if (events) events.push({ type: 'melee', x: player.x, y: player.y });
      commitCrime(events, 'assault', player.x, player.y);
      for (const ped of pedestrians) {
        if (ped.state !== 'down' && Math.hypot(ped.x - player.x, ped.y - player.y) <= WEAPONS.fists.range) {
          hurtPedestrian(ped, WEAPONS.fists.damage, events, 'melee');
          break;
        }
      }
    }
  }

  function update(dt, input, eventsArray, aimWorld) {
    const events = eventsArray || [];
    time += dt;

    if (player.invulnTimer > 0) {
      player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    }

    // Handle Player Input (Foot vs Driving)
    if (player.car) {
      // Driving physics
      const car = player.car;
      const conf = VEHICLE_CLASSES[car.classKey] || VEHICLE_CLASSES.sedan;

      let throttle = 0;
      let steer = 0;
      if (input && input.moveY < 0) throttle = 1;
      if (input && input.moveY > 0) throttle = -0.5;
      if (input && input.moveX < 0) steer = -1;
      if (input && input.moveX > 0) steer = 1;

      car.speed += throttle * conf.accel * dt;
      car.speed *= 0.98; // friction
      car.angle += steer * (car.speed / conf.speed) * 2.0 * dt;

      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;

      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;

      if (input && input.interact) {
        // Exit car
        player.car = null;
        player.x += 40;
        events.push({ type: 'exit-car', car });
      }
    } else {
      // On foot movement
      let moveX = input ? input.moveX : 0;
      let moveY = input ? input.moveY : 0;
      let speed = input && input.sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;

      if (moveX !== 0 || moveY !== 0) {
        const len = Math.hypot(moveX, moveY);
        moveX /= len;
        moveY /= len;
        player.x += moveX * speed * dt;
        player.y += moveY * speed * dt;
        player.angle = Math.atan2(moveY, moveX);
      }

      if (aimWorld) {
        player.angle = Math.atan2(aimWorld.y - player.y, aimWorld.x - player.x);
      }

      if (input && input.shoot) {
        playerShoot(events, aimWorld);
      }

      if (input && input.interact) {
        // Check nearby cars to enter
        for (const car of cars) {
          if (Math.hypot(car.x - player.x, car.y - player.y) < 50) {
            player.car = car;
            const hadDriver = car.driver === 'ai';
            if (hadDriver) {
              pedestrians.push({
                x: car.x,
                y: car.y,
                angle: rng.range(0, Math.PI * 2),
                speed: rng.range(40, 70),
                color: rng.pick(['#ffcc00', '#3366ff', '#ff3366', '#33cc66', '#cc33ff']),
                state: 'flee',
                health: 20,
                targetX: car.x + rng.range(-150, 150),
                targetY: car.y + rng.range(-150, 150),
                fleeTimer: 5.0,
              });
              commitCrime(events, 'carjack', car.x, car.y);
            }
            car.driver = 'player';
            events.push({ type: 'enter-car', car });
            break;
          }
        }
      }
    }

    // Step Traffic Cars
    for (const car of cars) {
      if (car.driver === 'ai') {
        car.speed = 150;
        car.angle += rng.range(-0.02, 0.02);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;

        // Wrap around world edges
        if (car.x < 0) car.x = WORLD.width;
        if (car.x > WORLD.width) car.x = 0;
        if (car.y < 0) car.y = WORLD.height;
        if (car.y > WORLD.height) car.y = 0;
      }
    }

    // Step Pedestrians
    for (const ped of pedestrians) {
      if (ped.state === 'down') continue;
      
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        ped.angle += rng.range(-0.5, 0.5);
        ped.x += Math.cos(ped.angle) * (ped.speed * 1.8) * dt;
        ped.y += Math.sin(ped.angle) * (ped.speed * 1.8) * dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      } else {
        const dist = Math.hypot(ped.targetX - ped.x, ped.targetY - ped.y);
        if (dist < 20) {
          ped.targetX = rng.range(100, WORLD.width - 100);
          ped.targetY = rng.range(100, WORLD.waterY - 100);
        }
        const targetAngle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
        ped.angle = targetAngle;
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }

      // Check flee from player / gunfire
      if (Math.hypot(player.x - ped.x, player.y - ped.y) < 120 && (player.car || crimeHeat > 0)) {
        ped.state = 'flee';
        ped.fleeTimer = 3.0;
      }
    }

    if (player.health <= 0 && stateVal !== 'wasted') {
      stateVal = 'wasted';
      events.push({ type: 'wasted' });
    }

    // Update Police and Missions
    if (worldObj.police) {
      worldObj.police.update(dt, events);
    }
    if (worldObj.missions) {
      worldObj.missions.update(dt, events);
    }

    // Compatibility return / event flags for starter kit if needed
    let bitFlags = 0;
    if (player.health <= 0) bitFlags |= EVENT_OVER;
    return eventsArray ? events : bitFlags;
  }

  function step(dt, directionOrInput, harmlessOrAim) {
    if (typeof directionOrInput === 'number') {
      // Compatibility with starter kit step(dt, direction, harmless)
      player.x = Math.min(WORLD.width - player.width, Math.max(0, player.x + directionOrInput * PLAYER.walkSpeed * dt));
      let events = 0;
      if (player.health <= 0) events |= EVENT_OVER;
      return events;
    }
    return update(dt, directionOrInput, [], harmlessOrAim);
  }

  function reset() {
    player.x = 1600;
    player.y = 1600;
    player.health = PLAYER.healthMax;
    player.car = null;
    player.ammo = WEAPONS.pistol.ammo;
    stateVal = 'playing';
    crimeHeat = 0;
    wantedVal = 0;
  }

  function toSave() {
    return {
      money: player.money,
      missionIndex: missionIndexVal,
      playerX: player.x,
      playerY: player.y,
      campaignDone: campaignDoneVal,
    };
  }

  function loadSave(save) {
    if (!save) return;
    if (save.money !== undefined) player.money = save.money;
    if (save.missionIndex !== undefined) missionIndexVal = save.missionIndex;
    if (save.playerX !== undefined) player.x = save.playerX;
    if (save.playerY !== undefined) player.y = save.playerY;
    if (save.campaignDone !== undefined) campaignDoneVal = save.campaignDone;
  }

  worldObj.reset = reset;
  worldObj.step = step;
  worldObj.update = update;
  worldObj.hurtPedestrian = hurtPedestrian;
  worldObj.commitCrime = commitCrime;
  worldObj.playerShoot = playerShoot;
  worldObj.toSave = toSave;
  worldObj.loadSave = loadSave;

  return worldObj;
}
