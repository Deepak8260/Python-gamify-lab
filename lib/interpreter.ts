/*
 * A tiny, friendly Python interpreter for Loop Lab.
 *
 * It supports the part of Python a beginner needs for loops:
 *   for / while / if / elif / else / break / continue / pass
 *   variables, = += -= *= /=, arithmetic, comparisons, and / or / not
 *   print(), range(), abs(), int(), float(), str(), len(), min(), max(), round()
 *
 * The student's code is run for real. Every print() call becomes an
 * execution event, and the game animates those events one by one.
 */

export class PyFloat {
  constructor(public v: number) {}
}

type RangeVal = { kind: "range"; start: number; stop: number; step: number };
type ListVal = { kind: "list"; items: Val[] };
export type Val = number | string | boolean | null | PyFloat | RangeVal | ListVal;

export class PyError extends Error {
  constructor(message: string, public line: number) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

type Tok =
  | { type: "num"; value: Val; line: number }
  | { type: "str"; value: string; line: number }
  | { type: "name"; value: string; line: number }
  | { type: "op"; value: string; line: number }
  | { type: "newline" | "indent" | "dedent" | "eof"; value: string; line: number };

const OPS = [
  "**=", "//=", "**", "//", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=",
  "(", ")", "[", "]", ":", ",", "+", "-", "*", "/", "%", "<", ">", "=", ".",
];

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const indents = [0];

  lines.forEach((raw, idx) => {
    const line = idx + 1;
    let indent = 0;
    let p = 0;
    while (p < raw.length && (raw[p] === " " || raw[p] === "\t")) {
      indent += raw[p] === "\t" ? 4 : 1;
      p++;
    }
    const rest = raw.slice(p);
    if (rest.trim() === "" || rest.trimStart().startsWith("#")) return;

    if (indent > indents[indents.length - 1]) {
      indents.push(indent);
      toks.push({ type: "indent", value: "", line });
    } else {
      while (indent < indents[indents.length - 1]) {
        indents.pop();
        toks.push({ type: "dedent", value: "", line });
      }
      if (indent !== indents[indents.length - 1]) {
        throw new PyError(
          `The spaces at the start of line ${line} don't line up with the lines above. Use 4 spaces for each level.`,
          line,
        );
      }
    }

    let i = p;
    while (i < raw.length) {
      const c = raw[i];
      if (c === " " || c === "\t") { i++; continue; }
      if (c === "#") break;

      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(raw[i + 1] ?? ""))) {
        let j = i;
        while (j < raw.length && /[0-9_]/.test(raw[j])) j++;
        let isFloat = false;
        if (raw[j] === "." && /[0-9]/.test(raw[j + 1] ?? "")) {
          isFloat = true;
          j++;
          while (j < raw.length && /[0-9_]/.test(raw[j])) j++;
        } else if (raw[j] === "." && !/[a-zA-Z_]/.test(raw[j + 1] ?? "")) {
          isFloat = true;
          j++;
        }
        const text = raw.slice(i, j).replace(/_/g, "");
        const n = Number(text);
        toks.push({ type: "num", value: isFloat ? new PyFloat(n) : n, line });
        i = j;
        continue;
      }

      if (/[a-zA-Z_]/.test(c)) {
        let j = i;
        while (j < raw.length && /[a-zA-Z0-9_]/.test(raw[j])) j++;
        toks.push({ type: "name", value: raw.slice(i, j), line });
        i = j;
        continue;
      }

      if (c === '"' || c === "'") {
        let j = i + 1;
        let s = "";
        while (j < raw.length && raw[j] !== c) {
          if (raw[j] === "\\" && j + 1 < raw.length) {
            const e = raw[j + 1];
            s += e === "n" ? "\n" : e === "t" ? "\t" : e;
            j += 2;
          } else {
            s += raw[j++];
          }
        }
        if (j >= raw.length) {
          throw new PyError(`The text on line ${line} is missing its closing ${c} quote.`, line);
        }
        toks.push({ type: "str", value: s, line });
        i = j + 1;
        continue;
      }

      const op = OPS.find((o) => raw.startsWith(o, i));
      if (op) {
        toks.push({ type: "op", value: op, line });
        i += op.length;
        continue;
      }
      throw new PyError(`Python doesn't understand the character "${c}" on line ${line}.`, line);
    }
    toks.push({ type: "newline", value: "", line });
  });

  const last = lines.length;
  while (indents.length > 1) {
    indents.pop();
    toks.push({ type: "dedent", value: "", line: last });
  }
  toks.push({ type: "eof", value: "", line: last });
  return toks;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

