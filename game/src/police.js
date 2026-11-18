// Night Run: Port Solano - Police & Wanted System
// Implements crime heat mapping, star gains, police car dispatch, AI pursuit, officer dispatch, and busted/decay mechanics.

import { WANTED, VEHICLE_CLASSES } from './config.js';

export function wantedForCrime(kind) {
  switch (kind) {
    case 'carjack':
      return 1;
    case 'pedestrian-hit':
    case 'hit':
    case 'assault':
    case 'gunfire':
    case 'cash-grab':
      return 1;
    case 'police-car-hit':
    case 'officer-down':
      return 2;
    default:
      return 1;
  }
}

export function createPolice(world) {
  let lastGunfireTime = -999;
  let timeSinceLastCrime = 0;
  let officers = []; // Track spawned officer pedestrians

  function addCrime(kind, x, y) {
    timeSinceLastCrime = 0;
    if (kind === 'gunfire') {
      if (world.time - lastGunfireTime < 2.0) return;
      lastGunfireTime = world.time;
    }

    const gain = wantedForCrime(kind);
    if (kind === 'cash-grab') {
      world.wanted = Math.min(3, world.wanted + gain);
    } else {
      world.wanted = Math.min(WANTED.maxStars, world.wanted + gain);
    }
  }

  function update(dt, events) {
    // 1. Wanted Decay
    if (world.wanted > 0) {
      timeSinceLastCrime += dt;
      let policeNearby = false;
      for (const car of world.cars) {
        if (car.classKey === 'police' && Math.hypot(car.x - world.player.x, car.y - world.player.y) <= 260) {
          policeNearby = true;
          break;
        }
      }
      for (const ped of world.pedestrians) {
        if (ped.role === 'officer' && Math.hypot(ped.x - world.player.x, ped.y - world.player.y) <= 260) {
          policeNearby = true;
          break;
        }
      }

      if (!policeNearby && timeSinceLastCrime >= WANTED.decayTime) {
        world.wanted = Math.max(0, world.wanted - 1);
        timeSinceLastCrime = 0;
      }
    } else {
      timeSinceLastCrime = 0;
    }

    // 2. Police Car Spawning / Despawning
    const targetPoliceCount = world.wanted > 0 ? Math.min(6, world.wanted + 1) : 0;
    let policeCars = world.cars.filter(c => c.classKey === 'police');

    if (policeCars.length < targetPoliceCount && world.wanted > 0) {
      // Spawn police car at road point 500-700 px from player
      const angle = Math.random() * Math.PI * 2;
      const dist = 500 + Math.random() * 200;
      const rx = world.player.x + Math.cos(angle) * dist;
      const ry = world.player.y + Math.sin(angle) * dist;
      const conf = VEHICLE_CLASSES.police;
      const newPoliceCar = {
        x: rx,
        y: ry,
        angle: Math.random() * Math.PI * 2,
        speed: 0,
        classKey: 'police',
        color: conf.color,
        health: conf.durability,
        driver: 'police',
      };
      world.cars.push(newPoliceCar);
      policeCars.push(newPoliceCar);
    } else if (world.wanted === 0 && policeCars.length > 0) {
      // Despawn police cars when wanted is 0
      for (let i = world.cars.length - 1; i >= 0; i--) {
        if (world.cars[i].classKey === 'police') {
          world.cars.splice(i, 1);
        }
      }
    }

    // 3. Police Car & Officer AI
    for (const car of world.cars) {
      if (car.classKey === 'police') {
        if (world.wanted > 0) {
          const targetX = world.player.car ? world.player.car.x : world.player.x;
          const targetY = world.player.car ? world.player.car.y : world.player.y;
          const distToTarget = Math.hypot(targetX - car.x, targetY - car.y);
          const targetAngle = Math.atan2(targetY - car.y, targetX - car.x);

          // Steer towards target
          let angleDiff = targetAngle - car.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          car.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.0 * dt);

          car.speed = Math.min(VEHICLE_CLASSES.police.speed, car.speed + 300 * dt);
          car.x += Math.cos(car.angle) * car.speed * dt;
          car.y += Math.sin(car.angle) * car.speed * dt;

          // Ram / damage player if close
          if (distToTarget < 50) {
            world.player.health -= 10 * dt;
            if (world.player.health <= 0 && world.state !== 'wasted') {
              world.state = 'wasted';
              events.push({ type: 'wasted' });
            }
          }

          // Officer spawn if stopped near on-foot player
          if (!world.player.car && distToTarget <= 60 && Math.abs(car.speed) < 50) {
            // Check if officer already spawned for this car
            const hasOfficer = world.pedestrians.some(p => p.role === 'officer' && Math.hypot(p.x - car.x, p.y - car.y) < 80);
            if (!hasOfficer) {
              const officer = {
                x: car.x + 30,
                y: car.y + 30,
                angle: car.angle,
                speed: 80,
                color: '#2b4d8c',
                state: 'pursue',
                health: 40,
                role: 'officer',
                targetX: world.player.x,
                targetY: world.player.y,
              };
              world.pedestrians.push(officer);
            }
          }
        } else {
          // Drive away / despawn
          car.speed = Math.min(200, car.speed + 100 * dt);
          car.x += Math.cos(car.angle) * car.speed * dt;
          car.y += Math.sin(car.angle) * car.speed * dt;
        }
      }
    }

    // 4. Officer Pedestrian AI & Busted Meter
    let officerOrStoppedPoliceNear = false;
    if (!world.player.car && world.wanted > 0) {
      for (const ped of world.pedestrians) {
        if (ped.role === 'officer' && ped.state !== 'down') {
          const dist = Math.hypot(world.player.x - ped.x, world.player.y - ped.y);
          const targetAngle = Math.atan2(world.player.y - ped.y, world.player.x - ped.x);
          ped.angle = targetAngle;
          ped.x += Math.cos(ped.angle) * ped.speed * dt;
          ped.y += Math.sin(ped.angle) * ped.speed * dt;

          if (dist <= 40) {
            officerOrStoppedPoliceNear = true;
          }
          if (dist <= 40) {
            world.player.health -= 5 * dt;
          }
        }
      }

      for (const car of world.cars) {
        if (car.classKey === 'police' && Math.hypot(car.x - world.player.x, car.y - world.player.y) <= 40 && Math.abs(car.speed) < 50) {
          officerOrStoppedPoliceNear = true;
        }
      }

      if (officerOrStoppedPoliceNear) {
        world.player.bustedMeter += dt / WANTED.bustedDuration;
        if (world.player.bustedMeter >= 1.0 && world.state !== 'busted') {
          world.state = 'busted';
          events.push({ type: 'busted' });
        }
      } else {
        world.player.bustedMeter = Math.max(0, world.player.bustedMeter - dt * 2);
      }
    } else {
      world.player.bustedMeter = Math.max(0, world.player.bustedMeter - dt * 2);
    }
  }

  return {
    addCrime,
    update,
  };
}
