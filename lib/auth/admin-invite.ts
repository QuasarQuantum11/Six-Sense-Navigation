import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function isValidAdminInvite(code: string): boolean {
  const candidates = (process.env.ADMIN_INVITE_CODES ?? "")
    .split(",")
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length >= 24);

  const submitted = digest(code.trim());
  return candidates.some((candidate) =>
    timingSafeEqual(submitted, digest(candidate)),
  );
}
