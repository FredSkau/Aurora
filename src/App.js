import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useControls, Leva, folder, button } from "leva";
import * as THREE from "three";
import glsl from "babel-plugin-glsl/macro";
import { Routes, Route } from "react-router-dom";

/* ────────── Utility helpers ────────── */

// hex → linear-space THREE.Color
const toLinear = (hex) => new THREE.Color(hex).convertSRGBToLinear();
// luminance 0-1
const luma = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
// linear THREE.Color → HSL object
const linearToHSL = (c) => c.clone().convertLinearToSRGB().getHSL({});

/* ────────── Brand swatches ────────── */

const COLORS = {
  // Lights
  white: toLinear("#FEFBE6"),
  lightPurple: toLinear("#F7F6FF"),
  lightPink: toLinear("#FFEBDD"),
  paleMint: toLinear("#B7E1F7"),
  // Pinks / Oranges
  peach: toLinear("#FFD6B8"),
  warmPink: toLinear("#FFEBDD"),
  redOrange: toLinear("#E4927D"),
  brightOrange: toLinear("#EC7151"),
  // Magentas / Purples
  rosePink: toLinear("#D47798"),
  magentaPink: toLinear("#E091C2"),
  brandPurple: toLinear("#CFCEFF"),
  deepPurple: toLinear("#7A199D"),
  indigo: toLinear("#4947DD"),
  // Blues
  periwinkle: toLinear("#77A2F6"),
  skyBlue: toLinear("#629BDF"),
  cyan: toLinear("#0174CB"),
  brandBlue: toLinear("#372BC5"),
  ultramarine: toLinear("#251FCB"),
  // Greens
  teal: toLinear("#09A4AC"),
  brandGreen: toLinear("#55D440"),
  lime: toLinear("#53D553"),
  // Dark
  black: toLinear("#0B0B26"),
};

