import { json } from "@remix-run/node";
import { IAMClient } from "@aws-sdk/client-iam";
import { getIAMUsers, getIAMRoles } from "~/lib/iam/aws-operations";
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
        redirectTo: "/sign-in",
        credentials: null,
        users: [],
        roles: []
      }, { status: 401 });
    }

    // Get AWS credentials from database
    const awsCredentialsData = await getAwsCredentials(currentUser.email);
    if (!awsCredentialsData || !awsCredentialsData.accessKeyId || !awsCredentialsData.secretAccessKey || !awsCredentialsData.region) {
      return json({ 
        status: "error",
        message: "AWS credentials not found. Please add your credentials in the Settings page.",
        redirectTo: "/settings",
        credentials: null,
        users: [],
        roles: []
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

    // Fetch both users and roles in parallel
    const [users, roles] = await Promise.all([
      getIAMUsers(iamClient),
      getIAMRoles(iamClient)
    ]);

    // Process users with risk assessment
    const usersWithRiskAssessment = users.map(user => ({
      ...user,
      type: 'user' as const,
      provider: user.provider || 'aws',
      riskAssessment: calculateRiskScore(user)
    }));

    // Process roles with risk assessment
    const rolesWithRiskAssessment = roles.map(role => ({
      ...role,
      riskAssessment: calculateRiskScore({
        userName: role.roleName,
        createDate: role.createDate,
        lastUsed: role.lastUsed,
        policies: role.policies,
        hasMFA: false,
        provider: role.provider
      })
    }));

    return json({ 
      users: usersWithRiskAssessment,
      roles: rolesWithRiskAssessment,
      credentials: {
        accessKeyId: awsCredentialsData.accessKeyId,
        region: awsCredentialsData.region
      }
    });
  } catch (error) {
    console.error('Error fetching IAM entities:', error);
    return json({ 
      status: "error",
      message: "Failed to fetch IAM entities. Please check your AWS credentials in Settings.",
      redirectTo: "/settings",
      credentials: null,
      users: [],
      roles: []
    }, { status: 500 });
  }
}