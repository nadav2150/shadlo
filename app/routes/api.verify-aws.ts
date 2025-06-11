import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { IAMClient, GetUserCommand } from "@aws-sdk/client-iam";
import { getCurrentUser, getAwsCredentials } from "~/lib/firebase";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get current user
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.email) {
      return json({
        status: "error",
        message: "User not authenticated",
        redirectTo: "/sign-in"
      }, { status: 401 });
    }

    // Get AWS credentials from database
    const awsCredentialsData = await getAwsCredentials(currentUser.email);
    
    if (!awsCredentialsData || !awsCredentialsData.accessKeyId || !awsCredentialsData.secretAccessKey || !awsCredentialsData.region) {
      return json({
        status: "error",
        message: "AWS credentials not found. Please add your credentials in the Settings page.",
        redirectTo: "/settings"
      }, { status: 401 });
    }

    // Initialize the IAM client with database credentials
    const iamClient = new IAMClient({
      region: awsCredentialsData.region,
      credentials: {
        accessKeyId: awsCredentialsData.accessKeyId,
        secretAccessKey: awsCredentialsData.secretAccessKey,
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
        region: awsCredentialsData.region
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