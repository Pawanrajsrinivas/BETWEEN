/* ==========================================================================
   BETWEEN — vector artwork
   Everything here is inline SVG: no photographs, no people, no image files.
   All art is decorative (aria-hidden) and ignores pointer events via CSS.

   <ArtDefs /> must be rendered once per page. It holds the shared gradients
   and icon symbols that every other component references by id.
   ========================================================================== */

export function ArtDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e5233f" />
          <stop offset=".55" stopColor="#a30f29" />
          <stop offset="1" stopColor="#5c0817" />
        </linearGradient>
        <linearGradient id="gPetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d3183b" />
          <stop offset="1" stopColor="#6f0b20" />
        </linearGradient>
        <linearGradient id="gSnake" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b0d13" />
          <stop offset="1" stopColor="#0c0506" />
        </linearGradient>
        <radialGradient id="gGloss" cx=".3" cy=".25" r=".6">
          <stop offset="0" stopColor="#ffb3bf" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffb3bf" stopOpacity="0" />
        </radialGradient>

        {/* Fill icons */}
        <symbol id="i-heart" viewBox="0 0 64 64" fill="currentColor">
          <path d="M32 57C14 43 6 33 6 22 6 13 13 7 21 7c5 0 9 3 11 7 2-4 6-7 11-7 8 0 15 6 15 15 0 11-8 21-26 35z" />
        </symbol>
        <symbol id="i-flame" viewBox="0 0 64 64" fill="currentColor">
          <path d="M34 3c2 13 15 19 15 36 0 13-8 22-18 22S13 52 13 40c0-8 5-13 8-20 3 4 4 6 6 6 3-6 5-14 7-23z" />
        </symbol>
        <symbol id="i-lips" viewBox="0 0 64 64" fill="currentColor">
          <path d="M3 33c8-12 18-15 29-8 11-7 21-4 29 8-8 14-18 21-29 21S11 47 3 33z" />
          <path
            d="M6 33c10 4 18 4 26 0 8 4 16 4 26 0"
            fill="none"
            stroke="#0b0506"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id="i-petal" viewBox="0 0 64 64" fill="currentColor">
          <path d="M8 56C4 28 22 7 57 7c4 31-16 52-49 49z" />
          <path
            d="M12 52C28 38 40 26 52 12"
            fill="none"
            stroke="#0b0506"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id="i-moon" viewBox="0 0 64 64" fill="currentColor">
          <path d="M42 6a26 26 0 1 0 16 44A22 22 0 0 1 42 6z" />
          <path d="M50 14l1.6 4.4L56 20l-4.4 1.6L50 26l-1.6-4.4L44 20l4.4-1.6z" />
        </symbol>
        <symbol id="i-sparkle" viewBox="0 0 64 64" fill="currentColor">
          <path d="M32 2c2 14 6 18 18 20-12 2-16 6-18 20-2-14-6-18-18-20 12-2 16-6 18-20z" />
        </symbol>
        <symbol id="i-crown" viewBox="0 0 64 64" fill="currentColor">
          <path d="M8 48L4 18l16 12 12-20 12 20 16-12-4 30z" />
          <rect x="9" y="52" width="46" height="5" rx="2" />
        </symbol>

        {/* Stroke icons */}
        <symbol
          id="i-user"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="32" cy="22" r="11" />
          <path d="M10 58c0-12 10-20 22-20s22 8 22 20" />
        </symbol>
        <symbol
          id="i-copy"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="20" y="20" width="36" height="38" rx="6" />
          <path d="M44 20v-4a6 6 0 0 0-6-6H14a6 6 0 0 0-6 6v26a6 6 0 0 0 6 6h6" />
        </symbol>
        <symbol
          id="i-check"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 34l14 14 26-30" />
        </symbol>
        <symbol
          id="i-send"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M58 6L6 27l21 9 9 21z" />
          <path d="M27 36L58 6" />
        </symbol>
        <symbol
          id="i-chat"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M32 8C17 8 6 18 6 30c0 6 3 11 8 15l-2 11 12-6c2 .5 5 1 8 1 15 0 26-10 26-21S47 8 32 8z" />
        </symbol>
        <symbol
          id="i-dice"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M32 6l22 12v28L32 58 10 46V18z" />
          <path d="M10 18l22 12 22-12M32 30v28" />
          <circle cx="32" cy="18" r="1.5" fill="currentColor" />
        </symbol>
        <symbol
          id="i-leave"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M52 26A21 21 0 1 0 53 40" />
          <path d="M53 10v16H37" />
        </symbol>
        <symbol
          id="i-menu"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        >
          <path d="M10 18h44M10 32h44M10 46h44" />
        </symbol>
        <symbol
          id="i-back"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M40 10L18 32l22 22" />
        </symbol>
        <symbol
          id="i-close"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        >
          <path d="M14 14l36 36M50 14L14 50" />
        </symbol>
        <symbol
          id="i-users"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="24" cy="22" r="9" />
          <path d="M6 54c0-11 8-18 18-18s18 7 18 18" />
          <circle cx="46" cy="24" r="7" />
          <path d="M44 38c9 0 14 6 14 14" />
        </symbol>
        <symbol
          id="i-userplus"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="26" cy="22" r="10" />
          <path d="M6 54c0-11 9-18 20-18 5 0 9 1 12 3" />
          <path d="M48 34v18M39 43h18" />
        </symbol>
        <symbol
          id="i-userminus"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="26" cy="22" r="10" />
          <path d="M6 54c0-11 9-18 20-18 5 0 9 1 12 3" />
          <path d="M39 43h18" />
        </symbol>
        <symbol
          id="i-wifi"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 24c15-14 37-14 52 0M15 34c10-9 24-9 34 0M24 44c5-4 11-4 16 0" />
          <circle cx="32" cy="54" r="2" fill="currentColor" />
        </symbol>
        <symbol
          id="i-wifioff"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 24c15-14 37-14 52 0M15 34c10-9 24-9 34 0M24 44c5-4 11-4 16 0" />
          <circle cx="32" cy="54" r="2" fill="currentColor" />
          <path d="M10 8l44 48" />
        </symbol>
        <symbol
          id="i-lock"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="12" y="28" width="40" height="28" rx="6" />
          <path d="M20 28v-8a12 12 0 0 1 24 0v8" />
        </symbol>
        <symbol
          id="i-unlock"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="12" y="28" width="40" height="28" rx="6" />
          <path d="M20 28v-8a12 12 0 0 1 23-4" />
        </symbol>
        <symbol
          id="i-shield"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M32 6l20 8v16c0 14-9 24-20 28C21 54 12 44 12 30V14z" />
          <path d="M23 31l7 7 12-14" />
        </symbol>
        <symbol
          id="i-skip"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 14l24 18-24 18zM38 14l16 18-16 18" />
        </symbol>
        <symbol
          id="i-link"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M26 38a10 10 0 0 0 14 0l10-10a10 10 0 0 0-14-14l-4 4" />
          <path d="M38 26a10 10 0 0 0-14 0L14 36a10 10 0 0 0 14 14l4-4" />
        </symbol>
        <symbol
          id="i-globe"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="32" cy="32" r="24" />
          <path d="M8 32h48M32 8c-10 12-10 36 0 48M32 8c10 12 10 36 0 48" />
        </symbol>
        <symbol
          id="i-crownline"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 46l-2-26 14 12 12-20 12 20 14-12-2 26zM10 54h44" />
        </symbol>
        <symbol
          id="i-offline"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="18" y="8" width="28" height="48" rx="6" />
          <circle cx="32" cy="48" r="2" fill="currentColor" />
          <path d="M26 14h12" />
        </symbol>
        <symbol
          id="i-settings"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="32" cy="32" r="10" />
          <path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" />
        </symbol>
      </defs>
    </svg>
  );
}

