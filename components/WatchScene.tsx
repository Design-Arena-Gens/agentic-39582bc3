"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, MeshProps, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  PerspectiveCamera
} from "@react-three/drei";
import useWatchStore, { LayerKey, PartKey } from "@/stores/useWatchStore";

type GearProps = {
  partId: PartKey;
  teeth: number;
  module: number;
  thickness: number;
  color: string;
  position: [number, number, number];
  rotationRatio: number;
  direction?: 1 | -1;
};

type BridgeProps = MeshProps & {
  partId: PartKey;
  color: string;
  thickness: number;
};

type LayerOffsets = Record<LayerKey, number>;

const LAYER_ORDER: LayerKey[] = [
  "rotor",
  "dial",
  "hands",
  "balanceAssembly",
  "escapement",
  "bridges",
  "gearTrain",
  "basePlate"
];

const BASE_LAYER_Z: Record<LayerKey, number> = {
  rotor: 11,
  dial: 7.5,
  hands: 6.5,
  balanceAssembly: 2.5,
  escapement: 0.8,
  bridges: 1.2,
  gearTrain: -1.6,
  basePlate: -5
};

const CAMERA_TARGETS: Record<PartKey | "overview", { position: THREE.Vector3; target: THREE.Vector3 }> = {
  overview: {
    position: new THREE.Vector3(55, 80, 140),
    target: new THREE.Vector3(0, 0, 0)
  },
  mainspringBarrel: {
    position: new THREE.Vector3(0, 45, 80),
    target: new THREE.Vector3(0, 0, -2)
  },
  centerWheel: {
    position: new THREE.Vector3(-10, 45, 80),
    target: new THREE.Vector3(0, 0, 0)
  },
  thirdWheel: {
    position: new THREE.Vector3(25, 35, 70),
    target: new THREE.Vector3(22, 0, -1.5)
  },
  fourthWheel: {
    position: new THREE.Vector3(48, 32, 68),
    target: new THREE.Vector3(38, 0, -1)
  },
  escapeWheel: {
    position: new THREE.Vector3(56, 28, 62),
    target: new THREE.Vector3(48, -4, -0.5)
  },
  palletFork: {
    position: new THREE.Vector3(60, 25, 60),
    target: new THREE.Vector3(50, -8, 0)
  },
  impulseJewel: {
    position: new THREE.Vector3(62, 30, 62),
    target: new THREE.Vector3(52, -8, 2)
  },
  balanceWheel: {
    position: new THREE.Vector3(66, 30, 70),
    target: new THREE.Vector3(58, -12, 4)
  },
  balanceSpring: {
    position: new THREE.Vector3(66, 30, 70),
    target: new THREE.Vector3(58, -12, 5)
  },
  mainPlate: {
    position: new THREE.Vector3(-15, 55, 105),
    target: new THREE.Vector3(0, 0, -5)
  },
  gearBridge: {
    position: new THREE.Vector3(30, 55, 100),
    target: new THREE.Vector3(20, -2, 2)
  },
  balanceBridge: {
    position: new THREE.Vector3(75, 42, 85),
    target: new THREE.Vector3(58, -12, 7)
  },
  windingRotor: {
    position: new THREE.Vector3(-25, 48, 96),
    target: new THREE.Vector3(0, 0, 10)
  },
  minuteWheel: {
    position: new THREE.Vector3(-6, 40, 84),
    target: new THREE.Vector3(0, 0, 6)
  },
  hourWheel: {
    position: new THREE.Vector3(-8, 40, 86),
    target: new THREE.Vector3(0, 0, 6.5)
  },
  secondPinion: {
    position: new THREE.Vector3(6, 40, 90),
    target: new THREE.Vector3(0, 0, 7)
  },
  dial: {
    position: new THREE.Vector3(-15, 55, 115),
    target: new THREE.Vector3(0, 0, 8)
  }
};

