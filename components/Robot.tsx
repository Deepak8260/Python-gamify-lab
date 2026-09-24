type Props = { happy?: boolean; busy?: boolean };

export default function Robot({ happy, busy }: Props) {
  return (
    <svg viewBox="0 0 100 124" className="robot-svg" aria-hidden>
      <defs>
        <linearGradient id="rb-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe3ee" />
        </linearGradient>
        <linearGradient id="rb-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <radialGradient id="rb-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c7d2fe" />
          <stop offset="1" stopColor="#6366f1" />
        </radialGradient>
      </defs>

      {/* antenna */}
      <line x1="50" y1="8" x2="50" y2="22" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="8" r="5.5" className={busy ? "rb-antenna busy" : "rb-antenna"} />

      {/* arms */}
      <g className={happy ? "rb-arms happy" : "rb-arms"}>
        <rect x="14" y="70" width="10" height="24" rx="5" fill="#cbd5e1" className="rb-arm-l" />
        <rect x="76" y="70" width="10" height="24" rx="5" fill="#cbd5e1" className="rb-arm-r" />
      </g>

      {/* legs */}
      <rect x="33" y="100" width="12" height="17" rx="5" fill="#94a3b8" />
      <rect x="55" y="100" width="12" height="17" rx="5" fill="#94a3b8" />
      <rect x="30" y="112" width="18" height="8" rx="4" fill="#475569" />
      <rect x="52" y="112" width="18" height="8" rx="4" fill="#475569" />

      {/* body */}
      <rect x="25" y="64" width="50" height="40" rx="12" fill="url(#rb-body)" />
      <circle cx="50" cy="83" r="8" fill="url(#rb-core)" className="rb-core" />

      {/* head */}
      <rect x="16" y="20" width="68" height="46" rx="18" fill="url(#rb-head)" />
      <rect x="24" y="30" width="52" height="26" rx="13" fill="#0f172a" />
      {happy ? (
        <g stroke="#67e8f9" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M36 46 q5 -8 10 0" />
          <path d="M56 46 q5 -8 10 0" />
        </g>
      ) : (
        <g className="rb-eyes" fill="#67e8f9">
          <rect x="37" y="37" width="9" height="12" rx="4.5" />
          <rect x="57" y="37" width="9" height="12" rx="4.5" />
        </g>
      )}
      <rect x="22" y="23" width="30" height="5" rx="2.5" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}
