export const BASE_URL =
  process.env.BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

const parsedBaseUrl = new URL(BASE_URL);
if (
  parsedBaseUrl.hostname !== "localhost" &&
  parsedBaseUrl.hostname !== "127.0.0.1" &&
  parsedBaseUrl.hostname !== "::1" &&
  process.env.ALLOW_REMOTE_TESTS !== "yes"
) {
  throw new Error(
    `Test safety refusal: refusing to execute tests against non-local host '${parsedBaseUrl.hostname}'. Set ALLOW_REMOTE_TESTS=yes to override.`
  );
}

export class ApiTestClient {
  private cookieHeader: string | null = null;

  public getCookie(): string | null {
    return this.cookieHeader;
  }

  public setCookie(cookie: string | null): void {
    this.cookieHeader = cookie;
  }

  public async request(
    path: string,
    init: RequestInit & { customOrigin?: string | null } = {}
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    const method = (init.method || "GET").toUpperCase();

    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (init.customOrigin !== undefined) {
      if (init.customOrigin !== null) {
        headers.set("Origin", init.customOrigin);
      }
    } else if (method !== "GET" && method !== "HEAD") {
      headers.set("Origin", BASE_URL);
    }

    if (this.cookieHeader) {
      headers.set("Cookie", this.cookieHeader);
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      redirect: "manual",
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/uemp_session=([^;]*)/);
      if (match) {
        const value = match[1];
        if (!value) {
          this.cookieHeader = null;
        } else {
          this.cookieHeader = `uemp_session=${value}`;
        }
      }
    }

    return response;
  }

  public async login(email: string, password = "Uemp@Demo2026") {
    return this.request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  public async me() {
    return this.request("/api/v1/auth/me", {
      method: "GET",
    });
  }

  public async logout() {
    return this.request("/api/v1/auth/logout", {
      method: "POST",
    });
  }
}

