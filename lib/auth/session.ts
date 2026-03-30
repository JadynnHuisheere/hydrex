import "server-only";

import { cookies } from "next/headers";

import type { DemoRole } from "@/lib/mock/data";

const SESSION_COOKIE = "urbex_session";

export type SessionUser = {
  email: string;
  name: string;
  role: DemoRole;
};

function serializeSession(session: SessionUser) {
  return encodeURIComponent(JSON.stringify(session));
}

function deserializeSession(value: string): SessionUser | null {
  try {
    return JSON.parse(decodeURIComponent(value)) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  return deserializeSession(raw);
}

export async function saveSession(session: SessionUser) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, serializeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function hasLicensedAccess(session: SessionUser | null) {
  return session?.role === "licensed" || session?.role === "admin";
}