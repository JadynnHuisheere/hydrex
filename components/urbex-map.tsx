"use client";

import { useMemo, useState } from "react";
import type { LatLngBounds } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMapEvents
} from "react-leaflet";

type LocationPin = {
  id: string;
  title: string;
  region: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  submittedBy: string;
};

type UrbexMapProps = {
  locations: LocationPin[];
};

type DisplayPin = {
  id: string;
  lat: number;
  lng: number;
  count: number;
  isCluster: boolean;
  title: string;
  region: string;
  state: string;
  address: string;
  description: string;
  submittedBy: string;
  sampleTitles: string[];
};

function getClusterGridSize(zoom: number) {
  if (zoom <= 5) {
    return 2.2;
  }

  if (zoom <= 7) {
    return 1.2;
  }

  if (zoom <= 9) {
    return 0.55;
  }

  if (zoom <= 11) {
    return 0.2;
  }

  return 0;
}

function clusterLocations(locations: LocationPin[], zoom: number) {
  const gridSize = getClusterGridSize(zoom);

  if (gridSize === 0) {
    return locations.map<DisplayPin>((location) => ({
      id: location.id,
      lat: location.lat,
      lng: location.lng,
      count: 1,
      isCluster: false,
      title: location.title,
      region: location.region,
      state: location.state,
      address: location.address,
      description: location.description,
      submittedBy: location.submittedBy,
      sampleTitles: [location.title]
    }));
  }

  const grouped = new Map<string, { items: LocationPin[]; lat: number; lng: number }>();

  for (const location of locations) {
    const latKey = Math.round(location.lat / gridSize);
    const lngKey = Math.round(location.lng / gridSize);
    const key = `${latKey}:${lngKey}`;
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, { items: [location], lat: location.lat, lng: location.lng });
      continue;
    }

    current.items.push(location);
    current.lat += location.lat;
    current.lng += location.lng;
  }

  return Array.from(grouped.entries()).map(([key, cluster]) => {
    const first = cluster.items[0];
    const count = cluster.items.length;

    if (count === 1) {
      return {
        id: first.id,
        lat: first.lat,
        lng: first.lng,
        count: 1,
        isCluster: false,
        title: first.title,
        region: first.region,
        state: first.state,
        address: first.address,
        description: first.description,
        submittedBy: first.submittedBy,
        sampleTitles: [first.title]
      } satisfies DisplayPin;
    }

    return {
      id: key,
      lat: cluster.lat / count,
      lng: cluster.lng / count,
      count,
      isCluster: true,
      title: `${count} nearby locations`,
      region: first.region,
      state: first.state,
      address: first.address,
      description: "Zoom in to split this cluster into individual locations.",
      submittedBy: "multiple explorers",
      sampleTitles: cluster.items.slice(0, 5).map((item) => item.title)
    } satisfies DisplayPin;
  });
}

function isInBounds(location: LocationPin, bounds: LatLngBounds | null) {
  if (!bounds) {
    return true;
  }

  const padded = bounds.pad(0.35);
  return padded.contains([location.lat, location.lng]);
}

function MapViewportMarkers({ locations }: UrbexMapProps) {
  const [zoom, setZoom] = useState(14);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);

  useMapEvents({
    load(event) {
      setZoom(event.target.getZoom());
      setBounds(event.target.getBounds());
    },
    moveend(event) {
      setBounds(event.target.getBounds());
    },
    zoomend(event) {
      setZoom(event.target.getZoom());
      setBounds(event.target.getBounds());
    }
  });

  const visibleLocations = useMemo(
    () => locations.filter((location) => isInBounds(location, bounds)),
    [bounds, locations]
  );

  const displayPins = useMemo(
    () => clusterLocations(visibleLocations, zoom),
    [visibleLocations, zoom]
  );

  return (
    <>
      {displayPins.map((pin) => (
        <CircleMarker
          key={pin.id}
          center={[pin.lat, pin.lng]}
          pathOptions={{
            color: pin.isCluster ? "#6b5f53" : "#9f4015",
            fillColor: pin.isCluster ? "#8f7d6f" : "#cb5f2f",
            fillOpacity: 0.85,
            weight: 2
          }}
          radius={pin.isCluster ? Math.min(24, 10 + pin.count) : 9}
        >
          <Popup>
            <div className="space-y-2">
              <p className="text-sm font-semibold">{pin.title}</p>
              <p className="text-xs text-stone-600">{pin.region} • {pin.state}</p>
              <p className="text-xs text-stone-500">{pin.address}</p>
              <p className="text-sm leading-6">{pin.description}</p>
              {pin.isCluster ? (
                <div className="text-xs text-stone-500">
                  {pin.sampleTitles.map((title) => (
                    <p key={title}>{title}</p>
                  ))}
                </div>
              ) : null}
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Submitted by {pin.submittedBy}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

export function UrbexMap({ locations }: UrbexMapProps) {
  const center = locations[0]
    ? ([locations[0].lat, locations[0].lng] as [number, number])
    : ([39.8283, -98.5795] as [number, number]);

  return (
    <div className="map-frame h-[440px] overflow-hidden rounded-[24px] border border-[var(--line)]">
      <MapContainer center={center} zoom={5} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewportMarkers locations={locations} />
      </MapContainer>
    </div>
  );
}
