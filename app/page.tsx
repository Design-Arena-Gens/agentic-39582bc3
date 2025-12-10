"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import LayerVisibility from "@/components/LayerVisibility";
import InspectorPanel from "@/components/InspectorPanel";
import useWatchStore from "@/stores/useWatchStore";

const WatchScene = dynamic(() => import("@/components/WatchScene"), {
  ssr: false,
  loading: () => (
    <div className="scene__loading">
      <span className="scene__loading-spinner" />
      <p>Calibrating movement...</p>
    </div>
  )
});

export default function Page() {
  const { setCameraTarget } = useWatchStore((state) => ({
    setCameraTarget: state.setCameraTarget
  }));

  return (
    <main className="page">
      <section className="page__stage">
        <Suspense
          fallback={
            <div className="scene__loading">
              <span className="scene__loading-spinner" />
              <p>Calibrating movement...</p>
            </div>
          }
        >
          <WatchScene />
        </Suspense>
        <div className="stage__cta">
          <button
            type="button"
            onClick={() => setCameraTarget("overview")}
            className="stage__cta-button"
          >
            Reset Orbit
          </button>
        </div>
      </section>
      <aside className="page__sidebar">
        <LayerVisibility />
        <InspectorPanel />
      </aside>
    </main>
  );
}
