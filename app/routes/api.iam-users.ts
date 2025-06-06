import { json } from "@remix-run/node";
import { IAMClient } from "@aws-sdk/client-iam";
import { getIAMUsers } from "~/lib/iam/aws-operations";
import { calculateRiskScore } from "~/lib/iam/risk-assessment";
import { getAwsCredentials } from "~/utils/session.server";

export async function loader({ request }: { request: Request }) {
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

    // Initialize AWS IAM client with session credentials
    const iamClient = new IAMClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    console.log('Fetching IAM users...');
    const users = await getIAMUsers(iamClient);
    console.log(`Found ${users.length} IAM users`);

    // Calculate risk assessment for each user
    const usersWithRiskAssessment = users.map(user => ({
      ...user,
      riskAssessment: calculateRiskScore(user)
    }));

    console.log('Returning users with risk assessment');
    return json({ users: usersWithRiskAssessment });
  } catch (error) {
    console.error('Error fetching IAM users:', error);
    return json({ 
      status: "error",
      message: "Failed to fetch IAM users. Please check your AWS credentials in Settings.",
      redirectTo: "/settings"
    }, { status: 500 });
  }
} 