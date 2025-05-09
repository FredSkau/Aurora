import React, { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useControls, Leva } from "leva";
import * as THREE from "three";
import glsl from "babel-plugin-glsl/macro";

const dayPalettes = [
  {
    max: 0,
    colors: ["#0B0B25", "#3B33C2", "#F7F7FF", "#F7F7FF", "#5BD14A"],
  },
  {
    max: 10,
    colors: ["#6C90C9", "#F7F7FF", "#5BD14A", "#FEFBE7", "#FEEBDE"],
  },
  {
    max: 20,
    colors: ["#5BD14A", "#FEFBE7", "#FEEBDE", "#CF79C3", "#CF79C3"],
  },
  {
    max: 30,
    colors: ["#FEFBE7", "#FEEBDE", "#CF79C3", "#E4927D", "#EC7151"],
  },
];

const nightPalettes = [
  {
    max: 0,
    colors: ["#0B0B25", "#3B33C2", "#3B33C2", "#5BD14A", "#5BD14A"],
  },
  {
    max: 10,
    colors: ["#3B33C2", "#7E7EC4", "#5BD14A", "#DFDABB", "#FEEBDE"],
  },
  {
    max: 20,
    colors: ["#5BD14A", "#ACA785", "#B56DAB", "#CF79C3", "#CF79C3"],
  },
  {
    max: 30,
    colors: ["#E6B48F", "#FDD6BA", "#CF79C3", "#E4927D", "#EC7151"],
  },
];

function pickPalette(temp, isNight) {
  const table = isNight ? nightPalettes : dayPalettes;
  for (const entry of table) {
    if (temp < entry.max) return entry.colors;
  }
  return table[table.length - 1].colors;
}

async function fetchWeather(lat, lon) {
  const r = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`
  );
  if (!r.ok) throw new Error("MET");
  const json = await r.json();
  const now = json.properties.timeseries[0];
  return {
    temp: now.data.instant.details.air_temperature,
    wind: now.data.instant.details.wind_speed,
    timeISO: now.time,
  };
}

async function reverseGeocode(lat, lon) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
  );
  if (!r.ok) return "Ukjent sted";
  const { address } = await r.json();
  return `${address.country || ""}, ${
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    ""
  }`.replace(/^(, | ,)/, "");
}

export default function App() {
  const [wx, setWx] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude, longitude } = coords;
          const data = await fetchWeather(latitude, longitude);
          const place = await reverseGeocode(latitude, longitude);
          setWx({ ...data, place });
        } catch {
          setErr(true);
        }
      },
      () => {
        (async () => {
          try {
            const data = await fetchWeather(59.9127, 10.7461);
            setWx({ ...data, place: "Norge, Oslo" });
          } catch {
            setErr(true);
          }
        })();
      },
      { maximumAge: 600000 }
    );
  }, []);

  const posStyle = {
    position: "fixed",
    bottom: 16,
    left: 16,
    pointerEvents: "none",
    zIndex: 10,
  };

  const containerStyle = {
    display: "inline-flex",
    padding: 12,
    margin: 20,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 15,
    background: "transparent",
    borderRadius: 4,
    backdropFilter: "blur(4px)",
  };

  const titleStyle = {
    height: 18,
    color: "#0B0B26",
    fontFamily: '"Bagoss Standard", sans-serif',
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: 385,
    lineHeight: "20px",
  };

  const labelStyle = {
    color: "#0B0B26",
    fontFamily: '"Bagoss Standard", sans-serif',
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: 520,
    lineHeight: "20px",
  };

  const valueStyle = {
    color: "#0B0B26",
    fontFamily: '"Bagoss Standard", sans-serif',
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: 385,
    lineHeight: "20px",
  };

  return (
    <>
      <Leva collapsed />
      <Canvas flat style={{ width: "100vw", height: "100vh" }}>
        <GradientScene realWind={wx?.wind} />
      </Canvas>

      {!wx && !err && (
        <div
          style={{
            ...posStyle,
            color: "white",
            fontFamily: "system-ui, sans-serif",
            animation: "pulse 1.5s infinite",
          }}
        >
          Henter værdata…
        </div>
      )}

      {err && (
        <div
          style={{
            ...posStyle,
            color: "white",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Kunne ikke hente værdata
        </div>
      )}

      {wx && (
        <div style={{ ...posStyle, ...containerStyle }}>
          <div style={titleStyle}>Data fra Meteorologisk institutt</div>

          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={labelStyle}>Temp</div>
              <div style={valueStyle}>{wx.temp.toFixed(1)}°C</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={labelStyle}>Vind</div>
              <div style={valueStyle}>{wx.wind.toFixed(1)} m/s</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={labelStyle}>Tid</div>
              <div style={valueStyle}>
                {new Date(wx.timeISO).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={labelStyle}>Sted</div>
              <div style={valueStyle}>{wx.place}</div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%{opacity:0.4}50%{opacity:1}100%{opacity:0.4}}`}</style>
    </>
  );
}

function GradientScene({ realWind }) {
  return <GradientShader realWind={realWind} />;
}

