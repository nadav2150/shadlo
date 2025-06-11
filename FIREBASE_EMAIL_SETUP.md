# Firebase Daily Email Function Setup Guide

This guide will help you set up the Firebase function that runs daily to send email reminders to users who haven't sent emails recently.

## 🚀 Quick Setup

### 1. Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Navigate to Functions Directory
```bash
cd functions
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Set Up SendGrid
1. Create a SendGrid account at https://sendgrid.com
2. Generate an API key with "Mail Send" permissions
3. Verify your sender domain or email address

### 6. Configure Firebase Functions
```bash
# Set SendGrid API key
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"

# Set from email address
firebase functions:config:set email.from="noreply@yourdomain.com"
```

### 7. Build and Deploy
```bash
# Build the functions
npm run build

# Deploy to Firebase
firebase deploy --only functions
```

## 📧 How It Works

The function runs daily at 9:00 AM UTC and:

1. **Queries Users**: Finds users in the `clients` collection who:
   - Have `emailNotificationsEnabled: true`
   - Have `sendOnEmailDate` that is today or in the past
   - Haven't received an email in the last 24 hours

2. **Sends Emails**: Uses SendGrid to send personalized security report reminders

3. **Updates Schedule**: Automatically calculates the next `sendOnEmailDate` based on the user's report frequency (weekly/monthly)

## 🔧 Configuration

### Environment Variables
- `SENDGRID_API_KEY`: Your SendGrid API key
- `FROM_EMAIL`: The email address to send from (must be verified in SendGrid)

### User Data Requirements
Users in the `clients` collection need these fields:
- `email`: User's email address
- `emailNotificationsEnabled`: Boolean to enable/disable emails
- `sendOnEmailDate`: When to send the next email
- `reportFrequency`: 'weekly' or 'monthly'
- `companyName`: For personalization (optional)
- `reportEmailAddress`: Where to send emails (defaults to email)

## 🧪 Testing

### Test Email Functionality
```bash
cd functions
node test-email.js
```

### Manual Trigger
```bash
curl -X POST https://your-region-your-project.cloudfunctions.net/sendEmailRemindersManual
```

## 📊 Monitoring

Monitor your functions in the Firebase Console:
1. Go to Firebase Console > Functions
2. View logs for `sendDailyEmailReminders`
3. Check execution history and any errors

## 🔍 Troubleshooting

### Common Issues

1. **Function Not Running**
   - Check Firebase Functions logs
   - Ensure the function is deployed successfully
   - Verify the schedule is set correctly

2. **No Emails Being Sent**
   - Check that users have `emailNotificationsEnabled: true`
   - Verify `sendOnEmailDate` is set correctly
   - Check that `sendOnEmailDate` is in the past or today

3. **SendGrid Errors**
   - Verify your SendGrid API key has "Mail Send" permissions
   - Ensure your sender email/domain is verified in SendGrid

### View Logs
```bash
firebase functions:log --only sendDailyEmailReminders
```

## 📁 Files Created

- `functions/package.json` - Dependencies and scripts
- `functions/tsconfig.json` - TypeScript configuration
- `functions/src/index.ts` - Main function code
- `functions/README.md` - Detailed documentation
- `functions/env.example` - Environment variables template
- `functions/test-email.js` - Test script
- `functions/deploy.sh` - Deployment script

## 🎯 Next Steps

1. Deploy the functions
2. Test with a few users
3. Monitor the logs
4. Adjust the email template as needed
5. Set up monitoring alerts

## 💡 Tips

- Start with a small test group of users
- Monitor the first few email sends closely
- Consider timezone differences when setting the schedule
- Keep the email template professional and actionable
- Test the manual trigger function before relying on the scheduled one 