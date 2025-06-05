import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { 
  IAMClient, 
  ListUsersCommand, 
  GetUserCommand,
  ListUserPoliciesCommand,
  ListAttachedUserPoliciesCommand,
  GetPolicyCommand,
  ListMFADevicesCommand
} from "@aws-sdk/client-iam";
import { env } from "~/utils/env.server";

// Initialize AWS IAM client
const iamClient = new IAMClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

// Define high-risk policy patterns
const HIGH_RISK_PATTERNS = [
  'AdministratorAccess',
  'PowerUserAccess',
  'IAMFullAccess',
  'AmazonS3FullAccess',
  'AmazonRDSFullAccess',
  'AmazonEC2FullAccess',
  'AmazonDynamoDBFullAccess',
  'AmazonSQSFullAccess',
  'AmazonSNSFullAccess',
  'AmazonKMSFullAccess',
  'AWSCloudFormationFullAccess',
  'AWSLambdaFullAccess',
  'AmazonAPIGatewayAdministrator',
  'AmazonRoute53FullAccess',
  'AmazonVPCFullAccess'
];

// Define medium-risk policy patterns
const MEDIUM_RISK_PATTERNS = [
  'ReadOnlyAccess',
  'AmazonS3ReadOnlyAccess',
  'AmazonRDSReadOnlyAccess',
  'AmazonEC2ReadOnlyAccess',
  'AmazonDynamoDBReadOnlyAccess',
  'AmazonSQSReadOnlyAccess',
  'AmazonSNSReadOnlyAccess',
  'AmazonKMSReadOnlyAccess',
  'AWSCloudFormationReadOnlyAccess',
  'AWSLambdaReadOnlyAccess',
  'AmazonAPIGatewayReadOnlyAccess',
  'AmazonRoute53ReadOnlyAccess',
  'AmazonVPCReadOnlyAccess'
];

// Define risk factors and their weights
const RISK_FACTORS = {
  MFA_DISABLED: 3,          // High risk if MFA is disabled
  ADMIN_ACCESS: 4,          // High risk for admin access
  POWER_USER_ACCESS: 3,     // High risk for power user access
  FULL_SERVICE_ACCESS: 2,   // Medium risk for full service access
  INLINE_POLICIES: 2,       // Medium risk for inline policies (harder to audit)
  UNUSED_ACCOUNT: 3,        // High risk for unused accounts (potential shadow access)
  OLD_ACCESS_KEY: 2,        // Medium risk for old access keys (potential shadow access)
  FORGOTTEN_POLICY: 3,      // High risk for policies that haven't been reviewed
  UNUSED_SERVICE: 2,        // Medium risk for unused service access
  LEGACY_POLICY: 2,         // Medium risk for legacy policies
  EXCESSIVE_PERMISSIONS: 3,  // High risk for users with more permissions than needed
} as const;

// Define policy patterns that might indicate shadow permissions
const SHADOW_PERMISSION_PATTERNS = {
  LEGACY_POLICIES: [
    'AWSCloudTrailFullAccess',  // Legacy full access policies
    'AmazonS3FullAccess',
    'AmazonEC2FullAccess',
    'AmazonRDSFullAccess',
    'AmazonDynamoDBFullAccess',
    'AmazonSQSFullAccess',
    'AmazonSNSFullAccess',
    'AmazonKMSFullAccess',
    'AWSCloudFormationFullAccess',
    'AWSLambdaFullAccess',
    'AmazonAPIGatewayAdministrator',
    'AmazonRoute53FullAccess',
    'AmazonVPCFullAccess'
  ],
  UNUSED_SERVICES: [
    'AmazonWorkSpaces',
    'AmazonWorkDocs',
    'AmazonWorkMail',
    'AmazonChime',
    'AmazonConnect',
    'AmazonPinpoint',
    'AmazonSageMaker',
    'AmazonRekognition',
    'AmazonComprehend',
    'AmazonTranscribe'
  ]
};

interface Policy {
  name: string;
  description?: string;
  createDate?: Date;
  updateDate?: Date;
}

interface UserPolicies {
  inline: string[];
  attached: Policy[];
}

interface ShadowPermissionRisk {
  type: 'unused_account' | 'old_access' | 'forgotten_policy' | 'unused_service' | 'legacy_policy' | 'excessive_permissions';
  description: string;
  severity: 'low' | 'medium' | 'high';
  details: string[];
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: string[];
  shadowPermissions: ShadowPermissionRisk[];  // Added shadow permission risks
}

interface UserDetails {
  userName: string;
  createDate: Date;
  lastUsed?: Date;
  policies: UserPolicies;
  hasMFA: boolean;
  riskAssessment: RiskAssessment;  // Updated to use detailed risk assessment
}

