export type DemoRole = "base" | "licensed" | "admin";

export type DemoUser = {
  email: string;
  password: string;
  name: string;
  role: DemoRole;
};

export const demoUsers: DemoUser[] = [
  {
    email: "admin@urbex.local",
    password: "DemoAdmin123",
    name: "Atlas Control",
    role: "admin"
  },
  {
    email: "member@urbex.local",
    password: "DemoMember123",
    name: "Licensed Explorer",
    role: "licensed"
  },
  {
    email: "user@urbex.local",
    password: "DemoUser123",
    name: "Base User",
    role: "base"
  }
];

export const demoLicenseKeys = ["URBEX-ALPHA-ACCESS", "PATREON-LICENSE-2026"];

export const sampleLocations = [
  {
    id: "loc-1",
    title: "Canal Pump House",
    region: "South Basin",
    status: "approved",
    points: 40,
    lat: 51.505,
    lng: -0.09,
    description: "Brick pump station with intact valve room and safe daylight entry window.",
    submittedBy: "Licensed Explorer"
  },
  {
    id: "loc-2",
    title: "Hollow Mill Annex",
    region: "East Industrial Arc",
    status: "approved",
    points: 55,
    lat: 51.51,
    lng: -0.102,
    description: "Collapsed weaving annex with elevated catwalk and strong photo angles.",
    submittedBy: "Atlas Control"
  },
  {
    id: "loc-3",
    title: "North Yard Control Tower",
    region: "Rail Fringe",
    status: "pending",
    points: 0,
    lat: 51.498,
    lng: -0.082,
    description: "Pending moderator review. Exterior access confirmed, interior route unverified.",
    submittedBy: "Base User"
  }
];

export const sampleLeaderboard = [
  { rank: 1, name: "Atlas Control", score: 240, approvedSubmissions: 8 },
  { rank: 2, name: "Licensed Explorer", score: 180, approvedSubmissions: 5 },
  { rank: 3, name: "Base User", score: 35, approvedSubmissions: 1 }
];

export const moderationQueue = [
  {
    id: "sub-1",
    title: "River Intake Annex",
    submittedBy: "Licensed Explorer",
    createdAt: "2026-03-29 21:14",
    images: 2,
    note: "Interior safe. Coordinates need precision trim before publish."
  },
  {
    id: "sub-2",
    title: "Upper Silo Access",
    submittedBy: "Base User",
    createdAt: "2026-03-30 09:04",
    images: 0,
    note: "Awaiting proof image before moderator decision."
  }
];