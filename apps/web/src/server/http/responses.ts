import type { Result } from "@cprussin/option-result";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { DomainError } from "../services/domain-error";
import { DomainErrors } from "../services/domain-error";

/**
 * Render a domain error as an RFC 9457 problem-detail JSON response with the
 * error's HTTP status. Consistent across every route; never leaks internals.
 */
export const problem = (error: DomainError): NextResponse =>
  NextResponse.json(
    {
      code: error.code,
      status: error.status,
      title: error.title,
      type: `https://forkroom.dev/problems/${error.code}`,
    },
    { status: error.status },
  );

/** Parse a JSON request body against a schema, or return a 422 problem. */
export const readJson = async <T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: NextResponse }> => {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, response: problem(DomainErrors.validationFailed()) };
};

export const json = <T>(body: T, status = 200): NextResponse =>
  NextResponse.json(body, { status });

/** Render a service `Result` as a success body or a problem response. */
export const respondResult = <T extends NonNullable<unknown>>(
  result: Result<T, DomainError>,
  okStatus = 200,
): NextResponse =>
  result.match({
    Err: (error) => problem(error),
    Ok: (value) => json(value, okStatus),
  });