interface PolicyDetails {
  Description?: string;
  CreateDate?: Date;
  UpdateDate?: Date;
}

// Helper function to assess risk level
function assessRiskLevel(policies: UserPolicies): 'low' | 'medium' | 'high' {
  const allPolicyNames = [
    ...policies.inline,
    ...policies.attached.map(p => p.name)
  ];

  // Check for high-risk patterns
  if (allPolicyNames.some(name => 
    HIGH_RISK_PATTERNS.some(pattern => 
      name.toLowerCase().includes(pattern.toLowerCase())
    )
  )) {
    return 'high';
  }

  // Check for medium-risk patterns
  if (allPolicyNames.some(name => 
    MEDIUM_RISK_PATTERNS.some(pattern => 
      name.toLowerCase().includes(pattern.toLowerCase())
    )
  )) {
    return 'medium';
  }

  return 'low';
}

// Helper function to get policy details
async function getPolicyDetails(policyArn: string): Promise<PolicyDetails> {
  try {
    const command = new GetPolicyCommand({ PolicyArn: policyArn });
    const response = await iamClient.send(command);
    return {
      Description: response.Policy?.Description,
      CreateDate: response.Policy?.CreateDate,
      UpdateDate: response.Policy?.UpdateDate
    };
  } catch (error) {
    console.error(`Error fetching policy details for ${policyArn}:`, error);
    return {};
  }
}

// Helper function to get all policies for a user
async function getUserPolicies(userName: string): Promise<UserPolicies> {
  const [inlinePolicies, attachedPolicies] = await Promise.all([
    iamClient.send(new ListUserPoliciesCommand({ UserName: userName })),
    iamClient.send(new ListAttachedUserPoliciesCommand({ UserName: userName }))
  ]);

  const attachedPolicyDetails = await Promise.all(
    (attachedPolicies.AttachedPolicies || []).map(async (policy) => {
      if (!policy.PolicyName || !policy.PolicyArn) {
        throw new Error('Policy name or ARN is undefined');
      }
      const details = await getPolicyDetails(policy.PolicyArn);
      return {
        name: policy.PolicyName,
        description: details.Description,
        createDate: details.CreateDate,
        updateDate: details.UpdateDate
      };
    })
  );

  return {
    inline: inlinePolicies.PolicyNames || [],
    attached: attachedPolicyDetails
  };
}

// Helper function to check if user has MFA
async function getUserMFAStatus(userName: string): Promise<boolean> {
  try {
    const command = new ListMFADevicesCommand({ UserName: userName });
    const response = await iamClient.send(command);
    return (response.MFADevices?.length || 0) > 0;
  } catch (error) {
    console.error(`Error fetching MFA status for ${userName}:`, error);
    return false;
  }
}

// Helper function to detect shadow permissions
function detectShadowPermissions(
  userName: string,
  policies: UserPolicies,
  createDate: Date,
  lastUsed?: Date
): ShadowPermissionRisk[] {
  const risks: ShadowPermissionRisk[] = [];
  const now = new Date();
  const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
  const oneYearAgo = new Date(now.setMonth(now.getMonth() - 12));

  // Check for unused account
  if (!lastUsed || lastUsed < oneYearAgo) {
    risks.push({
      type: 'unused_account',
      description: 'Account has not been used in over a year',
      severity: 'high',
      details: [`Last used: ${lastUsed ? lastUsed.toLocaleDateString() : 'Never'}`]
    });
  }

  // Check for legacy policies
  const legacyPolicies = policies.attached.filter(p => 
    SHADOW_PERMISSION_PATTERNS.LEGACY_POLICIES.includes(p.name)
  );
  if (legacyPolicies.length > 0) {
    risks.push({
      type: 'legacy_policy',
      description: 'User has legacy full-access policies',
      severity: 'high',
      details: legacyPolicies.map(p => p.name)
    });
  }

  // Check for unused service access
  const unusedServicePolicies = policies.attached.filter(p => 
    SHADOW_PERMISSION_PATTERNS.UNUSED_SERVICES.some(service => 
      p.name.toLowerCase().includes(service.toLowerCase())
    )
  );
  if (unusedServicePolicies.length > 0) {
    risks.push({
      type: 'unused_service',
      description: 'User has access to unused services',
      severity: 'medium',
      details: unusedServicePolicies.map(p => p.name)
    });
  }

  // Check for excessive permissions
  const totalPolicies = policies.attached.length + policies.inline.length;
  if (totalPolicies > 5) {  // Arbitrary threshold, adjust as needed
    risks.push({
      type: 'excessive_permissions',
      description: 'User has excessive number of policies',
      severity: 'medium',
      details: [
        `${totalPolicies} total policies`,
        `${policies.attached.length} attached policies`,
        `${policies.inline.length} inline policies`
      ]
    });
  }

  // Check for forgotten policies (policies that haven't been updated in a long time)
  const oldPolicies = policies.attached.filter(p => 
    p.updateDate && p.updateDate < oneYearAgo
  );
  if (oldPolicies.length > 0) {
    risks.push({
      type: 'forgotten_policy',
      description: 'User has policies that haven\'t been updated in over a year',
      severity: 'medium',
      details: oldPolicies.map(p => `${p.name} (Last updated: ${p.updateDate?.toLocaleDateString()})`)
    });
  }

  return risks;
}

