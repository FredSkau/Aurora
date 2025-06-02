import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Leva, useControls, folder } from "leva";
import * as THREE from "three";
import glsl from "babel-plugin-glsl/macro";

// ──────────────────────────────────────────────────────────────
// General‑purpose helpers
// ──────────────────────────────────────────────────────────────
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const { tanh } = Math;
const parseISO = (iso) => new Date(iso);

// Colour conversions
function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

// ──────────────────────────────────────────────────────────────
// Palette constants
// ──────────────────────────────────────────────────────────────
const REFERENCE_PALETTES = {
  CR: {
    name: "CloudyRain",
    bands: [
      { hue: [240, 255], sat: [50, 65], light: [85, 95] },
      { hue: [250, 265], sat: [45, 60], light: [70, 80] },
      { hue: [250, 270], sat: [50, 70], light: [55, 65] },
      { hue: [220, 240], sat: [65, 85], light: [45, 60] },
      { hue: [180, 195], sat: [45, 65], light: [50, 65] },
      { hue: [210, 230], sat: [70, 85], light: [35, 45] },
    ],
  },
  HR: {
    name: "HeavyRain",
    bands: [
      { hue: [115, 125], sat: [80, 95], light: [45, 60] },
      { hue: [210, 230], sat: [50, 70], light: [55, 70] },
      { hue: [240, 255], sat: [45, 65], light: [50, 65] },
      { hue: [220, 235], sat: [55, 75], light: [45, 55] },
      { hue: [185, 200], sat: [50, 70], light: [40, 55] },
      { hue: [230, 250], sat: [80, 95], light: [25, 40] },
    ],
  },
  EV: {
    name: "Evening",
    bands: [
      { hue: [200, 215], sat: [65, 80], light: [40, 55] },
      { hue: [175, 190], sat: [55, 75], light: [50, 65] },
      { hue: [215, 235], sat: [40, 60], light: [60, 75] },
      { hue: [240, 255], sat: [35, 55], light: [65, 75] },
      { hue: [200, 220], sat: [25, 40], light: [80, 90] },
    ],
  },
  MD: {
    name: "MiddayClear",
    bands: [
      { hue: [235, 250], sat: [70, 85], light: [30, 45] },
      { hue: [265, 280], sat: [45, 65], light: [40, 55] },
      { hue: [290, 310], sat: [35, 55], light: [55, 70] },
      { hue: [15, 30], sat: [50, 70], light: [60, 75] },
      { hue: [270, 285], sat: [20, 35], light: [70, 85] },
      { hue: [210, 225], sat: [35, 55], light: [65, 80] },
    ],
  },
  AG: {
    name: "Afterglow",
    bands: [
      { hue: [0, 15], sat: [10, 20], light: [85, 95] },
      { hue: [20, 35], sat: [45, 65], light: [55, 70] },
      { hue: [280, 300], sat: [40, 60], light: [50, 65] },
      { hue: [250, 265], sat: [75, 90], light: [35, 50] },
      { hue: [25, 40], sat: [35, 55], light: [65, 80] },
    ],
  },
  SD: {
    name: "SummerDusk",
    bands: [
      { hue: [250, 265], sat: [65, 80], light: [40, 55] },
      { hue: [280, 295], sat: [45, 65], light: [50, 65] },
      { hue: [310, 330], sat: [40, 60], light: [60, 75] },
      { hue: [340, 355], sat: [35, 55], light: [65, 80] },
      { hue: [10, 25], sat: [30, 50], light: [70, 85] },
      { hue: [0, 15], sat: [15, 30], light: [80, 90] },
    ],
  },
  CL: {
    name: "Cloudy",
    bands: [
      { hue: [250, 265], sat: [25, 40], light: [85, 95] },
      { hue: [255, 270], sat: [35, 50], light: [65, 80] },
      { hue: [260, 275], sat: [40, 55], light: [55, 70] },
      { hue: [250, 265], sat: [25, 40], light: [85, 95] },
    ],
  },
  AU: {
    name: "Aurora",
    bands: [
      { hue: [240, 260], sat: [70, 90], light: [10, 20] },
      { hue: [120, 140], sat: [60, 80], light: [35, 50] },
      { hue: [160, 180], sat: [50, 70], light: [40, 55] },
      { hue: [280, 300], sat: [60, 80], light: [35, 50] },
      { hue: [300, 320], sat: [65, 85], light: [30, 45] },
    ],
  },
};

