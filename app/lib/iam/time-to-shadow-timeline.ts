import type { UserDetails, RoleDetails } from './types';

export interface ShadowTimelineEvent {
  id: string;
  entityName: string;
  entityType: 'user' | 'role';
  provider: 'aws' | 'google';
  eventType: 'shadow_risk' | 'permission_expiry' | 'activity_threshold' | 'mfa_expiry';
  severity: 'low' | 'medium' | 'high' | 'critical';
  estimatedDate: Date | string;
  confidence: number; // 0-100
  description: string;
  details: string;
  recommendations: string[];
  factors: {
    lastActivity: Date | string | null;
    permissionLevel: string;
    mfaStatus: boolean;
    inactivityDays: number;
    riskFactors: string[];
  };
}

export interface TimelineSummary {
  totalEvents: number;
  criticalEvents: number;
  highRiskEvents: number;
  mediumRiskEvents: number;
  lowRiskEvents: number;
  next30Days: number;
  next90Days: number;
  next180Days: number;
  timelineEvents: ShadowTimelineEvent[];
}

/**
 * Time-to-Shadow Timeline Engine
 * Estimates when permissions may become shadow risks based on activity patterns
 */
export class TimeToShadowTimeline {
  private users: UserDetails[];
  private roles: RoleDetails[];
  private timelineEvents: ShadowTimelineEvent[] = [];

  constructor(users: UserDetails[], roles: RoleDetails[]) {
    this.users = users;
    this.roles = roles;
    this.generateTimeline();
  }

