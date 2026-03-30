"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { clearSession, getSession, saveSession } from "@/lib/auth/session";
import { demoLicenseKeys } from "@/lib/mock/data";

const redeemSchema = z.object({
  key: z.string().trim().min(8)
});

export async function redeemLicenseAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const parsed = redeemSchema.safeParse({
    key: formData.get("key")
  });

  if (!parsed.success) {
    redirect("/dashboard/redeem?error=invalid-key");
  }

  const normalizedKey = parsed.data.key.toUpperCase();

  if (!demoLicenseKeys.includes(normalizedKey)) {
    redirect("/dashboard/redeem?error=key-not-found");
  }

  await saveSession({
    ...session,
    role: session.role === "admin" ? "admin" : "licensed"
  });

  redirect("/dashboard?redeemed=1");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}