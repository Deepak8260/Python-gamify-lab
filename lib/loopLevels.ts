/*
 * Loop Lab levels.
 *
 * Track 1 — "Robo's Bridge" (for loops): the robot jumps to every block
 *   number the student prints. Each level adds a new twist (water, cracked
 *   blocks, gems, islands, growing leaps, zigzags) so the student has to
 *   work out which tool fits: range() arguments, a calculation, an if,
 *   two loops in a row, a loop inside a loop, or a running total.
 * Track 2 — "Rocket Launch" (while loops): pump fuel UNTIL the rocket is
 *   ready. You repeat until a condition changes: a while loop.
 *
 * The level text only describes the goal and the rules. It never says
 * which Python to write; the hints get more specific one step at a time.
 */

import type { RunResult } from "./interpreter";

type Base = {
  id: string;
  title: string;
  goal: string;
  rules: string[];
  hints: string[];
  loop: "for" | "while";
  maxPrints: number;
  /** Python words the student may not use on this level, e.g. ["if"] */
  banned?: string[];
};

export type RobotLevel = Base & {
  world: "robot";
  start: number;
  ball: number;
  path: number[]; // the blocks Robo must land on, in order (last one holds the ball)
  tiles: number[]; // every position that has solid ground
  cracked?: number[]; // broken blocks: shown, but Robo falls through them
  gems?: number[]; // gems sitting on the path, collected when Robo lands there
  scene?: "day" | "sunset" | "night";
};

export type GaugeLevel = Base & {
  world: "rocket";
  label: string; // "Fuel", "Thrust", "Engine temp"
  unit: string;
  start: number;
  dir: "up" | "down";
  target: number; // up: ready when value >= target, down: ready when value < target
  limit: number; // up: overflow above this, down: frozen below this
  max: number; // top of the gauge
  expected: number[];
  change: string; // "+10", "×2", "−12"
};

export type Level = RobotLevel | GaugeLevel;

export type Result = {
  kind: "success" | "fail" | "error";
  title: string;
  message: string;
  path?: string;
  mood?: "wrong-way" | "stuck" | "fell" | "rule" | "short" | "long" | "loop";
};

const span = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

const ROBOT_RULE = "Robo jumps to the block number you print()";
const ONE_PRINT = "You may write print() only once";
const NO_IF = "You may not use if";

