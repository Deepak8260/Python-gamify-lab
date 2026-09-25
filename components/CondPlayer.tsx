"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import confetti from "canvas-confetti";
import { Play, StepForward, RotateCcw, Lightbulb, ArrowRight, ChevronLeft } from "lucide-react";
import BridgeWorld, { END_X, ROUTE_Y, SINGLE_Y, START_X, type Decision, type HikerState, type RoundMark } from "./BridgeWorld";
import SoundToggle from "./SoundToggle";
import { runPython, type ExecEvent, type RunResult } from "@/lib/interpreter";
import { COND_LEVELS, condIndex, judgeRound, toInputs, type Inputs, type Verdict } from "@/lib/condLevels";
import { useProgress, XP_PER_LEVEL } from "@/lib/progress";
import { sfx } from "@/lib/sound";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading editor…</div>,
});

const LAB = "conditions";

type Phase = "idle" | "running" | "stepping" | "finished";
type Item =
  | { t: "round"; r: number }
  | { t: "event"; r: number; ev: ExecEvent }
  | { t: "outcome"; r: number; verdict: Verdict; res: RunResult };
type Result = {
  kind: "success" | "fail" | "error";
  title: string;
  message: string;
  situation?: string;
  passed?: number; // rounds passed before the one that failed
  emoji: string;
};
type Line = { text: string; kind: "round" | "print" | "assign" | "ok" | "bad" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmtVal = (v: boolean | number | string) => (typeof v === "boolean" ? (v ? "True" : "False") : typeof v === "string" ? `"${v}"` : String(v));
/** The story part of a round event, without the "name: old → new" details. */
const eventNote = (ev?: string) => {
  const note = ev?.replace(/[.,]?\s*\w+: [^.]*$/, "").trim();
  return note && /[a-z]/i.test(note) ? note : null;
};

/** What the hiker should do, in plain words (never the code that does it). */
const expectText = (v: boolean | string, journey: boolean) =>
  v === true ? (journey ? "🚶 walks on" : "🚶 crosses") : v === false || v === "wait" ? "✋ waits" : `🌉 takes Bridge ${v}`;

/** Wraps variable names, True/False and "text" in <code> so the question is easy to scan. */
function CodeText({ text, names }: { text: string; names: string[] }) {
  const re = new RegExp(`(\\b\\w+ = (?:True|False|"[^"]*")|\\b(?:${[...names, "True", "False"].join("|")})\\b|"[^"]*")`, "g");
  return (
    <>
      {text.split(re).map((part, k) => (k % 2 ? <code key={k}>{part}</code> : part))}
    </>
  );
}

const situation = (i: Inputs) => Object.entries(i).map(([k, v]) => `${k} = ${fmtVal(v)}`).join(",  ");

export default function CondPlayer({ levelId }: { levelId: string }) {
  const index = condIndex(levelId);
  const level = COND_LEVELS[index];
  const next = COND_LEVELS[index + 1];
  const router = useRouter();
  const { markDone, totalXp, done } = useProgress();
  const doneSet = done(LAB);
  const preview = level.preview ?? level.rounds[0].inputs;

  const starter = `# The game already set: ${Object.keys(level.given).join(", ")}\n# Don't type their values. Just use their names.\n# Now decide what the hiker should do.\n\n`;
  const codeKey = `codeplay-code-${LAB}-${level.id}`;
  const [code, setCodeState] = useState(starter);
  const codeRef = useRef(starter);
  const setCode = (v: string) => {
    codeRef.current = v;
    setCodeState(v);
  };

  const [phase, _setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    _setPhase(p);
  };

  const startY = level.scene === "bridge" ? SINGLE_Y : ROUTE_Y.B;
  const homeHiker = (): HikerState => ({ x: START_X, y: startY, facing: 1, mode: "idle", dur: 0, say: null });

  const [inputs, setInputs] = useState<Inputs>(preview);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [hiker, setHiker] = useState<HikerState>(homeHiker);
  const [broken, setBroken] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [marks, setMarks] = useState<RoundMark[]>(level.rounds.map(() => "pending"));
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hint, setHint] = useState(-1);
  const [stepNo, setStepNo] = useState(0);

  const speedRef = useRef(1);
  const tokenRef = useRef(0);
  const stepBusy = useRef(false);
  const shownInputs = useRef<Inputs>(preview);
  const prog = useRef<{ items: Item[]; idx: number; allOk: boolean; results: RunResult[] } | null>(null);
  const consoleEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(codeKey);
      if (saved && saved.trim()) setCode(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeKey]);

  useEffect(() => {
    consoleEnd.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);

  const resetWorld = (keepError = false) => {
    tokenRef.current++;
    stepBusy.current = false;
    prog.current = null;
    shownInputs.current = preview;
    setInputs(preview);
    setChanged(new Set());
    setHiker(homeHiker());
    setBroken(null);
    setPicked(null);
    setDecision(null);
    setMarks(level.rounds.map(() => "pending"));
    setBanner(null);
    setLines([]);
    setActiveLine(null);
    if (!keepError) setErrorLine(null);
    setResult(null);
    setShowCard(false);
    setStepNo(0);
    setPhase("idle");
  };

  const onCodeChange = (v: string) => {
    setCode(v);
    try {
      localStorage.setItem(codeKey, v);
    } catch {}
    if (errorLine) setErrorLine(null);
    if (phaseRef.current === "finished") resetWorld();
  };

  /** Run the code once per round, then build the timeline to animate. */
  const prepare = () => {
    resetWorld();
    const items: Item[] = [];
    const results: RunResult[] = [];
    let allOk = true;
    level.rounds.forEach((round, r) => {
      if (!allOk) return;
      const inp = toInputs(round.inputs);
      if (level.output.start !== undefined) inp[level.output.name] = level.output.start;
      const res = runPython(codeRef.current, inp);
      results.push(res);
      const verdict = judgeRound(level, round, res);
      items.push({ t: "round", r });
      res.events.slice(0, 40).forEach((ev) => items.push({ t: "event", r, ev }));
      items.push({ t: "outcome", r, verdict, res });
      if (!verdict.ok) allOk = false;
    });
    prog.current = { items, idx: 0, allOk, results };
  };

  const moveHiker = async (h: Partial<HikerState>, dur: number, token: number) => {
    setHiker((s) => ({ ...s, ...h, dur }));
    await sleep(dur);
    return tokenRef.current === token;
  };

  const play = async (item: Item, token: number): Promise<boolean> => {
    const sp = speedRef.current;

    if (item.t === "round") {
      const round = level.rounds[item.r];
      const prev = shownInputs.current;
      const ch = new Set(Object.keys(round.inputs).filter((k) => prev[k] !== round.inputs[k]));
      shownInputs.current = round.inputs;
      setMarks((m) => m.map((x, k) => (k === item.r ? "now" : x)));
      setHiker(level.journey && item.r > 0 ? (h) => ({ ...h, mode: "idle", say: null, dur: 0 }) : { ...homeHiker(), dur: 0 });
      setBroken(null);
      setPicked(null);
      setDecision(null);
      setActiveLine(null);
      setInputs(round.inputs);
      setChanged(ch);
      if (level.rounds.length > 1) setLines((l) => [...l, { text: `Test ${item.r + 1}: ${situation(round.inputs)}`, kind: "round" }]);
      const many = level.rounds.length > 1;
      const tag = many ? `Test ${item.r + 1} of ${level.rounds.length}` : "";
      if (round.event || many) {
        setBanner({ text: [tag, round.event].filter(Boolean).join(" · "), key: Date.now() });
        sfx.pop();
        await sleep(round.event ? Math.max(1100, 1800 / sp) : Math.max(800, 1100 / sp));
        setBanner(null);
      } else {
        await sleep(350 / sp);
      }
      return tokenRef.current === token;
    }

    if (item.t === "event") {
      const ev = item.ev;
      setActiveLine(ev.line);
      if (ev.kind === "branch") {
        setDecision({ keyword: ev.keyword, trace: ev.trace, taken: ev.taken, key: Date.now() });
        sfx.land();
        await sleep((ev.keyword === "else" ? 800 : 1500) / sp);
      } else if (ev.kind === "assign") {
        setLines((l) => [...l, { text: `${ev.name} = ${ev.value}`, kind: "assign" }]);
        if (ev.name === level.output.name) {
          const say =
            level.output.name === "cross" ? (ev.value === "True" ? "Let's go! 👍" : ev.value === "False" ? "I'll wait ✋" : "?") : `route ${ev.value}`;
          setHiker((h) => ({ ...h, say }));
        }
        await sleep(650 / sp);
      } else if (ev.kind === "print") {
        setLines((l) => [...l, { text: ev.text, kind: "print" }]);
        await sleep(400 / sp);
      } else {
        await sleep(250 / sp);
      }
      return tokenRef.current === token;
    }

    // outcome: the hiker acts on the decision
    const { verdict } = item;
    setActiveLine(null);
    const good = verdict.ok;
    const mark = () => setMarks((m) => m.map((x, k) => (k === item.r ? (good ? "ok" : "bad") : x)));

    if (verdict.kind === "error" || verdict.kind === "missing" || verdict.kind === "type") {
      setHiker((h) => ({ ...h, mode: "confused", say: "🤔 ?" }));
      sfx.fail();
      await sleep(900 / sp);
      mark();
      return false;
    }

    const got = verdict.got;
    const walk = 1500 / sp;
    if (level.scene === "bridge") {
      const target = level.journey?.[item.r] ?? END_X;
      if (got === true) {
        setHiker((h) => ({ ...h, say: null }));
        if (good && target < 50) {
          // walk on to the next stop, which is before the middle of the bridge
          if (!(await moveHiker({ x: target, y: SINGLE_Y + 4, mode: "walk" }, walk, token))) return false;
          setHiker((h) => ({ ...h, mode: "nod", say: "✓" }));
          sfx.land();
        } else if (!(await moveHiker({ x: 50, y: SINGLE_Y + 5, mode: "walk" }, (level.journey?.[item.r - 1] ?? START_X) > 30 ? walk / 2 : walk, token))) return false;
        else if (good) {
          if (!(await moveHiker({ x: END_X, y: SINGLE_Y, mode: "walk" }, walk, token))) return false;
          setHiker((h) => ({ ...h, mode: "cheer", say: "✓" }));
          sfx.success();
        } else {
          setBroken("single");
          sfx.fall();
          await moveHiker({ y: 93, mode: "fall" }, 700, token);
          await sleep(700);
        }
      } else {
        if (good) {
          setHiker((h) => ({ ...h, mode: "nod", say: level.journey && item.r > 0 ? "Waiting for repairs ✋" : "Good call ✓" }));
          sfx.land();
        } else {
          setHiker((h) => ({ ...h, mode: "sad", say: "It was safe… 😕" }));
          sfx.fail();
        }
        await sleep(1100 / sp);
      }
    } else {
      const r = String(got);
      setHiker((h) => ({ ...h, say: null }));
      if (r === "wait") {
        setHiker((h) => ({ ...h, mode: good ? "nod" : "sad", say: good ? "Waiting it out ✓" : "Why wait? 😕" }));
        good ? sfx.land() : sfx.fail();
        await sleep(1100 / sp);
      } else {
        setPicked(r);
        const y = ROUTE_Y[r];
        if (!(await moveHiker({ x: START_X + 5, y, mode: "walk" }, 700 / sp, token))) return false;
        if (!(await moveHiker({ x: 50, y: y + 5, mode: "walk" }, walk, token))) return false;
        if (good) {
          if (!(await moveHiker({ x: END_X, y, mode: "walk" }, walk, token))) return false;
          setHiker((h) => ({ ...h, mode: "cheer", say: "✓" }));
          sfx.success();
        } else {
          setHiker((h) => ({ ...h, mode: "sad", say: "Wrong bridge! ✗" }));
          sfx.fail();
          await sleep(700 / sp);
          if (!(await moveHiker({ x: START_X + 5, y, facing: -1, mode: "walk" }, walk, token))) return false;
          setHiker((h) => ({ ...h, facing: 1, mode: "sad" }));
        }
      }
    }
    await sleep(600 / sp);
    mark();
    return tokenRef.current === token && good;
  };

  const finish = (token: number) => {
    const p = prog.current;
    if (tokenRef.current !== token || !p) return;
    const last = p.items[p.items.length - 1];
    let r: Result;
    if (last && last.t === "outcome" && !last.verdict.ok) {
      const v = last.verdict;
      const round = level.rounds[last.r];
      if (v.kind === "error") {
        setErrorLine(last.res.error?.line ?? null);
        r = { kind: "error", title: v.title, message: v.message, emoji: "⚠️" };
      } else {
        r = {
          kind: "fail",
          title: v.title,
          message: v.message,
          situation: `${level.rounds.length > 1 ? `Test ${last.r + 1} · ` : ""}${situation(round.inputs)}`,
          passed: last.r,
          emoji: v.kind === "missing" || v.kind === "type" ? "🤔" : v.title === "Splash!" ? "💦" : "🧭",
        };
      }
    } else {
      const missing = (level.mustUse ?? []).filter((w) => !p.results[0][w === "if" ? "usedIf" : w === "else" ? "usedElse" : "usedElif"]);
      if (missing.length) {
        r = {
          kind: "fail",
          title: "So close!",
          message: `Your code sends the hiker over without checking anything. What if the bridge was not safe? Let ${Object.keys(level.given)[0]} decide.`,
          emoji: "🤔",
        };
      } else {
        r = {
          kind: "success",
          title: level.boss ? "Boss defeated!" : "Level complete!",
          message:
            level.journey
              ? "The hiker got all the way across, and waited when the bridge was broken."
              : level.rounds.length > 1
              ? `Your code made the right choice in ${level.rounds.length === 2 ? "both" : `all ${level.rounds.length}`} tests.`
              : "Your code checked the bridge and made the right choice.",
          emoji: level.boss ? "🏆" : "🎉",
        };
      }
    }

    setActiveLine(null);
    setPhase("finished");
    setResult(r);
    if (r.kind === "success") {
      markDone(LAB, level.id);
      celebrate();
      setTimeout(() => tokenRef.current === token && setShowCard(true), 700);
    } else {
      setTimeout(() => tokenRef.current === token && setShowCard(true), r.kind === "error" ? 0 : 300);
    }
  };

  const run = async () => {
    if (phaseRef.current === "running" || stepBusy.current) return;
    if (phaseRef.current !== "stepping") prepare();
    const token = tokenRef.current;
    const p = prog.current!;
    setPhase("running");
    while (p.idx < p.items.length) {
      const ok = await play(p.items[p.idx], token);
      if (tokenRef.current !== token) return;
      p.idx++;
      setStepNo(p.idx);
      if (!ok) break;
    }
    finish(token);
  };

  const step = async () => {
    if (phaseRef.current === "running" || stepBusy.current) return;
    if (phaseRef.current !== "stepping") {
      prepare();
      setPhase("stepping");
    }
    const token = tokenRef.current;
    const p = prog.current!;
    if (p.idx >= p.items.length) {
      finish(token);
      return;
    }
    stepBusy.current = true;
    const ok = await play(p.items[p.idx], token);
    if (tokenRef.current !== token) return;
    stepBusy.current = false;
    p.idx++;
    setStepNo(p.idx);
    if (!ok || p.idx >= p.items.length) finish(token);
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    speedRef.current = s;
  };

  const busy = phase === "running" || phase === "stepping";
  const total = prog.current?.items.length ?? 0;

  const card = result && showCard && (
    <div className={`result ${result.kind}`} role="status" aria-live="assertive">
      <div className="result-card">
        <div className="result-emoji" aria-hidden>
          {result.emoji}
        </div>
        <h2>{result.title}</h2>
        {!!result.passed && (
          <div className="result-passed">
            ✓ {result.passed === 1 ? "Test 1 passed" : `Tests 1–${result.passed} passed`}, but test {result.passed + 1} of {level.rounds.length} failed
          </div>
        )}
        <p>{result.message}</p>
        {result.situation && (
          <div className="result-path">
            <span>failed on</span> {result.situation}
          </div>
        )}
        {result.kind === "success" && <div className="xp">+{XP_PER_LEVEL} XP</div>}
        <div className="result-actions">
          {result.kind === "success" ? (
            <>
              <button className="btn soft" onClick={() => resetWorld()}>
                <RotateCcw size={16} />
                Replay
              </button>
              {next ? (
                <button className="btn run" onClick={() => router.push(`/labs/conditions/${next.id}`)} autoFocus>
                  Next level
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button className="btn run" onClick={() => router.push(`/labs/conditions`)} autoFocus>
                  All levels done!
                  <ArrowRight size={16} />
                </button>
              )}
            </>
          ) : (
            <button className="btn primary" onClick={() => resetWorld(result.kind === "error")} autoFocus>
              <RotateCcw size={16} />
              {result.kind === "error" ? "Fix my code" : "Try again"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main className="app">
      <header className="topbar">
        <div className="crumbs">
          <Link href="/labs/conditions" className="back" aria-label="Back to Condition Lab">
            <ChevronLeft size={18} />
            <span>Condition Lab</span>
          </Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-level">
            {level.boss ? "Boss" : `Level ${index + 1}`}
            <span className="crumb-of"> of {COND_LEVELS.length}</span>
          </span>
        </div>
        <div className="topbar-right">
          <div className="level-dots" aria-hidden>
            {COND_LEVELS.map((l, k) => (
              <i key={l.id} className={`${k === index ? "now" : ""} ${doneSet.has(l.id) ? "done cond" : ""}`} />
            ))}
          </div>
          <span className="xp-chip">{totalXp} XP</span>
          <SoundToggle />
        </div>
      </header>

      <section className="task">
        <div className={`task-icon icon-cond ${level.boss ? "boss" : ""}`} aria-hidden>
          <span>{level.boss ? "🏆" : "🧭"}</span>
        </div>
        <div className="task-text">
          <h1>{level.title}</h1>
          <p>{level.goal}</p>

          <div className="brief-question">
            <span className="brief-label">What you need to do</span>
            <p>{level.task}</p>
          </div>

          <div className="brief-grid">
            <div className="brief-box">
              <span className="brief-label">Values the game gives you</span>
              <p className="brief-note">
                The game already set these for you before your code runs. Don&apos;t type their values yourself, just use their names.
                {level.rounds.length > 1 && " Their values are different in every test."}
              </p>
              <ul className="given-list">
                {Object.entries(level.given).map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code> {v}
                  </li>
                ))}
              </ul>
            </div>
            <div className="brief-box">
              <span className="brief-label">Rules</span>
              <ul className="brief-reqs">
                <li>
                  Give <code>{level.output.name}</code> a value:{" "}
                  {level.output.name === "cross" ? (
                    <>
                      <code>True</code> means go, <code>False</code> means wait
                    </>
                  ) : (
                    (level.output.choices ?? []).map((c, k, a) => (
                      <span key={c}>
                        <code>&quot;{c}&quot;</code>
                        {k < a.length - 2 ? ", " : k === a.length - 2 ? " or " : ""}
                      </span>
                    ))
                  )}
                </li>
                {level.rules.slice(1).map((r) => (
                  <li key={r}>
                    <CodeText text={r} names={[...Object.keys(level.given), level.output.name]} />
                  </li>
                ))}
                {level.rounds.length > 1 && <li>Your code must pass all {level.rounds.length} tests below</li>}
              </ul>
            </div>
          </div>

          {level.table && (
            <div className="rule-table">
              {level.table.title && <div className="rule-table-title">{level.table.title}</div>}
              {level.table.rows.map(([a, b]) => (
                <div key={a} className="rule-row">
                  <span>{a}</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          <div className="brief-tests">
            <span className="brief-label">
              {level.rounds.length > 1 ? `We test your code ${level.rounds.length} times, with different values` : "The test"}
            </span>
            <ol>
              {level.rounds.map((round, k) => (
                <li key={k} className={`test-${marks[k]}`}>
                  <span className="test-no">{marks[k] === "ok" ? "✓" : marks[k] === "bad" ? "✗" : k + 1}</span>
                  {eventNote(round.event) && <span className="test-event">{eventNote(round.event)}</span>}
                  <code className="test-in">{situation(round.inputs)}</code>
                  <span className="test-arrow">→ the hiker should</span>
                  <span className="test-out">{expectText(level.solve(round.inputs), !!level.journey)}</span>
                </li>
              ))}
            </ol>
          </div>
          {hint >= 0 && (
            <div className="hint-text">
              {level.hints.slice(0, hint + 1).map((h, k) => (
                <p key={k}>💡 {h}</p>
              ))}
            </div>
          )}
        </div>
        <button
          className="ghost-btn"
          onClick={() => setHint((h) => Math.min(h + 1, level.hints.length - 1))}
          disabled={hint >= level.hints.length - 1}
          title="Show a hint"
        >
          <Lightbulb size={16} />
          <span>{hint < 0 ? "Hint" : hint < level.hints.length - 1 ? "Another hint" : "No more hints"}</span>
        </button>
      </section>

      <BridgeWorld
        scene={level.scene}
        inputs={inputs}
        changed={changed}
        hiker={hiker}
        broken={broken}
        picked={picked}
        decision={decision}
        rounds={marks}
        banner={banner}
      >
        {card}
      </BridgeWorld>

      <section className="workbench">
        <div className="panel editor-panel">
          <div className="panel-head">
            <span className="file-tab">main.py</span>
            <div className="controls">
              <div className="speed" role="group" aria-label="Animation speed">
                {[0.5, 1, 2].map((s) => (
                  <button key={s} className={speed === s ? "on" : ""} onClick={() => changeSpeed(s)} aria-pressed={speed === s}>
                    {s}x
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => resetWorld()} title="Reset" aria-label="Reset">
                <RotateCcw size={16} />
                <span className="hide-sm">Reset</span>
              </button>
              <button className="btn" onClick={step} disabled={phase === "running"} title="Run one step at a time" aria-label="Step">
                <StepForward size={16} />
                <span className="hide-sm">{phase === "stepping" ? `Step ${stepNo}/${total}` : "Step"}</span>
              </button>
              <button className={`btn run ${phase === "running" ? "is-running" : ""}`} onClick={run} disabled={phase === "running"} title="Run (Ctrl + Enter)">
                <Play size={16} fill="currentColor" />
                Run
              </button>
            </div>
          </div>
          <div className="editor-wrap">
            <CodeEditor value={code} onChange={onCodeChange} readOnly={busy} activeLine={activeLine} errorLine={errorLine} onRun={run} />
          </div>
        </div>

        <div className="panel output-panel">
          <div className="panel-head">
            <span className="panel-title">Output</span>
          </div>
          <div className="console">
            {lines.length === 0 && !result && (
              <p className="console-empty">Each test, and every value your code sets, will show here.</p>
            )}
            {lines.map((l, k) => (
              <div key={k} className={`console-line kind-${l.kind}`}>
                <span className="out">{l.text || " "}</span>
              </div>
            ))}
            {result?.kind === "error" && <div className="console-error">⚠ {result.message}</div>}
            <div ref={consoleEnd} />
          </div>
        </div>
      </section>

      <footer className="foot">
        Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run
      </footer>
    </main>
  );
}

function celebrate() {
  const opts = { disableForReducedMotion: true, zIndex: 60, ticks: 220 };
  confetti({ ...opts, particleCount: 90, angle: 60, spread: 65, startVelocity: 55, origin: { x: 0, y: 0.8 } });
  confetti({ ...opts, particleCount: 90, angle: 120, spread: 65, startVelocity: 55, origin: { x: 1, y: 0.8 } });
  setTimeout(() => {
    confetti({ ...opts, particleCount: 50, angle: 75, spread: 90, origin: { x: 0.15, y: 0.9 } });
    confetti({ ...opts, particleCount: 50, angle: 105, spread: 90, origin: { x: 0.85, y: 0.9 } });
  }, 400);
}
