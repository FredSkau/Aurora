import React, { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useControls } from "leva";
import * as THREE from "three";
import glsl from "babel-plugin-glsl/macro";

function useSkyControls() {
  return useControls({
    timeOfDay:  { value: 18, min: 0, max: 24, step: 0.05 },
    dayOfYear:  { value: 172, min: 1, max: 365, step: 1 },
    latitude:   { value: 70, min: 0, max: 90, step: 1 },
    temperature: { value: 0, min: -30, max: 30 },
    wind: { value: 0, min: 0, max: 16 },
    rain: false,
  });
}

function AtmosphereShader({ timeOfDay, dayOfYear, latitude, temperature }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const { viewport } = useThree();

  const colors = [
    '#0A0A26', // Oxford Blue (index 0)
    '#372BC5', // Persian Blue (index 1)
    '#F7F7FF', // Ghost White (index 2)
    '#55D440', // SGBus Green (index 3)
    '#FEFBE6', // Ivory (index 4)
    '#FFEBDD', // Champagne Pink (index 5)
    '#FFD6B8', // Apricot (index 6)
  ];
  
  function getGradientColors(value) {
    // Clamp temperature to [-30..30].
    value = Math.max(-30, Math.min(30, value));
    // Normalize to [0..1].
    const normalized = (value + 30) / 60;
    // Map into 7 buckets (0..6).
    const groupIndex = Math.min(6, Math.floor(normalized * 7));
  
    switch (groupIndex) {
      case 0: return [colors[0], colors[1]];               // 2 colors
      case 1: return [colors[0], colors[1], colors[2]];    // 3 colors
      case 2: return [colors[1], colors[2], colors[3]];
      case 3: return [colors[2], colors[3], colors[4]];
      case 4: return [colors[3], colors[4], colors[5]];
      case 5: return [colors[4], colors[5], colors[6]];
      case 6: return [colors[5], colors[6]];               // 2 colors
      default: return [];
    }
  }

  const gradientArray = getGradientColors(temperature);
  const colorCount = gradientArray.length; // 2 or 3

  // Always pass 3 colors to the shader, duplicating if only 2 exist
  const colorStops = gradientArray.map((c) => new THREE.Color(c));
  while (colorStops.length < 3) {
    colorStops.push(colorStops[colorStops.length - 1]);
  }

  useEffect(() => {
    materialRef.current = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector2(viewport.width, viewport.height) },
        iTime:       { value: 0.0 },

        timeOfDay:   { value: timeOfDay },
        dayOfYear:   { value: dayOfYear },
        latitude:    { value: latitude },

        colorStops: { value: colorStops },
        colorCount: { value: colorCount },

        auroraColors: {value: [new THREE.Color("#55D440"), new THREE.Color("#372BC5")]}
      },
      vertexShader: glsl`
        precision mediump float;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix
                      * modelViewMatrix
                      * vec4(position, 1.0);
        }
      `,
      fragmentShader: glsl`
        precision mediump float;
        varying vec2 vUv;

        uniform vec2  iResolution;
        uniform float iTime;
        uniform float timeOfDay;
        uniform float dayOfYear;
        uniform float latitude;

        uniform vec3 colorStops[3];
        uniform int colorCount;

        uniform vec3 auroraColors[2];

        #pragma glslify: snoise = require('glsl-noise/simplex/3d')

        #define PI  3.1415926535
        #define SAMPLES_NUMS 16

        float clamp01(float x) {
          return clamp(x, 0.0, 1.0);
        }

        float noise(in vec2 uv){
          return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
        }

        struct ScatteringParams {
          float sunRadius;
          float sunRadiance;
          float mieG;
          float mieHeight;
          float rayleighHeight;
          vec3  waveLambdaMie;
          vec3  waveLambdaOzone;
          vec3  waveLambdaRayleigh;
          float earthRadius;
          float earthAtmTopRadius;
          vec3  earthCenter;
        };

        vec3 ComputeCameraDirectionCropped(vec2 coord) {
          float PI2 = 6.283185307;
          float phi   = 1.5 * PI - PI * coord.x; 
          float theta = mix(PI * 0.5, 0.0, coord.y);
          float sinT  = sin(theta);
          float cosT  = cos(theta);
          float x     = sinT * cos(phi);
          float y     = cosT;
          float z     = sinT * sin(phi);
          vec3 dir    = vec3(x, y, z);
          return normalize(vec3(dir.z, dir.y, -dir.x));
        }

        vec2 ComputeRaySphereIntersection(vec3 pos, vec3 dir, vec3 center, float radius){
          vec3 o = pos - center;
          float B = dot(o, dir);
          float C = dot(o, o) - radius*radius;
          float D = B*B - C;
          if(D<0.0) return vec2(-1.0,-1.0);
          float sd = sqrt(D);
          return vec2(-B - sd, -B + sd);
        }

        vec3 ComputeWaveLambdaRayleigh(vec3 lambda){
          float n=1.0003;
          float N=2.545e25;
          float pn=0.035;
          float n2=n*n;
          float pi3=PI*PI*PI;
          float c=(8.0*pi3*(n2-1.0)*(n2-1.0))/(3.0*N)*((6.0+3.0*pn)/(6.0-7.0*pn));
          return c/(lambda*lambda*lambda*lambda);
        }

        float ComputePhaseMie(float theta, float g){
          float g2=g*g;
          return (1.0 - g2)/pow(1.0+g2-2.0*g*clamp01(theta),1.5)/(4.0*PI);
        }

        float ComputePhaseRayleigh(float theta){
          float t2 = theta*theta;
          return (0.75*t2 + 0.75)/(4.0*PI);
        }

        float ChapmanApproximation(float X, float h, float cosZenith){
          float c = sqrt(X+h);
          float c_exp_h = c*exp(-h);
          if(cosZenith>=0.0){
            return c_exp_h/(c*cosZenith+1.0);
          } else {
            float x0 = sqrt(1.0 - cosZenith*cosZenith)*(X+h);
            float c0 = sqrt(x0);
            return 2.0*c0*exp(X - x0) - c_exp_h/(1.0 - c*cosZenith);
          }
        }

        float GetOpticalDepthSchueler(float h, float H, float eR, float cosZ){
          return H*ChapmanApproximation(eR/H, h/H, cosZ);
        }

        vec3 GetTransmittance(ScatteringParams s, vec3 L, vec3 V){
          float ch = GetOpticalDepthSchueler(L.y, s.rayleighHeight, s.earthRadius, V.y);
          return exp(-(s.waveLambdaMie + s.waveLambdaRayleigh)*ch);
        }

        vec2 ComputeOpticalDepth(ScatteringParams s, vec3 pt, vec3 V, vec3 L, float neg){
          float rl=length(pt);
          float h=rl - s.earthRadius;
          vec3 r=pt/rl;
          float cos_chi_sun = dot(r, L);
          float cos_chi_ray = dot(r, V*neg);
          float odSun=GetOpticalDepthSchueler(h, s.rayleighHeight, s.earthRadius, cos_chi_sun);
          float odCam=GetOpticalDepthSchueler(h, s.rayleighHeight, s.earthRadius, cos_chi_ray)*neg;
          return vec2(odSun, odCam);
        }

        void AerialPerspective(
          ScatteringParams s,
          vec3 start, vec3 end,
          vec3 V, vec3 L,
          bool isNeg,
          out vec3 transmittance,
          out vec3 insctrMie,
          out vec3 insctrRayleigh
        ){
          transmittance=vec3(1.0);
          insctrMie=vec3(0.0);
          insctrRayleigh=vec3(0.0);
          float neg=isNeg?1.0:-1.0;
          vec3 step=(end - start)/float(SAMPLES_NUMS);
          float stepLen=length(step);
          vec3 sumWL = s.waveLambdaMie + s.waveLambdaRayleigh + s.waveLambdaOzone;
          vec2 lastOD = ComputeOpticalDepth(s, end, V, L, neg);
          vec3 scatterAcc = vec3(0.0);
          vec3 sp = end - step;
          for(int i=1; i<SAMPLES_NUMS; i++){
            sp -= step;
            vec2 od = ComputeOpticalDepth(s, sp, V, L, neg);
            vec3 segSun=exp(-sumWL*(od.x + lastOD.x));
            vec3 segCam=exp(-sumWL*(od.y - lastOD.y));
            transmittance *= segCam;
            scatterAcc= scatterAcc*segCam + exp(-(length(sp)-s.earthRadius)/s.rayleighHeight)*segSun;
            lastOD=od;
          }
          insctrMie      = scatterAcc*s.waveLambdaMie*stepLen;
          insctrRayleigh = scatterAcc*s.waveLambdaRayleigh*stepLen;
        }

        float ComputeSkyboxChapman(
          ScatteringParams s,
          vec3 eye, vec3 V, vec3 L,
          out vec3 outT,
          out vec3 outMie,
          out vec3 outRay
        ){
          vec2 outI=ComputeRaySphereIntersection(eye,V,s.earthCenter,s.earthAtmTopRadius);
          if(outI.y<0.0)return 0.0;
          vec2 inI=ComputeRaySphereIntersection(eye,V,s.earthCenter,s.earthRadius);
          bool neg=true;
          if(inI.x>0.0){
            neg=false;
            outI.y=inI.x;
          }
          eye-=s.earthCenter;
          vec3 start=eye+V*max(0.0,outI.x);
          vec3 end  =eye+V*outI.y;
          AerialPerspective(s,start,end,V,L,neg,outT,outMie,outRay);
          bool allAbove=(inI.x<0.0 && inI.y<0.0);
          return allAbove?1.0:0.0;
        }

        vec4 ComputeSkyInscattering(ScatteringParams s, vec3 eye, vec3 V, vec3 L){
          vec3 tMie, tRay, tOpt;
          float val = ComputeSkyboxChapman(s, eye, V, L, tOpt, tMie, tRay);
          float cosTheta=dot(V,L);
          float pMie=ComputePhaseMie(cosTheta,s.mieG);
          float pRay=ComputePhaseRayleigh(cosTheta);
          float pNight=1.0 - clamp01(tOpt.x*1e-5);
          vec3 iM = tMie*pMie;
          vec3 iR = tRay*pRay;
          vec3 sky=(iM+iR)*s.sunRadiance;
          float angle=clamp01((1.0-cosTheta)*s.sunRadius);
          float cA=cos(angle*PI*0.5);
          float edge=(angle>=0.9)?smoothstep(0.9,1.0,angle):0.0;
          vec3 limb=GetTransmittance(s,-L,V);
          limb*=pow(vec3(cA),vec3(0.420,0.503,0.652))
               *mix(vec3(1.0),vec3(1.2,0.9,0.5),edge)
               *val;
          sky+=limb;
          return vec4(sky,pNight*val);
        }

        vec3 AtmospgericBackground(){
            vec2 fragCoord = vUv * iResolution;
            vec3 V = ComputeCameraDirectionCropped(vUv);

            float day = float(dayOfYear);
            float declRad = radians(23.44) * sin(2.0 * PI * (day - 81.0) / 365.0);
            float latRad = radians(latitude);
            float cosH0 = -tan(latRad) * tan(declRad);
            cosH0 = clamp(cosH0, -1.0, 1.0);
            float H0 = acos(cosH0);

            float dayLength = 24.0 * (H0 / PI);
            float sunriseTime = 12.0 - 0.5 * dayLength;
            float sunsetTime = 12.0 + 0.5 * dayLength;

            float frac = (timeOfDay - sunriseTime) / (sunsetTime - sunriseTime);
            frac = clamp(frac, 0.0, 1.0);
            float sunTheta = frac * PI;
            vec3 L = normalize(vec3(cos(sunTheta), sin(sunTheta), -0.1));

            float latFactor = abs(latitude) / 90.0;
            float seasonFactor = sin(2.0 * PI * (day - 81.0) / 365.0) * latFactor;
            float baseRH = mix(10000.0, 80000.0, 0.5 * (seasonFactor * -1.0 + 1.0));

            float Lscale = 1.0;
            if (seasonFactor > 0.5) Lscale = 0.5 + 0.5 * frac;
            else if (seasonFactor < -0.5) Lscale = 1.0 - 0.5 * frac;
            L *= frac;

            ScatteringParams s;
            s.sunRadius = 5000.0;
            s.sunRadiance = 15.0;
            s.mieG = 0.76;
            s.mieHeight = 1200.0;
            s.rayleighHeight = baseRH;
            s.earthRadius = 6360000.0;
            s.earthAtmTopRadius = 6400000.0;
            s.earthCenter = vec3(0.0, -6360000.0, 0.0);
            s.waveLambdaMie = vec3(2e-7);
            s.waveLambdaRayleigh = ComputeWaveLambdaRayleigh(vec3(680e-9, 550e-9, 450e-9))
                                  * (1.0 - 0.7 * snoise(vec3(vUv, iTime * 0.2)));
            s.waveLambdaOzone = vec3(1.3682, 3.3140, 0.1360) * 0.6e-6 * 2.504 * 1.2;

            vec3 eye = vec3(0.0, 1.0, 0.0);
            vec4 sky = ComputeSkyInscattering(s, eye, V, L);
            sky.rgb = pow(sky.rgb, vec3(1.0 / 2.2));

            float dayMid = 0.5 * (sunriseTime + sunsetTime);
            float halfDayLen = 0.5 * (sunsetTime - sunriseTime);
            float distFromMid = abs(timeOfDay - dayMid);
            float distNorm = distFromMid / halfDayLen;
            float fadeWidth = 0.1;
            float nightFactor = smoothstep(1.0 - fadeWidth, 1.0, distNorm);

            if (nightFactor > 0.0)
            {
                float noise = (1.0 + snoise(vec3(vUv.x * 1.5 + iTime * 0.01, vUv.y * 4.0, iTime * 0.1))) * 0.5;
                vec3 aurora = mix(auroraColors[1], auroraColors[0], noise);
                sky.rgb = mix(sky.rgb, aurora, noise * nightFactor);
            }

            return sky.rgb;
        }

        vec3 TemperatureGradient() {
          float n = snoise(vec3(vUv.x - iTime * 0.2, vUv.y * 2.0, iTime * 0.25));
          n = 0.5 * n + 0.5;

          vec3 finalColor;

          if (colorCount == 2) {
            float t = smoothstep(0.0, 1.0, n);
            finalColor = mix(colorStops[0], colorStops[1], t);
          }
          else {
            if (n < 0.5) {
              float t = smoothstep(0.0, 0.5, n);
              finalColor = mix(colorStops[0], colorStops[1], t);
            } else {
              float t = smoothstep(0.5, 1.0, n);
              finalColor = mix(colorStops[1], colorStops[2], t);
            }
          }

          return finalColor;
        }

        void main() {
          vec3 finalColor;

          vec3 temperatureGradient = vec3(1.0);
          vec3 atmospgericBackground = AtmospgericBackground();

          gl_FragColor = vec4(temperatureGradient * atmospgericBackground, 1.0);
        }
      `,
    });
    if (meshRef.current) {
      meshRef.current.material = materialRef.current;
    }
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.timeOfDay.value = timeOfDay;
    materialRef.current.uniforms.dayOfYear.value = dayOfYear;
    materialRef.current.uniforms.latitude.value  = latitude;

    const newStops = gradientArray.map((c) => new THREE.Color(c));
    while (newStops.length < 3) {
      newStops.push(newStops[newStops.length - 1]);
    }

    materialRef.current.uniforms.colorStops.value = newStops;
    materialRef.current.uniforms.colorCount.value = colorCount;
  }, [timeOfDay, dayOfYear, latitude, temperature, colorCount, gradientArray]);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.iTime.value += delta;
      const res = materialRef.current.uniforms.iResolution.value;
      if (res.x !== viewport.width || res.y !== viewport.height) {
        res.set(viewport.width, viewport.height);
      }
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry />
    </mesh>
  );
}

function Scene() {
  const { timeOfDay, dayOfYear, latitude, temperature, wind, rain } = useSkyControls();
  return (
    <Canvas style={{ width: "100vw", height: "100vh" }}>
      <AtmosphereShader
        timeOfDay={timeOfDay}
        dayOfYear={dayOfYear}
        latitude={latitude}
        temperature={temperature}
      />
      <OrbitControls />
    </Canvas>
  );
}

export default function App() {
  return <Scene />;
}