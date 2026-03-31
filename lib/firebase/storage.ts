"use client";

import { getFirebaseApp } from "@/lib/firebase/client";

export type UploadedMedia = {
  kind: "image" | "video";
  url: string;
};

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function uploadSubmissionMedia(uid: string, files: File[]) {
  const app = getFirebaseApp();

  if (!app) {
    return { ok: false, reason: "firebase-not-configured" } as const;
  }

  const validFiles = files
    .filter((file) => file.size > 0)
    .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
    .slice(0, 8);

  if (validFiles.length === 0) {
    return { ok: true, media: [] as UploadedMedia[] } as const;
  }

  const storage = await import("firebase/storage");
  const bucket = storage.getStorage(app);

  try {
    const uploaded = await Promise.all(
      validFiles.map(async (file) => {
        const ext = file.name.includes(".") ? file.name.split(".").pop() ?? "bin" : "bin";
        const safeExt = sanitizeSegment(ext.toLowerCase());
        const base = sanitizeSegment(file.name.replace(/\.[^.]*$/, "") || "upload");
        const path = `submissions/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}.${safeExt}`;
        const mediaRef = storage.ref(bucket, path);

        await storage.uploadBytes(mediaRef, file, {
          contentType: file.type || undefined
        });

        const url = await storage.getDownloadURL(mediaRef);

        return {
          kind: file.type.startsWith("video/") ? "video" : "image",
          url
        } satisfies UploadedMedia;
      })
    );

    return { ok: true, media: uploaded } as const;
  } catch {
    return { ok: false, reason: "storage-upload-failed" } as const;
  }
}
