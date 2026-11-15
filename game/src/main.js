// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, level-clear, game over
// and victory. Space starts the game AND launches the ball, so one press is enough.
// ?seed=N fixes the falling pattern. ?shot=start|play|clear|over|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. window.__game exposes the live state for tests.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BRICK, EVENT_CLEAR, EVENT_LOST, EVENT_OVER, EVENT_POWER, EVENT_WIN, createWorld,
} from './world.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import {
  SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error || 'error'));
});
window.__game = { screen: 'title', score: 0, lives: LIVES, level: 1, bricksLeft: 0, multiplier: 1 };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const screens = ['title', 'play', 'paused', 'clear', 'over', 'win'];
  const screen = screens[scene.screen] || 'title';
  let painted = 0;
  function paint() {
    renderer.draw(world.state, screen, readBest());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function refreshGame() {
    window.__game = {
      screen,
      score: world.state.score,
      lives: world.state.lives,
      level: world.state.level,
      bricksLeft: world.state.bricksLeft,
      multiplier: world.state.multiplier,
    };
  }

  function launchBall() {
    world.launch();
    audio.play('launch');
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    launchBall();
    announce(`Playing. ${LIVES} lives.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `You win! Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function pointerFieldX() {
    const clientX = input.pointerClientX();
    return clientX === null ? null : renderer.fieldX(clientX);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_CLEAR) {
      screen = SCREEN_PLAY;
      launchBall();
      announce('Playing.');
    } else if (actions & ACTION_CONFIRM && (screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_PLAY) {
      if (world.state.balls.some((ball) => ball.active && ball.stuck)) launchBall();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { direction: 0, pointerX: null }, true);
      return;
    }
    const events = world.step(STEP, { direction: input.direction(), pointerX: pointerFieldX() }, false);
    if (events & EVENT_WIN) {
      audio.play('win');
      endGame(true);
    } else if (events & EVENT_CLEAR) {
      audio.play('clear');
      screen = SCREEN_CLEAR;
      announce(`Level clear. Score ${world.state.score}.`);
    } else if (events & EVENT_OVER) {
      audio.play('over');
      endGame(false);
    } else {
      if (events & EVENT_BRICK) audio.play('brick', world.state.level);
      if (events & EVENT_POWER) audio.play('power');
      if (events & EVENT_LOST) {
        audio.play('lose');
        announce(world.state.lives === 1 ? 'Ball lost. 1 life left.' : `Ball lost. ${world.state.lives} lives left.`);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
    refreshGame();
  }

  // Leaving the tab pauses a running game rather than letting the ball fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Prism Breaker. Press Space or click to start.');
  refreshGame();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
