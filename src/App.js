import './App.css';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import glsl from 'babel-plugin-glsl/macro';
import { OrbitControls } from '@react-three/drei';
import { useControls, folder } from 'leva';

extend({ ShaderMaterial: THREE.ShaderMaterial });

const weatherTypeMap = {
  sun: 0,
  cloud: 1,
  rain: 2,
  lightning: 3,
  snow: 4,
  fog: 5,
};

const weatherPresets = {
  Custom: { timeOfDay: 12, windSpeed: 2, temperature: 20, weatherType: 'sun' },
  Stormy: { timeOfDay: 14, windSpeed: 15, temperature: 5, weatherType: 'lightning' },
  Sunrise: { timeOfDay: 6, windSpeed: 2, temperature: 10, weatherType: 'sun' },
  ClearSkies: { timeOfDay: 12, windSpeed: 3, temperature: 25, weatherType: 'sun' },
  Midnight: { timeOfDay: 0, windSpeed: 1, temperature: 0, weatherType: 'fog' },
};

const BackgroundShader = ({
  // Leva-controlled values:
  windSpeed,
  temperature,
  weatherType,
  dayZenith,
  dayHorizon,
  duskZenith,
  duskHorizon,
  nightZenith,
  nightHorizon,
  cloudOverlay1,
  cloudOverlay2,
  cloudOverlay3,
  fogOverlay1,
  fogOverlay2,
  fogOverlay3,
  rainOverlay1,
  rainOverlay2,
  rainOverlay3,
  snowOverlay1,
  snowOverlay2,
  snowOverlay3,
  warmTempOverlay,
  coldTempOverlay,
  overlayBlendMode,
  weatherOverlayFactor,
  temperatureOverlayFactor,
  wireframe,
}) => {
  const materialRef = useRef();
  const meshRef = useRef();

  // Create the material once.
  useEffect(() => {
    materialRef.current = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        // Start with an initial timeOfDay (will animate later).
        timeOfDay: { value: 0.0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        temperature: { value: temperature },
        weatherType: { value: weatherTypeMap[weatherType] || 0 },
        // Wave uniforms:
        waveFrequency: { value: 1.0 },
        waveAmplitude: { value: 0.1 },
        waveSpeed: { value: 0.1 },
        // Sky gradient colors:
        dayZenith: { value: new THREE.Color(dayZenith) },
        dayHorizon: { value: new THREE.Color(dayHorizon) },
        duskZenith: { value: new THREE.Color(duskZenith) },
        duskHorizon: { value: new THREE.Color(duskHorizon) },
        nightZenith: { value: new THREE.Color(nightZenith) },
        nightHorizon: { value: new THREE.Color(nightHorizon) },
        // Weather overlay colors as arrays of 3 colors:
        cloudOverlay: { value: [
          new THREE.Color(cloudOverlay1),
          new THREE.Color(cloudOverlay2),
          new THREE.Color(cloudOverlay3)
        ]},
        fogOverlay: { value: [
          new THREE.Color(fogOverlay1),
          new THREE.Color(fogOverlay2),
          new THREE.Color(fogOverlay3)
        ]},
        rainOverlay: { value: [
          new THREE.Color(rainOverlay1),
          new THREE.Color(rainOverlay2),
          new THREE.Color(rainOverlay3)
        ]},
        snowOverlay: { value: [
          new THREE.Color(snowOverlay1),
          new THREE.Color(snowOverlay2),
          new THREE.Color(snowOverlay3)
        ]},
        // Temperature overlays:
        warmTempOverlay: { value: new THREE.Color(warmTempOverlay) },
        coldTempOverlay: { value: new THREE.Color(coldTempOverlay) },
        overlayBlendMode: { value: overlayBlendMode },
        weatherOverlayFactor: { value: weatherOverlayFactor },
        temperatureOverlayFactor: { value: temperatureOverlayFactor },
      },
      vertexShader: glsl`
        precision mediump float;
        varying vec2 vUv;
        uniform float time;
        uniform float waveFrequency;
        uniform float waveAmplitude;
        uniform float waveSpeed;
        #pragma glslify: snoise = require(glsl-noise/simplex/3d)
        void main() {
          vUv = uv;
          vec3 pos = position;
          vec2 noiseCoord = uv * vec2(waveFrequency, waveFrequency * 3.0);
          float noise = snoise(vec3(
            noiseCoord.x - time * waveSpeed * 0.1,
            noiseCoord.y,
            time * waveSpeed * 0.1
          ));
          pos.z += noise * waveAmplitude;
          pos.y += noise * 0.1;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: glsl`
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;

        uniform float waveFrequency;
        uniform float waveAmplitude;
        uniform float waveSpeed;

        uniform float timeOfDay;
        uniform float temperature;
        uniform int weatherType;
        uniform vec3 dayZenith;
        uniform vec3 dayHorizon;
        uniform vec3 duskZenith;
        uniform vec3 duskHorizon;
        uniform vec3 nightZenith;
        uniform vec3 nightHorizon;

        uniform vec3 cloudOverlay[3];
        uniform vec3 fogOverlay[3];
        uniform vec3 rainOverlay[3];
        uniform vec3 snowOverlay[3];

        uniform vec3 warmTempOverlay;
        uniform vec3 coldTempOverlay;
        uniform int overlayBlendMode;
        uniform float weatherOverlayFactor;
        uniform float temperatureOverlayFactor;
        #define PI 3.14159
        #pragma glslify: snoise = require(glsl-noise/simplex/3d)
        
        vec3 blendLinear(vec3 base, vec3 overlay, float factor) {
          return mix(base, overlay, factor);
        }
        vec3 blendMultiply(vec3 base, vec3 overlay, float factor) {
          return mix(base, base * overlay, factor);
        }
        vec3 blendScreen(vec3 base, vec3 overlay, float factor) {
          vec3 screen = 1.0 - ((1.0 - base) * (1.0 - overlay));
          return mix(base, screen, factor);
        }
        vec3 applyBlendMode(vec3 base, vec3 overlay, float factor, int mode) {
          if(mode == 1) {
            return blendMultiply(base, overlay, factor);
          } else if(mode == 2) {
            return blendScreen(base, overlay, factor);
          }
          return blendLinear(base, overlay, factor);
        }
        
        vec3 computeOverlay(vec3 colors[3], float n) {
          float scaled = n * 2.0;
          if(scaled < 1.0) {
            return mix(colors[0], colors[1], scaled);
          } else {
            return mix(colors[1], colors[2], scaled - 1.0);
          }
        }
        
        void main() {
          vec2 uv = vUv;
          float sunHeight = sin((timeOfDay - 6.0) / 12.0 * PI);
          float dayTime = smoothstep(0.2, 0.4, sunHeight);
          float duskDawn = smoothstep(-0.2, 0.2, sunHeight) * (1.0 - dayTime);
          float t = smoothstep(6.0, 18.0, timeOfDay);
          float tilt = mix(uv.x, 1.0 - uv.x, t) * 0.3;
          float horizon = pow(clamp(1.0 - uv.y + tilt, 0.0, 1.0), 6.0);
          vec3 dayColor = mix(dayZenith, dayHorizon, horizon);
          vec3 duskColor = mix(duskZenith, duskHorizon, horizon);
          vec3 nightColor = mix(nightZenith, nightHorizon, horizon);
          vec3 skyColor = mix(nightColor, duskColor, duskDawn);
          skyColor = mix(skyColor, dayColor, dayTime);
          vec3 finalColor = skyColor;

          vec2 noiseCoord = uv * vec2(1.0, 2.0 + waveFrequency * 0.5);

          float noiseLow = snoise(vec3(
            noiseCoord.x * 0.5 + time * waveSpeed * 0.05,
            noiseCoord.y * 0.5,
            time * waveSpeed * 0.1
          ));
          
          float noiseMid = snoise(vec3(
            noiseCoord.x + time * waveSpeed * 0.1,
            noiseCoord.y + time * waveSpeed * 0.1,
            time * waveSpeed * 0.2
          ));
          
          float noiseHigh = snoise(vec3(
            noiseCoord.x * 2.0 + time * waveSpeed * 0.2,
            noiseCoord.y * 2.0,
            time * waveSpeed * 0.4
          ));

          float noiseVal = noiseLow * noiseMid * 0.5 + 0.5;
          
          float overlayWeight = smoothstep(0.3, 0.7, noiseVal);
          
          vec3 overlayColor = vec3(0.0);
          if(weatherType == 1) {
            overlayColor = computeOverlay(cloudOverlay, noiseVal);
          } else if(weatherType == 2) {
            overlayColor = computeOverlay(rainOverlay, noiseVal);
          } else if(weatherType == 4) {
            overlayColor = computeOverlay(snowOverlay, noiseVal);
          } else if(weatherType == 5) {
            overlayColor = computeOverlay(fogOverlay, noiseVal);
          }
          
          finalColor = applyBlendMode(finalColor, overlayColor, overlayWeight * weatherOverlayFactor, overlayBlendMode);
          
          float tempFactor = clamp((temperature + 30.0) / 60.0, 0.0, 1.0);
          vec3 tempOverlay = mix(coldTempOverlay, warmTempOverlay, tempFactor);
          finalColor = applyBlendMode(finalColor, tempOverlay, temperatureOverlayFactor, overlayBlendMode);
          
          finalColor.rgb = (finalColor.rgb * (2.51 * finalColor.rgb + 0.03))
                          / (finalColor.rgb * (2.43 * finalColor.rgb + 0.59) + 0.14);
          finalColor = pow(finalColor, vec3(0.4545));
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      wireframe: wireframe,
    });
    if (meshRef.current) {
      meshRef.current.material = materialRef.current;
    }
  }, []);

  useEffect(() => {
    if (materialRef.current) {
      const uniforms = materialRef.current.uniforms;
      uniforms.temperature.value = temperature;
      uniforms.weatherType.value = weatherTypeMap[weatherType] || 0;
      uniforms.dayZenith.value = new THREE.Color(dayZenith);
      uniforms.dayHorizon.value = new THREE.Color(dayHorizon);
      uniforms.duskZenith.value = new THREE.Color(duskZenith);
      uniforms.duskHorizon.value = new THREE.Color(duskHorizon);
      uniforms.nightZenith.value = new THREE.Color(nightZenith);
      uniforms.nightHorizon.value = new THREE.Color(nightHorizon);
      uniforms.cloudOverlay.value[0] = new THREE.Color(cloudOverlay1);
      uniforms.cloudOverlay.value[1] = new THREE.Color(cloudOverlay2);
      uniforms.cloudOverlay.value[2] = new THREE.Color(cloudOverlay3);
      uniforms.fogOverlay.value[0] = new THREE.Color(fogOverlay1);
      uniforms.fogOverlay.value[1] = new THREE.Color(fogOverlay2);
      uniforms.fogOverlay.value[2] = new THREE.Color(fogOverlay3);
      uniforms.rainOverlay.value[0] = new THREE.Color(rainOverlay1);
      uniforms.rainOverlay.value[1] = new THREE.Color(rainOverlay2);
      uniforms.rainOverlay.value[2] = new THREE.Color(rainOverlay3);
      uniforms.snowOverlay.value[0] = new THREE.Color(snowOverlay1);
      uniforms.snowOverlay.value[1] = new THREE.Color(snowOverlay2);
      uniforms.snowOverlay.value[2] = new THREE.Color(snowOverlay3);
      uniforms.warmTempOverlay.value = new THREE.Color(warmTempOverlay);
      uniforms.coldTempOverlay.value = new THREE.Color(coldTempOverlay);
      uniforms.overlayBlendMode.value = overlayBlendMode;
      uniforms.weatherOverlayFactor.value = weatherOverlayFactor;
      uniforms.temperatureOverlayFactor.value = temperatureOverlayFactor;
      const speedNormalized = windSpeed / 16.0;
      uniforms.waveFrequency.value = 1.0 + speedNormalized * 4.0;
      uniforms.waveAmplitude.value = 0.1 + speedNormalized * 0.1;
      uniforms.waveSpeed.value = 0.1 + speedNormalized * 2.9;
    }
  }, [
    temperature,
    weatherType,
    windSpeed,
    dayZenith,
    dayHorizon,
    duskZenith,
    duskHorizon,
    nightZenith,
    nightHorizon,
    cloudOverlay1,
    cloudOverlay2,
    cloudOverlay3,
    fogOverlay1,
    fogOverlay2,
    fogOverlay3,
    rainOverlay1,
    rainOverlay2,
    rainOverlay3,
    snowOverlay1,
    snowOverlay2,
    snowOverlay3,
    warmTempOverlay,
    coldTempOverlay,
    overlayBlendMode,
    weatherOverlayFactor,
    temperatureOverlayFactor,
  ]);

  const timeSpeed = 1.0;
  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value += delta;
      const current = materialRef.current.uniforms.timeOfDay.value;
      const newTime = (current + delta * timeSpeed) % 24.0;
      materialRef.current.uniforms.timeOfDay.value = newTime;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[3, 2, 150, 100]} />
    </mesh>
  );
};

