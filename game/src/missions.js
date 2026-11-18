// Night Run: Port Solano - Mission System
// Implements MISSIONS lifecycle (M1 to M4), objectives, markers, timers, rewards, and HUD reporting.

import { MISSIONS } from './config.js';

export function createMissions(world) {
  let step = 1;
  let channelTime = 0;
  let timer = 0;
  let m3Drops = [];
  let initializedMissionIndex = -1;

  function initMission(idx) {
    step = 1;
    channelTime = 0;
    const mission = MISSIONS[idx];
    if (!mission) return;
    if (mission.id === 2) {
      timer = mission.timeLimit || 90;
    } else if (mission.id === 3) {
      m3Drops = [];
      // Generate 3 cash drops using world / random
      for (let i = 0; i < 3; i++) {
        m3Drops.push({
          x: 200 + Math.random() * (3200 - 400),
          y: 200 + Math.random() * (2800 - 400),
        });
      }
    }
  }

  function update(dt, events) {
    const idx = world.missionIndex;
    if (idx !== initializedMissionIndex) {
      initializedMissionIndex = idx;
      initMission(idx);
    }

    const mission = MISSIONS[idx];
    if (!mission) return;

    const p = world.player;

    if (mission.id === 1) {
      if (step === 1) {
        const target = mission.target;
        const dist = Math.hypot(p.x - target.x, p.y - target.y);
        if (dist <= 60) {
          channelTime += dt;
          if (channelTime >= 1.0) {
            events.push({ type: 'pickup' });
            step = 2;
            channelTime = 0;
          }
        } else {
          channelTime = Math.max(0, channelTime - dt * 2);
        }
      } else if (step === 2) {
        const dropoff = mission.dropoff;
        const dist = Math.hypot(p.x - dropoff.x, p.y - dropoff.y);
        if (dist <= 60) {
          // Complete Mission 1
          p.money += mission.reward;
          events.push({ type: 'mission-done', id: mission.id });
          world.missionIndex += 1;
        }
      }
    } else if (mission.id === 2) {
      if (step === 1) {
        if (p.car && p.car.classKey === 'sports') {
          step = 2;
          timer = mission.timeLimit || 90;
        }
      } else if (step === 2) {
        timer -= dt;
        if (timer <= 0) {
          step = 1;
          timer = mission.timeLimit || 90;
          events.push({ type: 'mission-failed' });
        } else {
          const target = mission.target;
          const dist = Math.hypot(p.x - target.x, p.y - target.y);
          if (dist <= 60) {
            p.money += mission.reward;
            events.push({ type: 'mission-done', id: mission.id });
            world.missionIndex += 1;
          }
        }
      }
    } else if (mission.id === 3) {
      // Collect cash drops
      for (let i = m3Drops.length - 1; i >= 0; i--) {
        const drop = m3Drops[i];
        if (Math.hypot(p.x - drop.x, p.y - drop.y) <= 40) {
          m3Drops.splice(i, 1);
          events.push({ type: 'cash', amount: 150 });
          world.commitCrime(events, 'cash-grab', drop.x, drop.y);
        }
      }
      if (m3Drops.length === 0) {
        p.money += mission.reward;
        events.push({ type: 'mission-done', id: mission.id });
        world.missionIndex += 1;
      }
    } else if (mission.id === 4) {
      const wantedReq = mission.wantedRequired || 3;
      if (step === 1) {
        if (world.wanted >= wantedReq) {
          step = 2;
        }
      } else if (step === 2) {
        if (world.wanted >= wantedReq && p.x >= 1520 && p.x <= 1680 && p.y >= 2900) {
          p.money += mission.reward;
          world.wanted = 0;
          world.campaignDone = true;
          events.push({ type: 'mission-done', id: mission.id });
          world.missionIndex += 1;
        }
      }
    }
  }

  function current() {
    const idx = world.missionIndex;
    const mission = MISSIONS[idx];
    if (!mission) {
      return {
        mission: null,
        step: 1,
        objectiveText: 'Campaign Complete! Enjoy Port Solano.',
        marker: null,
        timer: 0,
      };
    }

    let objectiveText = mission.briefing;
    let marker = null;
    let hudTimer = timer;

    if (mission.id === 1) {
      if (step === 1) {
        objectiveText = 'Pick up smuggling manifest at Harbor Row.';
        marker = mission.target;
      } else {
        objectiveText = 'Deliver manifest to Old Market dropoff.';
        marker = mission.dropoff;
      }
    } else if (mission.id === 2) {
      if (step === 1) {
        objectiveText = 'Steal a Viper GT (sports car).';
        marker = null;
      } else {
        objectiveText = 'Reach Solano Bay waterfront before time runs out.';
        marker = mission.target;
      }
    } else if (mission.id === 3) {
      objectiveText = `Collect cash drops (${m3Drops.length} remaining).`;
      if (m3Drops.length > 0) {
        // Find nearest drop
        let nearest = m3Drops[0];
        let minDist = Math.hypot(world.player.x - nearest.x, world.player.y - nearest.y);
        for (let i = 1; i < m3Drops.length; i++) {
          const d = Math.hypot(world.player.x - m3Drops[i].x, world.player.y - m3Drops[i].y);
          if (d < minDist) {
            minDist = d;
            nearest = m3Drops[i];
          }
        }
        marker = nearest;
      }
    } else if (mission.id === 4) {
      if (step === 1) {
        objectiveText = 'Raise wanted level to 3 stars.';
        marker = null;
      } else {
        objectiveText = 'Escape across the southern bay bridge with 3+ stars.';
        marker = mission.target;
      }
    }

    return {
      mission,
      step,
      objectiveText,
      marker,
      timer: hudTimer,
    };
  }

  return {
    update,
    current,
  };
}
