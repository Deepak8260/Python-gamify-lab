"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import confetti from "canvas-confetti";
import { Play, StepForward, RotateCcw, Lightbulb, ArrowRight, ChevronLeft, Lock } from "lucide-react";
import SystemWorld, { type Decision, type RoundMark, type Stage } from "./SystemWorld";
import SoundToggle from "./SoundToggle";
import { runPython, type ExecEvent, type RunResult } from "@/lib/interpreter";
import {
  COND_LEVELS,
  CONCEPTS,
  allCases,
  condIndex,
  diagnose,
  judgeCase,
  outcomeOf,
  py,
  toInputs,
  type Case,
  type Diagnosis,
  type Inputs,
  type Value,
  type Verdict,
} from "@/lib/condLevels";
import { recordRun } from "@/lib/condStats";
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
  | { t: "outcome"; r: number; verdict: Verdict }
  | { t: "hidden"; upto: number }; // hidden cases V..upto-1 all passed
type Result = {
  kind: "success" | "fail" | "error";
  title: string;
  message: string;
  diagnosis?: string;
  situation?: string;
  progress?: string;
  emoji: string;
};
type Line = { text: string; kind: "round" | "print" | "assign" | "ok" | "bad" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const situation = (i: Inputs) => Object.entries(i).map(([k, v]) => `${k} = ${py(v)}`).join(",  ");
const DIFFICULTY: Record<string, string> = { beginner: "Beginner", easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };

/** Wraps variable names, True/False and "text" in <code> so rules are easy to scan. */
function CodeText({ text, names }: { text: string; names: string[] }) {
  const words = [...names, "True", "False"].map((w) => w.replace(/[^\w]/g, "")).filter(Boolean);
  const re = new RegExp(`(\\b\\w+ = (?:True|False|"[^"]*")|\\b(?:${words.join("|")})\\b|"[^"]*")`, "g");
  return (
    <>
      {text.split(re).map((part, k) => (k % 2 ? <code key={k}>{part}</code> : part))}
    </>
  );
}

export default function CondPlayer({ levelId }: { levelId: string }) {
  const index = condIndex(levelId);
  const level = COND_LEVELS[index];
  const next = COND_LEVELS[index + 1];
  const router = useRouter();
  const { markDone, totalXp, done } = useProgress();
  const doneSet = done(LAB);
  const V = level.visible.length;
  const total = V + level.hidden.length;
  const preview = level.visible[0].inputs;
  const names = [...Object.keys(level.given), level.output.name];
  const outName = level.output.name;

  const starter = `# The system already set: ${Object.keys(level.given).join(", ")}\n# Use these names in your conditions. Don't retype their values.\n# Your code must set: ${outName}\n\n`;
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

  const pendingMarks = (): RoundMark[] => Array.from({ length: total }, () => "pending");
  const [inputs, setInputs] = useState<Inputs>(preview);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>("idle");
  const [picked, setPicked] = useState<Value | null>(null);
  const [expected, setExpected] = useState<Value | null>(null);
  const [pickOk, setPickOk] = useState<boolean | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [assigned, setAssigned] = useState<string | null>(null);
  const [marks, setMarks] = useState<RoundMark[]>(pendingMarks);
  const [testLabel, setTestLabel] = useState<string | null>(null);
  const [roundKey, setRoundKey] = useState(0);
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
  const prog = useRef<{ items: Item[]; idx: number; cases: Case[]; results: RunResult[]; verdicts: Verdict[] } | null>(null);
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

  const caseLabel = (r: number) => (r < V ? `Test ${r + 1} of ${V}` : `Hidden test ${r - V + 1} of ${total - V}`);

  const resetWorld = (keepError = false) => {
    tokenRef.current++;
    stepBusy.current = false;
    prog.current = null;
    shownInputs.current = preview;
    setInputs(preview);
    setChanged(new Set());
    setStage("idle");
    setPicked(null);
    setExpected(null);
    setPickOk(null);
    setDecision(null);
    setAssigned(null);
    setMarks(pendingMarks());
    setTestLabel(null);
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

  /**
   * Run the code against EVERY case up front (visible and hidden), then build
   * the timeline: visible cases play one by one, hidden cases tick past, and
   * the first failing hidden case is replayed so the student can see it.
   */
  const prepare = () => {
    resetWorld();
    const cases = allCases(level);
    const results = cases.map((c) => {
      const inp = toInputs(c.inputs);
      if (level.output.start !== undefined) inp[outName] = level.output.start;
      return runPython(codeRef.current, inp);
    });
    const verdicts = cases.map((c, k) => judgeCase(level, c.inputs, results[k]));
    const items: Item[] = [];
    const playCase = (r: number) => {
      items.push({ t: "round", r });
      results[r].events.slice(0, 40).forEach((ev) => items.push({ t: "event", r, ev }));
      items.push({ t: "outcome", r, verdict: verdicts[r] });
    };
    let failed = false;
    for (let r = 0; r < V && !failed; r++) {
      playCase(r);
      failed = !verdicts[r].ok;
    }
    if (!failed && total > V) {
      const bad = verdicts.findIndex((v, k) => k >= V && !v.ok);
      items.push({ t: "hidden", upto: bad < 0 ? total : bad });
      if (bad >= 0) playCase(bad);
    }
    prog.current = { items, idx: 0, cases, results, verdicts };
  };

  const play = async (item: Item, token: number): Promise<boolean> => {
    const sp = speedRef.current;
    const cases = prog.current!.cases;

    if (item.t === "round") {
      const round = cases[item.r];
      const prev = shownInputs.current;
      const ch = new Set(Object.keys(round.inputs).filter((k) => prev[k] !== round.inputs[k]));
      shownInputs.current = round.inputs;
      setMarks((m) => m.map((x, k) => (k === item.r ? "now" : x)));
      setStage("incoming");
      setPicked(null);
      setExpected(null);
      setPickOk(null);
      setDecision(null);
      setAssigned(null);
      setActiveLine(null);
      setInputs(round.inputs);
      setChanged(ch);
      setTestLabel(caseLabel(item.r));
      setRoundKey((k) => k + 1);
      setLines((l) => [...l, { text: `${item.r < V ? `Test ${item.r + 1}` : `Hidden test ${item.r - V + 1}`}: ${situation(round.inputs)}`, kind: "round" }]);
      const text = item.r < V ? [caseLabel(item.r), round.note].filter(Boolean).join(" · ") : `🔒 ${caseLabel(item.r)} failed. Here it is:`;
      setBanner({ text, key: Date.now() });
      sfx.pop();
      await sleep(item.r < V ? Math.max(900, 1500 / sp) : Math.max(1300, 2000 / sp));
      setBanner(null);
      setStage("deciding");
      return tokenRef.current === token;
    }

    if (item.t === "hidden") {
      const n = total - V;
      setStage("idle");
      setDecision(null);
      setAssigned(null);
      setTestLabel(null);
      setBanner({ text: `🔒 Now ${n} hidden test${n === 1 ? "" : "s"} with other values…`, key: Date.now() });
      sfx.pop();
      await sleep(Math.max(700, 1100 / sp));
      for (let k = V; k < item.upto; k++) {
        if (tokenRef.current !== token) return false;
        setInputs(cases[k].inputs);
        setMarks((m) => m.map((x, j) => (j === k ? "ok" : x)));
        sfx.tick();
        await sleep(Math.max(70, 160 / sp));
      }
      setBanner(null);
      const passed = item.upto - V;
      setLines((l) => [...l, { text: `Hidden tests: ${passed} of ${n} passed${passed < n ? ", then one failed" : ""}`, kind: passed < n ? "bad" : "ok" }]);
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
        setAssigned(`${ev.name} = ${ev.value}`);
        await sleep(650 / sp);
      } else if (ev.kind === "print") {
        setLines((l) => [...l, { text: ev.text, kind: "print" }]);
        await sleep(400 / sp);
      } else {
        await sleep(250 / sp);
      }
      return tokenRef.current === token;
    }

    // outcome: the request is routed to what the code decided
    const { verdict } = item;
    setActiveLine(null);
    const good = verdict.ok;
    const mark = () => setMarks((m) => m.map((x, k) => (k === item.r ? (good ? "ok" : "bad") : x)));

    if (verdict.kind === "error" || verdict.kind === "missing" || verdict.kind === "type") {
      setStage("stuck");
      sfx.fail();
      await sleep(900 / sp);
      mark();
      return false;
    }
    setPicked(verdict.got);
    setExpected(verdict.expected);
    setPickOk(good);
    setStage("routed");
    if (good) sfx.land();
    else sfx.fail();
    await sleep((good ? 1000 : 1400) / sp);
    mark();
    return tokenRef.current === token && good;
  };

  const finish = (token: number) => {
    const p = prog.current;
    if (tokenRef.current !== token || !p) return;
    const last = p.items[p.items.length - 1];
    let r: Result;
    let ok = false;
    let mistake: { tag: string; concept?: Diagnosis["concept"] } | undefined;

    if (last && last.t === "outcome" && !last.verdict.ok) {
      const v = last.verdict;
      const round = p.cases[last.r];
      if (v.kind === "error") {
        setErrorLine(p.results[last.r].error?.line ?? null);
        r = { kind: "error", title: v.title, message: v.message, emoji: "⚠️" };
        mistake = { tag: "syntax" };
      } else {
        const d = diagnose(level, p.cases, p.verdicts);
        mistake = d ?? { tag: "wrong-answer" };
        const hiddenFail = last.r >= V;
        r = {
          kind: "fail",
          title: v.title,
          message: v.message,
          diagnosis: d?.message || undefined,
          situation: `${hiddenFail ? `Hidden test ${last.r - V + 1}` : `Test ${last.r + 1}`} · ${situation(round.inputs)}`,
          progress: hiddenFail
            ? `✓ All ${V} visible tests passed, but hidden test ${last.r - V + 1} of ${total - V} failed`
            : last.r > 0
              ? `✓ ${last.r === 1 ? "Test 1 passed" : `Tests 1–${last.r} passed`}, but test ${last.r + 1} of ${V} failed`
              : undefined,
          emoji: v.kind === "missing" || v.kind === "type" ? "🤔" : v.title === "Let through by mistake" ? "🚨" : "🧭",
        };
      }
    } else {
      const missing = (level.mustUse ?? []).filter((m) => !p.results[0].names.includes(m.word));
      if (missing.length) {
        r = { kind: "fail", title: "So close!", message: missing[0].message, emoji: "🤔" };
        mistake = { tag: `must-use-${missing[0].word}`, concept: "if" };
      } else {
        ok = true;
        r = {
          kind: "success",
          title: level.boss ? "Boss defeated!" : "Level complete!",
          message: level.success,
          progress: `✓ ${V} visible + ${total - V} hidden tests passed`,
          emoji: level.boss ? "🏆" : "🎉",
        };
      }
    }

    recordRun(level, ok, ok ? undefined : mistake);
    setActiveLine(null);
    setPhase("finished");
    setResult(r);
    if (ok) {
      markDone(LAB, level.id);
      sfx.success();
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
  const itemCount = prog.current?.items.length ?? 0;
  const hiddenDone = marks.slice(V).filter((m) => m === "ok").length;
  const hiddenBad = marks.slice(V).some((m) => m === "bad");
  const outLabel = (v: Value) => {
    const o = outcomeOf(level, v);
    return (
      <>
        <code>{py(v)}</code> {o && `${o.icon} ${o.label}`}
      </>
    );
  };

  const card = result && showCard && (
    <div className={`result ${result.kind}`} role="status" aria-live="assertive">
      <div className="result-card">
        <div className="result-emoji" aria-hidden>
          {result.emoji}
        </div>
        <h2>{result.title}</h2>
        {result.progress && <div className={`result-passed ${result.kind === "success" ? "all" : ""}`}>{result.progress}</div>}
        <p>{result.message}</p>
        {result.diagnosis && (
          <div className="result-diagnosis">
            <b>🔎 What went wrong</b>
            <span>{result.diagnosis}</span>
          </div>
        )}
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
                  See your concept report
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
          <span>{level.system.icon}</span>
        </div>
        <div className="task-text">
          <div className="task-title-row">
            <h1>{level.title}</h1>
            <span className={`diff-chip diff-${level.difficulty}`}>{DIFFICULTY[level.difficulty]}</span>
            <span className="sys-chip">{level.system.name}</span>
          </div>
          <p>{level.scenario}</p>

          {!level.hideConcepts && (
            <div className="concept-chips" aria-label="Concepts in this level">
              {level.concepts.map((c) => (
                <span key={c} className={level.introduces.includes(c) ? "new" : ""} title={CONCEPTS[c].blurb}>
                  {level.introduces.includes(c) && <em>new</em>}
                  {CONCEPTS[c].label}
                </span>
              ))}
            </div>
          )}

          <div className="brief-question">
            <span className="brief-label">What your code must decide</span>
            <p>
              <CodeText text={level.task} names={names} />
            </p>
          </div>

          <div className="brief-grid">
            <div className="brief-box">
              <span className="brief-label">Values the system gives you</span>
              <p className="brief-note">
                These are already set before your code runs, and they change in every test. Use their names; don&apos;t type their values.
              </p>
              <ul className="given-list">
                {Object.entries(level.given).map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code> <CodeText text={v} names={[]} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="brief-box">
              <span className="brief-label">Rules</span>
              <ul className="brief-reqs">
                <li>
                  Set <code>{outName}</code> to{" "}
                  {level.output.outcomes.map((o, k, a) => (
                    <span key={String(o.value)}>
                      <code>{py(o.value)}</code>
                      {k < a.length - 2 ? ", " : k === a.length - 2 ? " or " : ""}
                    </span>
                  ))}
                </li>
                <li>
                  {level.output.start !== undefined ? (
                    <>
                      <code>{outName}</code> starts as <code>{py(level.output.start)}</code>
                    </>
                  ) : (
                    <>
                      <code>{outName}</code> has no starting value: every situation must set it
                    </>
                  )}
                </li>
                {level.rules.map((r) => (
                  <li key={r}>
                    <CodeText text={r} names={names} />
                  </li>
                ))}
                <li>
                  Pass all {V} visible tests and {total - V} hidden tests
                </li>
              </ul>
            </div>
          </div>

          {level.table && (
            <div className="rule-table">
              {level.table.title && <div className="rule-table-title">{level.table.title}</div>}
              {level.table.rows.map(([a, b]) => (
                <div key={a} className="rule-row">
                  <span>
                    <CodeText text={a} names={names} />
                  </span>
                  <span>
                    <CodeText text={b} names={names} />
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="brief-tests">
            <span className="brief-label">Visible tests</span>
            <ol>
              {level.visible.map((round, k) => (
                <li key={k} className={`test-${marks[k]}`}>
                  <span className="test-no">{marks[k] === "ok" ? "✓" : marks[k] === "bad" ? "✗" : k + 1}</span>
                  {round.note && <span className="test-event">{round.note}</span>}
                  <code className="test-in">{situation(round.inputs)}</code>
                  <span className="test-arrow">→ expected</span>
                  <span className="test-out">{outLabel(level.solve(round.inputs))}</span>
                </li>
              ))}
              <li className={`test-hidden ${hiddenBad ? "test-bad" : hiddenDone === total - V ? "test-ok" : ""}`}>
                <span className="test-no">
                  <Lock size={11} />
                </span>
                <span className="test-event">
                  + {total - V} hidden tests with other values, including boundaries and edge cases
                </span>
                {(hiddenDone > 0 || hiddenBad) && (
                  <span className="test-out">
                    {hiddenDone} / {total - V} passed
                  </span>
                )}
              </li>
            </ol>
          </div>
          {hint >= 0 && (
            <div className="hint-text">
              {level.hints.slice(0, hint + 1).map((h, k) => (
                <p key={k}>
                  💡 <CodeText text={h} names={names} />
                </p>
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

      <SystemWorld
        system={level.system}
        outcomes={level.output.outcomes}
        inputs={inputs}
        changed={changed}
        stage={stage}
        picked={picked}
        expected={expected}
        ok={pickOk}
        decision={decision}
        assigned={assigned}
        rounds={marks}
        visibleCount={V}
        testLabel={testLabel}
        roundKey={roundKey}
        banner={banner}
      >
        {card}
      </SystemWorld>

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
                <span className="hide-sm">{phase === "stepping" ? `Step ${stepNo}/${itemCount}` : "Step"}</span>
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
            {lines.length === 0 && !result && <p className="console-empty">Each test, and every value your code sets, will show here.</p>}
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
