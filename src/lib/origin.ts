import { AppError } from "@/lib/errors";

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new AppError(
      403,
      "FORBIDDEN_ORIGIN",
      "Missing Origin header on mutating request."
    );
  }

  let originHost: string;
  let originFull: string;
  try {
    const parsedOrigin = new URL(origin);
    originHost = parsedOrigin.host;
    originFull = parsedOrigin.origin;
  } catch {
    throw new AppError(403, "FORBIDDEN_ORIGIN", "Invalid Origin header.");
  }

  const reqUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ||
    reqUrl.protocol.replace(":", "");

  const allowedOrigins = new Set<string>([reqUrl.origin]);
  if (hostHeader) {
    allowedOrigins.add(`${forwardedProto}://${hostHeader}`);
    allowedOrigins.add(`${reqUrl.protocol}//${hostHeader}`);
  }
  if (forwardedHost) {
    allowedOrigins.add(`${forwardedProto}://${forwardedHost}`);
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {
      // ignore invalid env URL
    }
  }

  if (!allowedOrigins.has(originFull) && originHost !== reqUrl.host) {
    throw new AppError(
      403,
      "FORBIDDEN_ORIGIN",
      "Cross-origin requests are not permitted."
    );
  }
}

