import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useActionData, Form } from "@remix-run/react";
import { json, redirect, type HeadersFunction } from "@remix-run/node";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { AlertCircle, CheckCircle, XCircle, Save, Edit2, X, Loader2 } from "lucide-react";
import { Button, Input, Label } from "~/components/ui";
import { getAwsCredentials, setAwsCredentials } from "~/utils/session.server";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

interface LoaderData {
  awsCredentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  } | null;
  status?: {
    type: "success" | "error";
    message: string;
  };
}

// Add validation function
async function validateAwsCredentials(accessKeyId: string, secretAccessKey: string, region: string) {
  try {
    const stsClient = new STSClient({
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region,
    });

    const command = new GetCallerIdentityCommand({});
    await stsClient.send(command);
    return { isValid: true };
  } catch (error) {
    console.error("AWS credentials validation failed:", error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : "Failed to validate AWS credentials" 
    };
  }
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Try to get credentials from session first
    const sessionCredentials = await getAwsCredentials(request);
    
    if (sessionCredentials) {
      return json({
        awsCredentials: {
          ...sessionCredentials,
          secretAccessKey: "••••••••••••••••", // Masked for security
        },
      });
    }

    // If no session data, return empty credentials
    return json({
      awsCredentials: {
        accessKeyId: "",
        secretAccessKey: "",
        region: "",
      },
    });
  } catch (error) {
    return json({
      awsCredentials: null,
      status: {
        type: "error",
        message: "Failed to load AWS credentials",
      },
    });
  }
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const accessKeyId = formData.get("accessKeyId")?.toString().trim();
  const secretAccessKey = formData.get("secretAccessKey")?.toString().trim();
  const region = formData.get("region")?.toString().trim();

  console.log("Debug - Form submission:", { 
    accessKeyId, 
    hasSecretKey: !!secretAccessKey, 
    region 
  });

  if (!accessKeyId || !region) {
    return json({
      status: {
        type: "error",
        message: "Access Key ID and Region are required",
      },
    });
  }

  // Only require secret key if it's being changed
  const existingCredentials = await getAwsCredentials(request);
  console.log("Debug - Existing credentials:", existingCredentials ? "Found" : "Not found");

  if (!existingCredentials?.secretAccessKey && !secretAccessKey) {
    return json({
      status: {
        type: "error",
        message: "Secret Access Key is required for new credentials",
      },
    });
  }

  // Validate credentials before saving
  const finalSecretKey = secretAccessKey || existingCredentials?.secretAccessKey || "";
  const validation = await validateAwsCredentials(accessKeyId, finalSecretKey, region);
  
  if (!validation.isValid) {
    return json({
      status: {
        type: "error",
        message: `Invalid AWS credentials: ${validation.error}`,
      },
    });
  }

  try {
    // Save credentials to session only if validation passed
    const cookieHeader = await setAwsCredentials(request, {
      accessKeyId,
      secretAccessKey: finalSecretKey,
      region,
    });

    console.log("Debug - Cookie header after save:", cookieHeader);

    if (!cookieHeader) {
      throw new Error("Failed to save credentials to session");
    }

    // Create the response with the cookie
    const response = json(
      {
        status: {
          type: "success",
          message: "AWS credentials saved successfully",
        },
        awsCredentials: {
          accessKeyId,
          secretAccessKey: "••••••••••••••••", // Masked for security
          region,
        },
      },
      { 
        headers: {
          "Set-Cookie": cookieHeader
        }
      }
    );

    // Log the response headers
    console.log("Debug - Response headers:", {
      setCookie: response.headers.get("Set-Cookie"),
      allHeaders: Object.fromEntries(response.headers.entries())
    });

    return response;
  } catch (error) {
    console.error("Error saving credentials:", error);
    return json({
      status: {
        type: "error",
        message: "Failed to save AWS credentials",
      },
    });
  }
};