export const LOOP_LEVELS: Level[] = [
  {
    id: "first-steps",
    world: "robot",
    title: "First Steps",
    loop: "for",
    goal: "Robo wants the red ball at the end of the bridge. Get Robo there.",
    rules: [ROBOT_RULE, "Step on every block, no skipping", ONE_PRINT],
    hints: [
      "Robo needs to hear 0, then 1, 2, 3 and finally 4. How can a single print() say five different numbers?",
      "Python can repeat a line for you, with a variable that counts 0, 1, 2… each time round.",
    ],
    maxPrints: 1,
    start: -1,
    ball: 4,
    path: span(0, 4),
    tiles: span(-6, 11),
  },
  {
    id: "halfway",
    world: "robot",
    title: "Halfway There",
    loop: "for",
    goal: "Robo has already crossed part of the bridge and is standing on block 1. Finish the job.",
    rules: [ROBOT_RULE, "Step on every block, no skipping", ONE_PRINT],
    hints: [
      "Robo needs to hear 2, 3, 4, 5, 6, 7 and 8.",
      "range() doesn't have to start at 0. You can tell it where to start and where to stop.",
    ],
    maxPrints: 1,
    start: 1,
    ball: 8,
    path: span(2, 8),
    tiles: span(-3, 13),
  },
  {
    id: "stepping-stones",
    world: "robot",
    title: "Stepping Stones",
    loop: "for",
    goal: "The bridge washed away! Only a few stones are left above the water. Reach the ball without a splash.",
    rules: [ROBOT_RULE, "Land only on stones, never in the water", ONE_PRINT],
    hints: [
      "Look at the stone numbers: 3, 6, 9, 12, 15. What pattern do you see?",
      "range() can take a third number: how big each step is.",
    ],
    maxPrints: 1,
    start: 0,
    ball: 15,
    path: [3, 6, 9, 12, 15],
    tiles: [0, 3, 6, 9, 12, 15],
  },
  {
    id: "race-home",
    world: "robot",
    title: "Race Home",
    loop: "for",
    goal: "Robo is out on block 7, and the ball is back home on block 0. Walk back, one block at a time.",
    rules: [ROBOT_RULE, "Step on every block, no skipping", ONE_PRINT],
    hints: [
      "Robo needs to hear 6, 5, 4, 3, 2, 1 and then 0.",
      "range() can count down if its step is a negative number. Or subtract your variable from a bigger number.",
    ],
    maxPrints: 1,
    start: 7,
    ball: 0,
    path: [6, 5, 4, 3, 2, 1, 0],
    tiles: span(-4, 11),
    scene: "sunset",
  },
  {
    id: "cracked-bridge",
    world: "robot",
    title: "Cracked Bridge",
    loop: "for",
    goal: "Some blocks on this old bridge are cracked. Step on every good block, but never on a cracked one.",
    rules: [ROBOT_RULE, "Step on every good block, in order", "Cracked blocks break under Robo", ONE_PRINT],
    hints: [
      "The cracked blocks are 3, 6, 9 and 12. What do those numbers have in common?",
      "Your loop can count every block, and decide each time round whether Robo should jump there. % gives the remainder after dividing.",
    ],
    maxPrints: 1,
    start: 0,
    ball: 13,
    path: [1, 2, 4, 5, 7, 8, 10, 11, 13],
    tiles: [...span(-3, 2), 4, 5, 7, 8, 10, 11, 13, 14, 15],
    cracked: [3, 6, 9, 12],
    scene: "sunset",
  },
  {
    id: "square-stones",
    world: "robot",
    title: "Square Stones",
    loop: "for",
    goal: "These stones get further and further apart. Hop across the river to the ball.",
    rules: [ROBOT_RULE, "Land only on stones, never in the water", ONE_PRINT],
    hints: [
      "The stones are 1, 4, 9, 16 and 25. Try 1 × 1, 2 × 2, 3 × 3…",
      "print() can print a calculation that uses your loop variable, not just the variable itself.",
    ],
    maxPrints: 1,
    start: 0,
    ball: 25,
    path: [1, 4, 9, 16, 25],
    tiles: [0, 1, 4, 9, 16, 25],
  },
  {
    id: "there-and-back",
    world: "robot",
    title: "There and Back",
    loop: "for",
    goal: "A gem is sitting on block 5. Grab it first, then turn round and carry it all the way to the ball on block -3.",
    rules: [ROBOT_RULE, "Step on every block, no skipping", "Get the gem before the ball", "You may write print() at most twice"],
    hints: [
      "This is two trips: 1 up to 5, then 4 back down to -3.",
      "Nothing stops you from writing one loop after another.",
    ],
    maxPrints: 2,
    start: 0,
    ball: -3,
    path: [...span(1, 5), ...[4, 3, 2, 1, 0, -1, -2, -3]],
    tiles: span(-7, 9),
    gems: [5],
  },
  {
    id: "island-hopping",
    world: "robot",
    title: "Island Hopping",
    loop: "for",
    goal: "Three little islands, three stones each. Robo must step on every stone of every island.",
    rules: [ROBOT_RULE, "Land only on stones, never in the water", ONE_PRINT, NO_IF],
    hints: [
      "The islands start at 1, 6 and 11. On each island Robo takes 3 steps.",
      "One loop can count the islands while another loop, inside it, counts the stones on that island.",
    ],
    maxPrints: 1,
    banned: ["if"],
    start: 0,
    ball: 13,
    path: [1, 2, 3, 6, 7, 8, 11, 12, 13],
    tiles: [0, 1, 2, 3, 6, 7, 8, 11, 12, 13],
    scene: "night",
  },
  {
    id: "growing-leaps",
    world: "robot",
    title: "Growing Leaps",
    loop: "for",
    goal: "Robo's jumps get longer every time: 1 block, then 2, then 3… Collect all the gems on the way to the ball.",
    rules: [ROBOT_RULE, "Land only on stones, never in the water", ONE_PRINT, NO_IF],
    hints: [
      "The stones are 1, 3, 6, 10, 15 and 21. Look at the gaps between them: 1, 2, 3, 4, 5, 6.",
      "Keep a variable for where Robo is. Each time round, add the loop counter to it.",
    ],
    maxPrints: 1,
    banned: ["if"],
    start: 0,
    ball: 21,
    path: [1, 3, 6, 10, 15, 21],
    tiles: [0, 1, 3, 6, 10, 15, 21],
    gems: [3, 10],
    scene: "sunset",
  },
  {
    id: "zigzag",
    world: "robot",
    title: "Zigzag",
    loop: "for",
    goal: "The ball is on block 7, but the bridge is wobbly. Robo must swing from side to side: 1, then -2, then 3, then -4… until block 7.",
    rules: [ROBOT_RULE, "Follow the zigzag exactly", ONE_PRINT, NO_IF],
    hints: [
      "Forget the minus signs for a moment: the numbers are just 1 to 7. Only the side changes.",
      "Keep a variable that flips between 1 and -1 each time round, and multiply by it.",
    ],
    maxPrints: 1,
    banned: ["if"],
    start: 0,
    ball: 7,
    path: [1, -2, 3, -4, 5, -6, 7],
    tiles: span(-9, 10),
    gems: [-6],
    scene: "night",
  },
  {
    id: "fuel-up",
    world: "rocket",
    title: "Fuel Up",
    loop: "while",
    goal: "The rocket's tank is empty. Each pump adds 10 fuel. Keep pumping until the rocket has at least 50 fuel, then stop.",
    rules: ["The gauge shows the number you print()", "Print the fuel after every pump", ONE_PRINT],
    hints: [
      "Make a variable for the fuel. Each pump makes it 10 bigger.",
      "You don't need to count pumps. Keep repeating as long as the fuel is still below 50.",
    ],
    maxPrints: 1,
    label: "Fuel",
    unit: "",
    start: 0,
    dir: "up",
    target: 50,
    limit: 80,
    max: 100,
    expected: [10, 20, 30, 40, 50],
    change: "+10",
  },
  {
    id: "rusty-pump",
    world: "rocket",
    title: "Rusty Pump",
    loop: "while",
    goal: "This rusty pump only adds 7 fuel each time. Pump until the rocket has at least 40 fuel, and not a drop more than needed.",
    rules: ["The gauge shows the number you print()", "Print the fuel after every pump", ONE_PRINT],
    hints: [
      "How many pumps? Hard to say with 7s, and that's the point. Let the condition decide when to stop.",
      "Keep pumping while the fuel is less than 40.",
    ],
    maxPrints: 1,
    label: "Fuel",
    unit: "",
    start: 0,
    dir: "up",
    target: 40,
    limit: 55,
    max: 60,
    expected: [7, 14, 21, 28, 35, 42],
    change: "+7",
  },
  {
    id: "top-up",
    world: "rocket",
    title: "Top Up",
    loop: "while",
    goal: "There's already 25 fuel in the tank. Each pump adds 8. Stop as soon as there's at least 60.",
    rules: ["The gauge shows the number you print()", "Print the fuel after every pump", ONE_PRINT],
    hints: [
      "Your fuel variable shouldn't start at 0 this time.",
      "Same idea as before: repeat while the fuel is still under the target.",
    ],
    maxPrints: 1,
    label: "Fuel",
    unit: "",
    start: 25,
    dir: "up",
    target: 60,
    limit: 75,
    max: 80,
    expected: [33, 41, 49, 57, 65],
    change: "+8",
  },
  {
    id: "turbo-boost",
    world: "rocket",
    title: "Turbo Boost",
    loop: "while",
    goal: "The booster starts with 1 thrust, and every boost doubles it. Keep boosting until the thrust is at least 100.",
    rules: ["The gauge shows the number you print()", "Print the thrust after every boost", ONE_PRINT],
    hints: [
      "Doubling means multiplying by 2 each time round.",
      "Keep boosting while thrust is below 100. Python has *= to multiply a variable.",
    ],
    maxPrints: 1,
    label: "Thrust",
    unit: "",
    start: 1,
    dir: "up",
    target: 100,
    limit: 150,
    max: 160,
    expected: [2, 4, 8, 16, 32, 64, 128],
    change: "×2",
  },
  {
    id: "cool-down",
    world: "rocket",
    title: "Cool Down",
    loop: "while",
    goal: "The engine is 90° and too hot to launch. Every second it cools by 12°. The rocket can launch as soon as it's below 20°.",
    rules: ["The thermometer shows the number you print()", "Print the temperature after every second", ONE_PRINT],
    hints: [
      "This time the number goes down, not up.",
      "Keep cooling while the engine is still 20° or hotter.",
    ],
    maxPrints: 1,
    label: "Engine",
    unit: "°",
    start: 90,
    dir: "down",
    target: 20,
    limit: 5,
    max: 100,
    expected: [78, 66, 54, 42, 30, 18],
    change: "−12",
  },
];

