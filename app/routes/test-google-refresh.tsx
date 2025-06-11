import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";

export const loader: LoaderFunction = async ({ request }) => {
  return json({ message: "Test page loaded" });
};

export default function TestGoogleRefresh() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const fetcher = useFetcher();

  const handleTestRefreshToken = async () => {
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/google-users-refresh?email=${encodeURIComponent(email.trim())}`);
      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Google Refresh Token API Test</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">How it works:</h2>
        <ul className="text-blue-700 space-y-1">
          <li>• Enter the email address of the user who has authenticated with Google</li>
          <li>• Fetches the Google refresh token from the user's Firestore document</li>
          <li>• Uses the refresh token to get a new access token from Google</li>
          <li>• Makes API calls to Google Admin SDK to fetch users list</li>
          <li>• Returns the users with risk assessment data</li>
        </ul>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              User Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleTestRefreshToken}
            disabled={isLoading || !email.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {isLoading ? 'Testing...' : 'Test Refresh Token API'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error:</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">Success!</h3>
              <p className="text-green-700">{result.message}</p>
              <p className="text-green-700">Users found: {result.userCount}</p>
              {result.tokenInfo && (
                <div className="mt-2">
                  <p className="text-green-700">
                    Access token expires in: {result.tokenInfo.accessTokenExpiresIn} seconds
                  </p>
                </div>
              )}
            </div>

            {result.users && result.users.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Users List (First 5):</h3>
                <div className="space-y-2">
                  {result.users.slice(0, 5).map((user: any, index: number) => (
                    <div key={user.id} className="border border-gray-100 rounded p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{user.name.fullName}</p>
                          <p className="text-sm text-gray-600">{user.primaryEmail}</p>
                          <p className="text-xs text-gray-500">
                            Admin: {user.isAdmin ? 'Yes' : 'No'} | 
                            2FA: {user.isEnrolledIn2Sv ? 'Yes' : 'No'} |
                            Suspended: {user.suspended ? 'Yes' : 'No'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            user.riskAssessment?.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                            user.riskAssessment?.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {user.riskAssessment?.riskLevel || 'unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {result.users.length > 5 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Showing first 5 of {result.users.length} users
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">API Endpoint:</h3>
        <code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/google-users-refresh?email=user@example.com</code>
        
        <h4 className="text-md font-semibold text-gray-800 mt-4 mb-2">Response Format:</h4>
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "users": [...],
  "userCount": 42,
  "message": "Successfully fetched users using refresh token for user@example.com",
  "tokenInfo": {
    "accessTokenExpiresIn": 3600,
    "tokenType": "Bearer"
  }
}`}
        </pre>
      </div>
    </div>
  );
} 