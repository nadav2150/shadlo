import { useState } from "react";
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
  Trash2
} from "lucide-react";
import { Button } from "~/components/ui";
import { Modal } from "~/components/ui/modal";
import { AwsCredentialsForm } from "~/components/AwsCredentialsForm";
import { getAwsCredentials, setAwsCredentials, clearAwsCredentials } from "~/utils/session.server";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export const loader: LoaderFunction = async ({ request }) => {
  const credentials = await getAwsCredentials(request);
  return json({ credentials });
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

  // Handle disconnect action
  if (intent === "disconnect") {
    const cookieHeader = await clearAwsCredentials(request);
    return json(
      { success: true, message: "AWS credentials disconnected successfully" },
      {
        headers: {
          "Set-Cookie": cookieHeader
        }
      }
    );
  }

  // Handle connect/update action
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

    // Save credentials to session
    const cookieHeader = await setAwsCredentials(request, {
      accessKeyId,
      secretAccessKey,
      region,
    });

    if (!cookieHeader) {
      throw new Error("Failed to save credentials to session");
    }

    // Return success with account details and the Set-Cookie header
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
};

interface ProviderCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  isConnected: boolean;
  onConnect: () => void;
  onManage?: () => void;
  onDisconnect?: () => void;
  accountDetails?: {
    accountId?: string;
    arn?: string;
  };
}

function ProviderCard({ 
  name, 
  description, 
  icon, 
  isConnected, 
  onConnect, 
  onManage,
  onDisconnect,
  accountDetails 
}: ProviderCardProps) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const isComingSoon = name === "Azure" || name === "Okta";

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-white/5 rounded-lg">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{name}</h3>
              {isComingSoon ? (
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded-full">
                  Coming Soon
                </span>
              ) : isConnected && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
                  Connected
                </span>
              )}
            </div>
            <p className="text-gray-400 mt-1">{description}</p>
            {isConnected && accountDetails?.accountId && (
              <div className="mt-2 text-sm text-gray-400">
                <p>Account ID: {accountDetails.accountId}</p>
                {accountDetails.arn && (
                  <p className="truncate max-w-[200px]" title={accountDetails.arn}>
                    ARN: {accountDetails.arn}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Button
              onClick={onManage}
              variant="outline"
              size="sm"
              className="text-blue-400 hover:text-blue-300"
              title="Manage AWS Connection"
            >
              <Settings className="w-4 h-4" />
            </Button>
          ) : !isComingSoon && (
            <Button
              onClick={onConnect}
              className="flex items-center gap-2"
            >
              Connect
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProvidersPage() {
  const { credentials } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [selectedProvider, setSelectedProvider] = useState<"aws" | "azure" | "okta" | "gsuite" | null>(null);
  const [isManaging, setIsManaging] = useState(false);

  const handleConnect = (provider: "aws" | "azure" | "okta" | "gsuite") => {
    setSelectedProvider(provider);
    setIsManaging(false);
  };

  const handleManage = (provider: "aws" | "azure" | "okta" | "gsuite") => {
    setSelectedProvider(provider);
    setIsManaging(true);
  };

  const handleDisconnect = async () => {
    const formData = new FormData();
    formData.append("intent", "disconnect");
    
    const response = await fetch("/providers", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      window.location.reload();
    }
  };

  const handleClose = () => {
    setSelectedProvider(null);
    setIsManaging(false);
  };

  const handleSuccess = () => {
    setSelectedProvider(null);
    setIsManaging(false);
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-xl p-6 border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">Cloud Providers</h1>
        <p className="text-gray-300 text-lg">
          Monitor and manage your cloud security posture across all platforms
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ProviderCard
          name="AWS"
          description="Connect your AWS account to manage IAM permissions and access."
          icon={
            <img 
              src="/amazon-aws.svg" 
              alt="AWS"
              className="w-12 invert brightness-0"
            />
          }
          isConnected={!!credentials?.accessKeyId}
          onConnect={() => handleConnect("aws")}
          onManage={() => handleManage("aws")}
          onDisconnect={handleDisconnect}
          accountDetails={credentials ? {
            accountId: credentials.accountId,
            arn: credentials.arn
          } : undefined}
        />
        <ProviderCard
          name="Azure"
          description="Connect your Azure account to manage role assignments and access."
          icon={
            <img 
              src="/microsoft-azure.svg" 
              alt="Azure"
              className="w-12 invert brightness-0"
            />
          }
          isConnected={false}
          onConnect={() => handleConnect("azure")}
        />
        <ProviderCard
          name="Okta"
          description="Connect your Okta organization to manage user access and groups."
          icon={
            <img 
              src="/okta.svg" 
              alt="Okta"
              className="w-12 invert brightness-0"
            />
          }
          isConnected={false}
          onConnect={() => handleConnect("okta")}
        />
        <ProviderCard
          name="G Suite"
          description="Connect your Google Workspace to manage user permissions and security settings."
          icon={
            <img 
              src="/google-workspace.svg" 
              alt="G Suite"
              className="w-16 invert brightness-0"
            />
          }
          isConnected={false}
          onConnect={() => handleConnect("gsuite")}
        />
      </div>

      <Modal
        isOpen={!!selectedProvider}
        onClose={handleClose}
        title={isManaging ? `Manage ${selectedProvider?.toUpperCase()}` : `Connect ${selectedProvider?.toUpperCase()}`}
      >
        {selectedProvider === "aws" && (
          <AwsCredentialsForm
            onSuccess={handleSuccess}
            onCancel={handleClose}
            initialCredentials={isManaging ? credentials : undefined}
            onDisconnect={handleDisconnect}
          />
        )}
        {selectedProvider === "azure" && (
          <div className="p-4 text-center text-gray-400">
            Azure integration coming soon...
          </div>
        )}
        {selectedProvider === "okta" && (
          <div className="p-4 text-center text-gray-400">
            Okta integration coming soon...
          </div>
        )}
        {selectedProvider === "gsuite" && (
          <div className="p-4 text-center text-gray-400">
            Google Workspace integration coming soon...
          </div>
        )}
      </Modal>
    </div>
  );
} 