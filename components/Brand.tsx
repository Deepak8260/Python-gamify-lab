import Link from "next/link";

export default function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="logo" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M8 7 3 12l5 5M16 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="brand-name">CodePlay Labs</span>
    </Link>
  );
}
