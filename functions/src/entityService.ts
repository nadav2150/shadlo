import * as admin from 'firebase-admin';
import { IAMClient, ListUsersCommand, ListRolesCommand, GetUserCommand, GetRoleCommand } from '@aws-sdk/client-iam';
import { google } from 'googleapis';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interfaces for entity data
interface Policy {
  name: string;
  description?: string;
  createDate: string;
  updateDate: string;
  type: 'inline' | 'managed';
}

interface AccessKey {
  accessKeyId: string;
  status: string;
  createDate: string;
  lastUsed?: string;
}

interface IAMUser {
  userName: string;
  createDate: string;
  lastUsed?: string;
  policies: Policy[];
  hasMFA: boolean;
  accessKeys?: AccessKey[];
  provider: 'aws';
  type: 'user';
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    lastUsedScore: number;
    permissionScore: number;
    identityScore: number;
    factors: string[];
    shadowPermissions: any[];
  };
}

interface IAMRole {
  roleName: string;
  createDate: string;
  lastUsed?: string;
  policies: Policy[];
  trustPolicy?: string;
  provider: 'aws';
  type: 'role';
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    lastUsedScore: number;
    permissionScore: number;
    identityScore: number;
    factors: string[];
    shadowPermissions: any[];
  };
}

interface GoogleUser {
  id: string;
  primaryEmail: string;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
  };
  isAdmin: boolean;
  isEnforcedIn2Sv: boolean;
  isEnrolledIn2Sv: boolean;
  isMailboxSetup: boolean;
  orgUnitPath: string;
  provider: 'google';
  type: 'user';
  createDate?: string;
  lastUsed?: string;
  policies: Policy[];
  hasMFA: boolean;
  suspended?: boolean;
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    lastUsedScore: number;
    permissionScore: number;
    identityScore: number;
    factors: string[];
    shadowPermissions: any[];
  };
  accessKeys?: AccessKey[];
}

interface UserData {
  email: string;
  companyName?: string;
  reportEmailAddress?: string;
  emailNotificationsEnabled?: boolean;
  reportFrequency?: string;
  sendOnEmailDate?: admin.firestore.Timestamp | Date | string;
  lastEmailSent?: admin.firestore.Timestamp | Date | string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  googleRefreshToken?: string;
}

// Function to get AWS credentials from user data
async function getAWSCredentials(userData: UserData) {
  if (!userData.awsAccessKeyId || !userData.awsSecretAccessKey) {
    return null;
  }

  return {
    accessKeyId: userData.awsAccessKeyId,
    secretAccessKey: userData.awsSecretAccessKey,
    region: userData.awsRegion || 'us-east-1'
  };
}

// Function to get Google credentials from user data
async function getGoogleCredentials(userData: UserData) {
  if (!userData.googleRefreshToken) {
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000";

  if (!clientId || !clientSecret) {
    console.error("Missing Google OAuth2 credentials in environment");
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: userData.googleRefreshToken
  });

  try {
    const tokenResponse = await oauth2Client.refreshAccessToken();
    const newTokens = tokenResponse.credentials;

    if (!newTokens.access_token) {
      console.error("Failed to refresh Google access token");
      return null;
    }

    return {
      oauth2Client,
      accessToken: newTokens.access_token
    };
  } catch (error) {
    console.error("Error refreshing Google access token:", error);
    return null;
  }
}

