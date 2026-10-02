import { NextResponse, type NextRequest } from "next/server";
import { forwardBackendRequest } from "./lib/backend-proxy";

export async function proxy(request: NextRequest) {
  // Sites/Vite use their own D1 routes. Only Vercel needs this server bridge.
  if (process.env.VERCEL !== "1") return NextResponse.next();
  return forwardBackendRequest(request, process.env.RAMEN_API_TOKEN, process.env.RAMEN_API_ORIGIN);
}

export const config = {
  matcher: ["/api/settings", "/api/students", "/api/teacher/:path*", "/api/upload", "/api/media/:path*"],
};
