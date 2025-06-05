import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { IAMClient, GetUserCommand } from "@aws-sdk/client-iam";
import { env } from "~/utils/env.server";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Initialize the IAM client with validated environment variables
    const iamClient = new IAMClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
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
        region: env.AWS_REGION
      }
    });
  } catch (error: any) {
    console.error("AWS Credential verification failed:", error);
    
    // Check for specific AWS errors
    if (error.name === "InvalidClientTokenId") {
      return json({
        status: "error",
        message: "Invalid AWS Access Key ID",
        error: error.message
      }, { status: 401 });
    }
    
    if (error.name === "SignatureDoesNotMatch") {
      return json({
        status: "error",
        message: "Invalid AWS Secret Access Key",
        error: error.message
      }, { status: 401 });
    }

    if (error.name === "UnrecognizedClientException") {
      return json({
        status: "error",
        message: "Invalid AWS Region",
        error: error.message
      }, { status: 400 });
    }

    return json({
      status: "error",
      message: "Failed to verify AWS credentials",
      error: error.message
    }, { status: 500 });
  }
}; 