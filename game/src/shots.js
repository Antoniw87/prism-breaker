// The screenshot scenes behind ?shot=start|play|clear|over|win. Each one plays the real
// rules forward from a fresh world, steered by a simple autopilot (predict where the
// lowest ball will land, put the paddle there), so the frame is what a short game really
// looks like and the same seed always gives the same frame. Screen codes are numbers:
// 0 title, 1 play, 3 level-clear, 4 game-over, 5 victory.
import { FIELD, STEP } from './config.js';
import { EVENT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';

const SCREEN_TITLE = 0;
const SCREEN_PLAY = 1;
const SCREEN_CLEAR = 3;
const SCREEN_OVER = 4;
const SCREEN_WIN = 5;

const START_SECONDS = 5;
const PLAY_SECONDS = 18;
const CLEAR_LIMIT_SECONDS = 240;
const OVER_LIMIT_SECONDS = 600;
const WIN_LIMIT_SECONDS = 1500;

/** Where the lowest falling ball will cross the paddle's line, with wall bounces folded in. */
function predictLanding(state) {
  let ball = null;
  for (const item of state.balls) {
    if (item.active && !item.stuck && (ball === null || item.y > ball.y)) ball = item;
  }
  if (ball === null) return FIELD.width / 2;
  if (ball.vy <= 0) return ball.x;
  const t = (FIELD.paddleY - ball.y) / ball.vy;
  let x = ball.x + ball.vx * t;
  const span = FIELD.width;
  x = ((x % (2 * span)) + 2 * span) % (2 * span);
  return x > span ? 2 * span - x : x;
}

function autopilot(state) {
  const centre = state.paddle.x + state.paddle.width / 2;
  const target = predictLanding(state);
  if (target > centre + 6) return 1;
  if (target < centre - 6) return -1;
  return 0;
}

/** One step with the pilot, relaunching a stuck ball first. Returns the step's events. */
function stepWithPilot(world) {
  if (world.state.balls.some((ball) => ball.active && ball.stuck)) world.launch();
  return world.step(STEP, { direction: autopilot(world.state), pointerX: null }, false);
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any name other than play/clear/over/win is the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'clear' && name !== 'over' && name !== 'win') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { direction: 0, pointerX: null }, true);
    }
    return { screen: SCREEN_TITLE };
  }
  if (name === 'over') {
    for (let i = 0; i < OVER_LIMIT_SECONDS / STEP; i += 1) {
      if (world.state.balls.some((ball) => ball.active && ball.stuck)) world.launch();
      const events = world.step(STEP, { direction: 0, pointerX: null }, false);
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER };
  }
  if (name === 'play') {
    let seconds = 0;
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      stepWithPilot(world);
      seconds += STEP;
      if (world.state.score >= 150 && seconds >= 6) break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'clear') {
    for (let i = 0; i < CLEAR_LIMIT_SECONDS / STEP; i += 1) {
      if (stepWithPilot(world) & EVENT_CLEAR) break;
    }
    return { screen: SCREEN_CLEAR };
  }
  // win: the pilot plays all five levels to the end.
  for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
    if (stepWithPilot(world) & EVENT_WIN) break;
  }
  return { screen: SCREEN_WIN };
}
