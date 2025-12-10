import { create } from "zustand";

export type LayerKey =
  | "basePlate"
  | "gearTrain"
  | "escapement"
  | "balanceAssembly"
  | "hands"
  | "rotor"
  | "bridges"
  | "dial";

export type PartKey =
  | "mainspringBarrel"
  | "centerWheel"
  | "thirdWheel"
  | "fourthWheel"
  | "escapeWheel"
  | "mainPlate"
  | "gearBridge"
  | "balanceWheel"
  | "balanceSpring"
  | "palletFork"
  | "impulseJewel"
  | "windingRotor"
  | "minuteWheel"
  | "hourWheel"
  | "secondPinion"
  | "dial"
  | "balanceBridge";

type WatchState = {
  layers: Record<LayerKey, boolean>;
  toggleLayer: (key: LayerKey) => void;
  setLayerVisibility: (key: LayerKey, visible: boolean) => void;
  explodeFactor: number;
  setExplodeFactor: (value: number) => void;
  slowMotion: boolean;
  setSlowMotion: (value: boolean) => void;
  selectedPart: PartKey | null;
  setSelectedPart: (part: PartKey | null) => void;
  hoveredPart: PartKey | null;
  setHoveredPart: (part: PartKey | null) => void;
  cameraTarget: PartKey | "overview";
  setCameraTarget: (target: PartKey | "overview") => void;
};

const defaultLayers: Record<LayerKey, boolean> = {
  basePlate: true,
  gearTrain: true,
  escapement: true,
  balanceAssembly: true,
  hands: true,
  rotor: true,
  bridges: true,
  dial: true
};

const useWatchStore = create<WatchState>((set) => ({
  layers: defaultLayers,
  toggleLayer: (key) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [key]: !state.layers[key]
      }
    })),
  setLayerVisibility: (key, visible) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [key]: visible
      }
    })),
  explodeFactor: 0,
  setExplodeFactor: (value) => set({ explodeFactor: Math.min(Math.max(value, 0), 1) }),
  slowMotion: false,
  setSlowMotion: (value) => set({ slowMotion: value }),
  selectedPart: null,
  setSelectedPart: (part) => set({ selectedPart: part }),
  hoveredPart: null,
  setHoveredPart: (part) => set({ hoveredPart: part }),
  cameraTarget: "overview",
  setCameraTarget: (target) => set({ cameraTarget: target })
}));

export default useWatchStore;
