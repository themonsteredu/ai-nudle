import {
  clearTeacherCookie,
  isTeacherPassword,
  isTeacherRequest,
  teacherCookie,
} from "@/lib/teacher-auth";

export async function GET(request: Request) {
  return Response.json({ authenticated: await isTeacherRequest(request) });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { password?: string };
  if (!isTeacherPassword(payload.password)) {
    return Response.json({ error: "비밀번호를 다시 확인해 주세요." }, { status: 401 });
  }

  return Response.json(
    { authenticated: true },
    { headers: { "Set-Cookie": await teacherCookie() } },
  );
}

export async function DELETE(request: Request) {
  return Response.json(
    { authenticated: false },
    { headers: { "Set-Cookie": await clearTeacherCookie(request) } },
  );
}
