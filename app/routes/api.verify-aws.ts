import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { IAMClient, GetUserCommand } from "@aws-sdk/client-iam";
import { getAwsCredentials } from "~/utils/session.server";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get AWS credentials from session
    const credentials = await getAwsCredentials(request);
    
    if (!credentials) {
      return json({
        status: "error",
        message: "AWS credentials not found. Please add your credentials in the Settings page.",
        redirectTo: "/settings"
      }, { status: 401 });
    }

    // Initialize the IAM client with session credentials
    const iamClient = new IAMClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    // Try to get the current user to verify credentials
    const command = new GetUserCommand({});
    const response = await iamClient.send(command);

    return json({
      status: "success",
      message: "AWS credentials are valid",
      details: {
        user: response.User?.UserName,
        arn: response.User?.Arn,
        region: credentials.region
      }
    });
  } catch (error: any) {
    console.error("AWS Credential verification failed:", error);
    
    // Check for specific AWS errors
    if (error.name === "InvalidClientTokenId") {
      return json({
        status: "error",
        message: "Invalid AWS Access Key ID. Please update your credentials in Settings.",
        redirectTo: "/settings"
      }, { status: 401 });
    }
    
    if (error.name === "SignatureDoesNotMatch") {
      return json({
        status: "error",
        message: "Invalid AWS Secret Access Key. Please update your credentials in Settings.",
        redirectTo: "/settings"
      }, { status: 401 });
    }

    if (error.name === "UnrecognizedClientException") {
      return json({
        status: "error",
        message: "Invalid AWS Region. Please update your region in Settings.",
        redirectTo: "/settings"
      }, { status: 400 });
    }

    return json({
      status: "error",
      message: "Failed to verify AWS credentials. Please check your credentials in Settings.",
      redirectTo: "/settings"
    }, { status: 500 });
  }
}; 