const Scene = () => {
  const [{
    windSpeed,
    temperature,
    weatherType,
    dayZenith,
    dayHorizon,
    duskZenith,
    duskHorizon,
    nightZenith,
    nightHorizon,
    cloudOverlay1,
    cloudOverlay2,
    cloudOverlay3,
    fogOverlay1,
    fogOverlay2,
    fogOverlay3,
    rainOverlay1,
    rainOverlay2,
    rainOverlay3,
    snowOverlay1,
    snowOverlay2,
    snowOverlay3,
    warmTempOverlay,
    coldTempOverlay,
    overlayBlendMode,
    weatherOverlayFactor,
    temperatureOverlayFactor,
    wireframe,
  }, set] = useControls(() => ({
    Weather: folder({
      weatherPreset: {
        value: 'Custom',
        options: Object.keys(weatherPresets),
        onChange: (presetName) => {
          if (presetName === 'Custom') return;
          const preset = weatherPresets[presetName];
          set({ Weather: preset });
        },
      },
      windSpeed: { value: 2, min: 0, max: 16, step: 0.1 },
      temperature: { value: 20, min: -30, max: 30, step: 1 },
      weatherType: {
        value: 'snow',
        options: ['sun', 'cloud', 'rain', 'lightning', 'snow', 'fog']
      },
    }),
    Colors: folder({
      dayZenith: { value: '#CFCEFF' },
      dayHorizon: { value: '#FEFBE6' },
      duskZenith: { value: '#33264d' },
      duskHorizon: { value: '#ff8033' },
      nightZenith: { value: '#0B0B26' },
      nightHorizon: { value: '#0A0A2D' },
    }),
    Overlays: folder({
      Cloud: folder({
        cloudOverlay1: { value: '#FFFEF6' },
        cloudOverlay2: { value: '#E9E9FF' },
        cloudOverlay3: { value: '#FEFBE6' },
      }),
      Fog: folder({
        fogOverlay1: { value: '#0A0A2D' },
        fogOverlay2: { value: '#F3EFD5' },
        fogOverlay3: { value: '#020124' },
      }),
      Rain: folder({
        rainOverlay1: { value: '#2C16B4' },
        rainOverlay2: { value: '#5C44ED' },
        rainOverlay3: { value: '#372BC5' },
      }),
      Snow: folder({
        snowOverlay1: { value: '#9795FF' },
        snowOverlay2: { value: '#FFC499' },
        snowOverlay3: { value: '#B2B0FF' },
      }),
      warmTempOverlay: { value: '#ffcc99' },
      coldTempOverlay: { value: '#99ccff' },
      overlayBlendMode: { value: 1, options: { Linear: 0, Multiply: 1, Screen: 2 }},
      weatherOverlayFactor: { value: 1.0, min: 0, max: 1, step: 0.01},
      temperatureOverlayFactor: { value: 0.3, min: 0, max: 1, step: 0.01},
    }),
    wireframe: false,
  }));

  return (
    <Canvas camera={{ position: [0, 0, 1], fov: 50 }}>
      <BackgroundShader
        windSpeed={windSpeed}
        temperature={temperature}
        weatherType={weatherType}
        dayZenith={dayZenith}
        dayHorizon={dayHorizon}
        duskZenith={duskZenith}
        duskHorizon={duskHorizon}
        nightZenith={nightZenith}
        nightHorizon={nightHorizon}
        cloudOverlay1={cloudOverlay1}
        cloudOverlay2={cloudOverlay2}
        cloudOverlay3={cloudOverlay3}
        fogOverlay1={fogOverlay1}
        fogOverlay2={fogOverlay2}
        fogOverlay3={fogOverlay3}
        rainOverlay1={rainOverlay1}
        rainOverlay2={rainOverlay2}
        rainOverlay3={rainOverlay3}
        snowOverlay1={snowOverlay1}
        snowOverlay2={snowOverlay2}
        snowOverlay3={snowOverlay3}
        warmTempOverlay={warmTempOverlay}
        coldTempOverlay={coldTempOverlay}
        overlayBlendMode={overlayBlendMode}
        weatherOverlayFactor={weatherOverlayFactor}
        temperatureOverlayFactor={temperatureOverlayFactor}
        wireframe={wireframe}
      />
      <OrbitControls />
    </Canvas>
  );
};

function App() {
  return <Scene />;
}

export default App;
