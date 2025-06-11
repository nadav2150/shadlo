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
import { auth, isAuthenticated, db, checkAndMarkGoogleProviderConnected } from "~/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";

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

  // Define public routes that don't require authentication
  const publicRoutes = ['/sign-in', '/build/', '/assets/'];
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

  // Allow access to public routes without authentication
  if (isPublicRoute) {
    return json({ user: null });
  }

  try {
    // Get the current user directly from auth
    const currentUser = auth.currentUser;

    // Also check authentication state
    const isUserAuthenticated = await isAuthenticated();

    if (!isUserAuthenticated || !currentUser) {
      if (pathname !== '/sign-in') {
        const searchParams = new URLSearchParams([["redirectTo", pathname]]);
        return redirect(`/sign-in?${searchParams.toString()}`);
      }
      return redirect('/sign-in');
    }

    // Verify email if required
    if (!currentUser.emailVerified) {
      return redirect("/sign-in");
    }

    // Check if user has Google refresh token and mark provider as connected
    let googleProviderStatus = { hasRefreshToken: false, isConnected: false };
    try {
      if (currentUser.email) {
        googleProviderStatus = await checkAndMarkGoogleProviderConnected(currentUser.email);
      }
    } catch (error) {
      console.error("Error checking Google provider status:", error);
      // Continue without Google provider status
    }

    // Try to get company name from Firestore
    let companyName = "";
    try {
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("email", "==", currentUser.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data();
        companyName = userDoc.companyName || "";
      }
    } catch (firestoreError) {
      // Continue without company name if Firestore fails
    }

    return json({ 
      user: { 
        email: currentUser.email,
        uid: currentUser.uid,
        emailVerified: currentUser.emailVerified,
        companyName: companyName
      },
      googleProviderStatus
    });
  } catch (error) {
    console.error("Auth error in root loader:", error);
    if (pathname !== '/sign-in') {
      return redirect("/sign-in");
    }
    return json({ user: null });
  }
}

export default function App() {
  const location = useLocation();
  const { user } = useLoaderData<typeof loader>();
  const isSignInPage = location.pathname === "/sign-in";
  const isNotFoundPage = location.pathname !== "/" && 
                        location.pathname !== "/sign-in" && 
                        location.pathname !== "/providers" && 
                        location.pathname !== "/entities" && 
                        location.pathname !== "/settings" &&
                        !location.pathname.startsWith("/api/") &&
                        !location.pathname.startsWith("/build/") &&
                        !location.pathname.startsWith("/assets/");

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
        {isSignInPage || isNotFoundPage ? (
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
