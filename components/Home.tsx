"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { LABS } from "@/lib/labs";
import { useProgress } from "@/lib/progress";
import SoundToggle from "./SoundToggle";
import Brand from "./Brand";
import Robot from "./Robot";

export default function Home() {
  const { done, totalXp } = useProgress();

  return (
    <main className="app home">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <span className="xp-chip">{totalXp} XP</span>
          <SoundToggle />
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Python, the fun way</span>
          <h1>
            Learn to code by <span className="grad">playing</span>.
          </h1>
          <p>
            Each lab is a small game where your Python code controls what happens. Write it, run it, watch it, fix it,
            and try again.
          </p>
          <Link href="/labs/loops" className="btn run hero-cta">
            Start with Loop Lab
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="hero-art" aria-hidden>
          <div className="hero-code">
            <span className="k">for</span> i <span className="k">in</span> <span className="f">range</span>(
            <span className="n">5</span>):
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="f">print</span>(i)
          </div>
          <div className="hero-robot">
            <Robot happy />
          </div>
          <div className="hero-blocks">
            {[0, 1, 2, 3, 4].map((n) => (
              <i key={n} className={n === 4 ? "goal" : ""}>
                {n}
              </i>
            ))}
          </div>
          <div className="hero-ball" />
        </div>
      </section>

      <section>
        <h2 className="section-title">Labs</h2>
        <div className="lab-grid">
          {LABS.map((lab) => {
            const n = done(lab.slug).size;
            const live = lab.status === "live";
            const inner = (
              <>
                <div className="lab-top">
                  <span className="lab-emoji" style={{ background: `${lab.accent}1a` }}>
                    {lab.emoji}
                  </span>
                  {live ? (
                    <span className="lab-badge live">Play</span>
                  ) : (
                    <span className="lab-badge soon">
                      <Lock size={12} /> Coming soon
                    </span>
                  )}
                </div>
                <h3>{lab.title}</h3>
                <p>{lab.tagline}</p>
                <div className="lab-tags">
                  {lab.concepts.map((c) => (
                    <code key={c}>{c}</code>
                  ))}
                </div>
                {live && lab.levels && (
                  <div className="lab-progress">
                    <div className="bar">
                      <i style={{ width: `${(n / lab.levels) * 100}%`, background: lab.accent }} />
                    </div>
                    <span>
                      {n} / {lab.levels} levels
                    </span>
                  </div>
                )}
              </>
            );
            return live ? (
              <Link key={lab.slug} href={`/labs/${lab.slug}`} className="lab-card live" style={{ ["--accent" as string]: lab.accent }}>
                {inner}
              </Link>
            ) : (
              <div key={lab.slug} className="lab-card soon" aria-disabled>
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="foot">Progress is saved in this browser.</footer>
    </main>
  );
}
