import { createCookieSessionStorage } from "@remix-run/node";

// Define the session data type
interface SessionData {
  awsCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
}

// Create a session storage
const { getSession, commitSession, destroySession } = createCookieSessionStorage<SessionData>({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "default-secret-key-change-in-production"],
    secure: false, // Allow cookies in development
    maxAge: 60 * 60 * 24 * 7, // 1 week
    domain: undefined, // Let the browser handle the domain
  },
});

// Helper functions to manage AWS credentials in session
export async function getAwsCredentials(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  console.log("Debug - Request URL:", request.url);
  console.log("Debug - Cookie header:", cookieHeader);
  
  const session = await getSession(cookieHeader);
  console.log("Debug - Session data:", session.data);
  
  const credentials = session.get("awsCredentials");
  console.log("Debug - Retrieved credentials:", credentials ? "Found" : "Not found");
  
  return credentials;
}

export async function setAwsCredentials(
  request: Request,
  credentials: SessionData["awsCredentials"]
) {
  if (!credentials) {
    console.log("Debug - No credentials provided to set");
    return null;
  }

  console.log("Debug - Setting credentials:", { 
    accessKeyId: credentials.accessKeyId,
    region: credentials.region,
    hasSecretKey: !!credentials.secretAccessKey 
  });
  
  const session = await getSession(request.headers.get("Cookie"));
  session.set("awsCredentials", credentials);
  
  const cookieHeader = await commitSession(session);
  console.log("Debug - New cookie header:", cookieHeader);
  console.log("Debug - Request URL when setting:", request.url);
  
  return cookieHeader;
}

export async function clearAwsCredentials(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  session.unset("awsCredentials");
  return commitSession(session);
}

export { getSession, commitSession, destroySession }; 