function computeLayerOffsets(explodeFactor: number): LayerOffsets {
  const anchorIndex = LAYER_ORDER.indexOf("escapement");
  const spread = explodeFactor * 6;
  return LAYER_ORDER.reduce<LayerOffsets>((acc, layer, index) => {
    const offset = (index - anchorIndex) * spread;
    acc[layer] = BASE_LAYER_Z[layer] + offset;
    return acc;
  }, {} as LayerOffsets);
}

function createGearGeometry(teeth: number, module: number, thickness: number) {
  const pitchDiameter = module * teeth;
  const pitchRadius = pitchDiameter / 2;
  const addendum = module * 0.9;
  const dedendum = module * 0.8;
  const outerRadius = pitchRadius + addendum;
  const rootRadius = Math.max(0.5, pitchRadius - dedendum);
  const flankRadius = pitchRadius;
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  const flankAngle = step * 0.25;

  for (let i = 0; i < teeth; i += 1) {
    const startAngle = i * step;
    const midAngle = startAngle + step * 0.5;
    const endAngle = startAngle + step;

    const points = [
      polarToVector2(rootRadius, startAngle - flankAngle * 0.6),
      polarToVector2(flankRadius, startAngle + flankAngle * 0.2),
      polarToVector2(outerRadius, midAngle),
      polarToVector2(flankRadius, endAngle - flankAngle * 0.2),
      polarToVector2(rootRadius, endAngle + flankAngle * 0.6)
    ];

    if (i === 0) {
      shape.moveTo(points[0].x, points[0].y);
    } else {
      shape.lineTo(points[0].x, points[0].y);
    }
    for (let p = 1; p < points.length; p += 1) {
      shape.lineTo(points[p].x, points[p].y);
    }
  }

  shape.closePath();
  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    steps: 1,
    bevelEnabled: false
  });
  extrude.center();
  extrude.rotateX(Math.PI / 2);
  return extrude;
}

function polarToVector2(radius: number, angle: number) {
  return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

function usePartInteraction(partId: PartKey) {
  const { selectedPart, hoveredPart, setSelectedPart, setHoveredPart } = useWatchStore(
    (state) => ({
      selectedPart: state.selectedPart,
      hoveredPart: state.hoveredPart,
      setSelectedPart: state.setSelectedPart,
      setHoveredPart: state.setHoveredPart
    })
  );

  const isActive = selectedPart === partId;
  const isHovered = hoveredPart === partId;

  const events = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHoveredPart(partId);
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHoveredPart(null);
    },
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      setSelectedPart(partId);
    }
  };

  return { isActive, isHovered, events };
}

function Gear({ partId, teeth, module, thickness, color, position, rotationRatio, direction = 1 }: GearProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => createGearGeometry(teeth, module, thickness), [teeth, module, thickness]);
  const { slowMotion } = useWatchStore((state) => ({ slowMotion: state.slowMotion }));
  const { isActive, isHovered, events } = usePartInteraction(partId);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const speedFactor = slowMotion ? 0.2 : 1;
    meshRef.current.rotation.z -= direction * rotationRatio * delta * speedFactor;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={position} {...events}>
      <meshStandardMaterial
        color={color}
        metalness={0.85}
        roughness={0.25}
        emissive={isActive || isHovered ? "#ffae34" : "#000000"}
        emissiveIntensity={isActive ? 0.7 : isHovered ? 0.35 : 0}
      />
    </mesh>
  );
}

function Bridge({ partId, color, thickness, ...props }: BridgeProps) {
  const { isActive, isHovered, events } = usePartInteraction(partId);
  return (
    <mesh {...props} {...events}>
      <boxGeometry args={[80, thickness, 46]} />
      <meshStandardMaterial
        color={color}
        metalness={0.6}
        roughness={0.3}
        emissive={isActive || isHovered ? "#3aa7ff" : "#000000"}
        emissiveIntensity={isActive ? 0.6 : isHovered ? 0.3 : 0}
      />
    </mesh>
  );
}

