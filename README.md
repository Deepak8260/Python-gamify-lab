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

## Condition Lab

Each level is a small piece of a real system: a sign-up service, a payment gateway, an API gateway, a
deployment pipeline, a firewall. The game gives the student ordinary Python variables (`age`, `role`,
`amount`, `port`, …) and the student writes the conditions that set one answer variable, either `True`/`False`
or one of a few text values (`"approved"`, `"review"`, …). There are no helper functions to call.

**Visible and hidden tests.** Every level runs the same code against a few visible cases and then against
hidden ones: boundaries (17/18/19, exactly the limit), edge cases (0, negative numbers, `""`, unknown text
values) and, for True/False inputs, often the whole truth table. Hard-coding the visible answers fails. The
first failing hidden case is replayed so the student can see it.

**Mistake diagnosis.** Each level lists `pitfalls`: common wrong solutions such as `>` instead of `>=`,
`or` instead of `and`, `A and B or C` without brackets, a broad `elif` first, separate `if`s overwriting each
other, the De Morgan mistake, or `port == 80 or 443`. When a run fails, the student's answers over all cases
are compared with each pitfall, and a match gives a targeted explanation. Success explains why the logic works.

**Scene.** A request arrives with the values, the decision engine shows how Python works out each
`if`/`elif` (`weight <= limit → 65 <= 100 → True`, skipped `and`/`or` parts, `else` taken), and the request is
routed to one outcome. A wrong outcome is marked next to the expected one.

| # | Level | System | Concepts introduced |
|---|---|---|---|
| **Foundations** ||||
| 1 | Age Gate | sign-up service | `if`, comparisons |
| 2 | Payment Limit | UPI gateway | `if / else` |
| 3 | Grade Report | result portal | `if / elif / else`, one match only |
| **Comparisons & Facts** ||||
| 4 | CPU Alert | server monitor | boundaries (`>` vs `>=`), `==`, rule order |
| 5 | Train Booking | rail booking | several variables, text, `!=` |
| **Boolean Logic** ||||
| 6 | Admin Dashboard | admin portal | `and` |
| 7 | Loan Eligibility | loan screening | `and` with ranges (`21 <= age <= 60`) |
| 8 | Express Delivery | delivery planner | `or` |
| 9 | Login Guard | login service | `not`, De Morgan |
| 10 | Checkout | checkout service | truthy/falsy (`0`, `""`), edge cases |
| **Combining Logic** ||||
| 11 | API Gateway | API gateway | `A and (B or C)`, precedence |
| 12 | File Access | cloud drive | nested `if` |
| 13 | Discount Tiers | promotions engine | overlapping rules, `elif` vs separate `if`s |
| **Real-World Systems** (concept chips hidden) ||||
| 14 | Deployment Gate | CI/CD pipeline | decision trees, safe default for unknown input |
| 15 | Warehouse Dispatch | warehouse | validation first, decimals, 0 and negatives |
| 16 | Firewall Rules | firewall | top-rule priority, `port == 80 or 443` trap |
| **Boss** ||||
| 17 | Payment Authorization | card processor | everything, with priorities between outcomes |

**Concept tracking.** Every level lists the concepts it uses and the ones it introduces. `lib/condStats.ts`
stores runs, failures and diagnosed mistakes in the browser. The lab map shows a concept coverage report:
which concepts were practised, which are mastered (every level that uses them is complete) and which caused
mistakes.

To add a level, add an entry to `COND_LEVELS` in `lib/condLevels.ts` and put its id in a track in `COND_TRACKS`.

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
  CondPlayer.tsx, SystemWorld.tsx   Condition Lab player and system scene
  RobotWorld.tsx, Robot.tsx    for-loop world
  RocketWorld.tsx              while-loop world
  LoopHud.tsx                  the loop panel
  CodeEditor.tsx               Monaco editor with line highlighting
lib/
  interpreter.ts               mini Python interpreter
  loopLevels.ts                Loop Lab levels and judging
  condLevels.ts                Condition Lab levels, tests, judging and mistake diagnosis
  condStats.ts                 Condition Lab runs, mistakes and concept report
  labs.ts                      list of labs
  progress.ts                  saved progress and XP
  sound.ts                     synthesized sound effects
```
