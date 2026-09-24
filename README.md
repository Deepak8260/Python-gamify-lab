# CodePlay Labs 🎮

Learn Python by playing. Each **lab** is a small game where the student's real Python code controls what happens.

- **Home** (`/`): all labs. Loop Lab is playable; the others show as "coming soon".
- **Loop Lab** (`/labs/loops`): 11 levels in two tracks, unlocked one after another.
- **Levels** (`/labs/loops/<level>`): the game, a code editor and an output console.

## Loop Lab

### Track 1: Robo's Bridge (for loops)
Robo jumps to every block number the code prints. You always know how many jumps are needed, so this is counting work.

| # | Level | What it teaches |
|---|---|---|
| 1 | First Steps | repeat 5 times, `range(5)` |
| 2 | The Long Bridge | changing the count |
| 3 | Behind You! | going backwards, negative numbers |
| 4 | Halfway There | `range(start, stop)` |
| 5 | Stepping Stones | step size (stones over water) |
| 6 | Race Home | counting down |

### Track 2: Rocket Launch (while loops)
Pump fuel **until** the rocket is ready. You repeat until a condition changes.

| # | Level | What it teaches |
|---|---|---|
| 7 | Fuel Up | `while value < target` |
| 8 | Rusty Pump | when you can't easily count the repeats |
| 9 | Top Up | starting from a value other than 0 |
| 10 | Turbo Boost | multiplying (`*=`) |
| 11 | Cool Down | a value that goes down, `>=` conditions |

The level text only gives the goal and the rules (for example "you may write `print()` only once").
It never says which loop to use. Hints unlock one at a time.

### The game runs the student's real code
`lib/interpreter.ts` is a small Python interpreter (`for`, `while`, `if/elif/else`, `range()`, variables,
maths, `break`/`continue`, `print()` and more). Every `print()` and every while-condition check becomes an
animation step, so wrong code visibly does the wrong thing:

- Robo walks the wrong way, stops short, skips a block, overshoots, or falls into the water
- The fuel overflows, stops too early, or never stops (infinite loop)
- Code that works but uses the wrong kind of loop gets a "So close!" nudge
- Syntax mistakes get a friendly message and the line is marked in red

While the code runs, the loop panel shows the iteration (`3 / 5`), the variables, the `range()` values, and
for while loops the condition being checked (`fuel < 50 → True`).

Also included: Run, Step, Reset, speed (0.5x/1x/2x), confetti, sound with mute, XP, `Ctrl + Enter` to run,
and phone-friendly layouts. Progress and code are saved in the browser (no backend).

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploy to Vercel

It's all frontend. There's no backend, database or environment variables.

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com/new and import the repository.
3. Keep the defaults (Framework: **Next.js**) and click **Deploy**.

## Adding a new lab later

1. Add an entry to `lib/labs.ts` (set `status: "live"`).
2. Create its pages under `app/labs/<slug>/`.
3. Reuse `CodeEditor`, `LoopHud`, `lib/interpreter.ts` and `lib/progress.ts` (progress is stored per lab slug).

## Project layout

```
app/
  page.tsx                     home page (lab list)
  labs/loops/page.tsx          Loop Lab level map
  labs/loops/[level]/page.tsx  one level
components/
  Home.tsx, LoopLabMap.tsx     pages
  LevelGate.tsx                level locking
  LevelPlayer.tsx              runs code, plays it back, shows results
  RobotWorld.tsx, Robot.tsx    for-loop world
  RocketWorld.tsx              while-loop world
  LoopHud.tsx                  the loop panel
  CodeEditor.tsx               Monaco editor with line highlighting
lib/
  interpreter.ts               mini Python interpreter
  loopLevels.ts                level data and judging
  labs.ts                      list of labs
  progress.ts                  saved progress and XP
  sound.ts                     synthesized sound effects
```
