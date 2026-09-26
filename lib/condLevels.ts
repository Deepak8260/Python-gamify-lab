/*
 * Condition Lab: decision logic for real systems.
 *
 * Every level is a small piece of real software (a sign-up service, a payment
 * gateway, an API gateway, a firewall…). The game gives the student ordinary
 * Python variables and the student writes the conditions that set ONE answer
 * variable (a True/False flag or one of a few text values).
 *
 * The same code is run against every test case: a few VISIBLE cases that the
 * student can read, then HIDDEN cases (boundaries, edge cases, often the whole
 * truth table). Code that only works for the visible values fails.
 *
 * When a run fails, the student's answers over ALL cases are compared with
 * each level's `pitfalls`, which are common wrong solutions (> instead of >=,
 * or instead of and, a broad elif first…). A match gives a targeted explanation.
 */

import { PyFloat, repr, type RunResult, type Val } from "./interpreter";

export type Value = boolean | number | string;
export type Inputs = Record<string, Value>;
export type Case = { inputs: Inputs; note?: string };

/* ------------------------------------------------------------------ */
/* Concepts                                                            */
/* ------------------------------------------------------------------ */

export type Concept =
  | "if"
  | "else"
  | "elif"
  | "comparison"
  | "boundaries"
  | "equality"
  | "strings"
  | "multi_vars"
  | "and"
  | "or"
  | "not"
  | "truthy"
  | "combined"
  | "parentheses"
  | "nested"
  | "ordering"
  | "mutual_exclusion"
  | "edge_cases"
  | "decision_tree";

export const CONCEPTS: Record<Concept, { label: string; blurb: string }> = {
  if: { label: "if", blurb: "run code only when a condition is True" },
  else: { label: "if / else", blurb: "exactly one of two outcomes" },
  elif: { label: "if / elif / else", blurb: "exactly one of many outcomes" },
  comparison: { label: "Comparisons", blurb: "<, >, <=, >=" },
  boundaries: { label: "Boundary values", blurb: "> vs >=, the exact edge" },
  equality: { label: "== and !=", blurb: "equal and not equal" },
  strings: { label: "Text conditions", blurb: "comparing strings exactly" },
  multi_vars: { label: "Multiple variables", blurb: "decisions from several facts" },
  and: { label: "and", blurb: "every condition must be True" },
  or: { label: "or", blurb: "at least one condition is True" },
  not: { label: "not", blurb: "the opposite of a condition" },
  truthy: { label: "Truthy / falsy", blurb: "0, \"\" and None act as False" },
  combined: { label: "Combined logic", blurb: "and, or and not together" },
  parentheses: { label: "Grouping", blurb: "brackets and precedence" },
  nested: { label: "Nested conditions", blurb: "an if inside an if" },
  ordering: { label: "Condition order", blurb: "which check comes first" },
  mutual_exclusion: { label: "elif vs separate ifs", blurb: "one match or every match" },
  edge_cases: { label: "Edge cases", blurb: "0, negatives, unexpected input" },
  decision_tree: { label: "Decision trees", blurb: "full real-world rule sets" },
};

/* ------------------------------------------------------------------ */
/* Level shape                                                         */
/* ------------------------------------------------------------------ */

export type Tone = "good" | "bad" | "warn" | "info";
export type Outcome = { value: Value; label: string; icon: string; tone: Tone };

export type Pitfall = {
  tag: string;
  concept: Concept;
  /** what the common wrong solution answers */
  wrong: (i: Inputs) => Value;
  message: string;
};

export type Difficulty = "beginner" | "easy" | "medium" | "hard" | "expert";

