// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon glow (shadowBlur), a starfield, ball trails, brick particles and a small
// screen shake give it feel; the HUD and the panels tell the player how they are doing.
// Text that holds a number is rebuilt only when the number changes, so a frame allocates
// almost nothing. The renderer keeps its own frame counter for pulsing and shake — the
// world itself stays deterministic.
import { FIELD, FONT, LEVELS, LIVES, PALETTE } from './config.js';
import { KIND_BONUS, KIND_TOUGH } from './levels.js';
import { POWER_LIFE, POWER_MULTI, POWER_SLOW, POWER_WIDE } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 36, bottom: 76 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const levelLabel = cachedLabel('');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  let frame = 0;
  const trails = new Map();

  // A fixed starfield, generated once from a seed so every load looks the same.
  const stars = [];
  {
    let a = 1337;
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 90; i += 1) {
      stars.push({ x: next() * FIELD.width, y: next() * FIELD.height, r: 0.6 + next() * 1.6, phase: next() * Math.PI * 2 });
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /** Page pixel x (clientX) to field x, through the current view transform. */
  function fieldX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const backingX = ((clientX - rect.left) / rect.width) * canvas.width;
    return (backingX - view.x) / view.scale;
  }

  function drawStars() {
    for (const star of stars) {
      const alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(frame * 0.03 + star.phase));
      context.globalAlpha = alpha;
      context.fillStyle = '#cdd8ff';
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawBricks(state) {
    for (const brick of state.bricks) {
      if (!brick.active) continue;
      const cx = brick.x + brick.width / 2;
      const cy = brick.y + brick.height / 2;
      let color;
      if (brick.kind === KIND_TOUGH) color = brick.hits === 0 ? PALETTE.brickTough : PALETTE.brickToughCore;
      else if (brick.kind === KIND_BONUS) color = PALETTE.brickBonus;
      else color = PALETTE.brickNormal[brick.row % PALETTE.brickNormal.length];
      context.save();
      context.shadowColor = color;
      context.shadowBlur = brick.kind === KIND_BONUS ? 18 + 8 * Math.sin(frame * 0.08) : 12;
      context.fillStyle = color;
      roundRect(context, brick.x + 2, brick.y + 2, brick.width - 4, brick.height - 4, 6);
      context.fill();
      context.restore();
      // A glassy top edge so each prism reads as a solid block.
      context.fillStyle = 'rgba(255,255,255,0.28)';
      roundRect(context, brick.x + 5, brick.y + 4, brick.width - 10, 5, 3);
      context.fill();
      if (brick.kind === KIND_TOUGH && brick.hits === 1) {
        context.strokeStyle = 'rgba(20,10,40,0.8)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(brick.x + 14, brick.y + 4);
        context.lineTo(brick.x + brick.width / 2, brick.y + brick.height - 5);
        context.lineTo(brick.x + brick.width - 12, brick.y + 6);
        context.stroke();
      }
      if (brick.kind === KIND_BONUS) {
        text('★', cx, cy + 8, 18, '#3a2a00', 'center');
      }
    }
  }

  function drawPaddle(state) {
    const paddle = state.paddle;
    const wide = paddle.width > 130;
    context.save();
    context.shadowColor = PALETTE.paddle;
    context.shadowBlur = 22;
    context.fillStyle = PALETTE.paddle;
    roundRect(context, paddle.x, paddle.y, paddle.width, paddle.height, 12);
    context.fill();
    context.restore();
    context.fillStyle = PALETTE.paddleCore;
    roundRect(context, paddle.x + 6, paddle.y + 4, paddle.width - 12, 7, 4);
    context.fill();
    if (wide) {
      context.fillStyle = 'rgba(55,230,255,0.25)';
      roundRect(context, paddle.x - 4, paddle.y - 3, paddle.width + 8, paddle.height + 6, 14);
      context.fill();
    }
  }

  function drawBalls(state) {
    for (let i = 0; i < state.balls.length; i += 1) {
      const ball = state.balls[i];
      if (!ball.active) continue;
      if (!trails.has(i)) trails.set(i, []);
      const trail = trails.get(i);
      if (!ball.stuck) {
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 9) trail.shift();
      } else {
        trail.length = 0;
      }
      for (let t = 0; t < trail.length; t += 1) {
        const point = trail[t];
        context.globalAlpha = (t / trail.length) * 0.35;
        context.fillStyle = PALETTE.ballTrail;
        context.beginPath();
        context.arc(point.x, point.y, 8 * (t / trail.length) + 1, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.save();
      context.shadowColor = '#9beaff';
      context.shadowBlur = 18;
      context.fillStyle = PALETTE.ball;
      context.beginPath();
      context.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawPowerups(state) {
    const letters = ['W', 'M', 'S', '+'];
    const colors = [PALETTE.powerWide, PALETTE.powerMulti, PALETTE.powerSlow, PALETTE.powerLife];
    for (const item of state.powerups) {
      if (!item.active) continue;
      const color = colors[item.kind];
      context.save();
      context.shadowColor = color;
      context.shadowBlur = 14;
      context.fillStyle = color;
      roundRect(context, item.x - 14, item.y - 14, 28, 28, 8);
      context.fill();
      context.restore();
      text(letters[item.kind], item.x, item.y + 7, 18, '#10142a', 'center');
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 28, 18, 30, PALETTE.text, 'left');
    const levelName = LEVELS[state.level - 1].name.toUpperCase();
    text(`LEVEL ${state.level} · ${levelName}`, FIELD.width / 2, 20, 24, PALETTE.muted, 'center');
    if (state.multiplier > 1) {
      text(`COMBO ×${state.multiplier}`, 28, 56, 22, PALETTE.accent, 'left');
    }
    // Lives as small paddle glyphs, top right.
    const glyphW = 26;
    const glyphH = 8;
    const gap = 8;
    const firstX = FIELD.width - 28 - LIVES * (glyphW + gap) + gap;
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? PALETTE.paddle : 'rgba(147,160,200,0.25)';
      roundRect(context, firstX + life * (glyphW + gap), 26, glyphW, glyphH, 4);
      context.fill();
    }
    // Active power-up timers, small bars under the level name.
    let barX = FIELD.width / 2 - 110;
    if (state.paddle.wideTimer > 0) {
      context.fillStyle = 'rgba(55,230,255,0.3)';
      context.fillRect(barX, 52, 100, 6);
      context.fillStyle = PALETTE.powerWide;
      context.fillRect(barX, 52, 100 * (state.paddle.wideTimer / 12), 6);
      text('WIDE', barX + 110, 46, 14, PALETTE.powerWide, 'left');
      barX += 0;
    }
    if (state.slowTimer > 0) {
      context.fillStyle = 'rgba(74,222,128,0.3)';
      context.fillRect(barX, 52, 100, 6);
      context.fillStyle = PALETTE.powerSlow;
      context.fillRect(barX, 52, 100 * (state.slowTimer / 10), 6);
      text('SLOW', barX + 110, 46, 14, PALETTE.powerSlow, 'left');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.save();
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x, y, PANEL.width, height, 18);
    context.fill();
    context.stroke();
    context.restore();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 52, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.accent, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    frame += 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    let shakeX = 0;
    let shakeY = 0;
    if (state.shakeTime > 0) {
      const power = state.shakePower * (state.shakeTime / 0.2);
      shakeX = Math.sin(frame * 2.7) * power;
      shakeY = Math.cos(frame * 3.1) * power;
    }
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    // Field backdrop with a neon rim.
    context.fillStyle = PALETTE.field;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.fieldEdge;
    context.lineWidth = 3;
    context.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
    drawStars();
    drawBricks(state);
    drawPowerups(state);
    drawParticles(state);
    drawPaddle(state);
    drawBalls(state);

    if (screen === SCREEN_TITLE) {
      drawPanel('PRISM BREAKER', [
        'Smash every prism. Clear all five levels to win.',
        'Move with the mouse or ← → / A D.  Catch falling power-ups:',
        'W wide paddle · M multi-ball · S slow ball · + extra life',
        bestLabel(best),
      ], 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The prisms will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_CLEAR) {
      const next = LEVELS[Math.min(state.level, LEVELS.length) - 1].name;
      drawPanel('Level Clear!', [`+${500} bonus. Next up: ${next}.`, `Score ${state.score}`], 'Press Space for the next level');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Game Over', [finalLabel(state.score), bestLabel(best)], 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('You Win!', ['Every prism shattered. The crown is yours.', finalLabel(state.score), bestLabel(best)], 'Press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, fieldX };
}