/* ────────── Offices list (trimmed for brevity) ────────── */
const offices = [
  // Sweden
  {
    city: "Stockholm",
    country: "Sweden 🇸🇪",
    address: "Sveavägen 20, 111 57 Stockholm",
    lat: 59.3293,
    lon: 18.0686,
    tz: "Europe/Stockholm",
  },
  {
    city: "Göteborg",
    country: "Sweden 🇸🇪",
    address: "Vikingsgatan 3, 411 04 Göteborg",
    lat: 57.7075,
    lon: 11.9675,
    tz: "Europe/Stockholm",
  },
  {
    city: "Malmö",
    country: "Sweden 🇸🇪",
    address: "Stortorget 9, 211 22 Malmö",
    lat: 55.6058,
    lon: 13.0358,
    tz: "Europe/Stockholm",
  },
  {
    city: "Jönköping",
    country: "Sweden 🇸🇪",
    address: "Östra Storgatan 33A, 553 21 Jönköping",
    lat: 57.7828,
    lon: 14.1606,
    tz: "Europe/Stockholm",
  },
  {
    city: "Karlstad",
    country: "Sweden 🇸🇪",
    address: "Tullhusgatan 1B, 652 09 Karlstad",
    lat: 59.3783,
    lon: 13.5042,
    tz: "Europe/Stockholm",
  },
  {
    city: "Karlskrona",
    country: "Sweden 🇸🇪",
    address: "Blekingegatan 10, 371 57 Karlskrona",
    lat: 56.1612,
    lon: 15.5869,
    tz: "Europe/Stockholm",
  },
  {
    city: "Linköping",
    country: "Sweden 🇸🇪",
    address: "S:t Larsgatan 16, 582 24 Linköping",
    lat: 58.4109,
    lon: 15.6216,
    tz: "Europe/Stockholm",
  },
  {
    city: "Luleå",
    country: "Sweden 🇸🇪",
    address: "Sandviksgatan 60, 972 33 Luleå",
    lat: 65.5848,
    lon: 22.1547,
    tz: "Europe/Stockholm",
  },
  {
    city: "Lund",
    country: "Sweden 🇸🇪",
    address: "Mobilvägen 10, 223 62 Lund",
    lat: 55.7047,
    lon: 13.191,
    tz: "Europe/Stockholm",
  },
  {
    city: "Borlänge",
    country: "Sweden 🇸🇪",
    address: "Maskinistgatan 8, 781 70 Borlänge",
    lat: 60.4847,
    lon: 15.426,
    tz: "Europe/Stockholm",
  },
  {
    city: "Gävle",
    country: "Sweden 🇸🇪",
    address: "Vågskrivargatan 5, 803 20 Gävle",
    lat: 60.6749,
    lon: 17.1413,
    tz: "Europe/Stockholm",
  },
  {
    city: "Helsingborg",
    country: "Sweden 🇸🇪",
    address: "Henckels torg 4, 252 25 Helsingborg",
    lat: 56.0465,
    lon: 12.6945,
    tz: "Europe/Stockholm",
  },
  {
    city: "Sundsvall",
    country: "Sweden 🇸🇪",
    address: "Stuvarvägen 25, 852 29 Sundsvall",
    lat: 62.3908,
    lon: 17.3069,
    tz: "Europe/Stockholm",
  },
  {
    city: "Uppsala",
    country: "Sweden 🇸🇪",
    address: "Fyristorg 6, 753 10 Uppsala",
    lat: 59.8586,
    lon: 17.6389,
    tz: "Europe/Stockholm",
  },
  {
    city: "Örebro",
    country: "Sweden 🇸🇪",
    address: "Klostergatan 23, 703 39 Örebro",
    lat: 59.2741,
    lon: 15.2066,
    tz: "Europe/Stockholm",
  },
  {
    city: "Trollhättan",
    country: "Sweden 🇸🇪",
    address: "Österlånggatan 55, 461 34 Trollhättan",
    lat: 58.2837,
    lon: 12.2886,
    tz: "Europe/Stockholm",
  },
  // Norway
  {
    city: "Oslo",
    country: "Norway 🇳🇴",
    address: "Universitetsgata 1, 0164 Oslo",
    lat: 59.9139,
    lon: 10.7522,
    tz: "Europe/Oslo",
  },
  {
    city: "Bergen",
    country: "Norway 🇳🇴",
    address: "Nøstegaten 58, 5011 Bergen",
    lat: 60.3928,
    lon: 5.3239,
    tz: "Europe/Oslo",
  },
  {
    city: "Stavanger",
    country: "Norway 🇳🇴",
    address: "Laberget 22, 4020 Stavanger",
    lat: 58.969,
    lon: 5.7331,
    tz: "Europe/Oslo",
  },
  {
    city: "Kristiansand",
    country: "Norway 🇳🇴",
    address: "Markensgate 8, 4611 Kristiansand",
    lat: 58.1467,
    lon: 7.9956,
    tz: "Europe/Oslo",
  },
  {
    city: "Arendal",
    country: "Norway 🇳🇴",
    address: "Torvet 10, 4836 Arendal",
    lat: 58.4614,
    lon: 8.772,
    tz: "Europe/Oslo",
  },
  {
    city: "Hamar",
    country: "Norway 🇳🇴",
    address: "Fredvang Allé 10B, 2321 Hamar",
    lat: 60.7945,
    lon: 11.067,
    tz: "Europe/Oslo",
  },
  // Denmark
  {
    city: "København",
    country: "Denmark 🇩🇰",
    address: "Nyropsgade 41, 1602 København V",
    lat: 55.6761,
    lon: 12.5683,
    tz: "Europe/Copenhagen",
  },
  {
    city: "Aarhus",
    country: "Denmark 🇩🇰",
    address: "Vesterbro Torv 3, 4. sal, 8000 Aarhus C",
    lat: 56.1629,
    lon: 10.2039,
    tz: "Europe/Copenhagen",
  },
  // Finland
  {
    city: "Helsinki",
    country: "Finland 🇫🇮",
    address: "Kansakoulukuja 1, 00100 Helsinki",
    lat: 60.1699,
    lon: 24.9384,
    tz: "Europe/Helsinki",
  },
  {
    city: "Tampere",
    country: "Finland 🇫🇮",
    address: "Kalevantie 2, 33100 Tampere",
    lat: 61.4978,
    lon: 23.761,
    tz: "Europe/Helsinki",
  },
  {
    city: "Turku",
    country: "Finland 🇫🇮",
    address: "Yliopistonkatu 25 A 12, 20100 Turku",
    lat: 60.4518,
    lon: 22.2673,
    tz: "Europe/Helsinki",
  },
  {
    city: "Oulu",
    country: "Finland 🇫🇮",
    address: "Rantakatu 3, 90100 Oulu",
    lat: 65.0121,
    lon: 25.4651,
    tz: "Europe/Helsinki",
  },
  // Poland
  {
    city: "Warszawa",
    country: "Poland 🇵🇱",
    address: "ul. Hrubieszowska 2, 01-209 Warszawa",
    lat: 52.2297,
    lon: 21.0122,
    tz: "Europe/Warsaw",
  },
  {
    city: "Bydgoszcz",
    country: "Poland 🇵🇱",
    address: "ul. Unii Lubelskiej 4c, 85-059 Bydgoszcz",
    lat: 53.1235,
    lon: 18.0084,
    tz: "Europe/Warsaw",
  },
  {
    city: "Łódź",
    country: "Poland 🇵🇱",
    address: "ul. Składowa 35, 90-127 Łódź",
    lat: 51.7592,
    lon: 19.455,
    tz: "Europe/Warsaw",
  },
  // Germany
  {
    city: "Bremen",
    country: "Germany 🇩🇪",
    address: "Otto-Lilienthal-Straße 22, 28199 Bremen",
    lat: 53.0793,
    lon: 8.8017,
    tz: "Europe/Berlin",
  },
];

