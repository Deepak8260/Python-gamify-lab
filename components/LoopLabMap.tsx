"use client";

import Link from "next/link";
import { Check, ChevronLeft, Lock, Play } from "lucide-react";
import { LOOP_LEVELS, TRACKS } from "@/lib/loopLevels";
import { useProgress } from "@/lib/progress";
import SoundToggle from "./SoundToggle";

export default function LoopLabMap() {
  const { done, totalXp, ready } = useProgress();
  const d = done("loops");
  const nextUp = LOOP_LEVELS.find((l) => !d.has(l.id));

  return (
    <main className="app">
      <header className="topbar">
        <div className="crumbs">
          <Link href="/" className="back">
            <ChevronLeft size={18} />
            <span>All labs</span>
          </Link>
        </div>
        <div className="topbar-right">
          <span className="xp-chip">{totalXp} XP</span>
          <SoundToggle />
        </div>
      </header>

      <section className="lab-hero">
        <div>
          <span className="eyebrow">Lab 1</span>
          <h1>Loop Lab</h1>
          <p>Make things happen again and again. Guide Robo across the bridge, then get a rocket ready for lift-off.</p>
        </div>
        <div className="lab-hero-side">
          <div className="lab-progress big">
            <div className="bar">
              <i style={{ width: `${(d.size / LOOP_LEVELS.length) * 100}%` }} />
            </div>
            <span>
              {d.size} / {LOOP_LEVELS.length} levels
            </span>
          </div>
          {ready && nextUp && (
            <Link className="btn run" href={`/labs/loops/${nextUp.id}`}>
              <Play size={16} fill="currentColor" />
              {d.size ? "Continue" : "Start"}
            </Link>
          )}
        </div>
      </section>

      {TRACKS.map((t) => (
        <section key={t.id} className={`track track-${t.id}`}>
          <div className="track-head">
            <span className="track-emoji" aria-hidden>
              {t.id === "for" ? "🤖" : "🚀"}
            </span>
            <div>
              <h2>{t.title}</h2>
              <p>{t.blurb}</p>
            </div>
          </div>
          <div className="level-grid">
            {t.levels.map((l) => {
              const i = LOOP_LEVELS.indexOf(l);
              const prev = LOOP_LEVELS[i - 1];
              const unlocked = !prev || d.has(prev.id);
              const complete = d.has(l.id);
              const body = (
                <>
                  <span className="lv-num">{i + 1}</span>
                  <span className="lv-title">{l.title}</span>
                  <span className="lv-state">
                    {complete ? <Check size={16} /> : unlocked ? <Play size={14} fill="currentColor" /> : <Lock size={14} />}
                  </span>
                </>
              );
              return unlocked ? (
                <Link key={l.id} href={`/labs/loops/${l.id}`} className={`level-card ${complete ? "complete" : "open"} ${nextUp?.id === l.id ? "next" : ""}`}>
                  {body}
                </Link>
              ) : (
                <div key={l.id} className="level-card locked" aria-disabled>
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
