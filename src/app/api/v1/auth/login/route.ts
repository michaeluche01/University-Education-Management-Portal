import { handleApiError, okResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/origin";
import { loginSchema } from "@/lib/validators/auth";
import { setSessionCookie, signSessionToken } from "@/server/auth/jwt";
import { authenticateUser } from "@/server/services/auth.service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const parsed = loginSchema.parse(body);

    const result = await authenticateUser(parsed);
    const token = await signSessionToken(result.user.id);

    const response = okResponse(result);
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