/* ────────── Human-perceived temperature ────────── */

function calcFeelsLike({ t, clouds, wind, humidity, precip, isDay }) {
  const sunBoost = isDay ? (1 - clouds) * 3 : 0;
  const windChill = t < 15 ? -wind * 0.7 : 0;
  const humidHit = t > 22 ? Math.max(0, (humidity - 0.6) * 10) : 0;
  const wetCool = -Math.min(precip, 5);
  return t + sunBoost + windChill + humidHit + wetCool;
}

/* ────────── Theme catalogue ────────── */

function getThemes(nowISO, sunriseISO, sunsetISO, aurora, tNorm) {
  const hourMs = 60 * 60 * 1000;
  let isNight, isSunEvent;
  if (nowISO && sunriseISO && sunsetISO) {
    const now = new Date(nowISO).getTime();
    const sunrise = new Date(sunriseISO).getTime();
    const sunset = new Date(sunsetISO).getTime();
    isNight = now < sunrise || now > sunset;
    isSunEvent =
      Math.abs(now - sunrise) < hourMs || Math.abs(now - sunset) < hourMs;
  } else {
    const h = new Date(nowISO || Date.now()).getUTCHours() / 24;
    isNight = h < 0.25 || h > 0.75;
    isSunEvent = (h >= 0.2 && h < 0.35) || (h >= 0.7 && h < 0.85);
  }

  const themes = [];
  if (isNight && aurora > 0.25) {
    themes.push({
      name: "WinterAurora",
      colors: [
        COLORS.black,
        COLORS.indigo,
        COLORS.brandGreen,
        COLORS.lime,
        COLORS.brandPurple,
        COLORS.brandBlue,
        COLORS.deepPurple,
      ],
      score: aurora * 3.5,
      temp: "cool",
      clouds: "clear",
    });
    themes.push({
      name: "SummerAurora",
      colors: [
        COLORS.black,
        COLORS.indigo,
        COLORS.deepPurple,
        COLORS.brandPurple,
        COLORS.magentaPink,
        COLORS.skyBlue,
        COLORS.brandGreen,
      ],
      score: aurora * 3.5,
      temp: "warm",
      clouds: "clear",
    });
  }
  if (isNight) {
    themes.push({
      name: "NightClear",
      colors: [
        COLORS.black,
        COLORS.indigo,
        COLORS.deepPurple,
        COLORS.brandBlue,
        COLORS.lightPurple,
        COLORS.magentaPink,
      ],
      score: 0.9,
      temp: "cool",
      clouds: "clear",
    });
    themes.push({
      name: "NightCloudy",
      colors: [
        COLORS.black,
        COLORS.indigo,
        COLORS.deepPurple,
        COLORS.brandPurple,
        COLORS.skyBlue,
        COLORS.lightPurple,
      ],
      score: 0.8,
      temp: "neutral",
      clouds: "cloudy",
    });
  }
  if (isSunEvent) {
    // A cool sunrise/sunset palette is always allowed
    themes.push({
      name: "SunEventCool",
      colors: [
        COLORS.rosePink,
        COLORS.magentaPink,
        COLORS.deepPurple,
        COLORS.indigo,
        COLORS.periwinkle,
        COLORS.lightPurple,
      ],
      score: 1.5,
      temp: "cool",
      clouds: "any",
    });

    // Warm peach/orange gradients only after the sun is above the horizon
    if (!isNight) {
      themes.push({
        name: "SunEventWarm",
        colors: [
          COLORS.redOrange,
          COLORS.peach,
          COLORS.rosePink,
          COLORS.deepPurple,
          COLORS.periwinkle,
          COLORS.lightPink,
          COLORS.magentaPink,
        ],
        score: 2.0,
        temp: "warm",
        clouds: "any",
      });
      themes.push({
        name: "GoldenHour",
        colors: [
          COLORS.brightOrange,
          COLORS.peach,
          COLORS.warmPink,
          COLORS.brandPurple,
          COLORS.skyBlue,
          COLORS.white,
        ],
        score: 1.5,
        temp: "warm",
        clouds: "clear",
      });
    }
  }
  if (!isNight) {
    themes.push({
      name: "ClearDayWarm",
      colors: [
        COLORS.skyBlue,
        COLORS.periwinkle,
        COLORS.peach,
        COLORS.warmPink,
        COLORS.white,
      ],
      score: 1.2,
      temp: "warm",
      clouds: "clear",
    });
    themes.push({
      name: "ClearDayCool",
      colors: [
        COLORS.skyBlue,
        COLORS.periwinkle,
        COLORS.paleMint,
        COLORS.lightPurple,
        COLORS.white,
      ],
      score: 1.2,
      temp: "cool",
      clouds: "clear",
    });
    themes.push({
      name: "PastelDay",
      colors: [
        COLORS.paleMint,
        COLORS.lightPink,
        COLORS.brandPurple,
        COLORS.white,
        COLORS.periwinkle,
      ],
      score: 0.9,
      temp: "neutral",
      clouds: "any",
    });
    themes.push({
      name: "VibrantDay",
      colors: [
        COLORS.cyan,
        COLORS.skyBlue,
        COLORS.brandBlue,
        COLORS.white,
        COLORS.periwinkle,
      ],
      score: 0.8,
      temp: "neutral",
      clouds: "clear",
    });
  }
  themes.push({
    name: "Overcast",
    colors: [
      COLORS.skyBlue,
      COLORS.brandPurple,
      COLORS.lightPurple,
      COLORS.white,
      COLORS.periwinkle,
      COLORS.black,
    ],
    score: 0.5,
    temp: "neutral",
    clouds: "cloudy",
  });
  return themes;
}

