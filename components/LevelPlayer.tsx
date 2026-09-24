"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import confetti from "canvas-confetti";
import { Play, StepForward, RotateCcw, Lightbulb, ArrowRight, ChevronLeft, Target } from "lucide-react";
import RobotWorld, { type RobotState } from "./RobotWorld";
import RocketWorld, { type RocketMode } from "./RocketWorld";
import type { Hud } from "./LoopHud";
import SoundToggle from "./SoundToggle";
import { runPython, type ExecEvent, type RunResult } from "@/lib/interpreter";
import {
  LOOP_LEVELS,
  isOver,
  isReady,
  judgeGauge,
  judgeRobot,
  levelIndex,
  type Level,
  type PlayOutcome,
  type Result,
} from "@/lib/loopLevels";
import { useProgress, XP_PER_LEVEL } from "@/lib/progress";
import { sfx } from "@/lib/sound";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading editor…</div>,
});

const LAB = "loops";
const STARTER = "# Write your code here\n\n";

type Phase = "idle" | "running" | "stepping" | "finished";
type ConsoleLine = { text: string; note: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export default function LevelPlayer({ levelId }: { levelId: string }) {
  const index = levelIndex(levelId);
  const level = LOOP_LEVELS[index];
  const next = LOOP_LEVELS[index + 1];
  const router = useRouter();
  const { markDone, totalXp, done } = useProgress();
  const doneSet = done(LAB);

  const codeKey = `codeplay-code-${LAB}-${level.id}`;
  const [code, setCodeState] = useState(STARTER);
  const codeRef = useRef(STARTER);
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

  const startRobot = (): RobotState => ({
    pos: level.world === "robot" ? level.start : 0,
    facing: level.world === "robot" && level.path[0] < level.start ? -1 : 1,
    hop: 0,
    dur: 500,
    falling: false,
    happy: false,
  });

  // robot world
  const [robot, setRobot] = useState<RobotState>(startRobot);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [ballGot, setBallGot] = useState(false);
  // rocket world
  const [gauge, setGauge] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);
  const [rocketMode, setRocketMode] = useState<RocketMode>("idle");

  const [hud, setHud] = useState<Hud>(null);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hint, setHint] = useState(-1);
  const [stepNo, setStepNo] = useState(0);

  const speedRef = useRef(1);
  const tokenRef = useRef(0);
  const posRef = useRef(startRobot().pos);
  const stepBusy = useRef(false);
  const prog = useRef<{ res: RunResult; idx: number; out: PlayOutcome; played: number } | null>(null);
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

  const resetWorld = useCallback(
    (keepError = false) => {
      tokenRef.current++;
      stepBusy.current = false;
      prog.current = null;
      const r = startRobot();
      posRef.current = r.pos;
      setRobot(r);
      setVisited(new Set());
      setBubble(null);
      setBallGot(false);
      setGauge(null);
      setPulse(0);
      setRocketMode("idle");
      setHud(null);
      setLines([]);
      setActiveLine(null);
      if (!keepError) setErrorLine(null);
      setResult(null);
      setShowCard(false);
      setStepNo(0);
      setPhase("idle");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level.id],
  );

  const onCodeChange = (v: string) => {
    setCode(v);
    try {
      localStorage.setItem(codeKey, v);
    } catch {}
    if (errorLine) setErrorLine(null);
    if (phaseRef.current === "finished") resetWorld();
  };

  const prepare = () => {
    resetWorld();
    prog.current = {
      res: runPython(codeRef.current),
      idx: 0,
      played: 0,
      out: { nums: [], fell: null, overflow: null, stuck: false },
    };
  };

  /** Animate one execution event. Returns false when playback must stop. */
  const playEvent = async (ev: ExecEvent, token: number): Promise<boolean> => {
    const sp = speedRef.current;
    const p = prog.current!;
    p.played++;
    setStepNo(p.played);
    setActiveLine(ev.line);

    if (ev.kind === "check") {
      setHud({ loops: ev.loops, step: p.played, vars: ev.vars, check: { cond: ev.cond, result: ev.result } });
      await sleep((ev.result ? 420 : 700) / sp);
      return tokenRef.current === token;
    }

    setHud({ loops: ev.loops, step: p.played, vars: ev.vars, check: null });
    const v = ev.value;
    const ok = v !== null && Number.isFinite(v);
    setLines((l) => [
      ...l,
      {
        text: ev.text,
        note: !ok
          ? level.world === "robot"
            ? "Robo: ?"
            : "gauge: ?"
          : level.world === "robot"
            ? `→ block ${fmt(v)}`
            : `→ ${level.label.toLowerCase()} ${fmt(v)}${level.unit}`,
      },
    ]);

    // detect a loop that isn't going anywhere
    if (ok) {
      p.out.nums.push(v);
      const n = p.out.nums;
      if (n.length >= 4 && n.slice(-4).every((x) => x === v)) {
        p.out.stuck = true;
        return false;
      }
    }

    if (level.world === "rocket") {
      if (!ok) {
        await sleep(600 / sp);
        return tokenRef.current === token;
      }
      setGauge(v);
      setPulse((k) => k + 1);
      setRocketMode(isReady(level, v) ? "ready" : "idle");
      sfx.pump(level.dir === "down");
      await sleep(650 / sp);
      if (tokenRef.current !== token) return false;
      if (isOver(level, v)) {
        p.out.overflow = v;
        setRocketMode("overflow");
        sfx.fail();
        await sleep(700);
        return false;
      }
      await sleep(200 / sp);
      return tokenRef.current === token;
    }

    // robot world
    const shown = ev.text === "" ? " " : ev.text.length > 12 ? ev.text.slice(0, 11) + "…" : ev.text;
    setBubble({ text: shown, key: p.played });
    if (!ok) {
      setRobot((r) => ({ ...r, hop: r.hop + 1, dur: 300 / sp }));
      await sleep(900 / sp);
      return tokenRef.current === token;
    }

    const from = posRef.current;
    const tiles = level.tiles;
    const lo = Math.min(...tiles) - 4;
    const hi = Math.max(...tiles) + 4;
    const tooFar = v < lo - 4 || v > hi + 4;
    const dest = tooFar ? (v < from ? lo - 3 : hi + 3) : v;
    const lands = Number.isInteger(v) && tiles.includes(v);
    const dist = Math.abs(dest - from);
    const dur = (dist === 0 ? 420 : Math.min(1500, 460 + dist * 110)) / sp;

    setRobot((r) => ({
      ...r,
      pos: dest,
      facing: dest < from ? -1 : dest > from ? 1 : r.facing,
      hop: r.hop + 1,
      dur,
    }));
    posRef.current = dest;
    sfx.hop(dest < from);
    await sleep(dur);
    if (tokenRef.current !== token) return false;

    if (!lands) {
      setRobot((r) => ({ ...r, falling: true }));
      sfx.fall();
      p.out.fell = v;
      await sleep(1000);
      return false;
    }

    sfx.land();
    if (level.gems?.includes(v)) sfx.pop();
    setVisited((s) => new Set(s).add(v));
    await sleep(360 / sp);
    return tokenRef.current === token;
  };

  const finish = (token: number) => {
    if (tokenRef.current !== token || !prog.current) return;
    const { res, out } = prog.current;
    const r = level.world === "robot" ? judgeRobot(level, res, out) : judgeGauge(level, res, out);

    if (r.kind === "error") {
      setErrorLine(res.error?.line ?? null);
      setActiveLine(null);
    } else {
      setActiveLine(null);
    }
    setBubble(null);
    setPhase("finished");
    setResult(r);

    if (r.kind === "success") {
      markDone(LAB, level.id);
      if (level.world === "robot") {
        setBallGot(true);
        setRobot((s) => ({ ...s, happy: true, hop: s.hop + 1, dur: 600 }));
        sfx.pop();
        sfx.success();
        celebrate(250);
        setTimeout(() => tokenRef.current === token && setShowCard(true), 1100);
      } else {
        setRocketMode("launch");
        sfx.launch();
        setTimeout(() => {
          if (tokenRef.current !== token) return;
          sfx.success();
          celebrate(0);
        }, 1300);
        setTimeout(() => tokenRef.current === token && setShowCard(true), 2000);
      }
    } else {
      if (level.world === "rocket" && r.mood === "short") setRocketMode("sputter");
      sfx.fail();
      setTimeout(() => tokenRef.current === token && setShowCard(true), r.kind === "error" ? 0 : 450);
    }
  };

  const runaway = (p: NonNullable<typeof prog.current>) => p.res.runaway && p.played >= 14;

  const run = async () => {
    if (phaseRef.current === "running" || stepBusy.current) return;
    if (phaseRef.current !== "stepping") prepare();
    const token = tokenRef.current;
    const p = prog.current!;
    setPhase("running");
    while (p.idx < p.res.events.length && !runaway(p)) {
      const ok = await playEvent(p.res.events[p.idx], token);
      if (tokenRef.current !== token) return;
      p.idx++;
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
    if (p.idx >= p.res.events.length || runaway(p)) {
      finish(token);
      return;
    }
    stepBusy.current = true;
    const ok = await playEvent(p.res.events[p.idx], token);
    if (tokenRef.current !== token) return;
    stepBusy.current = false;
    p.idx++;
    if (!ok || p.idx >= p.res.events.length || runaway(p)) finish(token);
  };

  const tryAgain = () => resetWorld(result?.kind === "error");

  const changeSpeed = (s: number) => {
    setSpeed(s);
    speedRef.current = s;
  };

  const busy = phase === "running" || phase === "stepping";
  const total = prog.current?.res.events.length ?? 0;
  const loopNow = hud?.loops[hud.loops.length - 1];

  const emoji =
    result?.kind === "success"
      ? level.world === "robot"
        ? "🎉"
        : "🚀"
      : result?.kind === "error"
        ? "⚠️"
        : result?.mood === "wrong-way"
          ? "🔄"
          : result?.mood === "fell"
            ? "💦"
            : result?.mood === "stuck"
              ? "♾️"
              : result?.mood === "loop"
                ? "🤔"
                : level.world === "rocket"
                  ? result?.mood === "long"
                    ? "💥"
                    : "🪫"
                  : "🤖";

  const card = result && showCard && (
    <div className={`result ${result.kind}`} role="status" aria-live="assertive">
      <div className="result-card">
        <div className="result-emoji" aria-hidden>
          {emoji}
        </div>
        <h2>{result.title}</h2>
        <p>{result.message}</p>
        {result.path && (
          <div className="result-path">
            <span>printed</span> {result.path}
          </div>
        )}
        {result.kind === "success" && <div className="xp">+{XP_PER_LEVEL} XP</div>}
        <div className="result-actions">
          {result.kind === "success" ? (
            <>
              <button className="btn soft" onClick={tryAgain}>
                <RotateCcw size={16} />
                Replay
              </button>
              {next ? (
                <button className="btn run" onClick={() => router.push(`/labs/loops/${next.id}`)} autoFocus>
                  Next level
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button className="btn run" onClick={() => router.push(`/labs/loops`)} autoFocus>
                  All levels done!
                  <ArrowRight size={16} />
                </button>
              )}
            </>
          ) : (
            <button className="btn primary" onClick={tryAgain} autoFocus>
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
          <Link href="/labs/loops" className="back" aria-label="Back to Loop Lab">
            <ChevronLeft size={18} />
            <span>Loop Lab</span>
          </Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-level">
            Level {index + 1}
            <span className="crumb-of"> of {LOOP_LEVELS.length}</span>
          </span>
        </div>
        <div className="topbar-right">
          <div className="level-dots" aria-hidden>
            {LOOP_LEVELS.map((l, k) => (
              <i key={l.id} className={`${k === index ? "now" : ""} ${doneSet.has(l.id) ? "done" : ""} ${l.loop}`} />
            ))}
          </div>
          <span className="xp-chip">{totalXp} XP</span>
          <SoundToggle />
        </div>
      </header>

      <section className="task">
        <div className={`task-icon icon-${level.world}`} aria-hidden>
          {level.world === "robot" ? <Target size={20} /> : <span>🚀</span>}
        </div>
        <div className="task-text">
          <h1>{level.title}</h1>
          <p>{level.goal}</p>
          <ul className="rules">
            {level.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
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

      {level.world === "robot" ? (
        <RobotWorld level={level} robot={robot} visited={visited} bubble={bubble} ballGot={ballGot} hud={result?.kind === "success" ? null : hud} busy={busy}>
          {card}
        </RobotWorld>
      ) : (
        <RocketWorld level={level} value={gauge} pulse={pulse} mode={rocketMode} hud={result?.kind === "success" ? null : hud} dur={650 / speed}>
          {card}
        </RocketWorld>
      )}

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
              <button className="btn" onClick={() => resetWorld(false)} title="Reset" aria-label="Reset">
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
            {loopNow && (
              <span className="iter-pill">
                {loopNow.total !== null ? `iteration ${loopNow.iteration} / ${loopNow.total}` : `while · round ${loopNow.iteration}`}
              </span>
            )}
          </div>
          <div className="console">
            {lines.length === 0 && !result && (
              <p className="console-empty">Whatever you print() shows up here.</p>
            )}
            {lines.map((l, k) => (
              <div key={k} className="console-line">
                <span className="out">{l.text || " "}</span>
                <span className="note">{l.note}</span>
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

function celebrate(delay: number) {
  const opts = { disableForReducedMotion: true, zIndex: 60, ticks: 220 };
  setTimeout(() => {
    confetti({ ...opts, particleCount: 90, angle: 60, spread: 65, startVelocity: 55, origin: { x: 0, y: 0.8 } });
    confetti({ ...opts, particleCount: 90, angle: 120, spread: 65, startVelocity: 55, origin: { x: 1, y: 0.8 } });
  }, delay);
  setTimeout(() => {
    confetti({ ...opts, particleCount: 50, angle: 75, spread: 90, origin: { x: 0.15, y: 0.9 } });
    confetti({ ...opts, particleCount: 50, angle: 105, spread: 90, origin: { x: 0.85, y: 0.9 } });
  }, delay + 400);
}