// Function to fetch AWS entities
async function fetchAWSEntities(credentials: any): Promise<{ users: IAMUser[], roles: IAMRole[] }> {
  try {
    const iamClient = new IAMClient({
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      region: credentials.region,
    });

    // Fetch users
    const usersCommand = new ListUsersCommand({});
    const usersResponse = await iamClient.send(usersCommand);
    const users: IAMUser[] = [];

    for (const user of usersResponse.Users || []) {
      try {
        // Get user details
        const getUserCommand = new GetUserCommand({ UserName: user.UserName });
        await iamClient.send(getUserCommand);
        
        // Get user policies (simplified - you might want to fetch actual policies)
        const policies: Policy[] = [];
        
        // Calculate risk assessment
        const riskAssessment = calculateRiskScore({
          userName: user.UserName!,
          createDate: user.CreateDate?.toISOString() || new Date().toISOString(),
          lastUsed: user.PasswordLastUsed?.toISOString(),
          policies,
          hasMFA: false, // You'd need to check MFA status separately
          accessKeys: [],
          provider: 'aws' as const,
          type: 'user' as const
        });

        users.push({
          userName: user.UserName!,
          createDate: user.CreateDate?.toISOString() || new Date().toISOString(),
          lastUsed: user.PasswordLastUsed?.toISOString(),
          policies,
          hasMFA: false,
          provider: 'aws',
          type: 'user',
          riskAssessment
        });
      } catch (error) {
        console.error(`Error fetching details for user ${user.UserName}:`, error);
      }
    }

    // Fetch roles
    const rolesCommand = new ListRolesCommand({});
    const rolesResponse = await iamClient.send(rolesCommand);
    const roles: IAMRole[] = [];

    for (const role of rolesResponse.Roles || []) {
      try {
        // Get role details
        const getRoleCommand = new GetRoleCommand({ RoleName: role.RoleName });
        const roleDetails = await iamClient.send(getRoleCommand);
        
        const policies: Policy[] = [];
        
        // Calculate risk assessment for role
        const riskAssessment = calculateRiskScore({
          roleName: role.RoleName!,
          createDate: role.CreateDate?.toISOString() || new Date().toISOString(),
          lastUsed: role.RoleLastUsed?.LastUsedDate?.toISOString(),
          policies,
          trustPolicy: roleDetails.Role?.AssumeRolePolicyDocument,
          provider: 'aws' as const,
          type: 'role' as const
        });

        roles.push({
          roleName: role.RoleName!,
          createDate: role.CreateDate?.toISOString() || new Date().toISOString(),
          lastUsed: role.RoleLastUsed?.LastUsedDate?.toISOString(),
          policies,
          trustPolicy: roleDetails.Role?.AssumeRolePolicyDocument,
          provider: 'aws',
          type: 'role',
          riskAssessment
        });
      } catch (error) {
        console.error(`Error fetching details for role ${role.RoleName}:`, error);
      }
    }

    return { users, roles };
  } catch (error) {
    console.error("Error fetching AWS entities:", error);
    return { users: [], roles: [] };
  }
}

// Function to fetch Google entities
async function fetchGoogleEntities(credentials: any): Promise<{ users: GoogleUser[], roles: any[] }> {
  try {
    const admin = google.admin({ version: 'directory_v1', auth: credentials.oauth2Client });
    
    // Fetch Google users
    const usersResponse = await admin.users.list({
      customer: 'my_customer',
      maxResults: 500,
      orderBy: 'email'
    });

    const users: GoogleUser[] = (usersResponse.data.users || []).map((user: any) => {
      // Calculate risk assessment for Google user
      const riskAssessment = calculateGoogleRiskScore({
        lastLoginTime: user.lastLoginTime || null,
        suspended: user.suspended || false,
        isAdmin: user.isAdmin || false,
        isDelegatedAdmin: user.isDelegatedAdmin || false,
        changePasswordAtNextLogin: user.changePasswordAtNextLogin || false,
        isMailboxSetup: user.isMailboxSetup || false,
        isEnrolledIn2Sv: user.isEnrolledIn2Sv || false
      });

      return {
        id: user.id,
        primaryEmail: user.primaryEmail,
        name: {
          fullName: user.name?.fullName || '',
          givenName: user.name?.givenName || '',
          familyName: user.name?.familyName || ''
        },
        isAdmin: user.isAdmin || false,
        isEnforcedIn2Sv: user.isEnforcedIn2Sv || false,
        isEnrolledIn2Sv: user.isEnrolledIn2Sv || false,
        isMailboxSetup: user.isMailboxSetup || false,
        orgUnitPath: user.orgUnitPath || '/',
        provider: 'google' as const,
        type: 'user' as const,
        createDate: new Date().toISOString(),
        lastUsed: user.lastLoginTime,
        policies: [],
        hasMFA: user.isEnrolledIn2Sv,
        suspended: user.suspended || false,
        riskAssessment: {
          riskLevel: riskAssessment.level.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
          score: riskAssessment.score,
          lastUsedScore: user.lastLoginTime ? 0 : 3,
          permissionScore: user.isAdmin ? 2 : 0,
          identityScore: user.isEnrolledIn2Sv ? 0 : 1,
          factors: riskAssessment.factors,
          shadowPermissions: []
        }
      };
    });

    return { users, roles: [] };
  } catch (error) {
    console.error("Error fetching Google entities:", error);
    return { users: [], roles: [] };
  }
}

