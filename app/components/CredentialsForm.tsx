import { useState } from "react";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { Button, Input, Label } from "~/components/ui";
import { Loader2 } from "lucide-react";

interface CredentialsFormProps {
  provider: "AWS" | "Azure" | "Okta";
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CredentialsForm({ provider, onSuccess, onCancel }: CredentialsFormProps) {
  const [isEditing, setIsEditing] = useState(true);
  const actionData = useActionData<{ status?: { type: "success" | "error"; message: string } }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // If we're editing and the secret key is empty, don't include it
    if (isEditing && !formData.get("secretAccessKey")) {
      formData.delete("secretAccessKey");
    }
    
    const response = await fetch(`/api/verify-${provider.toLowerCase()}`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    
    if (data.status === "success") {
      onSuccess?.();
    }
  };

  return (
    <Form method="post" onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="accessKeyId">Access Key ID</Label>
          <Input
            id="accessKeyId"
            name="accessKeyId"
            type="text"
            required
            placeholder="Enter your access key ID"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="secretAccessKey">Secret Access Key</Label>
          <Input
            id="secretAccessKey"
            name="secretAccessKey"
            type="password"
            required={!isEditing}
            placeholder={isEditing ? "Leave blank to keep existing" : "Enter your secret access key"}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="region">Region</Label>
          <Input
            id="region"
            name="region"
            type="text"
            required
            placeholder="Enter your region (e.g., us-east-1)"
            className="mt-1"
          />
        </div>
      </div>

      {actionData?.status && (
        <div className={`p-4 rounded-lg ${
          actionData.status.type === "success" 
            ? "bg-green-900/20 text-green-400" 
            : "bg-red-900/20 text-red-400"
        }`}>
          {actionData.status.message}
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
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </Form>
  );
} 