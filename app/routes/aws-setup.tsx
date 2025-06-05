import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";

interface LoaderData {
  status: "success" | "error";
  message: string;
  details?: any;
  error?: string;
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const response = await fetch(`${baseUrl}/api/verify-aws`);
    return json(await response.json());
  } catch (error: any) {
    return json({
      status: "error",
      message: "Failed to verify AWS credentials",
      error: error.message
    });
  }
};

export default function AWSSetup() {
  const data = useLoaderData<LoaderData>();

  return (
    <div className="p-8 pt-6 w-full max-w-full min-h-screen bg-[#181C23]">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">AWS Setup Verification</h1>

        {/* Status Card */}
        <div className={`rounded-xl p-6 mb-8 ${
          data.status === "success" 
            ? "bg-green-900/20 border border-green-500/20" 
            : "bg-red-900/20 border border-red-500/20"
        }`}>
          <div className="flex items-center gap-3 mb-4">
            {data.status === "success" ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}
            <h2 className="text-xl font-semibold text-white">
              {data.status === "success" ? "AWS Credentials Valid" : "AWS Credentials Invalid"}
            </h2>
          </div>
          <p className="text-gray-300 mb-4">{data.message}</p>
          {data.error && (
            <div className="bg-black/20 rounded-lg p-4 text-red-300 text-sm font-mono">
              {data.error}
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="bg-[#1a1f28] rounded-xl p-6 border border-[#23272f]">
          <h2 className="text-xl font-semibold text-white mb-4">Setup Instructions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-2">1. Get AWS Credentials</h3>
              <ol className="list-decimal list-inside text-gray-300 space-y-2 ml-4">
                <li>Log in to <a href="https://console.aws.amazon.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">AWS Console</a></li>
                <li>Click your username in the top right</li>
                <li>Select "Security credentials"</li>
                <li>Under "Access keys", click "Create access key"</li>
                <li>Save your Access Key ID and Secret Access Key</li>
              </ol>
            </div>

            <div>
              <h3 className="text-lg font-medium text-white mb-2">2. Get AWS Region</h3>
              <p className="text-gray-300 ml-4">
                Look at the top right of your AWS Console for the region name (e.g., "us-east-1")
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-white mb-2">3. Create .env File</h3>
              <div className="bg-black/20 rounded-lg p-4 text-gray-300 text-sm font-mono ml-4">
                AWS_ACCESS_KEY_ID=your_access_key_id_here<br />
                AWS_SECRET_ACCESS_KEY=your_secret_access_key_here<br />
                AWS_REGION=your_region_here
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-white mb-2">4. Restart Server</h3>
              <p className="text-gray-300 ml-4">
                After creating the .env file, restart your development server for the changes to take effect
              </p>
            </div>
          </div>
        </div>

        {/* Current Status */}
        {data.details && (
          <div className="mt-8 bg-[#1a1f28] rounded-xl p-6 border border-[#23272f]">
            <h2 className="text-xl font-semibold text-white mb-4">Current Status</h2>
            <div className="space-y-2">
              {Object.entries(data.details).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-gray-400">{key}:</span>
                  <span className="text-white font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 