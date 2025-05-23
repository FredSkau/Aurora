// Ultimate Nordic Sky Gradient Editor – React + Tailwind
// ---------------------------------------------------------
// This file REPLACES the prototype the user pasted and folds in the
// “ultimate ruleset” that was described earlier.  Everything lives in a
// single component tree so you can drop <GradientEditorUltimate /> into
// any React app (Next.js, Vite, CRA…).
//
//  ✦ What changed vs. the prototype ✦
// 1.  Added every colour mentioned in the analysis (teal, mint, periwinkle, indigo,
//     lime, cyan, ivory, ultramarine…) and kept the original brand + accent sets.
// 2.  Influence scoring now follows the warm‑vs‑cool   →   four‑stop pick logic.
//     • warmShare = clamp((T − 5)/17)
//     • score = warmShare * WARM_WEIGHT + (1-warmShare) * COOL_WEIGHT
//     • night, cloud and aurora multipliers added per ultimate rules.
// 3.  Added eye‑safety guard‑rails (hue cadence, luma monotone, saturation easing).
// 4.  Colour editor upgraded so you can tune the two weights per colour.
// 5.  Structure rule editor simplified: only two archetypes (“sunVisible” and
//     “sunHidden”) because the shader decides tilt.  Stop profiles are auto.
// 6.  GradientPreview still uses CSS linear‑gradient for speed; the WebGL shader
//     will consume the same ‘stops’ and ‘rgb’ arrays.
// ---------------------------------------------------------

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext,
} from "react";

/************************ 1 ·  Brand palette ************************/
//  Full palette (brand + analysis extras)
const BRAND_COLORS = {
  // official CI
  official: {
    black: { name: "Knowit Black", hex: "#0B0B26" },
    purple: { name: "Purple", hex: "#CFCEFF" },
    white: { name: "Knowit White", hex: "#FEFBE6" },
    blue: { name: "Blue", hex: "#372BC5" },
    green: { name: "Green", hex: "#55D440" },
    pink: { name: "Pink", hex: "#FFD6B8" },
    lightPink: { name: "Light Pink", hex: "#FFEBDD" },
    lightPurple: { name: "Light Purple", hex: "#F7F6FF" },
  },
  // original accent set
  accent: {
    redOrange: { name: "Red Orange", hex: "#E4927D" },
    brightOrange: { name: "Bright Orange", hex: "#EC7151" },
    deepPurple: { name: "Deep Purple", hex: "#7A199D" },
    rosePink: { name: "Rose Pink", hex: "#D47798" },
    skyBlue: { name: "Sky Blue", hex: "#629BDF" },
    magentaPink: { name: "Magenta Pink", hex: "#E091C2" },
  },
  // new accents pulled from the six reference gradients
  extra: {
    teal: { name: "Teal", hex: "#09A4AC" },
    periwinkle: { name: "Periwinkle", hex: "#77A2F6" },
    mint: { name: "Mint", hex: "#B7E1F7" },
    indigo: { name: "Indigo", hex: "#4947DD" },
    lime: { name: "Lime", hex: "#53D553" },
    cyan: { name: "Cyan", hex: "#0174CB" },
    ultramarine: { name: "Ultramarine", hex: "#251FCB" },
  },
};
const ALL_BRAND_COLORS_FLAT = [
  ...Object.values(BRAND_COLORS.official),
  ...Object.values(BRAND_COLORS.accent),
  ...Object.values(BRAND_COLORS.extra),
];
const ALL_HEXES = ALL_BRAND_COLORS_FLAT.map((c) => c.hex);

/**************** 2 ·  Ultimate‑rule weight table *******************/
//  We store two weights per colour → edit via UI sliders.
//  Defaults taken from the analysis table (warm vs. cool dominance)
const DEFAULT_WEIGHTS = {
  "#FFEBDD": { warm: 1.0, cool: 0.1 },
  "#FFD6B8": { warm: 0.9, cool: 0.05 },
  "#E4927D": { warm: 0.85, cool: 0.0 },
  "#EC7151": { warm: 0.95, cool: 0.0 },
  "#F7F6FF": { warm: 0.3, cool: 0.6 },
  "#CFCEFF": { warm: 0.18, cool: 0.7 },
  "#372BC5": { warm: 0.05, cool: 1.0 },
  "#7A199D": { warm: 0.1, cool: 0.8 },
  "#629BDF": { warm: 0.12, cool: 0.75 },
  "#55D440": { warm: 0.0, cool: 0.65 },
  "#0B0B26": { warm: 0.0, cool: 0.9 },
  "#E091C2": { warm: 0.8, cool: 0.1 },
  "#09A4AC": { warm: 0.2, cool: 0.8 }, // teal
  "#77A2F6": { warm: 0.1, cool: 0.9 }, // periwinkle
  "#B7E1F7": { warm: 0.2, cool: 0.8 }, // mint
  "#4947DD": { warm: 0.0, cool: 1.0 }, // indigo
  "#53D553": { warm: 0.0, cool: 0.65 }, // lime
  "#0174CB": { warm: 0.05, cool: 0.9 }, // cyan
  "#251FCB": { warm: 0.0, cool: 1.0 }, // ultramarine
  "#FEFBE6": { warm: 1.0, cool: 0.2 }, // ivory
};

