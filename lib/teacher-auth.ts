const COOKIE_NAME = "ramen_teacher_session";
const COOKIE_VALUE = "rd-lab-verified-v1";

export function isTeacherRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .includes(`${COOKIE_NAME}=${COOKIE_VALUE}`);
}

export function teacherCookie() {
  return `${COOKIE_NAME}=${COOKIE_VALUE}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`;
}

export function clearTeacherCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function isTeacherPassword(value: unknown) {
  return typeof value === "string" && value === "3035";
}
