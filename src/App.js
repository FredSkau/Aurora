import React, { useRef, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { folder, useControls, Leva } from "leva"
import * as THREE from "three"
import glsl from "babel-plugin-glsl/macro"

export default function App() {
  return (
    <>
      <Leva />
      <Canvas style={{ width: "100vw", height: "100vh" }}>
        <Scene />
        <OrbitControls />
      </Canvas>
    </>
  )
}

function Scene() {
  return <GradientShader />
}

function GradientShader() {
  const meshRef = useRef()
  const materialRef = useRef()
  const { viewport } = useThree()

  const {
    enableFirstNoise,
    firstNoiseSpeed,
    firstNoiseAmp,
    enableSecondNoise,
    scaleAmount,
    noiseAmpA,
    noiseAmpB,
    rotatePoints,
    rotateSpeed,
    rotateOffset,
    rotateRadius,
    aColor,
    bColor,
    cColor,
    dColor,
    falloff,
    cornerDistance,
    enableFigure8,
    figure8Frequency,
    figure8Amplitude,
    figure8PhaseShift,
    figure8YScale
  } = useControls({
    Noise: folder({
      enableFirstNoise: { value: true },
      firstNoiseSpeed: { value: 0.1, min: 0, max: 1, step: 0.01 },
      firstNoiseAmp: { value: 0.5, min: 0, max: 2, step: 0.01 },
      enableSecondNoise: { value: true },
      scaleAmount: { value: 10, min: 1, max: 50, step: 1 },
      noiseAmpA: { value: 0.2, min: 0, max: 1, step: 0.01 },
      noiseAmpB: { value: 0.01, min: 0, max: 0.1, step: 0.001 }
    }),
    Rotation: folder({
      rotatePoints: { value: true },
      rotateSpeed: { value: 0.3, min: 0, max: 2, step: 0.01 },
      rotateOffset: { value: 0, min: 0, max: 6.28, step: 0.01 },
      rotateRadius: { value: 0.2, min: 0, max: 0.5, step: 0.01 }
    }),
    Positions: folder({
      cornerDistance: { value: 0.2, min: 0, max: 0.49, step: 0.01 }
    }),
    Figure8: folder({
      enableFigure8: { value: false },
      figure8Frequency: { value: 1, min: 0, max: 5, step: 0.1 },
      figure8Amplitude: { value: 0.2, min: 0, max: 0.5, step: 0.01 },
      figure8PhaseShift: { value: 0, min: 0, max: 6.28, step: 0.01 },
      figure8YScale: { value: 0.5, min: 0, max: 2, step: 0.01 }
    }),
    Colors: folder({
      aColor: { value: "#052FE0" },
      bColor: { value: "#FFFFFF" },
      cColor: { value: "#FF8080" },
      dColor: { value: "#800080" },
      falloff: { value: 3, min: 1, max: 10, step: 0.1 }
    })
  })

  useEffect(() => {
    materialRef.current = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector2(viewport.width, viewport.height) },
        iTime: { value: 0.0 },
        uEnableFirstNoise: { value: enableFirstNoise ? 1.0 : 0.0 },
        uFirstNoiseSpeed: { value: firstNoiseSpeed },
        uFirstNoiseAmp: { value: firstNoiseAmp },
        uEnableSecondNoise: { value: enableSecondNoise ? 1.0 : 0.0 },
        uScale: { value: scaleAmount },
        uNoiseAmpA: { value: noiseAmpA },
        uNoiseAmpB: { value: noiseAmpB },
        uRotatePoints: { value: rotatePoints ? 1.0 : 0.0 },
        uRotateSpeed: { value: rotateSpeed },
        uRotateOffset: { value: rotateOffset },
        uRotateRadius: { value: rotateRadius },
        uColorA: { value: new THREE.Color(aColor) },
        uColorB: { value: new THREE.Color(bColor) },
        uColorC: { value: new THREE.Color(cColor) },
        uColorD: { value: new THREE.Color(dColor) },
        uFalloff: { value: falloff },
        uCornerDistance: { value: cornerDistance },
        uEnableFigure8: { value: enableFigure8 ? 1.0 : 0.0 },
        uFigure8Frequency: { value: figure8Frequency },
        uFigure8Amplitude: { value: figure8Amplitude },
        uFigure8PhaseShift: { value: figure8PhaseShift },
        uFigure8YScale: { value: figure8YScale }
      },
      vertexShader: glsl`
        precision mediump float;
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
        uniform float uEnableSecondNoise;
        uniform float uScale;
        uniform float uNoiseAmpA;
        uniform float uNoiseAmpB;
        uniform float uRotatePoints;
        uniform float uRotateSpeed;
        uniform float uRotateOffset;
        uniform float uRotateRadius;
        uniform vec3  uColorA;
        uniform vec3  uColorB;
        uniform vec3  uColorC;
        uniform vec3  uColorD;
        uniform float uFalloff;
        uniform float uCornerDistance;
        uniform float uEnableFigure8;
        uniform float uFigure8Frequency;
        uniform float uFigure8Amplitude;
        uniform float uFigure8PhaseShift;
        uniform float uFigure8YScale;
        #pragma glslify: snoise = require('glsl-noise/simplex/3d')
        void main() {
          vec2 uv = vUv;
          float doNoise1 = step(0.5, uEnableFirstNoise);
          float speed = uFirstNoiseSpeed;
          float noiseX = snoise(vec3(uv * 0.5, iTime * speed)) * doNoise1;
          float noiseY = snoise(vec3(uv * 0.5, 1000.0 + iTime * speed)) * doNoise1;
          uv.x += noiseX * uFirstNoiseAmp;
          uv.y += noiseY * uFirstNoiseAmp;
          float doNoise2 = step(0.5, uEnableSecondNoise);
          float noiseA = snoise(vec3(uv.x * 3.0, uv.x, iTime * speed * 2.0)) * doNoise2;
          float noiseB = snoise(vec3(uv.x * uScale, uv.x - iTime * speed * 10.0, iTime * speed * 4.0)) * doNoise2;
          uv.y += noiseA * uNoiseAmpA;
          uv.y += noiseB * uNoiseAmpB;
          float doRotate = step(0.5, uRotatePoints);
          float angle = iTime * uRotateSpeed + uRotateOffset;
          float cd = uCornerDistance;
          vec2 staticA = vec2(0.5 - cd, 0.5 - cd);
          vec2 staticB = vec2(0.5 + cd, 0.5 - cd);
          vec2 staticC = vec2(0.5 - cd, 0.5 + cd);
          vec2 staticD = vec2(0.5 + cd, 0.5 + cd);
          float angleA = angle + 0.0;
          float angleB = angle + 1.5708;
          float angleC = angle + 3.14159;
          float angleD = angle + 4.71239;
          vec2 offsetA = doRotate * (uRotateRadius * vec2(cos(angleA), sin(angleA)));
          vec2 offsetB = doRotate * (uRotateRadius * vec2(cos(angleB), sin(angleB)));
          vec2 offsetC = doRotate * (uRotateRadius * vec2(cos(angleC), sin(angleC)));
          vec2 offsetD = doRotate * (uRotateRadius * vec2(cos(angleD), sin(angleD)));
          float doFigure8 = step(0.5, uEnableFigure8);
          vec2 offsetA8 = doFigure8 * (uFigure8Amplitude * vec2(cos(angleA * uFigure8Frequency), sin(angleA * uFigure8Frequency * 2.0 + uFigure8PhaseShift) * uFigure8YScale));
          vec2 offsetB8 = doFigure8 * (uFigure8Amplitude * vec2(cos(angleB * uFigure8Frequency), sin(angleB * uFigure8Frequency * 2.0 + uFigure8PhaseShift) * uFigure8YScale));
          vec2 offsetC8 = doFigure8 * (uFigure8Amplitude * vec2(cos(angleC * uFigure8Frequency), sin(angleC * uFigure8Frequency * 2.0 + uFigure8PhaseShift) * uFigure8YScale));
          vec2 offsetD8 = doFigure8 * (uFigure8Amplitude * vec2(cos(angleD * uFigure8Frequency), sin(angleD * uFigure8Frequency * 2.0 + uFigure8PhaseShift) * uFigure8YScale));
          vec2 aPoint = staticA + offsetA + offsetA8;
          vec2 bPoint = staticB + offsetB + offsetB8;
          vec2 cPoint = staticC + offsetC + offsetC8;
          vec2 dPoint = staticD + offsetD + offsetD8;
          float EPS = 0.0001;
          float distA = distance(uv, aPoint);
          float distB = distance(uv, bPoint);
          float distC = distance(uv, cPoint);
          float distD = distance(uv, dPoint);
          float wA = 1.0 / pow(distA + EPS, uFalloff);
          float wB = 1.0 / pow(distB + EPS, uFalloff);
          float wC = 1.0 / pow(distC + EPS, uFalloff);
          float wD = 1.0 / pow(distD + EPS, uFalloff);
          float sumW = wA + wB + wC + wD;
          vec3 finalColor = (uColorA * wA + uColorB * wB + uColorC * wC + uColorD * wD) / sumW;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    })
    if (meshRef.current) {
      meshRef.current.material = materialRef.current
    }
  }, [viewport.width, viewport.height])

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uEnableFirstNoise.value = enableFirstNoise ? 1.0 : 0.0
      materialRef.current.uniforms.uFirstNoiseSpeed.value = firstNoiseSpeed
      materialRef.current.uniforms.uFirstNoiseAmp.value = firstNoiseAmp
      materialRef.current.uniforms.uEnableSecondNoise.value = enableSecondNoise ? 1.0 : 0.0
      materialRef.current.uniforms.uScale.value = scaleAmount
      materialRef.current.uniforms.uNoiseAmpA.value = noiseAmpA
      materialRef.current.uniforms.uNoiseAmpB.value = noiseAmpB
      materialRef.current.uniforms.uRotatePoints.value = rotatePoints ? 1.0 : 0.0
      materialRef.current.uniforms.uRotateSpeed.value = rotateSpeed
      materialRef.current.uniforms.uRotateOffset.value = rotateOffset
      materialRef.current.uniforms.uRotateRadius.value = rotateRadius
      materialRef.current.uniforms.uColorA.value.set(aColor)
      materialRef.current.uniforms.uColorB.value.set(bColor)
      materialRef.current.uniforms.uColorC.value.set(cColor)
      materialRef.current.uniforms.uColorD.value.set(dColor)
      materialRef.current.uniforms.uFalloff.value = falloff
      materialRef.current.uniforms.uCornerDistance.value = cornerDistance
      materialRef.current.uniforms.uEnableFigure8.value = enableFigure8 ? 1.0 : 0.0
      materialRef.current.uniforms.uFigure8Frequency.value = figure8Frequency
      materialRef.current.uniforms.uFigure8Amplitude.value = figure8Amplitude
      materialRef.current.uniforms.uFigure8PhaseShift.value = figure8PhaseShift
      materialRef.current.uniforms.uFigure8YScale.value = figure8YScale
    }
  }, [
    enableFirstNoise,
    firstNoiseSpeed,
    firstNoiseAmp,
    enableSecondNoise,
    scaleAmount,
    noiseAmpA,
    noiseAmpB,
    rotatePoints,
    rotateSpeed,
    rotateOffset,
    rotateRadius,
    aColor,
    bColor,
    cColor,
    dColor,
    falloff,
    cornerDistance,
    enableFigure8,
    figure8Frequency,
    figure8Amplitude,
    figure8PhaseShift,
    figure8YScale
  ])

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.iTime.value += delta
      const res = materialRef.current.uniforms.iResolution.value
      if (res.x !== viewport.width || res.y !== viewport.height) {
        res.set(viewport.width, viewport.height)
      }
    }
  })

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry />
    </mesh>
  )
}
