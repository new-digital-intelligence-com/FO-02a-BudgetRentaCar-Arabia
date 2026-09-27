import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession, sitePasswordConfigured } from "@/lib/auth";

// The icon is linked from the login page itself, so it has to be readable before signing in.
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/icon.svg"]);

// Every page and API route is behind the site password: a voice call spends ElevenLabs credits.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Noura's tools: ElevenLabs calls these, not a browser, so there is no site password. Each route
  // checks Budget's own secret header instead (src/lib/agentAuth.ts) and rejects anything without it.
  if (pathname.startsWith("/api/agent/")) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  if (!sitePasswordConfigured()) {
    // Fail closed: without SITE_PASSWORD nothing is reachable.
    if (isApi) return Response.json({ error: "Site password is not configured" }, { status: 503 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (isApi) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