function MainPlate({ z }: { z: number }) {
  const { isActive, isHovered, events } = usePartInteraction("mainPlate");
  return (
    <mesh position={[0, 0, z]} {...events}>
      <cylinderGeometry args={[48, 48, 4, 96, 1, false]} />
      <meshStandardMaterial
        color="#a78f6a"
        metalness={0.5}
        roughness={0.38}
        emissive={isActive || isHovered ? "#ffd966" : "#000000"}
        emissiveIntensity={isActive ? 0.4 : isHovered ? 0.2 : 0}
      />
    </mesh>
  );
}

function Rotor({ z }: { z: number }) {
  const rotorRef = useRef<THREE.Mesh>(null);
  const { slowMotion } = useWatchStore((state) => ({ slowMotion: state.slowMotion }));
  const { isActive, isHovered, events } = usePartInteraction("windingRotor");

  useFrame((_, delta) => {
    if (!rotorRef.current) return;
    const speed = slowMotion ? 0.5 : 2.5;
    rotorRef.current.rotation.z += delta * speed;
  });

  const rotorGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 48;
    const innerRadius = 12;
    const cutAngle = Math.PI * 0.75;
    shape.moveTo(innerRadius, 0);
    for (let angle = 0; angle <= cutAngle; angle += Math.PI / 64) {
      shape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
    }
    shape.absarc(0, 0, outerRadius, cutAngle, Math.PI * 2 - cutAngle, false);
    for (let angle = Math.PI * 2 - cutAngle; angle >= 0; angle -= Math.PI / 64) {
      shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    }
    shape.closePath();
    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 2.2,
      bevelEnabled: false
    });
    extrude.center();
    extrude.rotateX(Math.PI / 2);
    return extrude;
  }, []);

  return (
    <mesh ref={rotorRef} geometry={rotorGeometry} position={[0, 0, z]} {...events}>
      <meshStandardMaterial
        color="#8b929a"
        metalness={0.95}
        roughness={0.18}
        emissive={isActive || isHovered ? "#84c5ff" : "#000000"}
        emissiveIntensity={isActive ? 0.5 : isHovered ? 0.25 : 0}
      />
    </mesh>
  );
}

function BalanceAssembly({ z }: { z: number }) {
  const wheelRef = useRef<THREE.Mesh>(null);
  const springRef = useRef<THREE.Mesh>(null);
  const { slowMotion } = useWatchStore((state) => ({ slowMotion: state.slowMotion }));
  const { isActive: wheelActive, isHovered: wheelHovered, events: wheelEvents } = usePartInteraction("balanceWheel");
  const { isActive: springActive, isHovered: springHovered, events: springEvents } = usePartInteraction("balanceSpring");

  useFrame((_, delta) => {
    if (!wheelRef.current || !springRef.current) return;
    const frequency = slowMotion ? 2 : 8;
    wheelRef.current.rotation.z += Math.sin(Date.now() * 0.001 * frequency) * delta * 1.4;
    springRef.current.rotation.z = wheelRef.current.rotation.z * 0.8;
  });

  return (
    <group position={[58, -12, z]}>
      <mesh ref={wheelRef} {...wheelEvents}>
        <torusGeometry args={[8, 1.2, 24, 96]} />
        <meshStandardMaterial
          color="#d3a446"
          metalness={0.85}
          roughness={0.32}
          emissive={wheelActive || wheelHovered ? "#ffb347" : "#000000"}
          emissiveIntensity={wheelActive ? 0.7 : wheelHovered ? 0.35 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 0.6]} {...springEvents} ref={springRef}>
        <torusGeometry args={[5, 0.2, 8, 180]} />
        <meshStandardMaterial
          color="#5cd6ff"
          metalness={0.4}
          roughness={0.1}
          emissive={springActive || springHovered ? "#88e8ff" : "#000000"}
          emissiveIntensity={springActive ? 0.6 : springHovered ? 0.3 : 0}
        />
      </mesh>
      <mesh position={[0, 0, -1.4]}>
        <cylinderGeometry args={[1.5, 1.5, 5]} />
        <meshStandardMaterial color="#333" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  );
}