/* ────────── Palette picker ────────── */

function pickColors({
  temp,
  clouds,
  humidity,
  precipAmount,
  precipType,
  timeISO,
  wind,
  auroraBoost,
  nightClarity,
  tempHueInfluence,
  tempSatInfluence,
  tempSoftness,
  cloudImpact,
  precipImpact,
  sunriseISO,
  sunsetISO,
}) {
  const pNorm =
    precipType === "none" ? 0 : THREE.MathUtils.clamp(precipAmount / 10, 0, 1);
  const cNorm = THREE.MathUtils.clamp(clouds, 0, 1);
  const now = new Date(timeISO);
  const isDay =
    sunriseISO && sunsetISO
      ? now > new Date(sunriseISO) && now < new Date(sunsetISO)
      : now.getUTCHours() / 24 > 0.25 && now.getUTCHours() / 24 < 0.75;
  const feels = calcFeelsLike({
    t: temp,
    clouds: cNorm,
    wind,
    humidity,
    precip: precipAmount,
    isDay,
  });
  const FEEL_MIN = -10,
    FEEL_MAX = 28;
  const tNorm = THREE.MathUtils.clamp(
    (feels - FEEL_MIN) / (FEEL_MAX - FEEL_MIN),
    0,
    1
  );
  const hourFrac = (now.getUTCHours() + now.getUTCMinutes() / 60) / 24;
  const nightFallback = hourFrac < 0.2 || hourFrac > 0.85;
  const isNight =
    sunriseISO && sunsetISO
      ? now < new Date(sunriseISO) || now > new Date(sunsetISO)
      : nightFallback;
  const aurora = isNight && cNorm < 0.7 ? 0.2 + auroraBoost * 0.3 : 0;
  const themes = getThemes(timeISO, sunriseISO, sunsetISO, aurora, tNorm);
  let best,
    bestScore = -Infinity;
  themes.forEach((th) => {
    let s = th.score;
    if (th.temp === "warm") s *= THREE.MathUtils.smoothstep(tNorm, 0.25, 0.75);
    else if (th.temp === "cool")
      s *= 1 - THREE.MathUtils.smoothstep(tNorm, 0.25, 0.75);
    if (th.clouds === "clear" && cNorm > 0.3)
      s *= Math.max(0.05, 1 - cNorm * 1.5);
    if (th.clouds === "cloudy" && cNorm < 0.5) s *= Math.max(0.1, cNorm * 1.8);
    if (th.clouds === "cloudy") s += cNorm * 0.5;
    if (pNorm > 0.01 && th.clouds !== "cloudy" && !th.name.includes("Aurora"))
      s *= Math.max(0.1, 1 - pNorm * 2);
    if (pNorm > 0.01 && th.name.includes("Overcast")) s += pNorm * 0.8;
    if (th.name.includes("Aurora") && aurora < 0.15) s *= 0.01;
    if (s > bestScore) [best, bestScore] = [th, s];
  });
  if (!best) best = themes.find((t) => t.name === "ClearDayWarm") || themes[0];
  let pal = best.colors.map((c) => c.clone());
  pal.forEach((col) => {
    let hsl = linearToHSL(col);
    hsl.s *= 1 - cNorm * 0.7 * cloudImpact;
    hsl.l += (0.5 - hsl.l) * cNorm * 0.4 * cloudImpact;
    if (precipType === "rain" && pNorm > 0.01) {
      hsl.h = (hsl.h + (0.62 - hsl.h) * pNorm * 0.4 * precipImpact + 1) % 1;
      hsl.s *= 1 - pNorm * 0.3 * precipImpact;
      hsl.l += (0.5 - hsl.l) * pNorm * 0.15 * precipImpact;
    } else if (precipType === "snow" && pNorm > 0.01) {
      hsl.s *= 1 - pNorm * 0.4 * precipImpact;
      hsl.l += (0.5 - hsl.l) * -0.5 * pNorm * precipImpact;
    }
    const dir = tNorm - 0.5;
    if (Math.abs(dir) > 0.1) {
      hsl.h =
        (hsl.h +
          (dir < 0 ? tempHueInfluence : -tempHueInfluence) * Math.abs(dir) * 2 +
          1) %
        1;
    }
    hsl.s *= 1 - tempSatInfluence * Math.abs(dir) * 1.5;
    const nightFactor = isNight ? 1.0 : 0.0;

    // quick helpers for selective aurora boost
    const isAuroraTheme = best.name.includes("Aurora");
    const hue = hsl.h; // 0-1
    const auroraHue =
      (hue > 0.25 && hue < 0.45) || // lime / green band
      hue > 0.78 ||
      hue < 0.05; // magenta / purple band

    /* ───── Apply dimming only at night and never to aurora hues ───── */
    if (nightFactor > 0.0 && !(isAuroraTheme && auroraHue)) {
      hsl.l *=
        (0.15 + nightClarity * 0.3 + (1 - cNorm) * 0.1) *
        (1 - nightFactor * (0.6 - nightClarity * 0.45));

      hsl.s *= (0.4 + nightClarity * 0.25) * (1 - nightFactor * 0.2);
    }
    hsl.l = THREE.MathUtils.clamp(hsl.l, 0.005 + nightClarity * 0.05, 0.98);
    hsl.s = THREE.MathUtils.clamp(hsl.s, 0.02, 1);
    col.setHSL(hsl.h, hsl.s, hsl.l).convertSRGBToLinear();
  });
  while (pal.length < 5) {
    const ref = pal[pal.length % pal.length].clone();
    let h = linearToHSL(ref);
    h.l = (h.l + 0.1) % 1;
    pal.push(new THREE.Color().setHSL(h.h, h.s, h.l).convertSRGBToLinear());
  }
  pal = pal.slice(0, 5).sort((a, b) => luma(a) - luma(b));
  for (let i = 0; i < pal.length - 1; i++) {
    const h1 = linearToHSL(pal[i]).h;
    const h2 = linearToHSL(pal[i + 1]).h;
    let d = Math.abs(h1 - h2);
    if (d > 0.5) d = 1 - d;
    if (d < 0.03) {
      let h = linearToHSL(pal[i + 1]);
      h.h = (h1 + 0.05) % 1;
      pal[i + 1].setHSL(h.h, h.s, h.l).convertSRGBToLinear();
    }
  }
  if (!best.name.includes("Aurora")) {
    const anchor = linearToHSL(pal[0]).s;
    pal.forEach((p, idx) => {
      if (idx === 0) return;
      let h = linearToHSL(p);
      h.s = THREE.MathUtils.lerp(h.s, anchor * 0.8, 0.1 * idx);
      p.setHSL(h.h, Math.max(0.05, h.s), h.l).convertSRGBToLinear();
    });
  }
  return pal;
}

