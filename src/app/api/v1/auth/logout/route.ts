import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { clearSessionCookie } from "@/server/auth/jwt";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const response = okResponse({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