function PalletFork({ z }: { z: number }) {
  const forkRef = useRef<THREE.Mesh>(null);
  const { slowMotion } = useWatchStore((state) => ({ slowMotion: state.slowMotion }));
  const { isActive, isHovered, events } = usePartInteraction("palletFork");

  useFrame((_, delta) => {
    if (!forkRef.current) return;
    const speed = slowMotion ? 4 : 16;
    forkRef.current.rotation.z = Math.sin(Date.now() * 0.001 * speed) * THREE.MathUtils.degToRad(6);
  });

  return (
    <group position={[50, -8, z]} rotation={[0, 0, THREE.MathUtils.degToRad(90)]}>
      <mesh ref={forkRef} {...events}>
        <boxGeometry args={[16, 1.4, 0.6]} />
        <meshStandardMaterial
          color="#444"
          metalness={0.55}
          roughness={0.4}
          emissive={isActive || isHovered ? "#ff6f61" : "#000000"}
          emissiveIntensity={isActive ? 0.5 : isHovered ? 0.25 : 0}
        />
      </mesh>
      <mesh position={[7.4, 0, 0]}>
        <boxGeometry args={[3, 0.8, 0.4]} />
        <meshStandardMaterial color="#ad0000" />
      </mesh>
      <mesh position={[-7.4, 0, 0]}>
        <boxGeometry args={[3, 0.8, 0.4]} />
        <meshStandardMaterial color="#ad0000" />
      </mesh>
    </group>
  );
}

function MotionWorks({ z }: { z: number }) {
  const minuteRef = useRef<THREE.Mesh>(null);
  const hourRef = useRef<THREE.Mesh>(null);
  const secondRef = useRef<THREE.Mesh>(null);
  const { slowMotion } = useWatchStore((state) => ({ slowMotion: state.slowMotion }));
  const { events: minuteEvents, isActive: minuteActive, isHovered: minuteHovered } = usePartInteraction("minuteWheel");
  const { events: hourEvents, isActive: hourActive, isHovered: hourHovered } = usePartInteraction("hourWheel");
  const { events: secondEvents, isActive: secondActive, isHovered: secondHovered } = usePartInteraction("secondPinion");

  useFrame((_, delta) => {
    const baseSpeed = slowMotion ? 0.2 : 1;
    if (minuteRef.current) minuteRef.current.rotation.z -= delta * baseSpeed * 0.02;
    if (hourRef.current) hourRef.current.rotation.z -= delta * baseSpeed * 0.02 * (1 / 12);
    if (secondRef.current) secondRef.current.rotation.z -= delta * baseSpeed * 1.2;
  });

  return (
    <group position={[0, 0, z]}>
      <mesh ref={minuteRef} {...minuteEvents}>
        <cylinderGeometry args={[3.8, 3.8, 1.6, 64]} />
        <meshStandardMaterial
          color="#d6d1c4"
          metalness={0.6}
          roughness={0.25}
          emissive={minuteActive || minuteHovered ? "#f7d488" : "#000000"}
          emissiveIntensity={minuteActive ? 0.4 : minuteHovered ? 0.2 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 1.6]} ref={hourRef} {...hourEvents}>
        <cylinderGeometry args={[5.5, 5.5, 1.4, 64]} />
        <meshStandardMaterial
          color="#b6b0a2"
          metalness={0.55}
          roughness={0.3}
          emissive={hourActive || hourHovered ? "#f7d488" : "#000000"}
          emissiveIntensity={hourActive ? 0.35 : hourHovered ? 0.18 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 3]} ref={secondRef} {...secondEvents}>
        <cylinderGeometry args={[1.6, 1.6, 1.2, 32]} />
        <meshStandardMaterial
          color="#ffe0a3"
          metalness={0.65}
          roughness={0.22}
          emissive={secondActive || secondHovered ? "#ff8b5f" : "#000000"}
          emissiveIntensity={secondActive ? 0.4 : secondHovered ? 0.2 : 0}
        />
      </mesh>
    </group>
  );
}

