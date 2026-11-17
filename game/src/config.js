// Night Run: Port Solano - Configuration & Tuning Constants
// Includes full open-world crime game tuning and starter kit compatibility constants.

export const FIELD = { width: 1280, height: 720, groundY: 664 };
export const STEP = 1 / 60;

// World & City dimensions
export const WORLD = {
  width: 3200,
  height: 3200,
  blockSize: 360,
  roadWidth: 96,
  sidewalkWidth: 28,
  waterY: 2800,
};

export const DISTRICTS = [
  { name: 'Solano Bay', minX: 1600, minY: 0, maxX: 3200, maxY: 1400 },
  { name: 'Old Market', minX: 0, minY: 0, maxX: 1600, maxY: 1400 },
  { name: 'Harbor Row', minX: 0, minY: 1400, maxX: 1600, maxY: 2800 },
  { name: 'Palms District', minX: 1600, minY: 1400, maxX: 3200, maxY: 2800 },
];

export const PLAYER = {
  width: 32,
  height: 32,
  walkSpeed: 140,
  runSpeed: 260,
  healthMax: 100,
  invulnerable: 1.5,
  reach: 48,
};

export const VEHICLE_CLASSES = {
  sedan: { name: 'Solano Sedan', color: '#526078', speed: 380, accel: 250, durability: 100, grip: 0.90 },
  sports: { name: 'Viper GT', color: '#c93b3b', speed: 520, accel: 400, durability: 70, grip: 0.85 },
  truck: { name: 'Dock Hauler', color: '#786852', speed: 310, accel: 200, durability: 220, grip: 0.95 },
  police: { name: 'Port Police', color: '#2b4d8c', speed: 460, accel: 340, durability: 150, grip: 0.92 },
};

export const WANTED = {
  decayTime: 30, // seconds out of sight to drop one star
  maxStars: 5,
  bustedDuration: 2.0, // seconds standing still near police when wanted
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 15, range: 48, rate: 0.4 },
  pistol: { name: '9mm Pistol', damage: 35, range: 500, rate: 0.25, ammo: 50 },
};

export const MISSIONS = [
  {
    id: 1,
    title: 'Harbor Cargo Run',
    briefing: 'Pick up the smuggling manifest at Harbor Row and deliver it to Old Market.',
    reward: 1000,
    target: { x: 800, y: 2200 },
    dropoff: { x: 800, y: 600 },
  },
  {
    id: 2,
    title: 'Midnight Delivery',
    briefing: 'Steal a sports car and reach the Solano Bay waterfront before the timer expires.',
    reward: 2000,
    timeLimit: 90,
    target: { x: 2400, y: 800 },
  },
  {
    id: 3,
    title: 'Asset Recovery',
    briefing: 'Collect 3 hidden cash drops around the city while avoiding police patrols.',
    reward: 3500,
    dropsNeeded: 3,
  },
  {
    id: 4,
    title: 'Bridge Escape',
    briefing: 'Trigger a 3-star wanted level and escape across the southern bay bridge.',
    reward: 5000,
    target: { x: 1600, y: 2950 },
    wantedRequired: 3,
  },
];

export const PALETTE = {
  backdrop: '#11141b',
  sky: '#1b1f2a',
  ground: '#2a3040',
  player: '#4fc3f7',
  block: '#e5534b',
  coin: '#f2c94c',
  panel: '#252b38',
  text: '#eef1f5',
  muted: '#8b93a3',
  road: '#2b2d38',
  sidewalk: '#d4b28c',
  water: '#1b4d4f',
  building: '#e0a96d',
  palm: '#4a7c59',
  hud: '#ffffff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'night-run.best';

// Starter kit backward-compatibility constants
export const LIVES = 3;
export const BLOCK = {
  minWidth: 40,
  maxWidth: 110,
  height: 36,
  speed: 240,
  speedPerLevel: 30,
  speedJitter: 90,
  interval: 0.55,
  intervalScale: 0.88,
  minInterval: 0.14,
  dodgePoints: 1,
};
export const COIN = {
  size: 24,
  speed: 190,
  speedPerLevel: 14,
  interval: 1.4,
  intervalJitter: 0.8,
  points: 10,
};
export const LEVEL = { seconds: 12, max: 12 };
export const POOL_SIZE = 64;