type Expr =
  | { t: "lit"; v: Val }
  | { t: "name"; name: string; line: number }
  | { t: "bin"; op: string; l: Expr; r: Expr; line: number }
  | { t: "un"; op: string; e: Expr; line: number }
  | { t: "not"; e: Expr }
  | { t: "bool"; op: "and" | "or"; l: Expr; r: Expr }
  | { t: "cmp"; ops: string[]; items: Expr[]; line: number }
  | { t: "call"; fn: string; args: Expr[]; kwargs: Record<string, Expr>; line: number }
  | { t: "list"; items: Expr[] }
  | { t: "index"; target: Expr; index: Expr; line: number };

type Stmt =
  | { t: "for"; line: number; name: string; iter: Expr; body: Stmt[] }
  | { t: "while"; line: number; cond: Expr; condText: string; body: Stmt[] }
  | { t: "if"; line: number; branches: { cond: Expr; body: Stmt[] }[]; orelse: Stmt[] | null }
  | { t: "assign"; line: number; name: string; op: string; value: Expr }
  | { t: "expr"; line: number; e: Expr }
  | { t: "pass" | "break" | "continue"; line: number };

const KEYWORDS = new Set([
  "for", "in", "while", "if", "elif", "else", "and", "or", "not", "pass",
  "break", "continue", "True", "False", "None", "def", "return", "import",
]);

class Parser {
  i = 0;
  loopDepth = 0;
  constructor(private toks: Tok[], private lines: string[] = []) {}

  peek(o = 0) { return this.toks[this.i + o]; }
  next() { return this.toks[this.i++]; }
  isOp(v: string, o = 0) { const t = this.peek(o); return t.type === "op" && t.value === v; }
  isName(v: string, o = 0) { const t = this.peek(o); return t.type === "name" && t.value === v; }

  expectOp(v: string, msg: string) {
    const t = this.peek();
    if (!(t.type === "op" && t.value === v)) throw new PyError(msg, t.line);
    return this.next();
  }

  program(): Stmt[] {
    const out: Stmt[] = [];
    while (this.peek().type !== "eof") {
      const t = this.peek();
      if (t.type === "indent") {
        throw new PyError(
          `Line ${t.line} has extra spaces at the start. Only lines inside a loop or if should be indented.`,
          t.line,
        );
      }
      if (t.type === "dedent" || t.type === "newline") { this.next(); continue; }
      out.push(this.statement());
    }
    return out;
  }

  block(kind: string, headerLine: number): Stmt[] {
    if (this.peek().type !== "newline") {
      // one-line form:  for i in range(5): print(i)
      const s = this.simple();
      this.endOfLine();
      return [s];
    }
    this.next();
    const t = this.peek();
    if (t.type !== "indent") {
      const where = t.type === "eof" ? `after line ${headerLine}` : `on line ${t.line}`;
      throw new PyError(
        `The ${kind} on line ${headerLine} needs code inside it. Indent the next line with 4 spaces (${where}).`,
        t.type === "eof" ? headerLine : t.line,
      );
    }
    this.next();
    const body: Stmt[] = [];
    while (this.peek().type !== "dedent" && this.peek().type !== "eof") {
      if (this.peek().type === "indent") {
        const l = this.peek().line;
        throw new PyError(`Line ${l} is indented more than the line above it.`, l);
      }
      body.push(this.statement());
    }
    if (this.peek().type === "dedent") this.next();
    return body;
  }

  colon(kind: string, line: number) {
    if (!this.isOp(":")) {
      throw new PyError(`Line ${line} is missing a ":" at the end of the ${kind} line.`, line);
    }
    this.next();
  }