export const TRACKS = [
  {
    id: "for",
    title: "Robo's Bridge",
    blurb: "Guide Robo across the blocks to the ball.",
    levels: LOOP_LEVELS.filter((l) => l.loop === "for"),
  },
  {
    id: "while",
    title: "Rocket Launch",
    blurb: "Get the rocket ready for lift-off.",
    levels: LOOP_LEVELS.filter((l) => l.loop === "while"),
  },
];

export function levelIndex(id: string) {
  return LOOP_LEVELS.findIndex((l) => l.id === id);
}

/* ------------------------------------------------------------------ */
/* Judging                                                             */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

function pathText(nums: number[]) {
  if (!nums.length) return undefined;
  return nums.slice(0, 12).map(fmt).join(" → ") + (nums.length > 12 ? " → …" : "");
}

export type PlayOutcome = {
  nums: number[]; // numbers printed (in the order they were played)
  fell: number | null; // robot: landed on water / off the world at this number
  overflow: number | null; // rocket: went past the limit at this number
  stuck: boolean; // playback stopped because nothing was changing
};

function common(level: Level, res: RunResult, out: PlayOutcome): Result | null {
  if (res.error && !res.runaway) {
    return { kind: "error", title: "Check your code", message: res.error.message };
  }
  if (res.runaway || out.stuck) {
    return {
      kind: "fail",
      mood: "stuck",
      title: "Your loop never ends",
      message:
        level.world === "robot"
          ? "Robo kept jumping to the same block, and the loop would go on forever. Something inside your loop needs to change each time round."
          : `The ${level.label.toLowerCase()} stopped changing, so the loop would run forever. Something inside your loop must change the value each time round.`,
      path: pathText(out.nums),
    };
  }
  if (res.events.every((e) => e.kind !== "print")) {
    return {
      kind: "fail",
      mood: "rule",
      title: level.world === "robot" ? "Robo didn't move" : "The gauge didn't move",
      message: "Your code didn't print anything. Only print() can talk to the game.",
    };
  }
  if (out.nums.length === 0) {
    return {
      kind: "fail",
      mood: "rule",
      title: "That's not a number",
      message:
        level.world === "robot"
          ? "Robo only understands numbers. Print a number to tell Robo which block to jump to."
          : "The gauge only understands numbers. Print the value itself.",
    };
  }
  return null;
}

