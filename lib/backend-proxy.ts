const API_ORIGIN = "https://ramen-rd-lab.cuteheea0.chatgpt.site";
const API_PATH = /^\/api\/(?:settings|students|upload|teacher\/login|media\/[^/]+)$/;
const ERROR_MESSAGE = "저장 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/** Server-only transport. The browser never receives the Sites credential. */
export async function forwardBackendRequest(request: Request, token: string | undefined, origin = API_ORIGIN) {
  const incoming = new URL(request.url);
  if (!API_PATH.test(incoming.pathname)) return Response.json({ error: "없는 요청입니다." }, { status: 404 });
  if (!token) return Response.json({ error: ERROR_MESSAGE }, { status: 503 });
  let target: URL;
  try { target = new URL(origin); } catch { return Response.json({ error: ERROR_MESSAGE }, { status: 503 }); }
  if (target.origin !== API_ORIGIN || target.pathname !== "/" || target.search || target.hash || target.username || target.password) {
    return Response.json({ error: ERROR_MESSAGE }, { status: 503 });
  }
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "range", "if-none-match", "x-class-code", "x-student-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const session = request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => /^ramen_teacher_session=[a-f0-9-]{36}$/.test(value));
  if (session) headers.set("cookie", session);
  headers.set("OAI-Sites-Authorization", `Bearer ${token}`);
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const media = incoming.pathname.startsWith("/api/media/");
    if ((response.status >= 300 && response.status < 400 && response.status !== 304) || (!media && !response.headers.get("content-type")?.includes("application/json"))) {
      console.error("[backend-proxy] Unexpected response", incoming.pathname, response.status);
      return Response.json({ error: ERROR_MESSAGE }, { status: 502 });
    }
    const outgoing = new Headers();
    for (const name of ["content-type", "etag", "accept-ranges", "content-range", "content-disposition", "last-modified"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    outgoing.set("cache-control", "private, no-store");
    for (const cookie of response.headers.getSetCookie()) {
      if (cookie.startsWith("ramen_teacher_session=")) outgoing.append("set-cookie", cookie);
    }
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    console.error("[backend-proxy] Request failed", incoming.pathname);
    return Response.json({ error: ERROR_MESSAGE }, { status: 502 });
  }
}
