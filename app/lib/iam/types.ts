export interface Policy {
  name: string;
  description?: string;
  createDate: string;
  updateDate: string;
  type: 'inline' | 'managed';
}

export interface AccessKey {
  id: string;
  createDate: string;
  lastUsed?: string;
  status: 'Active' | 'Inactive';
}

export interface UserPolicies {
  inline: Policy[];
  attached: Policy[];
}

export interface PolicyDetails {
  name: string;
  description?: string;
  createDate: string;
  updateDate: string;
  type: 'inline' | 'managed';
}

export interface UserDetails {
  userName: string;
  createDate: string;
  lastUsed?: string;
  policies: Policy[];
  hasMFA: boolean;
  accessKeys?: AccessKey[];
  riskAssessment?: RiskAssessment;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  score: number;
  factors: string[];
  shadowPermissions: ShadowPermissionRisk[];
}

export interface ShadowPermissionRisk {
  type: 'unused_account' | 'old_access' | 'forgotten_policy' | 'unused_service' | 'legacy_policy' | 'excessive_permissions';
  description: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
} 