# Firebase Functions - Daily Email Reports with Entity Analysis

This Firebase function runs daily to check users who haven't sent emails recently and sends them comprehensive security reports with PDF attachments containing entity analysis from AWS and Google.

## Features

- **Daily Scheduled Function**: Runs automatically at 9:00 AM UTC every day
- **Smart Email Filtering**: Only sends emails to users who:
  - Have email notifications enabled
  - Have `sendOnEmailDate` that is today or in the past
  - Haven't received an email in the last 24 hours
- **Entity Data Collection**: Fetches user and role data from:
  - AWS IAM (users, roles, policies)
  - Google Workspace (users, admin status, 2FA enrollment)
- **Risk Assessment**: Calculates security scores using `calculateEntityScores`:
  - Last Used Score (activity analysis)
  - Permission Score (access level assessment)
  - Identity Score (MFA, trust policies, etc.)
- **PDF Report Generation**: Creates comprehensive PDF reports with:
  - Entity inventory tables
  - Risk factor analysis
  - Security score summaries
  - Professional formatting
- **SendGrid Integration**: Uses SendGrid for reliable email delivery with PDF attachments
- **Automatic Scheduling**: Updates `sendOnEmailDate` based on user's report frequency (weekly/monthly)
- **Manual Trigger**: Includes an HTTP function for manual testing
- **Fallback Support**: Sends basic reminder emails if entity data is unavailable

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Environment Variables

Set up your Firebase Functions configuration:

```bash
# Set SendGrid API key
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"

# Set from email address
firebase functions:config:set email.from="noreply@yourdomain.com"

# Set Google OAuth2 credentials
firebase functions:config:set google.client_id="YOUR_GOOGLE_CLIENT_ID"
firebase functions:config:set google.client_secret="YOUR_GOOGLE_CLIENT_SECRET"
firebase functions:config:set google.redirect_uri="http://localhost:3000"
```

### 3. SendGrid Setup

1. Create a SendGrid account at https://sendgrid.com
2. Generate an API key with "Mail Send" permissions
3. Verify your sender domain or use a verified sender email
4. Add the API key to your Firebase Functions configuration

### 4. Google OAuth2 Setup

1. Go to Google Cloud Console
2. Create a project or select existing one
3. Enable Google Admin SDK API
4. Create OAuth2 credentials
5. Add the credentials to your Firebase Functions configuration

### 5. Deploy Functions

```bash
# Build the functions
npm run build

# Deploy to Firebase
firebase deploy --only functions
```

### 6. Verify Deployment

Check that your functions are deployed:

```bash
firebase functions:list
```

## Functions

### `sendDailyEmailReminders`

- **Type**: Scheduled Function (Pub/Sub)
- **Schedule**: Daily at 9:00 AM UTC
- **Purpose**: Automatically checks users, fetches entity data, generates PDF reports, and sends emails with attachments

### `sendEmailRemindersManual`

- **Type**: HTTP Function
- **Method**: POST
- **Purpose**: Manually trigger the email sending process with reports for testing

## User Data Structure

The function expects users to be stored in the `clients` collection with the following fields:

```typescript
interface UserData {
  email: string;                           // User's email address
  companyName?: string;                    // Company name for personalization
  reportEmailAddress?: string;             // Email to send reports to (defaults to email)
  emailNotificationsEnabled?: boolean;     // Whether to send emails
  reportFrequency?: string;                // 'weekly' or 'monthly'
  sendOnEmailDate?: Timestamp | Date;      // When to send next email
  lastEmailSent?: Timestamp | Date;        // When last email was sent
  awsAccessKeyId?: string;                 // AWS access key for entity fetching
  awsSecretAccessKey?: string;             // AWS secret key for entity fetching
  awsRegion?: string;                      // AWS region (defaults to us-east-1)
  googleRefreshToken?: string;             // Google refresh token for entity fetching
}
```

## Entity Service Features

### AWS Entity Collection
- Fetches IAM users and roles
- Analyzes access policies
- Calculates risk scores based on:
  - Last activity
  - Permission levels
  - MFA status
  - Trust policies

### Google Entity Collection
- Fetches Google Workspace users
- Analyzes admin privileges
- Calculates risk scores based on:
  - Last login activity
  - 2FA enrollment
  - Account suspension status
  - Admin privileges

### PDF Report Generation
- Professional formatting with company branding
- Comprehensive entity tables
- Risk factor summaries
- Security score breakdowns
- Actionable recommendations

## Email Template

The function sends a professional security report email with:
- Personalized greeting with company name
- Report summary with entity counts
- Security score breakdown
- Risk level distribution
- PDF attachment with detailed analysis
- Both HTML and plain text versions

## Monitoring

Monitor your functions in the Firebase Console:
1. Go to Firebase Console > Functions
2. View logs for `sendDailyEmailReminders`
3. Check execution history and any errors
4. Monitor PDF generation and email delivery

## Testing

### Manual Testing

Use the manual trigger function:

```bash
curl -X POST https://your-region-your-project.cloudfunctions.net/sendEmailRemindersManual
```

### Local Testing

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Start emulator: `firebase emulators:start --only functions`

## Troubleshooting

### Common Issues

1. **SendGrid API Key Not Set**
   - Ensure you've set the SendGrid API key in Firebase Functions config
   - Check that the API key has "Mail Send" permissions

2. **From Email Not Verified**
   - Verify your sender domain in SendGrid
   - Or use a verified sender email address

3. **Google OAuth2 Credentials Missing**
   - Ensure Google OAuth2 credentials are set in Firebase Functions config
   - Verify the credentials have Admin SDK API access

4. **AWS Credentials Not Found**
   - Check that users have AWS credentials stored in their Firestore documents
   - Verify the credentials have IAM read permissions

5. **PDF Generation Fails**
   - Check that all required dependencies are installed
   - Verify the entity service can access AWS/Google APIs

6. **Function Not Running**
   - Check Firebase Functions logs
   - Ensure the function is deployed successfully
   - Verify the schedule is set correctly

7. **No Emails Being Sent**
   - Check that users have `emailNotificationsEnabled: true`
   - Verify `sendOnEmailDate` is set correctly
   - Check that `sendOnEmailDate` is in the past or today

### Logs

View function logs:

```bash
firebase functions:log --only sendDailyEmailReminders
```

## Security Considerations

- SendGrid API keys are stored securely in Firebase Functions configuration
- AWS and Google credentials are stored in user Firestore documents
- Functions run with Firebase Admin SDK for secure database access
- Email addresses are validated before sending
- Rate limiting is built-in to prevent spam
- PDF reports are generated securely in memory

## Cost Optimization

- Function runs once daily to minimize execution costs
- Batch processing of emails to reduce database reads
- Efficient querying to only process relevant users
- PDF generation is optimized for memory usage
- Entity data is cached during processing

## Performance Notes

- Entity fetching may take time for large organizations
- PDF generation is memory-intensive for large entity lists
- Consider implementing pagination for very large datasets
- Monitor function timeout limits (default 540 seconds) 