  statement(): Stmt {
    const t = this.peek();
    const line = t.line;

    if (t.type === "name" && t.value === "for") {
      this.next();
      const nameTok = this.next();
      if (nameTok.type !== "name" || KEYWORDS.has(nameTok.value)) {
        throw new PyError(`After "for" on line ${line}, write a variable name, like: for i in range(5):`, line);
      }
      if (!this.isName("in")) {
        throw new PyError(`Line ${line} needs the word "in", like: for ${nameTok.value} in range(5):`, line);
      }
      this.next();
      const iter = this.expr();
      this.colon("for", line);
      this.loopDepth++;
      const body = this.block("for loop", line);
      this.loopDepth--;
      return { t: "for", line, name: nameTok.value, iter, body };
    }

    if (t.type === "name" && t.value === "while") {
      this.next();
      const cond = this.expr();
      this.colon("while", line);
      this.loopDepth++;
      const body = this.block("while loop", line);
      this.loopDepth--;
      const src = this.lines[line - 1] ?? "";
      const m = /while\s+(.*?)\s*:/.exec(src);
      return { t: "while", line, cond, condText: m ? m[1] : "condition", body };
    }

    if (t.type === "name" && t.value === "if") {
      this.next();
      const branches: { cond: Expr; body: Stmt[] }[] = [];
      const cond = this.expr();
      this.colon("if", line);
      branches.push({ cond, body: this.block("if", line) });
      let orelse: Stmt[] | null = null;
      while (this.isName("elif")) {
        const l = this.next().line;
        const c = this.expr();
        this.colon("elif", l);
        branches.push({ cond: c, body: this.block("elif", l) });
      }
      if (this.isName("else")) {
        const l = this.next().line;
        this.colon("else", l);
        orelse = this.block("else", l);
      }
      return { t: "if", line, branches, orelse };
    }

    if (t.type === "name" && (t.value === "elif" || t.value === "else")) {
      throw new PyError(`"${t.value}" on line ${line} must come right after an if block, at the same indent.`, line);
    }

    const s = this.simple();
    this.endOfLine();
    return s;
  }

  endOfLine() {
    const t = this.peek();
    if (t.type === "newline") { this.next(); return; }
    if (t.type === "eof" || t.type === "dedent") return;
    if (t.type === "op" && t.value === ":") {
      throw new PyError(`Line ${t.line} has a ":" that doesn't belong there.`, t.line);
    }
    throw new PyError(`Python got confused on line ${t.line} near "${t.value}". Check the spelling and brackets.`, t.line);
  }

  simple(): Stmt {
    const t = this.peek();
    const line = t.line;
    if (t.type === "name" && t.value === "pass") { this.next(); return { t: "pass", line }; }
    if (t.type === "name" && (t.value === "break" || t.value === "continue")) {
      if (this.loopDepth === 0) throw new PyError(`"${t.value}" on line ${line} can only be used inside a loop.`, line);
      this.next();
      return { t: t.value as "break" | "continue", line };
    }
    if (t.type === "name" && (t.value === "def" || t.value === "import" || t.value === "return")) {
      throw new PyError(`"${t.value}" isn't needed for this game. Stick to loops and print().`, line);
    }

    // print i  (Python 2 style)
    if (t.type === "name" && t.value === "print" && !this.isOp("(", 1) && this.peek(1).type !== "newline") {
      throw new PyError(`print needs brackets on line ${line}. Write print(i) instead of print i.`, line);
    }

    if (t.type === "name" && !KEYWORDS.has(t.value)) {
      const n = this.peek(1);
      if (n.type === "op" && ["=", "+=", "-=", "*=", "/=", "//=", "%=", "**="].includes(n.value)) {
        this.next();
        this.next();
        const value = this.expr();
        return { t: "assign", line, name: t.value, op: n.value, value };
      }
    }
    const e = this.expr();
    return { t: "expr", line, e };
  }

  expr(): Expr { return this.orExpr(); }