function loopCheck(level: Level, res: RunResult, path: string | undefined): Result | null {
  if (res.printCalls > level.maxPrints) {
    return {
      kind: "fail",
      mood: "rule",
      title: "Too many print()s",
      message:
        level.maxPrints === 1
          ? `It worked, but your code has print() ${res.printCalls} times, and only 1 is allowed. Find a way to repeat one print().`
          : `It worked, but your code has print() ${res.printCalls} times, and only ${level.maxPrints} are allowed.`,
      path,
    };
  }
  const banned = level.banned?.find((w) => res.names.includes(w));
  if (banned) {
    return {
      kind: "fail",
      mood: "rule",
      title: `No ${banned} allowed`,
      message: `It worked, but this level doesn't allow ${banned}. There's another way to get the same numbers. Think about how the loops or the maths could do the work.`,
      path,
    };
  }
  if (level.loop === "for" && !res.usedFor) {
    return {
      kind: "fail",
      mood: "loop",
      title: "So close!",
      message: res.usedWhile
        ? "It worked! But here you knew exactly how many jumps Robo needed. Python has a loop made just for counting. Try that one."
        : "It worked, but you'll need a loop to beat this level.",
      path,
    };
  }
  if (level.loop === "while" && !res.usedWhile) {
    return {
      kind: "fail",
      mood: "loop",
      title: "So close!",
      message: res.usedFor
        ? "The numbers are right, but you had to work out the number of pumps yourself. Read the task again: keep going UNTIL… Which loop repeats until a condition changes?"
        : "The numbers are right, but you'll need a loop to beat this level.",
      path,
    };
  }
  return null;
}

