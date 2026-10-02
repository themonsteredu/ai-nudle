import assert from "node:assert/strict";
import { test, afterEach, mock } from "node:test";
import { forwardBackendRequest } from "../lib/backend-proxy.ts";
import { teacherSession } from "../lib/client-api.ts";

afterEach(() => mock.restoreAll());
const origin = "https://ai-nudle.vercel.app";
const token = "test-server-token";
const session = "12345678-1234-1234-1234-123456789abc";

test("server credential stays upstream; teacher cookie and POST body survive", async () => {
  let sent;
  mock.method(globalThis, "fetch", async (url, options) => {
    sent = { url, ...options };
    return Response.json({ authenticated: true }, { headers: { "set-cookie": `ramen_teacher_session=${session}; HttpOnly; SameSite=Strict; Path=/`, "OAI-Sites-Authorization": token } });
  });
  const response = await forwardBackendRequest(new Request(`${origin}/api/teacher/login`, { method: "POST", headers: { "content-type": "application/json", cookie: `unrelated=private; ramen_teacher_session=${session}`, authorization: "unrelated-private-token", "OAI-Sites-Authorization": "client-injected" }, body: JSON.stringify({ password: "test-password" }) }), token);
  assert.equal(response.status, 200);
  assert.equal(sent.url.origin, "https://ramen-rd-lab.cuteheea0.chatgpt.site");
  assert.equal(sent.headers.get("OAI-Sites-Authorization"), `Bearer ${token}`);
  assert.equal(sent.headers.get("cookie"), `ramen_teacher_session=${session}`);
  assert.equal(sent.headers.has("authorization"), false);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(sent.body)), { password: "test-password" });
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.equal(response.headers.has("OAI-Sites-Authorization"), false);
  assert.equal(sent.redirect, "manual");
  assert.equal((await response.text()).includes(token), false);
});

test("missing credential, unknown paths and foreign origins fail closed", async () => {
  const fetch = mock.method(globalThis, "fetch", () => { throw new Error("must not fetch"); });
  assert.equal((await forwardBackendRequest(new Request(`${origin}/api/teacher/login`))).status, 503);
  assert.equal((await forwardBackendRequest(new Request(`${origin}/signin-with-chatgpt`), token)).status, 404);
  assert.equal((await forwardBackendRequest(new Request(`${origin}/api/settings`), token, "https://other.example")).status, 503);
  assert.equal(fetch.mock.callCount(), 0);
});

test("ChatGPT gate HTML and redirects become a JSON error; redirects never carry credential", async () => {
  mock.method(globalThis, "fetch", async () => new Response("<html>Sign in with ChatGPT</html>", { headers: { "content-type": "text/html" } }));
  const response = await forwardBackendRequest(new Request(`${origin}/api/teacher/login`), token);
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /서버/);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => new Response(null, { status: 302, headers: { location: "https://other.example" } }));
  assert.equal((await forwardBackendRequest(new Request(`${origin}/api/settings`), token)).status, 502);
});

test("app authorization errors, class credentials and query parameters are preserved", async () => {
  mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url.search, "?classId=class-one");
    assert.equal(init.headers.get("x-class-code"), "CLASS1");
    assert.equal(init.headers.get("x-student-key"), "owner-key");
    return Response.json({ error: "이 기기의 기록이 아닙니다." }, { status: 403 });
  });
  const response = await forwardBackendRequest(new Request(`${origin}/api/students?classId=class-one`, { headers: { "x-class-code": "CLASS1", "x-student-key": "owner-key" } }), token);
  assert.equal(response.status, 403);
});

test("teacher login reports HTML/network/invalid sessions and preserves wrong-password errors", async () => {
  for (const makeResponse of [() => new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } }), () => Response.json({ authenticated: false }), () => { throw new TypeError("network"); }]) {
    mock.method(globalThis, "fetch", async () => makeResponse());
    await assert.rejects(teacherSession("POST", "test-password"), /서버/);
    mock.restoreAll();
  }
  mock.method(globalThis, "fetch", async () => Response.json({ error: "비밀번호를 다시 확인해 주세요." }, { status: 401 }));
  await assert.rejects(teacherSession("POST", "wrong"), /비밀번호/);
});

test("teacher login and session check accept valid authenticated JSON only", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ authenticated: true }));
  assert.deepEqual(await teacherSession("POST", "test-password"), { authenticated: true });
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => Response.json({ authenticated: false }));
  assert.deepEqual(await teacherSession(), { authenticated: false });
});
