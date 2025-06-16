import type { ShadowTimelineEvent, TimelineSummary } from './time-to-shadow-timeline';

// Mock timeline events
export const mockTimelineEvents: ShadowTimelineEvent[] = [
  {
    id: 'user-john-doe-activity-45',
    entityName: 'john.doe@company.com',
    entityType: 'user',
    provider: 'aws',
    eventType: 'activity_threshold',
    severity: 'medium',
    estimatedDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
    confidence: 75,
    description: 'User may become shadow risk if inactivity continues',
    details: 'User john.doe@company.com has been inactive for 45 days and may become a shadow permission risk',
    recommendations: [
      'Review user activity patterns',
      'Consider removing unused account',
      'Verify if user still needs access',
      'Implement activity monitoring'
    ],
    factors: {
      lastActivity: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      permissionLevel: 'admin',
      mfaStatus: true,
      inactivityDays: 45,
      riskFactors: ['Inactive for 45 days', 'No recent activity', 'Admin permissions']
    }
  },
  {
    id: 'user-sarah-smith-mfa-risk',
    entityName: 'sarah.smith@company.com',
    entityType: 'user',
    provider: 'aws',
    eventType: 'mfa_expiry',
    severity: 'high',
    estimatedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    confidence: 85,
    description: 'MFA not enabled - security risk',
    details: 'User sarah.smith@company.com does not have MFA enabled, increasing shadow permission risk',
    recommendations: [
      'Enable MFA for user account',
      'Implement MFA policy enforcement',
      'Review security requirements'
    ],
    factors: {
      lastActivity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      permissionLevel: 'full-access',
      mfaStatus: false,
      inactivityDays: 7,
      riskFactors: ['No MFA enabled', 'Security vulnerability', 'Full access permissions']
    }
  },
  {
    id: 'user-mike-johnson-never-used',
    entityName: 'mike.johnson@company.com',
    entityType: 'user',
    provider: 'aws',
    eventType: 'shadow_risk',
    severity: 'critical',
    estimatedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    confidence: 95,
    description: 'User may become shadow risk due to inactivity',
    details: 'User mike.johnson@company.com has never been used and may become a shadow permission risk',
    recommendations: [
      'Review if user account is needed',
      'Consider removing unused account',
      'Verify if user should exist in the system'
    ],
    factors: {
      lastActivity: null,
      permissionLevel: 'read-only',
      mfaStatus: false,
      inactivityDays: 0,
      riskFactors: ['Never used', 'No activity history', 'No MFA']
    }
  },
  {
    id: 'role-admin-role-activity-120',
    entityName: 'AdminRole',
    entityType: 'role',
    provider: 'aws',
    eventType: 'activity_threshold',
    severity: 'high',
    estimatedDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
    confidence: 80,
    description: 'Role may become shadow risk due to inactivity',
    details: 'Role AdminRole has been inactive for 120 days and may become a shadow permission risk',
    recommendations: [
      'Review role usage patterns',
      'Consider removing unused role',
      'Verify role permissions are appropriate',
      'Monitor role activity'
    ],
    factors: {
      lastActivity: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      permissionLevel: 'admin',
      mfaStatus: false,
      inactivityDays: 120,
      riskFactors: ['Inactive for 120 days', 'Potential orphaned role', 'Admin permissions']
    }
  },
  {
    id: 'user-emma-wilson-permission-risk',
    entityName: 'emma.wilson@company.com',
    entityType: 'user',
    provider: 'aws',
    eventType: 'permission_expiry',
    severity: 'high',
    estimatedDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
    confidence: 70,
    description: 'High-permission user may become shadow risk',
    details: 'User emma.wilson@company.com has admin permissions and may become a shadow risk if not actively managed',
    recommendations: [
      'Review admin permissions regularly',
      'Implement permission rotation',
      'Monitor admin activity closely',
      'Consider reducing permissions if not needed'
    ],
    factors: {
      lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      permissionLevel: 'admin',
      mfaStatus: true,
      inactivityDays: 3,
      riskFactors: ['Admin permissions', 'High privilege access', 'Recent activity']
    }
  },
  {
    id: 'role-readonly-role-never-used',
    entityName: 'ReadOnlyRole',
    entityType: 'role',
    provider: 'aws',
    eventType: 'shadow_risk',
    severity: 'medium',
    estimatedDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
    confidence: 90,
    description: 'Role may become shadow risk due to inactivity',
    details: 'Role ReadOnlyRole has never been used and may become a shadow permission risk',
    recommendations: [
      'Review if role is needed',
      'Consider removing unused role',
      'Verify role permissions are appropriate'
    ],
    factors: {
      lastActivity: null,
      permissionLevel: 'read-only',
      mfaStatus: false,
      inactivityDays: 0,
      riskFactors: ['Never used', 'No activity history', 'Potential orphaned role']
    }
  },
  {
    id: 'user-david-brown-activity-90',
    entityName: 'david.brown@company.com',
    entityType: 'user',
    provider: 'google',
    eventType: 'activity_threshold',
    severity: 'high',
    estimatedDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
    confidence: 85,
    description: 'User approaching shadow risk due to inactivity',
    details: 'User david.brown@company.com has been inactive for 90 days and may become a shadow permission risk',
    recommendations: [
      'Review user activity patterns',
      'Consider removing unused account',
      'Verify if user still needs access',
      'Implement activity monitoring'
    ],
    factors: {
      lastActivity: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      permissionLevel: 'custom',
      mfaStatus: false,
      inactivityDays: 90,
      riskFactors: ['Inactive for 90 days', 'No recent activity', 'No MFA enabled']
    }
  },
  {
    id: 'user-lisa-chen-mfa-risk',
    entityName: 'lisa.chen@company.com',
    entityType: 'user',
    provider: 'google',
    eventType: 'mfa_expiry',
    severity: 'medium',
    estimatedDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
    confidence: 75,
    description: 'MFA not enabled - security risk',
    details: 'User lisa.chen@company.com does not have MFA enabled, increasing shadow permission risk',
    recommendations: [
      'Enable MFA for user account',
      'Implement MFA policy enforcement',
      'Review security requirements'
    ],
    factors: {
      lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      permissionLevel: 'read-only',
      mfaStatus: false,
      inactivityDays: 2,
      riskFactors: ['No MFA enabled', 'Security vulnerability']
    }
  },
  {
    id: 'role-developer-role-permission-risk',
    entityName: 'DeveloperRole',
    entityType: 'role',
    provider: 'aws',
    eventType: 'permission_expiry',
    severity: 'medium',
    estimatedDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
    confidence: 65,
    description: 'High-permission role may become shadow risk',
    details: 'Role DeveloperRole has full-access permissions and may become a shadow risk if not actively managed',
    recommendations: [
      'Review role permissions regularly',
      'Implement permission rotation',
      'Monitor role usage',
      'Consider reducing permissions if not needed'
    ],
    factors: {
      lastActivity: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      permissionLevel: 'full-access',
      mfaStatus: false,
      inactivityDays: 15,
      riskFactors: ['Full-access permissions', 'High privilege role', 'Recent activity']
    }
  },
  {
    id: 'user-alex-turner-activity-180',
    entityName: 'alex.turner@company.com',
    entityType: 'user',
    provider: 'aws',
    eventType: 'activity_threshold',
    severity: 'critical',
    estimatedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    confidence: 95,
    description: 'User already inactive - immediate shadow risk',
    details: 'User alex.turner@company.com has been inactive for 180 days and is at immediate risk of becoming a shadow permission',
    recommendations: [
      'Immediate review required',
      'Consider removing unused account',
      'Verify if user should exist in the system',
      'Implement activity monitoring'
    ],
    factors: {
      lastActivity: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      permissionLevel: 'admin',
      mfaStatus: true,
      inactivityDays: 180,
      riskFactors: ['Inactive for 180 days', 'No recent activity', 'Admin permissions']
    }
  }
];

