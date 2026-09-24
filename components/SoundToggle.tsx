"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { setMuted } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setM] = useState(false);

  useEffect(() => {
    try {
      const m = localStorage.getItem("codeplay-muted") === "1";
      setM(m);
      setMuted(m);
    } catch {}
  }, []);

  const toggle = () => {
    const m = !muted;
    setM(m);
    setMuted(m);
    try {
      localStorage.setItem("codeplay-muted", m ? "1" : "0");
    } catch {}
  };

  return (
    <button className="icon-btn" onClick={toggle} aria-label={muted ? "Turn sound on" : "Turn sound off"} title={muted ? "Sound off" : "Sound on"}>
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}
