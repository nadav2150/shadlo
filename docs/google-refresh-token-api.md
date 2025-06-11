# Google Refresh Token API Documentation

## Overview

The `/api/google-users-refresh` endpoint allows you to fetch Google Workspace users using a stored refresh token from a specific user's Firestore document. This eliminates the need for users to re-authenticate every time they want to access Google user data.

## How It Works

1. **Email Parameter**: Accepts an email parameter to identify the user
2. **Token Retrieval**: Fetches the Google refresh token from the specified user's Firestore document
3. **Token Refresh**: Uses the refresh token to obtain a new access token from Google
4. **API Call**: Makes authenticated requests to Google Admin SDK
5. **Data Processing**: Returns formatted user data with risk assessment

## API Endpoint

```
GET /api/google-users-refresh?email=user@example.com
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | The email address of the user who has previously authenticated with Google |

## Prerequisites

- The specified user must have previously authenticated with Google and have a refresh token stored in Firestore
- Google OAuth2 credentials must be configured in environment variables

## Environment Variables Required

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000
```

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "users": [
    {
      "id": "user_id",
      "primaryEmail": "user@example.com",
      "name": {
        "fullName": "John Doe",
        "givenName": "John",
        "familyName": "Doe"
      },
      "isAdmin": false,
      "isDelegatedAdmin": false,
      "isEnforcedIn2Sv": false,
      "isEnrolledIn2Sv": true,
      "isMailboxSetup": true,
      "orgUnitPath": "/Users",
      "lastLoginTime": "2024-01-15T10:30:00Z",
      "suspended": false,
      "changePasswordAtNextLogin": false,
      "connectedToAWS": false,
      "sensitiveGroups": ["Users"],
      "riskAssessment": {
        "riskLevel": "low",
        "score": 25,
        "factors": [...]
      }
    }
  ],
  "userCount": 42,
  "message": "Successfully fetched users using refresh token for user@example.com",
  "tokenInfo": {
    "accessTokenExpiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

### Error Responses

#### 400 - Missing Email Parameter
```json
{
  "error": "Email parameter is required. Use ?email=user@example.com"
}
```

#### 401 - No Refresh Token
```json
{
  "error": "No Google refresh token found for user@example.com. Please authenticate with Google first."
}
```

#### 401 - Invalid/Expired Refresh Token
```json
{
  "error": "Refresh token is invalid or expired. Please re-authenticate with Google.",
  "details": "invalid_grant"
}
```

#### 403 - Insufficient Permissions
```json
{
  "error": "Insufficient permissions to access Google Admin API",
  "details": "Forbidden"
}
```

#### 500 - Server Error
```json
{
  "error": "Failed to fetch users from Google Workspace using refresh token",
  "details": "Error message"
}
```

## Usage Examples

### JavaScript/Fetch

```javascript
const email = 'user@example.com';
const response = await fetch(`/api/google-users-refresh?email=${encodeURIComponent(email)}`);
const data = await response.json();

if (response.ok) {
  console.log(`Found ${data.userCount} users`);
  data.users.forEach(user => {
    console.log(`${user.name.fullName} (${user.primaryEmail})`);
  });
} else {
  console.error('Error:', data.error);
}
```

### React Hook

```javascript
import { useState, useEffect } from 'react';

function useGoogleUsers(email) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!email) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    fetch(`/api/google-users-refresh?email=${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(data.users);
        } else {
          setError(data.error);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [email]);

  return { users, loading, error };
}
```

### cURL

```bash
curl "http://localhost:3000/api/google-users-refresh?email=user%40example.com"
```

## Testing

Visit `/test-google-refresh` to test the API endpoint with a user interface. Enter the email address of a user who has previously authenticated with Google.

## Security Considerations

- Refresh tokens are stored securely in Firestore
- Access tokens are not persisted and are refreshed on each request
- Email parameter is URL-encoded to prevent injection attacks
- Error messages are sanitized to prevent information leakage

## Troubleshooting

### Common Issues

1. **"Email parameter is required"**
   - Make sure to include the email parameter in the URL: `?email=user@example.com`

2. **"No Google refresh token found for [email]"**
   - The specified user needs to authenticate with Google first using the `/api/google.auth` endpoint

3. **"Refresh token is invalid or expired"**
   - The user needs to re-authenticate with Google
   - Refresh tokens can expire if not used for extended periods

4. **"Insufficient permissions"**
   - The Google service account needs Admin SDK Directory API permissions
   - Check Google Cloud Console for proper API enablement

5. **"Server configuration error"**
   - Verify all required environment variables are set
   - Check Google OAuth2 credentials are correct

## Related Endpoints

- `POST /api/google.auth` - Initial Google authentication
- `GET /api/google-users` - Fetch users using session credentials
- `GET /test-google-refresh` - Test page for this API 