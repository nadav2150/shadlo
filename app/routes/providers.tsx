import { useState, useRef, useEffect } from "react";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { json, type LoaderFunction, type ActionFunction } from "@remix-run/node";
import { 
  Cloud, 
  Shield, 
  Key, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Settings,
  Trash2,
  Mail
} from "lucide-react";
import { Button } from "~/components/ui";
import { Modal } from "~/components/ui/modal";
import { AwsCredentialsForm } from "~/components/AwsCredentialsForm";
import { getAwsCredentials, setAwsCredentials, clearAwsCredentials } from "~/utils/session.server";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { getGoogleCredentials, clearGoogleCredentials, type GoogleCredentials } from "~/utils/session.google.server";

export const loader: LoaderFunction = async ({ request }) => {
  const awsCredentials = await getAwsCredentials(request);
  const googleCredentials = await getGoogleCredentials(request);
  
  return json({
    credentials: {
      aws: awsCredentials
    },
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleCredentials
  });
};

// Validation function
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
    const response = await stsClient.send(command);
    return { 
      isValid: true,
      accountId: response.Account,
      arn: response.Arn,
      userId: response.UserId
    };
  } catch (error) {
    console.error("AWS credentials validation failed:", error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : "Failed to validate AWS credentials" 
    };
  }
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();
  const provider = formData.get("provider")?.toString()?.toLowerCase();

  if (!provider) {
    return json(
      { error: "Provider is required" },
      { status: 400 }
    );
  }

  // Handle disconnect action
  if (intent === "disconnect") {
    if (provider === "aws") {
      const cookieHeader = await clearAwsCredentials(request);
      return json(
        { success: true, message: "AWS credentials disconnected successfully" },
        {
          headers: cookieHeader ? {
            "Set-Cookie": cookieHeader
          } : undefined
        }
      );
    } else if (provider === "google") {
      const cookieHeader = await clearGoogleCredentials(request);
      return json(
        { success: true, message: "Google credentials disconnected successfully" },
        {
          headers: cookieHeader ? {
            "Set-Cookie": cookieHeader
          } : undefined
        }
      );
    }
  }

  // Handle connect/update action
  if (provider === "aws") {
    const accessKeyId = formData.get("accessKeyId")?.toString();
    const secretAccessKey = formData.get("secretAccessKey")?.toString();
    const region = formData.get("region")?.toString();

    if (!accessKeyId || !secretAccessKey || !region) {
      return json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    try {
      const validationResult = await validateAwsCredentials(accessKeyId, secretAccessKey, region);
      if (!validationResult.isValid) {
        return json(
          { error: validationResult.error },
          { status: 400 }
        );
      }

      const cookieHeader = await setAwsCredentials(request, {
        accessKeyId,
        secretAccessKey,
        region,
      });

      if (!cookieHeader) {
        throw new Error("Failed to save credentials to session");
      }

      return json(
        { 
          success: true,
          accountId: validationResult.accountId,
          arn: validationResult.arn,
          userId: validationResult.userId
        },
        {
          headers: {
            "Set-Cookie": cookieHeader
          }
        }
      );
    } catch (error) {
      console.error("Error validating AWS credentials:", error);
      return json(
        { error: "Failed to validate credentials. Please try again." },
        { status: 500 }
      );
    }
  }

  return json(
    { error: `Invalid provider: ${provider}` },
    { status: 400 }
  );
};

interface ProviderCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  isConnected: boolean;
  onConnect?: () => void;
  onManage?: () => void;
  onDisconnect?: () => void;
  accountDetails?: {
    accountId?: string;
    arn?: string;
  };
}

function GoogleLoginButton({ onSuccess, onError }: { onSuccess: (response: any) => void, onError: () => void }) {
  const login = useGoogleLogin({
    onSuccess: (response) => onSuccess(response),
    onError: () => onError(),
    flow: 'implicit',
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => login()}
      className="flex items-center"
    >
      Connect
      <ArrowRight className="w-4 h-4 ml-2" />
    </Button>
  );
}

