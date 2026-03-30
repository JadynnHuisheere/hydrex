"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { appConfig } from "@/lib/config";
import { saveSession } from "@/lib/auth/session";
import { demoUsers } from "@/lib/mock/data";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const signupSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/login?error=invalid-input");
  }

  if (!appConfig.demoAuthEnabled) {
    redirect("/login?error=auth-provider-missing");
  }

  const user = demoUsers.find(
    (entry) =>
      entry.email === parsed.data.email && entry.password === parsed.data.password
  );

  if (!user) {
    redirect("/login?error=invalid-credentials");
  }

  await saveSession({
    email: user.email,
    name: user.name,
    role: user.role
  });

  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid-input");
  }

  await saveSession({
    email: parsed.data.email,
    name: parsed.data.name,
    role: "base"
  });

  redirect("/dashboard?welcome=1");
}