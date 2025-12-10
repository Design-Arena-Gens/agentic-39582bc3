"use client";

import { useMemo, useState } from "react";
import { WATCH_PARTS, PART_MAP } from "@/data/watchParts";
import useWatchStore, { PartKey } from "@/stores/useWatchStore";

const layerOrder = [
  "Base Plate",
  "Bridges",
  "Gear Train",
  "Escapement",
  "Balance Assembly",
  "Hands",
  "Dial",
  "Rotor"
] as const;

const fallbackPart: PartKey = "mainPlate";

export default function InspectorPanel() {
  const { selectedPart, setSelectedPart, setCameraTarget } = useWatchStore(
    (state) => ({
      selectedPart: state.selectedPart,
      setSelectedPart: state.setSelectedPart,
      setCameraTarget: state.setCameraTarget
    })
  );
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({
    "Base Plate": true,
    Bridges: true,
    "Gear Train": true,
    Escapement: true,
    "Balance Assembly": true,
    Hands: true,
    Dial: true,
    Rotor: true
  });

  const groupedParts = useMemo(() => {
    return WATCH_PARTS.reduce<Record<string, typeof WATCH_PARTS>>((acc, part) => {
      if (!acc[part.layer]) {
        acc[part.layer] = [];
      }
      acc[part.layer].push(part);
      acc[part.layer].sort((a, b) => a.name.localeCompare(b.name));
      return acc;
    }, {});
  }, []);

  const activePart = selectedPart ? PART_MAP[selectedPart] : PART_MAP[fallbackPart];

  return (
    <div className="inspector">
      <div className="inspector__header">
        <h2>Mechanism Inspector</h2>
        <p>Tap a component to highlight it in the movement.</p>
      </div>
      <div className="inspector__body">
        {layerOrder.map((layer) => {
          const parts = groupedParts[layer];
          if (!parts?.length) return null;
          const expanded = expandedLayers[layer];
          return (
            <section key={layer} className="inspector__section">
              <header
                className="inspector__section-header"
                onClick={() =>
                  setExpandedLayers((prev) => ({
                    ...prev,
                    [layer]: !prev[layer]
                  }))
                }
              >
                <span>{layer}</span>
                <span className="inspector__section-count">{parts.length}</span>
              </header>
              {expanded && (
                <ul className="inspector__list">
                  {parts.map((part) => {
                    const isActive = selectedPart === part.id;
                    return (
                      <li key={part.id}>
                        <button
                          type="button"
                          className={`inspector__item ${isActive ? "is-active" : ""}`}
                          onClick={() => {
                            setSelectedPart(part.id);
                            setCameraTarget(part.id);
                          }}
                        >
                          <span className="inspector__item-name">{part.name}</span>
                          <span className="inspector__item-caption">{part.description}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <div className="inspector__detail">
        <h3>{activePart.name}</h3>
        <p className="inspector__detail-layer">{activePart.layer}</p>
        <p className="inspector__detail-desc">{activePart.description}</p>
        <p className="inspector__detail-function">
          <strong>Function:</strong> {activePart.function}
        </p>
        <ul className="inspector__detail-list">
          {activePart.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
        <button
          type="button"
          className="inspector__focus"
          onClick={() => setCameraTarget(selectedPart ?? activePart.id)}
        >
          Recenter Camera
        </button>
      </div>
    </div>
  );
}
