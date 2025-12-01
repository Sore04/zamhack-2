import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "@/types/supabase";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const protectedRoutes = ["/dashboard", "/company", "/admin"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const publicRoutes = ["/login", "/signup"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // 1. Redirect unauthenticated users to login
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. Logic for authenticated users
  if (user) {
    // Fetch role if we are routing
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    const role = profile?.role;

    // A. If on Login/Signup -> Go to correct Dashboard
    if (isPublicRoute) {
      if (role === "admin") return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      if (role === "company_admin" || role === "company_member") return NextResponse.redirect(new URL("/company/dashboard", request.url));
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // B. Protection Logic: Prevent users from accessing wrong dashboards
    if (pathname.startsWith("/dashboard")) {
      // If Admin tries to access Student Dashboard -> Send to Admin
      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      // If Company tries to access Student Dashboard -> Send to Company
      if (role === "company_admin" || role === "company_member") {
        return NextResponse.redirect(new URL("/company/dashboard", request.url));
      }
    } 
    
    else if (pathname.startsWith("/company")) {
      if (role !== "company_admin" && role !== "company_member") {
        // Send back to their home
        if (role === "admin") return NextResponse.redirect(new URL("/admin/dashboard", request.url));
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } 
    
    else if (pathname.startsWith("/admin")) {
      if (role !== "admin") {
        // Send back to their home
        if (role === "company_admin" || role === "company_member") return NextResponse.redirect(new URL("/company/dashboard", request.url));
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};