  orExpr(): Expr {
    let l = this.andExpr();
    while (this.isName("or")) { this.next(); l = { t: "bool", op: "or", l, r: this.andExpr() }; }
    return l;
  }
  andExpr(): Expr {
    let l = this.notExpr();
    while (this.isName("and")) { this.next(); l = { t: "bool", op: "and", l, r: this.notExpr() }; }
    return l;
  }
  notExpr(): Expr {
    if (this.isName("not")) { this.next(); return { t: "not", e: this.notExpr() }; }
    return this.comparison();
  }
  comparison(): Expr {
    const first = this.arith();
    const ops: string[] = [];
    const items: Expr[] = [first];
    const line = this.peek().line;
    for (;;) {
      const t = this.peek();
      if (t.type === "op" && ["<", ">", "==", "!=", "<=", ">="].includes(t.value)) {
        this.next();
        ops.push(t.value);
        items.push(this.arith());
      } else if (t.type === "op" && t.value === "=" ) {
        throw new PyError(`Use == to compare things on line ${t.line} (a single = stores a value).`, t.line);
      } else if (this.isName("in") ) {
        this.next();
        ops.push("in");
        items.push(this.arith());
      } else if (this.isName("not") && this.isName("in", 1)) {
        this.next(); this.next();
        ops.push("not in");
        items.push(this.arith());
      } else break;
    }
    return ops.length ? { t: "cmp", ops, items, line } : first;
  }
  arith(): Expr {
    let l = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next();
      l = { t: "bin", op: op.value as string, l, r: this.term(), line: op.line };
    }
    return l;
  }
  term(): Expr {
    let l = this.unary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("//") || this.isOp("%")) {
      const op = this.next();
      l = { t: "bin", op: op.value as string, l, r: this.unary(), line: op.line };
    }
    return l;
  }
  unary(): Expr {
    if (this.isOp("-") || this.isOp("+")) {
      const op = this.next();
      return { t: "un", op: op.value as string, e: this.unary(), line: op.line };
    }
    return this.power();
  }
  power(): Expr {
    const base = this.postfix();
    if (this.isOp("**")) {
      const op = this.next();
      return { t: "bin", op: "**", l: base, r: this.unary(), line: op.line };
    }
    return base;
  }
  postfix(): Expr {
    let e = this.atom();
    for (;;) {
      if (this.isOp("[")) {
        const line = this.next().line;
        const index = this.expr();
        this.expectOp("]", `Line ${line} is missing a closing "]".`);
        e = { t: "index", target: e, index, line };
      } else if (this.isOp(".")) {
        const t = this.peek();
        throw new PyError(`Dots like "." aren't needed on line ${t.line}. Just use print() to move the robot.`, t.line);
      } else if (this.isOp("(")) {
        const t = this.peek();
        throw new PyError(`Line ${t.line} is trying to call something that isn't a function.`, t.line);
      } else break;
    }
    return e;
  }
  atom(): Expr {
    const t = this.next();
    if (t.type === "num") return { t: "lit", v: t.value };
    if (t.type === "str") return { t: "lit", v: t.value };
    if (t.type === "name") {
      if (t.value === "True") return { t: "lit", v: true };
      if (t.value === "False") return { t: "lit", v: false };
      if (t.value === "None") return { t: "lit", v: null };
      if (KEYWORDS.has(t.value)) {
        throw new PyError(`"${t.value}" can't be used there on line ${t.line}.`, t.line);
      }
      if (this.isOp("(")) {
        this.next();
        const args: Expr[] = [];
        const kwargs: Record<string, Expr> = {};
        while (!this.isOp(")")) {
          if (this.peek().type === "newline" || this.peek().type === "eof") {
            throw new PyError(`Line ${t.line} is missing a closing ")" bracket.`, t.line);
          }
          if (this.peek().type === "name" && this.isOp("=", 1)) {
            const k = this.next().value as string;
            this.next();
            kwargs[k] = this.expr();
          } else {
            args.push(this.expr());
          }
          if (this.isOp(",")) this.next();
          else if (!this.isOp(")")) {
            throw new PyError(`Line ${t.line} is missing a closing ")" bracket or a comma.`, t.line);
          }
        }
        this.next();
        return { t: "call", fn: t.value, args, kwargs, line: t.line };
      }
      return { t: "name", name: t.value, line: t.line };
    }
    if (t.type === "op" && t.value === "(") {
      const e = this.expr();
      this.expectOp(")", `Line ${t.line} is missing a closing ")" bracket.`);
      return e;
    }
    if (t.type === "op" && t.value === "[") {
      const items: Expr[] = [];
      while (!this.isOp("]")) {
        if (this.peek().type === "newline" || this.peek().type === "eof") {
          throw new PyError(`Line ${t.line} is missing a closing "]".`, t.line);
        }
        items.push(this.expr());
        if (this.isOp(",")) this.next();
        else if (!this.isOp("]")) throw new PyError(`Line ${t.line} is missing a comma or "]".`, t.line);
      }
      this.next();
      return { t: "list", items };
    }
    if (t.type === "newline" || t.type === "eof") {
      throw new PyError(`Line ${t.line} ended too early. Something is missing at the end.`, t.line);
    }
    if (t.type === "indent") {
      throw new PyError(`Line ${t.line} has extra spaces at the start.`, t.line);
    }
    throw new PyError(`Python got confused on line ${t.line} near "${t.value}".`, t.line);
  }
}

/* ------------------------------------------------------------------ */
/* Values                                                              */
/* ------------------------------------------------------------------ */

const isNum = (v: Val): v is number | PyFloat | boolean =>
  typeof v === "number" || v instanceof PyFloat || typeof v === "boolean";
const num = (v: number | PyFloat | boolean) =>
  v instanceof PyFloat ? v.v : typeof v === "boolean" ? (v ? 1 : 0) : v;
const isFloat = (v: Val) => v instanceof PyFloat;

