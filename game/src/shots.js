// Night Run: Port Solano - Deterministic Screenshot Staging
// Sets up exact scenes for ?shot=start|drive|chase|foot&seed=<n> and sets document.title = "shot-ready".

import { createWorld } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { VEHICLE_CLASSES } from './config.js';

export function stageShot(name, world, seed = 6) {
  // Re-create world with specific seed
  const seededWorld = createWorld(seed);
  
  // Copy mutable world arrays and properties
  world.player = seededWorld.player;
  world.cars = seededWorld.cars;
  world.pedestrians = seededWorld.pedestrians;
  world.buildings = seededWorld.buildings;
  world.props = seededWorld.props;
  world.wanted = seededWorld.wanted;
  world.missionIndex = seededWorld.missionIndex;
  world.campaignDone = seededWorld.campaignDone;
  world.crimeHeat = seededWorld.crimeHeat;

  if (name === 'start') {
    return { screen: SCREEN_TITLE, hasSave: true };
  } else if (name === 'drive') {
    // Place player in a sedan on a main avenue moving forward
    const sedan = world.cars.find(c => c.classKey === 'sedan') || world.cars[0];
    if (sedan) {
      sedan.x = 1000;
      sedan.y = 720;
      sedan.angle = 0;
      sedan.speed = 300;
      sedan.driver = 'player';
      world.player.car = sedan;
      world.player.x = sedan.x;
      world.player.y = sedan.y;
    }
    world.missionIndex = 0;
    return { screen: SCREEN_PLAY };
  } else if (name === 'chase') {
    // 3 wanted stars, player in sports car, police cars closing in
    world.wanted = 3;
    const sports = world.cars.find(c => c.classKey === 'sports') || world.cars[0];
    if (sports) {
      sports.x = 1440;
      sports.y = 1440;
      sports.angle = 0;
      sports.speed = 400;
      sports.driver = 'player';
      world.player.car = sports;
      world.player.x = sports.x;
      world.player.y = sports.y;
    }
    // Take 2 other cars and make them police cars
    const otherCars = world.cars.filter(c => c !== sports);
    if (otherCars.length >= 2) {
      const p1 = otherCars[0];
      p1.classKey = 'police';
      p1.color = VEHICLE_CLASSES.police.color;
      p1.x = 1300;
      p1.y = 1440;
      p1.angle = 0;
      p1.speed = 420;
      p1.driver = 'police';

      const p2 = otherCars[1];
      p2.classKey = 'police';
      p2.color = VEHICLE_CLASSES.police.color;
      p2.x = 1180;
      p2.y = 1440;
      p2.angle = 0;
      p2.speed = 420;
      p2.driver = 'police';
    }
    world.missionIndex = 3;
    return { screen: SCREEN_PLAY };
  } else if (name === 'foot') {
    // Player on foot near mission marker with pedestrians around
    world.player.x = 720;
    world.player.y = 2200;
    world.player.car = null;
    world.missionIndex = 0;
    // Move 4 pedestrians to within 120 px of player on road/sidewalk
    if (world.pedestrians.length >= 4) {
      world.pedestrians[0].x = 720;
      world.pedestrians[0].y = 2120;
      world.pedestrians[1].x = 720;
      world.pedestrians[1].y = 2280;
      world.pedestrians[2].x = 640;
      world.pedestrians[2].y = 2200;
      world.pedestrians[3].x = 800;
      world.pedestrians[3].y = 2200;
    }
    return { screen: SCREEN_PLAY };
  }

  return { screen: SCREEN_TITLE };
}
