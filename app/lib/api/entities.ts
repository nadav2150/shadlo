import type { LoaderData } from '~/routes/entities';

export interface EntitiesApiResponse {
  users: LoaderData['users'];
  roles: LoaderData['roles'];
  error: string | null;
  credentials?: LoaderData['credentials'];
  googleCredentialsValid: boolean;
  hasGoogleRefreshToken?: boolean;
  refreshTokenValid?: boolean;
}

export async function fetchEntities(): Promise<EntitiesApiResponse> {
  const response = await fetch('/api/entities', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch entities: ${response.statusText}`);
  }

  return response.json();
}

// Separate function for AWS entities only
export async function fetchAwsEntities(): Promise<{
  users: LoaderData['users'];
  roles: LoaderData['roles'];
  credentials?: LoaderData['credentials'];
  error: string | null;
}> {
  const response = await fetch('/api/iam-entities', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AWS entities: ${response.statusText}`);
  }

  return response.json();
}

// Separate function for Google entities only
export async function fetchGoogleEntities(): Promise<{
  users: LoaderData['users'];
  error: string | null;
}> {
  const response = await fetch('/api/google-users-auto', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google entities: ${response.statusText}`);
  }

  return response.json();
} 