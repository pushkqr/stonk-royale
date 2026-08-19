import { memo } from "react";
import { ARCHETYPES } from "../lib/avatars";

const VOID_DEEP = "#1b0a28";

/**
 * Mood is carried by the ring, not by the face.
 *
 * The old overlays drew eyes at fixed coordinates, which only worked because every
 * archetype was a face — and at the 36px these actually render at, those eyes were about
 * three pixels tall. A ring is one signal that reads identically on all nine marks and
 * survives the size. Non-neutral moods thicken it as well as recolour it, so the state
 * still registers on the archetypes whose own colour happens to match the mood colour.
 */
const RINGS = {
  neutral: ["#56287a", 2.5],
  laser: ["#21e07a", 4],
  rekt: ["#ff3b54", 4],
  liar: ["#ffe81a", 4],
};

/**
 * Geometry on a 64x64 grid: "p" polygon, "r" rect, "e" ellipse. `s` is the silhouette,
 * `c` is cut back out of it in the ground colour.
 *
 * Every shape, offset print included, sits inside r=29.5 of the r=30 ring, which is why
 * none of this needs a clip path. Do not nudge the numbers.
 */
const MARKS = {
  banker: {
    s: [
         ["r", 25, 17, 4, 10], ["r", 35, 17, 4, 10], ["r", 25, 17, 14, 4],
         ["r", 12, 27, 40, 23],
    ],
    c: [
         ["r", 29, 33, 6, 6],
    ],
  },
  ape: {
    s: [
         ["p", [[22, 19], [42, 19], [47, 28], [32, 55], [17, 28]]],
    ],
    c: [
         ["p", [[25, 19], [28, 19], [31, 28], [28, 28]]],
         ["p", [[39, 19], [36, 19], [33, 28], [36, 28]]],
    ],
  },
  moon: {
    s: [
         ["p", [[32, 8], [41, 28], [41, 45], [23, 45], [23, 28]]],
         ["p", [[23, 35], [14, 50], [23, 46]]], ["p", [[41, 35], [50, 50], [41, 46]]],
         ["p", [[27, 45], [37, 45], [32, 58]]],
    ],
    c: [],
  },
  insider: {
    s: [
         ["p", [[20, 31], [20, 21], [26, 14], [38, 14], [44, 21], [44, 31]]],
         ["e", 32, 31, 21, 4.5], ["r", 22, 38, 8, 4], ["r", 34, 38, 8, 4],
    ],
    c: [],
  },
  quant: {
    s: [
         ["r", 15, 35, 8.5, 17], ["r", 27.75, 25, 8.5, 27], ["r", 40.5, 15, 8.5, 37],
    ],
    c: [],
  },
  bull: {
    s: [
         ["p", [[24, 33], [40, 33], [37, 51], [27, 51]]],
         ["p", [[25, 35], [15, 31], [8, 20], [15, 21], [23, 29], [27, 33]]],
         ["p", [[39, 35], [49, 31], [56, 20], [49, 21], [41, 29], [37, 33]]],
    ],
    c: [],
  },
  bear: {
    s: [
         ["e", 17, 27, 5, 6], ["e", 26, 21, 5.5, 6.5], ["e", 38, 21, 5.5, 6.5],
         ["e", 47, 27, 5, 6], ["e", 32, 42, 13.5, 10.5],
    ],
    c: [],
  },
  degen: {
    s: [
         ["p", [[32, 7], [39, 20], [36, 26], [43, 23], [41, 34], [46, 41], [41, 51], [32, 57], [23, 51], [18, 41], [23, 34], [21, 23], [28, 26], [25, 20]]],
    ],
    c: [],
  },
  whale: {
    s: [
         ["p", [[8, 36], [14, 27], [26, 24], [38, 28], [45, 34], [50, 30], [49, 15], [56, 20], [55, 43], [49, 40], [44, 39], [36, 44], [22, 45], [11, 41]]],
         ["p", [[26, 24], [31, 15], [35, 25]]],
    ],
    c: [
         ["e", 15, 32, 2.1, 2.1],
    ],
  },
};

function shape(op, i, fill, dx, dy) {
  if (op[0] === "p") {
    return (
      <polygon key={i} fill={fill}
        points={op[1].map(([x, y]) => `${x + dx},${y + dy}`).join(" ")} />
    );
  }
  if (op[0] === "r") {
    return (
      <rect key={i} fill={fill}
        x={op[1] + dx} y={op[2] + dy} width={op[3]} height={op[4]} />
    );
  }
  return (
    <ellipse key={i} fill={fill}
      cx={op[1] + dx} cy={op[2] + dy} rx={op[3]} ry={op[4]} />
  );
}

function Avatar({
  archetypeId = "banker",
  mood = "neutral",
  size = 36,
  className = "",
}) {
  const archetype = ARCHETYPES.find((a) => a.id === archetypeId) || ARCHETYPES[0];
  const mark = MARKS[archetype.id];
  const [ring, weight] = RINGS[mood] || RINGS.neutral;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`avatar-svg avatar-${archetype.id} mood-${mood} ${className}`}
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="32" cy="32" r="30" fill={VOID_DEEP} stroke={ring} strokeWidth={weight} />
      <g opacity="0.9">
        {mark.s.map((op, i) => shape(op, i, archetype.print, 1.7, 1.5))}
      </g>
      {mark.s.map((op, i) => shape(op, i, archetype.accent, 0, 0))}
      {mark.c.map((op, i) => shape(op, i, VOID_DEEP, 0, 0))}
    </svg>
  );
}

export default memo(Avatar);
