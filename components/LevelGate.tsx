"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import LevelPlayer from "./LevelPlayer";
import { LOOP_LEVELS, levelIndex } from "@/lib/loopLevels";
import { useProgress } from "@/lib/progress";

/** Levels unlock one after another. */
export default function LevelGate({ levelId }: { levelId: string }) {
  const { ready, done } = useProgress();
  if (!ready) return <main className="app" />;

  const i = levelIndex(levelId);
  const prev = LOOP_LEVELS[i - 1];
  if (prev && !done("loops").has(prev.id)) {
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
            <Link className="btn soft" href="/labs/loops">
              All levels
            </Link>
            <Link className="btn run" href={`/labs/loops/${prev.id}`}>
              Play {prev.title}
            </Link>
          </div>
        </div>
      </main>
    );
  }
  return <LevelPlayer key={levelId} levelId={levelId} />;
}