export type CondLevel = {
  id: string;
  title: string;
  difficulty: Difficulty;
  system: { name: string; icon: string; request: string };
  scenario: string;
  task: string;
  rules: string[];
  table?: { title?: string; rows: [string, string][] };
  given: Record<string, string>; // variable name -> what it means
  output: { name: string; kind: "bool" | "choice"; outcomes: Outcome[]; start?: Value };
  visible: Case[];
  hidden: Inputs[];
  solve: (i: Inputs) => Value;
  /** why `solve` gives that answer for these inputs (plain words) */
  explain: (i: Inputs) => string;
  /** shown after success: why the logic works */
  success: string;
  hints: string[];
  pitfalls: Pitfall[];
  /** every concept the level makes the student use */
  concepts: Concept[];
  /** concepts seen for the first time here */
  introduces: Concept[];
  /** hide the concept chips (real-world and boss levels: work it out yourself) */
  hideConcepts?: boolean;
  mustUse?: { word: string; message: string }[];
  boss?: boolean;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const n = (x: unknown) => x as number;
const b = (x: unknown) => x as boolean;
const s = (x: unknown) => x as string;
const rs = (x: number) => `₹${x.toLocaleString("en-IN")}`;

/** every combination of the given values (a truth table) */
function grid(axes: Record<string, Value[]>): Inputs[] {
  return Object.entries(axes).reduce<Inputs[]>((acc, [k, vals]) => acc.flatMap((a) => vals.map((v) => ({ ...a, [k]: v }))), [{}]);
}

const same = (a: Inputs, c: Inputs) => Object.keys(a).length === Object.keys(c).length && Object.keys(a).every((k) => a[k] === c[k]);

const allowDeny = (yes: [string, string], no: [string, string]): Outcome[] => [
  { value: true, icon: yes[0], label: yes[1], tone: "good" },
  { value: false, icon: no[0], label: no[1], tone: "bad" },
];

/** removes hidden cases that repeat a visible one */
function level(l: CondLevel): CondLevel {
  const hidden = l.hidden.filter((h, k) => !l.visible.some((v) => same(v.inputs, h)) && l.hidden.findIndex((x) => same(x, h)) === k);
  return { ...l, hidden };
}

/* ---- boss level policy, with switches that model common mistakes ---- */
type PayOpts = Partial<{
  otpBeforeReview: boolean;
  reviewBeforeDecline: boolean;
  zeroOk: boolean;
  dailyStrict: boolean;
  reviewAtLimit: boolean;
  otpStrict: boolean;
  fundsStrict: boolean;
  blockedOnly: boolean;
}>;

function payment(i: Inputs, o: PayOpts = {}): string {
  const amount = n(i.amount);
  const cardBad = o.blockedOnly ? i.card_status === "blocked" : i.card_status !== "active";
  const badAmount = o.zeroOk ? amount < 0 : amount <= 0;
  const noFunds = o.fundsStrict ? amount >= n(i.balance) : amount > n(i.balance);
  const total = n(i.spent_today) + amount;
  const overDaily = o.dailyStrict ? total >= 100000 : total > 100000;
  const decline = cardBad || badAmount || noFunds || overDaily;
  const review = b(i.international) && (o.reviewAtLimit ? amount >= 50000 : amount > 50000);
  const otp = (o.otpStrict ? amount > 10000 : amount >= 10000) && !i.otp_verified;
  const order: [boolean, string][] = o.reviewBeforeDecline
    ? [[review, "review"], [decline, "declined"], [otp, "otp_required"]]
    : o.otpBeforeReview
      ? [[decline, "declined"], [otp, "otp_required"], [review, "review"]]
      : [[decline, "declined"], [review, "review"], [otp, "otp_required"]];
  return order.find(([hit]) => hit)?.[1] ?? "approved";
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

export const COND_LEVELS: CondLevel[] = [
  /* ============================ FOUNDATIONS ============================ */
  level({
    id: "age-gate",
    title: "Age Gate",
    difficulty: "beginner",
    system: { name: "Sign-up Service", icon: "🎬", request: "Sign-up request" },
    scenario:
      "A video streaming platform shows mature content, so only adults may create an account. Every sign-up request reaches this service with the user's age.",
    task: "Allow the sign-up when the user is 18 or older.",
    rules: ["18 itself counts as “18 or older”"],
    given: { age: "the user's age in years (a whole number)" },
    output: { name: "allowed", kind: "bool", start: false, outcomes: allowDeny(["✅", "Account created"], ["⛔", "Sign-up refused"]) },
    visible: [
      { inputs: { age: 24 }, note: "A 24-year-old signs up" },
      { inputs: { age: 15 }, note: "A 15-year-old tries to sign up" },
      { inputs: { age: 18 }, note: "Someone who just turned 18" },
    ],
    hidden: [{ age: 17 }, { age: 19 }, { age: 0 }, { age: 65 }, { age: 13 }, { age: 100 }],
    solve: (i) => n(i.age) >= 18,
    explain: (i) => (n(i.age) >= 18 ? `${i.age} is 18 or older` : `${i.age} is under 18`),
    success:
      "The line inside your if runs only when age >= 18 is True. For a younger user the condition is False, the line is skipped, and allowed keeps its starting value, False. That is the whole idea of if: some code runs only in some situations.",
    hints: [
      "Which single fact about the user decides this?",
      "The line that sets allowed = True should only run in some situations. Which Python keyword runs a line only when something is True?",
      "Python compares numbers with <, >, <= and >=. “18 or older” must include 18 itself.",
    ],
    pitfalls: [
      {
        tag: "gt-instead-of-gte",
        concept: "boundaries",
        wrong: (i) => n(i.age) > 18,
        message: "Your code refuses a user who is exactly 18. “18 or older” includes 18. > means strictly greater; >= includes the boundary.",
      },
      {
        tag: "reversed-comparison",
        concept: "comparison",
        wrong: (i) => n(i.age) < 18,
        message: "Your code lets in the under-18 users and refuses the adults. Check which way your comparison points.",
      },
    ],
    concepts: ["if", "comparison"],
    introduces: ["if", "comparison"],
    mustUse: [
      {
        word: "if",
        message:
          "Your answer gives the right results, but this level is here to practise if. Write it with an if statement. (Setting allowed = age >= 18 directly is also valid Python. You'll see why later.)",
      },
    ],
  }),

  level({
    id: "payment-limit",
    title: "Payment Limit",
    difficulty: "beginner",
    system: { name: "Payment Gateway", icon: "💳", request: "UPI transfer" },
    scenario:
      "Each bank account has a limit for a single UPI transfer. The payment gateway must approve or decline every transfer. It must never leave a payment undecided.",
    task: "Approve the payment if the amount is within the account's limit. Otherwise decline it.",
    rules: ["A payment exactly equal to the limit is within the limit", "Limits are different for each account"],
    given: { amount: "the transfer amount in ₹", limit: "the most this account may send in one transfer, in ₹" },
    output: {
      name: "status",
      kind: "choice",
      outcomes: [
        { value: "approved", icon: "✅", label: "Money sent", tone: "good" },
        { value: "declined", icon: "⛔", label: "Payment declined", tone: "bad" },
      ],
    },
    visible: [
      { inputs: { amount: 2500, limit: 10000 }, note: "Paying rent share" },
      { inputs: { amount: 15000, limit: 10000 }, note: "A large transfer" },
    ],
    hidden: [
      { amount: 10000, limit: 10000 },
      { amount: 10001, limit: 10000 },
      { amount: 1, limit: 1 },
      { amount: 50000, limit: 100000 },
      { amount: 100000, limit: 50000 },
      { amount: 4999, limit: 5000 },
      { amount: 5000, limit: 5000 },
      { amount: 5001, limit: 5000 },
    ],
    solve: (i) => (n(i.amount) <= n(i.limit) ? "approved" : "declined"),
    explain: (i) =>
      n(i.amount) === n(i.limit)
        ? `${rs(n(i.amount))} is exactly the limit, which is allowed`
        : n(i.amount) < n(i.limit)
          ? `${rs(n(i.amount))} is within the ${rs(n(i.limit))} limit`
          : `${rs(n(i.amount))} is over the ${rs(n(i.limit))} limit`,
    success:
      "if / else guarantees that exactly one of the two blocks runs. When amount <= limit is True the if block approves, and in every other case the else block declines. No payment can slip through undecided.",
    hints: [
      "There are exactly two possible results. What decides between them?",
      "An if on its own does nothing when its condition is False, and then status never gets a value. Python has a keyword for “in every other case”.",
      "Write else: lined up with the if (same indentation), and put the declining line inside it.",
    ],
    pitfalls: [
      {
        tag: "lt-instead-of-lte",
        concept: "boundaries",
        wrong: (i) => (n(i.amount) < n(i.limit) ? "approved" : "declined"),
        message: "Your code declines a payment that is exactly equal to the limit. “Within the limit” includes the limit itself, so use <=.",
      },
      {
        tag: "hardcoded-number",
        concept: "multi_vars",
        wrong: (i) => (n(i.amount) <= 10000 ? "approved" : "declined"),
        message: "Your code seems to compare with a fixed number like 10000 instead of the limit variable. Every account has its own limit, so compare amount with limit.",
      },
      {
        tag: "reversed-comparison",
        concept: "comparison",
        wrong: (i) => (n(i.amount) >= n(i.limit) ? "approved" : "declined"),
        message: "Your code approves the big payments and declines the small ones. Check which way your comparison points.",
      },
    ],
    concepts: ["if", "else", "comparison"],
    introduces: ["else"],
  }),

  level({
    id: "grade-report",
    title: "Grade Report",
    difficulty: "easy",
    system: { name: "Exam Result Portal", icon: "🎓", request: "Student result" },
    scenario: "The university's result portal turns each student's total marks into a grade before it publishes the results.",
    task: "Set grade from marks using the grading table.",
    rules: ["Every student gets exactly one grade", "marks is a whole number from 0 to 100"],
    table: {
      title: "Grading table",
      rows: [
        ["90 to 100", "\"A\""],
        ["75 to 89", "\"B\""],
        ["50 to 74", "\"C\""],
        ["below 50", "\"F\""],
      ],
    },
    given: { marks: "total marks, from 0 to 100" },
    output: {
      name: "grade",
      kind: "choice",
      outcomes: [
        { value: "A", icon: "🏅", label: "Distinction", tone: "good" },
        { value: "B", icon: "👍", label: "Good", tone: "good" },
        { value: "C", icon: "✔️", label: "Pass", tone: "info" },
        { value: "F", icon: "❌", label: "Fail", tone: "bad" },
      ],
    },
    visible: [{ inputs: { marks: 82 } }, { inputs: { marks: 95 } }, { inputs: { marks: 61 } }, { inputs: { marks: 34 } }],
    hidden: [{ marks: 90 }, { marks: 89 }, { marks: 75 }, { marks: 74 }, { marks: 50 }, { marks: 49 }, { marks: 100 }, { marks: 0 }],
    solve: (i) => (n(i.marks) >= 90 ? "A" : n(i.marks) >= 75 ? "B" : n(i.marks) >= 50 ? "C" : "F"),
    explain: (i) => {
      const m = n(i.marks);
      return m >= 90 ? `${m} is in the 90–100 band` : m >= 75 ? `${m} is in the 75–89 band` : m >= 50 ? `${m} is in the 50–74 band` : `${m} is below 50`;
    },
    success:
      "Python checks the if and each elif from the top, and runs only the first one that is True. You check the highest band first, so a student with 95 is caught by marks >= 90 before a lower check can grab them. The final else catches everything below 50, so no student is left without a grade.",
    hints: [
      "There are four possible results and each student gets exactly one. How is this different from the two-outcome payment check?",
      "After the first check you can add more checks with elif. Python stops at the first one that is True.",
      "Start with the highest band. If marks >= 90 is False, what do you already know about marks when the next check runs?",
    ],
    pitfalls: [
      {
        tag: "broad-condition-first",
        concept: "ordering",
        wrong: (i) => (n(i.marks) >= 50 ? "C" : "F"),
        message:
          "Your code gives \"C\" to students who earned an A or a B. 95 is also >= 50. Either the lowest band is checked first, or you used separate if statements, so a later check overwrote the grade. With if / elif / else only the first True branch runs, so check the highest band first.",
      },
      {
        tag: "gt-instead-of-gte",
        concept: "boundaries",
        wrong: (i) => (n(i.marks) > 90 ? "A" : n(i.marks) > 75 ? "B" : n(i.marks) > 50 ? "C" : "F"),
        message: "Students who land exactly on a boundary (90, 75, 50) get the lower grade. The table says “90 to 100”, so 90 belongs to A. Use >=.",
      },
    ],
    concepts: ["if", "elif", "else", "comparison", "mutual_exclusion"],
    introduces: ["elif", "mutual_exclusion"],
  }),

  /* ======================== COMPARISONS & FACTS ======================== */
  level({
    id: "cpu-alert",
    title: "CPU Alert",
    difficulty: "easy",
    system: { name: "Server Monitor", icon: "🖥️", request: "CPU reading" },
    scenario:
      "A monitoring agent reads each server's CPU usage every minute. The on-call engineer should only be woken up for real problems, so the alert levels are defined very precisely.",
    task: "Set alert for each CPU reading using the alert policy. Read every boundary carefully.",
    rules: ["If a reading matches several rows, the row higher in the table wins"],
    table: {
      title: "Alert policy",
      rows: [
        ["cpu is exactly 100", "\"saturated\""],
        ["cpu is more than 90", "\"critical\""],
        ["cpu is 80 or more", "\"warning\""],
        ["anything lower", "\"ok\""],
      ],
    },
    given: { cpu: "CPU usage in percent, a whole number from 0 to 100" },
    output: {
      name: "alert",
      kind: "choice",
      outcomes: [
        { value: "saturated", icon: "🔥", label: "Page on-call now", tone: "bad" },
        { value: "critical", icon: "🚨", label: "Critical alert", tone: "bad" },
        { value: "warning", icon: "⚠️", label: "Warning on dashboard", tone: "warn" },
        { value: "ok", icon: "✅", label: "All good", tone: "good" },
      ],
    },
    visible: [{ inputs: { cpu: 45 } }, { inputs: { cpu: 85 } }, { inputs: { cpu: 97 } }, { inputs: { cpu: 100 } }],
    hidden: [{ cpu: 79 }, { cpu: 80 }, { cpu: 81 }, { cpu: 89 }, { cpu: 90 }, { cpu: 91 }, { cpu: 99 }, { cpu: 0 }],
    solve: (i) => (n(i.cpu) === 100 ? "saturated" : n(i.cpu) > 90 ? "critical" : n(i.cpu) >= 80 ? "warning" : "ok"),
    explain: (i) => {
      const c = n(i.cpu);
      return c === 100
        ? "100 is exactly the maximum"
        : c > 90
          ? `${c} is more than 90`
          : c === 90
            ? "90 is not more than 90, but it is 80 or more"
            : c >= 80
              ? `${c} is 80 or more`
              : `${c} is below 80`;
    },
    success:
      "Boundaries are where conditions usually go wrong. cpu > 90 leaves 90 out, cpu >= 80 keeps 80 in, and cpu == 100 matches one exact value. The exact match comes first, so the broader cpu > 90 can't catch 100.",
    hints: [
      "The hidden tests check the values right on the edges: 79, 80, 81, 89, 90, 91. For each row, decide whether the boundary number itself is included.",
      "“more than 90” and “80 or more” are different kinds of rule. Which operator fits each one?",
      "100 is also more than 90. Which check must come first so that 100 gets its own alert? Remember: == compares, a single = stores a value.",
    ],
    pitfalls: [
      {
        tag: "gte-instead-of-gt",
        concept: "boundaries",
        wrong: (i) => (n(i.cpu) === 100 ? "saturated" : n(i.cpu) >= 90 ? "critical" : n(i.cpu) >= 80 ? "warning" : "ok"),
        message: "At exactly 90 your code raises \"critical\". The policy says more than 90, so 90 is only a warning. > leaves the boundary out; >= includes it.",
      },
      {
        tag: "gt-instead-of-gte",
        concept: "boundaries",
        wrong: (i) => (n(i.cpu) === 100 ? "saturated" : n(i.cpu) > 90 ? "critical" : n(i.cpu) > 80 ? "warning" : "ok"),
        message: "At exactly 80 your code says \"ok\", but the policy says 80 or more is a warning. Use >= when the boundary itself counts.",
      },
      {
        tag: "specific-after-broad",
        concept: "ordering",
        wrong: (i) => (n(i.cpu) > 90 ? "critical" : n(i.cpu) >= 80 ? "warning" : "ok"),
        message: "At 100 your code raises \"critical\". cpu > 90 is also True for 100, and it's checked first. Put the most specific rule (cpu == 100) first.",
      },
    ],
    concepts: ["comparison", "boundaries", "equality", "elif", "ordering"],
    introduces: ["boundaries", "equality", "ordering"],
  }),

  level({
    id: "train-booking",
    title: "Train Booking",
    difficulty: "easy",
    system: { name: "Rail Booking System", icon: "🚆", request: "Booking request" },
    scenario: "A passenger asks for tickets on a train. The booking system has to look at the train's status and the seats left before it answers.",
    task: "Decide the booking status using the rules below, checked in this order.",
    rules: ["train_status is text: \"running\", \"cancelled\" or \"diverted\"", "Text comparisons are exact: \"Running\" is not the same as \"running\""],
    table: {
      title: "Booking rules (in this order)",
      rows: [
        ["1. train_status is anything other than \"running\"", "\"unavailable\""],
        ["2. enough seats left for every ticket wanted", "\"confirmed\""],
        ["3. otherwise", "\"waitlisted\""],
      ],
    },
    given: { train_status: "\"running\", \"cancelled\" or \"diverted\"", seats_left: "seats still free on the train", tickets_wanted: "how many tickets the passenger wants" },
    output: {
      name: "booking",
      kind: "choice",
      outcomes: [
        { value: "confirmed", icon: "🎫", label: "Tickets confirmed", tone: "good" },
        { value: "waitlisted", icon: "⏳", label: "On the waitlist", tone: "warn" },
        { value: "unavailable", icon: "🚫", label: "Booking closed", tone: "bad" },
      ],
    },
    visible: [
      { inputs: { train_status: "running", seats_left: 40, tickets_wanted: 2 } },
      { inputs: { train_status: "running", seats_left: 1, tickets_wanted: 3 }, note: "Almost sold out" },
      { inputs: { train_status: "cancelled", seats_left: 40, tickets_wanted: 2 }, note: "Train cancelled" },
    ],
    hidden: [
      { train_status: "running", seats_left: 3, tickets_wanted: 3 },
      { train_status: "running", seats_left: 0, tickets_wanted: 1 },
      { train_status: "diverted", seats_left: 50, tickets_wanted: 1 },
      { train_status: "cancelled", seats_left: 0, tickets_wanted: 4 },
      { train_status: "running", seats_left: 4, tickets_wanted: 5 },
      { train_status: "running", seats_left: 5, tickets_wanted: 4 },
      { train_status: "diverted", seats_left: 0, tickets_wanted: 1 },
    ],
    solve: (i) => (i.train_status !== "running" ? "unavailable" : n(i.seats_left) >= n(i.tickets_wanted) ? "confirmed" : "waitlisted"),
    explain: (i) =>
      i.train_status !== "running"
        ? `the train is "${i.train_status}", not "running"`
        : n(i.seats_left) >= n(i.tickets_wanted)
          ? `${i.seats_left} seats are enough for ${i.tickets_wanted} tickets`
          : `${i.seats_left} seats are not enough for ${i.tickets_wanted} tickets`,
    success:
      "This decision uses three variables of two types, text and numbers. != \"running\" covers every status that isn't running, including ones you didn't list. Checking the train first means the seat numbers only matter when the train is actually running.",
    hints: [
      "Which fact makes the other facts irrelevant?",
      "“Anything other than \"running\"” can be one comparison. Python's “not equal to” operator is !=.",
      "seats_left and tickets_wanted are both numbers. If they are equal, is there enough room?",
    ],
    pitfalls: [
      {
        tag: "listed-one-bad-value",
        concept: "equality",
        wrong: (i) => (i.train_status === "cancelled" ? "unavailable" : n(i.seats_left) >= n(i.tickets_wanted) ? "confirmed" : "waitlisted"),
        message:
          "Your code only treats \"cancelled\" as unavailable, so a \"diverted\" train still takes bookings. The rule says anything other than \"running\". Use != \"running\" instead of listing the bad values.",
      },
      {
        tag: "gt-instead-of-gte",
        concept: "boundaries",
        wrong: (i) => (i.train_status !== "running" ? "unavailable" : n(i.seats_left) > n(i.tickets_wanted) ? "confirmed" : "waitlisted"),
        message: "When the seats left exactly match the tickets wanted, your code waitlists the passenger. 3 seats are enough for 3 tickets, so use >=.",
      },
      {
        tag: "seats-before-status",
        concept: "ordering",
        wrong: (i) => (n(i.seats_left) >= n(i.tickets_wanted) ? "confirmed" : i.train_status !== "running" ? "unavailable" : "waitlisted"),
        message: "Your code confirms seats on a cancelled or diverted train. Rule 1 must be checked first: the seats only matter once the train is running.",
      },
    ],
    concepts: ["multi_vars", "strings", "equality", "comparison", "elif", "ordering"],
    introduces: ["multi_vars", "strings"],
  }),

  /* ============================ BOOLEAN LOGIC ============================ */
  level({
    id: "admin-dashboard",
    title: "Admin Dashboard",
    difficulty: "easy",
    system: { name: "Admin Portal", icon: "🔐", request: "Page request" },
    scenario: "The company's internal admin dashboard shows salary data. Every request for the page arrives with the visitor's login state and role.",
    task: "Grant access only when the visitor is logged in and their role is \"admin\". Deny every other request.",
    rules: ["role is \"admin\", \"editor\" or \"viewer\""],
    given: { logged_in: "True if the visitor is logged in", role: "\"admin\", \"editor\" or \"viewer\"" },
    output: { name: "access", kind: "bool", outcomes: allowDeny(["✅", "Dashboard shown"], ["⛔", "403 Forbidden"]) },
    visible: [
      { inputs: { logged_in: true, role: "admin" } },
      { inputs: { logged_in: true, role: "viewer" } },
      { inputs: { logged_in: false, role: "admin" }, note: "A logged-out visitor claims to be admin" },
    ],
    hidden: grid({ logged_in: [true, false], role: ["admin", "editor", "viewer"] }),
    solve: (i) => b(i.logged_in) && i.role === "admin",
    explain: (i) =>
      !i.logged_in && i.role !== "admin"
        ? "the visitor is not logged in and is not an admin"
        : !i.logged_in
          ? "the visitor is not logged in, and a role means nothing until they log in"
          : i.role !== "admin"
            ? `the visitor is logged in, but "${i.role}" is not "admin"`
            : "the visitor is logged in and is an admin",
    success:
      "and is True only when both sides are True. When logged_in is False, Python doesn't even look at the role, because the answer can't be True any more. The decision panel shows that part as skipped. This is called short-circuiting.",
    hints: [
      "How many conditions must hold before access is granted?",
      "Must they be true at the same time, or is one of them enough?",
      "Python joins two conditions that must both be True with the word and. Each side must be a complete condition.",
    ],
    pitfalls: [
      {
        tag: "or-instead-of-and",
        concept: "and",
        wrong: (i) => b(i.logged_in) || i.role === "admin",
        message:
          "Your code lets in anyone who is logged in OR is an admin: a logged-out \"admin\" got in, and so did a logged-in viewer. Both conditions must be True at once, and that is and.",
      },
      {
        tag: "role-only",
        concept: "and",
        wrong: (i) => i.role === "admin",
        message: "Your code only checks the role, so a visitor who isn't logged in got in because their role said \"admin\". Anyone can claim a role; the login check is required too.",
      },
      {
        tag: "login-only",
        concept: "and",
        wrong: (i) => b(i.logged_in),
        message: "Your code only checks logged_in, so every logged-in editor and viewer can see salary data. The role must be \"admin\" as well.",
      },
    ],
    concepts: ["and", "equality", "strings", "else"],
    introduces: ["and"],
  }),

  level({
    id: "loan-eligibility",
    title: "Loan Eligibility",
    difficulty: "medium",
    system: { name: "Loan Screening Engine", icon: "🏦", request: "Loan application" },
    scenario: "A bank screens personal loan applications automatically. An application goes to a loan officer only if the applicant meets every basic requirement.",
    task: "Set eligible to True only if every requirement in the table is met.",
    rules: ["credit_score is between 300 and 900"],
    table: {
      title: "Requirements",
      rows: [
        ["Age", "21 to 60 (both included)"],
        ["Monthly income", "at least ₹25,000"],
        ["Credit score", "750 or higher"],
      ],
    },
    given: { age: "applicant's age in years", monthly_income: "income per month, in ₹", credit_score: "credit score, 300 to 900" },
    output: { name: "eligible", kind: "bool", outcomes: allowDeny(["📨", "Sent to loan officer"], ["⛔", "Auto-rejected"]) },
    visible: [
      { inputs: { age: 30, monthly_income: 60000, credit_score: 800 } },
      { inputs: { age: 19, monthly_income: 40000, credit_score: 780 }, note: "A college student applies" },
      { inputs: { age: 45, monthly_income: 22000, credit_score: 810 } },
      { inputs: { age: 35, monthly_income: 50000, credit_score: 700 } },
    ],
    hidden: [
      { age: 21, monthly_income: 25000, credit_score: 750 },
      { age: 20, monthly_income: 90000, credit_score: 850 },
      { age: 60, monthly_income: 30000, credit_score: 760 },
      { age: 61, monthly_income: 90000, credit_score: 850 },
      { age: 40, monthly_income: 24999, credit_score: 800 },
      { age: 40, monthly_income: 25000, credit_score: 749 },
      { age: 40, monthly_income: 25000, credit_score: 750 },
      { age: 70, monthly_income: 10000, credit_score: 600 },
      { age: 25, monthly_income: 100000, credit_score: 900 },
    ],
    solve: (i) => n(i.age) >= 21 && n(i.age) <= 60 && n(i.monthly_income) >= 25000 && n(i.credit_score) >= 750,
    explain: (i) => {
      const fails: string[] = [];
      if (n(i.age) < 21) fails.push(`age ${i.age} is under 21`);
      if (n(i.age) > 60) fails.push(`age ${i.age} is over 60`);
      if (n(i.monthly_income) < 25000) fails.push(`${rs(n(i.monthly_income))} is below ${rs(25000)}`);
      if (n(i.credit_score) < 750) fails.push(`a score of ${i.credit_score} is below 750`);
      return fails.length ? fails.join(" and ") : "every requirement is met";
    },
    success:
      "Every requirement must hold, so you joined them with and. An age range has two ends: 21 <= age <= 60 (Python allows this chained form) means the same as age >= 21 and age <= 60. If any single part is False, the whole expression is False.",
    hints: [
      "List the requirements. Does the applicant need all of them or just one?",
      "An age range has two boundaries. How many comparisons does “21 to 60” need?",
      "You can join more than two conditions with and. Python also lets you write a range as 21 <= age <= 60.",
    ],
    pitfalls: [
      {
        tag: "open-range",
        concept: "boundaries",
        wrong: (i) => n(i.age) > 21 && n(i.age) < 60 && n(i.monthly_income) >= 25000 && n(i.credit_score) >= 750,
        message: "Your code rejects applicants aged exactly 21 or 60. The table says both ends are included, so use <= on both sides (21 <= age <= 60).",
      },
      {
        tag: "missing-upper-bound",
        concept: "boundaries",
        wrong: (i) => n(i.age) >= 21 && n(i.monthly_income) >= 25000 && n(i.credit_score) >= 750,
        message: "Your code accepts a 61-year-old. The age rule has two ends: at least 21 AND at most 60.",
      },
      {
        tag: "or-instead-of-and",
        concept: "and",
        wrong: (i) => (n(i.age) >= 21 && n(i.age) <= 60) || n(i.monthly_income) >= 25000 || n(i.credit_score) >= 750,
        message: "Your code accepts applicants who meet only some requirements. Every requirement must be met, so join them all with and.",
      },
      {
        tag: "gt-instead-of-gte",
        concept: "boundaries",
        wrong: (i) => n(i.age) >= 21 && n(i.age) <= 60 && n(i.monthly_income) > 25000 && n(i.credit_score) > 750,
        message: "An applicant with exactly ₹25,000 income or a score of exactly 750 was rejected. “At least” and “or higher” include the boundary: use >=.",
      },
    ],
    concepts: ["and", "boundaries", "comparison", "multi_vars"],
    introduces: [],
  }),

  level({
    id: "express-delivery",
    title: "Express Delivery",
    difficulty: "medium",
    system: { name: "Delivery Planner", icon: "🚚", request: "Order" },
    scenario: "An online store offers free express delivery to reward its best customers and its biggest orders.",
    task: "Give an order express delivery if the customer is a Plus member or the order total is more than ₹2,000. Every other order gets standard delivery.",
    rules: ["Exactly ₹2,000 is not more than ₹2,000"],
    given: { is_plus_member: "True if the customer pays for Plus membership", order_total: "the order total in ₹" },
    output: {
      name: "delivery",
      kind: "choice",
      outcomes: [
        { value: "express", icon: "⚡", label: "Next-day express", tone: "good" },
        { value: "standard", icon: "📦", label: "Standard (5 days)", tone: "info" },
      ],
    },
    visible: [
      { inputs: { is_plus_member: true, order_total: 450 }, note: "A Plus member buys a phone case" },
      { inputs: { is_plus_member: false, order_total: 3200 }, note: "A big order from a regular customer" },
      { inputs: { is_plus_member: false, order_total: 900 } },
    ],
    hidden: [
      { is_plus_member: true, order_total: 3200 },
      { is_plus_member: false, order_total: 2000 },
      { is_plus_member: false, order_total: 2001 },
      { is_plus_member: true, order_total: 0 },
      { is_plus_member: false, order_total: 0 },
      { is_plus_member: true, order_total: 2000 },
      { is_plus_member: false, order_total: 1999 },
    ],
    solve: (i) => (b(i.is_plus_member) || n(i.order_total) > 2000 ? "express" : "standard"),
    explain: (i) =>
      i.is_plus_member
        ? "the customer is a Plus member, and that is enough on its own"
        : n(i.order_total) > 2000
          ? `${rs(n(i.order_total))} is more than ${rs(2000)}, and that is enough on its own`
          : `not a Plus member, and ${rs(n(i.order_total))} is not more than ${rs(2000)}`,
    success:
      "or is True when at least one side is True. As soon as is_plus_member is True, Python skips the total check, because the answer can't change any more. Only when both sides are False does the order go standard.",
    hints: [
      "Does the order need both reasons, or is one reason enough?",
      "Python's word for “at least one of these is True” is or.",
      "Be careful with “more than ₹2,000”: is 2000 itself included?",
    ],
    pitfalls: [
      {
        tag: "and-instead-of-or",
        concept: "or",
        wrong: (i) => (b(i.is_plus_member) && n(i.order_total) > 2000 ? "express" : "standard"),
        message: "Your code only gives express delivery to Plus members with orders over ₹2,000. The rule says either reason is enough on its own. That's or, not and.",
      },
      {
        tag: "gte-instead-of-gt",
        concept: "boundaries",
        wrong: (i) => (b(i.is_plus_member) || n(i.order_total) >= 2000 ? "express" : "standard"),
        message: "An order of exactly ₹2,000 got express delivery. The rule says more than ₹2,000, so use >.",
      },
      {
        tag: "member-only",
        concept: "or",
        wrong: (i) => (b(i.is_plus_member) ? "express" : "standard"),
        message: "Your code ignores the order total, so a regular customer with a ₹3,200 order got standard delivery. The big-order reason counts too.",
      },
    ],
    concepts: ["or", "boundaries", "else"],
    introduces: ["or"],
  }),

  level({
    id: "login-guard",
    title: "Login Guard",
    difficulty: "medium",
    system: { name: "Login Service", icon: "🧑‍💻", request: "Login attempt" },
    scenario:
      "The password has already been checked and is correct. But the security team wrote the policy as a list of reasons to BLOCK a login, and your service has to decide whether to let the user in.",
    task: "Block the login if the account is suspended or the password has expired. Otherwise allow it. login_ok must be True only when the login is allowed.",
    rules: [],
    given: { suspended: "True if the account is suspended", password_expired: "True if the password is too old and must be changed" },
    output: { name: "login_ok", kind: "bool", outcomes: allowDeny(["✅", "Logged in"], ["🔒", "Login blocked"]) },
    visible: [
      { inputs: { suspended: false, password_expired: false } },
      { inputs: { suspended: true, password_expired: false }, note: "A suspended account" },
      { inputs: { suspended: false, password_expired: true }, note: "The password is 400 days old" },
    ],
    hidden: grid({ suspended: [true, false], password_expired: [true, false] }),
    solve: (i) => !(b(i.suspended) || b(i.password_expired)),
    explain: (i) =>
      i.suspended && i.password_expired
        ? "the account is suspended and the password has expired"
        : i.suspended
          ? "the account is suspended"
          : i.password_expired
            ? "the password has expired"
            : "no blocking reason applies",
    success:
      "The policy describes when to block, but login_ok means “allowed”, so you needed the opposite. not flips True and False. not (suspended or password_expired) and not suspended and not password_expired mean the same thing. This is De Morgan's law, and getting it wrong causes real security bugs.",
    hints: [
      "First write down when the login is blocked. Then ask: login_ok is the opposite of what?",
      "not turns True into False and False into True. You can put not in front of a whole bracket, like not (a or b).",
      "Careful: the opposite of “A or B” is not “not A or not B”. Try all four True/False combinations on paper.",
    ],
    pitfalls: [
      {
        tag: "de-morgan",
        concept: "not",
        wrong: (i) => !b(i.suspended) || !b(i.password_expired),
        message:
          "Your code allows the login when only one problem is present. not suspended or not password_expired is True unless both problems happen at once. The opposite of “A or B” is “not A and not B”, or simply not (A or B).",
      },
      {
        tag: "inverted",
        concept: "not",
        wrong: (i) => b(i.suspended) || b(i.password_expired),
        message:
          "Your code lets exactly the wrong people in: it allows the login when there IS a problem. The policy lists reasons to block, and login_ok is the opposite of that, so you need not.",
      },
      {
        tag: "one-reason-only",
        concept: "not",
        wrong: (i) => !b(i.suspended),
        message: "Your code only checks suspended, so a user with an expired password got in. Both reasons block the login.",
      },
    ],
    concepts: ["not", "or", "and"],
    introduces: ["not"],
  }),

  level({
    id: "checkout-coupon",
    title: "Checkout",
    difficulty: "medium",
    system: { name: "Checkout Service", icon: "🛒", request: "Checkout" },
    scenario:
      "When a shopper presses Pay, the checkout service gets the number of items in the cart and whatever the shopper typed into the coupon box. Many shoppers leave the box empty.",
    task: "Decide what checkout does next using the rules below, in this order.",
    rules: ["An empty coupon box gives coupon_code = \"\" (empty text)", "cart_items can be 0"],
    table: {
      title: "Checkout rules (in this order)",
      rows: [
        ["1. the cart has no items", "\"empty_cart\""],
        ["2. a coupon code was typed", "\"apply_coupon\""],
        ["3. otherwise", "\"pay\""],
      ],
    },
    given: { cart_items: "number of items in the cart", coupon_code: "the text typed in the coupon box (\"\" if empty)" },
    output: {
      name: "next_step",
      kind: "choice",
      outcomes: [
        { value: "pay", icon: "💳", label: "Go to payment", tone: "good" },
        { value: "apply_coupon", icon: "🏷️", label: "Check the coupon", tone: "info" },
        { value: "empty_cart", icon: "🗑️", label: "“Your cart is empty”", tone: "warn" },
      ],
    },
    visible: [
      { inputs: { cart_items: 3, coupon_code: "" } },
      { inputs: { cart_items: 2, coupon_code: "SAVE10" } },
      { inputs: { cart_items: 0, coupon_code: "" }, note: "Someone presses Pay with nothing in the cart" },
    ],
    hidden: [
      { cart_items: 0, coupon_code: "SAVE10" },
      { cart_items: 1, coupon_code: "" },
      { cart_items: 1, coupon_code: "FESTIVE" },
      { cart_items: 0, coupon_code: "WELCOME" },
      { cart_items: 12, coupon_code: "" },
      { cart_items: 5, coupon_code: "X" },
    ],
    solve: (i) => (n(i.cart_items) === 0 ? "empty_cart" : s(i.coupon_code) !== "" ? "apply_coupon" : "pay"),
    explain: (i) =>
      n(i.cart_items) === 0
        ? "the cart has 0 items, and rule 1 beats everything"
        : i.coupon_code !== ""
          ? `the shopper typed "${i.coupon_code}"`
          : "the cart has items and the coupon box is empty",
    success:
      "In a Python condition, empty values count as False: 0, \"\" (empty text), empty lists and None. Everything else counts as True. So if coupon_code: means “if something was typed”, and if not cart_items: (or cart_items == 0) catches an empty cart. Values used like this are called truthy and falsy.",
    hints: [
      "What does an empty coupon box look like as a value? And an empty cart?",
      "You can compare with == 0 and != \"\". Or use the value directly: Python treats 0 and \"\" as False inside a condition.",
      "Check the empty cart first, because it beats everything else.",
    ],
    pitfalls: [
      {
        tag: "coupon-before-cart",
        concept: "ordering",
        wrong: (i) => (s(i.coupon_code) !== "" ? "apply_coupon" : n(i.cart_items) === 0 ? "empty_cart" : "pay"),
        message: "A shopper with an empty cart and a coupon code was sent to apply the coupon. Rule 1 comes first: with nothing in the cart there is nothing to discount.",
      },
      {
        tag: "empty-coupon-counted",
        concept: "truthy",
        wrong: (i) => (n(i.cart_items) === 0 ? "empty_cart" : "apply_coupon"),
        message: "Your code tries to apply a coupon even when the box is empty. An empty box is \"\", and it must count as “no coupon”. Check coupon_code != \"\", or just if coupon_code:.",
      },
    ],
    concepts: ["truthy", "edge_cases", "strings", "elif", "not"],
    introduces: ["truthy", "edge_cases"],
  }),

  /* =========================== COMBINING LOGIC =========================== */
  level({
    id: "api-gateway",
    title: "API Gateway",
    difficulty: "medium",
    system: { name: "API Gateway", icon: "🛡️", request: "DELETE /users" },
    scenario:
      "Your company's API gateway guards the endpoint that deletes user accounts. Normally only admins may call it, but a support engineer can be given a temporary override ticket.",
    task: "Allow the request if the caller is authenticated and is either an admin or holds an override ticket.",
    rules: ["role is \"admin\", \"support\" or \"viewer\"", "Authentication is always required, even with an override"],
    given: { authenticated: "True if the request carries a valid login token", role: "\"admin\", \"support\" or \"viewer\"", has_override: "True if the caller holds an override ticket" },
    output: { name: "allow", kind: "bool", outcomes: allowDeny(["✅", "200 OK"], ["⛔", "403 Denied"]) },
    visible: [
      { inputs: { authenticated: true, role: "admin", has_override: false } },
      { inputs: { authenticated: true, role: "support", has_override: true }, note: "Support engineer with an override" },
      { inputs: { authenticated: false, role: "support", has_override: true }, note: "Override ticket, but no valid token" },
      { inputs: { authenticated: true, role: "viewer", has_override: false } },
    ],
    hidden: grid({ authenticated: [true, false], role: ["admin", "support", "viewer"], has_override: [true, false] }),
    solve: (i) => b(i.authenticated) && (i.role === "admin" || b(i.has_override)),
    explain: (i) =>
      !i.authenticated
        ? "the caller is not authenticated, and that is always required"
        : i.role === "admin"
          ? "the caller is authenticated and is an admin"
          : i.has_override
            ? "the caller is authenticated and holds an override ticket"
            : `the caller is authenticated, but "${i.role}" has no override ticket`,
    success:
      "Python evaluates and before or, just like * before + in maths. The brackets make authentication apply to both ways in: A and (B or C). Without them, A and B or C lets C through on its own.",
    hints: [
      "Split the rule into the part that is always required and the part that has alternatives.",
      "The alternatives (admin, or override) belong together as one group. How do you group things in Python?",
      "Python works out and before or. Try your code on paper with authenticated = False and has_override = True.",
    ],
    pitfalls: [
      {
        tag: "missing-parentheses",
        concept: "parentheses",
        wrong: (i) => (b(i.authenticated) && i.role === "admin") || b(i.has_override),
        message:
          "Your code let an unauthenticated caller through because they had an override ticket. Python reads A and B or C as (A and B) or C, because and binds tighter than or. Put brackets around the alternatives: authenticated and (role == \"admin\" or has_override).",
      },
      {
        tag: "and-instead-of-or",
        concept: "or",
        wrong: (i) => b(i.authenticated) && i.role === "admin" && b(i.has_override),
        message: "Your code demands both the admin role and an override ticket. Either one is enough, as long as the caller is authenticated.",
      },
      {
        tag: "no-auth-check",
        concept: "and",
        wrong: (i) => i.role === "admin" || b(i.has_override),
        message: "Your code never checks authenticated, so unauthenticated callers get in. Authentication is required in every case.",
      },
    ],
    concepts: ["and", "or", "combined", "parentheses", "equality"],
    introduces: ["combined", "parentheses"],
  }),

  level({
    id: "file-access",
    title: "File Access",
    difficulty: "hard",
    system: { name: "Cloud Drive", icon: "📁", request: "Download request" },
    scenario:
      "A cloud storage service receives a request to download a private file. First it must know who the user is. Only then does it make sense to ask whether that user may open this file.",
    task:
      "Not logged in: send the user to log in, whatever else is true. Logged in: allow the download if they own the file, or if the file was shared with them and the share link has not expired. Otherwise refuse.",
    rules: [],
    given: {
      logged_in: "True if the user is logged in",
      is_owner: "True if the user owns the file",
      shared_with_user: "True if the owner shared the file with this user",
      link_expired: "True if the share link has expired",
    },
    output: {
      name: "response",
      kind: "choice",
      outcomes: [
        { value: "download", icon: "⬇️", label: "File sent", tone: "good" },
        { value: "login", icon: "🔑", label: "Redirect to login", tone: "warn" },
        { value: "forbidden", icon: "⛔", label: "403 Forbidden", tone: "bad" },
      ],
    },
    visible: [
      { inputs: { logged_in: true, is_owner: true, shared_with_user: false, link_expired: false } },
      { inputs: { logged_in: false, is_owner: true, shared_with_user: false, link_expired: false }, note: "The owner, but their session timed out" },
      { inputs: { logged_in: true, is_owner: false, shared_with_user: true, link_expired: false } },
      { inputs: { logged_in: true, is_owner: false, shared_with_user: true, link_expired: true }, note: "An old share link" },
    ],
    hidden: grid({ logged_in: [true, false], is_owner: [true, false], shared_with_user: [true, false], link_expired: [true, false] }),
    solve: (i) => (!i.logged_in ? "login" : i.is_owner || (i.shared_with_user && !i.link_expired) ? "download" : "forbidden"),
    explain: (i) =>
      !i.logged_in
        ? "the user is not logged in, so we don't know who they are yet"
        : i.is_owner
          ? "the user is logged in and owns the file"
          : i.shared_with_user && !i.link_expired
            ? "the file was shared with the user and the link is still valid"
            : i.shared_with_user
              ? "the file was shared, but the link has expired"
              : "the user doesn't own the file and it wasn't shared with them",
    success:
      "The permission questions only make sense once the user is known, so they sit inside the logged-in branch. A nested if shows that dependency in the shape of the code. The same logic can be written flat (if not logged_in: … elif is_owner or (shared_with_user and not link_expired): … else: …), but nesting makes “only then ask” visible.",
    hints: [
      "Which question must be answered before any other question makes sense?",
      "You can put an if inside another if: indent it 4 more spaces. The inner if only runs when the outer condition is True.",
      "Inside the logged-in branch there are two ways to be allowed. One of them has two parts.",
    ],
    pitfalls: [
      {
        tag: "permission-before-login",
        concept: "nested",
        wrong: (i) => (i.is_owner || (i.shared_with_user && !i.link_expired) ? "download" : !i.logged_in ? "login" : "forbidden"),
        message:
          "A user who was not logged in got the file. Until the user logs in, the service can't know who they are, so the ownership check means nothing yet. Check logged_in first, and put the permission checks inside that branch or after it.",
      },
      {
        tag: "ignored-expiry",
        concept: "and",
        wrong: (i) => (!i.logged_in ? "login" : i.is_owner || i.shared_with_user ? "download" : "forbidden"),
        message: "Your code allowed a download through an expired share link. Sharing only counts when the link has not expired: shared_with_user and not link_expired.",
      },
      {
        tag: "no-login-branch",
        concept: "nested",
        wrong: (i) => (i.logged_in && (i.is_owner || (i.shared_with_user && !i.link_expired)) ? "download" : "forbidden"),
        message:
          "Logged-out users got \"forbidden\" instead of being sent to log in. These are different answers: \"login\" means “we don't know who you are”, and \"forbidden\" means “we know, and the answer is no”.",
      },
    ],
    concepts: ["nested", "and", "or", "not", "elif", "multi_vars"],
    introduces: ["nested"],
  }),

  level({
    id: "discount-tiers",
    title: "Discount Tiers",
    difficulty: "hard",
    system: { name: "Promotions Engine", icon: "🏷️", request: "Cart" },
    scenario: "Marketing emailed the discount rules for the festive sale, smallest discount first. The promotions engine must attach exactly one coupon to each cart.",
    task: "Attach the correct coupon. When several rules match, the biggest discount wins, but accounts flagged for fraud never get a discount.",
    rules: [],
    table: {
      title: "Rules, as marketing wrote them",
      rows: [
        ["cart total ₹1,000 or more", "\"SAVE5\""],
        ["cart total ₹5,000 or more", "\"SAVE15\""],
        ["cart total ₹10,000 or more", "\"SAVE25\""],
        ["account flagged for fraud", "\"NONE\" (overrides every rule)"],
        ["everyone else", "\"NONE\""],
      ],
    },
    given: { cart_total: "the cart total in ₹", flagged: "True if the fraud team flagged this account" },
    output: {
      name: "coupon",
      kind: "choice",
      outcomes: [
        { value: "SAVE25", icon: "🎁", label: "25% off", tone: "good" },
        { value: "SAVE15", icon: "🏷️", label: "15% off", tone: "good" },
        { value: "SAVE5", icon: "🔖", label: "5% off", tone: "info" },
        { value: "NONE", icon: "➖", label: "No discount", tone: "bad" },
      ],
    },
    visible: [
      { inputs: { cart_total: 1500, flagged: false } },
      { inputs: { cart_total: 12000, flagged: false }, note: "A new laptop" },
      { inputs: { cart_total: 7000, flagged: true }, note: "A flagged account" },
    ],
    hidden: [
      { cart_total: 999, flagged: false },
      { cart_total: 1000, flagged: false },
      { cart_total: 4999, flagged: false },
      { cart_total: 5000, flagged: false },
      { cart_total: 9999, flagged: false },
      { cart_total: 10000, flagged: false },
      { cart_total: 0, flagged: false },
      { cart_total: 25000, flagged: true },
      { cart_total: 1000, flagged: true },
      { cart_total: 6000, flagged: false },
    ],
    solve: (i) => (i.flagged ? "NONE" : n(i.cart_total) >= 10000 ? "SAVE25" : n(i.cart_total) >= 5000 ? "SAVE15" : n(i.cart_total) >= 1000 ? "SAVE5" : "NONE"),
    explain: (i) => {
      const t = n(i.cart_total);
      if (i.flagged) return "the account is flagged, and that overrides every discount";
      if (t >= 10000) return `${rs(t)} matches all three rules and SAVE25 is the biggest`;
      if (t >= 5000) return `${rs(t)} matches SAVE5 and SAVE15, and SAVE15 is bigger`;
      if (t >= 1000) return `${rs(t)} only matches SAVE5`;
      return `${rs(t)} is below ${rs(1000)}`;
    },
    success:
      "The order of an if / elif chain is part of the logic. The first True branch wins, so the exception (fraud) goes first, and narrow ranges (₹10,000+) go before broad ones (₹1,000+). Separate if statements don't stop at the first match, so a later one can overwrite an earlier answer.",
    hints: [
      "A ₹12,000 cart matches three discount rules. Which one should win, and how will Python choose?",
      "With if / elif, Python runs only the first branch whose condition is True. So which check must come first?",
      "The fraud rule overrides everything. Separate if statements all run one after another, so a later one can overwrite coupon.",
    ],
    pitfalls: [
      {
        tag: "broad-condition-first",
        concept: "ordering",
        wrong: (i) => (i.flagged ? "NONE" : n(i.cart_total) >= 1000 ? "SAVE5" : "NONE"),
        message:
          "Your code checks the rules in the order marketing wrote them. A ₹12,000 cart matches “₹1,000 or more” first, and elif stops there, so it gets SAVE5. A broad rule captured a case meant for a narrower one. Check the biggest discount (the narrowest range) first.",
      },
      {
        tag: "exception-overwritten",
        concept: "mutual_exclusion",
        wrong: (i) => (n(i.cart_total) >= 10000 ? "SAVE25" : n(i.cart_total) >= 5000 ? "SAVE15" : n(i.cart_total) >= 1000 ? "SAVE5" : "NONE"),
        message:
          "Flagged accounts still got a discount. Either the fraud check comes after the discount checks in your elif chain, or your checks are separate ifs and a later one overwrote \"NONE\". The fraud rule overrides everything, so check it first in one if / elif chain.",
      },
    ],
    concepts: ["ordering", "mutual_exclusion", "elif", "boundaries"],
    introduces: [],
  }),

  /* ========================= REAL-WORLD SYSTEMS ========================= */
  level({
    id: "deploy-gate",
    title: "Deployment Gate",
    difficulty: "hard",
    system: { name: "CI/CD Pipeline", icon: "🚀", request: "Deploy request" },
    scenario: "A developer asks the pipeline to deploy their build. The pipeline must protect production without slowing down testing on staging.",
    task: "Set deploy to True only if the deployment policy allows it.",
    rules: ["environment is normally \"staging\" or \"production\", but anything can arrive", "branch is the Git branch name, like \"main\" or \"feature-login\""],
    table: {
      title: "Deployment policy",
      rows: [
        ["\"staging\"", "allowed when the tests passed"],
        ["\"production\"", "allowed only from the \"main\" branch, with tests passed and at least 2 approvals"],
        ["any other environment", "never deployed: unknown targets are rejected"],
      ],
    },
    given: {
      environment: "where to deploy",
      branch: "the Git branch being deployed",
      tests_passed: "True if the test suite passed",
      approvals: "how many reviewers approved the change",
    },
    output: { name: "deploy", kind: "bool", outcomes: allowDeny(["🚀", "Deployed"], ["🛑", "Blocked"]) },
    visible: [
      { inputs: { environment: "staging", branch: "feature-login", tests_passed: true, approvals: 0 } },
      { inputs: { environment: "production", branch: "main", tests_passed: true, approvals: 2 } },
      { inputs: { environment: "production", branch: "main", tests_passed: true, approvals: 1 } },
      { inputs: { environment: "production", branch: "hotfix", tests_passed: true, approvals: 3 }, note: "A hotfix straight to production" },
    ],
    hidden: [
      { environment: "staging", branch: "main", tests_passed: false, approvals: 5 },
      { environment: "staging", branch: "dev", tests_passed: true, approvals: 0 },
      { environment: "production", branch: "main", tests_passed: false, approvals: 4 },
      { environment: "production", branch: "main", tests_passed: true, approvals: 3 },
      { environment: "production", branch: "feature-x", tests_passed: false, approvals: 0 },
      { environment: "qa", branch: "main", tests_passed: true, approvals: 5 },
      { environment: "prod", branch: "main", tests_passed: true, approvals: 2 },
      { environment: "production", branch: "main", tests_passed: true, approvals: 0 },
      { environment: "staging", branch: "hotfix", tests_passed: false, approvals: 0 },
    ],
    solve: (i) =>
      i.environment === "staging"
        ? b(i.tests_passed)
        : i.environment === "production"
          ? i.branch === "main" && b(i.tests_passed) && n(i.approvals) >= 2
          : false,
    explain: (i) => {
      if (i.environment === "staging") return i.tests_passed ? "staging only needs passing tests" : "the tests failed";
      if (i.environment !== "production") return `"${i.environment}" is not an environment the policy knows`;
      const why: string[] = [];
      if (i.branch !== "main") why.push(`the branch is "${i.branch}", not "main"`);
      if (!i.tests_passed) why.push("the tests failed");
      if (n(i.approvals) < 2) why.push(`${i.approvals} approval${i.approvals === 1 ? "" : "s"} is fewer than 2`);
      return why.length ? `for production, ${why.join(" and ")}` : "production from main, tests passed, and at least 2 approvals";
    },
    success:
      "Each environment has its own rule, so the environment is checked first and then the right rule is applied. Unknown environments like \"qa\" fall into a safe default (False) instead of being treated like staging. Good systems fail safe when they see input nobody expected.",
    hints: [
      "The rule depends on the environment first. How many environment cases are there, counting “anything else”?",
      "For production, list every requirement. Are they joined with and, or with or?",
      "What should happen when environment is \"qa\"? Make sure your code doesn't treat every non-production value as staging.",
    ],
    pitfalls: [
      {
        tag: "gt-instead-of-gte",
        concept: "boundaries",
        wrong: (i) =>
          i.environment === "staging" ? b(i.tests_passed) : i.environment === "production" && i.branch === "main" && b(i.tests_passed) && n(i.approvals) > 2,
        message: "A production deploy with exactly 2 approvals was blocked. “At least 2” includes 2, so use >= 2.",
      },
      {
        tag: "unsafe-default",
        concept: "edge_cases",
        wrong: (i) => (i.environment === "production" ? i.branch === "main" && b(i.tests_passed) && n(i.approvals) >= 2 : b(i.tests_passed)),
        message:
          "Your code deployed to an environment the policy doesn't know (like \"qa\" or \"prod\"). Treating “not production” as staging is a trap. Unexpected values should fall into a safe final else that blocks.",
      },
      {
        tag: "missing-branch-check",
        concept: "and",
        wrong: (i) => (i.environment === "staging" ? b(i.tests_passed) : i.environment === "production" && b(i.tests_passed) && n(i.approvals) >= 2),
        message: "Your code deployed a non-main branch to production. Production only accepts \"main\".",
      },
      {
        tag: "main-everywhere",
        concept: "decision_tree",
        wrong: (i) =>
          i.environment === "staging"
            ? b(i.tests_passed) && i.branch === "main"
            : i.environment === "production" && i.branch === "main" && b(i.tests_passed) && n(i.approvals) >= 2,
        message: "Your code blocked a staging deploy from a feature branch. Only production requires \"main\"; staging just needs passing tests.",
      },
    ],
    concepts: ["decision_tree", "strings", "and", "elif", "edge_cases", "boundaries", "multi_vars"],
    introduces: ["decision_tree"],
    hideConcepts: true,
  }),

  level({
    id: "warehouse-dispatch",
    title: "Warehouse Dispatch",
    difficulty: "hard",
    system: { name: "Warehouse Dispatch", icon: "📦", request: "Parcel" },
    scenario: "Parcels reach the dispatch desk with a scanned weight and a destination. The system picks the shipping method, and it must reject bad scanner data before anything else.",
    task: "Choose the shipping method using the dispatch rules.",
    rules: ["destination is \"domestic\" or \"international\"", "weight_kg can be a decimal, like 12.5"],
    table: {
      title: "Dispatch rules (most important first)",
      rows: [
        ["weight is 0 or less (a scanner error)", "\"reject\""],
        ["international destination", "\"air\""],
        ["heavier than 30 kg", "\"freight\""],
        ["fragile and heavier than 10 kg", "\"freight\""],
        ["anything else", "\"courier\""],
      ],
    },
    given: { weight_kg: "scanned weight in kg", destination: "\"domestic\" or \"international\"", fragile: "True if the parcel is marked fragile" },
    output: {
      name: "method",
      kind: "choice",
      outcomes: [
        { value: "courier", icon: "🛵", label: "Courier van", tone: "good" },
        { value: "freight", icon: "🚛", label: "Freight truck", tone: "info" },
        { value: "air", icon: "✈️", label: "Air cargo", tone: "info" },
        { value: "reject", icon: "❌", label: "Re-scan parcel", tone: "bad" },
      ],
    },
    visible: [
      { inputs: { weight_kg: 2.5, destination: "domestic", fragile: false } },
      { inputs: { weight_kg: 45, destination: "domestic", fragile: false } },
      { inputs: { weight_kg: 12, destination: "domestic", fragile: true }, note: "A box of glassware" },
      { inputs: { weight_kg: 5, destination: "international", fragile: true } },
      { inputs: { weight_kg: 0, destination: "domestic", fragile: false }, note: "The scale glitched" },
    ],
    hidden: [
      { weight_kg: 30, destination: "domestic", fragile: false },
      { weight_kg: 30.5, destination: "domestic", fragile: false },
      { weight_kg: 10, destination: "domestic", fragile: true },
      { weight_kg: 10.5, destination: "domestic", fragile: true },
      { weight_kg: -3, destination: "international", fragile: false },
      { weight_kg: 0, destination: "international", fragile: true },
      { weight_kg: 50, destination: "international", fragile: false },
      { weight_kg: 8, destination: "domestic", fragile: true },
      { weight_kg: 11, destination: "domestic", fragile: false },
    ],
    solve: (i) => {
      const w = n(i.weight_kg);
      if (w <= 0) return "reject";
      if (i.destination === "international") return "air";
      if (w > 30 || (i.fragile && w > 10)) return "freight";
      return "courier";
    },
    explain: (i) => {
      const w = n(i.weight_kg);
      if (w <= 0) return `a weight of ${w} kg is impossible, so the scan is rejected before any other rule`;
      if (i.destination === "international") return "it's going abroad";
      if (w > 30) return `${w} kg is heavier than 30 kg`;
      if (i.fragile && w > 10) return `it's fragile and ${w} kg is heavier than 10 kg`;
      if (i.fragile) return `it's fragile, but ${w} kg is not heavier than 10 kg`;
      return `${w} kg is a normal domestic parcel`;
    },
    success:
      "Validation first, then the most specific routes. weight_kg <= 0 catches zero and negative readings before they reach any other rule. The fragile rule needs two facts at once (and), and both weight rules use >, because parcels of exactly 30 kg or 10 kg can still go by courier.",
    hints: [
      "What should happen to a parcel with an impossible weight, before anything else?",
      "Two different rules lead to \"freight\". You can join them with or in one elif, or use two elifs.",
      "Check the boundaries: 0, 10 and 30. Which rule does each of them belong to?",
    ],
    pitfalls: [
      {
        tag: "validation-late",
        concept: "ordering",
        wrong: (i) => {
          const w = n(i.weight_kg);
          if (i.destination === "international") return "air";
          if (w <= 0) return "reject";
          if (w > 30 || (i.fragile && w > 10)) return "freight";
          return "courier";
        },
        message: "A parcel with a weight of 0 or less was sent by air. Invalid data must be rejected before any other rule runs, or bad scanner readings get shipped.",
      },
      {
        tag: "zero-not-rejected",
        concept: "edge_cases",
        wrong: (i) => {
          const w = n(i.weight_kg);
          if (w < 0) return "reject";
          if (i.destination === "international") return "air";
          if (w > 30 || (i.fragile && w > 10)) return "freight";
          return "courier";
        },
        message: "A parcel weighing exactly 0 kg was not rejected. “0 or less” includes 0, so use <= 0.",
      },
      {
        tag: "or-instead-of-and",
        concept: "and",
        wrong: (i) => {
          const w = n(i.weight_kg);
          if (w <= 0) return "reject";
          if (i.destination === "international") return "air";
          if (w > 30 || i.fragile || w > 10) return "freight";
          return "courier";
        },
        message: "Your code sends every fragile parcel, or every parcel over 10 kg, by freight. That rule needs both at once: fragile and heavier than 10 kg.",
      },
      {
        tag: "gte-instead-of-gt",
        concept: "boundaries",
        wrong: (i) => {
          const w = n(i.weight_kg);
          if (w <= 0) return "reject";
          if (i.destination === "international") return "air";
          if (w >= 30 || (i.fragile && w >= 10)) return "freight";
          return "courier";
        },
        message: "A parcel of exactly 30 kg (or a fragile one of exactly 10 kg) went by freight. Only parcels heavier than those limits do, so use >.",
      },
    ],
    concepts: ["edge_cases", "boundaries", "ordering", "and", "or", "decision_tree"],
    introduces: [],
    hideConcepts: true,
  }),

  level({
    id: "firewall",
    title: "Firewall Rules",
    difficulty: "hard",
    system: { name: "Network Firewall", icon: "🧱", request: "Incoming connection" },
    scenario: "A firewall inspects every incoming connection. It knows where the connection comes from, which port it wants, and whether the source IP is on the blocklist.",
    task: "Decide what the firewall does with each connection.",
    rules: ["source is \"internal\" or \"external\"", "port is a whole number, like 80, 443 or 22"],
    table: {
      title: "Firewall policy (top rule wins)",
      rows: [
        ["source IP is on the blocklist", "\"drop\""],
        ["from the internal network", "\"allow\" (any port)"],
        ["from outside, to port 80 or 443 (web)", "\"allow\""],
        ["from outside, to port 22 (SSH)", "\"alert\""],
        ["anything else", "\"drop\""],
      ],
    },
    given: { source: "\"internal\" or \"external\"", port: "the port the connection wants", blocklisted: "True if the source IP is on the blocklist" },
    output: {
      name: "action",
      kind: "choice",
      outcomes: [
        { value: "allow", icon: "✅", label: "Connection allowed", tone: "good" },
        { value: "alert", icon: "🚨", label: "Drop and alert security", tone: "warn" },
        { value: "drop", icon: "🗑️", label: "Dropped silently", tone: "bad" },
      ],
    },
    visible: [
      { inputs: { source: "external", port: 443, blocklisted: false }, note: "Someone opens the website" },
      { inputs: { source: "external", port: 22, blocklisted: false }, note: "SSH from the internet" },
      { inputs: { source: "internal", port: 22, blocklisted: false } },
      { inputs: { source: "external", port: 3306, blocklisted: false }, note: "Someone probes the database port" },
    ],
    hidden: [
      { source: "internal", port: 3306, blocklisted: true },
      { source: "external", port: 80, blocklisted: false },
      { source: "external", port: 443, blocklisted: true },
      { source: "external", port: 8080, blocklisted: false },
      { source: "internal", port: 8080, blocklisted: false },
      { source: "external", port: 22, blocklisted: true },
      { source: "external", port: 0, blocklisted: false },
      { source: "internal", port: 443, blocklisted: false },
    ],
    solve: (i) =>
      i.blocklisted ? "drop" : i.source === "internal" ? "allow" : i.port === 80 || i.port === 443 ? "allow" : i.port === 22 ? "alert" : "drop",
    explain: (i) =>
      i.blocklisted
        ? "the source IP is blocklisted, and that beats every other rule"
        : i.source === "internal"
          ? "internal traffic is allowed on any port"
          : i.port === 80 || i.port === 443
            ? `port ${i.port} is a web port`
            : i.port === 22
              ? "external SSH attempts must alert the security team"
              : `port ${i.port} is not open to the outside`,
    success:
      "The blocklist sits on top because it overrides everything. Each port comparison needs its own port ==, as in port == 80 or port == 443. A bare or 443 would always be True, because non-zero numbers are truthy. port in [80, 443] is a neat alternative.",
    hints: [
      "Which rule overrides all the others?",
      "Two ports are allowed from outside. How do you check that a number is one of two values?",
      "Careful with port == 80 or 443: or joins two whole conditions. What does Python think 443 on its own means?",
    ],
    pitfalls: [
      {
        tag: "or-with-bare-value",
        concept: "truthy",
        wrong: (i) => (i.blocklisted ? "drop" : "allow"),
        message:
          "Your code allowed outside traffic to ports that aren't 80 or 443. port == 80 or 443 doesn't mean what it looks like. Python reads it as (port == 80) or 443, and 443 on its own is truthy, so it is always True. Write port == 80 or port == 443 (or port in [80, 443]).",
      },
      {
        tag: "blocklist-not-first",
        concept: "ordering",
        wrong: (i) =>
          i.source === "internal" ? "allow" : i.blocklisted ? "drop" : i.port === 80 || i.port === 443 ? "allow" : i.port === 22 ? "alert" : "drop",
        message: "A blocklisted IP got through because it came from the internal network. The blocklist is the top rule and beats everything, even internal traffic.",
      },
      {
        tag: "missed-alert",
        concept: "decision_tree",
        wrong: (i) => (i.blocklisted ? "drop" : i.source === "internal" || i.port === 80 || i.port === 443 ? "allow" : "drop"),
        message: "External SSH attempts were dropped silently. The policy wants \"alert\" for port 22, so the security team hears about them.",
      },
    ],
    concepts: ["or", "truthy", "equality", "ordering", "strings", "decision_tree"],
    introduces: [],
    hideConcepts: true,
  }),

  /* ============================== BOSS ============================== */
  level({
    id: "payment-auth",
    title: "Payment Authorization",
    difficulty: "expert",
    boss: true,
    system: { name: "Card Authorization Engine", icon: "🏧", request: "Card transaction" },
    scenario:
      "You're writing the core of a card payment processor. Each transaction arrives with the card's state, the customer's balance and what they have already spent today. Your code decides what happens to it in milliseconds.",
    task: "Decide every transaction according to the bank's policy.",
    rules: ["card_status is \"active\", \"blocked\" or \"expired\""],
    table: {
      title: "Bank policy",
      rows: [
        ["Card", "only \"active\" cards can pay, otherwise \"declined\""],
        ["Amount", "must be more than 0, otherwise \"declined\""],
        ["Funds", "the amount may not be more than the balance, otherwise \"declined\""],
        ["Daily limit", "spent_today + amount must be ₹100,000 or less, otherwise \"declined\""],
        ["International", "an international payment over ₹50,000 goes to \"review\" (a person checks it)"],
        ["OTP", "a payment of ₹10,000 or more needs otp_verified, otherwise \"otp_required\""],
        ["Priority", "\"declined\" beats \"review\", and \"review\" beats \"otp_required\". If nothing stops it: \"approved\""],
      ],
    },
    given: {
      card_status: "\"active\", \"blocked\" or \"expired\"",
      amount: "the payment amount in ₹",
      balance: "money in the account, in ₹",
      spent_today: "what the card has already spent today, in ₹",
      international: "True if the merchant is abroad",
      otp_verified: "True if the customer entered the one-time password",
    },
    output: {
      name: "decision",
      kind: "choice",
      outcomes: [
        { value: "approved", icon: "✅", label: "Payment approved", tone: "good" },
        { value: "otp_required", icon: "📲", label: "Ask for OTP", tone: "warn" },
        { value: "review", icon: "🕵️", label: "Hold for review", tone: "warn" },
        { value: "declined", icon: "⛔", label: "Declined", tone: "bad" },
      ],
    },
    visible: [
      { inputs: { card_status: "active", amount: 2500, balance: 40000, spent_today: 0, international: false, otp_verified: false }, note: "Groceries" },
      { inputs: { card_status: "expired", amount: 500, balance: 40000, spent_today: 0, international: false, otp_verified: false } },
      { inputs: { card_status: "active", amount: 15000, balance: 40000, spent_today: 0, international: false, otp_verified: false }, note: "A new phone" },
      { inputs: { card_status: "active", amount: 60000, balance: 90000, spent_today: 0, international: true, otp_verified: true }, note: "A flight booked abroad" },
      { inputs: { card_status: "active", amount: 5000, balance: 3000, spent_today: 0, international: false, otp_verified: false } },
    ],
    hidden: [
      { card_status: "active", amount: 0, balance: 1000, spent_today: 0, international: false, otp_verified: false },
      { card_status: "active", amount: -100, balance: 1000, spent_today: 0, international: false, otp_verified: false },
      { card_status: "active", amount: 10000, balance: 10000, spent_today: 0, international: false, otp_verified: true },
      { card_status: "active", amount: 10000, balance: 50000, spent_today: 0, international: false, otp_verified: false },
      { card_status: "active", amount: 9999, balance: 50000, spent_today: 0, international: false, otp_verified: false },
      { card_status: "active", amount: 50000, balance: 200000, spent_today: 0, international: true, otp_verified: false },
      { card_status: "active", amount: 50001, balance: 200000, spent_today: 0, international: true, otp_verified: false },
      { card_status: "active", amount: 30000, balance: 200000, spent_today: 70000, international: false, otp_verified: true },
      { card_status: "active", amount: 30001, balance: 200000, spent_today: 70000, international: false, otp_verified: true },
      { card_status: "blocked", amount: 60000, balance: 200000, spent_today: 0, international: true, otp_verified: true },
      { card_status: "active", amount: 80000, balance: 60000, spent_today: 0, international: true, otp_verified: true },
      { card_status: "active", amount: 60000, balance: 200000, spent_today: 50000, international: true, otp_verified: true },
      { card_status: "active", amount: 60000, balance: 200000, spent_today: 0, international: false, otp_verified: false },
      { card_status: "expired", amount: 0, balance: 0, spent_today: 0, international: false, otp_verified: false },
    ],
    solve: (i) => payment(i),
    explain: (i) => {
      const a = n(i.amount);
      if (i.card_status !== "active") return `the card is "${i.card_status}"`;
      if (a <= 0) return `an amount of ${rs(a)} is not more than 0`;
      if (a > n(i.balance)) return `${rs(a)} is more than the ${rs(n(i.balance))} balance`;
      const total = n(i.spent_today) + a;
      if (total > 100000) return `today's total would be ${rs(total)}, over the ${rs(100000)} limit`;
      if (i.international && a > 50000) return `an international payment of ${rs(a)} is over ${rs(50000)}`;
      if (a >= 10000 && !i.otp_verified) return `${rs(a)} is ${rs(10000)} or more and the OTP was not entered`;
      if (a >= 10000) return "every check passes and the OTP was entered";
      return "every check passes";
    },
    success:
      "You built a real decision engine. The decline rules come first because they beat everything, then review, then OTP, then approval. The boundaries are exact (> 0, <= balance, <= 100000, > 50000, >= 10000), and the text check card_status != \"active\" also blocks statuses nobody listed. That's the reasoning behind every production rule system.",
    hints: [
      "Sort the policy into three groups: reasons to decline, reasons to hold, and approval.",
      "Which outcomes must be checked first so that nothing lower down can override them?",
      "Walk through the edge cases yourself: an amount of 0, exactly ₹10,000, exactly ₹50,000, and a daily total of exactly ₹100,000.",
    ],
    pitfalls: [
      {
        tag: "otp-before-review",
        concept: "ordering",
        wrong: (i) => payment(i, { otpBeforeReview: true }),
        message: "An international payment over ₹50,000 without an OTP came back \"otp_required\". The policy says \"review\" beats \"otp_required\", so the review check must come first.",
      },
      {
        tag: "review-before-decline",
        concept: "ordering",
        wrong: (i) => payment(i, { reviewBeforeDecline: true }),
        message: "A transaction that should be declined was sent to review. Every decline rule beats review, so all the decline checks must come before it.",
      },
      { tag: "zero-amount", concept: "edge_cases", wrong: (i) => payment(i, { zeroOk: true }), message: "A payment of ₹0 got through. The amount must be more than 0, so 0 is declined too." },
      {
        tag: "daily-limit-strict",
        concept: "boundaries",
        wrong: (i) => payment(i, { dailyStrict: true }),
        message: "A payment that brought today's total to exactly ₹100,000 was declined. The limit is “₹100,000 or less”.",
      },
      {
        tag: "review-at-limit",
        concept: "boundaries",
        wrong: (i) => payment(i, { reviewAtLimit: true }),
        message: "An international payment of exactly ₹50,000 was sent to review. Only payments over ₹50,000 are.",
      },
      {
        tag: "otp-strict",
        concept: "boundaries",
        wrong: (i) => payment(i, { otpStrict: true }),
        message: "A ₹10,000 payment went through without an OTP. The OTP is needed from ₹10,000 upwards, including 10,000.",
      },
      {
        tag: "funds-strict",
        concept: "boundaries",
        wrong: (i) => payment(i, { fundsStrict: true }),
        message: "A payment of exactly the balance was declined. Spending your whole balance is allowed; only more than the balance is not.",
      },
      {
        tag: "listed-one-bad-status",
        concept: "equality",
        wrong: (i) => payment(i, { blockedOnly: true }),
        message: "An \"expired\" card could still pay. Only \"active\" cards may pay, so check card_status != \"active\".",
      },
    ],
    concepts: ["decision_tree", "elif", "and", "or", "not", "boundaries", "edge_cases", "ordering", "strings", "multi_vars", "nested"],
    introduces: [],
    hideConcepts: true,
  }),
];

export const COND_TRACKS = [
  {
    id: "foundations",
    title: "Foundations",
    blurb: "One decision, then two outcomes, then many.",
    emoji: "🧱",
    ids: ["age-gate", "payment-limit", "grade-report"],
  },
  {
    id: "facts",
    title: "Comparisons & Facts",
    blurb: "Exact boundaries, text values and several variables.",
    emoji: "⚖️",
    ids: ["cpu-alert", "train-booking"],
  },
  {
    id: "boolean",
    title: "Boolean Logic",
    blurb: "and, or, not, and values that act like True or False.",
    emoji: "🧠",
    ids: ["admin-dashboard", "loan-eligibility", "express-delivery", "login-guard", "checkout-coupon"],
  },
  {
    id: "combining",
    title: "Combining Logic",
    blurb: "Grouping, nesting and the order of rules.",
    emoji: "🔗",
    ids: ["api-gateway", "file-access", "discount-tiers"],
  },
  {
    id: "real",
    title: "Real-World Systems",
    blurb: "Full rule sets. No hints about which Python to use.",
    emoji: "🌐",
    ids: ["deploy-gate", "warehouse-dispatch", "firewall"],
  },
  { id: "boss", title: "Boss Level", blurb: "Everything at once, in a payment engine.", emoji: "🏆", ids: ["payment-auth"] },
];

export function condIndex(id: string) {
  return COND_LEVELS.findIndex((l) => l.id === id);
}

/** visible cases first, then hidden ones */
export function allCases(level: CondLevel): Case[] {
  return [...level.visible, ...level.hidden.map((inputs) => ({ inputs }))];
}

export function outcomeOf(level: CondLevel, v: Value): Outcome | undefined {
  return level.output.outcomes.find((o) => o.value === v);
}

/** Python spelling of a value */
export function py(v: Value): string {
  return typeof v === "boolean" ? (v ? "True" : "False") : typeof v === "string" ? `"${v}"` : String(v);
}

/* ------------------------------------------------------------------ */
/* Judging one case                                                    */
/* ------------------------------------------------------------------ */

export type Verdict = {
  ok: boolean;
  kind: "correct" | "error" | "missing" | "type" | "wrong";
  expected: Value;
  got: Value | null; // null = not set / unusable
  title: string;
  message: string;
};

const show = (v: Val) => repr(v, true);

/** true when an if/elif check ran but none of the branches did */
const skippedIf = (res: RunResult) =>
  res.events.some((e) => e.kind === "branch" && !e.taken) && !res.events.some((e) => e.kind === "branch" && e.taken);

export function toInputs(i: Inputs): Record<string, Val> {
  return Object.fromEntries(Object.entries(i).map(([k, v]) => [k, typeof v === "number" && !Number.isInteger(v) ? new PyFloat(v) : v]));
}

export function judgeCase(level: CondLevel, inputs: Inputs, res: RunResult): Verdict {
  const expected = level.solve(inputs);
  const name = level.output.name;
  const why = level.explain(inputs);
  const label = (v: Value) => {
    const o = outcomeOf(level, v);
    return o ? `${name} = ${py(v)} (${o.icon} ${o.label})` : `${name} = ${py(v)}`;
  };

  if (res.error) {
    return { ok: false, kind: "error", expected, got: null, title: res.runaway ? "Your code never finishes" : "Check your code", message: res.error.message };
  }

  if (!Object.prototype.hasOwnProperty.call(res.vars, name)) {
    return {
      ok: false,
      kind: "missing",
      expected,
      got: null,
      title: "No decision made",
      message: skippedIf(res)
        ? `Your if was False here, so the lines inside it did not run, and ${name} never got a value. The system can't act without a decision. Make sure every situation sets ${name}, for example with an else.`
        : `Your code never gave ${name} a value here, so the system couldn't act. ${name} needs a value in every situation.`,
    };
  }
  const v = res.vars[name];

  if (level.output.kind === "bool") {
    if (typeof v !== "boolean") {
      const hint =
        typeof v === "string" && /^(true|false)$/i.test(v)
          ? " Write True or False without quotes. With quotes it is text, not a True/False value."
          : " Use True or False.";
      return { ok: false, kind: "type", expected, got: null, title: `${name} must be True or False`, message: `Your code set ${name} = ${show(v)}.${hint}` };
    }
  } else {
    const choices = level.output.outcomes.map((o) => String(o.value));
    const list = choices.map((c) => `"${c}"`).join(", ");
    if (typeof v !== "string") {
      const bare = typeof v === "number" || v instanceof PyFloat || typeof v === "boolean" ? "" : ` Did you forget the quotes, like "${choices[0]}"?`;
      return { ok: false, kind: "type", expected, got: null, title: `${name} must be text`, message: `Your code set ${name} = ${show(v)}. It must be one of ${list}.${bare}` };
    }
    if (!choices.includes(v)) {
      const close = choices.find((c) => c.toLowerCase() === v.trim().toLowerCase());
      return {
        ok: false,
        kind: "type",
        expected,
        got: null,
        title: "Unknown value",
        message: close
          ? `Your code set ${name} = ${show(v)}. Python text is exact about capitals and spaces. Use "${close}".`
          : `Your code set ${name} = ${show(v)}, but the only choices are ${list}.`,
      };
    }
  }

  const got = v as Value;
  if (got === expected) return { ok: true, kind: "correct", expected, got, title: "Right call", message: why };

  const gotO = outcomeOf(level, got);
  const expO = outcomeOf(level, expected);
  const title =
    gotO?.tone === "good" && expO?.tone !== "good" ? "Let through by mistake" : expO?.tone === "good" && gotO?.tone !== "good" ? "Blocked by mistake" : "Wrong decision";
  return {
    ok: false,
    kind: "wrong",
    expected,
    got,
    title,
    message: `Your code chose ${label(got)}, but the right answer was ${label(expected)}, because ${why}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Diagnosing a failed run                                             */
/* ------------------------------------------------------------------ */

export type Diagnosis = { tag: string; concept?: Concept; message: string };

/**
 * Looks at the student's answers over EVERY case. If they match a known
 * wrong solution exactly, explain that mistake. Also spots code that gives
 * the same answer every time.
 */
export function diagnose(level: CondLevel, cases: Case[], verdicts: Verdict[]): Diagnosis | null {
  if (verdicts.length !== cases.length || verdicts.every((v) => v.ok)) return null;
  const first = verdicts.find((v) => !v.ok)!;
  if (first.kind === "error") return null;
  if (first.kind === "missing") return { tag: "missing-else", concept: "else", message: "" };
  if (first.kind === "type") return { tag: "wrong-type", message: "" };
  if (verdicts.some((v) => v.got === null)) return null;

  const got = verdicts.map((v) => v.got as Value);
  for (const p of level.pitfalls) {
    if (cases.every((c, k) => p.wrong(c.inputs) === got[k])) return { tag: p.tag, concept: p.concept, message: p.message };
  }
  const distinct = new Set(cases.map((c) => level.solve(c.inputs)));
  if (distinct.size > 1 && got.every((g) => g === got[0])) {
    const names = Object.keys(level.given).join(", ");
    return {
      tag: "constant-answer",
      concept: "if",
      message: `Your code gives the same answer, ${level.output.name} = ${py(got[0])}, in every test. The decision has to depend on the values (${names}), so it needs conditions that look at them.`,
    };
  }
  return null;
}
