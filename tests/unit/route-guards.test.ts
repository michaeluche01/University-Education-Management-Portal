import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { ROUTE_MANIFEST } from "../rbac/route-manifest";

const API_ROOT = path.resolve(__dirname, "../../src/app/api");

const EXEMPT_AUTH_FILES = new Set([
  path.normalize("src/app/api/health/route.ts"),
  path.normalize("src/app/api/v1/auth/login/route.ts"),
  path.normalize("src/app/api/v1/auth/logout/route.ts"),
  path.normalize("src/app/api/v1/auth/clear-session/route.ts"),
]);

function getAllRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllRouteFiles(fullPath));
    } else if (entry.name === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

describe("Static API Route Guard Analysis", () => {
  const allRouteFiles = getAllRouteFiles(API_ROOT);

  it("ensures every physical API route is registered in the route manifest", () => {
    const manifestFiles = new Set(
      ROUTE_MANIFEST.map((m) => path.normalize(m.file))
    );

    for (const filePath of allRouteFiles) {
      const relPath = path.normalize(path.relative(path.resolve(__dirname, "../.."), filePath));
      expect(
        manifestFiles.has(relPath),
        `Route file ${relPath} is not registered in ROUTE_MANIFEST!`
      ).toBe(true);
    }
  });

  it("ensures every non-exempt route calls requireRole or requireAuth", () => {
    for (const filePath of allRouteFiles) {
      const relPath = path.normalize(path.relative(path.resolve(__dirname, "../.."), filePath));
      if (EXEMPT_AUTH_FILES.has(relPath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const hasAuthGuard =
        content.includes("requireRole(") || content.includes("requireAuth(");

      expect(
        hasAuthGuard,
        `Route ${relPath} does not call requireRole() or requireAuth()!`
      ).toBe(true);
    }
  });

  it("ensures every mutating handler (POST, PATCH, PUT, DELETE) calls assertSameOrigin", () => {
    for (const filePath of allRouteFiles) {
      const relPath = path.normalize(path.relative(path.resolve(__dirname, "../.."), filePath));
      const content = fs.readFileSync(filePath, "utf-8");

      const hasMutatingExport =
        content.includes("export async function POST") ||
        content.includes("export async function PATCH") ||
        content.includes("export async function PUT") ||
        content.includes("export async function DELETE");

      if (hasMutatingExport) {
        const callsSameOrigin = content.includes("assertSameOrigin(");
        expect(
          callsSameOrigin,
          `Mutating route ${relPath} does not call assertSameOrigin()!`
        ).toBe(true);
      }
    }
  });
});
