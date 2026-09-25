/*
 * Condition Lab: "Cross the Bridge".
 *
 * The game hands the student some ordinary Python variables (bridge_safe,
 * weight, limit, weather…). The student writes normal Python that sets one
 * answer variable: `cross` (True / False) or `route` ("A", "B", "C", "wait").
 *
 * Every level is played in ROUNDS: the same code runs again with different
 * values. That's what makes conditions matter. Code that just says
 * `cross = True` wins one round, then sends the hiker onto a broken bridge.
 */

import { PyFloat, repr, type RunResult, type Val } from "./interpreter";

export type Inputs = Record<string, boolean | number | string>;
export type Round = { inputs: Inputs; event?: string };

export type CondLevel = {
  id: string;
  title: string;
  scene: "bridge" | "routes";
  goal: string;
  rules: string[];
  table?: { title?: string; rows: [string, string][] };
  given: Record<string, string>; // variable name -> what it means
  output: { name: "cross" | "route"; choices?: string[]; start?: boolean };
  rounds: Round[];
  preview?: Inputs; // what the student sees while writing (defaults to round 1)
  solve: (i: Inputs) => boolean | string;
  explain: (i: Inputs) => string;
  hints: string[];
  mustUse?: ("if" | "else" | "elif")[];
  boss?: boolean;
};

const n = (x: unknown) => x as number;
const b = (x: unknown) => x as boolean;