function Dial({ z }: { z: number }) {
  const { isActive, isHovered, events } = usePartInteraction("dial");
  return (
    <group position={[0, 0, z]}>
      <mesh {...events}>
        <cylinderGeometry args={[48, 48, 0.8, 128, 1, false, 0, Math.PI * 2]} />
        <meshStandardMaterial
          color="#1b1e27"
          metalness={0.3}
          roughness={0.65}
          emissive={isActive || isHovered ? "#4ec6ff" : "#000000"}
          emissiveIntensity={isActive ? 0.4 : isHovered ? 0.18 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 0.6]}>
        <torusGeometry args={[40, 0.4, 2, 120]} />
        <meshStandardMaterial color="#f0f0f0" metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.6]}>
        <torusGeometry args={[30, 0.3, 2, 120]} />
        <meshStandardMaterial color="#f0f0f0" metalness={0.2} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Hands({ z }: { z: number }) {
  const minuteRef = useRef<THREE.Mesh>(null);
  const hourRef = useRef<THREE.Mesh>(null);
  const secondRef = useRef<THREE.Mesh>(null);
  const { slowMotion } = useWatchStore((state) => ({ slowMotion: state.slowMotion }));

  useFrame((_, delta) => {
    const speed = slowMotion ? 0.25 : 1;
    if (minuteRef.current) minuteRef.current.rotation.z -= delta * speed * 0.02;
    if (hourRef.current) hourRef.current.rotation.z -= delta * speed * 0.02 * (1 / 12);
    if (secondRef.current) secondRef.current.rotation.z -= delta * speed * 1;
  });

  return (
    <group position={[0, 0, z]}>
      <mesh ref={hourRef} rotation={[0, 0, Math.PI * 0.2]}>
        <boxGeometry args={[1.6, 24, 0.6]} />
        <meshStandardMaterial color="#f3f3f3" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh ref={minuteRef} rotation={[0, 0, Math.PI * 0.8]}>
        <boxGeometry args={[1.2, 30, 0.6]} />
        <meshStandardMaterial color="#f3f3f3" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh ref={secondRef} rotation={[0, 0, Math.PI * 1.4]}>
        <boxGeometry args={[0.4, 36, 0.4]} />
        <meshStandardMaterial color="#ff7058" metalness={0.2} roughness={0.4} />
      </mesh>
    </group>
  );
}

