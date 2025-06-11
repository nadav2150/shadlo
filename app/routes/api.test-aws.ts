import { json } from "@remix-run/node";
import { getCurrentUser, getAwsCredentials } from "~/lib/firebase";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export async function loader({ request }: { request: Request }) {
  try {
    console.log("Test AWS API: Starting request");
    
    // Get current user
    const currentUser = await getCurrentUser();
    console.log("Test AWS API: Current user:", currentUser?.email);
    
    if (!currentUser?.email) {
      return json({
        status: "error",
        message: "User not authenticated",
        debug: { step: "user_auth", user: null }
      }, { status: 401 });
    }

    // Get AWS credentials from database
    const awsCredentialsData = await getAwsCredentials(currentUser.email);
    console.log("Test AWS API: AWS credentials found:", !!awsCredentialsData);
    console.log("Test AWS API: Credentials data:", {
      hasAccessKeyId: !!awsCredentialsData?.accessKeyId,
      hasSecretAccessKey: !!awsCredentialsData?.secretAccessKey,
      hasRegion: !!awsCredentialsData?.region,
      region: awsCredentialsData?.region
    });
    
    if (!awsCredentialsData || !awsCredentialsData.accessKeyId || !awsCredentialsData.secretAccessKey || !awsCredentialsData.region) {
      return json({
        status: "error",
        message: "AWS credentials not found",
        debug: { 
          step: "credentials_check", 
          hasCredentials: !!awsCredentialsData,
          hasAccessKeyId: !!awsCredentialsData?.accessKeyId,
          hasSecretAccessKey: !!awsCredentialsData?.secretAccessKey,
          hasRegion: !!awsCredentialsData?.region
        }
      }, { status: 401 });
    }

    // Test AWS connection
    const stsClient = new STSClient({
      region: awsCredentialsData.region,
      credentials: {
        accessKeyId: awsCredentialsData.accessKeyId,
        secretAccessKey: awsCredentialsData.secretAccessKey,
      },
    });

    console.log("Test AWS API: Testing AWS connection");

    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);

    console.log("Test AWS API: AWS connection successful");

    return json({
      status: "success",
      message: "AWS connection successful",
      data: {
        accountId: response.Account,
        arn: response.Arn,
        userId: response.UserId,
        region: awsCredentialsData.region
      },
      debug: { 
        step: "aws_connection_success",
        credentials: {
          accessKeyId: awsCredentialsData.accessKeyId.substring(0, 8) + "...",
          region: awsCredentialsData.region
        }
      }
    });
  } catch (error) {
    console.error('Test AWS API: Error:', error);
    return json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      debug: { 
        step: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
} 