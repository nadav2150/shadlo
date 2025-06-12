import { IAMClient, ListUsersCommand, ListUserPoliciesCommand, ListAttachedUserPoliciesCommand, ListAccessKeysCommand, ListMFADevicesCommand, ListRolesCommand, ListRolePoliciesCommand, ListAttachedRolePoliciesCommand, AttachedPolicy, AccessKeyMetadata, GetAccessKeyLastUsedCommand, ListUserTagsCommand, ListRoleTagsCommand } from '@aws-sdk/client-iam';
import { UserDetails, Policy, AccessKey, RoleDetails, Tag } from './types';

export async function getIAMUsers(iamClient: IAMClient): Promise<UserDetails[]> {
  const { Users } = await iamClient.send(new ListUsersCommand({}));
  if (!Users) return [];

  const users: UserDetails[] = await Promise.all(
    Users.map(async (user) => {
      const [policies, accessKeys, mfaDevices, tags] = await Promise.all([
        getUserPolicies(iamClient, user.UserName!),
        getUserAccessKeys(iamClient, user.UserName!),
        getUserMFADevices(iamClient, user.UserName!),
        getUserTags(iamClient, user.UserName!)
      ]);

      return {
        userName: user.UserName!,
        createDate: user.CreateDate!.toISOString(),
        lastUsed: user.PasswordLastUsed?.toISOString(),
        policies,
        hasMFA: mfaDevices.length > 0,
        accessKeys,
        tags
      };
    })
  );

  return users;
}

async function getUserTags(iamClient: IAMClient, userName: string): Promise<Tag[]> {
  try {
    const { Tags } = await iamClient.send(new ListUserTagsCommand({ UserName: userName }));
    return (Tags || []).filter((tag): tag is Tag => 
      tag.Key !== undefined && tag.Value !== undefined
    ).map(tag => ({
      Key: tag.Key!,
      Value: tag.Value!
    }));
  } catch (error) {
    console.warn(`Failed to fetch tags for user ${userName}:`, error);
    return [];
  }
}

async function getUserPolicies(iamClient: IAMClient, userName: string): Promise<Policy[]> {
  const [inlinePolicies, attachedPolicies] = await Promise.all([
    iamClient.send(new ListUserPoliciesCommand({ UserName: userName })),
    iamClient.send(new ListAttachedUserPoliciesCommand({ UserName: userName }))
  ]);

  const policies: Policy[] = [];

  // Add inline policies
  if (inlinePolicies.PolicyNames) {
    policies.push(...inlinePolicies.PolicyNames.map(name => ({
      name,
      type: 'inline' as const,
      createDate: new Date().toISOString(), // Inline policies don't have create dates
      updateDate: new Date().toISOString()  // Inline policies don't have update dates
    })));
  }

  // Add attached policies
  if (attachedPolicies.AttachedPolicies) {
    policies.push(...attachedPolicies.AttachedPolicies.map((policy: AttachedPolicy) => ({
      name: policy.PolicyName!,
      description: policy.PolicyArn?.split('/').pop() || undefined, // Use policy name as description if available
      type: 'managed' as const,
      createDate: new Date().toISOString(), // Use current date as fallback
      updateDate: new Date().toISOString()  // Use current date as fallback
    })));
  }

  return policies;
}

async function getUserAccessKeys(iamClient: IAMClient, userName: string): Promise<AccessKey[]> {
  const { AccessKeyMetadata } = await iamClient.send(new ListAccessKeysCommand({ UserName: userName }));
  if (!AccessKeyMetadata) return [];

  // Get last used information for each access key
  const accessKeysWithLastUsed = await Promise.all(
    AccessKeyMetadata.map(async (key: AccessKeyMetadata) => {
      try {
        const { AccessKeyLastUsed } = await iamClient.send(
          new GetAccessKeyLastUsedCommand({ 
            AccessKeyId: key.AccessKeyId! 
          })
        );

        return {
          id: key.AccessKeyId!,
          createDate: key.CreateDate!.toISOString(),
          lastUsed: AccessKeyLastUsed?.LastUsedDate?.toISOString(),
          status: key.Status!
        };
      } catch (error) {
        // If we can't get last used info, return without it
        return {
          id: key.AccessKeyId!,
          createDate: key.CreateDate!.toISOString(),
          lastUsed: undefined,
          status: key.Status!
        };
      }
    })
  );

  return accessKeysWithLastUsed;
}

async function getUserMFADevices(iamClient: IAMClient, userName: string): Promise<any[]> {
  const { MFADevices } = await iamClient.send(new ListMFADevicesCommand({ UserName: userName }));
  return MFADevices || [];
}

export async function getIAMRoles(iamClient: IAMClient): Promise<RoleDetails[]> {
  const { Roles } = await iamClient.send(new ListRolesCommand({}));
  if (!Roles) return [];

  const roles: RoleDetails[] = await Promise.all(
    Roles.map(async (role) => {
      const [policies, tags] = await Promise.all([
        getRolePolicies(iamClient, role.RoleName!),
        getRoleTags(iamClient, role.RoleName!)
      ]);

      return {
        roleName: role.RoleName!,
        createDate: role.CreateDate!.toISOString(),
        lastUsed: role.RoleLastUsed?.LastUsedDate?.toISOString(),
        description: role.Description,
        trustPolicy: role.AssumeRolePolicyDocument,
        provider: 'aws' as const,
        type: 'role' as const,
        policies,
        tags
      };
    })
  );

  return roles;
}

async function getRolePolicies(iamClient: IAMClient, roleName: string): Promise<Policy[]> {
  const [inlinePolicies, attachedPolicies] = await Promise.all([
    iamClient.send(new ListRolePoliciesCommand({ RoleName: roleName })),
    iamClient.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName }))
  ]);

  const policies: Policy[] = [];

  // Add inline policies
  if (inlinePolicies.PolicyNames) {
    policies.push(...inlinePolicies.PolicyNames.map(name => ({
      name,
      type: 'inline' as const,
      createDate: new Date().toISOString(), // Inline policies don't have create dates
      updateDate: new Date().toISOString()  // Inline policies don't have update dates
    })));
  }

  // Add attached policies
  if (attachedPolicies.AttachedPolicies) {
    policies.push(...attachedPolicies.AttachedPolicies.map((policy: AttachedPolicy) => ({
      name: policy.PolicyName!,
      description: policy.PolicyArn?.split('/').pop() || undefined,
      type: 'managed' as const,
      createDate: new Date().toISOString(), // Use current date as fallback
      updateDate: new Date().toISOString()  // Use current date as fallback
    })));
  }

  return policies;
}

async function getRoleTags(iamClient: IAMClient, roleName: string): Promise<Tag[]> {
  try {
    const { Tags } = await iamClient.send(new ListRoleTagsCommand({ RoleName: roleName }));
    return (Tags || []).filter((tag): tag is Tag => 
      tag.Key !== undefined && tag.Value !== undefined
    ).map(tag => ({
      Key: tag.Key!,
      Value: tag.Value!
    }));
  } catch (error) {
    console.warn(`Failed to fetch tags for role ${roleName}:`, error);
    return [];
  }
} 