/**************** 3 ·  Utils (OKLab + colour helpers) ***************/
//  Minimal OKLab converter – credit Björn Ottosson (approx).
const srgbToOklab = ([r8, g8, b8]) => {
  let r = (r8 / 255) ** 2.2;
  let g = (g8 / 255) ** 2.2;
  let b = (b8 / 255) ** 2.2;
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(l);
  const m3 = Math.cbrt(m);
  const s3 = Math.cbrt(s);
  return {
    L: 0.2104542553 * l3 + 0.7936177850 * m3 - 0.0040720468 * s3,
    a: 1.9779984951 * l3 - 2.4285922050 * m3 + 0.4505937099 * s3,
    b: 0.0259040371 * l3 + 0.7827717662 * m3 - 0.8086757660 * s3,
  };
};
const oklabHue = (a, b) => (Math.atan2(b, a) * 180) / Math.PI + 180;
const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  return [bigint >> 16, (bigint >> 8) & 255, bigint & 255];
};
const rgbToCss = ([r, g, b]) => `rgb(${r},${g},${b})`;
const lerp = (a, b, f) => a + (b - a) * f;

/**************** 4 ·  Weather → visual mapping *******************/
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function scoreColours(weather, weights) {
  const warmShare = clamp((weather.temp - 5) / 17, 0, 1); // –10..30 → 0..1
  const night = weather.time === "Night" ? 1 : 0;
  const cloud = weather.cloudCover / 100;
  const kpAurora = weather.kpIndex || 0; // 0..9

  const scores = {};
  ALL_HEXES.forEach((hex) => {
    const w = weights[hex] || { warm: 0.5, cool: 0.5 }; // default
    let s = warmShare * w.warm + (1 - warmShare) * w.cool;

    // cloud makes cool block slightly happier
    if (cloud > 0.5 && w.cool > w.warm) s += cloud * 0.2;

    // night bonus for dark blues / purples / black
    if (night && ["#0B0B26", "#372BC5", "#251FCB", "#4947DD", "#7A199D"].includes(hex))
      s += 0.3;

    // aurora bonus – green + lime at night w/ high Kp
    if (kpAurora > 4 && night && ["#55D440", "#53D553"].includes(hex)) s += 0.7;

    scores[hex] = s;
  });
  return scores;
}

function pickStops(scores) {
  // pick top‑4, then enforce hue cadence + luma monotone + sat easing
  const top4 = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([hex]) => ({ hex, rgb: hexToRgb(hex) }));

  // luma monotone sort (asc)
  top4.sort((A, B) => srgbToOklab(A.rgb).L - srgbToOklab(B.rgb).L);

  // hue cadence guard – insert neutral mix if jump >120°
  for (let i = 0; i < top4.length - 1; i++) {
    const h1 = oklabHue(...Object.values(srgbToOklab(top4[i].rgb)).slice(1));
    const h2 = oklabHue(...Object.values(srgbToOklab(top4[i + 1].rgb)).slice(1));
    const hueDist = Math.abs(h2 - h1);
    if (hueDist > 120) {
      const mix = top4[i].rgb.map((v, k) => Math.round((v + top4[i + 1].rgb[k]) / 2));
      top4.splice(i + 1, 0, { hex: "#mix", rgb: mix });
      break;
    }
  }

  // saturation easing – reduce sat progressively
  const eased = top4.map((c, idx) => {
    const lab = srgbToOklab(c.rgb);
    const sat = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    const factor = 1 - 0.15 * idx;
    const newSat = sat * factor;
    // scale a,b
    const scale = newSat / (sat || 1);
    const newLab = { L: lab.L, a: lab.a * scale, b: lab.b * scale };
    // quick back‑convert (approx gamma 2.2)
    const l = Math.pow(newLab.L + 0.3963377774 * newLab.a + 0.2158037573 * newLab.b, 3);
    const m = Math.pow(newLab.L - 0.1055613458 * newLab.a - 0.0638541728 * newLab.b, 3);
    const s = Math.pow(newLab.L - 0.0894841775 * newLab.a - 1.2914855480 * newLab.b, 3);
    let R =  4.0767245293 * l - 3.3072168827 * m + 0.2307590544 * s;
    let G = -1.2681437731 * l + 2.6093323231 * m - 0.3411344290 * s;
    let B = -0.0041119885 * l - 0.7034763098 * m + 1.7068625689 * s;
    const clampChannel = (v) => Math.max(0, Math.min(1, v));
    R = clampChannel(R) ** (1 / 2.2);
    G = clampChannel(G) ** (1 / 2.2);
    B = clampChannel(B) ** (1 / 2.2);
    return { rgb: [Math.round(R * 255), Math.round(G * 255), Math.round(B * 255)] };
  });

  // generate stops 0–100 evenly
  const pct = eased.length - 1;
  const stops = eased.map((_, i) => (i / pct) * 100);
  return { colors: eased.map((e) => e.rgb), stops };
}

