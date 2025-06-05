import { json } from "@remix-run/node";
import { IAMClient } from "@aws-sdk/client-iam";
import { getIAMUsers } from "~/lib/iam/aws-operations";
import { calculateRiskScore } from "~/lib/iam/risk-assessment";
import type { UserDetails } from "~/lib/iam/types";
import { env } from "~/utils/env.server";

export async function loader() {
  try {
    // Initialize AWS IAM client with credentials
    const iamClient = new IAMClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
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
    return json({ users: [], error: 'Failed to fetch IAM users' }, { status: 500 });
  }
} 