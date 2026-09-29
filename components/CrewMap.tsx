"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo";

export type CrewMapPoint = LatLng & {
  id: string;
  label: string;
  kind: "hjem" | "opgave";
  color: string;
};

export function CrewMap({ points }: { points: CrewMapPoint[] }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const node = nodeRef.current;
    if (!node) return;
    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !nodeRef.current) return;
      mapRef.current?.remove();
      const map = L.map(nodeRef.current, { scrollWheelZoom: false });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      const bounds: [number, number][] = [];
      for (const point of points) {
        L.circleMarker([point.lat, point.lng], {
          radius: point.kind === "hjem" ? 9 : 6,
          color: "#16382c",
          weight: 1,
          fillColor: point.color,
          fillOpacity: 0.95,
        })
          .addTo(map)
          .bindTooltip(point.label);
        bounds.push([point.lat, point.lng]);
      }
      if (bounds.length === 0) map.setView([56.2, 10.6], 6);
      else if (bounds.length === 1) map.setView(bounds[0], 10);
      else map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [points]);

  return <div ref={nodeRef} className="crew-map" />;
}
