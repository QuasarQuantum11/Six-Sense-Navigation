import { jwtVerify, SignJWT } from "jose";

export type SessionRole = "student" | "admin";

export type SessionPayload = {
  userId: string;
  username: string;
  role: SessionRole;
};

const algorithm = "HS256";

function encodedKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionPayload,
  secret: string,
  expiresAt: Date,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(encodedKey(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey(secret), {
      algorithms: [algorithm],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      (payload.role !== "student" && payload.role !== "admin")
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