// Simplified risk score calculation for AWS entities
function calculateRiskScore(entity: any) {
  let score = 0;
  const factors: string[] = [];

  // Last used score
  if (!entity.lastUsed) {
    score += 5;
    factors.push('Never used');
  } else {
    const lastUsedDate = new Date(entity.lastUsed);
    const now = new Date();
    const daysAgo = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo > 180) {
      score += 4;
      factors.push('No activity for over 180 days');
    } else if (daysAgo > 90) {
      score += 3;
      factors.push('No activity for over 90 days');
    }
  }

  // Permission score
  if (entity.policies && entity.policies.length > 0) {
    for (const policy of entity.policies) {
      const policyName = policy.name.toLowerCase();
      if (policyName.includes('administrator') || policyName.includes('fullaccess')) {
        score += 5;
        factors.push('Administrator access');
        break;
      }
    }
  }

  // Identity score
  if (entity.type === 'user' && !entity.hasMFA) {
    score += 2;
    factors.push('No MFA enabled');
  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (score >= 8) riskLevel = 'critical';
  else if (score >= 6) riskLevel = 'high';
  else if (score >= 3) riskLevel = 'medium';

  return {
    riskLevel,
    score,
    lastUsedScore: entity.lastUsed ? 0 : 5,
    permissionScore: entity.policies?.some((p: any) => p.name.toLowerCase().includes('administrator')) ? 5 : 0,
    identityScore: entity.type === 'user' && !entity.hasMFA ? 2 : 0,
    factors,
    shadowPermissions: []
  };
}

