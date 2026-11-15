// Prism Breaker — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720, paddleY: 664 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PADDLE = {
  width: 120,
  height: 24,
  speed: 620,
  wideScale: 1.6,
  wideSeconds: 12,
};

export const BALL = {
  radius: 8,
  speed: 460,
  speedPerLevel: 26,
  maxSpeed: 660,
  slowScale: 0.7,
  slowSeconds: 10,
  /** A bounce flatter than this is pushed away from vertical, so the ball never loops. */
  minHorizontal: 80,
  /** Small seeded jitter on every paddle bounce, for the same reason. */
  jitter: 12,
};

export const BRICK = {
  columns: 11,
  width: 96,
  height: 26,
  gapX: 8,
  gapY: 10,
  x0: 72,
  y0: 76,
  /** Points by row from the top; the deepest rows pay the least. */
  rowPoints: [50, 40, 30, 20, 10, 10, 10],
  toughPoints: 120,
  bonusPoints: 80,
  /** Chance a plain brick drops a power-up when it breaks. */
  dropChance: 0.12,
};

export const POWERUP = {
  fallSpeed: 150,
  size: 26,
  /** Weights for a dropped power-up: wide, multi-ball, slow, extra life. */
  weights: [0.3, 0.25, 0.25, 0.2],
};

export const LIVES = 3;
export const MAX_LIVES = 5;
export const LEVEL_CLEAR_BONUS = 500;

/** Combo: every 4 bricks in a row without losing the ball raises the multiplier, to x5. */
export const COMBO = { perMultiplier: 4, max: 5 };

export const LEVELS = [
  { name: 'First Light' },
  { name: 'Chevron' },
  { name: 'Fortress' },
  { name: 'Diamond' },
  { name: 'The Crown' },
];

export const PALETTE = {
  backdrop: '#070a18',
  field: '#0d1230',
  fieldEdge: '#1a2150',
  paddle: '#37e6ff',
  paddleCore: '#e8fbff',
  ball: '#ffffff',
  ballTrail: '#7fe9ff',
  brickNormal: ['#ff5d8f', '#ff9f43', '#f9e04b', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6'],
  brickTough: '#c4b5fd',
  brickToughCore: '#8b5cf6',
  brickBonus: '#ffd166',
  powerWide: '#37e6ff',
  powerMulti: '#ff5d8f',
  powerSlow: '#4ade80',
  powerLife: '#ffd166',
  text: '#eef2ff',
  muted: '#93a0c8',
  accent: '#ffd166',
  danger: '#ff5d5d',
  panel: '#131a3acc',
  panelEdge: '#2b3a72',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'prism-breaker.best';
