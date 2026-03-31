import { NextResponse } from "next/server";
import { z } from "zod";

const locationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  region: z.string().default(""),
  state: z.string().default(""),
  address: z.string().default(""),
  lat: z.number().finite(),
  lng: z.number().finite(),
  description: z.string().default("")
});

const requestSchema = z.object({
  prompt: z.string().max(300).optional().default(""),
  satelliteSignals: z.string().max(300).optional().default(""),
  topoSignals: z.string().max(300).optional().default(""),
  focusState: z.string().nullable().optional(),
  candidateCount: z.number().int().min(3).max(20).optional().default(8),
  mapStyle: z.enum(["street", "satellite", "topo"]).optional().default("street"),
  center: z
    .object({
      lat: z.number().finite(),
      lng: z.number().finite()
    })
    .nullable()
    .optional(),
  knownLocations: z.array(locationSchema).min(3)
});

type KnownLocation = z.infer<typeof locationSchema>;
type RequestShape = z.infer<typeof requestSchema>;

type ClusterFeature = {
  key: string;
  state: string;
  region: string;
  lat: number;
  lng: number;
  count: number;
  avgSignal: number;
  avgSatSignal: number;
  avgTopoSignal: number;
};

const abandonedKeywords = [
  "abandoned",
  "vacant",
  "derelict",
  "boarded",
  "condemned",
  "shuttered",
  "forgotten",
  "ruin",
  "ruins"
];

const industrialKeywords = [
  "mill",
  "factory",
  "warehouse",
  "plant",
  "depot",
  "rail",
  "station",
  "yard",
  "mine",
  "quarry",
  "hospital",
  "school",
  "asylum",
  "power",
  "silo"
];

const topoKeywords = [
  "valley",
  "ridge",
  "slope",
  "cut",
  "river",
  "creek",
  "canal",
  "waterfront",
  "rail corridor",
  "ravine"
];

const satKeywords = [
  "roof",
  "lot",
  "parking",
  "overgrown",
  "collapse",
  "burned",
  "shell",
  "compound",
  "footprint"
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function scoreByKeywords(text: string, keywords: string[]) {
  const lowered = normalize(text);
  if (!lowered) {
    return 0;
  }

  let score = 0;
  for (const keyword of keywords) {
    if (lowered.includes(keyword)) {
      score += 1;
    }
  }

  return score;
}

function locationSignal(location: KnownLocation, request: RequestShape) {
  const fullText = [location.title, location.region, location.state, location.address, location.description].join(" ");
  const promptText = [request.prompt, request.satelliteSignals, request.topoSignals].join(" ");

  const abandonedSignal = scoreByKeywords(fullText, abandonedKeywords) * 2;
  const industrialSignal = scoreByKeywords(fullText, industrialKeywords) * 1.4;
  const topoSignal = scoreByKeywords(fullText, topoKeywords) + scoreByKeywords(promptText, topoKeywords) * 0.25;
  const satSignal = scoreByKeywords(fullText, satKeywords) + scoreByKeywords(promptText, satKeywords) * 0.25;
  const promptSignal = scoreByKeywords(fullText, promptText.split(/\s+/).filter((token) => token.length > 3));

  let styleBoost = 0;
  if (request.mapStyle === "topo") {
    styleBoost = topoSignal * 0.6;
  }
  if (request.mapStyle === "satellite") {
    styleBoost = satSignal * 0.6;
  }

  return {
    total: abandonedSignal + industrialSignal + topoSignal * 0.8 + satSignal * 0.8 + promptSignal * 0.5 + styleBoost,
    topoSignal,
    satSignal
  };
}

function toGridKey(lat: number, lng: number) {
  const latBucket = Math.round(lat * 2) / 2;
  const lngBucket = Math.round(lng * 2) / 2;
  return `${latBucket.toFixed(1)}:${lngBucket.toFixed(1)}`;
}

function distanceScore(lat: number, lng: number, center: RequestShape["center"]) {
  if (!center) {
    return 1;
  }

  const dLat = lat - center.lat;
  const dLng = lng - center.lng;
  const euclidean = Math.sqrt(dLat * dLat + dLng * dLng);

  return Math.max(0.25, 1 - euclidean * 0.8);
}

function clusterLocations(locations: KnownLocation[], request: RequestShape) {
  const groups = new Map<string, { items: KnownLocation[]; lat: number; lng: number; signal: number; sat: number; topo: number }>();

  for (const location of locations) {
    const key = `${normalize(location.state) || "unknown"}:${toGridKey(location.lat, location.lng)}`;
    const signal = locationSignal(location, request);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        items: [location],
        lat: location.lat,
        lng: location.lng,
        signal: signal.total,
        sat: signal.satSignal,
        topo: signal.topoSignal
      });
      continue;
    }

    existing.items.push(location);
    existing.lat += location.lat;
    existing.lng += location.lng;
    existing.signal += signal.total;
    existing.sat += signal.satSignal;
    existing.topo += signal.topoSignal;
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const count = group.items.length;
    const first = group.items[0];

    return {
      key,
      state: first.state,
      region: first.region,
      lat: group.lat / count,
      lng: group.lng / count,
      count,
      avgSignal: group.signal / count,
      avgSatSignal: group.sat / count,
      avgTopoSignal: group.topo / count
    } satisfies ClusterFeature;
  });
}

function confidenceFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 80) {
    return "high";
  }
  if (score >= 55) {
    return "medium";
  }
  return "low";
}

function mapStyleFromSignals(cluster: ClusterFeature): "street" | "satellite" | "topo" {
  if (cluster.avgTopoSignal >= cluster.avgSatSignal + 0.5) {
    return "topo";
  }
  if (cluster.avgSatSignal >= cluster.avgTopoSignal + 0.5) {
    return "satellite";
  }
  return "street";
}

function buildCandidates(clusters: ClusterFeature[], request: RequestShape) {
  const focusState = normalize(request.focusState ?? "");
  const offsets = [
    { lat: 0.04, lng: 0.03 },
    { lat: -0.035, lng: 0.025 },
    { lat: 0.02, lng: -0.04 }
  ];

  const sorted = [...clusters].sort((a, b) => {
    const focusBoostA = focusState && normalize(a.state) === focusState ? 1.2 : 1;
    const focusBoostB = focusState && normalize(b.state) === focusState ? 1.2 : 1;
    const scoreA = (a.count * 12 + a.avgSignal * 6) * focusBoostA * distanceScore(a.lat, a.lng, request.center);
    const scoreB = (b.count * 12 + b.avgSignal * 6) * focusBoostB * distanceScore(b.lat, b.lng, request.center);
    return scoreB - scoreA;
  });

  const candidates: Array<{
    id: string;
    label: string;
    state: string;
    region: string;
    lat: number;
    lng: number;
    score: number;
    confidence: "high" | "medium" | "low";
    recommendedMapStyle: "street" | "satellite" | "topo";
    rationale: string[];
  }> = [];

  for (const cluster of sorted) {
    if (candidates.length >= request.candidateCount) {
      break;
    }

    for (const offset of offsets) {
      if (candidates.length >= request.candidateCount) {
        break;
      }

      const lat = cluster.lat + offset.lat;
      const lng = cluster.lng + offset.lng;
      const rawScore = (cluster.count * 12 + cluster.avgSignal * 6) * distanceScore(lat, lng, request.center);
      const score = Math.max(22, Math.min(98, Math.round(rawScore)));
      const recommendation = mapStyleFromSignals(cluster);

      candidates.push({
        id: `${cluster.key}:${offset.lat}:${offset.lng}`,
        label: `${cluster.region || "Regional"} ${cluster.state || "zone"} prospect ${candidates.length + 1}`,
        state: cluster.state || "Unknown",
        region: cluster.region || "Unknown",
        lat,
        lng,
        score,
        confidence: confidenceFromScore(score),
        recommendedMapStyle: recommendation,
        rationale: [
          `${cluster.count} known records indicate repeat abandonment pattern in this grid.`,
          `Signal profile favors ${recommendation} review mode for structure detection.`,
          `Use a 2-5 km sweep around this point for first-pass scouting.`
        ]
      });
    }
  }

  return candidates;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Invalid AI prospecting payload.",
          errors: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const clusters = clusterLocations(input.knownLocations, input);

    if (clusters.length === 0) {
      return NextResponse.json({ candidates: [], message: "No clusters available for prospecting yet." });
    }

    const candidates = buildCandidates(clusters, input);

    return NextResponse.json({
      candidates,
      message: `AI generated ${candidates.length} candidate zones from ${input.knownLocations.length} known locations.`
    });
  } catch {
    return NextResponse.json(
      {
        message: "AI prospecting failed on the server."
      },
      { status: 500 }
    );
  }
}