// Mock timeline summary
export const mockTimelineSummary: TimelineSummary = {
  totalEvents: mockTimelineEvents.length,
  criticalEvents: mockTimelineEvents.filter(e => e.severity === 'critical').length,
  highRiskEvents: mockTimelineEvents.filter(e => e.severity === 'high').length,
  mediumRiskEvents: mockTimelineEvents.filter(e => e.severity === 'medium').length,
  lowRiskEvents: mockTimelineEvents.filter(e => e.severity === 'low').length,
  next30Days: mockTimelineEvents.filter(e => {
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const eventDate = typeof e.estimatedDate === 'string' ? new Date(e.estimatedDate) : e.estimatedDate;
    return eventDate <= next30Days;
  }).length,
  next90Days: mockTimelineEvents.filter(e => {
    const now = new Date();
    const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const eventDate = typeof e.estimatedDate === 'string' ? new Date(e.estimatedDate) : e.estimatedDate;
    return eventDate <= next90Days;
  }).length,
  next180Days: mockTimelineEvents.filter(e => {
    const now = new Date();
    const next180Days = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const eventDate = typeof e.estimatedDate === 'string' ? new Date(e.estimatedDate) : e.estimatedDate;
    return eventDate <= next180Days;
  }).length,
  timelineEvents: mockTimelineEvents
}; 