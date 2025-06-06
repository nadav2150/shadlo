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
            <span>AWS credentials validated successfully!</span>
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
      <Form method="post" className="space-y-4">
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
            required={!initialCredentials?.accessKeyId}
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

        {/* Form Actions */}
        {!isEditing && (
          <div className="flex justify-between items-center pt-4">
            {/* Disconnect Button (shown when viewing existing credentials) */}
            {initialCredentials?.accessKeyId && onDisconnect && (
              <Form method="post">
                <input type="hidden" name="intent" value="disconnect" />
                <Button
                  type="submit"
                  variant="ghost"
                  className="text-red-500 hover:text-red-600 border border-red-500 hover:border-red-600"
                  disabled={isSubmitting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </Form>
            )}
            <Button
              type="button"
              onClick={() => setIsEditing(true)}
              variant="outline"
              className="text-blue-400 hover:text-blue-300 border-blue-400/50 hover:border-blue-300/50 hover:bg-blue-400/10"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Credentials
            </Button>
          </div>
        )}

        {isEditing && (
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
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
          </div>
        </div>
      </div>
    </div>
  );
} 