/* ────────── MET API wrappers ────────── */

async function fetchWeather(lat, lon) {
  const r = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`
  );
  if (!r.ok) throw new Error("locationforecast failed: " + r.status);
  const j = await r.json();
  const now = j.properties?.timeseries?.[0];
  if (!now) throw new Error("locationforecast missing data");
  const inst = now.data.instant.details;
  const next1 = now.data.next_1_hours?.details;
  const next6 = now.data.next_6_hours?.details;
  const precipAmount =
    next1?.precipitation_amount ?? next6?.precipitation_amount ?? 0;
  let precipType = "none";
  if (precipAmount > 0) {
    const symbol = now.data.next_1_hours?.summary?.symbol_code || "";
    if (symbol.includes("snow")) precipType = "snow";
    else if (symbol.includes("rain") || symbol.includes("sleet"))
      precipType = "rain";
    else if ((inst.air_temperature ?? 10) < 1) precipType = "snow";
    else precipType = "rain";
  }
  return {
    temp: inst.air_temperature ?? 10,
    wind: inst.wind_speed ?? 5,
    clouds: (inst.cloud_area_fraction ?? 20) / 100,
    humidity: (inst.relative_humidity ?? 60) / 100,
    precipAmount,
    precipType,
    timeISO: now.time,
  };
}

async function fetchSunTimes(lat, lon, date) {
  const r = await fetch(
    `https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${lat}&lon=${lon}&date=${date}&offset=%2B00:00`
  );
  if (!r.ok) throw new Error("sunrise API failed: " + r.status);
  const j = await r.json();
  const sunriseISO = j.properties?.sunrise?.time;
  const sunsetISO = j.properties?.sunset?.time;
  if (!sunriseISO || !sunsetISO) throw new Error("sunrise API missing data");
  return { sunriseISO, sunsetISO };
}

/* ────────── Basic pages / routes ────────── */

export default function App() {
  return (
    <Routes>
      <Route path="/Aurora" element={<GradientApp />} />
    </Routes>
  );
}

/* ────────── Main React wrapper ────────── */

function GradientApp() {
  const [wx, setWx] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async (lat, lon, label) => {
    setErr(null);
    setWx(null);
    try {
      const weather = await fetchWeather(lat, lon);
      const sun = await fetchSunTimes(lat, lon, weather.timeISO.split("T")[0]);
      setWx({ ...weather, ...sun, place: label });
    } catch (e) {
      setErr(e.message);
      console.error(e);
    }
  }, []);

  const randomOffice = useCallback(() => {
    const o = offices[Math.floor(Math.random() * offices.length)];
    load(o.lat, o.lon, `${o.city}, ${o.country}`);
  }, [load]);

  useEffect(() => {
    let ok = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => ok && load(coords.latitude, coords.longitude, "Local"),
      () => ok && randomOffice(),
      { maximumAge: 6e5, timeout: 1e4 }
    );
    return () => (ok = false);
  }, [load, randomOffice]);

  return (
    <>
      <Leva collapsed />
      <Canvas flat style={{ width: "100vw", height: "100vh" }}>
        {wx && <GradientScene wx={wx} onRandom={randomOffice} />}
        {!wx && !err && (
          <mesh>
            <planeGeometry args={[10, 10]} />
            <meshBasicMaterial color="black" transparent opacity={0.85} />
          </mesh>
        )}
      </Canvas>
      <div
        style={{
          position: "fixed",
          bottom: 10,
          left: 10,
          color: "white",
          background: "rgba(0,0,0,0.5)",
          padding: "6px 12px",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        {err ? `Error: ${err}` : wx ? `Weather • ${wx.place}` : "Loading…"}
      </div>
    </>
  );
}

/* ────────── Gradient scene & shader ────────── */

function GradientScene({ wx, onRandom }) {
  return <GradientShader wx={wx} onRandom={onRandom} />;
}

const NIGHT_CLARITY = 0.91;
const AURORA_BOOST = 10.5;
const TEMP_HUE_SHIFT = 0.06;
const TEMP_SAT_SHIFT = 0.08;
const TEMP_SOFTNESS = 0.23;
const CLOUD_IMPACT = 0.4;
const PRECIP_IMPACT = 0.5;
const TIME_SCALE = 0.53;
const WIND_SCALE = 3.0;
const NOISE_FREQ = 0.45;
const CLOUD_DETAIL = 0.65;

function GradientShader({ wx, onRandom }) {
  const mesh = useRef();
  const mat = useRef();
  const { viewport, size } = useThree();

  const [ctrl] = useControls(() => ({
    Sky: folder({
      rendering: folder({
        useAPI: { value: true },
        manualTime: {
          value: 12,
          min: 0,
          max: 24,
          step: 0.1,
          render: (g) => !g("Sky.rendering.useAPI"),
        },
        "Random Office": button(() => onRandom(), {
          render: (g) => g("Sky.rendering.useAPI"),
        }),
      }),
      override: folder({
        temp: {
          value: 10,
          min: -20,
          max: 30,
          render: (g) => !g("Sky.rendering.useAPI"),
        },
        wind: {
          value: 4,
          min: 0,
          max: 25,
          render: (g) => !g("Sky.rendering.useAPI"),
        },
        clouds: {
          value: 0.2,
          min: 0,
          max: 1,
          render: (g) => !g("Sky.rendering.useAPI"),
        },
        humidity: {
          value: 0.6,
          min: 0,
          max: 1,
          render: (g) => !g("Sky.rendering.useAPI"),
        },
        precipAmt: {
          value: 0,
          min: 0,
          max: 10,
          render: (g) => !g("Sky.rendering.useAPI"),
        },
        precipType: {
          value: "none",
          options: ["none", "rain", "snow"],
          render: (g) => !g("Sky.rendering.useAPI"),
        },
      }),
    }),
  }));

  const params = useMemo(() => {
    const common = {
      timeISO:
        ctrl.useAPI && wx
          ? wx.timeISO
          : (() => {
              const d = new Date();
              d.setUTCHours(Math.floor(ctrl.manualTime));
              d.setUTCMinutes(Math.round((ctrl.manualTime % 1) * 60));
              d.setUTCSeconds(0, 0);
              return d.toISOString();
            })(),
      auroraBoost: AURORA_BOOST,
      nightClarity: NIGHT_CLARITY,
      tempHueInfluence: TEMP_HUE_SHIFT,
      tempSatInfluence: TEMP_SAT_SHIFT,
      tempSoftness: TEMP_SOFTNESS,
      cloudImpact: CLOUD_IMPACT,
      precipImpact: PRECIP_IMPACT,
      sunriseISO: wx?.sunriseISO,
      sunsetISO: wx?.sunsetISO,
    };
    if (ctrl.useAPI && wx) return { ...common, ...wx };
    return {
      ...common,
      temp: ctrl.temp,
      wind: ctrl.wind,
      clouds: ctrl.clouds,
      humidity: ctrl.humidity,
      precipAmount: ctrl.precipAmt,
      precipType: ctrl.precipType,
    };
  }, [ctrl, wx]);

  const palette = useMemo(() => pickColors(params), [params]);

  useEffect(() => {
    if (mat.current) return;
    mat.current = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector2(size.width, size.height) },
        iTime: { value: 0 },
        uTimeScale: { value: TIME_SCALE },
        uWindScale: { value: WIND_SCALE },
        uNoiseFreq: { value: NOISE_FREQ },
        uCloudDetail: { value: CLOUD_DETAIL },
        uCloudCover: { value: 0.2 },
        uWindNorm: { value: 0.2 },
        uAurora: { value: AURORA_BOOST },
        uColorA: { value: new THREE.Color() },
        uColorB: { value: new THREE.Color() },
        uColorC: { value: new THREE.Color() },
        uColorD: { value: new THREE.Color() },
        uColorE: { value: new THREE.Color() },
      },
      vertexShader: glsl`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: glsl`
        precision mediump float;
        varying vec2 vUv;
        uniform vec2  iResolution; uniform float iTime;
        uniform float uTimeScale,uWindScale,uNoiseFreq,uCloudDetail;
        uniform float uCloudCover,uWindNorm,uAurora;
        uniform vec3  uColorA,uColorB,uColorC,uColorD,uColorE;
        #pragma glslify: snoise = require(glsl-noise/simplex/3d)
        vec3 pal(float t){ vec3 c=uColorA; c=mix(c,uColorB,smoothstep(0.,.25,t)); c=mix(c,uColorC,smoothstep(.25,.5,t)); c=mix(c,uColorD,smoothstep(.5,.75,t)); c=mix(c,uColorE,smoothstep(.75,1.,t)); return c; }
        vec3 toSRGB(vec3 v){return pow(v,vec3(1./2.2));}
        void main(){ vec2 uv=vUv; float t=iTime*uTimeScale;
          float base=snoise(vec3(uv*(.8*uNoiseFreq),t*.1));
          vec2 wind=vec2(snoise(vec3(uv*(2.*uNoiseFreq)+t*.2,t*.5)), snoise(vec3(uv*(2.*uNoiseFreq)-t*.05,t*.2))) * ((pow(uWindNorm,.7)*.15+.02)*uWindScale);
          uv+=wind; uv.x+=base*.05*uNoiseFreq;
          float cloudCover = max(uCloudCover, uWindNorm);
          float g=clamp( uv.y + snoise(vec3(uv*(uCloudDetail*mix(1.,3.,cloudCover)),t*.1))*0.2*cloudCover, 0.,1.);
          g+=sin(uv.y*(10.*uNoiseFreq)+t*.2+base*2.*uNoiseFreq)*.02; g=clamp(g,0.,1.);
          vec3 col=pal(g);
          gl_FragColor=vec4(toSRGB(col),1.); }
      `,
    });
    mesh.current.material = mat.current;
  }, [size.width, size.height]);

  useEffect(() => {
    if (!mat.current || !palette.length) return;
    const u = mat.current.uniforms;
    u.iResolution.value.set(size.width, size.height);
    u.uCloudCover.value = params.clouds ?? 0.2;
    u.uWindNorm.value = Math.max(
      0.2,
      THREE.MathUtils.clamp((params.wind ?? 5) / 25, 0, 1)
    );
    [
      u.uColorA.value,
      u.uColorB.value,
      u.uColorC.value,
      u.uColorD.value,
      u.uColorE.value,
    ] = palette;
  }, [palette, params, size.width, size.height]);

  useFrame((_, d) => {
    if (mat.current) mat.current.uniforms.iTime.value += d;
  });

  return (
    <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
