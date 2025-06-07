import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useLoaderData,
  redirect,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { cn } from "~/lib/utils";
import { auth, isAuthenticated } from "~/lib/firebase";

import "./tailwind.css";
import AppSidebar from "~/components/AppSidebar";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Allow access to sign-in page and its assets
  if (pathname === "/sign-in" || pathname.startsWith("/build/") || pathname.startsWith("/assets/")) {
    return json({ user: null });
  }

  try {
    const isUserAuthenticated = await isAuthenticated();
    console.log("Auth check in loader:", isUserAuthenticated ? "Authenticated" : "Not authenticated");

    if (!isUserAuthenticated) {
      console.log("User not authenticated, redirecting to sign-in");
      return redirect("/sign-in");
    }

    const user = auth.currentUser;
    if (!user) {
      console.log("No current user found, redirecting to sign-in");
      return redirect("/sign-in");
    }

    return json({ 
      user: { 
        email: user.email,
        uid: user.uid
      } 
    });
  } catch (error) {
    console.error("Auth error in loader:", error);
    return redirect("/sign-in");
  }
}

export default function App() {
  const location = useLocation();
  const { user } = useLoaderData<typeof loader>();
  const isSignInPage = location.pathname === "/sign-in";

  // If we're not on the sign-in page and there's no user, redirect
  if (!isSignInPage && !user) {
    return redirect("/sign-in");
  }

  return (
    <html lang="en" className="h-full bg-[#1A1D24]">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        {isSignInPage ? (
          <Outlet />
        ) : (
          <div className="flex h-full">
            <AppSidebar />
            <main className="flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </div>
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