// ──────────────────────────────────────────────────────────────
// Deterministic hash (FNV‑1a)
// ──────────────────────────────────────────────────────────────
function generateHash(obj) {
  let hash = 2166136261;
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

// ──────────────────────────────────────────────────────────────
// Gradient builder
// ──────────────────────────────────────────────────────────────
export function buildGradient(feel) {
  const hash = generateHash(feel);
  const hashBytes = Array.from(
    { length: 32 },
    (_, i) => (hash * (i + 1) * 9999) & 0xff
  );

  // Derived parameters
  const storm = clamp(feel.rain_intensity * 0.7 + feel.gloom * 0.3);
  const drama =
    storm * 0.4 + feel.windiness * 0.3 + Math.abs(feel.pressure_trend) * 0.3;
  const serenity = (1 - drama) * (1 - feel.rain_intensity) * feel.brightness;
  const melancholy = feel.gloom * feel.humidity * (1 - feel.brightness);
  const electric =
    (feel.rain_intensity > 0.7 ? feel.rain_intensity : 0) +
    feel.twilight * feel.golden;
  const mystical = feel.twilight * (1 - feel.rain_intensity) * feel.humidity;
  const haziness = feel.humidity * feel.gloom * (1 - feel.windiness);
  const pressureDir = Math.sign(feel.pressure_trend);
  const tempDrift = (feel.warmth_change + 1) / 2;
  const gold = Math.max(feel.golden, feel.twilight);

  const derived = {
    storm,
    drama,
    serenity,
    melancholy,
    electric,
    mystical,
    haziness,
    pressureDir,
    tempDrift,
    gold,
  };

  const palette = selectPalette(feel, derived, hashBytes[0]);

  const stopData = generateStops(feel, derived, hashBytes);
  const colors = generateColors(feel, derived, palette, stopData, hashBytes);

  return validateAndCorrect({ colors, stops: stopData.stops }, feel);

  // ---------------------------------------------------------------------------
  // Helper functions
  // ---------------------------------------------------------------------------
  function selectPalette(feel, d) {
    if (feel.night === 1 && d.storm < 0.4 && feel.twilight < 0.2)
      return REFERENCE_PALETTES.AU;
    if (d.storm >= 0.5) return REFERENCE_PALETTES.HR;
    if (d.gold >= 0.5)
      return feel.gloom < 0.4 ? REFERENCE_PALETTES.AG : REFERENCE_PALETTES.SD;
    if (feel.brightness >= 0.6 && feel.gloom <= 0.3)
      return REFERENCE_PALETTES.MD;
    if (feel.rain_intensity > 0) return REFERENCE_PALETTES.CR;
    if (feel.gloom > 0.4) return REFERENCE_PALETTES.CL;
    return feel.warmth < 0.4 ? REFERENCE_PALETTES.EV : REFERENCE_PALETTES.SD;
  }

  function generateStops(feel, d, hb) {
    // Determine stop count
    let count =
      6 +
      (d.drama > 0.7) -
      (d.haziness > 0.7) +
      (feel.windiness > 0.8) +
      (d.mystical > 0.6);
    count = Math.max(4, Math.min(8, count));

    let pattern = "balanced";
    if (d.drama > 0.6) pattern = "dramatic";
    else if (d.serenity > 0.7) pattern = "flowing";
    else if (d.electric > 0.6) pattern = "horizon";
    else if (d.melancholy > 0.6) pattern = "weighted";

    // base stops generator map
    const gens = {
      dramatic: (c) => {
        const s = [0];
        const z1 = 0.35 + (hb[5] / 255) * 0.1;
        const z2 = 0.65 + (hb[6] / 255) * 0.1;
        if (c <= 5) s.push(z1, z1 + 0.06, 1);
        else if (c === 6) s.push(0.2, z1, z1 + 0.05, z2, 1);
        else if (c === 7) s.push(0.15, z1, z1 + 0.05, 0.5, z2, z2 + 0.05, 1);
        else s.push(0.1, 0.25, z1, z1 + 0.05, 0.55, z2, z2 + 0.05, 1);
        return s;
      },
      flowing: (c) => Array.from({ length: c }, (_, i) => i / (c - 1)),
      horizon: (c) => {
        const h = 0.4 + feel.sun_elevation * 0.2;
        const s = [0, h - 0.05, h + 0.05, 1];
        if (c <= 4) return s;
        const before = Math.floor((c - 3) / 2);
        const after = c - 3 - before;
        const add = [];
        for (let i = 1; i <= before; i++) add.push(h * (i / (before + 1)));
        add.push(h - 0.04, h + 0.04);
        for (let i = 1; i <= after; i++)
          add.push(h + (1 - h) * (i / (after + 1)));
        add.push(1);
        return [0, ...add];
      },
      weighted: (c) => {
        const w = 0.7;
        const s = [0];
        for (let i = 1; i < c - 1; i++) {
          const t = i / (c - 1);
          const eased = t * t * (3 - 2 * t);
          s.push(eased * w + t * (1 - w));
        }
        s.push(1);
        return s;
      },
      balanced: (c) => {
        const acc = 0.3 + (hb[7] / 255) * 0.4;
        return Array.from({ length: c }, (_, i) => {
          let p = i / (c - 1);
          if (i > 0 && i < c - 1 && Math.abs(p - acc) < 0.15)
            p = acc + (p - acc) * 0.5;
          return p;
        });
      },
    };

    let stops = gens[pattern](count);

    // Jitter & skew
    stops = stops.map((s, i) =>
      i === 0 || i === stops.length - 1
        ? s
        : clamp(s + (hb[i + 8] / 255 - 0.5) * 0.03 * feel.windiness)
    );
    const skew = pressureDir * 0.05 + (tempDrift - 0.5) * 0.03;
    stops = stops.map((s, i) =>
      i === 0 || i === stops.length - 1
        ? s
        : clamp(s + skew * (1 - Math.abs(2 * s - 1)))
    );

    return { stops, pattern, count };
  }

  function generateColors(feel, d, palette, stopData, hb) {
    const assignments = assignBands(palette, stopData, d, hb);
    return assignments.map((bandIdx, i) =>
      generateColorFromBand(palette.bands[bandIdx], i)
    );

    function assignBands(palette, sd, d, hb) {
      const bCount = palette.bands.length;
      const a = [];
      if (palette.name === "Aurora") {
        a.push(0);
        for (let i = 1; i < sd.count - 1; i++) {
          const t = (i - 1) / (sd.count - 2);
          a.push(1 + Math.floor(t * (bCount - 1)));
        }
        a.push(0);
        return a;
      }
      for (let i = 0; i < sd.count; i++) {
        if (
          sd.pattern === "dramatic" &&
          d.drama > 0.5 &&
          i > 0 &&
          sd.stops[i] - sd.stops[i - 1] < 0.08
        ) {
          a.push((a[i - 1] + Math.floor(bCount / 2)) % bCount);
        } else {
          const prog = sd.stops[i];
          const base = Math.floor(prog * (bCount - 1));
          const varOff = hb[i + 12] / 255 < 0.3 ? 1 : 0;
          const band = clamp(
            base + (hb[i + 13] % 2 ? varOff : -varOff),
            0,
            bCount - 1
          );
          a.push(band);
        }
      }
      return a;
    }

    function generateColorFromBand(band, i) {
      let hue = lerp(band.hue[0], band.hue[1], hb[i + 16] / 255);
      let sat = lerp(band.sat[0], band.sat[1], hb[i + 17] / 255);
      let light = lerp(band.light[0], band.light[1], hb[i + 18] / 255);

      // Weather tweaks
      hue += (feel.warmth - 0.5) * 12; // warmth shift
      if (feel.rain_intensity && hue >= 180 && hue <= 200)
        sat += feel.rain_intensity * 15 * Math.pow(feel.rain_intensity, 0.3);
      sat = Math.max(30, sat - d.haziness * 15);
      light = Math.min(95, light + feel.brightness ** 2 * 15);
      if (d.gold && hue >= 10 && hue <= 40) {
        sat += d.gold * 20;
        light += d.gold * 10;
      }
      if (feel.night && i !== 0 && i !== stopData.count - 1)
        light = Math.max(35, light);
      if (
        stopData.pattern === "dramatic" &&
        i &&
        stopData.stops[i] - stopData.stops[i - 1] < 0.08
      )
        sat = Math.min(85, sat + 20);
      if (feel.precip_form === "snow") {
        if (hue >= 115 && hue <= 140) {
          hue += 40;
          sat *= 0.7;
        }
        sat = Math.min(70, sat);
        light += 5;
      }
      if (feel.gloom > 0.5) light = 50 + (light - 50) * (1 - feel.gloom * 0.4);
      if (!feel.night && light < 35) light = 35;
      if (sat < 40 && light < 65) light = 65;

      return hslToHex(
        ((hue % 360) + 360) % 360,
        clamp(sat, 0, 100),
        clamp(light, 0, 100)
      );
    }
  }

  function validateAndCorrect(data, feel) {
    let { colors, stops } = data;
    const hsls = colors.map(hexToHsl);
    const spans = {
      hue:
        Math.max(...hsls.map((c) => c.h)) - Math.min(...hsls.map((c) => c.h)),
      sat:
        Math.max(...hsls.map((c) => c.s)) - Math.min(...hsls.map((c) => c.s)),
      light:
        Math.max(...hsls.map((c) => c.l)) - Math.min(...hsls.map((c) => c.l)),
    };

    const interest =
      spans.hue >= 30 ||
      spans.sat >= 40 ||
      spans.light >= 40 ||
      stops.some((s, i) => i && s - stops[i - 1] <= 0.08);
    if (!interest) {
      const maxSatIdx = hsls.reduce(
        (m, c, i, arr) => (c.s > arr[m].s ? i : m),
        0
      );
      const minSatIdx = hsls.reduce(
        (m, c, i, arr) => (c.s < arr[m].s ? i : m),
        0
      );
      hsls[maxSatIdx].s = Math.min(85, hsls[maxSatIdx].s + 25);
      hsls[minSatIdx].s = Math.max(30, hsls[minSatIdx].s - 15);
      colors[maxSatIdx] = hslToHex(
        hsls[maxSatIdx].h,
        hsls[maxSatIdx].s,
        hsls[maxSatIdx].l
      );
      colors[minSatIdx] = hslToHex(
        hsls[minSatIdx].h,
        hsls[minSatIdx].s,
        hsls[minSatIdx].l
      );
    }

    // Forbidden color combinations
    const forb = [
      [
        [115, 140],
        [0, 40],
      ],
      [
        [115, 140],
        [340, 360],
      ],
      [
        [60, 80],
        [280, 300],
      ],
    ];
    for (let i = 1; i < colors.length; i++) {
      const a = hsls[i - 1].h;
      const b = hsls[i].h;
      forb.forEach(([r1, r2]) => {
        if (
          (a >= r1[0] && a <= r1[1] && b >= r2[0] && b <= r2[1]) ||
          (a >= r2[0] && a <= r2[1] && b >= r1[0] && b <= r1[1])
        ) {
          const bridge = hslToHex(270, 30, 70);
          colors.splice(i, 0, bridge);
          stops.splice(i, 0, (stops[i - 1] + stops[i]) / 2);
          hsls.splice(i, 0, hexToHsl(bridge));
        }
      });
    }

    // Green needs blue/purple
    if (
      hsls.some((c) => c.h >= 115 && c.h <= 140) &&
      !hsls.some((c) => c.h >= 200 && c.h <= 280)
    ) {
      colors = colors.map((col) => {
        const hsl = hexToHsl(col);
        if (hsl.h >= 115 && hsl.h <= 140) {
          hsl.h = 180 + (hsl.h - 115) * 0.8;
          return hslToHex(hsl.h, hsl.s, hsl.l);
        }
        return col;
      });
    }

    // Day‑light constraints
    if (!feel.night) {
      colors = colors.map((col) => {
        const hsl = hexToHsl(col);
        if (hsl.l < 35) hsl.l = 35;
        if (hsl.s < 40 && hsl.l < 65) hsl.l = 65;
        return hslToHex(hsl.h, hsl.s, hsl.l);
      });
    }

    // Ensure ≥5 % stop gap & bounds
    for (let i = 1; i < stops.length; i++) {
      if (stops[i] - stops[i - 1] < 0.05) {
        const adj = (0.05 - (stops[i] - stops[i - 1])) / 2;
        if (i - 2 >= 0 && stops[i - 1] - stops[i - 2] < 0.05 + adj)
          stops[i] += adj * 2;
        else {
          stops[i - 1] -= adj;
          stops[i] += adj;
        }
      }
    }
    stops = stops.map((s, idx) => clamp(s, 0, 1));
    stops[0] = 0;
    stops[stops.length - 1] = 1;

    return { colors, stops };
  }
}

// ──────────────────────────────────────────────────────────────
// Weather "feel"
// ──────────────────────────────────────────────────────────────
export function calcFeel(agg, sun, nowT) {
  const sunriseT = new Date(sun.properties.sunrise.time);
  const sunsetT = new Date(sun.properties.sunset.time);
  const elevFrac = solarElevationFrac(nowT, sunriseT, sunsetT);
  const golden = clamp(1 - Math.abs(elevFrac - 0.08) / 0.08);
  const twilight = clamp(1 - Math.abs(nowT - sunsetT) / 4.5e6);
  const night = elevFrac <= 0 ? 1 : 0;
  const AT = apparentTemp(agg.Tbar, agg.RHbar, agg.WSbar);
  const warm = warmthScore(AT);
  const warmChange = tanh(agg.deltaT / 4);
  const humidityFeel = muggyIndex(agg.DPbar);
  const windFeel = sigmoid((agg.WSbar - 2) / 3) * (agg.Tbar < 10 ? 1.2 : 1);
  const cloudFrac = agg.CCbar / 100;
  const brightness = elevFrac * (1 - cloudFrac);
  const gloom = clamp(1.2 * cloudFrac * (1 - elevFrac));
  const rainIntensity = agg.PR1 > 0 ? sigmoid(agg.PR1max / 3) : 0;
  const rainAmount = tanh(agg.PR6sum / 24);
  const precipForm =
    agg.Tbar <= 0 ? "snow" : agg.Tbar < 2 && agg.RHbar > 90 ? "sleet" : "rain";
  const uvNorm = clamp(agg.UV / 11);
  return {
    warmth: warm,
    warmth_change: warmChange,
    humidity: humidityFeel,
    gloom,
    brightness,
    rain_intensity: rainIntensity,
    rain_amount: rainAmount,
    precip_form: precipForm,
    windiness: windFeel,
    pressure_trend: tanh(agg.deltaP3h / 2),
    pressure_trend_cat: pressureTrend(agg.deltaP3h),
    sun_elevation: elevFrac,
    golden,
    twilight,
    night,
    uv: uvNorm,
  };
}

function apparentTemp(T, RH, WS) {
  const e = (RH / 100) * 6.105 * Math.exp((17.27 * T) / (237.7 + T));
  return T + 0.33 * e - 0.7 * WS - 4.0;
}
function muggyIndex(dp) {
  return clamp((dp - 10) / 14);
}
function warmthScore(AT) {
  return clamp(sigmoid((AT - 15) / 10));
}
function solarElevationFrac(now, sunrise, sunset) {
  const len = sunset - sunrise || 1;
  const f = clamp((now - sunrise) / len);
  return Math.sin(Math.PI * f);
}
function pressureTrend(dp3h) {
  if (dp3h > 1.5) return "rising";
  if (dp3h < -1.5) return "falling";
  return "steady";
}

export async function fetchForecast(lat, lon) {
  const fcRes = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`
  );
  if (!fcRes.ok) throw Error(`locationforecast ${fcRes.status}`);
  const fc = await fcRes.json();
  const sunRes = await fetch(
    `https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${lat}&lon=${lon}&date=${new Date()
      .toISOString()
      .slice(0, 10)}`
  );
  if (!sunRes.ok) throw Error(`sunrise ${sunRes.status}`);
  const sun = await sunRes.json();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const pts = fc.properties.timeseries.filter((p) => {
    const t = parseISO(p.time);
    return t >= start && t < end;
  });
  const pull = (f) => pts.map((p) => p.data.instant.details[f] ?? null);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const agg = {
    Tbar: mean(pull("air_temperature")),
    DPbar: mean(pull("dew_point_temperature")),
    RHbar: mean(pull("relative_humidity")),
    Pbar: mean(pull("air_pressure_at_sea_level")),
    CCbar: mean(pull("cloud_area_fraction")),
    WSbar: mean(pull("wind_speed")),
    UV: mean(pull("ultraviolet_index_clear_sky")),
    PR1: pts[0].data.next_1_hours?.details?.precipitation_amount ?? 0,
    PR1max: Math.max(
      ...pts.map((p) => p.data.next_1_hours?.details?.precipitation_amount ?? 0)
    ),
    PR6sum: pts
      .filter((_, i) => i % 6 === 0)
      .reduce(
        (s, p) => s + (p.data.next_6_hours?.details?.precipitation_amount ?? 0),
        0
      ),
    deltaP3h:
      pull("air_pressure_at_sea_level").slice(-1)[0] -
      pull("air_pressure_at_sea_level").slice(-4)[0],
    deltaT:
      mean(pull("air_temperature").slice(pts.length / 2)) -
      mean(pull("air_temperature").slice(0, pts.length / 2)),
  };
  const nowT = parseISO(pts[0].time);
  const feeling = calcFeel(agg, sun, nowT);
  const first = pts[0].data.instant.details;
  const p1h = pts[0].data.next_1_hours?.details ?? {};
  return {
    temp: first.air_temperature,
    wind: first.wind_speed,
    clouds: first.cloud_area_fraction / 100,
    humidity: first.relative_humidity / 100,
    precipAmount: p1h.precipitation_amount ?? 0,
    precipType:
      feeling.precip_form === "snow"
        ? "snow"
        : (p1h.precipitation_amount ?? 0) > 0
        ? "rain"
        : "none",
    uvIndex: first.ultraviolet_index_clear_sky,
    timeISO: pts[0].time,
    sunriseISO: sun.properties.sunrise.time,
    sunsetISO: sun.properties.sunset.time,
    feeling,
  };
}

// ──────────────────────────────────────────────────────────────
// Office list
// ──────────────────────────────────────────────────────────────
const offices = [
  {
    city: "Stockholm",
    lat: 59.3293,
    lon: 18.0686,
    tz: "Europe/Stockholm",
  },
  {
    city: "Göteborg",
    lat: 57.7075,
    lon: 11.9675,
    tz: "Europe/Stockholm",
  },
  { city: "Malmö", lat: 55.6058, lon: 13.0358, tz: "Europe/Stockholm" },
  {
    city: "Jönköping",
    lat: 57.7828,
    lon: 14.1606,
    tz: "Europe/Stockholm",
  },
  {
    city: "Karlstad",
    lat: 59.3783,
    lon: 13.5042,
    tz: "Europe/Stockholm",
  },
  {
    city: "Karlskrona",
    lat: 56.1612,
    lon: 15.5869,
    tz: "Europe/Stockholm",
  },
  {
    city: "Linköping",
    lat: 58.4109,
    lon: 15.6216,
    tz: "Europe/Stockholm",
  },
  { city: "Luleå", lat: 65.5848, lon: 22.1547, tz: "Europe/Stockholm" },
  { city: "Lund", lat: 55.7047, lon: 13.191, tz: "Europe/Stockholm" },
  {
    city: "Borlänge",
    lat: 60.4847,
    lon: 15.426,
    tz: "Europe/Stockholm",
  },
  { city: "Gävle", lat: 60.6749, lon: 17.1413, tz: "Europe/Stockholm" },
  {
    city: "Helsingborg",
    lat: 56.0465,
    lon: 12.6945,
    tz: "Europe/Stockholm",
  },
  {
    city: "Sundsvall",
    lat: 62.3908,
    lon: 17.3069,
    tz: "Europe/Stockholm",
  },
  {
    city: "Uppsala",
    lat: 59.8586,
    lon: 17.6389,
    tz: "Europe/Stockholm",
  },
  {
    city: "Örebro",
    lat: 59.2741,
    lon: 15.2066,
    tz: "Europe/Stockholm",
  },
  {
    city: "Trollhättan",
    lat: 58.2837,
    lon: 12.2886,
    tz: "Europe/Stockholm",
  },
  { city: "Oslo", lat: 59.9139, lon: 10.7522, tz: "Europe/Oslo" },
  { city: "Bergen", lat: 60.3928, lon: 5.3239, tz: "Europe/Oslo" },
  { city: "Stavanger", lat: 58.969, lon: 5.7331, tz: "Europe/Oslo" },
  {
    city: "Kristiansand",
    lat: 58.1467,
    lon: 7.9956,
    tz: "Europe/Oslo",
  },
  { city: "Arendal", lat: 58.4614, lon: 8.772, tz: "Europe/Oslo" },
  { city: "Hamar", lat: 60.7945, lon: 11.067, tz: "Europe/Oslo" },
  {
    city: "København",
    lat: 55.6761,
    lon: 12.5683,
    tz: "Europe/Copenhagen",
  },
  {
    city: "Aarhus",
    lat: 56.1629,
    lon: 10.2039,
    tz: "Europe/Copenhagen",
  },
  {
    city: "Helsinki",
    lat: 60.1699,
    lon: 24.9384,
    tz: "Europe/Helsinki",
  },
  { city: "Tampere", lat: 61.4978, lon: 23.761, tz: "Europe/Helsinki" },
  { city: "Turku", lat: 60.4518, lon: 22.2673, tz: "Europe/Helsinki" },
  { city: "Oulu", lat: 65.0121, lon: 25.4651, tz: "Europe/Helsinki" },
  { city: "Warszawa", lat: 52.2297, lon: 21.0122, tz: "Europe/Warsaw" },
  {
    city: "Bydgoszcz",
    lat: 53.1235,
    lon: 18.0084,
    tz: "Europe/Warsaw",
  },
  { city: "Łódź", lat: 51.7592, lon: 19.455, tz: "Europe/Warsaw" },
  { city: "Bremen", lat: 53.0793, lon: 8.8017, tz: "Europe/Berlin" },
  { city: "Umeå", lat: 63.8274, lon: 20.2699, tz: "Europe/Stockholm" },
  { city: "Östersund", lat: 63.1743, lon: 14.6411, tz: "Europe/Stockholm" },
  { city: "Viby", lat: 56.1188, lon: 10.1399, tz: "Europe/Copenhagen" },
  { city: "Aalborg", lat: 57.0465, lon: 9.9225, tz: "Europe/Copenhagen" },
  { city: "Trondheim", lat: 63.4302, lon: 10.3829, tz: "Europe/Oslo" },
  { city: "Ålesund", lat: 62.4712, lon: 6.158, tz: "Europe/Oslo" },
];

// ──────────────────────────────────────────────────────────────
// React app
// ──────────────────────────────────────────────────────────────
export default function App() {
  return <GradientApp />;
}

function GradientApp() {
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Persistent last office to avoid immediate repeats
  const lastOfficeIdx = useRef(-1);

  const load = useCallback(async (lat, lon, label) => {
    setLoading(true);
    try {
      const w = await fetchForecast(lat, lon);
      setWx({ ...w, place: label });
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const randomOffice = useCallback(() => {
    let idx;
    do idx = Math.floor(Math.random() * offices.length);
    while (idx === lastOfficeIdx.current);
    lastOfficeIdx.current = idx;
    const o = offices[idx];
    load(o.lat, o.lon, o.city);
  }, [load]);

  useEffect(() => {
    let mounted = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        mounted && load(coords.latitude, coords.longitude, "Current location"),
      () => mounted && randomOffice()
    );
    return () => {
      mounted = false;
    };
  }, [load, randomOffice]);

  const getLocalTimeString = (data) => {
    if (!data?.place) return "";
    const office = offices.find(
      (o) => data.place && data.place.includes(o.city)
    );
    const tz = office?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Date().toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
  };

  return (
    <>
      <Leva collapsed />
      <Canvas flat style={{ width: "100vw", height: "100vh" }}>
        <GradientScene wx={wx} />
      </Canvas>
      <Footer
        err={err}
        loading={loading}
        place={wx?.place}
        randomOffice={randomOffice}
        temp={wx?.temp}
        wind={wx?.wind}
        time={getLocalTimeString(wx)}
      />
    </>
  );
}

const Footer = ({ err, loading, place, randomOffice, temp, wind, time }) => (
  <div
    style={{
      position: "fixed",
      bottom: 35,
      left: 48,
      color: "white",
      fontSize: 20,
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
    }}
  >
    <span>
      {err ? (
        `Error: ${err}`
      ) : loading ? (
        "Loading…"
      ) : (
        <>
          Design formet av himmelen over{" "}
          <span style={{ textDecoration: "underline" }}>Knowit, {place}</span>
        </>
      )}
    </span>
    <button
      style={{
        marginLeft: 10,
        padding: 0,
        height: 20,
        width: 20,
        cursor: "pointer",
        background: "none",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={randomOffice}
    >
      {/* Reroll icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 15 18"
        fill="none"
      >
        <path
          d="M7.87226 2.60254L5.98456 7.7373L5.04608 7.39258L6.44257 3.59082C5.59154 3.71764 4.77195 4.01502 4.03534 4.46875L3.8371 4.5957C2.85307 5.25325 2.07198 6.171 1.58026 7.24414L1.48554 7.45996C1.00255 8.62603 0.877087 9.90957 1.12323 11.1475L1.17304 11.3789C1.44599 12.5272 2.03258 13.5792 2.86933 14.416L3.03925 14.5801C3.90403 15.3831 4.97646 15.9311 6.1369 16.1621L6.3703 16.2041C7.53554 16.3913 8.73218 16.2526 9.82538 15.7998L10.0412 15.7051C11.1144 15.2134 12.0321 14.4323 12.6896 13.4482L12.8166 13.25C13.4357 12.2449 13.7648 11.0859 13.7648 9.90234H14.7648C14.7648 11.2713 14.3842 12.6119 13.6682 13.7744L13.5207 14.0039C12.7602 15.142 11.6994 16.0455 10.4582 16.6143L10.2072 16.7236C8.94267 17.2473 7.55895 17.408 6.21112 17.1914L5.94257 17.1436C4.60016 16.8765 3.35996 16.2414 2.35956 15.3125L2.1623 15.123C1.19449 14.1552 0.516127 12.9385 0.200381 11.6104L0.141787 11.3428C-0.142932 9.91105 0.00319747 8.42681 0.561709 7.07812L0.671084 6.82715C1.23985 5.586 2.14331 4.52515 3.28144 3.76465L3.51093 3.61719C4.11638 3.24426 4.77047 2.9629 5.45136 2.77832L2.39276 1.6543L2.73749 0.714844L7.87226 2.60254Z"
          fill="#FEFBE6"
        />
      </svg>
    </button>
    <div
      style={{
        position: "fixed",
        bottom: 35,
        right: 48,
        color: "white",
        fontSize: 20,
        display: "flex",
        alignItems: "center",
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>
        {/* Cloud icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="23"
          height="16"
          viewBox="0 0 23 16"
          fill="none"
        >
          <path
            d="M18.296 7.013C18.4372 5.61392 18.0324 4.21484 17.1609 3.09201C16.2894 1.96918 15.0157 1.20567 13.5919 0.951853C12.1675 0.697521 10.6975 0.972242 9.47212 1.72097C8.24675 2.4702 7.3558 3.63839 6.97569 4.99466C6.26273 4.89782 5.53663 4.9447 4.84309 5.13227C4.14955 5.31932 3.50275 5.64297 2.94361 6.08333C2.38448 6.5237 1.92455 7.07058 1.59222 7.69087C1.25988 8.31115 1.06251 8.99056 1.01263 9.6878C0.962758 10.385 1.06091 11.0849 1.30084 11.7439C1.54129 12.4029 1.91878 13.0063 2.40966 13.5181C2.90055 14.0293 3.49435 14.437 4.15482 14.7158C4.81476 14.9946 5.52719 15.1389 6.24698 15.1394H17.7972C18.8682 15.1399 19.8994 14.7433 20.679 14.0303C21.4592 13.3178 21.9291 12.3422 21.9926 11.3045C22.0561 10.2663 21.7091 9.24388 21.0219 8.44623C20.3346 7.64858 19.3597 7.13583 18.296 7.013Z"
            stroke="#FEFBE6"
            strokeWidth="1.26"
          />
        </svg>
        <span style={{ marginLeft: 6, marginRight: 19 }}>{temp}ºC</span>
      </span>
      <span style={{ marginRight: 19 }}>{wind} m/s</span>
      <span>{time}</span>
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────
// Gradient scene + shader
// ──────────────────────────────────────────────────────────────
const TIME_SCALE = 0.53;
const WIND_SCALE = 3.0;
const NOISE_FREQ = 0.45;
const CLOUD_DETAIL = 0.65;
const LERP = 0.05;
const MAX_STOPS = 8;
const MAX_GAPS = MAX_STOPS - 1;

function GradientScene({ wx }) {
  return <GradientShader wx={wx} />;
}

function GradientShader({ wx }) {
  const mesh = useRef();
  const materialRef = useRef();
  const { viewport, size } = useThree();

  const ctrl = useControls({
    "Data source": folder({ useAPI: { value: true, label: "Live API" } }),
    "API fields": folder(
      {
        timeISO: new Date().toISOString(),
        sunriseHour: { value: 6, min: 0, max: 23.5, step: 0.25 },
        sunsetHour: { value: 18, min: 0, max: 23.5, step: 0.25 },
        temp: { value: 10, min: -30, max: 40, step: 0.5 },
        wind: { value: 4, min: 0, max: 35, step: 0.1 },
        clouds: { value: 0.3, min: 0, max: 1 },
        humidity: { value: 0.6, min: 0, max: 1 },
        precipAmount: { value: 0, min: 0, max: 20, step: 0.1 },
        precipType: { value: "none", options: ["none", "rain", "snow"] },
      },
      { collapsed: true }
    ),
    "Feeling override": folder(
      {
        warmth: { value: 0.5, min: 0, max: 1 },
        warmth_change: { value: 0, min: -1, max: 1 },
        humidityFeel: { value: 0.5, min: 0, max: 1 },
        gloom: { value: 0.3, min: 0, max: 1 },
        brightness: { value: 0.6, min: 0, max: 1 },
        rain_intensity: { value: 0, min: 0, max: 1 },
        rain_amount: { value: 0, min: 0, max: 1 },
        windiness: { value: 0.3, min: 0, max: 1 },
        pressure_trend: { value: 0, min: -1, max: 1 },
        sun_elevation: { value: 0.5, min: 0, max: 1 },
        golden: { value: 0, min: 0, max: 1 },
        twilight: { value: 0, min: 0, max: 1 },
        precip_form: { value: "rain", options: ["rain", "snow"] },
        night: { value: 0, min: 0, max: 1 },
      },
      { collapsed: true }
    ),
  });

  const target = useMemo(() => {
    if (ctrl.useAPI && wx) return wx;
    const makeISO = (h) => {
      const d = new Date(ctrl.timeISO);
      d.setUTCHours(h, 0, 0, 0);
      return d.toISOString();
    };
    const sunriseISO = makeISO(ctrl.sunriseHour);
    const sunsetISO = makeISO(ctrl.sunsetHour);
    const tNow = new Date(ctrl.timeISO);
    const tRise = new Date(sunriseISO);
    const tSet = new Date(sunsetISO);
    const dayLen = tSet - tRise || 1;
    const dayFrac = clamp((tNow - tRise) / dayLen);
    const elev = dayFrac < 0 || dayFrac > 1 ? 0 : Math.sin(Math.PI * dayFrac);
    const feel = {
      warmth: ctrl.warmth,
      warmth_change: ctrl.warmth_change,
      humidity: ctrl.humidityFeel,
      gloom: ctrl.gloom ?? ctrl.clouds,
      brightness: ctrl.brightness ?? elev * (1 - ctrl.clouds),
      rain_intensity: ctrl.rain_intensity ?? sigmoid(ctrl.precipAmount / 4),
      rain_amount: ctrl.rain_amount,
      precip_form: ctrl.precip_form,
      windiness: ctrl.windiness ?? sigmoid((ctrl.wind - 2) / 4),
      pressure_trend: ctrl.pressure_trend,
      sun_elevation: ctrl.sun_elevation ?? elev,
      golden: ctrl.golden,
      twilight: ctrl.twilight,
      night: ctrl.night,
    };
    return {
      temp: ctrl.temp,
      wind: ctrl.wind,
      clouds: ctrl.clouds,
      humidity: ctrl.humidity,
      precipAmount: ctrl.precipAmount,
      precipType: ctrl.precipType,
      timeISO: ctrl.timeISO,
      sunriseISO,
      sunsetISO,
      feeling: feel,
    };
  }, [ctrl, wx]);

  const palette = useMemo(
    () => buildGradient(target.feeling),
    [target.feeling]
  );

  const colorCache = useMemo(
    () => Array.from({ length: MAX_STOPS }, () => new THREE.Color()),
    []
  );
  const stopCache = useRef(new Float32Array(MAX_GAPS));

  useEffect(() => {
    if (!mesh.current || materialRef.current) return;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector2(size.width, size.height) },
        iTime: { value: 0 },
        uTimeScale: { value: TIME_SCALE },
        uWindScale: { value: WIND_SCALE },
        uNoiseFreq: { value: NOISE_FREQ },
        uCloudDetail: { value: CLOUD_DETAIL },
        uCloudCover: { value: target.clouds },
        uWindNorm: { value: clamp(target.wind / 25, 0.2, 1) },
        uWindOffset: { value: 0 },
        uColor: { value: colorCache },
        uStops: { value: stopCache.current },
        uStopCount: { value: palette.colors.length },
      },
      vertexShader: glsl`
        varying vec2 vUv;
        void main(){vUv = uv;gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}`,
      fragmentShader: glsl`
        precision mediump float;
        #pragma glslify: snoise=require(glsl-noise/simplex/3d)
        #define MAX_STOPS 8
        varying vec2 vUv;
        uniform vec2 iResolution;uniform float iTime,uTimeScale,uWindScale,uNoiseFreq,uCloudDetail;
        uniform float uCloudCover,uWindNorm,uWindOffset;uniform vec3 uColor[MAX_STOPS];
        uniform float uStops[MAX_STOPS-1];uniform float uStopCount;
        vec3 pal(float t){vec3 col=uColor[0];float prev=0.;int cnt=int(uStopCount+0.5);for(int i=1;i<MAX_STOPS;i++){if(i>=cnt)break;float edge=smoothstep(prev,uStops[i-1],t);col=mix(col,uColor[i],edge);prev=uStops[i-1];}return col;}
        vec3 toSRGB(vec3 v){return pow(v,vec3(1./2.2));}
        void main(){vec2 uv=vUv;float t=iTime*uTimeScale;float base=snoise(vec3(uv*0.8*uNoiseFreq,t*0.1));vec2 wuv=uv;wuv.x-=uWindOffset;vec2 wind=vec2(snoise(vec3(wuv*2.*uNoiseFreq+t*0.2,t*0.5)),snoise(vec3(wuv*2.*uNoiseFreq-t*0.05,t*0.2)));uv+=wind*(pow(uWindNorm,0.7)*0.15+0.02)*uWindScale;uv.x+=base*0.05*uNoiseFreq;float cloudEff=max(uCloudCover,uWindNorm*0.5);float g=uv.y+snoise(vec3(uv*uCloudDetail*mix(1.,3.,cloudEff),t*0.1))*0.2*cloudEff;g=clamp(g,0.,1.);g+=sin(uv.y*10.*uNoiseFreq+t*0.2+base*2.*uNoiseFreq)*0.02;g=clamp(g,0.,1.);gl_FragColor=vec4(toSRGB(pal(g)),1.);} `,
    });
    mesh.current.material = mat;
    materialRef.current = mat;
  }, [
    colorCache,
    palette.colors.length,
    size.height,
    size.width,
    stopCache,
    target.clouds,
    target.wind,
  ]);

  useEffect(() => {
    materialRef.current &&
      materialRef.current.uniforms.iResolution.value.set(
        size.width,
        size.height
      );
  }, [size]);

  useFrame((_, dt) => {
    const mat = materialRef.current;
    if (!mat) return;
    const targetColors = palette.colors.slice(0, MAX_STOPS);
    while (targetColors.length < MAX_STOPS)
      targetColors.push(targetColors[targetColors.length - 1]);
    const targetStops = palette.stops.slice(1);
    while (targetStops.length < MAX_GAPS) targetStops.push(1);
    for (let i = 0; i < MAX_STOPS; i++)
      colorCache[i].lerp(new THREE.Color(targetColors[i]), LERP);
    for (let i = 0; i < MAX_GAPS; i++)
      stopCache.current[i] = lerp(stopCache.current[i], targetStops[i], LERP);
    mat.uniforms.uStops.needsUpdate = true;
    mat.uniforms.uStopCount.value = lerp(
      mat.uniforms.uStopCount.value,
      palette.colors.length,
      LERP
    );
    mat.uniforms.iTime.value += dt;
    mat.uniforms.uCloudCover.value = lerp(
      mat.uniforms.uCloudCover.value,
      target.clouds,
      LERP
    );
    mat.uniforms.uWindNorm.value = lerp(
      mat.uniforms.uWindNorm.value,
      clamp(target.wind / 25, 0.2, 1),
      LERP
    );
    mat.uniforms.uWindOffset.value +=
      (0.1 + 0.75 * mat.uniforms.uWindNorm.value) * TIME_SCALE * dt;
  });

  return (
    <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