export function judgeRobot(level: RobotLevel, res: RunResult, out: PlayOutcome): Result {
  const c = common(level, res, out);
  if (c) return c;
  const nums = out.nums;
  const path = pathText(nums);

  if (out.fell !== null) {
    const f = out.fell;
    const lo = Math.min(...level.tiles);
    const hi = Math.max(...level.tiles);
    const inside = f >= lo && f <= hi;
    const hasWater = level.tiles.length !== hi - lo + 1;
    let title = "Whoops, off the edge!";
    let message = `You printed ${fmt(f)}, so Robo tried to jump to block ${fmt(f)}, and that's off the end of the world.`;
    if (level.cracked?.includes(f)) {
      title = "Crack!";
      message = `Block ${fmt(f)} was cracked, and it broke under Robo. Your loop has to skip the cracked blocks.`;
    } else if (inside && hasWater) {
      title = "Splash!";
      message = `There's no stone at ${fmt(f)}, only water. Robo can only land on the stones.`;
    } else if (inside) {
      title = "Fell between the blocks";
      message = `${fmt(f)} isn't a block number, so Robo fell into the gap. Robo needs whole numbers.`;
    }
    return { kind: "fail", mood: "fell", title, message, path };
  }

  const exp = level.path;
  const k = nums.findIndex((n, i) => n !== exp[i]);

  if (k === -1 && nums.length === exp.length) {
    return (
      loopCheck(level, res, path) ?? {
        kind: "success",
        title: "Level complete!",
        message: `Robo made ${nums.length} jumps and grabbed the ball.`,
        path,
      }
    );
  }

  const last = nums[nums.length - 1];

  if (k === -1 && nums.length < exp.length) {
    const left = exp.length - nums.length;
    return {
      kind: "fail",
      mood: "short",
      title: "Not there yet",
      message: `Robo stopped on block ${fmt(last)}, ${left} jump${left === 1 ? "" : "s"} away from the ball. Does your loop run enough times?`,
      path,
    };
  }
  if (k === exp.length) {
    return {
      kind: "fail",
      mood: "long",
      title: "Too far!",
      message: `Robo reached the ball, but your loop kept going and Robo ended up on block ${fmt(last)}. How many times should your loop run?`,
      path,
    };
  }

  const got = nums[k];
  const prev = k === 0 ? level.start : nums[k - 1];
  const want = exp[k];
  if (Math.sign(got - prev) === -Math.sign(want - prev)) {
    return {
      kind: "fail",
      mood: "wrong-way",
      title: "Wrong way!",
      message: `On jump ${k + 1}, Robo went to block ${fmt(got)}, but the next block was ${fmt(want)}, the other way.`,
      path,
    };
  }
  if (got === prev) {
    return {
      kind: "fail",
      mood: "short",
      title: "Jumping on the spot",
      message: `On jump ${k + 1}, Robo stayed on block ${fmt(got)}. Every jump should move Robo to the next block.`,
      path,
    };
  }
  if (!Number.isInteger(got)) {
    return {
      kind: "fail",
      mood: "fell",
      title: "Between the blocks",
      message: `${fmt(got)} isn't a block number. Robo needs whole numbers.`,
      path,
    };
  }
  return {
    kind: "fail",
    mood: "long",
    title: Math.abs(got - prev) > Math.abs(want - prev) ? "You skipped a block" : "Wrong block",
    message: `On jump ${k + 1}, Robo went to block ${fmt(got)}, but block ${fmt(want)} was next. Robo has to land on the right blocks, in order.`,
    path,
  };
}