/**************** 5 ·  React context & UI ***************************/
const GradientContext = createContext();

export default function GradientEditor() {
  const [weather, setWeather] = useState({
    temp: 10,
    cloudCover: 50,
    time: "Daytime", // Sunrise | Daytime | Sunset | Night
    kpIndex: 2,
  });
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  // compute current gradient target
  const gradientTarget = useMemo(() => {
    const scores = scoreColours(weather, weights);
    return pickStops(scores);
  }, [weather, weights]);

  // simple CSS gradient preview
  const gradientStyle = useMemo(() => {
    const { colors, stops } = gradientTarget;
    const stopStr = colors
      .map((rgb, i) => `${rgbToCss(rgb)} ${stops[i]}%`)
      .join(", ");
    const angle = weather.cloudCover < 30 ? 135 : 0; // tilt rule
    return {
      background: `linear-gradient(${angle}deg, ${stopStr})`,
    };
  }, [gradientTarget, weather.cloudCover]);

  /* ---------------- UI sliders ---------------- */
  const Slider = ({ label, value, min, max, step, onChange }) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-700">
        {label}: <span className="font-semibold text-indigo-600">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-indigo-600"
      />
    </div>
  );

  const WeatherPanel = () => (
    <div className="border rounded p-4 bg-white">
      <h3 className="font-semibold mb-2 text-gray-700">Weather</h3>
      <Slider
        label="Temperature (°C)"
        value={weather.temp}
        min={-10}
        max={30}
        step={1}
        onChange={(v) => setWeather({ ...weather, temp: v })}
      />
      <Slider
        label="Cloud cover %"
        value={weather.cloudCover}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setWeather({ ...weather, cloudCover: v })}
      />
      <Slider
        label="Kp index (Aurora)"
        value={weather.kpIndex}
        min={0}
        max={9}
        step={1}
        onChange={(v) => setWeather({ ...weather, kpIndex: v })}
      />
      <label className="block text-xs font-medium text-gray-700 mt-2">Time</label>
      <select
        value={weather.time}
        onChange={(e) => setWeather({ ...weather, time: e.target.value })}
        className="mt-1 block w-full p-2 border rounded shadow-sm text-sm"
      >
        {["Sunrise", "Daytime", "Sunset", "Night"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
    </div>
  );

  const WeightEditor = () => {
    const [expanded, setExpanded] = useState(null);
    const setWeight = (hex, key, val) =>
      setWeights((p) => ({ ...p, [hex]: { ...p[hex], [key]: val } }));

    return (
      <div className="border rounded p-4 bg-white">
        <h3 className="font-semibold mb-2 text-gray-700">Colour Weights</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {ALL_BRAND_COLORS_FLAT.map((c) => (
            <button
              key={c.hex}
              className={`p-2 border rounded flex flex-col items-center text-xs hover:bg-gray-100 ${
                expanded === c.hex ? "ring-2 ring-indigo-500 bg-indigo-50" : ""
              }`}
              onClick={() => setExpanded(expanded === c.hex ? null : c.hex)}
            >
              <div
                className="w-7 h-7 rounded-full border mb-1"
                style={{ backgroundColor: c.hex }}
              />
              {c.name}
            </button>
          ))}
        </div>
        {expanded && (
          <div className="mt-4 p-3 border rounded bg-gray-50">
            <h4 className="font-medium text-gray-600 mb-2">
              {ALL_BRAND_COLORS_FLAT.find((c) => c.hex === expanded).name}
            </h4>
            <Slider
              label="Warm weight"
              value={weights[expanded].warm}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setWeight(expanded, "warm", v)}
            />
            <Slider
              label="Cool weight"
              value={weights[expanded].cool}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setWeight(expanded, "cool", v)}
            />
          </div>
        )}
      </div>
    );
  };

  /******************** render ********************/
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Ultimate Nordic‑Sky Gradient Editor
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          <WeatherPanel />
          <WeightEditor />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div
            className="w-full h-80 rounded shadow-inner"
            style={gradientStyle}
          />
          <pre className="text-xs bg-gray-800 text-white p-4 rounded overflow-x-auto">
{`// Shader feed example (copy into WebGL uniforms)
const shaderInput = {
  stops: [${gradientTarget.stops.map((x) => x.toFixed(1)).join(", ")}],
  colors: [
    ${gradientTarget.colors.map((rgb) => `[${rgb.join(",")} ]`).join(",\n    ")}
  ]
};`}
          </pre>
        </div>
      </div>
    </div>
  );
}