// Simplified risk score calculation for Google entities
function calculateGoogleRiskScore(user: any) {
  let score = 0;
  const factors: string[] = [];

  if (!user.lastLoginTime || user.lastLoginTime.startsWith('1970-01-01')) {
    score += 5;
    factors.push('Never logged in');
  } else {
    const lastLoginDate = new Date(user.lastLoginTime);
    const now = new Date();
    const daysSinceLastLogin = Math.floor((now.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastLogin > 180) {
      score += 4;
      factors.push('No login activity for over 180 days');
    } else if (daysSinceLastLogin > 90) {
      score += 3;
      factors.push('No login activity for over 90 days');
    }
  }

  if (user.suspended) {
    score += 2;
    factors.push('Account is suspended');
  }

  if (user.isAdmin) {
    score += 3;
    factors.push('User has admin privileges');
  }

  if (!user.isEnrolledIn2Sv) {
    score += 2;
    factors.push('Not enrolled in 2-Step Verification');
  }

  let level: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  if (score >= 8) level = 'Critical';
  else if (score >= 6) level = 'High';
  else if (score >= 3) level = 'Medium';

  return { score, level, factors };
}

// Function to calculate entity scores using the existing logic
function calculateEntityScores(entities: (IAMUser | IAMRole | GoogleUser)[]) {
  let totalLastUsedScore = 0;
  let totalPermissionScore = 0;
  let totalIdentityScore = 0;
  const totalEntities = entities.length;

  entities.forEach(entity => {
    // Last Used Score (0-5 points per entity)
    if (!entity.lastUsed) {
      totalLastUsedScore += 5;
    } else {
      const lastUsedDate = new Date(entity.lastUsed);
      const now = new Date();
      const daysAgo = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysAgo <= 30) totalLastUsedScore += 0;
      else if (daysAgo <= 90) totalLastUsedScore += 2;
      else if (daysAgo <= 180) totalLastUsedScore += 3;
      else totalLastUsedScore += 5;
    }

    // Permission Score (0-5 points per entity)
    let maxPermissionScore = 0;
    for (const policy of entity.policies) {
      const policyName = policy.name.toLowerCase();
      
      if (policyName.includes('administrator') || 
          policyName.includes('fullaccess') || 
          policyName.includes('full_access') ||
          policyName.includes('*')) {
        maxPermissionScore = Math.max(maxPermissionScore, 5);
      }
      else if (policyName.includes('write') || 
               policyName.includes('modify') || 
               policyName.includes('update') ||
               policyName.includes('create') ||
               policyName.includes('delete')) {
        maxPermissionScore = Math.max(maxPermissionScore, 2);
      }
    }
    totalPermissionScore += maxPermissionScore;

    // Identity Context Score (0-5 points per entity)
    if (entity.type === 'role') {
      const role = entity as IAMRole;
      if (!role.trustPolicy) {
        totalIdentityScore += 5;
      } else {
        try {
          const trustPolicy = JSON.parse(decodeURIComponent(role.trustPolicy));
          if (!trustPolicy.Statement || 
              !trustPolicy.Statement.some((stmt: any) => 
                stmt.Principal && 
                (stmt.Principal.Service || stmt.Principal.AWS || stmt.Principal.Federated)
              )) {
            totalIdentityScore += 5;
          }
        } catch (e) {
          totalIdentityScore += 5;
        }
      }
    } else {
      const user = entity as IAMUser | GoogleUser;
      const isOrphaned = (!user.accessKeys || user.accessKeys.length === 0 || 
                         user.accessKeys.every((key: any) => key.status === 'Inactive')) &&
                         !user.hasMFA && 
                         !user.lastUsed;
      
      const isInactive = !user.lastUsed || 
                        (() => {
                          const lastUsedDate = new Date(user.lastUsed!);
                          const now = new Date();
                          const daysAgo = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
                          return daysAgo > 90;
                        })() ||
                        (user.accessKeys && user.accessKeys.every((key: any) => key.status === 'Inactive'));

      if (isOrphaned) totalIdentityScore += 5;
      else if (isInactive) totalIdentityScore += 3;
    }
  });

  return {
    lastUsedScore: totalEntities > 0 ? totalLastUsedScore / totalEntities : 0,
    permissionScore: totalEntities > 0 ? totalPermissionScore / totalEntities : 0,
    identityScore: totalEntities > 0 ? totalIdentityScore / totalEntities : 0,
    totalEntities
  };
}

// Function to generate PDF report
async function generatePDFReport(
  awsUsers: IAMUser[], 
  awsRoles: IAMRole[], 
  googleUsers: GoogleUser[], 
  companyName: string
): Promise<Buffer> {
  const doc = new jsPDF();
  
  // Add header
  doc.setFontSize(20);
  doc.text('Security Entities Report', 15, 20);
  doc.setFontSize(12);
  doc.text(`Company: ${companyName}`, 15, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 35);
  
  // Calculate scores
  const allEntities = [...awsUsers, ...awsRoles, ...googleUsers];
  const scores = calculateEntityScores(allEntities);
  
  // Add summary
  doc.setFontSize(14);
  doc.text('Security Score Summary', 15, 50);
  doc.setFontSize(10);
  doc.text(`Total Entities: ${scores.totalEntities}`, 15, 60);
  doc.text(`Last Used Score: ${scores.lastUsedScore.toFixed(2)}/5`, 15, 65);
  doc.text(`Permission Score: ${scores.permissionScore.toFixed(2)}/5`, 15, 70);
  doc.text(`Identity Score: ${scores.identityScore.toFixed(2)}/5`, 15, 75);
  
  // Prepare table data
  const columns = ['Name', 'Type', 'Provider', 'Created', 'Last Used', 'MFA', 'Risk Level', 'Risk Factors'];
  const data = allEntities.map(entity => {
    const riskFactors = entity.riskAssessment?.factors || [];
    const riskFactorText = riskFactors.length > 0 
      ? riskFactors.slice(0, 3).join(', ') + (riskFactors.length > 3 ? '...' : '')
      : 'None';
    
    const name = entity.type === 'user' 
      ? (entity as IAMUser).userName || (entity as GoogleUser).primaryEmail
      : (entity as IAMRole).roleName;
    
    const mfaStatus = entity.type === 'user' && (entity as IAMUser | GoogleUser).hasMFA ? 'Enabled' : 'Disabled';
    
    return [
      name,
      entity.type,
      entity.provider === 'aws' ? 'AWS' : 'Google',
      entity.createDate ? new Date(entity.createDate).toLocaleDateString() : 'Unknown',
      entity.lastUsed ? new Date(entity.lastUsed).toLocaleDateString() : 'Never',
      mfaStatus,
      entity.riskAssessment?.riskLevel || 'low',
      riskFactorText
    ];
  });

  // Generate table
  autoTable(doc, {
    head: [columns],
    body: data,
    startY: 85,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 9
    },
    styles: {
      cellWidth: 'auto'
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 15 },
      2: { cellWidth: 20 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 15 },
      6: { cellWidth: 20 },
      7: { cellWidth: 30 }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { top: 85 }
  });

  // Add risk factors summary
  const riskFactorMap = new Map<string, number>();
  allEntities.forEach(entity => {
    const factors = entity.riskAssessment?.factors || [];
    factors.forEach(factor => {
      riskFactorMap.set(factor, (riskFactorMap.get(factor) || 0) + 1);
    });
  });

  if (riskFactorMap.size > 0) {
    const currentY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text('Risk Factors Summary', 15, currentY);
    
    let yPos = currentY + 10;
    riskFactorMap.forEach((count, factor) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(10);
      doc.text(`${factor}: ${count} entities`, 15, yPos);
      yPos += 5;
    });
  }

  // Convert to buffer
  return Buffer.from(doc.output('arraybuffer'));
}

