import { IAMClient, ListUsersCommand, ListUserPoliciesCommand, ListAttachedUserPoliciesCommand, ListAccessKeysCommand, ListMFADevicesCommand } from "@aws-sdk/client-iam";
import type { UserDetails } from "./types";

export async function getIAMUsers(credentials: { accessKeyId: string; secretAccessKey: string; region: string }) {
  const iamClient = new IAMClient({
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    region: credentials.region,
  });

  try {
    // Get all IAM users
    const usersCommand = new ListUsersCommand({});
    const usersResponse = await iamClient.send(usersCommand);
    
    if (!usersResponse.Users) {
      return [];
    }

    // Get detailed information for each user
    const userDetails: UserDetails[] = await Promise.all(
      usersResponse.Users.map(async (user) => {
        if (!user.UserName) {
          throw new Error("User name is required");
        }

        // Get inline policies
        const inlinePoliciesCommand = new ListUserPoliciesCommand({
          UserName: user.UserName,
        });
        const inlinePoliciesResponse = await iamClient.send(inlinePoliciesCommand);

        // Get attached policies
        const attachedPoliciesCommand = new ListAttachedUserPoliciesCommand({
          UserName: user.UserName,
        });
        const attachedPoliciesResponse = await iamClient.send(attachedPoliciesCommand);

        // Get access keys
        const accessKeysCommand = new ListAccessKeysCommand({
          UserName: user.UserName,
        });
        const accessKeysResponse = await iamClient.send(accessKeysCommand);

        // Get MFA devices
        const mfaDevicesCommand = new ListMFADevicesCommand({
          UserName: user.UserName,
        });
        const mfaDevicesResponse = await iamClient.send(mfaDevicesCommand);

        return {
          userName: user.UserName,
          createDate: user.CreateDate?.toISOString() || new Date().toISOString(),
          lastUsed: user.PasswordLastUsed?.toISOString(),
          hasMFA: (mfaDevicesResponse.MFADevices?.length || 0) > 0,
          provider: 'aws' as const,
          policies: [
            ...(inlinePoliciesResponse.PolicyNames?.map(name => ({
              name,
              type: 'inline' as const,
              createDate: user.CreateDate?.toISOString() || new Date().toISOString(),
              updateDate: user.CreateDate?.toISOString() || new Date().toISOString(),
            })) || []),
            ...(attachedPoliciesResponse.AttachedPolicies?.map(policy => ({
              name: policy.PolicyName || '',
              type: 'managed' as const,
              createDate: user.CreateDate?.toISOString() || new Date().toISOString(),
              updateDate: user.CreateDate?.toISOString() || new Date().toISOString(),
            })) || []),
          ],
          accessKeys: accessKeysResponse.AccessKeyMetadata?.map(key => ({
            id: key.AccessKeyId || '',
            status: key.Status || 'Inactive',
            createDate: key.CreateDate?.toISOString() || new Date().toISOString(),
          })),
        };
      })
    );

    return userDetails;
  } catch (error) {
    console.error("Error fetching IAM users:", error);
    return [];
  }
} 