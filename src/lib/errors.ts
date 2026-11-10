import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SESSION_COOKIE_NAME } from "@/server/auth/jwt";

export type ErrorHttpStatus = 400 | 401 | 403 | 404 | 409 | 423 | 500;

export class AppError extends Error {
  public readonly status: ErrorHttpStatus;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly clearCookie?: boolean;

  constructor(
    status: ErrorHttpStatus,
    code: string,
    message: string,
    options?: { details?: unknown; clearCookie?: boolean }
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.clearCookie = options?.clearCookie;
  }
}

export function okResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const body: {
      error: { code: string; message: string; details?: unknown };
    } = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
    const response = NextResponse.json(body, { status: error.status });
    if (error.clearCookie || error.status === 401) {
      response.cookies.set(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message || "Invalid request input.",
          details: error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const prismaCode = getPrismaErrorCode(error);
  if (prismaCode === "P2002") {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT_DUPLICATE",
          message: "A record with this value already exists.",
        },
      },
      { status: 409 }
    );
  }

  if (prismaCode === "P2003" || prismaCode === "P2014") {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT_IN_USE",
          message: "Record is in use by other records.",
        },
      },
      { status: 409 }
    );
  }

  if (prismaCode === "P2025") {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Record not found.",
        },
      },
      { status: 404 }
    );
  }

  console.error("[API Unhandled Error]:", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 }
  );
}