export function isReady(level: GaugeLevel, v: number) {
  return level.dir === "up" ? v >= level.target : v < level.target;
}
export function isOver(level: GaugeLevel, v: number) {
  return level.dir === "up" ? v > level.limit : v < level.limit;
}

export function judgeGauge(level: GaugeLevel, res: RunResult, out: PlayOutcome): Result {
  const c = common(level, res, out);
  if (c) return c;
  let nums = out.nums;
  const path = pathText(nums);
  const name = level.label.toLowerCase();
  const u = level.unit;

  if (out.overflow !== null) {
    return level.dir === "up"
      ? {
          kind: "fail",
          mood: "long",
          title: "Overflow!",
          message: `The ${name} went up to ${fmt(out.overflow)}${u}, but the maximum is ${level.limit}${u}. Your loop kept going after the rocket was ready.`,
          path,
        }
      : {
          kind: "fail",
          mood: "long",
          title: "Frozen!",
          message: `The ${name} dropped to ${fmt(out.overflow)}${u}, below ${level.limit}${u}, and froze. Your loop kept going after the rocket was ready.`,
          path,
        };
  }

  // Printing the starting value first is fine.
  if (nums[0] === level.start && level.expected[0] !== level.start) nums = nums.slice(1);
  const exp = level.expected;
  const k = nums.findIndex((n, i) => n !== exp[i]);
  const last = nums[nums.length - 1];

  if (k === -1 && nums.length === exp.length) {
    return (
      loopCheck(level, res, path) ?? {
        kind: "success",
        title: "Lift-off!",
        message: `The ${name} reached ${fmt(last)}${u} and the rocket blasted off.`,
        path,
      }
    );
  }
  if (nums.length === 0 || (k === -1 && nums.length < exp.length)) {
    const v = nums.length ? last : level.start;
    return {
      kind: "fail",
      mood: "short",
      title: "Not ready yet",
      message:
        level.dir === "up"
          ? `The ${name} stopped at ${fmt(v)}${u}, but the rocket needs at least ${level.target}${u}. Your loop stopped too early.`
          : `The ${name} stopped at ${fmt(v)}${u}, but it must drop below ${level.target}${u}. Your loop stopped too early.`,
      path,
    };
  }
  if (k === exp.length) {
    return {
      kind: "fail",
      mood: "long",
      title: "Too much!",
      message: `The rocket was ready at ${fmt(exp[exp.length - 1])}${u}, but your loop kept going to ${fmt(last)}${u}. Stop as soon as it's ready.`,
      path,
    };
  }
  return {
    kind: "fail",
    mood: "short",
    title: "The readings are off",
    message: `Reading ${k + 1} was ${fmt(nums[k])}${u}, but it should have been ${fmt(exp[k])}${u}. The ${name} starts at ${level.start}${u} and changes by ${level.change} each time.`,
    path,
  };
}
