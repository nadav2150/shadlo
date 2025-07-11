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

export interface Tag {
  Key: string;
  Value: string;
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
  provider?: 'aws' | 'azure' | 'gcp';
  riskAssessment?: RiskAssessment;
  tags?: Tag[];
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

export interface RoleDetails {
  roleName: string;
  createDate: string;
  lastUsed?: string;
  policies: Policy[];
  provider: 'aws' | 'azure' | 'gcp';
  type: 'role';
  description?: string;
  trustPolicy?: string;
  riskAssessment?: RiskAssessment;
  tags?: Tag[];
} 