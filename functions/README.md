# Firebase Functions - Daily Email Reminders

This Firebase function runs daily to check users who haven't sent emails recently and sends them reminder emails using SendGrid.

## Features

- **Daily Scheduled Function**: Runs automatically at 9:00 AM UTC every day
- **Smart Email Filtering**: Only sends emails to users who:
  - Have email notifications enabled
  - Have `sendOnEmailDate` that is today or in the past
  - Haven't received an email in the last 24 hours
- **SendGrid Integration**: Uses SendGrid for reliable email delivery
- **Automatic Scheduling**: Updates `sendOnEmailDate` based on user's report frequency (weekly/monthly)
- **Manual Trigger**: Includes an HTTP function for manual testing

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
```

### 3. SendGrid Setup

1. Create a SendGrid account at https://sendgrid.com
2. Generate an API key with "Mail Send" permissions
3. Verify your sender domain or use a verified sender email
4. Add the API key to your Firebase Functions configuration

### 4. Deploy Functions

```bash
# Build the functions
npm run build

# Deploy to Firebase
firebase deploy --only functions
```

### 5. Verify Deployment

Check that your functions are deployed:

```bash
firebase functions:list
```

## Functions

### `sendDailyEmailReminders`

- **Type**: Scheduled Function (Pub/Sub)
- **Schedule**: Daily at 9:00 AM UTC
- **Purpose**: Automatically checks and sends emails to users who need reminders

### `sendEmailRemindersManual`

- **Type**: HTTP Function
- **Method**: POST
- **Purpose**: Manually trigger the email sending process for testing

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
}
```

## Email Template

The function sends a professional security report reminder email with:
- Personalized greeting with company name
- Clear call-to-action
- Professional styling
- Both HTML and plain text versions

## Monitoring

Monitor your functions in the Firebase Console:
1. Go to Firebase Console > Functions
2. View logs for `sendDailyEmailReminders`
3. Check execution history and any errors

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

3. **Function Not Running**
   - Check Firebase Functions logs
   - Ensure the function is deployed successfully
   - Verify the schedule is set correctly

4. **No Emails Being Sent**
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
- Functions run with Firebase Admin SDK for secure database access
- Email addresses are validated before sending
- Rate limiting is built-in to prevent spam

## Cost Optimization

- Function runs once daily to minimize execution costs
- Batch processing of emails to reduce database reads
- Efficient querying to only process relevant users 