import { useState, useEffect } from "react";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { AlertCircle, Edit2, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Button, Input, Label } from "~/components/ui";

interface AwsCredentialsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialCredentials?: {
    accessKeyId: string;
    secretAccessKey?: string;
    region: string;
    accountId?: string;
    arn?: string;
  };
  onDisconnect?: () => void;
}

type ActionData = {
  success?: boolean;
  error?: string;
  accountId?: string;
  arn?: string;
  userId?: string;
};

export function AwsCredentialsForm({ onSuccess, onCancel, initialCredentials, onDisconnect }: AwsCredentialsFormProps) {
  const [isEditing, setIsEditing] = useState(!initialCredentials?.accessKeyId);
  const [formData, setFormData] = useState({
    accessKeyId: initialCredentials?.accessKeyId || "",
    secretAccessKey: "",
    region: initialCredentials?.region || "",
  });
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.success) {
      setIsEditing(false);
      onSuccess?.();
    }
  }, [actionData, onSuccess]);

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

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {actionData?.error && (
        <div className="p-4 bg-red-900/20 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-5 h-5" />
            <span>{actionData.error}</span>
          </div>
        </div>
      )}
      
      {actionData?.success && (
        <div className="p-4 bg-green-900/20 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span>AWS credentials saved successfully!</span>
          </div>
          {actionData.accountId && (
            <div className="mt-2 text-sm text-gray-300">
              <p>Account ID: {actionData.accountId}</p>
              <p>User ARN: {actionData.arn}</p>
            </div>
          )}
        </div>
      )}

      {/* Current Account Info */}
      {initialCredentials?.accountId && !isEditing && (
        <div className="p-4 bg-[#23272f] rounded-lg">
          <div className="text-sm text-gray-300">
            <p className="font-medium text-white mb-2">Current Account Information:</p>
            <p>Account ID: {initialCredentials.accountId}</p>
            {initialCredentials.arn && (
              <p className="truncate" title={initialCredentials.arn}>
                ARN: {initialCredentials.arn}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      <Form method="post" className="space-y-6">
        <input type="hidden" name="provider" value="aws" />
        
        {!isEditing && initialCredentials?.accessKeyId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-white">AWS Connected</h3>
                <p className="text-sm text-gray-400">Credentials stored securely in database</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Update Credentials
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  name="intent"
                  value="disconnect"
                  onClick={onDisconnect}
                  className="text-red-500 hover:text-red-600 border-red-500 hover:border-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Connect AWS Account</h3>
              <p className="text-sm text-gray-400">
                Enter your AWS credentials to connect your account
              </p>
            </div>
            
            <div>
              <Label htmlFor="accessKeyId" className="text-gray-300">
                AWS Access Key ID
              </Label>
              <Input
                id="accessKeyId"
                name="accessKeyId"
                value={formData.accessKeyId}
                onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
                className="mt-1 bg-[#23272f] border-[#2d333b] text-white"
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
                className="mt-1 bg-[#23272f] border-[#2d333b] text-white"
                placeholder="Enter your AWS Secret Access Key"
                required
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
                className="mt-1 bg-[#23272f] border-[#2d333b] text-white"
                placeholder="Enter your AWS Region (e.g., us-east-1)"
                required
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⟳</span>
                    Validating...
                  </>
                ) : (
                  initialCredentials?.accessKeyId ? "Update Credentials" : "Validate & Save"
                )}
              </Button>
            </div>
          </div>
        )}
      </Form>

      {/* Help Text */}
      <div className="p-4 bg-[#23272f] rounded-lg">
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
            <p className="mt-2 text-xs text-gray-400">
              Your credentials are stored securely in our database and encrypted at rest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 