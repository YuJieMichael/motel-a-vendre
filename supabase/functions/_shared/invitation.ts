/** The trusted application origin belongs to the server, never to the caller. */
export function appointmentConfig(value: string | undefined) {
  if (!value) throw new Error("APP_ORIGIN is required");
  const url = new URL(value);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("APP_ORIGIN must be an HTTPS application URL");
  }
  url.pathname = url.pathname.replace(/\/+$/, "") + "/";
  return { origin: url.origin };
}

export function appointmentInput(
  value: unknown,
): { email: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "email")) return null;
  if (typeof body.email !== "string") return null;
  const email = body.email.trim().toLowerCase();
  if (
    email.length > 254 ||
    email.length < 3 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\u0000-\u001f\u007f]/.test(email)
  )
    return null;
  return { email };
}

/** Bound streamed bodies as well as bodies with a Content-Length header. */
export async function readSmallJson(
  request: Request,
  maxBytes = 4096,
): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new Error("invalid_body");
  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > maxBytes) throw new Error("invalid_body");
  if (!request.body) throw new Error("invalid_body");
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error("invalid_body");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined));
}