// Updated risk assessment function
function assessDetailedRisk(
  policies: UserPolicies, 
  hasMFA: boolean,
  userName: string,
  createDate: Date,
  lastUsed?: Date
): RiskAssessment {
  const factors: string[] = [];
  let score = 0;

  // Check MFA status
  if (!hasMFA) {
    score += RISK_FACTORS.MFA_DISABLED;
    factors.push('MFA Disabled');
  }

  // Check for admin access
  const hasAdminAccess = policies.attached.some(p => 
    p.name.toLowerCase().includes('administrator') || 
    p.name === 'AdministratorAccess'
  );
  if (hasAdminAccess) {
    score += RISK_FACTORS.ADMIN_ACCESS;
    factors.push('Administrator Access');
  }

  // Check for power user access
  const hasPowerUserAccess = policies.attached.some(p => 
    p.name.toLowerCase().includes('poweruser') || 
    p.name === 'PowerUserAccess'
  );
  if (hasPowerUserAccess) {
    score += RISK_FACTORS.POWER_USER_ACCESS;
    factors.push('Power User Access');
  }

  // Check for full service access
  const fullServiceAccessPolicies = policies.attached.filter(p => 
    p.name.toLowerCase().includes('fullaccess') ||
    p.name.toLowerCase().includes('full_access')
  );
  if (fullServiceAccessPolicies.length > 0) {
    score += RISK_FACTORS.FULL_SERVICE_ACCESS;
    factors.push(`Full Access to ${fullServiceAccessPolicies.length} Services`);
  }

  // Check for inline policies
  if (policies.inline.length > 0) {
    score += RISK_FACTORS.INLINE_POLICIES;
    factors.push(`${policies.inline.length} Inline Policies`);
  }

  // Add shadow permission detection
  const shadowRisks = detectShadowPermissions(userName, policies, createDate, lastUsed);
  
  // Add shadow permission risks to score and factors
  shadowRisks.forEach(risk => {
    switch (risk.type) {
      case 'unused_account':
        score += RISK_FACTORS.UNUSED_ACCOUNT;
        factors.push('Unused Account');
        break;
      case 'old_access':
        score += RISK_FACTORS.OLD_ACCESS_KEY;
        factors.push('Old Access Keys');
        break;
      case 'forgotten_policy':
        score += RISK_FACTORS.FORGOTTEN_POLICY;
        factors.push('Forgotten Policies');
        break;
      case 'unused_service':
        score += RISK_FACTORS.UNUSED_SERVICE;
        factors.push('Unused Service Access');
        break;
      case 'legacy_policy':
        score += RISK_FACTORS.LEGACY_POLICY;
        factors.push('Legacy Policies');
        break;
      case 'excessive_permissions':
        score += RISK_FACTORS.EXCESSIVE_PERMISSIONS;
        factors.push('Excessive Permissions');
        break;
    }
  });

  // Determine risk level based on score
  let level: 'low' | 'medium' | 'high' | 'critical';
  if (score >= 7) {
    level = 'critical';
  } else if (score >= 5) {
    level = 'high';
  } else if (score >= 3) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return { 
    level, 
    score, 
    factors,
    shadowPermissions: shadowRisks
  };
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const { Users } = await iamClient.send(new ListUsersCommand({}));
    
    const usersWithDetails: UserDetails[] = await Promise.all(
      (Users || []).map(async (user) => {
        if (!user.UserName) {
          throw new Error('User name is undefined');
        }
        const [policies, hasMFA] = await Promise.all([
          getUserPolicies(user.UserName),
          getUserMFAStatus(user.UserName)
        ]);
        
        const riskAssessment = assessDetailedRisk(
          policies, 
          hasMFA,
          user.UserName,
          user.CreateDate!,
          user.PasswordLastUsed
        );
        
        return {
          userName: user.UserName,
          createDate: user.CreateDate!,
          lastUsed: user.PasswordLastUsed,
          policies,
          hasMFA,
          riskAssessment
        };
      })
    );

    return json({ users: usersWithDetails });
  } catch (error) {
    console.error('Error fetching IAM users:', error);
    throw new Error('Failed to fetch IAM users');
  }
}; 