import { createCookieSessionStorage } from "@remix-run/node";

// Define the Google credentials type
export interface GoogleCredentials {
  access_token: string;
  scope: string;
  authuser: string;
  expires_in: number;
  token_type: string;
}

// Create a separate session storage for Google credentials
const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: "google_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "default-secret-change-me"],
    secure: process.env.NODE_ENV === "production",
  },
});

// Helper functions to manage Google credentials in session
export async function getGoogleCredentials(request: Request): Promise<GoogleCredentials | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const credentials = session.get("googleCredentials");
  return credentials || null;
}

export async function setGoogleCredentials(
  request: Request,
  credentials: GoogleCredentials
): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  session.set("googleCredentials", credentials);
  return commitSession(session);
}

export async function clearGoogleCredentials(request: Request): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  session.unset("googleCredentials");
  return commitSession(session);
}

export { getSession, commitSession, destroySession }; 