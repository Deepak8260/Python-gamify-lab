"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useProgress } from "@/lib/progress";

type Props = {
  lab: string;
  levels: { id: string; title: string }[];
  levelId: string;
  children: ReactNode;
};

/** Levels unlock one after another. */
export default function LevelGate({ lab, levels, levelId, children }: Props) {
  const { ready, done } = useProgress();
  if (!ready) return <main className="app" />;

  const i = levels.findIndex((l) => l.id === levelId);
  const prev = levels[i - 1];
  if (prev && !done(lab).has(prev.id)) {
    return (
      <main className="app locked-screen">
        <div className="locked-card">
          <div className="locked-icon">
            <Lock size={26} />
          </div>
          <h1>Level {i + 1} is locked</h1>
          <p>
            Finish <b>{prev.title}</b> first to unlock it.
          </p>
          <div className="result-actions">
            <Link className="btn soft" href={`/labs/${lab}`}>
              All levels
            </Link>
            <Link className="btn run" href={`/labs/${lab}/${prev.id}`}>
              Play {prev.title}
            </Link>
          </div>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
