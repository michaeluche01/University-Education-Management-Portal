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

