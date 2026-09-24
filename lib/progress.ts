"use client";

import { useCallback, useEffect, useState } from "react";

/* Progress lives in the browser (localStorage), so no backend is needed. */

const KEY = "codeplay-progress-v1";
const EVT = "codeplay-progress";
export const XP_PER_LEVEL = 20;

type Store = Record<string, string[]>; // lab slug -> completed level ids

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function useProgress() {
  const [store, setStore] = useState<Store>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => setStore(read());
    load();
    setReady(true);
    window.addEventListener(EVT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const done = useCallback((lab: string) => new Set(store[lab] ?? []), [store]);

  const markDone = useCallback((lab: string, id: string) => {
    const s = read();
    const list = new Set(s[lab] ?? []);
    list.add(id);
    s[lab] = [...list];
    write(s);
  }, []);

  const totalXp = Object.values(store).reduce((n, l) => n + l.length * XP_PER_LEVEL, 0);

  return { ready, done, markDone, totalXp };
}