function GradientShader({ realWind }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const { viewport } = useThree();

  const { wind, cloudy, temperature, night } = useControls("Weather", {
    wind: { value: 4, min: 0, max: 16, step: 0.1, label: "Wind speed" },
    cloudy: { value: 0.2, min: 0, max: 1, step: 0.01, label: "Clouds" },
    temperature: {
      value: 10,
      min: -10,
      max: 30,
      step: 0.1,
      label: "Temperature (°C)",
    },
    night: { value: false, label: "Night" },
  });

  useEffect(() => {
    materialRef.current = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: {
          value: new THREE.Vector2(viewport.width, viewport.height),
        },
        iTime: { value: 0 },
        uEnableFirstNoise: { value: 1 },
        uFirstNoiseSpeed: { value: 0 },
        uFirstNoiseAmp: { value: 0 },
        uUVScale1: { value: 0.5 },
        uCompress1: { value: 2.0 },
        uEnableSecondNoise: { value: 1 },
        uScale: { value: 1 },
        uNoiseAmpA: { value: 0 },
        uNoiseAmpB: { value: 0 },
        uColorA: { value: new THREE.Color() },
        uColorB: { value: new THREE.Color() },
        uColorC: { value: new THREE.Color() },
        uColorD: { value: new THREE.Color() },
        uColorE: { value: new THREE.Color() },
      },
      vertexShader: glsl`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: glsl`
        precision mediump float;
        varying vec2 vUv;
        uniform vec2 iResolution;
        uniform float iTime;
        uniform float uEnableFirstNoise;
        uniform float uFirstNoiseSpeed;
        uniform float uFirstNoiseAmp;
        uniform float uUVScale1;
        uniform float uCompress1;
        uniform float uEnableSecondNoise;
        uniform float uScale;
        uniform float uNoiseAmpA;
        uniform float uNoiseAmpB;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform vec3 uColorD;
        uniform vec3 uColorE;
        #pragma glslify: snoise = require('glsl-noise/simplex/3d')
        vec3 palette(float t){
          float b1 = smoothstep(0.0, 0.25, t);
          float b2 = smoothstep(0.25, 0.5, t);
          float b3 = smoothstep(0.5, 0.75, t);
          float b4 = smoothstep(0.75, 1.0, t);
          vec3 col1 = mix(uColorA, uColorB, b1);
          vec3 col2 = mix(uColorB, uColorC, b2);
          vec3 col3 = mix(uColorC, uColorD, b3);
          vec3 col4 = mix(uColorD, uColorE, b4);
          vec3 col = mix(col1, col2, step(0.25, t));
          col      = mix(col, col3, step(0.5, t));
          col      = mix(col, col4, step(0.75, t));
          return col;
        }
        vec3 linearToSRGB(vec3 value) { return pow(value, vec3(1.0/2.2)); }
        void main(){
          vec2 uv = vUv;
          uv.x *= iResolution.x / iResolution.y;
          float speed = uFirstNoiseSpeed;
          vec2 baseOffset = vec2(
            snoise(vec3(uv.x * 0.5 - iTime*0.01, uv.y * 0.1, iTime * 0.01))
          ) * 0.5;
          float edgeWeight = (uv.y * (1.0 - uv.y)) * 2.0;
          vec2 offset2 = vec2(
            snoise(vec3(uv.x * 5.0 - iTime*speed, uv.y * 5.0 * edgeWeight, iTime*speed))
          ) * 0.1 * uScale;
          uv += offset2 * edgeWeight;
          vec2 offset1 = vec2(
            snoise(vec3(uv.x * 1.0 - iTime*speed*0.3, uv.y * 2.0 * edgeWeight, iTime*speed))
          ) * 0.5;
          uv += offset1 * edgeWeight;
          uv += baseOffset;
          vec3 color = palette(uv.y);
          color = linearToSRGB(color);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    if (meshRef.current) meshRef.current.material = materialRef.current;
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    if (!materialRef.current) return;

    const windInput = realWind !== undefined && realWind > wind ? realWind : wind;
    const curvedWind = Math.pow(windInput / 16, 0.42) * 16;

    materialRef.current.uniforms.uFirstNoiseSpeed.value = curvedWind * 0.02;
    materialRef.current.uniforms.uFirstNoiseAmp.value = curvedWind * 0.1;
    materialRef.current.uniforms.uNoiseAmpA.value = curvedWind * 0.01;
    materialRef.current.uniforms.uNoiseAmpB.value = curvedWind * 0.01;
    materialRef.current.uniforms.uScale.value = cloudy;

    const palette = pickPalette(temperature, night);
    materialRef.current.uniforms.uColorA.value.set(palette[0]);
    materialRef.current.uniforms.uColorB.value.set(palette[1]);
    materialRef.current.uniforms.uColorC.value.set(palette[2]);
    materialRef.current.uniforms.uColorD.value.set(palette[3]);
    materialRef.current.uniforms.uColorE.value.set(palette[4]);
  }, [realWind, wind, cloudy, temperature, night]);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.iTime.value += delta;
    const res = materialRef.current.uniforms.iResolution.value;
    if (res.x !== viewport.width || res.y !== viewport.height) {
      res.set(viewport.width, viewport.height);
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry />
    </mesh>
  );
}