/* Small inline icon that picks a symbol from <ArtDefs /> */
export function Icon({ name, className = "", size }) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      className={`icon ${className}`}
      style={style}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function Crest({ size = 32, className = "" }) {
  return (
    <div
      className={`crest-mark ${className}`}
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      aria-hidden="true"
    >
      <Rose className="crest-rose" />
    </div>
  );
}

export function Hairline({ style, className = "" }) {
  return <div className={`hairline-divider ${className}`} style={style} aria-hidden="true" />;
}

export function BackLink({ onClick, label = "Back" }) {
  return (
    <button type="button" className="icon-btn back-link-btn" onClick={onClick} aria-label={label}>
      <Icon name="back" />
    </button>
  );
}

/* A single drifting petal */
export function Petal({ className = "", style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 37C0 14 15 1 37 3c3 22-11 36-34 34z"
        fill="url(#gPetal)"
        stroke="#3a0510"
        strokeWidth="1"
      />
      <path
        d="M7 33C18 24 27 16 33 7"
        fill="none"
        stroke="#3a0510"
        strokeWidth="1"
        opacity=".7"
      />
    </svg>
  );
}

/* Scattered petals, laid out by percentage so they scale with any screen */
const PETAL_SETS = {
  home: [
    [4, 82, 34, 20, 0.9],
    [18, 92, 26, 150, 0.7],
    [46, 96, 30, -30, 0.8],
    [90, 88, 36, 70, 0.9],
    [62, 6, 20, 200, 0.5],
    [8, 40, 18, 30, 0.45],
  ],
  form: [
    [6, 12, 26, 40, 0.7],
    [90, 70, 32, 120, 0.8],
    [14, 88, 30, -20, 0.8],
    [78, 94, 22, 190, 0.6],
    [94, 30, 18, 60, 0.5],
  ],
  lobby: [
    [8, 80, 34, 20, 0.8],
    [86, 18, 24, 140, 0.6],
    [92, 84, 30, -50, 0.8],
    [20, 94, 22, 100, 0.6],
    [70, 6, 18, 20, 0.5],
  ],
  game: [
    [6, 90, 30, 30, 0.7],
    [48, 96, 26, 160, 0.7],
    [40, 4, 20, -40, 0.5],
    [58, 90, 34, 80, 0.8],
  ],
};

