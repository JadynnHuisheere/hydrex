"use client";

import { useEffect, useMemo, useState } from "react";
import type { LatLngBounds } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";

type LocationPin = {
  id: string;
  title: string;
  region: string;
  state: string;
  address: string;
  images: number;
  imageUrls: string[];
  media: Array<{ kind: "image" | "video"; url: string }>;
  lat: number;
  lng: number;
  description: string;
  submittedBy: string;
};

type UrbexMapProps = {
  locations: LocationPin[];
  onSelectSubmissionPoint?: (point: { lat: number; lng: number }) => void;
  onOpenStreetView?: (point: { lat: number; lng: number; title: string }) => void;
  searchPoint?: { lat: number; lng: number; label: string } | null;
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
  images: number;
  imageUrls: string[];
  media: Array<{ kind: "image" | "video"; url: string }>;
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
      images: location.images,
      imageUrls: location.imageUrls,
      media: location.media,
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
        images: first.images,
        imageUrls: first.imageUrls,
        media: first.media,
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
      images: cluster.items.reduce((total, item) => total + item.images, 0),
      imageUrls: [],
      media: [],
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

function MapSearchFocus({ searchPoint }: { searchPoint: UrbexMapProps["searchPoint"] }) {
  const map = useMap();

  useEffect(() => {
    if (!searchPoint) {
      return;
    }

    map.flyTo([searchPoint.lat, searchPoint.lng], Math.max(map.getZoom(), 15), {
      duration: 1.2
    });
  }, [map, searchPoint]);

  return null;
}

function MapViewportMarkers({ locations, onSelectSubmissionPoint, onOpenStreetView, searchPoint }: UrbexMapProps) {
  const [zoom, setZoom] = useState(14);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [tempPoint, setTempPoint] = useState<{ lat: number; lng: number } | null>(null);

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
    },
    click(event) {
      setTempPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
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
            color: pin.isCluster ? "var(--pin-cluster-stroke)" : "var(--pin-stroke)",
            fillColor: pin.isCluster ? "var(--pin-cluster-fill)" : "var(--pin-fill)",
            fillOpacity: 0.85,
            weight: 2
          }}
          radius={pin.isCluster ? Math.min(24, 10 + pin.count) : 9}
        >
          <Popup>
            <div className="space-y-2">
              <p className="text-sm font-semibold">{pin.title}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pin.region} • {pin.state}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pin.address}</p>
              {!pin.isCluster && pin.media[0]?.kind === "image" ? (
                <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                  <img
                    src={pin.media[0].url}
                    alt={`${pin.title} preview`}
                    className="h-32 w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}
              {!pin.isCluster && pin.media[0]?.kind === "video" ? (
                <video
                  src={pin.media[0].url}
                  className="h-32 w-full rounded-xl border border-[var(--line)] object-cover"
                  controls
                  preload="metadata"
                />
              ) : null}
              {!pin.isCluster && pin.media.length > 1 ? (
                <div className="grid grid-cols-3 gap-2">
                  {pin.media.slice(1, 4).map((mediaItem) => (
                    mediaItem.kind === "video" ? (
                      <video
                        key={mediaItem.url}
                        src={mediaItem.url}
                        className="h-16 w-full rounded-md border border-[var(--line)] object-cover"
                        muted
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <img
                        key={mediaItem.url}
                        src={mediaItem.url}
                        alt={`${pin.title} image`}
                        className="h-16 w-full rounded-md border border-[var(--line)] object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )
                  ))}
                </div>
              ) : null}
              <p className="text-sm leading-6">{pin.description}</p>
              {!pin.isCluster ? (
                <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  {pin.images} images available
                </p>
              ) : null}
              {pin.isCluster ? (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {pin.sampleTitles.map((title) => (
                    <p key={title}>{title}</p>
                  ))}
                </div>
              ) : null}
              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                Submitted by {pin.submittedBy}
              </p>
              {!pin.isCluster ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenStreetView?.({ lat: pin.lat, lng: pin.lng, title: pin.title });
                  }}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
                >
                  Open Street View
                </button>
              ) : null}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {tempPoint ? (
        <CircleMarker
          center={[tempPoint.lat, tempPoint.lng]}
          pathOptions={{
            color: "var(--accent-strong)",
            fillColor: "var(--accent)",
            fillOpacity: 0.85,
            weight: 2
          }}
          radius={8}
        >
          <Popup>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Drop a submission here?</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {tempPoint.lat.toFixed(6)}, {tempPoint.lng.toFixed(6)}
              </p>
              <button
                type="button"
                onClick={() => {
                  onSelectSubmissionPoint?.(tempPoint);
                }}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                Fill submission at this pin
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ) : null}

      {searchPoint ? (
        <CircleMarker
          center={[searchPoint.lat, searchPoint.lng]}
          pathOptions={{
            color: "#ffffff",
            fillColor: "var(--accent)",
            fillOpacity: 0.9,
            weight: 3
          }}
          radius={10}
        >
          <Popup>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Address result</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{searchPoint.label}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {searchPoint.lat.toFixed(6)}, {searchPoint.lng.toFixed(6)}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ) : null}
    </>
  );
}

export function UrbexMap({ locations, onSelectSubmissionPoint, onOpenStreetView, searchPoint }: UrbexMapProps) {
  const center = locations[0]
    ? ([locations[0].lat, locations[0].lng] as [number, number])
    : ([39.8283, -98.5795] as [number, number]);

  return (
    <div className="map-frame h-[440px] overflow-hidden rounded-[24px] border border-[var(--line)]">
      <MapContainer center={center} zoom={5} scrollWheelZoom className="h-full w-full">
        <MapSearchFocus searchPoint={searchPoint} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewportMarkers
          locations={locations}
          onSelectSubmissionPoint={onSelectSubmissionPoint}
          onOpenStreetView={onOpenStreetView}
          searchPoint={searchPoint}
        />
      </MapContainer>
    </div>
  );
}
