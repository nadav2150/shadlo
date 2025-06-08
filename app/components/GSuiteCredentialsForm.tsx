import { useState } from "react";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { Button, Input, Label } from "~/components/ui";
import { Loader2, ExternalLink } from "lucide-react";

interface GSuiteCredentialsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  onDisconnect?: () => void;
}

export function GSuiteCredentialsForm({ 
  onSuccess, 
  onCancel,
  onDisconnect 
}: GSuiteCredentialsFormProps) {
  const actionData = useActionData<{ 
    error?: string; 
    success?: boolean;
    authUrl?: string;
    message?: string;
  }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showAuthUrl, setShowAuthUrl] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // Debug logs
    console.log("Form submitted with data:", {
      clientId: event.currentTarget.clientId.value,
      clientSecret: event.currentTarget.clientSecret.value,
      provider: event.currentTarget.provider.value
    });
  };

  // Debug logs for action data
  console.log("Action data:", actionData);
  console.log("Navigation state:", navigation.state);

  if (actionData?.success && actionData.authUrl) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-green-900/20 text-green-400">
          {actionData.message}
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Click the button below to authorize access to your Google Workspace:
          </p>
          
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={() => window.open(actionData.authUrl, '_blank')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Authorize Google Workspace
            </Button>
          </div>

          <div className="text-center">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="mt-4"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-400">
        <p>To connect your Google Workspace account, you'll need to:</p>
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li>Have admin access to your Google Workspace organization</li>
          <li>Create OAuth 2.0 credentials in the Google Cloud Console</li>
          <li>Grant necessary permissions to manage users and groups</li>
        </ol>
      </div>

      <Form 
        method="post" 
        onSubmit={handleSubmit} 
        className="space-y-6"
        action="/providers"
      >
        <input type="hidden" name="intent" value="connect" />
        <input type="hidden" name="provider" value="gsuite" />
        <div className="space-y-4">
          <div>
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              name="clientId"
              type="text"
              required
              placeholder="Enter your OAuth 2.0 Client ID"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              name="clientSecret"
              type="password"
              required
              placeholder="Enter your OAuth 2.0 Client Secret"
              className="mt-1"
            />
          </div>
        </div>

        {actionData?.error && (
          <div className="p-4 rounded-lg bg-red-900/20 text-red-400">
            {actionData.error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              "Validate Credentials"
            )}
          </Button>
        </div>
      </Form>
    </div>
  );
} 