export const COND_LEVELS: CondLevel[] = [
  {
    id: "safe-to-cross",
    title: "Safe to Cross?",
    scene: "bridge",
    goal: "The hiker wants to reach the flag on the other side. If the bridge is safe, let the hiker cross.",
    rules: ["Set cross to True to send the hiker across", "cross starts as False, so the hiker waits"],
    given: { bridge_safe: "is the bridge safe to walk on?" },
    output: { name: "cross", start: false },
    rounds: [{ inputs: { bridge_safe: true } }],
    solve: (i) => b(i.bridge_safe),
    explain: (i) => (i.bridge_safe ? "the bridge was safe" : "the bridge was not safe"),
    hints: [
      "Your decision depends on bridge_safe. Python can run a line only when something is True.",
      "Start a line with if, then the thing to check, then a colon. Put the action on the next line, indented by 4 spaces.",
    ],
    mustUse: ["if"],
  },
  {
    id: "danger-ahead",
    title: "Danger Ahead",
    scene: "bridge",
    goal: "A storm damaged the bridge last night. Your code has to work whether the bridge is safe or not. The hiker must never step onto a dangerous bridge.",
    rules: ["Set cross to True to send the hiker across", "cross starts as False, so the hiker waits"],
    given: { bridge_safe: "is the bridge safe to walk on?" },
    output: { name: "cross", start: false },
    rounds: [
      { inputs: { bridge_safe: false } },
      { inputs: { bridge_safe: true }, event: "🔧 A repair crew fixed the bridge. bridge_safe: False → True" },
    ],
    solve: (i) => b(i.bridge_safe),
    explain: (i) => (i.bridge_safe ? "the bridge was safe" : "the bridge was damaged"),
    hints: [
      "Your code runs twice: once with a broken bridge, once with a fixed one. Don't decide by looking at the picture. Let bridge_safe decide.",
      "If your code from the last level checked bridge_safe, it should already work here.",
    ],
  },
  {
    id: "cross-or-wait",
    title: "Cross or Wait",
    scene: "bridge",
    goal: "This time cross has no starting value. Your code must make a decision every single time: cross when the bridge is safe, otherwise wait.",
    rules: ["cross has no starting value", "Set cross to True or False in every situation"],
    given: { bridge_safe: "is the bridge safe to walk on?" },
    output: { name: "cross" },
    rounds: [
      { inputs: { bridge_safe: true } },
      { inputs: { bridge_safe: false }, event: "🌩️ Lightning hit the bridge. bridge_safe: True → False" },
    ],
    solve: (i) => b(i.bridge_safe),
    explain: (i) => (i.bridge_safe ? "the bridge was safe" : "the bridge was damaged"),
    hints: [
      "What happens to cross when bridge_safe is False and your if block doesn't run?",
      "Python has a word for “otherwise”. It goes at the same indent as the if.",
    ],
  },
  {
    id: "weight-limit",
    title: "Weight Limit",
    scene: "bridge",
    goal: "Old rope bridges can only hold so much. The hiker may cross only if their weight is within the bridge's limit.",
    rules: ["Set cross to True or False every time", "Exactly on the limit is still OK"],
    given: { weight: "the hiker's weight in kg", limit: "the most the bridge can hold, in kg" },
    output: { name: "cross" },
    rounds: [
      { inputs: { weight: 65, limit: 100 } },
      { inputs: { weight: 120, limit: 100 }, event: "🎒 The hiker packed a heavy tent. weight: 65 → 120" },
      { inputs: { weight: 100, limit: 100 }, event: "⚖️ A new hiker arrives. weight: 100, limit: 100" },
      { inputs: { weight: 45, limit: 40 }, event: "🌉 A smaller bridge. limit: 40, weight: 45" },
    ],
    solve: (i) => n(i.weight) <= n(i.limit),
    explain: (i) =>
      n(i.weight) <= n(i.limit)
        ? `${i.weight} kg is within the ${i.limit} kg limit`
        : `${i.weight} kg is more than the ${i.limit} kg limit`,
    hints: [
      "You need to compare two numbers: weight and limit.",
      "Python compares numbers with <, >, <= and >=. Which one means “at most”?",
    ],
  },
  {
    id: "two-checks",
    title: "Two Checks",
    scene: "bridge",
    goal: "Now the ranger checks two things. The hiker may cross only when the bridge is safe and the hiker's weight is within the limit.",
    rules: ["Set cross to True or False every time"],
    given: {
      bridge_safe: "is the bridge safe to walk on?",
      weight: "the hiker's weight in kg",
      limit: "the most the bridge can hold, in kg",
    },
    output: { name: "cross" },
    rounds: [
      { inputs: { bridge_safe: true, weight: 65, limit: 100 } },
      { inputs: { bridge_safe: false, weight: 65, limit: 100 }, event: "💨 Strong wind! bridge_safe: True → False" },
      { inputs: { bridge_safe: true, weight: 120, limit: 100 }, event: "🎒 Heavy backpack. weight: 65 → 120" },
      { inputs: { bridge_safe: false, weight: 130, limit: 100 }, event: "😬 Bad day: broken bridge and a heavy bag" },
    ],
    solve: (i) => b(i.bridge_safe) && n(i.weight) <= n(i.limit),
    explain: (i) =>
      !i.bridge_safe && n(i.weight) > n(i.limit)
        ? "the bridge was broken and the hiker was too heavy"
        : !i.bridge_safe
          ? "the bridge was not safe"
          : n(i.weight) > n(i.limit)
            ? `${i.weight} kg is over the ${i.limit} kg limit`
            : "the bridge was safe and the hiker was light enough",
    hints: [
      "Both things must be True at the same time for the hiker to cross.",
      "You can join two conditions into one with the word and.",
    ],
  },
  {
    id: "wind-warning",
    title: "Wind Warning",
    scene: "bridge",
    goal: "Right now the bridge is safe and the hiker weighs 65 kg. But mountain weather changes fast. Cross only when the bridge is safe and the weight is within the limit, whatever happens.",
    rules: ["Set cross to True or False every time", "Things may change after you press Run"],
    given: {
      bridge_safe: "is the bridge safe to walk on?",
      weight: "the hiker's weight in kg",
      limit: "the most the bridge can hold, in kg",
    },
    output: { name: "cross" },
    preview: { bridge_safe: true, weight: 65, limit: 100 },
    rounds: [
      { inputs: { bridge_safe: false, weight: 65, limit: 100 }, event: "⚠️ WIND WARNING! bridge_safe: True → False" },
      { inputs: { bridge_safe: true, weight: 65, limit: 100 }, event: "🌤️ The wind calmed down. bridge_safe: False → True" },
      { inputs: { bridge_safe: true, weight: 110, limit: 100 }, event: "🪨 The hiker picked up a heavy rock. weight: 65 → 110" },
    ],
    solve: (i) => b(i.bridge_safe) && n(i.weight) <= n(i.limit),
    explain: (i) =>
      !i.bridge_safe
        ? "the wind made the bridge unsafe"
        : n(i.weight) > n(i.limit)
          ? `${i.weight} kg is over the ${i.limit} kg limit`
          : "the bridge was safe and the hiker was light enough",
    hints: [
      "Don't copy the values you see into your code. The values can change after you press Run.",
      "Check the variables themselves (bridge_safe, weight, limit), so your code gives the right answer whatever they are.",
    ],
  },
  {
    id: "three-bridges",
    title: "Three Bridges",
    scene: "routes",
    goal: "There are three bridges across the canyon. Send the hiker over the right one for their energy level.",
    rules: ['Set route to "A", "B" or "C"'],
    table: {
      title: "Which bridge?",
      rows: [
        ["energy 80 or more", "Bridge A (fastest, but hard)"],
        ["energy 50 to 79", "Bridge B"],
        ["energy below 50", "Bridge C (easy)"],
      ],
    },
    given: { energy: "how much energy the hiker has left (0–100)" },
    output: { name: "route", choices: ["A", "B", "C"] },
    rounds: [
      { inputs: { energy: 72 } },
      { inputs: { energy: 91 }, event: "🍫 Snack break! energy: 72 → 91" },
      { inputs: { energy: 30 }, event: "🥵 A long climb. energy: 91 → 30" },
      { inputs: { energy: 80 }, event: "⚡ energy: 80" },
      { inputs: { energy: 50 }, event: "⚡ energy: 50" },
    ],
    solve: (i) => (n(i.energy) >= 80 ? "A" : n(i.energy) >= 50 ? "B" : "C"),
    explain: (i) => {
      const e = n(i.energy);
      return e >= 80 ? `energy ${e} is 80 or more` : e >= 50 ? `energy ${e} is between 50 and 79` : `energy ${e} is below 50`;
    },
    hints: [
      "There are three possible answers, and only one should happen. Check the highest energy range first.",
      "if … elif … else chooses exactly one of several options.",
    ],
  },
  {
    id: "emergency-pass",
    title: "Emergency Pass",
    scene: "bridge",
    goal: "A ranger explains the crossing rules. The hiker may cross if the normal rules OR the emergency rules allow it.",
    rules: ["Set cross to True or False every time", 'weather is text: "clear" or "storm"'],
    table: {
      rows: [
        ["Normal route", "bridge_strength is 70 or more AND the weather is clear"],
        ["Emergency route", "the hiker has an emergency pass AND bridge_strength is 60 or more"],
      ],
    },
    given: {
      bridge_strength: "how strong the bridge is (0–100)",
      weather: '"clear" or "storm"',
      emergency_pass: "does the hiker have an emergency pass?",
    },
    output: { name: "cross" },
    rounds: [
      { inputs: { bridge_strength: 72, weather: "storm", emergency_pass: true } },
      { inputs: { bridge_strength: 72, weather: "storm", emergency_pass: false }, event: "🎫 A different hiker, without a pass" },
      { inputs: { bridge_strength: 75, weather: "clear", emergency_pass: false }, event: "☀️ The storm passed. weather: \"clear\"" },
      { inputs: { bridge_strength: 55, weather: "storm", emergency_pass: true }, event: "🪵 A weaker bridge. bridge_strength: 55" },
      { inputs: { bridge_strength: 65, weather: "clear", emergency_pass: false }, event: "🪵 bridge_strength: 65, clear skies, no pass" },
      { inputs: { bridge_strength: 65, weather: "clear", emergency_pass: true }, event: "🎫 Same bridge, but this hiker has a pass" },
    ],
    solve: (i) =>
      (n(i.bridge_strength) >= 70 && i.weather === "clear") || (b(i.emergency_pass) && n(i.bridge_strength) >= 60),
    explain: (i) => {
      const s = n(i.bridge_strength);
      const normal = s >= 70 && i.weather === "clear";
      const emerg = b(i.emergency_pass) && s >= 60;
      if (normal) return `strength ${s} is 70+ and the weather is clear, so the normal route works`;
      if (emerg) return `the hiker has a pass and strength ${s} is 60+, so the emergency route works`;
      if (s < 60) return `strength ${s} is too low for both routes`;
      const why = [s < 70 ? `strength ${s} is below 70` : `the weather is ${JSON.stringify(i.weather)}`, "there's no emergency pass"];
      return `neither route works: ${why.join(", and ")}`;
    },
    hints: [
      'weather holds text. Compare text with == and quotes, like weather == "clear".',
      "Either route is enough, so join the two groups with or. Brackets keep each group together.",
    ],
  },
  {
    id: "rangers-orders",
    title: "Ranger's Orders",
    scene: "bridge",
    goal: "The ranger has three rules, and sometimes they disagree. When they do, the rule higher on the list wins.",
    rules: ["Set cross to True or False every time", 'weather is "clear" or "storm"'],
    table: {
      title: "Rules, most important first",
      rows: [
        ["1. Bridge closed", "nobody crosses. No exceptions, not even with a pass."],
        ["2. VIP pass", "the hiker may cross, even in a storm."],
        ["3. Everyone else", "cross only if the weather is clear."],
      ],
    },
    given: {
      bridge_closed: "is the bridge closed?",
      vip_pass: "does the hiker have a VIP pass?",
      weather: '"clear" or "storm"',
    },
    output: { name: "cross" },
    rounds: [
      { inputs: { bridge_closed: true, vip_pass: true, weather: "clear" } },
      { inputs: { bridge_closed: false, vip_pass: true, weather: "storm" }, event: "🔓 The bridge reopened, but a storm rolls in" },
      { inputs: { bridge_closed: false, vip_pass: false, weather: "storm" }, event: "🧍 A hiker without a pass, still stormy" },
      { inputs: { bridge_closed: false, vip_pass: false, weather: "clear" }, event: "☀️ The storm cleared" },
      { inputs: { bridge_closed: true, vip_pass: false, weather: "clear" }, event: "🚧 Closed again for repairs" },
    ],
    solve: (i) => (i.bridge_closed ? false : i.vip_pass ? true : i.weather === "clear"),
    explain: (i) =>
      i.bridge_closed
        ? "the bridge was closed, and rule 1 beats everything"
        : i.vip_pass
          ? "the hiker had a VIP pass (rule 2)"
          : i.weather === "clear"
            ? "no pass, but the weather was clear (rule 3)"
            : "no pass, and the weather wasn't clear (rule 3)",
    hints: [
      "Check the rule that beats all the others first.",
      "Python checks if / elif from the top and stops at the first one that's True, so their order decides which rule wins.",
    ],
  },
  {
    id: "night-and-fog",
    title: "Night & Fog",
    scene: "bridge",
    goal: "Darkness and fog make crossing risky. At night, the hiker needs a lantern. In fog, the hiker needs a guide. On a foggy night, both. Any other time, the hiker can just go.",
    rules: ["Set cross to True or False every time"],
    given: {
      is_night: "is it dark?",
      lantern: "does the hiker have a lantern?",
      foggy: "is it foggy?",
      guide: "is a guide walking with the hiker?",
    },
    output: { name: "cross" },
    rounds: [
      { inputs: { is_night: false, lantern: false, foggy: false, guide: false } },
      { inputs: { is_night: true, lantern: false, foggy: false, guide: false }, event: "🌙 Night falls. is_night: True" },
      { inputs: { is_night: true, lantern: true, foggy: false, guide: false }, event: "🏮 The hiker lit a lantern" },
      { inputs: { is_night: false, lantern: false, foggy: true, guide: false }, event: "🌫️ Morning fog rolls in" },
      { inputs: { is_night: false, lantern: false, foggy: true, guide: true }, event: "🧭 A guide joins the hiker" },
      { inputs: { is_night: true, lantern: true, foggy: true, guide: false }, event: "🌙🌫️ A foggy night. Lantern, but no guide" },
      { inputs: { is_night: true, lantern: true, foggy: true, guide: true }, event: "🏮🧭 Lantern AND guide" },
    ],
    solve: (i) => (!i.is_night || b(i.lantern)) && (!i.foggy || b(i.guide)),
    explain: (i) => {
      const dark = i.is_night && !i.lantern;
      const lost = i.foggy && !i.guide;
      if (dark && lost) return "it was a foggy night with no lantern and no guide";
      if (dark) return "it was night and there was no lantern";
      if (lost) return "it was foggy and there was no guide";
      return "every danger was covered";
    },
    hints: [
      "Split it into two separate problems: the dark, and the fog. Each one has its own fix.",
      "not flips True and False. Something like “not dark, or has a lantern” covers the night problem.",
    ],
  },
  {
    id: "final-crossing",
    title: "The Final Crossing",
    scene: "routes",
    boss: true,
    goal: "Everything you've learned, in one mission. Read the ranger's rules and get the hiker across as fast as possible, but only safely.",
    rules: ['Set route to "A", "B", "C" or "wait"', 'weather is "clear", "windy" or "storm"'],
    table: {
      title: "Ranger's rules",
      rows: [
        ["⛈️ Storm", "nobody crosses. The hiker must wait."],
        ["Bridge A (fastest)", "needs 80+ energy and weight of 70 kg or less. Closed when it's windy."],
        ["Bridge B", "needs 50+ energy. Sometimes closed for repairs."],
        ["Bridge C (slowest)", "always open."],
        ["Always", "take the fastest bridge the hiker is allowed on."],
      ],
    },
    given: {
      weather: '"clear", "windy" or "storm"',
      energy: "the hiker's energy (0–100)",
      weight: "the hiker's weight in kg",
      b_closed: "is bridge B closed for repairs?",
    },
    output: { name: "route", choices: ["A", "B", "C", "wait"] },
    rounds: [
      { inputs: { weather: "clear", energy: 90, weight: 60, b_closed: false } },
      { inputs: { weather: "windy", energy: 90, weight: 60, b_closed: false }, event: "💨 The wind picks up" },
      { inputs: { weather: "clear", energy: 90, weight: 80, b_closed: false }, event: "🎒 A heavier hiker: 80 kg" },
      { inputs: { weather: "clear", energy: 60, weight: 60, b_closed: true }, event: "🚧 Bridge B closed for repairs" },
      { inputs: { weather: "storm", energy: 95, weight: 50, b_closed: false }, event: "⛈️ A storm hits the canyon" },
      { inputs: { weather: "clear", energy: 40, weight: 50, b_closed: false }, event: "🥵 A very tired hiker" },
      { inputs: { weather: "windy", energy: 85, weight: 65, b_closed: true }, event: "💨🚧 Windy, and B is closed" },
    ],
    solve: (i) => {
      if (i.weather === "storm") return "wait";
      if (n(i.energy) >= 80 && n(i.weight) <= 70 && i.weather !== "windy") return "A";
      if (n(i.energy) >= 50 && !i.b_closed) return "B";
      return "C";
    },
    explain: (i) => {
      if (i.weather === "storm") return "there was a storm, so nobody crosses";
      const e = n(i.energy);
      const w = n(i.weight);
      const noA =
        e < 80 ? `energy ${e} is below 80` : w > 70 ? `${w} kg is over 70 kg` : i.weather === "windy" ? "A is closed when it's windy" : "";
      if (!noA) return "A was allowed and it's the fastest";
      const noB = e < 50 ? `energy ${e} is below 50` : i.b_closed ? "B was closed" : "";
      if (!noB) return `A wasn't allowed (${noA}), so B was the fastest option`;
      return `A wasn't allowed (${noA}) and neither was B (${noB}), so C`;
    },
    hints: ["Go through the rules the way a ranger would: the most important check first, then the fastest bridge, then the next one."],
  },
];