  /**
   * Generate timeline events for all entities
   */
  private generateTimeline(): void {
    this.timelineEvents = [];

    // Process users
    this.users.forEach(user => {
      const userEvents = this.analyzeUserTimeline(user);
      this.timelineEvents.push(...userEvents);
    });

    // Process roles
    this.roles.forEach(role => {
      const roleEvents = this.analyzeRoleTimeline(role);
      this.timelineEvents.push(...roleEvents);
    });

    // Sort events by estimated date
    this.timelineEvents.sort((a, b) => {
      const dateA = typeof a.estimatedDate === 'string' ? new Date(a.estimatedDate) : a.estimatedDate;
      const dateB = typeof b.estimatedDate === 'string' ? new Date(b.estimatedDate) : b.estimatedDate;
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * Analyze timeline for a user
   */
  private analyzeUserTimeline(user: UserDetails): ShadowTimelineEvent[] {
    const events: ShadowTimelineEvent[] = [];
    const now = new Date();
    const lastActivity = user.lastUsed ? new Date(user.lastUsed) : null;
    const inactivityDays = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Event 1: Activity-based shadow risk
    if (lastActivity) {
      const activityEvent = this.calculateActivityBasedRisk(user, lastActivity, inactivityDays!);
      if (activityEvent) {
        events.push(activityEvent);
      }
    } else {
      // User has never been used
      const neverUsedEvent: ShadowTimelineEvent = {
        id: `user-${user.userName}-never-used`,
        entityName: user.userName,
        entityType: 'user',
        provider: user.provider || 'aws',
        eventType: 'shadow_risk',
        severity: 'critical',
        estimatedDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        confidence: 95,
        description: 'User may become shadow risk due to inactivity',
        details: `User ${user.userName} has never been used and may become a shadow permission risk`,
        recommendations: [
          'Review if user account is needed',
          'Consider removing unused account',
          'Verify if user should exist in the system'
        ],
        factors: {
          lastActivity: null,
          permissionLevel: this.getPermissionLevel(user),
          mfaStatus: user.hasMFA,
          inactivityDays: 0,
          riskFactors: ['Never used', 'No activity history']
        }
      };
      events.push(neverUsedEvent);
    }

    // Event 2: MFA expiry risk
    if (!user.hasMFA) {
      const mfaEvent: ShadowTimelineEvent = {
        id: `user-${user.userName}-mfa-risk`,
        entityName: user.userName,
        entityType: 'user',
        provider: user.provider || 'aws',
        eventType: 'mfa_expiry',
        severity: 'high',
        estimatedDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        confidence: 80,
        description: 'MFA not enabled - security risk',
        details: `User ${user.userName} does not have MFA enabled, increasing shadow permission risk`,
        recommendations: [
          'Enable MFA for user account',
          'Implement MFA policy enforcement',
          'Review security requirements'
        ],
        factors: {
          lastActivity: lastActivity,
          permissionLevel: this.getPermissionLevel(user),
          mfaStatus: false,
          inactivityDays: inactivityDays || 0,
          riskFactors: ['No MFA enabled', 'Security vulnerability']
        }
      };
      events.push(mfaEvent);
    }

    // Event 3: Permission-based risk
    const permissionEvent = this.calculatePermissionBasedRisk(user);
    if (permissionEvent) {
      events.push(permissionEvent);
    }

    return events;
  }

  /**
   * Analyze timeline for a role
   */
  private analyzeRoleTimeline(role: RoleDetails): ShadowTimelineEvent[] {
    const events: ShadowTimelineEvent[] = [];
    const now = new Date();
    const lastActivity = role.lastUsed ? new Date(role.lastUsed) : null;
    const inactivityDays = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Event 1: Role inactivity risk
    if (lastActivity) {
      const activityEvent = this.calculateRoleActivityRisk(role, lastActivity, inactivityDays!);
      if (activityEvent) {
        events.push(activityEvent);
      }
    } else {
      // Role has never been used
      const neverUsedEvent: ShadowTimelineEvent = {
        id: `role-${role.roleName}-never-used`,
        entityName: role.roleName,
        entityType: 'role',
        provider: role.provider || 'aws',
        eventType: 'shadow_risk',
        severity: 'high',
        estimatedDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        confidence: 90,
        description: 'Role may become shadow risk due to inactivity',
        details: `Role ${role.roleName} has never been used and may become a shadow permission risk`,
        recommendations: [
          'Review if role is needed',
          'Consider removing unused role',
          'Verify role permissions are appropriate'
        ],
        factors: {
          lastActivity: null,
          permissionLevel: this.getRolePermissionLevel(role),
          mfaStatus: false, // Roles don't have MFA
          inactivityDays: 0,
          riskFactors: ['Never used', 'No activity history', 'Potential orphaned role']
        }
      };
      events.push(neverUsedEvent);
    }

    // Event 2: Role permission risk
    const permissionEvent = this.calculateRolePermissionRisk(role);
    if (permissionEvent) {
      events.push(permissionEvent);
    }

    return events;
  }

  /**
   * Calculate activity-based shadow risk
   */
  private calculateActivityBasedRisk(user: UserDetails, lastActivity: Date, inactivityDays: number): ShadowTimelineEvent | null {
    const now = new Date();
    let estimatedDate: Date;
    let severity: 'low' | 'medium' | 'high' | 'critical';
    let confidence: number;
    let description: string;

    if (inactivityDays > 180) {
      // Already inactive for 6+ months
      estimatedDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      severity = 'critical';
      confidence = 95;
      description = 'User already inactive - immediate shadow risk';
    } else if (inactivityDays > 90) {
      // Inactive for 3-6 months
      estimatedDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      severity = 'high';
      confidence = 85;
      description = 'User approaching shadow risk due to inactivity';
    } else if (inactivityDays > 30) {
      // Inactive for 1-3 months
      estimatedDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
      severity = 'medium';
      confidence = 70;
      description = 'User may become shadow risk if inactivity continues';
    } else {
      // Recently active
      return null;
    }

    return {
      id: `user-${user.userName}-activity-${inactivityDays}`,
      entityName: user.userName,
      entityType: 'user',
      provider: user.provider || 'aws',
      eventType: 'activity_threshold',
      severity,
      estimatedDate,
      confidence,
      description,
      details: `User ${user.userName} has been inactive for ${inactivityDays} days and may become a shadow permission risk`,
      recommendations: [
        'Review user activity patterns',
        'Consider removing unused account',
        'Verify if user still needs access',
        'Implement activity monitoring'
      ],
      factors: {
        lastActivity,
        permissionLevel: this.getPermissionLevel(user),
        mfaStatus: user.hasMFA,
        inactivityDays,
        riskFactors: [`Inactive for ${inactivityDays} days`, 'No recent activity']
      }
    };
  }

  /**
   * Calculate permission-based risk
   */
  private calculatePermissionBasedRisk(user: UserDetails): ShadowTimelineEvent | null {
    const permissionLevel = this.getPermissionLevel(user);
    const now = new Date();

    if (permissionLevel === 'admin' || permissionLevel === 'full-access') {
      return {
        id: `user-${user.userName}-permission-risk`,
        entityName: user.userName,
        entityType: 'user',
        provider: user.provider || 'aws',
        eventType: 'permission_expiry',
        severity: 'high',
        estimatedDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days
        confidence: 75,
        description: 'High-permission user may become shadow risk',
        details: `User ${user.userName} has ${permissionLevel} permissions and may become a shadow risk if not actively managed`,
        recommendations: [
          'Review admin permissions regularly',
          'Implement permission rotation',
          'Monitor admin activity closely',
          'Consider reducing permissions if not needed'
        ],
        factors: {
          lastActivity: user.lastUsed ? new Date(user.lastUsed) : null,
          permissionLevel,
          mfaStatus: user.hasMFA,
          inactivityDays: user.lastUsed ? Math.floor((now.getTime() - new Date(user.lastUsed).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          riskFactors: [`${permissionLevel} permissions`, 'High privilege access']
        }
      };
    }

    return null;
  }

  /**
   * Calculate role activity risk
   */
  private calculateRoleActivityRisk(role: RoleDetails, lastActivity: Date, inactivityDays: number): ShadowTimelineEvent | null {
    const now = new Date();
    let estimatedDate: Date;
    let severity: 'low' | 'medium' | 'high' | 'critical';

    if (inactivityDays > 180) {
      estimatedDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
      severity = 'critical';
    } else if (inactivityDays > 90) {
      estimatedDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 days
      severity = 'high';
    } else if (inactivityDays > 30) {
      estimatedDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
      severity = 'medium';
    } else {
      return null;
    }

    return {
      id: `role-${role.roleName}-activity-${inactivityDays}`,
      entityName: role.roleName,
      entityType: 'role',
      provider: role.provider || 'aws',
      eventType: 'activity_threshold',
      severity,
      estimatedDate,
      confidence: 80,
      description: 'Role may become shadow risk due to inactivity',
      details: `Role ${role.roleName} has been inactive for ${inactivityDays} days and may become a shadow permission risk`,
      recommendations: [
        'Review role usage patterns',
        'Consider removing unused role',
        'Verify role permissions are appropriate',
        'Monitor role activity'
      ],
      factors: {
        lastActivity,
        permissionLevel: this.getRolePermissionLevel(role),
        mfaStatus: false,
        inactivityDays,
        riskFactors: [`Inactive for ${inactivityDays} days`, 'Potential orphaned role']
      }
    };
  }

  /**
   * Calculate role permission risk
   */
  private calculateRolePermissionRisk(role: RoleDetails): ShadowTimelineEvent | null {
    const permissionLevel = this.getRolePermissionLevel(role);
    const now = new Date();

    if (permissionLevel === 'admin' || permissionLevel === 'full-access') {
      return {
        id: `role-${role.roleName}-permission-risk`,
        entityName: role.roleName,
        entityType: 'role',
        provider: role.provider || 'aws',
        eventType: 'permission_expiry',
        severity: 'high',
        estimatedDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000), // 120 days
        confidence: 70,
        description: 'High-permission role may become shadow risk',
        details: `Role ${role.roleName} has ${permissionLevel} permissions and may become a shadow risk if not actively managed`,
        recommendations: [
          'Review role permissions regularly',
          'Implement permission rotation',
          'Monitor role usage',
          'Consider reducing permissions if not needed'
        ],
        factors: {
          lastActivity: role.lastUsed ? new Date(role.lastUsed) : null,
          permissionLevel,
          mfaStatus: false,
          inactivityDays: role.lastUsed ? Math.floor((now.getTime() - new Date(role.lastUsed).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          riskFactors: [`${permissionLevel} permissions`, 'High privilege role']
        }
      };
    }

    return null;
  }

  /**
   * Get permission level for a user
   */
  private getPermissionLevel(user: UserDetails): string {
    const policyNames = user.policies.map(p => p.name.toLowerCase());
    
    if (policyNames.some(name => name.includes('admin') || name.includes('administrator'))) {
      return 'admin';
    } else if (policyNames.some(name => name.includes('full') || name.includes('fullaccess'))) {
      return 'full-access';
    } else if (policyNames.some(name => name.includes('read') || name.includes('view'))) {
      return 'read-only';
    } else {
      return 'custom';
    }
  }

  /**
   * Get permission level for a role
   */
  private getRolePermissionLevel(role: RoleDetails): string {
    const policyNames = role.policies.map(p => p.name.toLowerCase());
    
    if (policyNames.some(name => name.includes('admin') || name.includes('administrator'))) {
      return 'admin';
    } else if (policyNames.some(name => name.includes('full') || name.includes('fullaccess'))) {
      return 'full-access';
    } else if (policyNames.some(name => name.includes('read') || name.includes('view'))) {
      return 'read-only';
    } else {
      return 'custom';
    }
  }

  /**
   * Get timeline summary
   */
  public getTimelineSummary(): TimelineSummary {
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const next180Days = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const criticalEvents = this.timelineEvents.filter(e => e.severity === 'critical').length;
    const highRiskEvents = this.timelineEvents.filter(e => e.severity === 'high').length;
    const mediumRiskEvents = this.timelineEvents.filter(e => e.severity === 'medium').length;
    const lowRiskEvents = this.timelineEvents.filter(e => e.severity === 'low').length;

    const next30DaysCount = this.timelineEvents.filter(e => {
      const eventDate = typeof e.estimatedDate === 'string' ? new Date(e.estimatedDate) : e.estimatedDate;
      return eventDate <= next30Days;
    }).length;
    
    const next90DaysCount = this.timelineEvents.filter(e => {
      const eventDate = typeof e.estimatedDate === 'string' ? new Date(e.estimatedDate) : e.estimatedDate;
      return eventDate <= next90Days;
    }).length;
    
    const next180DaysCount = this.timelineEvents.filter(e => {
      const eventDate = typeof e.estimatedDate === 'string' ? new Date(e.estimatedDate) : e.estimatedDate;
      return eventDate <= next180Days;
    }).length;

    return {
      totalEvents: this.timelineEvents.length,
      criticalEvents,
      highRiskEvents,
      mediumRiskEvents,
      lowRiskEvents,
      next30Days: next30DaysCount,
      next90Days: next90DaysCount,
      next180Days: next180DaysCount,
      timelineEvents: this.timelineEvents
    };
  }

  /**
   * Get events by severity
   */
  public getEventsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): ShadowTimelineEvent[] {
    return this.timelineEvents.filter(event => event.severity === severity);
  }

  /**
   * Get upcoming events (next 30 days)
   */
  public getUpcomingEvents(days: number = 30): ShadowTimelineEvent[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);
    
    return this.timelineEvents.filter(event => {
      const eventDate = typeof event.estimatedDate === 'string' 
        ? new Date(event.estimatedDate) 
        : event.estimatedDate;
      return eventDate <= cutoffDate;
    });
  }
} 