// Main function to get all entity data and generate report
export async function getEntityDataAndGenerateReport(userData: UserData): Promise<{ pdfBuffer: Buffer; summary: any } | null> {
  try {
    console.log(`Starting entity data collection for user: ${userData.email}`);
    
    // Get AWS credentials
    const awsCredentials = await getAWSCredentials(userData);
    let awsUsers: IAMUser[] = [];
    let awsRoles: IAMRole[] = [];
    
    if (awsCredentials) {
      console.log('Fetching AWS entities...');
      const awsData = await fetchAWSEntities(awsCredentials);
      awsUsers = awsData.users;
      awsRoles = awsData.roles;
      console.log(`Fetched ${awsUsers.length} AWS users and ${awsRoles.length} AWS roles`);
    }

    // Get Google credentials
    const googleCredentials = await getGoogleCredentials(userData);
    let googleUsers: GoogleUser[] = [];
    
    if (googleCredentials) {
      console.log('Fetching Google entities...');
      const googleData = await fetchGoogleEntities(googleCredentials);
      googleUsers = googleData.users;
      console.log(`Fetched ${googleUsers.length} Google users`);
    }

    // Generate PDF report
    const companyName = userData.companyName || 'Your Organization';
    const pdfBuffer = await generatePDFReport(awsUsers, awsRoles, googleUsers, companyName);
    
    // Calculate summary
    const allEntities = [...awsUsers, ...awsRoles, ...googleUsers];
    const scores = calculateEntityScores(allEntities);
    
    const summary = {
      totalEntities: scores.totalEntities,
      awsUsers: awsUsers.length,
      awsRoles: awsRoles.length,
      googleUsers: googleUsers.length,
      scores: {
        lastUsedScore: scores.lastUsedScore,
        permissionScore: scores.permissionScore,
        identityScore: scores.identityScore
      },
      riskLevels: {
        critical: allEntities.filter(e => e.riskAssessment?.riskLevel === 'critical').length,
        high: allEntities.filter(e => e.riskAssessment?.riskLevel === 'high').length,
        medium: allEntities.filter(e => e.riskAssessment?.riskLevel === 'medium').length,
        low: allEntities.filter(e => e.riskAssessment?.riskLevel === 'low').length
      }
    };

    console.log(`Generated report with ${allEntities.length} entities for ${companyName}`);
    
    return { pdfBuffer, summary };
  } catch (error) {
    console.error('Error generating entity report:', error);
    return null;
  }
} 