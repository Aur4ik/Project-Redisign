import React from "react";
function CarArt({ car, hero = false }) {
  const suv = car.body === "Кроссовер";
  return (
    <svg
      viewBox="0 0 640 310"
      role="img"
      aria-label={`Иллюстрация ${car.brand} ${car.model}`}
      className={hero ? "car-art hero-car" : "car-art"}
    >
      <ellipse cx="330" cy="260" rx="265" ry="20" fill="#000" opacity=".1" />
      <path
        d={
          suv
            ? "M68 209 L83 160 Q92 146 148 139 L207 77 Q220 65 251 65 L408 65 Q434 65 450 89 L486 137 L558 151 Q586 157 592 189 L586 230 L69 230 Z"
            : "M61 214 L81 180 Q98 165 159 153 L229 100 Q245 88 276 88 L392 88 Q415 88 443 111 L492 150 L560 168 Q582 174 591 207 L581 233 L67 233 Z"
        }
        fill={car.color}
        stroke="#27302f"
        strokeWidth="3"
      />
      <path
        d={
          suv
            ? "M169 138 L224 84 L295 84 L295 138 Z M311 84 L402 84 Q418 84 435 105 L457 138 L311 138 Z"
            : "M185 150 L243 107 L296 107 L296 150 Z M312 107 L387 107 Q406 107 429 126 L459 150 L312 150 Z"
        }
        fill="#253a40"
        stroke="#c6d5d4"
        strokeWidth="2"
      />
      <path
        d="M81 187 Q290 169 560 184 M306 155 L306 222 M469 155 L474 219"
        fill="none"
        stroke="#27302f"
        opacity=".35"
        strokeWidth="2"
      />
      <rect x="321" y="166" width="24" height="5" rx="2" fill="#233330" />
      <rect x="191" y="166" width="22" height="5" rx="2" fill="#233330" />
      <path
        d="M80 186 L125 184 L117 201 L72 203 M534 178 L577 188 L581 201 L542 196"
        fill="#f4f3de"
      />
      <path
        d="M254 115 L275 115 M328 115 L375 115"
        stroke="#cde3df"
        opacity=".3"
        strokeWidth="5"
      />
      <path d="M73 221 L587 221" stroke="#233330" strokeWidth="8" />
      <Wheel x={166} />
      <Wheel x={491} />
      <path
        d="M94 214 L116 214 M546 214 L572 214"
        stroke="#7b8583"
        strokeWidth="4"
      />
    </svg>
  );
}
function Wheel({ x }) {
  return (
    <g>
      <circle cx={x} cy="230" r="43" fill="#222829" />
      <circle cx={x} cy="230" r="29" fill="#a7b0ae" />
      <circle cx={x} cy="230" r="21" fill="#4a5556" />
      {[0, 60, 120].map((a) => (
        <path
          key={a}
          d={`M${x - 23} 230 L${x + 23} 230`}
          stroke="#cdd5d2"
          strokeWidth="6"
          transform={`rotate(${a} ${x} 230)`}
        />
      ))}
      <circle cx={x} cy="230" r="7" fill="#c3cbc6" />
    </g>
  );
}

export default CarArt;
