# Prism Breaker

An original neon breakout game, built for make.fun's **best-game-01** bounty
("Make the best game"). Bounce the ball with the paddle, smash every prism, and
clear all five levels — First Light, Chevron, Fortress, Diamond, The Crown — to win.

## How to play

- **Move:** mouse, or `←` `→` / `A` `D`
- **Start / launch / restart:** `Space`, `Enter`, or click
- **Pause:** `P` or `Esc`

You have 3 lives. Lose the ball 3 times and it's game over. The ball gets faster
every level, and the paddle bounce aims where it lands — hit the edge for a sharp
angle, the middle for a straight shot.

## Scoring

- Prisms pay by row: the top rows pay the most (50 down to 10).
- **Bonus prisms** (gold, ★) pay 80 and always drop a power-up.
- **Tough prisms** (purple) take two hits and pay 120.
- Breaking prisms in a row without losing the ball builds a **combo**: every 4 in
  a row raises the score multiplier, up to ×5. Clearing a level pays a +500 bonus.

## Power-ups

Falling capsules, caught with the paddle:

- **W** — wide paddle for 12 seconds
- **M** — multi-ball (splits the ball in two)
- **S** — slow ball for 10 seconds
- **+** — an extra life (up to 5)

## Feel

Neon glow, ball trails, shattering particles, a small screen shake on hard hits,
and sounds synthesised live with Web Audio — no audio files, no network requests
anywhere. The best score is kept in your browser (localStorage).

## Files

- `game/index.html` + `game/src/` — the game: `config.js` (tuning),
  `random.js` (seeded RNG), `levels.js` (the five level grids), `world.js` (rules),
  `audio.js` (synth sounds), `input.js` (keyboard + pointer), `render.js` (canvas),
  `shots.js` (screenshot scenes), `main.js` (boot + loop + screens).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output`
  and writes `dossier.json` with the vendored make.fun library.
- `serve.ts` — a tiny static server for local play.
- `screenshots/` — four real renders of the game's own code (title, play,
  level clear, game over), staged with `?shot=…&seed=1`.

## Run it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

Build the hand-in output:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
