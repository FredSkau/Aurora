import './App.css';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import glsl from 'babel-plugin-glsl/macro';
import { OrbitControls } from '@react-three/drei';
import { useControls, folder } from 'leva';

extend({ ShaderMaterial: THREE.ShaderMaterial });

const Scene = () => {
  const palettes = {
    "Twilight": [
      new THREE.Color(0.757, 0.839, 0.941),
      new THREE.Color(0.961, 0.749, 0.710),
      new THREE.Color(0.898, 0.431, 0.427),
      new THREE.Color(0.251, 0.263, 0.655),
      new THREE.Color(0.573, 0.663, 0.851),
    ],
    "Summer Dusk": [
      new THREE.Color(0.912, 0.529, 0.573),
      new THREE.Color(0.984, 0.843, 0.757),
      new THREE.Color(0.984, 0.678, 0.627),
      new THREE.Color(0.435, 0.361, 0.639),
      new THREE.Color(0.898, 0.408, 0.486),
    ],
    "Afterglow": [
      new THREE.Color(0.961, 0.796, 0.733),
      new THREE.Color(0.984, 0.667, 0.529),
      new THREE.Color(0.984, 0.392, 0.365),
      new THREE.Color(0.286, 0.298, 0.682),
      new THREE.Color(0.765, 0.388, 0.784),
    ],
    "Evening": [
      new THREE.Color(0.153, 0.502, 0.655),
      new THREE.Color(0.200, 0.675, 0.624),
      new THREE.Color(0.573, 0.639, 0.890),
      new THREE.Color(0.149, 0.435, 0.882),
      new THREE.Color(0.314, 0.675, 0.624),
    ],
    "Aurora": [
      new THREE.Color(0.149, 0.651, 0.243),
      new THREE.Color(0.216, 0.490, 0.804),
      new THREE.Color(0.435, 0.475, 0.878),
      new THREE.Color(0.082, 0.278, 0.682),
      new THREE.Color(0.059, 0.059, 0.549),
    ],
    "Cloudy": [
      new THREE.Color(0.843, 0.976, 0.933),
      new THREE.Color(0.678, 0.753, 0.890),
      new THREE.Color(0.243, 0.498, 0.663),
      new THREE.Color(0.078, 0.361, 0.608),
      new THREE.Color(0.059, 0.059, 0.549),
    ],
  };

  const blendingModes = {
    Linear: 0,
    Overlay: 1,
    Sharp: 2,
  };

  const { Frequency, Amplitude, Speed, palette, blendingMode, cFrequency, cAmplitude, cSpeed, wireframe } = useControls({
    Waves: folder({
      Frequency: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
      Amplitude: { value: 0.3, min: 0.1, max: 1.0, step: 0.1 },
      Speed: { value: 0.5, min: 0.1, max: 10.0, step: 0.1 },
    }),
    Colors: folder({
      palette: { options: Object.keys(palettes) },
      blendingMode: { options: Object.keys(blendingModes) },
      Waves: folder({
        cFrequency: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
        cAmplitude: { value: 1, min: 0.1, max: 2.0, step: 0.1 },
        cSpeed: { value: 2.0, min: 0.1, max: 10.0, step: 0.1 },
      }),
    }),
    wireframe: false,
  });

  const materialRef = useRef();

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.colors.value = palettes[palette];
      materialRef.current.uniforms.blendingMode.value = blendingModes[blendingMode];
    }
  }, [palette, blendingMode]);

  const BackgroundShader = () => {
    useFrame((_, delta) => {
      if (materialRef.current) {
        materialRef.current.uniforms.time.value += delta;
      }
    });
  
    const shaderMaterial = {
      uniforms: {
        time: { value: 0.0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        colors: { value: palettes[palette] },
        blendingMode: { value: blendingModes[blendingMode] },
        waveFrequency: { value: Frequency },
        waveAmplitude: { value: Amplitude },
        waveSpeed: { value: Speed },
        cFrequency: { value: cFrequency },
        cAmplitude: { value: cAmplitude },
        cSpeed: { value: cSpeed },
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
  
          vec2 noiseCoord = uv*vec2(waveFrequency, waveFrequency * 3.);
  
          float noise = snoise(vec3(noiseCoord.x - time * waveSpeed * 0.01, noiseCoord.y, time * waveSpeed * 0.1));
  
          pos.z += noise * waveAmplitude;
          pos.y += noise * 0.1;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
      `,
      fragmentShader: glsl`
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        uniform vec3 colors[5];
        uniform int blendingMode;
        varying vec2 vUv;
        uniform float cFrequency;
        uniform float cAmplitude;
        uniform float cSpeed;
  
        #pragma glslify: snoise = require(glsl-noise/simplex/3d)
  
        void main() {
  
          vec2 noiseCoord = vUv * vec2(cFrequency, cFrequency * 3.);
  
          vec3 finalColor = colors[4];
  
          for (int i = 0; i < 4; i++){
            float flow = 1. + float(i) * 0.1;
            float speed = cSpeed + float(i) * 0.1;
            float seed = 1. + float(i) * 2.;
            float noise = snoise(
              vec3(
                noiseCoord.x + time * 0.01 * flow, 
                noiseCoord.y, 
                time * 0.1 * speed + seed
              )
            ) * 0.5 + 0.5;
  
            if (blendingMode == 0) {
              finalColor = mix(finalColor, colors[i], noise * cAmplitude);
            } else if (blendingMode == 1) {
              float overlayNoise = noise * noise * (3.0 - 2.0 * noise);
              finalColor = mix(finalColor, colors[i], overlayNoise * cAmplitude);
            } else if (blendingMode == 2) {
              float sharpNoise = pow(noise, 2.0);
              finalColor = mix(finalColor, colors[i], sharpNoise * cAmplitude);
            }
          }
          gl_FragColor = vec4(finalColor, 1.0);
      }
      `,
      wireframe: wireframe,
    };
  
    return (
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[3, 2, 150, 100]} />
        <shaderMaterial ref={materialRef} {...shaderMaterial} />
      </mesh>
    );
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{
          position: [0, -0.8, 2],
          rotation: [Math.PI / 180 * 20, 0, 0],
          fov: 30,
        }}
      >
        <BackgroundShader />
        <OrbitControls />
      </Canvas>
    </div>
  );
};

function App() {
  return <Scene />;
}

export default App;
