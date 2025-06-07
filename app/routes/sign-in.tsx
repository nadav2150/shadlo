import { Form, useActionData, useNavigation, useNavigate, useLoaderData, redirect } from "@remix-run/react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useState, useEffect } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { auth, signInWithEmailAndPassword, isAuthenticated } from "~/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type ActionData = {
  error?: string;
  email?: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Allow access to sign-in page regardless of auth state
  return json({ user: null });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return json<ActionData>(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  try {
    // Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Sign in successful for:", userCredential.user.email);

    // Verify the sign-in was successful
    const isUserAuthenticated = await isAuthenticated();
    if (!isUserAuthenticated) {
      throw new Error("Authentication failed after sign in");
    }

    return redirect("/");
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
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already signed in
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("SignIn component - Auth state changed:", user ? "User logged in" : "No user");
      // Only redirect if we have a confirmed authenticated user
      if (user && user.emailVerified) {
        navigate("/");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D24] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to your account
          </h2>
        </div>
        <Form method="post" className="mt-8 space-y-6">
          {(error || actionData?.error) && (
            <div className="rounded-md bg-red-500/10 p-4">
              <div className="text-sm text-red-400">{error || actionData?.error}</div>
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

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-600 bg-[#2A2F3A] text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Button
                variant="link"
                className="text-blue-500 hover:text-blue-400"
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: Implement forgot password
                }}
              >
                Forgot your password?
              </Button>
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