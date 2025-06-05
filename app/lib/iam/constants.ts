export const HIGH_RISK_PATTERNS = [
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

export const MEDIUM_RISK_PATTERNS = [
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

export const RISK_FACTORS = {
  MFA_DISABLED: 1,          // High risk if MFA is disabled
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

export const SHADOW_PERMISSION_PATTERNS = {
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