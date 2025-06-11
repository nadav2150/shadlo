import { createCookieSessionStorage } from "@remix-run/node";

// Define the session data type
interface SessionData {
  awsCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  gsuiteCredentials?: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
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
  
  const session = await getSession(cookieHeader);
  
  const credentials = session.get("awsCredentials");
  
  return credentials;
}

export async function setAwsCredentials(
  request: Request,
  credentials: SessionData["awsCredentials"]
) {
  if (!credentials) {
    return null;
  }


  
  const session = await getSession(request.headers.get("Cookie"));
  session.set("awsCredentials", credentials);
  
  const cookieHeader = await commitSession(session);
  
  return cookieHeader;
}

export async function clearAwsCredentials(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  session.unset("awsCredentials");
  return commitSession(session);
}

// Helper functions to manage GSuite credentials in session
export async function getGSuiteCredentials(request: Request) {
  const cookieHeader = request.headers.get("Cookie");

  
  const session = await getSession(cookieHeader);

  
  const credentials = session.get("gsuiteCredentials");

  
  return credentials;
}

export async function setGSuiteCredentials(
  request: Request,
  credentials: SessionData["gsuiteCredentials"]
) {
  if (!credentials) {
    return null;
  }


  
  const session = await getSession(request.headers.get("Cookie"));
  session.set("gsuiteCredentials", credentials);
  
  const cookieHeader = await commitSession(session);
  
  return cookieHeader;
}

export async function clearGSuiteCredentials(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  session.unset("gsuiteCredentials");
  return commitSession(session);
}

export { getSession, commitSession, destroySession }; 