export default function Settings() {
  const { awsCredentials: initialCredentials, status: initialStatus } = useLoaderData<LoaderData>();
  const actionData = useActionData<LoaderData>();
  const submit = useSubmit();
  const [isEditing, setIsEditing] = useState(!initialCredentials?.accessKeyId);
  const [formData, setFormData] = useState({
    accessKeyId: initialCredentials?.accessKeyId || "",
    secretAccessKey: "",
    region: initialCredentials?.region || "",
  });

  // Log initial state
  useEffect(() => {
    console.log("Debug - Initial credentials:", {
      hasInitialCredentials: !!initialCredentials,
      hasAccessKeyId: !!initialCredentials?.accessKeyId,
      isEditing,
      cookies: document.cookie
    });
  }, [initialCredentials, isEditing]);

  // Log when action data changes
  useEffect(() => {
    if (actionData) {
      console.log("Debug - Action data received:", {
        status: actionData.status,
        hasCredentials: !!actionData.awsCredentials,
        cookies: document.cookie
      });
    }
  }, [actionData]);

  // Update form data when action data changes
  useEffect(() => {
    if (actionData?.awsCredentials) {
      setFormData({
        accessKeyId: actionData.awsCredentials.accessKeyId,
        secretAccessKey: "",
        region: actionData.awsCredentials.region,
      });
      setIsEditing(false);
    }
  }, [actionData]);

  // Update form data when initial credentials change
  useEffect(() => {
    if (initialCredentials) {
      setFormData({
        accessKeyId: initialCredentials.accessKeyId,
        secretAccessKey: "",
        region: initialCredentials.region,
      });
    }
  }, [initialCredentials]);

  const handleEdit = () => {
    console.log("Edit button clicked");
    console.log("Current isEditing state:", isEditing);
    setIsEditing(true);
    console.log("New isEditing state:", true);
    // Keep existing values but clear the secret key
    setFormData({
      ...formData,
      secretAccessKey: "",
    });
    console.log("Form data updated:", { ...formData, secretAccessKey: "" });
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to initial values
    setFormData({
      accessKeyId: initialCredentials?.accessKeyId || "",
      secretAccessKey: "",
      region: initialCredentials?.region || "",
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // If we're editing and the secret key is empty, don't include it
    if (isEditing && !formData.get("secretAccessKey")) {
      formData.delete("secretAccessKey");
    }
    
    console.log("Debug - Submitting form:", {
      accessKeyId: formData.get("accessKeyId"),
      hasSecretKey: !!formData.get("secretAccessKey"),
      region: formData.get("region"),
      cookies: document.cookie
    });
    
    submit(formData, { method: "post" });
  };

  // Use action data status if available, otherwise use initial status
  const status = actionData?.status || initialStatus;

  return (
    <div className="p-8 pt-6 w-full max-w-full min-h-screen bg-[#181C23]">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">AWS Settings</h1>
          {!isEditing && initialCredentials?.accessKeyId && (
            <button
              type="button"
              onClick={() => {
                console.log("Button clicked - Debug");
                handleEdit();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4 py-2 rounded-md"
            >
              <Edit2 className="w-4 h-4" />
              Edit Credentials
            </button>
          )}
        </div>

        {/* Status Message */}
        {status && (
          <div className={`rounded-xl p-6 mb-8 ${
            status.type === "success" 
              ? "bg-green-900/20 border border-green-500/20" 
              : "bg-red-900/20 border border-red-500/20"
          }`}>
            <div className="flex items-center gap-3">
              {status.type === "success" ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <p className="text-white">{status.message}</p>
            </div>
          </div>
        )}

        {/* AWS Credentials Form */}
        <div className="bg-[#1a1f28] rounded-xl p-6 border border-[#23272f]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">AWS Credentials</h2>
            {isEditing && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-400 bg-blue-900/20 px-3 py-1 rounded-full">
                  Editing Mode
                </span>
              </div>
            )}
          </div>

          <Form method="post" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="accessKeyId" className="text-gray-300">
                  AWS Access Key ID
                </Label>
                <Input
                  id="accessKeyId"
                  name="accessKeyId"
                  value={formData.accessKeyId}
                  onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
                  disabled={!isEditing}
                  className={`mt-1 bg-[#23272f] border-[#2d333b] text-white ${
                    !isEditing ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                  placeholder="Enter your AWS Access Key ID"
                  required
                />
              </div>

              <div>
                <Label htmlFor="secretAccessKey" className="text-gray-300">
                  AWS Secret Access Key
                </Label>
                <Input
                  id="secretAccessKey"
                  name="secretAccessKey"
                  type="password"
                  value={formData.secretAccessKey}
                  onChange={(e) => setFormData({ ...formData, secretAccessKey: e.target.value })}
                  disabled={!isEditing}
                  className={`mt-1 bg-[#23272f] border-[#2d333b] text-white ${
                    !isEditing ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                  placeholder={isEditing ? "Enter your AWS Secret Access Key" : "••••••••••••••••"}
                  required={!initialCredentials?.accessKeyId} // Only required for new credentials
                />
              </div>

              <div>
                <Label htmlFor="region" className="text-gray-300">
                  AWS Region
                </Label>
                <Input
                  id="region"
                  name="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  disabled={!isEditing}
                  className={`mt-1 bg-[#23272f] border-[#2d333b] text-white ${
                    !isEditing ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                  placeholder="Enter your AWS Region (e.g., us-east-1)"
                  required
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-4 pt-4 border-t border-[#23272f]">
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Credentials
                </Button>
                <Button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              </div>
            )}
          </Form>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-[#23272f] rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-white mb-2">How to get your AWS credentials:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Log in to the <a href="https://console.aws.amazon.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">AWS Console</a></li>
                  <li>Click your username in the top right</li>
                  <li>Select "Security credentials"</li>
                  <li>Under "Access keys", click "Create access key"</li>
                  <li>Save your Access Key ID and Secret Access Key</li>
                  <li>For Region, use the region code from the top right of your AWS Console (e.g., us-east-1)</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 