export const COND_TRACKS = [
  { id: "first", title: "First Decisions", blurb: "Should the hiker cross or not?", emoji: "🧭", ids: ["safe-to-cross", "danger-ahead", "cross-or-wait"] },
  { id: "numbers", title: "Checking the Facts", blurb: "Numbers, limits and more than one check.", emoji: "⚖️", ids: ["weight-limit", "two-checks", "wind-warning"] },
  { id: "paths", title: "Tricky Choices", blurb: "Many bridges, many rules.", emoji: "🌉", ids: ["three-bridges", "emergency-pass", "rangers-orders", "night-and-fog"] },
  { id: "boss", title: "Boss Level", blurb: "No hints about which Python to use.", emoji: "🏆", ids: ["final-crossing"] },
];

export function condIndex(id: string) {
  return COND_LEVELS.findIndex((l) => l.id === id);
}

/* ------------------------------------------------------------------ */
/* Judging one round                                                   */
/* ------------------------------------------------------------------ */

export type Verdict = {
  ok: boolean;
  kind: "correct" | "error" | "missing" | "type" | "wrong";
  expected: boolean | string;
  got: boolean | string | null; // null = not set / unusable
  title: string;
  message: string;
};

const show = (v: Val) => repr(v, true);

export function toInputs(i: Inputs): Record<string, Val> {
  return Object.fromEntries(Object.entries(i).map(([k, v]) => [k, v as Val]));
}

