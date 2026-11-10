import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ApiTestClient } from "./helpers";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// Use student24 for temporary status/lockout mutation tests and restore in afterEach/finally
const TEST_MUTATION_EMAIL = "student24@uemp.demo";

async function resetTestUser(email: string) {
  await prisma.user.updateMany({
    where: { email },
    data: {
      status: "ACTIVE",
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
}

describe("Phase 2 Auth & RBAC API Suite", { timeout: 30000 }, () => {
  beforeEach(async () => {
    await resetTestUser(TEST_MUTATION_EMAIL);
  });

  afterAll(async () => {
    await resetTestUser(TEST_MUTATION_EMAIL);
    await prisma.$disconnect();
  });

  it("returns 401 on GET /api/v1/auth/me without a session cookie", async () => {
    const client = new ApiTestClient();
    const res = await client.me();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it.each([
    {
      email: "superadmin@uemp.demo",
      expectedRole: "SUPER_ADMIN",
      expectedPath: "/super-admin",
    },
    {
      email: "deptadmin.csc@uemp.demo",
      expectedRole: "DEPARTMENT_ADMIN",
      expectedPath: "/dept-admin",
    },
    {
      email: "lecturer1@uemp.demo",
      expectedRole: "LECTURER",
      expectedPath: "/lecturer",
    },
    {
      email: "student01@uemp.demo",
      expectedRole: "STUDENT",
      expectedPath: "/student",
    },
  ])(
    "logs in $email ($expectedRole) and returns matching role from /api/v1/auth/me",
    async ({ email, expectedRole, expectedPath }) => {
      const client = new ApiTestClient();
      const loginRes = await client.login(email, "Uemp@Demo2026");
      expect(loginRes.status).toBe(200);

      const loginBody = await loginRes.json();
      expect(loginBody.data.role).toBe(expectedRole);
      expect(loginBody.data.dashboardPath).toBe(expectedPath);
      expect(client.getCookie()).toMatch(/^uemp_session=.+/);

      const meRes = await client.me();
      expect(meRes.status).toBe(200);
      const meBody = await meRes.json();
      expect(meBody.data.role).toBe(expectedRole);
      expect(meBody.data.email).toBe(email);
    }
  );

  it("returns 401 with generic 'Invalid email or password' for wrong password and unknown email", async () => {
    const client = new ApiTestClient();

    const wrongPassRes = await client.login(
      "student01@uemp.demo",
      "WrongPassword123!"
    );
    expect(wrongPassRes.status).toBe(401);
    const wrongPassBody = await wrongPassRes.json();
    expect(wrongPassBody.error?.message).toBe("Invalid email or password");

    // Reset failedLoginCount on student01 so it stays clean
    await resetTestUser("student01@uemp.demo");

    const unknownEmailRes = await client.login(
      "nobody.unknown@uemp.demo",
      "WrongPassword123!"
    );
    expect(unknownEmailRes.status).toBe(401);
    const unknownBody = await unknownEmailRes.json();
    expect(unknownBody.error?.message).toBe("Invalid email or password");
  });

  it("rejects a SUSPENDED user at login with 403 'Account is not active'", async () => {
    await prisma.user.update({
      where: { email: TEST_MUTATION_EMAIL },
      data: { status: "SUSPENDED" },
    });

    try {
      const client = new ApiTestClient();
      const res = await client.login(TEST_MUTATION_EMAIL, "Uemp@Demo2026");
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error?.message).toBe("Account is not active");
    } finally {
      await resetTestUser(TEST_MUTATION_EMAIL);
    }
  });

  it("rejects an existing session with 401 on /api/v1/auth/me when user is suspended afterwards", async () => {
    const client = new ApiTestClient();
    const loginRes = await client.login(TEST_MUTATION_EMAIL, "Uemp@Demo2026");
    expect(loginRes.status).toBe(200);

    const meBefore = await client.me();
    expect(meBefore.status).toBe(200);

    try {
      await prisma.user.update({
        where: { email: TEST_MUTATION_EMAIL },
        data: { status: "SUSPENDED" },
      });

      const meAfter = await client.me();
      expect(meAfter.status).toBe(401);
    } finally {
      await resetTestUser(TEST_MUTATION_EMAIL);
    }
  });

  it("locks the account for 15 minutes after 5 failed login attempts and returns 423", async () => {
    const client = new ApiTestClient();

    try {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await client.login(
          TEST_MUTATION_EMAIL,
          `WrongPass_${attempt}`
        );
        expect(res.status).toBe(401);
      }

      const userInDb = await prisma.user.findUnique({
        where: { email: TEST_MUTATION_EMAIL },
      });
      expect(userInDb?.failedLoginCount).toBe(5);
      expect(userInDb?.lockedUntil).not.toBeNull();

      // 6th attempt (even with valid password) is rejected with 423 Locked
      const lockedRes = await client.login(
        TEST_MUTATION_EMAIL,
        "Uemp@Demo2026"
      );
      expect(lockedRes.status).toBe(423);
      const lockedBody = await lockedRes.json();
      expect(lockedBody.error?.message).toBe(
        "Too many attempts, try again later"
      );
    } finally {
      await resetTestUser(TEST_MUTATION_EMAIL);
    }
  });

  it("rejects mutating requests with a foreign Origin header with 403", async () => {
    const client = new ApiTestClient();
    const res = await client.request("/api/v1/auth/login", {
      method: "POST",
      customOrigin: "https://malicious.example.com",
      body: JSON.stringify({
        email: "student01@uemp.demo",
        password: "Uemp@Demo2026",
      }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("FORBIDDEN_ORIGIN");
  });
});

