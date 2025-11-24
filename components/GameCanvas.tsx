import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GameState, CarStats } from '../types';

interface GameCanvasProps {
  gameState: GameState;
  onStatsUpdate: (stats: CarStats) => void;
  onCrash: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, onStatsUpdate, onCrash }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  
  // Game Logic Refs
  const carRootRef = useRef<BABYLON.TransformNode | null>(null); 
  const carBodyRef = useRef<BABYLON.TransformNode | null>(null); 
  const wheelsRef = useRef<BABYLON.TransformNode[]>([]);
  
  // PHYSICS STATE
  const velocityRef = useRef<BABYLON.Vector3>(BABYLON.Vector3.Zero()); 
  const speedMagnitudeRef = useRef(0); 
  const nitroRef = useRef(100);
  const driftFactorRef = useRef(0); 
  
  // PHYSICS TUNING
  const MAX_SPEED = 550; 
  const ENGINE_POWER = 180.0; 
  const BRAKE_POWER = 250.0;
  const DRAG_BASE = 0.25; 
  const DRAG_EXP = 0.0006; 
  const GRIP_LATERAL_BASE = 20.0; 
  const GRIP_DRIFT = 1.5; 
  const TURN_SPEED_BASE = 3.0; 
  
  // MAP CONFIG (MASSIVE SCALE)
  const MAP_SIZE = 60000; 
  const ROAD_WIDTH = 160; 
  const BUILDING_COUNT = 8000;
  const TRAFFIC_COUNT = 400; 

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true });
    engineRef.current = engine;

    const createScene = () => {
      const scene = new BABYLON.Scene(engine);
      // Lighter background for better visibility (Deep Midnight Blue)
      const bgColor = new BABYLON.Color4(0.05, 0.05, 0.12, 1);
      scene.clearColor = bgColor;
      scene.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.4); // Much brighter ambient
      
      // Fog setup (Cleaner, less dense)
      scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
      scene.fogDensity = 0.00015; // Reduced density significantly
      scene.fogColor = new BABYLON.Color3(0.05, 0.05, 0.15); // Matches sky

      // --- CAMERA ---
      const camera = new BABYLON.FollowCamera("FollowCam", new BABYLON.Vector3(0, 10, -20), scene);
      camera.radius = 35; 
      camera.heightOffset = 12; 
      camera.rotationOffset = 180;
      camera.cameraAcceleration = 0.05; // Snappier camera
      camera.maxCameraSpeed = 80;
      camera.maxZ = 10000; // Can see 10km away
      camera.fov = 1.1;

      // --- POST PROCESSING (CLEANER) ---
      const pipeline = new BABYLON.DefaultRenderingPipeline("pipeline", true, scene, [camera]);
      pipeline.glowLayerEnabled = true;
      pipeline.glowLayer!.intensity = 0.8; // Reduced glow to avoid blur
      pipeline.glowLayer!.blurKernelSize = 32; // Sharper glow
      pipeline.chromaticAberrationEnabled = true;
      pipeline.chromaticAberration!.aberrationAmount = 0; // Starts at 0, adds dynamically
      pipeline.grainEnabled = true;
      pipeline.grain!.intensity = 5; // Reduced grain
      pipeline.imageProcessing.contrast = 1.3; // Less harsh contrast
      pipeline.imageProcessing.exposure = 1.4; // Brighter overall image

      // --- LIGHTING (ENHANCED) ---
      const hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
      hemiLight.intensity = 0.7; // Much stronger ambient light
      hemiLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

      // Moonlight (Directional) to give shape to buildings
      const dirLight = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(0.5, -1, 0.5), scene);
      dirLight.intensity = 0.8;
      dirLight.diffuse = new BABYLON.Color3(0.6, 0.7, 1.0);

      // --- MATERIALS ---
      const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
      const roadTex = new BABYLON.DynamicTexture("roadTex", 1024, scene, true);
      const ctx = roadTex.getContext();
      
      // Lighter Asphalt
      const grad = ctx.createLinearGradient(0,0,1024,0);
      grad.addColorStop(0, "#050505");
      grad.addColorStop(0.1, "#1a1a1a"); // Lighter road edge
      grad.addColorStop(0.5, "#141414"); // Lighter road center
      grad.addColorStop(0.9, "#1a1a1a");
      grad.addColorStop(1, "#050505");
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,1024,1024);

      // Brighter Neon Lanes
      ctx.shadowBlur = 10; ctx.shadowColor = "#00ffff";
      ctx.fillStyle = "#00ffff";
      ctx.fillRect(50, 0, 8, 1024); // Left
      ctx.fillRect(966, 0, 8, 1024); // Right
      
      // Lane markers
      ctx.fillStyle = "#666"; // Brighter gray
      ctx.shadowBlur = 0;
      for(let x=200; x<900; x+=150) {
          for(let y=0; y<1024; y+=100) ctx.fillRect(x, y, 4, 50); 
      }
      
      roadTex.update();
      roadMat.diffuseTexture = roadTex;
      roadMat.specularTexture = roadTex; 
      roadMat.specularPower = 60; // Shinier road
      roadMat.roughness = 0.3;
      
      (roadMat.diffuseTexture as BABYLON.Texture).uScale = 1; 
      (roadMat.diffuseTexture as BABYLON.Texture).vScale = MAP_SIZE / 150; 
      (roadMat.specularTexture as BABYLON.Texture).uScale = 1; 
      (roadMat.specularTexture as BABYLON.Texture).vScale = MAP_SIZE / 150;

      const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: ROAD_WIDTH * 3, height: MAP_SIZE }, scene);
      ground.material = roadMat;
      const uvs = ground.getVerticesData(BABYLON.VertexBuffer.UVKind);
      if (uvs) {
        for(let i=0; i<uvs.length; i+=2) uvs[i] *= 3; 
        ground.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs);
      }

      // --- CITY GENERATION (Windows & Visibility) ---
      // Window texture generation
      const windowTex = new BABYLON.DynamicTexture("winTex", 512, scene, true);
      const wCtx = windowTex.getContext();
      wCtx.fillStyle = "#000"; wCtx.fillRect(0,0,512,512);
      wCtx.fillStyle = "#ffaa00"; // Warm light windows
      for(let i=0; i<400; i++) {
          if(Math.random() > 0.5) wCtx.fillStyle = "#ccffff"; // Cool light
          else wCtx.fillStyle = "#ffcc88"; // Warm light
          
          if(Math.random() > 0.6) 
            wCtx.fillRect(Math.random()*512, Math.random()*512, Math.random()*10+5, Math.random()*20+10);
      }
      windowTex.update();

      const bldgMat = new BABYLON.StandardMaterial("bldgBody", scene);
      bldgMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.15); // Not pitch black
      bldgMat.emissiveTexture = windowTex; // Lit windows
      bldgMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Control window brightness
      bldgMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.4);
      
      const megaMat = new BABYLON.StandardMaterial("megaMat", scene);
      megaMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.1);
      megaMat.emissiveColor = new BABYLON.Color3(0.1, 0.2, 0.4); // Cyber glow

      // Base Box for Instancing
      const baseBox = BABYLON.MeshBuilder.CreateBox("baseBox", {size: 1}, scene);
      baseBox.material = bldgMat;
      baseBox.isVisible = false;
      
      const megaBox = BABYLON.MeshBuilder.CreateBox("megaBox", {size: 1}, scene);
      megaBox.material = megaMat;
      megaBox.isVisible = false;

      // Generate City
      for(let i=0; i<BUILDING_COUNT; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = (ROAD_WIDTH/2) + 15 + Math.pow(Math.random(), 2) * 600; 
        const x = side * dist;
        const z = (Math.random() * MAP_SIZE) - (MAP_SIZE/2);
        
        const isMega = Math.random() > 0.97;
        
        let inst;
        let h, w, d;

        if (isMega) {
            inst = megaBox.createInstance("mega"+i);
            h = 400 + Math.random() * 800; 
            w = 80 + Math.random() * 200;
            d = 80 + Math.random() * 200;
        } else {
            inst = baseBox.createInstance("b"+i);
            h = 40 + Math.random() * 300; 
            w = 20 + Math.random() * 60;
            d = 20 + Math.random() * 60;
        }
        
        inst.position.set(x, h/2 - 20, z);
        inst.scaling.set(w, h, d);
        inst.freezeWorldMatrix();
      }

      // --- DETAILS ---
      const railMat = new BABYLON.StandardMaterial("railMat", scene);
      railMat.emissiveColor = new BABYLON.Color3(0, 0.6, 1);
      railMat.diffuseColor = BABYLON.Color3.White(); // Visible when not emitting
      const railGeo = BABYLON.MeshBuilder.CreateBox("rail", {width: 2, height: 4, depth: MAP_SIZE}, scene);
      railGeo.material = railMat;
      railGeo.position.set(ROAD_WIDTH/2 + 2, 2, 0);
      const railL = railGeo.clone("railL");
      railL.position.x = -(ROAD_WIDTH/2 + 2);

      // Floating Arches
      const archMat = new BABYLON.StandardMaterial("archMat", scene);
      archMat.emissiveColor = new BABYLON.Color3(1, 0, 0.5);
      const archGeo = BABYLON.MeshBuilder.CreateTorus("arch", {diameter: ROAD_WIDTH * 1.2, thickness: 5, tessellation: 32}, scene);
      archGeo.scaling.y = 0.4; 
      archGeo.rotation.z = Math.PI / 2;
      archGeo.material = archMat;
      archGeo.isVisible = false;
      
      for(let z = -MAP_SIZE/2; z < MAP_SIZE/2; z+= 1500) { 
          const a = archGeo.createInstance("arch"+z);
          a.position.set(0, 40, z);
          a.freezeWorldMatrix();
      }

      // --- TRAFFIC (FIXED INSTANCING) ---
      // We need TWO source meshes to handle different materials for instances
      const tMatRed = new BABYLON.StandardMaterial("tMatRed", scene);
      tMatRed.emissiveColor = new BABYLON.Color3(1, 0, 0); // Tail lights
      tMatRed.diffuseColor = new BABYLON.Color3(0.2, 0, 0);

      const tMatWhite = new BABYLON.StandardMaterial("tMatWhite", scene);
      tMatWhite.emissiveColor = new BABYLON.Color3(1, 1, 0.6); // Headlights
      tMatWhite.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      
      // Source mesh 1: Forward traffic (Red tails)
      const tBoxForward = BABYLON.MeshBuilder.CreateBox("tBoxFwd", {width: 4, height: 2.5, depth: 8}, scene);
      tBoxForward.material = tMatRed; 
      tBoxForward.isVisible = false;

      // Source mesh 2: Oncoming traffic (White headlights)
      const tBoxBackward = BABYLON.MeshBuilder.CreateBox("tBoxBwd", {width: 4, height: 2.5, depth: 8}, scene);
      tBoxBackward.material = tMatWhite; 
      tBoxBackward.isVisible = false;
      
      const traffic: { mesh: BABYLON.InstancedMesh, speed: number, laneOffset: number, dir: number }[] = [];
      
      for(let i=0; i<TRAFFIC_COUNT; i++) {
         const dir = Math.random() > 0.4 ? 1 : -1; // Direction
         
         // Select correct source mesh based on direction to avoid changing material on instance
         let t: BABYLON.InstancedMesh;
         if (dir === 1) {
             t = tBoxForward.createInstance("t"+i);
         } else {
             t = tBoxBackward.createInstance("t"+i);
         }

         t.position.set(0, 1.25, (Math.random()*MAP_SIZE)-MAP_SIZE/2);
         
         traffic.push({
             mesh: t, 
             speed: 80 + Math.random()*60, 
             laneOffset: (Math.random() - 0.5) * (ROAD_WIDTH - 20), 
             dir: dir 
         });
      }


      // --- PLAYER CAR (Detailed) ---
      const carRoot = new BABYLON.TransformNode("carRoot", scene);
      carRootRef.current = carRoot;
      camera.lockedTarget = carRoot;

      const carVisuals = new BABYLON.TransformNode("carVisuals", scene);
      carVisuals.parent = carRoot;
      carBodyRef.current = carVisuals;

      const paint = new BABYLON.StandardMaterial("paint", scene);
      paint.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05); // Dark Grey
      paint.specularColor = new BABYLON.Color3(0.5, 0.8, 1);
      paint.specularPower = 64;
      
      const neon = new BABYLON.StandardMaterial("neon", scene);
      neon.emissiveColor = new BABYLON.Color3(0, 1, 1);

      // Chassis
      const body = BABYLON.MeshBuilder.CreateBox("body", {width: 2.6, height: 1.1, depth: 5.2}, scene);
      body.parent = carVisuals; body.position.y = 0.7; body.material = paint;
      
      // Cabin
      const cabin = BABYLON.MeshBuilder.CreateBox("cabin", {width: 2.0, height: 0.9, depth: 2.8}, scene);
      cabin.parent = carVisuals; cabin.position.set(0, 1.5, -0.3); cabin.material = paint;
      cabin.scaling.x = 0.85;

      const spoiler = BABYLON.MeshBuilder.CreateBox("spoiler", {width: 3.2, height: 0.1, depth: 1.2}, scene);
      spoiler.parent = carVisuals; spoiler.position.set(0, 1.9, -2.6); spoiler.material = paint;
      const spL = BABYLON.MeshBuilder.CreateBox("spL", {width: 0.2, height: 0.8, depth: 0.8}, scene);
      spL.parent = carVisuals; spL.position.set(1, 1.5, -2.6); spL.material = paint;
      const spR = spL.clone("spR"); spR.position.x = -1;

      // Neon Underglow Strips
      const stripL = BABYLON.MeshBuilder.CreateBox("sL", {width: 0.1, height: 0.1, depth: 5}, scene);
      stripL.parent = carVisuals; stripL.position.set(1.2, 0.4, 0); stripL.material = neon;
      const stripR = stripL.clone("sR"); stripR.position.x = -1.2;

      // Wheels
      const createWheel = (x: number, z: number) => {
         const w = BABYLON.MeshBuilder.CreateCylinder("w", {diameter: 1.0, height: 0.7}, scene);
         w.rotation.z = Math.PI/2;
         w.parent = carVisuals; w.position.set(x, 0.5, z);
         const wMat = new BABYLON.StandardMaterial("wMat", scene);
         wMat.diffuseColor = BABYLON.Color3.Black();
         w.material = wMat;
         const rim = BABYLON.MeshBuilder.CreateCylinder("rim", {diameter: 0.6, height: 0.72}, scene);
         rim.parent = w; rim.material = neon;
         return w;
      };
      wheelsRef.current = [
          createWheel(1.5, 1.9), createWheel(-1.5, 1.9),
          createWheel(1.55, -1.9), createWheel(-1.55, -1.9)
      ];

      // Particles
      const ps = new BABYLON.ParticleSystem("ps", 2000, scene);
      ps.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
      ps.emitter = carVisuals;
      ps.minEmitBox = new BABYLON.Vector3(-0.6, 0.2, -2.7);
      ps.maxEmitBox = new BABYLON.Vector3(0.6, 0.2, -2.7);
      ps.color1 = new BABYLON.Color4(0, 1, 1, 1);
      ps.color2 = new BABYLON.Color4(0.5, 0, 1, 1);
      ps.minSize = 0.3; ps.maxSize = 0.8;
      ps.minLifeTime = 0.1; ps.maxLifeTime = 0.4;
      ps.emitRate = 0;
      ps.start();

      // Inputs
      const inputMap: Record<string, boolean> = {};
      scene.onKeyboardObservable.add((kb) => {
          inputMap[kb.event.key.toLowerCase()] = kb.type === BABYLON.KeyboardEventTypes.KEYDOWN;
      });

      // --- RENDER LOOP ---
      engine.runRenderLoop(() => {
          if (!carRootRef.current || !carBodyRef.current) return;
          
          const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
          
          const car = carRootRef.current;
          const body = carBodyRef.current;
          const vel = velocityRef.current;

          // NAN GUARD
          if (isNaN(vel.x) || isNaN(vel.y) || isNaN(vel.z)) {
              vel.set(0, 0, 0);
              nitroRef.current = 100;
          }

          const speedMs = vel.length();
          const speedKmh = speedMs * 3.6;

          // Visuals
          ps.emitRate = speedKmh * 3; 
          // Less aggressive aberration for clarity
          pipeline.chromaticAberration!.aberrationAmount = Math.min(0.04, (speedKmh/MAX_SPEED) * 0.04);
          
          if (speedKmh > 350) {
              camera.rotationOffset = 180 + (Math.sin(Date.now() * 0.05) * (speedKmh/3500));
              camera.radius = 35 + (Math.random() * 0.3); 
          } else {
              camera.rotationOffset = 180;
              camera.radius = 35;
          }

          if (gameState === GameState.RACING) {
              const gas = (inputMap["w"] || inputMap["arrowup"]) ? 1 : 0;
              const brake = (inputMap["s"] || inputMap["arrowdown"]) ? 1 : 0;
              let steer = (inputMap["a"] || inputMap["arrowleft"]) ? -1 : (inputMap["d"] || inputMap["arrowright"]) ? 1 : 0;
              const drift = inputMap["shift"];

              let isNitro = false;
              if (drift && gas && nitroRef.current > 0) {
                  isNitro = true;
                  nitroRef.current -= 15 * dt; 
              } else if (nitroRef.current < 100) {
                  nitroRef.current += 3 * dt;
              }

              let engineForce = 0;
              if (gas) engineForce = ENGINE_POWER * (isNitro ? 2.8 : 1.0);
              if (brake) engineForce -= BRAKE_POWER;

              const fwd = car.forward;
              const right = car.right;

              vel.addInPlace(fwd.scale(engineForce * dt));

              const dragFactor = (DRAG_BASE + (speedMs * DRAG_EXP));
              const damping = Math.max(0, 1 - (dragFactor * dt)); 
              vel.scaleInPlace(damping);

              let steerSens = TURN_SPEED_BASE / (1 + (speedMs * 0.015)); 
              if (drift) steerSens *= 3.0;

              if (speedMs > 1) {
                  const dir = BABYLON.Vector3.Dot(vel, fwd) > 0 ? 1 : -1;
                  car.rotation.y += steer * steerSens * dt * dir;
              }

              const sideVel = BABYLON.Vector3.Dot(vel, right);
              const isSliding = drift || Math.abs(sideVel) > 15;
              driftFactorRef.current = BABYLON.Scalar.Lerp(driftFactorRef.current, isSliding ? 1 : 0, 5 * dt);
              
              const grip = isSliding ? GRIP_DRIFT : GRIP_LATERAL_BASE;
              vel.subtractInPlace(right.scale(sideVel * grip * dt));

              car.position.addInPlace(vel.scale(dt));

              body.rotation.z = BABYLON.Scalar.Lerp(body.rotation.z, -sideVel * 0.03, 5 * dt);
              body.rotation.x = BABYLON.Scalar.Lerp(body.rotation.x, -(engineForce/400) * 0.1, 5 * dt);

              wheelsRef.current.forEach(w => {
                 w.rotation.y = steer * 0.4;
                 w.rotation.x += speedMs * dt; 
              });

              if (car.position.z > MAP_SIZE/2) car.position.z -= MAP_SIZE;
              if (car.position.z < -MAP_SIZE/2) car.position.z += MAP_SIZE;

              const wallLim = (ROAD_WIDTH/2) - 6;
              if (car.position.x > wallLim) { 
                  car.position.x = wallLim; 
                  vel.x *= -0.4; 
                  if (Math.abs(vel.x) > 10) onCrash();
              }
              if (car.position.x < -wallLim) {
                  car.position.x = -wallLim;
                  vel.x *= -0.4;
                  if (Math.abs(vel.x) > 10) onCrash();
              }

              // TRAFFIC LOGIC
              traffic.forEach(t => {
                  const speed = t.speed * t.dir;
                  t.mesh.position.z += speed * dt;
                  t.mesh.position.x = t.laneOffset; 

                  let dist = t.mesh.position.z - car.position.z;
                  
                  if (dist > MAP_SIZE/2) dist -= MAP_SIZE;
                  if (dist < -MAP_SIZE/2) dist += MAP_SIZE;

                  const SPAWN_RANGE = 2000;
                  
                  if (dist < -200) { 
                      t.mesh.position.z = car.position.z + SPAWN_RANGE + Math.random() * 1000;
                  } else if (dist > 3500) { 
                       t.mesh.position.z = car.position.z + SPAWN_RANGE + Math.random() * 1000;
                  }
              });

              speedMagnitudeRef.current = speedKmh;
              onStatsUpdate({
                   speed: isNaN(speedKmh) ? 0 : speedKmh,
                   maxSpeed: MAX_SPEED,
                   gear: Math.min(8, Math.max(1, Math.floor(speedKmh / 70) + 1)),
                   damage: 0,
                   nitro: nitroRef.current
              });
          }

          scene.render();
      });

      return scene;
    };

    sceneRef.current = createScene();
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    return () => {
        window.removeEventListener('resize', resize);
        engine.dispose();
    };
  }, [gameState]); 

   return (
    <canvas
      ref={canvasRef}
      className="block bg-slate-950"
      style={{
        width: '100vw',   // larghezza = larghezza finestra
        height: '100vh',  // altezza = altezza finestra
      }}
    />
  );
};

export default GameCanvas;
