import React, { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { folder, useControls, Leva } from "leva";
import * as THREE from "three";
import glsl from "babel-plugin-glsl/macro";

export default function App() {
  return (
    <>
      <Leva collapsed />
      <Canvas style={{ width: "100vw", height: "100vh" }}>
        <GradientScene />
      </Canvas>
    </>
  );
}

function GradientScene() {
  return <GradientShader />;
}

function GradientShader() {
  const meshRef = useRef();
  const materialRef = useRef();
  const { viewport } = useThree();

  const { wind, cloudy, windCurve } = useControls("Weather", {
    wind: { value: 4, min: 0, max: 16, step: 0.1 },
    cloudy: { value: 0.2, min: 0, max: 1, step: 0.01 },
    windCurve: {
      value: 0.4,
      min: 0.1,
      max: 2,
      step: 0.05,
      label: "Wind fall‑off",
    },
  });

  const {
    enableFirstNoise,
    uvFactor1,
    compress1,
    windSpeedFactor1,
    windAmpFactor1,
    enableSecondNoise,
    windSpeedFactor2,
    windAmpAFactor2,
    windAmpBFactor2,
    cloudFreqFactor2,
    baseScale,
  } = useControls(
    "Animation",
    {
      Noise_1: folder(
        {
          enableFirstNoise: true,
          uvFactor1: { value: 0.5, min: 0, max: 2, step: 0.01, label: "UV scale" },
          compress1: {
            value: 2.0,
            min: 0.0,
            max: 5.0,
            step: 0.05,
            label: "Compress",
          },
          windSpeedFactor1: { value: 0.01, min: 0, max: 0.2, step: 0.001 },
          windAmpFactor1: { value: 0.1, min: 0, max: 0.2, step: 0.001 },
        },
        { collapsed: true }
      ),
      Noise_2: folder(
        {
          enableSecondNoise: true,
          windSpeedFactor2: { value: 0.05, min: 0, max: 0.2, step: 0.001 },
          windAmpAFactor2: { value: 0.01, min: 0, max: 0.2, step: 0.001 },
          windAmpBFactor2: { value: 0.01, min: 0, max: 0.1, step: 0.001 },
          cloudFreqFactor2: { value: 15, min: 1, max: 30, step: 1 },
        },
        { collapsed: true }
      ),
      baseScale: { value: 1, min: 0.1, max: 10, step: 0.1 },
    },
    { collapsed: true }
  );

  const { aColor, bColor, cColor, dColor, eColor } = useControls(
    "Colours",
    {
      aColor: "#CFCEFF",
      bColor: "#CF79C3",
      cColor: "#E4927D",
      dColor: "#CFCEFF",
      eColor: "#3B33C2",
    },
    { collapsed: true }
  );

  useEffect(() => {
    materialRef.current = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector2(viewport.width, viewport.height) },
        iTime: { value: 0.0 },

        uEnableFirstNoise: { value: 0.0 },
        uFirstNoiseSpeed: { value: 0.0 },
        uFirstNoiseAmp: { value: 0.0 },
        uUVScale1: { value: 0.5 },
        uCompress1: { value: 0.0 },

        uEnableSecondNoise: { value: 0.0 },
        uScale: { value: 1.0 },
        uNoiseAmpA: { value: 0.0 },
        uNoiseAmpB: { value: 0.0 },

        uColorA: { value: new THREE.Color(aColor) },
        uColorB: { value: new THREE.Color(bColor) },
        uColorC: { value: new THREE.Color(cColor) },
        uColorD: { value: new THREE.Color(dColor) },
        uColorE: { value: new THREE.Color(eColor) },
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

        float compress(float y, float k){
          return 0.5 + (y - 0.5) / (1.0 + abs(y - 0.5) * k);
        }

        void main(){
          vec2 uv = vUv;
          float speed = uFirstNoiseSpeed;

          float n1 = step(0.5, uEnableFirstNoise);
          vec2 scaledUV = uv * uUVScale1;
          vec2 offset1 = vec2(
            snoise(vec3(scaledUV, iTime*speed)),
            snoise(vec3(scaledUV, 1000.0+iTime*speed))
          ) * uFirstNoiseAmp * n1;
          uv += offset1;

          float n2 = step(0.5, uEnableSecondNoise);
          float offsetY = snoise(vec3(uv.x*3.0, uv.x, iTime*speed*2.0))*uNoiseAmpA +
                          snoise(vec3(uv.x*uScale, uv.x - iTime*speed*10.0, iTime*speed*4.0))*uNoiseAmpB;
          uv.y += offsetY * n2;

          float t = compress(uv.y, uCompress1);
          t = clamp(t, 0.0, 1.0);

          vec3 color = palette(t);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    if (meshRef.current) meshRef.current.material = materialRef.current;
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    if (!materialRef.current) return;

    const curvedWind = Math.pow(wind / 16, windCurve) * 16;

    materialRef.current.uniforms.uEnableFirstNoise.value = enableFirstNoise ? 1.0 : 0.0;
    materialRef.current.uniforms.uFirstNoiseSpeed.value = curvedWind * windSpeedFactor1;
    materialRef.current.uniforms.uFirstNoiseAmp.value = curvedWind * windAmpFactor1;
    materialRef.current.uniforms.uUVScale1.value = uvFactor1;
    materialRef.current.uniforms.uCompress1.value = compress1;

    materialRef.current.uniforms.uEnableSecondNoise.value = enableSecondNoise ? 1.0 : 0.0;
    materialRef.current.uniforms.uScale.value = baseScale + cloudy * cloudFreqFactor2;
    materialRef.current.uniforms.uNoiseAmpA.value = curvedWind * windAmpAFactor2;
    materialRef.current.uniforms.uNoiseAmpB.value = curvedWind * windAmpBFactor2;

    materialRef.current.uniforms.uColorA.value.set(aColor);
    materialRef.current.uniforms.uColorB.value.set(bColor);
    materialRef.current.uniforms.uColorC.value.set(cColor);
    materialRef.current.uniforms.uColorD.value.set(dColor);
    materialRef.current.uniforms.uColorE.value.set(eColor);
  }, [
    wind,
    windCurve,
    cloudy,
    enableFirstNoise,
    uvFactor1,
    compress1,
    windSpeedFactor1,
    windAmpFactor1,
    enableSecondNoise,
    windSpeedFactor2,
    windAmpAFactor2,
    windAmpBFactor2,
    cloudFreqFactor2,
    baseScale,
    aColor,
    bColor,
    cColor,
    dColor,
    eColor,
  ]);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.iTime.value += delta;
    const res = materialRef.current.uniforms.iResolution.value;
    if (res.x !== viewport.width || res.y !== viewport.height) res.set(viewport.width, viewport.height);
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry />
    </mesh>
  );
}
