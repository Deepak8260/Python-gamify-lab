"use client";

import { useEffect, useState } from "react";
import { CONCEPTS, type Concept, type CondLevel } from "./condLevels";

/*
 * What the student did in Condition Lab: runs, failures and which mistakes
 * they made. Stored in the browser next to the progress store.
 */

const KEY = "codeplay-cond-stats-v1";
const EVT = "codeplay-cond-stats";

export type LevelStat = { runs: number; fails: number; solved: boolean; mistakes: Record<string, number> };
type Store = { levels: Record<string, LevelStat>; concepts: Partial<Record<Concept, number>> };

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Store) : null;
    return { levels: s?.levels ?? {}, concepts: s?.concepts ?? {} };
  } catch {
    return { levels: {}, concepts: {} };
  }
}

/** Record one run. `mistake` names what went wrong when a run failed. */
export function recordRun(level: CondLevel, ok: boolean, mistake?: { tag: string; concept?: Concept }) {
  const s = read();
  const l = s.levels[level.id] ?? { runs: 0, fails: 0, solved: false, mistakes: {} };
  l.runs++;
  if (ok) l.solved = true;
  else {
    l.fails++;
    const tag = mistake?.tag ?? "wrong-answer";
    l.mistakes[tag] = (l.mistakes[tag] ?? 0) + 1;
    // a known mistake points at one concept; otherwise blame what this level introduces
    const blamed = mistake?.concept ? [mistake.concept] : level.introduces.length ? level.introduces : level.concepts.slice(0, 1);
    if (tag !== "syntax" && tag !== "wrong-type") blamed.forEach((c) => (s.concepts[c] = (s.concepts[c] ?? 0) + 1));
  }
  s.levels[level.id] = l;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function useCondStats() {
  const [store, setStore] = useState<Store>({ levels: {}, concepts: {} });
  useEffect(() => {
    const load = () => setStore(read());
    load();
    window.addEventListener(EVT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVT, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  return store;
}

export type ConceptState = "new" | "practised" | "mastered";
export type ConceptRow = {
  concept: Concept;
  label: string;
  blurb: string;
  levels: string[]; // ids of levels that use it
  completed: number;
  state: ConceptState;
  mistakes: number;
  firstLevel: number; // 1-based level that introduces it
};

/**
 * practised = at least one level using it was played
 * mastered  = every level using it is complete
 */
export function conceptReport(levels: CondLevel[], stats: Store, done: Set<string>): ConceptRow[] {
  return (Object.keys(CONCEPTS) as Concept[]).map((c) => {
    const using = levels.filter((l) => l.concepts.includes(c));
    const completed = using.filter((l) => done.has(l.id)).length;
    const played = using.some((l) => done.has(l.id) || (stats.levels[l.id]?.runs ?? 0) > 0);
    const intro = levels.findIndex((l) => l.introduces.includes(c) || l.concepts.includes(c));
    return {
      concept: c,
      label: CONCEPTS[c].label,
      blurb: CONCEPTS[c].blurb,
      levels: using.map((l) => l.id),
      completed,
      state: using.length && completed === using.length ? "mastered" : played ? "practised" : "new",
      mistakes: stats.concepts[c] ?? 0,
      firstLevel: intro + 1,
    };
  });
}