export function Decor({ variant = "home", chain = false }) {
  const petals = PETAL_SETS[variant] || PETAL_SETS.home;

  return (
    <div className="decor" aria-hidden="true">
      {petals.map(([x, y, size, rot, op], i) => (
        <Petal
          key={i}
          className="decor-petal"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            opacity: op,
            transform: `rotate(${rot}deg)`,
          }}
        />
      ))}
      {chain && <Chain className="decor-chain" />}
    </div>
  );
}

/* Vertical chain, used as a restrained edge detail */
export function Chain({ className = "" }) {
  const links = Array.from({ length: 11 });

  return (
    <svg
      className={className}
      viewBox="0 0 60 460"
      aria-hidden="true"
      focusable="false"
    >
      {links.map((_, i) => (
        <ellipse
          key={i}
          cx="30"
          cy={24 + i * 40}
          rx={i % 2 === 0 ? 13 : 5}
          ry="20"
          fill="none"
          stroke="#7b6a6e"
          strokeWidth="3.5"
        />
      ))}
    </svg>
  );
}

/* A rose: five rings of overlapping petals, with two dark leaves behind */
export function Rose({ className = "" }) {
  const ring = (scale, rotOffset, fill) =>
    [0, 72, 144, 216, 288].map((a) => (
      <path
        key={`${scale}-${a}`}
        transform={`rotate(${a + rotOffset} 60 60) translate(60 60) scale(${scale}) translate(-60 -60)`}
        d="M60 60C30 52 24 20 52 10 74 4 96 22 88 44 84 54 72 60 60 60z"
        fill={fill}
        stroke="#2c040c"
        strokeWidth={1.2 / scale}
        strokeLinejoin="round"
      />
    ));

  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M60 62C22 70 2 98 8 116c34-2 54-24 52-54z"
        fill="#1d080d"
        stroke="#5a0f1e"
        strokeWidth="1.5"
      />
      <path
        d="M62 60C70 24 96 8 114 14c0 34-22 52-52 46z"
        fill="#1d080d"
        stroke="#5a0f1e"
        strokeWidth="1.5"
      />
      {ring(1, 0, "url(#gPetal)")}
      {ring(0.74, 36, "#a3112c")}
      {ring(0.5, 8, "#c4163a")}
      {ring(0.28, 44, "#8a0e25")}
      <path
        d="M60 60m-5 0a5 5 0 1 1 5 5 8 8 0 0 1-8-8"
        fill="none"
        stroke="#2c040c"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Stylised heart with dripping liquid and a thin wisp of smoke */
export function Heart({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 -40 220 320"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M112 42C100 18 132 8 114-24"
        fill="none"
        stroke="#ff8a9c"
        strokeOpacity=".45"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M110 215C48 168 14 128 14 82 14 46 40 22 72 22c18 0 32 8 38 22 6-14 20-22 38-22 32 0 58 24 58 60 0 46-34 86-96 133z"
        fill="url(#gRed)"
      />
      {/* drips */}
      <path
        d="M66 176c0 20-4 34-4 52 0 14 20 14 20 0 0-18-4-32-4-52z"
        fill="url(#gRed)"
      />
      <path
        d="M102 205c0 22-4 40-4 54 0 12 20 12 20 0 0-14-4-32-4-54z"
        fill="url(#gRed)"
      />
      <path
        d="M146 172c0 16-2 28-2 40 0 10 14 10 14 0 0-12-2-24-2-40z"
        fill="url(#gRed)"
      />
      <path d="M128 236c0 8-6 12-6 12s-6-4-6-12 6-14 6-14 6 6 6 14z" fill="#b5122f" />
      {/* gloss */}
      <ellipse cx="70" cy="68" rx="46" ry="38" fill="url(#gGloss)" />
      <path
        d="M48 52c-10 12-14 28-8 44"
        fill="none"
        stroke="#fff"
        strokeOpacity=".4"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Coiled snake silhouette with a subtle scale texture */
export function Snake({ className = "" }) {
  const body =
    "M28 284C92 296 146 256 124 214 102 172 40 172 60 122 80 72 172 92 192 54 198 40 192 26 176 22";

  return (
    <svg
      className={className}
      viewBox="0 0 260 310"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={body}
        fill="none"
        stroke="#d3183b"
        strokeOpacity=".4"
        strokeWidth="31"
        strokeLinecap="round"
      />
      <path
        d={body}
        fill="none"
        stroke="url(#gSnake)"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <path
        d={body}
        fill="none"
        stroke="#fff"
        strokeOpacity=".05"
        strokeWidth="26"
        strokeDasharray="1 9"
      />
      <path
        d={body}
        fill="none"
        stroke="#ff6b83"
        strokeOpacity=".16"
        strokeWidth="5"
        strokeLinecap="round"
        transform="translate(-4 -4)"
      />
      {/* head */}
      <g transform="translate(176 20) rotate(-18)">
        <ellipse cx="0" cy="0" rx="26" ry="15" fill="#150709" stroke="#d3183b" strokeOpacity=".5" />
        <circle cx="6" cy="-3" r="2.4" fill="#ff3d5c" />
        <path
          d="M-22 0l-18-4M-22 0l-18 5"
          stroke="#e5233f"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/* Three playing cards: lips, heart, flame */
function Card({ x, y, rot, symbol, color }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect
        x="-45"
        y="-65"
        width="90"
        height="130"
        rx="9"
        fill="#12080a"
        stroke="#9a1a33"
        strokeWidth="1.6"
      />
      <rect
        x="-38"
        y="-58"
        width="76"
        height="116"
        rx="5"
        fill="none"
        stroke="#9a1a33"
        strokeOpacity=".45"
      />
      <use
        href={`#i-${symbol}`}
        x="-18"
        y="-18"
        width="36"
        height="36"
        style={{ color }}
      />
      <use href="#i-heart" x="-33" y="-53" width="9" height="9" style={{ color: "#9a1a33" }} />
      <use
        href="#i-heart"
        x="24"
        y="44"
        width="9"
        height="9"
        style={{ color: "#9a1a33" }}
        transform="rotate(180 28.5 48.5)"
      />
    </g>
  );
}

export function Cards({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 190"
      aria-hidden="true"
      focusable="false"
    >
      <Card x={78} y={104} rot={-24} symbol="lips" color="#d0213f" />
      <Card x={170} y={96} rot={-8} symbol="heart" color="#e5233f" />
      <Card x={254} y={110} rot={22} symbol="flame" color="#e5453a" />
    </svg>
  );
}

/* Hourglass with red sand — age gate and waiting states */
export function Hourglass({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 180"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M30 22h60c0 48-28 58-28 68s28 20 28 68H30c0-48 28-58 28-68S30 70 30 22z"
        fill="#fff"
        fillOpacity=".04"
        stroke="#ffc6cd"
        strokeOpacity=".65"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M40 40h40c-2 18-14 30-18 42h-4C54 70 42 58 40 40z" fill="url(#gRed)" />
      <path d="M60 84v48" stroke="#d3183b" strokeWidth="2" />
      <path d="M36 156c4-24 16-30 24-32 8 2 20 8 24 32z" fill="url(#gRed)" />
      <rect x="18" y="8" width="84" height="14" rx="4" fill="#2d0a11" stroke="#b01a38" strokeWidth="1.6" />
      <rect x="18" y="158" width="84" height="14" rx="4" fill="#2d0a11" stroke="#b01a38" strokeWidth="1.6" />
      <use href="#i-sparkle" x="-2" y="40" width="14" height="14" style={{ color: "#e5233f" }} />
      <use href="#i-sparkle" x="104" y="64" width="12" height="12" style={{ color: "#e5233f" }} />
      <use href="#i-sparkle" x="100" y="120" width="9" height="9" style={{ color: "#e5233f" }} />
    </svg>
  );
}

/* Large lips with a single drip — used as a gameplay accent */
export function LipsArt({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 110"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 56C26 28 52 24 80 40c28-16 54-12 74 16-22 30-48 44-74 44S28 86 6 56z"
        fill="url(#gRed)"
      />
      <path
        d="M10 58c24 8 44 8 70 0 26 8 46 8 70 0"
        fill="none"
        stroke="#2c040c"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M60 90c0 8-3 12-3 18s9 6 9-1c0-6-3-10-3-17z"
        fill="url(#gRed)"
      />
      <ellipse cx="46" cy="42" rx="22" ry="7" fill="url(#gGloss)" />
    </svg>
  );
}

/* Rose inside a ring — player avatar */
export function RoseAvatar({ className = "" }) {
  return (
    <span className={`rose-avatar ${className}`} aria-hidden="true">
      <Rose />
    </span>
  );
}

/* Mode illustrations (create-room cards) ---------------------------------- */

/* Online: a phone carrying a heart, with signal rising from it */
export function OnlineArt({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 120 90" aria-hidden="true" focusable="false">
      <path d="M78 22c7 6 7 16 0 22M86 15c11 10 11 28 0 38" fill="none" stroke="#ec3a58" strokeWidth="3" strokeLinecap="round" opacity=".75" />
      <path d="M94 8c15 14 15 40 0 54" fill="none" stroke="#ec3a58" strokeWidth="3" strokeLinecap="round" opacity=".4" />
      <rect x="28" y="10" width="42" height="72" rx="9" fill="url(#gSnake)" stroke="#a30f29" strokeWidth="2.5" />
      <rect x="33" y="19" width="32" height="50" rx="4" fill="#12080a" stroke="#3a1119" />
      <path d="M49 57C38 49 34 43 34 38c0-4 3-7 7-7 3 0 6 2 8 5 2-3 5-5 8-5 4 0 7 3 7 7 0 5-4 11-15 19z" fill="url(#gRed)" transform="translate(0 -4)" />
      <ellipse cx="42" cy="31" rx="4" ry="2.4" fill="url(#gGloss)" />
      <circle cx="49" cy="14.5" r="1.4" fill="#5a2a31" />
      <rect x="43" y="73" width="12" height="2.6" rx="1.3" fill="#5a2a31" />
      <path d="M12 60h20a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6h-9l-6 5v-5h-5a6 6 0 0 1-6-6v-6a6 6 0 0 1 6-6z" fill="#1a0a0d" stroke="#d11a3c" strokeWidth="2" transform="translate(-4 -6)" />
      <circle cx="10" cy="64" r="1.6" fill="#ec3a58" />
      <circle cx="16" cy="64" r="1.6" fill="#ec3a58" />
      <circle cx="22" cy="64" r="1.6" fill="#ec3a58" />
    </svg>
  );
}

/* Offline: two glasses meeting in a toast, a spark between them */
export function OfflineArt({ className = "" }) {
  const glass = (
    <g>
      <path d="M-13 -34h26c0 21-5 35-13 37-8-2-13-16-13-37z" fill="url(#gRed)" stroke="#e5233f" strokeWidth="2" strokeLinejoin="round" />
      <path d="M-13 -34h26" stroke="#ffb3bf" strokeWidth="2" opacity=".5" />
      <path d="M-8 -26c1 9 3 15 6 19" stroke="#ffb3bf" strokeWidth="2" strokeLinecap="round" opacity=".45" fill="none" />
      <path d="M0 3v24" stroke="#c98b95" strokeWidth="3" strokeLinecap="round" />
      <path d="M-11 29h22" stroke="#c98b95" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  );
  return (
    <svg className={className} viewBox="0 0 120 90" aria-hidden="true" focusable="false">
      <g transform="translate(42 50) rotate(-16)">{glass}</g>
      <g transform="translate(78 50) rotate(16)">{glass}</g>
      <path d="M60 14l2.6 7 7 2.6-7 2.6L60 33l-2.6-7-7-2.6 7-2.6z" fill="#e3b24d" />
      <path d="M48 8v6M45 11h6M74 6v5M71.5 8.5h5" stroke="#ec3a58" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 84h60" stroke="#3a1119" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
