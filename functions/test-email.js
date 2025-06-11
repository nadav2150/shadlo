// Load environment variables from .env file
require('dotenv').config();

const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Initialize Firebase Admin (you'll need to set up service account)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
//   projectId: 'your-project-id'
// });

// Test email configuration
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Test user data
const testUser = {
  email: 'nadav2150@gmail.com',
  companyName: 'Test Company',
  reportEmailAddress: 'nadav2150@gmail.com',
  emailNotificationsEnabled: true,
  reportFrequency: 'weekly'
};

// Test email function
async function sendTestEmail(userData) {
  try {
    const toEmail = userData.reportEmailAddress || userData.email;
    const companyName = userData.companyName || 'User';
    
    const emailContent = {
      to: toEmail,
      from: FROM_EMAIL,
      subject: `Security Report Reminder - ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Security Report Reminder</h2>
          <p>Hello ${companyName},</p>
          <p>This is a friendly reminder that it's time to review your security report.</p>
          <p>Please log in to your dashboard to view the latest security insights and recommendations.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">What's included in your report:</h3>
            <ul>
              <li>Security policy compliance status</li>
              <li>Risk assessment updates</li>
              <li>Recommended security improvements</li>
              <li>User access reviews</li>
            </ul>
          </div>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>Your Security Team</p>
        </div>
      `,
      text: `
        Security Report Reminder
        
        Hello ${companyName},
        
        This is a friendly reminder that it's time to review your security report.
        Please log in to your dashboard to view the latest security insights and recommendations.
        
        What's included in your report:
        - Security policy compliance status
        - Risk assessment updates
        - Recommended security improvements
        - User access reviews
        
        If you have any questions or need assistance, please don't hesitate to contact our support team.
        
        Best regards,
        Your Security Team
      `
    };

    await sgMail.send(emailContent);
    console.log(`✅ Test email sent successfully to: ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send test email to ${userData.email}:`, error);
    return false;
  }
}

// Run test
async function runTest() {
  console.log('🧪 Testing email functionality...');
  console.log('📧 SendGrid API Key:', SENDGRID_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('📧 From Email:', FROM_EMAIL);
  console.log('📧 Test User:', testUser.email);
  
  if (!SENDGRID_API_KEY) {
    console.log('❌ Please set SENDGRID_API_KEY environment variable');
    return;
  }
  
  const result = await sendTestEmail(testUser);
  if (result) {
    console.log('🎉 Test completed successfully!');
  } else {
    console.log('💥 Test failed!');
  }
}

runTest(); 