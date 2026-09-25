# CodePlay Labs 🎮

Learn Python by playing. Each **lab** is a small game where the student's real Python code controls what happens.

- **Home** (`/`): all labs. Loop Lab and Condition Lab are playable; the others show as "coming soon".
- **Loop Lab** (`/labs/loops`): 15 levels in two tracks, unlocked one after another.
- **Levels** (`/labs/loops/<level>`): the game, a code editor and an output console.

## Loop Lab

### Track 1: Robo's Bridge (for loops)
Robo jumps to every block number the code prints. Every level adds a new twist, so the student has to
work out which tool fits instead of just changing a number.

| # | Level | Twist | What it makes you think about |
|---|---|---|---|
| 1 | First Steps | a plain bridge | repeat 5 times, `range(5)` |
| 2 | Halfway There | Robo starts mid-bridge | `range(start, stop)` |
| 3 | Stepping Stones | stones over water | step size |
| 4 | Race Home | ball is behind Robo (sunset) | counting down |
| 5 | Cracked Bridge | cracked blocks break | `if` inside a loop, `%` |
| 6 | Square Stones | gaps keep growing | printing a calculation (`i * i`) |
| 7 | There and Back | grab a gem, then turn round | two loops one after another |
| 8 | Island Hopping | groups of stones, no `if` allowed (night) | a loop inside a loop |
| 9 | Growing Leaps | each jump is one longer, gems, no `if` | a running total |
| 10 | Zigzag | swing from side to side, no `if` (night) | a variable that flips sign |

Levels can ban Python words (`banned: ["if"]`) and limit the number of `print()` calls, which pushes the
student towards a different idea than the one they used before.

### Track 2: Rocket Launch (while loops)
Pump fuel **until** the rocket is ready. You repeat until a condition changes.

| # | Level | What it teaches |
|---|---|---|
| 11 | Fuel Up | `while value < target` |
| 12 | Rusty Pump | when you can't easily count the repeats |
| 13 | Top Up | starting from a value other than 0 |
| 14 | Turbo Boost | multiplying (`*=`) |
| 15 | Cool Down | a value that goes down, `>=` conditions |

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

## Condition Lab ("Cross the Bridge")

The game gives the student ordinary Python variables (`bridge_safe`, `weight`, `limit`, `weather`, …).
The student writes normal Python that sets one answer variable: `cross` (`True`/`False`) or
`route` (`"A"`, `"B"`, `"C"` or `"wait"`). There are no made-up functions.

Each level runs the same code in several **rounds** with different values, e.g. a safe bridge, then a
broken one, then a weight of exactly 100 kg. Code that just says `cross = True` fails.
While it runs, a **decision panel** shows how Python works out each `if`/`elif`
(`weight <= limit → 65 <= 100 → True`, `and`/`or` parts that get skipped, `else` taken).

| # | Level | What it teaches |
|---|---|---|
| 1 | Safe to Cross? | a first `if` on a True/False value |
| 2 | Danger Ahead | the same `if` when the value is False |
| 3 | Cross or Wait | `else`: the answer must be set every time |
| 4 | Weight Limit | comparisons (`<=`, boundaries) |
| 5 | Two Checks | `and` |
| 6 | Wind Warning | values change after Run: use variables, not copied numbers |
| 7 | Three Bridges | `if / elif / else` with ranges |
| 8 | Emergency Pass | `or`, brackets, comparing text (`== "clear"`) |
| 9 | Ranger's Orders | rule priority: the order of `if / elif` |
| 10 | Night & Fog | `not` and combined logic |
| 11 | The Final Crossing (boss) | everything, with no hint about which concept to use |

Mistakes are shown in the game: the hiker falls through a broken bridge, waits when it was safe,
takes the wrong bridge, or is confused when the answer variable was never set or has the wrong type
(`"True"` in quotes, `"a"` instead of `"A"`).

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
2. Create its pages under `app/labs/<slug>/`: use `LabMap` for the level map and `LevelGate` for locking.
3. Reuse `CodeEditor`, `lib/interpreter.ts` (`runPython(code, inputs)` returns events and final variables)
   and `lib/progress.ts` (progress is stored per lab slug).

## Project layout

```
app/
  page.tsx                          home page (lab list)
  labs/loops/…, labs/conditions/…   level maps and levels
components/
  Home.tsx                     home page
  LabMap.tsx                   level map used by every lab (LoopLabMap, CondLabMap)
  LevelGate.tsx                level locking
  LevelPlayer.tsx              Loop Lab: runs code, plays it back, shows results
  CondPlayer.tsx, BridgeWorld.tsx   Condition Lab player and canyon scene
  RobotWorld.tsx, Robot.tsx    for-loop world
  RocketWorld.tsx              while-loop world
  LoopHud.tsx                  the loop panel
  CodeEditor.tsx               Monaco editor with line highlighting
lib/
  interpreter.ts               mini Python interpreter
  loopLevels.ts                Loop Lab levels and judging
  condLevels.ts                Condition Lab levels, rounds and judging
  labs.ts                      list of labs
  progress.ts                  saved progress and XP
  sound.ts                     synthesized sound effects
```
