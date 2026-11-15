// Prism Breaker — the game's rules and state, with no drawing and no browser in it.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react without the world knowing about screens or sound. The only randomness is the
// seeded generator handed to createWorld, so the same seed and inputs always give the
// same game: that is what makes the screenshot scenes repeatable and the logic tests
// deterministic. Nothing here allocates after createWorld returns.
import {
  BALL, BRICK, COMBO, FIELD, LEVELS, LEVEL_CLEAR_BONUS, LIVES, MAX_LIVES, PADDLE, POWERUP,
} from './config.js';
import { KIND_BONUS, KIND_NORMAL, KIND_TOUGH, LEVEL_GRIDS } from './levels.js';

export const EVENT_BRICK = 1;
export const EVENT_CLEAR = 2;
export const EVENT_LOST = 4;
export const EVENT_OVER = 8;
export const EVENT_POWER = 16;
export const EVENT_WIN = 32;

export const POWER_WIDE = 0;
export const POWER_MULTI = 1;
export const POWER_SLOW = 2;
export const POWER_LIFE = 3;

const MAX_BALLS = 4;
const MAX_POWERUPS = 8;
const MAX_PARTICLES = 96;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function createWorld(random) {
  const paddle = { x: 0, y: FIELD.paddleY, width: PADDLE.width, height: PADDLE.height, wideTimer: 0 };
  const balls = [];
  for (let i = 0; i < MAX_BALLS; i += 1) {
    balls.push({ active: false, stuck: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
  const bricks = [];
  const powerups = [];
  for (let i = 0; i < MAX_POWERUPS; i += 1) {
    powerups.push({ active: false, kind: POWER_WIDE, x: 0, y: 0 });
  }
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#ffffff', size: 3 });
  }
  const state = {
    paddle, balls, bricks, powerups, particles,
    score: 0, lives: LIVES, level: 1, bricksLeft: 0,
    combo: 0, multiplier: 1, slowTimer: 0,
    shakeTime: 0, shakePower: 0,
  };

  function ballSpeed() {
    const base = Math.min(BALL.maxSpeed, BALL.speed + BALL.speedPerLevel * (state.level - 1));
    return state.slowTimer > 0 ? base * BALL.slowScale : base;
  }

  function stickBall() {
    const ball = balls[0];
    ball.active = true;
    ball.stuck = true;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - BALL.radius - 1;
    ball.vx = 0;
    ball.vy = 0;
    for (let i = 1; i < balls.length; i += 1) balls[i].active = false;
  }

  function buildBricks(level) {
    state.bricks.length = 0;
    const grid = LEVEL_GRIDS[level - 1];
    for (let row = 0; row < grid.length; row += 1) {
      const line = grid[row];
      for (let col = 0; col < line.length; col += 1) {
        const cell = line[col];
        if (cell === '.') continue;
        const kind = cell === 'b' ? KIND_BONUS : cell === 't' ? KIND_TOUGH : KIND_NORMAL;
        state.bricks.push({
          active: true, kind,
          x: BRICK.x0 + col * (BRICK.width + BRICK.gapX),
          y: BRICK.y0 + row * (BRICK.height + BRICK.gapY),
          width: BRICK.width, height: BRICK.height,
          row, hits: 0,
        });
      }
    }
    state.bricksLeft = state.bricks.length;
  }

  function loadLevel(level) {
    state.level = level;
    buildBricks(level);
    for (const item of powerups) item.active = false;
    for (const item of particles) item.active = false;
    state.slowTimer = 0;
    paddle.wideTimer = 0;
    paddle.width = PADDLE.width;
    paddle.x = (FIELD.width - paddle.width) / 2;
    stickBall();
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.combo = 0;
    state.multiplier = 1;
    state.shakeTime = 0;
    state.shakePower = 0;
    loadLevel(1);
  }

  function launch() {
    const ball = balls.find((item) => item.active && item.stuck);
    if (!ball) return;
    const speed = ballSpeed();
    const angle = (random() * 2 - 1) * 0.45;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    ball.stuck = false;
  }

  function spawnParticles(x, y, color, count) {
    let spawned = 0;
    for (let i = 0; i < particles.length && spawned < count; i += 1) {
      const p = particles[i];
      if (p.active) continue;
      const angle = random() * Math.PI * 2;
      const speed = 60 + random() * 220;
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.maxLife = 0.35 + random() * 0.35;
      p.life = p.maxLife;
      p.color = color;
      p.size = 2 + random() * 3;
      spawned += 1;
    }
  }

  function pickPowerKind() {
    const roll = random();
    const weights = POWERUP.weights;
    let kind = POWER_WIDE;
    let acc = 0;
    for (let i = 0; i < weights.length; i += 1) {
      acc += weights[i];
      if (roll < acc) { kind = i; break; }
    }
    if (kind === POWER_LIFE && state.lives >= MAX_LIVES) kind = POWER_WIDE;
    return kind;
  }

  function dropPowerup(x, y, force) {
    if (!force && random() >= BRICK.dropChance) return;
    for (const item of powerups) {
      if (item.active) continue;
      item.active = true;
      item.kind = pickPowerKind();
      item.x = x;
      item.y = y;
      return;
    }
  }

  function brickPoints(brick) {
    if (brick.kind === KIND_TOUGH) return BRICK.toughPoints;
    if (brick.kind === KIND_BONUS) return BRICK.bonusPoints;
    return BRICK.rowPoints[Math.min(brick.row, BRICK.rowPoints.length - 1)];
  }

  function breakBrick(brick, events, harmless) {
    if (brick.kind === KIND_TOUGH && brick.hits === 0) {
      brick.hits = 1;
      spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, '#c4b5fd', 6);
      state.shakeTime = 0.12;
      state.shakePower = 3;
      return events;
    }
    brick.active = false;
    state.bricksLeft -= 1;
    if (!harmless) {
      state.combo += 1;
      state.multiplier = Math.min(COMBO.max, 1 + Math.floor(state.combo / COMBO.perMultiplier));
      state.score += brickPoints(brick) * state.multiplier;
      dropPowerup(brick.x + brick.width / 2, brick.y + brick.height, brick.kind === KIND_BONUS);
    }
    const color = brick.kind === KIND_BONUS ? '#ffd166' : brick.kind === KIND_TOUGH ? '#8b5cf6' : '#ff5d8f';
    spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, color, 10);
    events |= EVENT_BRICK;
    if (state.bricksLeft === 0 && !harmless) {
      state.score += LEVEL_CLEAR_BONUS;
      events |= EVENT_CLEAR;
      if (state.level >= LEVELS.length) {
        events |= EVENT_WIN;
      } else {
        loadLevel(state.level + 1);
      }
    }
    return events;
  }

  function bouncePaddle(ball) {
    const centre = paddle.x + paddle.width / 2;
    const offset = clamp((ball.x - centre) / (paddle.width / 2), -1, 1);
    const speed = Math.hypot(ball.vx, ball.vy) || ballSpeed();
    const maxAngle = Math.PI / 3;
    let vx = Math.sin(offset * maxAngle) * speed;
    let vy = -Math.cos(offset * maxAngle) * speed;
    if (Math.abs(vx) < BALL.minHorizontal) {
      vx = (vx < 0 ? -1 : 1) * BALL.minHorizontal;
      vy = -Math.sqrt(Math.max(0, speed * speed - vx * vx));
    }
    vx += (random() * 2 - 1) * BALL.jitter;
    const scale = speed / Math.hypot(vx, vy);
    ball.vx = vx * scale;
    ball.vy = vy * scale;
    ball.y = paddle.y - BALL.radius - 0.5;
  }

  function applyPower(kind) {
    if (kind === POWER_WIDE) {
      paddle.width = PADDLE.width * PADDLE.wideScale;
      paddle.wideTimer = PADDLE.wideSeconds;
      paddle.x = clamp(paddle.x, 0, FIELD.width - paddle.width);
    } else if (kind === POWER_MULTI) {
      const active = balls.filter((item) => item.active && !item.stuck);
      for (const ball of active) {
        if (balls.filter((item) => item.active).length >= MAX_BALLS) break;
        const extra = balls.find((item) => !item.active);
        if (!extra) break;
        const speed = Math.hypot(ball.vx, ball.vy);
        const angle = Math.atan2(ball.vy, ball.vx) + (random() < 0.5 ? -0.45 : 0.45);
        extra.active = true;
        extra.stuck = false;
        extra.x = ball.x;
        extra.y = ball.y;
        extra.vx = Math.cos(angle) * speed;
        extra.vy = Math.sin(angle) * speed;
      }
    } else if (kind === POWER_SLOW) {
      const wasSlow = state.slowTimer > 0;
      state.slowTimer = BALL.slowSeconds;
      if (!wasSlow) {
        for (const ball of balls) {
          if (!ball.active || ball.stuck) continue;
          ball.vx *= BALL.slowScale;
          ball.vy *= BALL.slowScale;
        }
      }
    } else if (kind === POWER_LIFE) {
      state.lives = Math.min(MAX_LIVES, state.lives + 1);
    }
  }

  function loseBall(ball) {
    ball.active = false;
    if (balls.some((item) => item.active)) return 0;
    state.lives -= 1;
    state.combo = 0;
    state.multiplier = 1;
    state.shakeTime = 0.2;
    state.shakePower = 6;
    if (state.lives <= 0) return EVENT_LOST | EVENT_OVER;
    stickBall();
    return EVENT_LOST;
  }

  function collideBricks(ball, prevX, prevY, events, harmless) {
    for (const brick of state.bricks) {
      if (!brick.active) continue;
      const closestX = clamp(ball.x, brick.x, brick.x + brick.width);
      const closestY = clamp(ball.y, brick.y, brick.y + brick.height);
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      if (dx * dx + dy * dy >= BALL.radius * BALL.radius) continue;
      const wasAbove = prevY + BALL.radius <= brick.y + 1;
      const wasBelow = prevY - BALL.radius >= brick.y + brick.height - 1;
      const wasLeft = prevX + BALL.radius <= brick.x + 1;
      const wasRight = prevX - BALL.radius >= brick.x + brick.width - 1;
      if (wasAbove || wasBelow) {
        ball.vy = wasAbove ? -Math.abs(ball.vy) : Math.abs(ball.vy);
        ball.y = wasAbove ? brick.y - BALL.radius - 0.5 : brick.y + brick.height + BALL.radius + 0.5;
      } else if (wasLeft || wasRight) {
        ball.vx = wasLeft ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        ball.x = wasLeft ? brick.x - BALL.radius - 0.5 : brick.x + brick.width + BALL.radius + 0.5;
      } else {
        ball.vy = -ball.vy;
      }
      return breakBrick(brick, events, harmless);
    }
    return events;
  }

  /**
   * One fixed step. `input` is { direction: -1 | 0 | 1, pointerX: number | null }.
   * With `harmless` set (the title screen's backdrop) the paddle plays itself, bricks
   * break for show, and nothing scores or ends the game.
   */
  function step(dt, input, harmless) {
    let events = 0;
    if (state.slowTimer > 0) {
      const wasSlow = true;
      state.slowTimer = Math.max(0, state.slowTimer - dt);
      if (wasSlow && state.slowTimer === 0) {
        for (const ball of balls) {
          if (!ball.active || ball.stuck) continue;
          ball.vx /= BALL.slowScale;
          ball.vy /= BALL.slowScale;
        }
      }
    }
    if (paddle.wideTimer > 0) {
      paddle.wideTimer = Math.max(0, paddle.wideTimer - dt);
      if (paddle.wideTimer === 0) {
        paddle.width = PADDLE.width;
        paddle.x = clamp(paddle.x, 0, FIELD.width - paddle.width);
      }
    }
    if (state.shakeTime > 0) state.shakeTime = Math.max(0, state.shakeTime - dt);

    // The paddle: the pointer puts it where the mouse is, keys steer it, and on the
    // title screen it plays itself so the backdrop is alive.
    if (harmless) {
      let target = FIELD.width / 2;
      for (const ball of balls) {
        if (ball.active && !ball.stuck) { target = ball.x; break; }
      }
      const centre = paddle.x + paddle.width / 2;
      const delta = clamp(target - centre, -PADDLE.speed * dt, PADDLE.speed * dt);
      paddle.x = clamp(paddle.x + delta, 0, FIELD.width - paddle.width);
    } else if (input && input.pointerX !== null && input.pointerX !== undefined) {
      paddle.x = clamp(input.pointerX - paddle.width / 2, 0, FIELD.width - paddle.width);
    } else if (input) {
      paddle.x = clamp(paddle.x + input.direction * PADDLE.speed * dt, 0, FIELD.width - paddle.width);
    }

    for (const ball of balls) {
      if (!ball.active) continue;
      if (ball.stuck) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - BALL.radius - 1;
        continue;
      }
      const prevX = ball.x;
      const prevY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x - BALL.radius < 0) {
        ball.x = BALL.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + BALL.radius > FIELD.width) {
        ball.x = FIELD.width - BALL.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - BALL.radius < 0) {
        ball.y = BALL.radius;
        ball.vy = Math.abs(ball.vy);
      }
      if (ball.vy > 0 && ball.y + BALL.radius >= paddle.y && ball.y - BALL.radius <= paddle.y + paddle.height
        && ball.x >= paddle.x - BALL.radius && ball.x <= paddle.x + paddle.width + BALL.radius) {
        bouncePaddle(ball);
      }
      events = collideBricks(ball, prevX, prevY, events, harmless);
      if (ball.y - BALL.radius > FIELD.height) {
        if (harmless) {
          stickBall();
          launch();
        } else {
          events |= loseBall(ball);
          if (events & EVENT_OVER) break;
        }
      }
    }

    if (harmless && state.bricksLeft === 0) {
      buildBricks(1);
    }

    for (const item of powerups) {
      if (!item.active) continue;
      item.y += POWERUP.fallSpeed * dt;
      if (item.y > FIELD.height) {
        item.active = false;
        continue;
      }
      if (!harmless && item.y + POWERUP.size >= paddle.y && item.y <= paddle.y + paddle.height
        && item.x >= paddle.x - POWERUP.size / 2 && item.x <= paddle.x + paddle.width + POWERUP.size / 2) {
        item.active = false;
        applyPower(item.kind);
        events |= EVENT_POWER;
      }
    }

    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    return events;
  }

  reset();
  return { state, reset, step, loadLevel, launch };
}
