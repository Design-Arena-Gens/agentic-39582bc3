"use client";

import useWatchStore, { LayerKey } from "@/stores/useWatchStore";

const layerLabels: Record<LayerKey, string> = {
  basePlate: "Base Plate",
  gearTrain: "Gear Train",
  escapement: "Escapement",
  balanceAssembly: "Balance Assembly",
  hands: "Hands & Motion Works",
  rotor: "Automatic Rotor",
  bridges: "Bridges & Cocks",
  dial: "Dial & Indices"
};

export default function LayerVisibility() {
  const { layers, toggleLayer, explodeFactor, setExplodeFactor, slowMotion, setSlowMotion } =
    useWatchStore((state) => ({
      layers: state.layers,
      toggleLayer: state.toggleLayer,
      explodeFactor: state.explodeFactor,
      setExplodeFactor: state.setExplodeFactor,
      slowMotion: state.slowMotion,
      setSlowMotion: state.setSlowMotion
    }));

  return (
    <div className="panel panel--layers">
      <header className="panel__header">
        <h2>Layer Controls</h2>
        <p>Toggle movement layers or spread components for exploded views.</p>
      </header>
      <div className="panel__section">
        <label className="panel__slider">
          <span>Exploded View</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={explodeFactor}
            onChange={(event) => setExplodeFactor(parseFloat(event.target.value))}
          />
        </label>
        <label className="panel__toggle">
          <input
            type="checkbox"
            checked={slowMotion}
            onChange={(event) => setSlowMotion(event.target.checked)}
          />
          <span>Slow Motion Escapement</span>
        </label>
      </div>
      <div className="panel__section panel__section--grid">
        {(Object.keys(layers) as LayerKey[]).map((layerKey) => (
          <label key={layerKey} className="panel__checkbox">
            <input
              type="checkbox"
              checked={layers[layerKey]}
              onChange={() => toggleLayer(layerKey)}
            />
            <span>{layerLabels[layerKey]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
