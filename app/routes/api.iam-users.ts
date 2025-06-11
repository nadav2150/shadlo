import { json } from "@remix-run/node";
import { IAMClient } from "@aws-sdk/client-iam";
import { getIAMUsers } from "~/lib/iam/aws-operations";
import { calculateRiskScore } from "~/lib/iam/risk-assessment";
import { getCurrentUser, getAwsCredentials } from "~/lib/firebase";

export async function loader({ request }: { request: Request }) {
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

    // Initialize AWS IAM client with database credentials
    const iamClient = new IAMClient({
      region: awsCredentialsData.region,
      credentials: {
        accessKeyId: awsCredentialsData.accessKeyId,
        secretAccessKey: awsCredentialsData.secretAccessKey,
      },
    });

    const users = await getIAMUsers(iamClient);

    // Calculate risk assessment for each user
    const usersWithRiskAssessment = users.map(user => ({
      ...user,
      riskAssessment: calculateRiskScore(user)
    }));

    return json({ users: usersWithRiskAssessment });
  } catch (error) {
    return json({ 
      status: "error",
      message: "Failed to fetch IAM users. Please check your AWS credentials in Settings.",
      redirectTo: "/settings"
    }, { status: 500 });
  }
} 