export function judgeRound(level: CondLevel, round: Round, res: RunResult): Verdict {
  const expected = level.solve(round.inputs);
  const name = level.output.name;
  const why = level.explain(round.inputs);

  if (res.error) {
    return {
      ok: false,
      kind: "error",
      expected,
      got: null,
      title: res.runaway ? "Your code never finishes" : "Check your code",
      message: res.error.message,
    };
  }

  const has = Object.prototype.hasOwnProperty.call(res.vars, name);
  if (!has) {
    return {
      ok: false,
      kind: "missing",
      expected,
      got: null,
      title: "The hiker is confused",
      message: `Your code never set ${name} in this situation, so the hiker didn't know what to do. Make sure ${name} gets a value every time.`,
    };
  }
  const v = res.vars[name];

  if (name === "cross") {
    if (typeof v !== "boolean") {
      const hint =
        typeof v === "string" && /^(true|false)$/i.test(v)
          ? ` Write True or False without quotes. With quotes it's text, not a True/False value.`
          : " Use True or False.";
      return {
        ok: false,
        kind: "type",
        expected,
        got: null,
        title: "cross must be True or False",
        message: `Your code set cross = ${show(v)}.${hint}`,
      };
    }
    if (v === expected) {
      return { ok: true, kind: "correct", expected, got: v, title: "Right call", message: why };
    }
    return v
      ? {
          ok: false,
          kind: "wrong",
          expected,
          got: v,
          title: "Splash!",
          message: `Your code sent the hiker across, but ${why}. The hiker should have waited.`,
        }
      : {
          ok: false,
          kind: "wrong",
          expected,
          got: v,
          title: "Missed chance",
          message: `Your code told the hiker to wait, but ${why}. It was fine to cross.`,
        };
  }

  // route
  const choices = level.output.choices ?? [];
  const list = choices.map((c) => `"${c}"`).join(", ");
  if (typeof v !== "string") {
    const bare = v instanceof PyFloat || typeof v === "number" ? "" : " Did you forget the quotes, like \"A\"?";
    return {
      ok: false,
      kind: "type",
      expected,
      got: null,
      title: "route must be text",
      message: `Your code set route = ${show(v)}. route must be one of ${list}.${bare}`,
    };
  }
  if (!choices.includes(v)) {
    const close = choices.find((c) => c.toLowerCase() === v.trim().toLowerCase());
    return {
      ok: false,
      kind: "type",
      expected,
      got: null,
      title: "No such route",
      message: close
        ? `Your code set route = ${show(v)}. Python cares about capitals and spaces. Use "${close}".`
        : `Your code set route = ${show(v)}, but the only choices are ${list}.`,
    };
  }
  if (v === expected) {
    return { ok: true, kind: "correct", expected, got: v, title: "Right call", message: why };
  }
  const where = (r: string) => (r === "wait" ? "wait" : `take Bridge ${r}`);
  return {
    ok: false,
    kind: "wrong",
    expected,
    got: v,
    title: v === "wait" ? "Why wait?" : "Wrong bridge",
    message: `Your code said to ${where(v)}, but ${why}. The hiker should ${where(String(expected))}.`,
  };
}