function typeName(v: Val): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return "int";
  if (typeof v === "string") return "str";
  if (v instanceof PyFloat) return "float";
  return v.kind;
}

function fmtFloat(n: number): string {
  if (Number.isNaN(n)) return "nan";
  if (!Number.isFinite(n)) return n > 0 ? "inf" : "-inf";
  if (Number.isInteger(n)) return Math.abs(n) >= 1e16 ? String(n) : n.toFixed(1);
  return String(parseFloat(n.toPrecision(15)));
}

export function repr(v: Val, inner = false): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return inner ? `'${v}'` : v;
  if (v instanceof PyFloat) return fmtFloat(v.v);
  if (v.kind === "range") {
    return v.step === 1
      ? v.start === 0 ? `range(${v.stop})` : `range(${v.start}, ${v.stop})`
      : `range(${v.start}, ${v.stop}, ${v.step})`;
  }
  return `[${v.items.map((x) => repr(x, true)).join(", ")}]`;
}

function truthy(v: Val): boolean {
  if (v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (v instanceof PyFloat) return v.v !== 0;
  if (v.kind === "range") return rangeLen(v) > 0;
  return v.items.length > 0;
}

function rangeLen(r: RangeVal) {
  if (r.step > 0) return Math.max(0, Math.ceil((r.stop - r.start) / r.step));
  return Math.max(0, Math.ceil((r.start - r.stop) / -r.step));
}

function iterItems(v: Val, line: number): Val[] {
  if (typeof v === "string") return v.split("");
  if (v !== null && typeof v === "object" && !(v instanceof PyFloat)) {
    if (v.kind === "list") return v.items.slice();
    const n = rangeLen(v);
    if (n > 100000) throw new PyError(`That range on line ${line} is way too big for the robot!`, line);
    return Array.from({ length: n }, (_, k) => v.start + k * v.step);
  }
  throw new PyError(
    `A for loop needs something to count through, like range(5). A ${typeName(v)} can't be looped over (line ${line}).`,
    line,
  );
}

/* ------------------------------------------------------------------ */
/* Executor                                                            */
/* ------------------------------------------------------------------ */

export type LoopInfo = {
  line: number;
  varName: string;
  iteration: number; // 1-based
  total: number | null; // null for while loops
  values: Val[] | null;
};

export type PrintEvent = {
  kind: "print";
  line: number;
  text: string; // what print() wrote (without the end)
  end: string;
  value: number | null; // the number printed, if exactly one number was printed
  vars: Record<string, string>;
  loops: LoopInfo[];
};

/** A while loop checked its condition. */
export type CheckEvent = {
  kind: "check";
  line: number;
  cond: string;
  result: boolean;
  vars: Record<string, string>;
  loops: LoopInfo[];
};

export type ExecEvent = PrintEvent | CheckEvent;

export type RunResult = {
  events: ExecEvent[];
  error: PyError | null;
  usedFor: boolean;
  usedWhile: boolean;
  /** how many times print( appears in the source code */
  printCalls: number;
  /** the program ran too long (infinite loop or too many prints) */
  runaway: boolean;
};

class BreakSig {}
class ContinueSig {}

const MAX_STEPS = 20000;
const MAX_PRINTS = 60;
const MAX_EVENTS = 400;

class Machine {
  vars = new Map<string, Val>();
  events: ExecEvent[] = [];
  prints = 0;
  runaway = false;

  snapshot() {
    const vars: Record<string, string> = {};
    this.vars.forEach((v, k) => { vars[k] = repr(v, true); });
    return vars;
  }
  loops: LoopInfo[] = [];
  steps = 0;

  tick(line: number) {
    if (++this.steps > MAX_STEPS) {
      this.runaway = true;
      throw new PyError(
        `Your loop on line ${line} seems to run forever. Make sure it has a way to stop.`,
        line,
      );
    }
  }

  runBlock(body: Stmt[]) {
    for (const s of body) this.exec(s);
  }

  exec(s: Stmt) {
    this.tick(s.line);
    switch (s.t) {
      case "pass":
        return;
      case "break":
        throw new BreakSig();
      case "continue":
        throw new ContinueSig();
      case "expr":
        this.eval(s.e, true);
        return;
      case "assign": {
        const v = this.eval(s.value);
        if (s.op === "=") {
          this.vars.set(s.name, v);
        } else {
          if (!this.vars.has(s.name)) {
            throw new PyError(`"${s.name}" needs a starting value before line ${s.line} can change it.`, s.line);
          }
          const op = s.op.slice(0, -1);
          this.vars.set(s.name, this.binop(op, this.vars.get(s.name)!, v, s.line));
        }
        return;
      }
      case "if": {
        for (const b of s.branches) {
          if (truthy(this.eval(b.cond))) { this.runBlock(b.body); return; }
        }
        if (s.orelse) this.runBlock(s.orelse);
        return;
      }
      case "for": {
        const items = iterItems(this.eval(s.iter), s.line);
        const info: LoopInfo = {
          line: s.line,
          varName: s.name,
          iteration: 0,
          total: items.length,
          values: items.length <= 12 ? items : null,
        };
        this.loops.push(info);
        try {
          for (let k = 0; k < items.length; k++) {
            this.tick(s.line);
            info.iteration = k + 1;
            this.vars.set(s.name, items[k]);
            try {
              this.runBlock(s.body);
            } catch (e) {
              if (e instanceof BreakSig) break;
              if (e instanceof ContinueSig) continue;
              throw e;
            }
          }
        } finally {
          this.loops.pop();
        }
        return;
      }
      case "while": {
        const info: LoopInfo = { line: s.line, varName: "", iteration: 0, total: null, values: null };
        this.loops.push(info);
        try {
          for (;;) {
            const ok = truthy(this.eval(s.cond));
            if (this.events.length < MAX_EVENTS) {
              this.events.push({
                kind: "check",
                line: s.line,
                cond: s.condText,
                result: ok,
                vars: this.snapshot(),
                loops: this.loops.map((l) => ({ ...l })),
              });
            }
            if (!ok) break;
            this.tick(s.line);
            info.iteration++;
            try {
              this.runBlock(s.body);
            } catch (e) {
              if (e instanceof BreakSig) break;
              if (e instanceof ContinueSig) continue;
              throw e;
            }
          }
        } finally {
          this.loops.pop();
        }
        return;
      }
    }
  }

  eval(e: Expr, statement = false): Val {
    switch (e.t) {
      case "lit":
        return e.v;
      case "name": {
        if (this.vars.has(e.name)) return this.vars.get(e.name)!;
        if (e.name === "print" || e.name === "range") {
          throw new PyError(`${e.name} needs brackets on line ${e.line}, like ${e.name === "print" ? "print(i)" : "range(5)"}.`, e.line);
        }
        const lower = e.name.toLowerCase();
        if (lower === "print" || lower === "range") {
          throw new PyError(`"${e.name}" is not known. Python cares about capital letters. Did you mean ${lower}?`, e.line);
        }
        throw new PyError(`"${e.name}" is not defined on line ${e.line}. Did you spell the variable name right?`, e.line);
      }
      case "list":
        return { kind: "list", items: e.items.map((x) => this.eval(x)) };
      case "index": {
        const target = this.eval(e.target);
        const idx = this.eval(e.index);
        if (typeof idx !== "number" && typeof idx !== "boolean") {
          throw new PyError(`Positions inside [ ] must be whole numbers (line ${e.line}).`, e.line);
        }
        let items: Val[];
        if (typeof target === "string") items = target.split("");
        else if (target !== null && typeof target === "object" && !(target instanceof PyFloat)) items = iterItems(target, e.line);
        else throw new PyError(`You can't use [ ] on a ${typeName(target)} (line ${e.line}).`, e.line);
        let k = num(idx);
        if (k < 0) k += items.length;
        if (k < 0 || k >= items.length) throw new PyError(`Position ${num(idx)} is outside the list on line ${e.line}.`, e.line);
        return items[k];
      }
      case "un": {
        const v = this.eval(e.e);
        if (!isNum(v)) throw new PyError(`You can't put "${e.op}" in front of a ${typeName(v)} (line ${e.line}).`, e.line);
        const n = e.op === "-" ? -num(v) : num(v);
        return isFloat(v) ? new PyFloat(n) : n === 0 ? 0 : n;
      }
      case "not":
        return !truthy(this.eval(e.e));
      case "bool": {
        const l = this.eval(e.l);
        if (e.op === "and") return truthy(l) ? this.eval(e.r) : l;
        return truthy(l) ? l : this.eval(e.r);
      }
      case "bin":
        return this.binop(e.op, this.eval(e.l), this.eval(e.r), e.line);
      case "cmp": {
        let left = this.eval(e.items[0]);
        for (let k = 0; k < e.ops.length; k++) {
          const right = this.eval(e.items[k + 1]);
          if (!this.compare(e.ops[k], left, right, e.line)) return false;
          left = right;
        }
        return true;
      }
      case "call":
        return this.call(e, statement);
    }
  }

  compare(op: string, a: Val, b: Val, line: number): boolean {
    if (op === "in" || op === "not in") {
      let found: boolean;
      if (typeof b === "string" && typeof a === "string") found = b.includes(a);
      else found = iterItems(b, line).some((x) => this.equal(x, a));
      return op === "in" ? found : !found;
    }
    if (op === "==") return this.equal(a, b);
    if (op === "!=") return !this.equal(a, b);
    let x: number | string, y: number | string;
    if (isNum(a) && isNum(b)) { x = num(a); y = num(b); }
    else if (typeof a === "string" && typeof b === "string") { x = a; y = b; }
    else throw new PyError(`You can't compare a ${typeName(a)} with a ${typeName(b)} using ${op} (line ${line}).`, line);
    switch (op) {
      case "<": return x < y;
      case ">": return x > y;
      case "<=": return x <= y;
      default: return x >= y;
    }
  }

  equal(a: Val, b: Val): boolean {
    if (isNum(a) && isNum(b)) return num(a) === num(b);
    if (typeof a === "string" || typeof b === "string" || a === null || b === null) return a === b;
    return repr(a) === repr(b);
  }

  binop(op: string, a: Val, b: Val, line: number): Val {
    if (op === "+" && typeof a === "string" && typeof b === "string") return a + b;
    if (op === "+" && typeof a === "string" && isNum(b)) {
      throw new PyError(`You can't add text and a number on line ${line}. Try str() around the number, or use a comma in print().`, line);
    }
    if (op === "+" && isNum(a) && typeof b === "string") {
      throw new PyError(`You can't add a number and text on line ${line}.`, line);
    }
    if (op === "*" && typeof a === "string" && (typeof b === "number" || typeof b === "boolean")) return a.repeat(Math.max(0, num(b)));
    if (op === "*" && typeof b === "string" && (typeof a === "number" || typeof a === "boolean")) return b.repeat(Math.max(0, num(a)));
    if (!isNum(a) || !isNum(b)) {
      throw new PyError(`You can't use "${op}" with a ${typeName(a)} and a ${typeName(b)} (line ${line}).`, line);
    }
    const x = num(a), y = num(b);
    const f = isFloat(a) || isFloat(b);
    const wrap = (n: number) => (f ? new PyFloat(n) : n === 0 ? 0 : n);
    switch (op) {
      case "+": return wrap(x + y);
      case "-": return wrap(x - y);
      case "*": return wrap(x * y);
      case "/":
        if (y === 0) throw new PyError(`Line ${line} tries to divide by zero. That's impossible!`, line);
        return new PyFloat(x / y);
      case "//":
        if (y === 0) throw new PyError(`Line ${line} tries to divide by zero. That's impossible!`, line);
        return wrap(Math.floor(x / y));
      case "%":
        if (y === 0) throw new PyError(`Line ${line} tries to divide by zero. That's impossible!`, line);
        return wrap(((x % y) + y) % y);
      case "**": {
        if (!f && y < 0) return new PyFloat(x ** y);
        const r = x ** y;
        if (!f && Math.abs(r) > Number.MAX_SAFE_INTEGER) return new PyFloat(r);
        return wrap(r);
      }
    }
    throw new PyError(`Unknown operator ${op} on line ${line}.`, line);
  }

  call(e: Extract<Expr, { t: "call" }>, statement: boolean): Val {
    const line = e.line;
    const fn = e.fn;
    if (this.vars.has(fn)) throw new PyError(`"${fn}" is a variable, not a function (line ${line}).`, line);

    if (fn === "print") {
      const args = e.args.map((a) => this.eval(a));
      const sepV = e.kwargs.sep ? this.eval(e.kwargs.sep) : " ";
      const endV = e.kwargs.end ? this.eval(e.kwargs.end) : "\n";
      const sep = typeof sepV === "string" ? sepV : " ";
      const end = typeof endV === "string" ? endV : "\n";
      const text = args.map((a) => repr(a)).join(sep);
      let value: number | null = null;
      // The robot jumps to the number printed. print(i) and print("i =", i) both work.
      const nums = args.filter((a) => isNum(a) && typeof a !== "boolean") as (number | PyFloat)[];
      if (nums.length === 1) value = num(nums[0]);
      if (this.prints >= MAX_PRINTS) {
        this.runaway = true;
        throw new PyError(
          `Your code printed more than ${MAX_PRINTS} times. Does your loop ever stop?`,
          line,
        );
      }
      this.prints++;
      const vars = this.snapshot();
      this.events.push({
        kind: "print",
        line,
        text,
        end,
        value,
        vars,
        loops: this.loops.map((l) => ({ ...l })),
      });
      return null;
    }

    const args = e.args.map((a) => this.eval(a));
    const needInt = (v: Val, what: string): number => {
      if (typeof v === "number" || typeof v === "boolean") return num(v);
      throw new PyError(`${what} needs whole numbers, but got ${repr(v, true)} on line ${line}.`, line);
    };

    switch (fn) {
      case "range": {
        if (args.length < 1 || args.length > 3) {
          throw new PyError(`range() needs 1 to 3 numbers, like range(5), on line ${line}.`, line);
        }
        const n = args.map((a) => needInt(a, "range()"));
        const [start, stop, step] = n.length === 1 ? [0, n[0], 1] : [n[0], n[1], n[2] ?? 1];
        if (step === 0) throw new PyError(`The step in range() can't be 0 (line ${line}).`, line);
        return { kind: "range", start, stop, step };
      }
      case "abs":
        if (args.length !== 1 || !isNum(args[0])) throw new PyError(`abs() needs one number (line ${line}).`, line);
        return isFloat(args[0]) ? new PyFloat(Math.abs(num(args[0]))) : Math.abs(num(args[0]));
      case "int": {
        const v = args[0] ?? 0;
        if (isNum(v)) return Math.trunc(num(v));
        if (typeof v === "string" && /^\s*[-+]?\d+\s*$/.test(v)) return parseInt(v, 10);
        throw new PyError(`int() can't turn ${repr(v, true)} into a whole number (line ${line}).`, line);
      }
      case "float": {
        const v = args[0] ?? 0;
        if (isNum(v)) return new PyFloat(num(v));
        if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return new PyFloat(Number(v));
        throw new PyError(`float() can't turn ${repr(v, true)} into a number (line ${line}).`, line);
      }
      case "str":
        return args.length ? repr(args[0]) : "";
      case "len": {
        const v = args[0];
        if (typeof v === "string") return v.length;
        if (v !== null && typeof v === "object" && !(v instanceof PyFloat)) return iterItems(v, line).length;
        throw new PyError(`len() needs text, a list or a range (line ${line}).`, line);
      }
      case "min":
      case "max": {
        const items = args.length === 1 ? iterItems(args[0], line) : args;
        if (!items.length) throw new PyError(`${fn}() needs at least one value (line ${line}).`, line);
        return items.reduce((a, b) => (this.compare(fn === "min" ? "<" : ">", b, a, line) ? b : a));
      }
      case "round": {
        if (!isNum(args[0] ?? null)) throw new PyError(`round() needs a number (line ${line}).`, line);
        const x = num(args[0] as number);
        const r = Math.round(x);
        // Python rounds halves to the nearest even number
        const even = Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : r;
        return even;
      }
      case "input":
        throw new PyError(`input() isn't available in this game. Put the numbers straight into your code.`, line);
    }
    if (fn.toLowerCase() === "print" || fn.toLowerCase() === "range") {
      throw new PyError(`"${fn}" is not known. Python cares about capital letters. Did you mean ${fn.toLowerCase()}?`, line);
    }
    void statement;
    throw new PyError(`"${fn}()" isn't a function this game knows (line ${line}). Try print() and range().`, line);
  }
}

export function runPython(src: string): RunResult {
  const m = new Machine();
  let usedFor = false;
  let usedWhile = false;
  let printCalls = 0;
  const done = (error: PyError | null): RunResult => ({
    events: m.events,
    error,
    usedFor,
    usedWhile,
    printCalls,
    runaway: m.runaway,
  });
  try {
    const toks = tokenize(src);
    usedFor = toks.some((t) => t.type === "name" && t.value === "for");
    usedWhile = toks.some((t) => t.type === "name" && t.value === "while");
    printCalls = toks.filter((t, k) => t.type === "name" && t.value === "print" && toks[k + 1]?.type === "op" && toks[k + 1].value === "(").length;
    const lines = src.replace(/\r\n?/g, "\n").split("\n");
    const prog = new Parser(toks, lines).program();
    m.runBlock(prog);
    return done(null);
  } catch (e) {
    if (e instanceof PyError) return done(e);
    if (e instanceof BreakSig || e instanceof ContinueSig) return done(null);
    return done(new PyError("Something went wrong. Check your Python code and try again.", 1));
  }
}