function CameraRig() {
  const controlsRef = useRef<THREE.Object3D>(null);
  const orbitRef = useRef<THREE.Object3D>(null) as React.MutableRefObject<any>;
  const { cameraTarget, setCameraTarget } = useWatchStore((state) => ({
    cameraTarget: state.cameraTarget,
    setCameraTarget: state.setCameraTarget
  }));
  const { camera } = useThree();
  const targetInfo = CAMERA_TARGETS[cameraTarget] ?? CAMERA_TARGETS.overview;
  const lerpTarget = new THREE.Vector3().copy(targetInfo.target);
  const lerpPosition = new THREE.Vector3().copy(targetInfo.position);

  useFrame(() => {
    camera.position.lerp(lerpPosition, 0.04);
    if (orbitRef.current) {
      orbitRef.current.target.lerp(lerpTarget, 0.08);
      orbitRef.current.update();
    } else {
      camera.lookAt(lerpTarget);
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={CAMERA_TARGETS.overview.position.toArray()} fov={40} />
      <OrbitControls
        ref={orbitRef}
        enablePan
        maxPolarAngle={Math.PI * 0.92}
        minPolarAngle={Math.PI * 0.15}
        maxDistance={220}
        minDistance={45}
        onEnd={() => {
          setCameraTarget("overview");
        }}
      />
    </>
  );
}

function Escapement({ zGear, zEscapement }: { zGear: number; zEscapement: number }) {
  const { events: jewelEvents, isActive: jewelActive, isHovered: jewelHovered } =
    usePartInteraction("impulseJewel");

  return (
    <>
      <Gear
        partId="escapeWheel"
        teeth={21}
        module={2}
        thickness={1.4}
        color="#c7cdd6"
        position={[48, -4, zGear]}
        rotationRatio={2.4}
      />
      <PalletFork z={zEscapement} />
      <mesh position={[52, -8, zEscapement + 1]} rotation={[Math.PI / 2, 0, 0]} {...jewelEvents}>
        <sphereGeometry args={[0.9, 24, 24]} />
        <meshStandardMaterial
          color="#ff5f5f"
          emissive={jewelActive || jewelHovered ? "#ff9d80" : "#330000"}
          emissiveIntensity={jewelActive ? 0.8 : jewelHovered ? 0.4 : 0.1}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>
    </>
  );
}

function GearTrain({ z }: { z: number }) {
  return (
    <>
      <Gear
        partId="mainspringBarrel"
        teeth={72}
        module={2.8}
        thickness={3}
        color="#9d8660"
        position={[0, 0, z]}
        rotationRatio={0.15}
      />
      <Gear
        partId="centerWheel"
        teeth={64}
        module={2}
        thickness={2.4}
        color="#d1c2a1"
        position={[0, 0, z + 1.2]}
        rotationRatio={0.25}
        direction={-1}
      />
      <Gear
        partId="thirdWheel"
        teeth={56}
        module={1.6}
        thickness={2}
        color="#cbb996"
        position={[22, 0, z + 1.4]}
        rotationRatio={0.6}
      />
      <Gear
        partId="fourthWheel"
        teeth={48}
        module={1.4}
        thickness={1.8}
        color="#f3d28a"
        position={[38, 0, z + 1.6]}
        rotationRatio={1}
        direction={-1}
      />
    </>
  );
}

function Bridges({ z }: { z: number }) {
  return (
    <>
      <Bridge partId="gearBridge" position={[10, 0, z]} rotation={[Math.PI / 2, 0, THREE.MathUtils.degToRad(8)]} color="#c6ccd4" thickness={2.8} />
      <Bridge partId="balanceBridge" position={[58, -12, z + 4]} rotation={[Math.PI / 2, 0, THREE.MathUtils.degToRad(-4)]} color="#b9c2cd" thickness={1.8} />
    </>
  );
}

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#1a1a1a", 0.7]} />
      <spotLight position={[60, 120, 160]} angle={0.35} penumbra={0.5} intensity={1.6} castShadow />
      <spotLight position={[-120, -80, -60]} angle={0.4} penumbra={0.3} intensity={1.1} />
      <pointLight position={[40, 30, 50]} intensity={0.6} />
    </>
  );
}

function SceneContent() {
  const { layers, explodeFactor } = useWatchStore((state) => ({
    layers: state.layers,
    explodeFactor: state.explodeFactor
  }));

  const layerOffsets = useMemo(() => computeLayerOffsets(explodeFactor), [explodeFactor]);

  return (
    <>
      <CameraRig />
      <Lighting />
      <Environment preset="studio" />
      <group>
        {layers.basePlate && <MainPlate z={layerOffsets.basePlate} />}
        {layers.rotor && <Rotor z={layerOffsets.rotor} />}
        {layers.gearTrain && <GearTrain z={layerOffsets.gearTrain} />}
        {layers.escapement && (
          <Escapement zGear={layerOffsets.gearTrain + 3.6} zEscapement={layerOffsets.escapement} />
        )}
        {layers.balanceAssembly && <BalanceAssembly z={layerOffsets.balanceAssembly} />}
        {layers.bridges && <Bridges z={layerOffsets.bridges} />}
        {layers.hands && (
          <>
            <MotionWorks z={layerOffsets.hands - 3.4} />
            <Hands z={layerOffsets.hands} />
          </>
        )}
        {layers.dial && <Dial z={layerOffsets.dial} />}
      </group>
      <ContactShadows
        opacity={0.45}
        width={160}
        height={160}
        blur={2.8}
        far={60}
        resolution={1024}
        position={[0, 0, -22]}
      />
      <Html position={[0, 0, 48]} center className="scene-label">
        <div className="scene-label__badge">Swiss lever calibre — exploded visualization</div>
      </Html>
    </>
  );
}

export default function WatchScene() {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#05070a"]} />
      <fog attach="fog" args={["#05070a", 160, 320]} />
      <SceneContent />
    </Canvas>
  );
}