function ProviderCard({ 
  name, 
  description, 
  icon, 
  isConnected, 
  onConnect, 
  onManage,
  onDisconnect,
  accountDetails,
  customConnectButton
}: ProviderCardProps & { customConnectButton?: React.ReactNode }) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const isComingSoon = name === "Azure" || name === "Okta";

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-white/5 rounded-lg">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">{name}</h3>
            <p className="text-sm text-white/60 mt-1">{description}</p>
          </div>
        </div>
        {isConnected ? (
          <div className="flex items-center space-x-2">
            <span className="flex items-center text-sm text-green-400">
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Connected
            </span>
            {onManage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onManage}
                className="text-white/60 hover:text-white"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
            {onDisconnect && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDisconnectConfirm(true)}
                className="text-white/60 hover:text-white"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : (
          customConnectButton || (
            <Button
              variant="outline"
              size="sm"
              onClick={onConnect}
              disabled={isComingSoon}
              className={isComingSoon ? "opacity-50 cursor-not-allowed" : ""}
            >
              {isComingSoon ? "Coming Soon" : "Connect"}
              {!isComingSoon && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          )
        )}
      </div>

      <Modal
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        title={`Disconnect ${name}`}
      >
        <div className="p-6">
          <p className="text-white/80 mb-4">
            Are you sure you want to disconnect {name}? This will remove all associated credentials.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDisconnectConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
              onClick={() => {
                onDisconnect?.();
                setShowDisconnectConfirm(false);
              }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ProvidersPage() {
  const { credentials, googleClientId, googleCredentials: initialGoogleCredentials } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"aws" | "azure" | "okta" | "google">("aws");
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleConnect = (provider: "aws" | "azure" | "okta" | "google") => {
    setSelectedProvider(provider);
    setShowModal(true);
  };

  const handleManage = (provider: "aws" | "azure" | "okta" | "google") => {
    setSelectedProvider(provider);
    setShowModal(true);
  };

  const handleDisconnect = async () => {
    const formData = new FormData();
    formData.append("intent", "disconnect");
    formData.append("provider", selectedProvider);
    
    try {
      const response = await fetch("/providers", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to disconnect provider");
      }
      
      window.location.reload();
    } catch (error) {
      console.error("Error disconnecting provider:", error);
    }
  };

  const handleGoogleDisconnect = async () => {
    const formData = new FormData();
    formData.append("intent", "disconnect");
    formData.append("provider", "google");
    
    try {
      const response = await fetch("/providers", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to disconnect Google account");
      }
      
      window.location.reload();
    } catch (error) {
      console.error("Error disconnecting Google:", error);
    }
  };

  const handleClose = () => {
    setShowModal(false);
  };

  const handleSuccess = () => {
    setShowModal(false);
    window.location.reload();
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      console.log("Google login successful:", credentialResponse);
      
      // Send credentials to server
      const formData = new FormData();
      Object.entries(credentialResponse).forEach(([key, value]) => {
        if (value != null) {
          formData.append(key, String(value));
        }
      });

      const response = await fetch("/api/google/auth", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to process credentials");
      }

      if (data.error) {
        throw new Error(data.details || data.error);
      }

      setGoogleError(null);
      window.location.reload();
    } catch (error) {
      console.error("Error handling Google login:", error);
      setGoogleError(error instanceof Error ? error.message : "Failed to connect Google account");
    }
  };

  const handleGoogleError = () => {
    setGoogleError("Google login failed. Please try again.");
  };

  return (
    <GoogleOAuthProvider clientId={googleClientId || ""}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-8">Identity Providers</h1>
        
        {googleError && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {googleError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ProviderCard
            name="AWS"
            description="Connect your AWS account to manage IAM users and roles"
            icon={<Cloud className="w-6 h-6 text-blue-400" />}
            isConnected={!!credentials.aws}
            onConnect={() => handleConnect("aws")}
            onManage={() => handleManage("aws")}
            onDisconnect={handleDisconnect}
          />

          <ProviderCard
            name="Google"
            description="Connect your Google Workspace to manage users and groups"
            icon={<Mail className="w-6 h-6 text-red-400" />}
            isConnected={!!initialGoogleCredentials}
            onDisconnect={handleGoogleDisconnect}
            customConnectButton={
              !initialGoogleCredentials && (
                <GoogleLoginButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                />
              )
            }
          />

          <ProviderCard
            name="Azure"
            description="Connect your Azure AD to manage users and groups"
            icon={<Shield className="w-6 h-6 text-blue-500" />}
            isConnected={false}
            onConnect={() => handleConnect("azure")}
          />

          <ProviderCard
            name="Okta"
            description="Connect your Okta organization to manage users and groups"
            icon={<Key className="w-6 h-6 text-purple-400" />}
            isConnected={false}
            onConnect={() => handleConnect("okta")}
          />
        </div>

        <Modal
          isOpen={showModal}
          onClose={handleClose}
          title={credentials[selectedProvider] ? `Manage ${selectedProvider.toUpperCase()}` : `Connect ${selectedProvider.toUpperCase()}`}
        >
          {selectedProvider === "aws" && (
            <AwsCredentialsForm
              onSuccess={handleSuccess}
              onCancel={handleClose}
              initialCredentials={credentials.aws}
              onDisconnect={handleDisconnect}
            />
          )}
        </Modal>
      </div>
    </GoogleOAuthProvider>
  );
} 