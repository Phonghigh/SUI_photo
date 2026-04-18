import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

/**
 * RFC 7807 Problem Details for HTTP APIs.
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export class HttpError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly detail?: string;
  readonly extras?: Record<string, unknown>;

  constructor(
    status: number,
    title: string,
    detail?: string,
    options?: { type?: string; extras?: Record<string, unknown> }
  ) {
    super(detail ?? title);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = options?.type ?? `https://snapproof.app/problems/${slugify(title)}`;
    this.extras = options?.extras;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const notFound = (detail: string) => new HttpError(404, "Not Found", detail);
export const badRequest = (detail: string) => new HttpError(400, "Bad Request", detail);
export const internal = (detail: string) => new HttpError(500, "Internal Server Error", detail);
export const tooManyRequests = (detail: string) =>
  new HttpError(429, "Too Many Requests", detail);

/**
 * Express error-handling middleware that emits RFC 7807 problem+json responses.
 */
export function problemHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    const body: ProblemDetails = {
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance: req.originalUrl,
      ...(err.extras ?? {}),
    };
    res
      .status(err.status)
      .type("application/problem+json")
      .send(body);
    return;
  }

  logger.error({ err }, "unhandled error");
  const body: ProblemDetails = {
    type: "https://snapproof.app/problems/internal-server-error",
    title: "Internal Server Error",
    status: 500,
    detail: "An unexpected error occurred.",
    instance: req.originalUrl,
  };
  res.status(500).type("application/problem+json").send(body);
}
