"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

type LocationPin = {
  id: string;
  title: string;
  region: string;
  lat: number;
  lng: number;
  description: string;
  submittedBy: string;
};

type UrbexMapProps = {
  locations: LocationPin[];
};

export function UrbexMap({ locations }: UrbexMapProps) {
  const center = locations[0]
    ? ([locations[0].lat, locations[0].lng] as [number, number])
    : ([51.505, -0.09] as [number, number]);

  return (
    <div className="map-frame h-[440px] overflow-hidden rounded-[24px] border border-[var(--line)]">
      <MapContainer center={center} zoom={14} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((location) => (
          <CircleMarker
            key={location.id}
            center={[location.lat, location.lng]}
            pathOptions={{
              color: "#9f4015",
              fillColor: "#cb5f2f",
              fillOpacity: 0.8,
              weight: 2
            }}
            radius={10}
          >
            <Popup>
              <div className="space-y-2">
                <p className="text-sm font-semibold">{location.title}</p>
                <p className="text-xs text-stone-600">{location.region}</p>
                <p className="text-sm leading-6">{location.description}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Submitted by {location.submittedBy}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}