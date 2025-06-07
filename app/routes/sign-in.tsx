import { Form, useActionData, useNavigation, useNavigate, useLoaderData, redirect } from "@remix-run/react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useState, useEffect } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { auth, signInWithEmailAndPassword, isAuthenticated, sendEmailVerification } from "~/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Mail, Loader2 } from "lucide-react";

type ActionData = {
  error?: string;
  email?: string;
  needsVerification?: boolean;
  verificationSent?: boolean;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") || "/";
  
  // Prevent redirect loops by checking if redirectTo is sign-in
  if (redirectTo === '/sign-in') {
    return json({ redirectTo: '/' });
  }
  
  // If user is already authenticated, redirect them
  const isUserAuthenticated = await isAuthenticated();
  if (isUserAuthenticated) {
    return redirect(redirectTo);
  }

  return json({ redirectTo });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const intent = formData.get("intent") as string;
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") || "/";

  console.log("Sign in attempt for email:", email);

  // Handle resend verification email
  if (intent === "resendVerification") {
    try {
      // Try to sign in first to get the user
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user && !user.emailVerified) {
        await sendEmailVerification(user);
        // Sign out after sending verification email
        await auth.signOut();
        return json<ActionData>({
          email,
          needsVerification: true,
          verificationSent: true,
          error: "Verification email sent! Please check your inbox and spam folder."
        });
      } else if (user?.emailVerified) {
        return json<ActionData>({
          error: "Your email is already verified. Please try signing in again."
        });
      }
    } catch (error: any) {
      console.error("Error in resend verification:", error);
      // If sign in fails, return appropriate error
      if (error.code === "auth/wrong-password") {
        return json<ActionData>({
          error: "Incorrect password. Please try again.",
          email
        });
      }
      return json<ActionData>({
        error: "Failed to send verification email. Please try signing in again.",
        email
      });
    }
  }

  if (!email || !password) {
    return json<ActionData>(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  try {
    // Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Sign in successful for:", {
      email: userCredential.user.email,
      emailVerified: userCredential.user.emailVerified,
      uid: userCredential.user.uid
    });

    // Verify the sign-in was successful
    const isUserAuthenticated = await isAuthenticated();
    console.log("Is user authenticated:", isUserAuthenticated);

    if (!isUserAuthenticated) {
      throw new Error("Authentication failed after sign in");
    }

    // Check if the user is actually verified
    const currentUser = auth.currentUser;
    console.log("Current user after sign in:", currentUser ? {
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      uid: currentUser.uid
    } : "No current user");

    // Only check email verification if the user exists and is not verified
    if (currentUser && !currentUser.emailVerified) {
      console.log("User email not verified, signing out");
      await auth.signOut();
      const newLocal = "Please verify your email before signing in. Check your inbox for the verification link.";
      return json<ActionData>({
        email,
        needsVerification: true,
        error: newLocal
      });
    }

    // If we get here, either the user is verified or we don't need to check
    console.log("Sign in successful, redirecting to:", redirectTo);
    return redirect(redirectTo);
  } catch (error: any) {
    console.error("Sign in error:", error);
    let errorMessage = "Failed to sign in";
    
    // Handle specific Firebase auth errors
    switch (error.code) {
      case "auth/invalid-email":
        errorMessage = "Invalid email address";
        break;
      case "auth/user-disabled":
        errorMessage = "This account has been disabled";
        break;
      case "auth/user-not-found":
        errorMessage = "No account found with this email";
        break;
      case "auth/wrong-password":
        errorMessage = "Incorrect password";
        break;
      case "auth/too-many-requests":
        errorMessage = "Too many failed attempts. Please try again later";
        break;
      case "auth/email-already-in-use":
        errorMessage = "This email is already registered";
        break;
    }

    return json<ActionData>(
      { 
        error: errorMessage,
        email 
      },
      { status: 400 }
    );
  }
}

export default function SignIn() {
  const actionData = useActionData<ActionData>();
  const { redirectTo } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleResendVerification = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResending(true);
    const formData = new FormData();
    formData.append("intent", "resendVerification");
    formData.append("email", actionData?.email || "");
    formData.append("password", (document.querySelector('input[name="password"]') as HTMLInputElement)?.value || "");
    
    try {
      const response = await fetch("/sign-in", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to send verification email");
      }
    } catch (err) {
      setError("Failed to send verification email. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed:", user ? {
        email: user.email,
        emailVerified: user.emailVerified,
        uid: user.uid
      } : "No user");

      if (mounted && user && !isRedirecting) {
        // Only redirect if the user is verified or if we don't need to check verification
        if (user.emailVerified) {
          console.log("User is verified, redirecting to:", redirectTo);
          setIsRedirecting(true);
          navigate(redirectTo);
        } else {
          console.log("User is not verified, staying on sign-in page");
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [navigate, redirectTo, isRedirecting]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D24] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-8">
            <img
              src="/logo.svg"
              alt="Shadow Access Hunter Logo"
              className="h-36 w-auto"
            />
          </div>
          <h2 className="mt-8 text-center text-3xl font-extrabold text-white">
            Sign in to your account
          </h2>
        </div>
        <Form method="post" className="mt-8 space-y-6">
          {(error || actionData?.error) && (
            <div className={`rounded-md p-4 ${
              actionData?.needsVerification 
                ? "bg-yellow-500/10 border border-yellow-500/20" 
                : "bg-red-500/10 border border-red-500/20"
            }`}>
              <div className={`text-sm ${
                actionData?.needsVerification ? "text-yellow-400" : "text-red-400"
              }`}>
                <div className="flex items-start gap-2">
                  <Mail className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    {error || actionData?.error}
                    {actionData?.needsVerification && !actionData?.verificationSent && (
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResendVerification}
                          disabled={isResending}
                          className="w-full mt-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20"
                        >
                          {isResending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4 mr-2" />
                              Resend Verification Email
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    {actionData?.verificationSent && (
                      <div className="mt-2 text-sm">
                        <p className="text-green-400">
                          ✓ Verification email sent successfully!
                        </p>
                        <p className="mt-1 text-yellow-400/80">
                          Please check your inbox and spam folder. Click the verification link to continue.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
                defaultValue={actionData?.email}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
} 