import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';
import { getEntityDataAndGenerateReport } from './entityService';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Configure SendGrid
const SENDGRID_API_KEY = functions.config().sendgrid?.api_key || process.env.SENDGRID_API_KEY;
const FROM_EMAIL = functions.config().email?.from || process.env.FROM_EMAIL || 'noreply@yourdomain.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Interface for user data
interface UserData {
  email: string;
  companyName?: string;
  reportEmailAddress?: string;
  emailNotificationsEnabled?: boolean;
  reportFrequency?: string;
  sendOnEmailDate?: admin.firestore.Timestamp | Date | string;
  lastEmailSent?: admin.firestore.Timestamp | Date | string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  googleRefreshToken?: string;
}

// Function to send email with PDF attachment using SendGrid
async function sendEmailWithReport(userData: UserData, pdfBuffer: Buffer, summary: any): Promise<boolean> {
  try {
    const toEmail = userData.reportEmailAddress || userData.email;
    const companyName = userData.companyName || 'User';
    
    // Generate filename for the PDF
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const filename = `security-report-${companyName}-${day}-${month}-${year}.pdf`;
    
    const emailContent = {
      to: toEmail,
      from: FROM_EMAIL,
      subject: `Security Report - ${companyName} - ${day}/${month}/${year}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Security Report</h2>
          <p>Hello ${companyName},</p>
          <p>Your security report is ready! Please find the detailed analysis attached to this email.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Report Summary</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 8px 0;"><strong>Total Entities:</strong> ${summary.totalEntities}</li>
              <li style="margin: 8px 0;"><strong>AWS Users:</strong> ${summary.awsUsers}</li>
              <li style="margin: 8px 0;"><strong>AWS Roles:</strong> ${summary.awsRoles}</li>
              <li style="margin: 8px 0;"><strong>Google Users:</strong> ${summary.googleUsers}</li>
            </ul>
            
            <h4 style="color: #34495e; margin-top: 20px;">Security Scores</h4>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 8px 0;"><strong>Last Used Score:</strong> ${summary.scores.lastUsedScore.toFixed(2)}/5</li>
              <li style="margin: 8px 0;"><strong>Permission Score:</strong> ${summary.scores.permissionScore.toFixed(2)}/5</li>
              <li style="margin: 8px 0;"><strong>Identity Score:</strong> ${summary.scores.identityScore.toFixed(2)}/5</li>
            </ul>
            
            <h4 style="color: #34495e; margin-top: 20px;">Risk Levels</h4>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 8px 0; color: #e74c3c;"><strong>Critical:</strong> ${summary.riskLevels.critical}</li>
              <li style="margin: 8px 0; color: #f39c12;"><strong>High:</strong> ${summary.riskLevels.high}</li>
              <li style="margin: 8px 0; color: #f1c40f;"><strong>Medium:</strong> ${summary.riskLevels.medium}</li>
              <li style="margin: 8px 0; color: #27ae60;"><strong>Low:</strong> ${summary.riskLevels.low}</li>
            </ul>
          </div>
          
          <p>This report includes:</p>
          <ul>
            <li>Complete entity inventory (users and roles)</li>
            <li>Risk assessment for each entity</li>
            <li>Security score calculations</li>
            <li>Detailed risk factor analysis</li>
            <li>Recommendations for improvement</li>
          </ul>
          
          <p>Please review the attached PDF for detailed insights and take action on any high-risk findings.</p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>Your Security Team</p>
        </div>
      `,
      text: `
        Security Report
        
        Hello ${companyName},
        
        Your security report is ready! Please find the detailed analysis attached to this email.
        
        Report Summary:
        - Total Entities: ${summary.totalEntities}
        - AWS Users: ${summary.awsUsers}
        - AWS Roles: ${summary.awsRoles}
        - Google Users: ${summary.googleUsers}
        
        Security Scores:
        - Last Used Score: ${summary.scores.lastUsedScore.toFixed(2)}/5
        - Permission Score: ${summary.scores.permissionScore.toFixed(2)}/5
        - Identity Score: ${summary.scores.identityScore.toFixed(2)}/5
        
        Risk Levels:
        - Critical: ${summary.riskLevels.critical}
        - High: ${summary.riskLevels.high}
        - Medium: ${summary.riskLevels.medium}
        - Low: ${summary.riskLevels.low}
        
        This report includes complete entity inventory, risk assessment, security score calculations, detailed risk factor analysis, and recommendations for improvement.
        
        Please review the attached PDF for detailed insights and take action on any high-risk findings.
        
        If you have any questions or need assistance, please don't hesitate to contact our support team.
        
        Best regards,
        Your Security Team
      `,
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: filename,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };

    await sgMail.send(emailContent);
    
    console.log(`Email with PDF report sent successfully to: ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email with report to ${userData.email}:`, error);
    return false;
  }
}

// Function to update user's lastEmailSent and calculate next sendOnEmailDate
async function updateUserEmailStatus(userId: string, userData: UserData): Promise<void> {
  try {
    const now = admin.firestore.Timestamp.now();
    const userRef = db.collection('clients').doc(userId);
    
    // Calculate next sendOnEmailDate based on report frequency
    const frequency = userData.reportFrequency || 'weekly';
    const daysToAdd = frequency === 'monthly' ? 30 : 7;
    const nextSendDate = new Date();
    nextSendDate.setDate(nextSendDate.getDate() + daysToAdd);
    
    await userRef.update({
      lastEmailSent: now,
      sendOnEmailDate: admin.firestore.Timestamp.fromDate(nextSendDate)
    });
    
    console.log(`Updated email status for user: ${userData.email}`);
  } catch (error) {
    console.error(`Failed to update email status for user ${userData.email}:`, error);
    throw error;
  }
}

// Main function that runs daily to check and send emails with reports
export const sendDailyEmailReminders = functions.pubsub
  .schedule('0 9 * * *') // Run daily at 9:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting daily email reminder process with entity reports...');
      
      const now = new Date();
      const usersRef = db.collection('clients');
      
      // Query for users who:
      // 1. Have email notifications enabled
      // 2. Have sendOnEmailDate that is today or in the past
      const query = usersRef
        .where('emailNotificationsEnabled', '==', true)
        .where('sendOnEmailDate', '<=', admin.firestore.Timestamp.fromDate(now));
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        console.log('No users found that need email reminders.');
        return null;
      }
      
      console.log(`Found ${snapshot.size} users that need email reminders with reports.`);
      
      const emailPromises: Promise<void>[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data() as UserData;
        const userId = doc.id;
        
        // Additional check: don't send if we sent an email in the last 24 hours
        if (userData.lastEmailSent) {
          const lastEmailDate = userData.lastEmailSent instanceof admin.firestore.Timestamp 
            ? userData.lastEmailSent.toDate() 
            : new Date(userData.lastEmailSent);
          
          const hoursSinceLastEmail = (now.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastEmail < 24) {
            console.log(`Skipping ${userData.email} - email sent recently (${hoursSinceLastEmail.toFixed(1)} hours ago)`);
            return;
          }
        }
        
        const emailPromise = (async () => {
          try {
            console.log(`Processing report for user: ${userData.email}`);
            
            // Get entity data and generate PDF report
            const reportData = await getEntityDataAndGenerateReport(userData);
            
            if (reportData) {
              // Send email with PDF attachment
              const emailSent = await sendEmailWithReport(userData, reportData.pdfBuffer, reportData.summary);
              if (emailSent) {
                await updateUserEmailStatus(userId, userData);
                console.log(`Successfully sent report email to: ${userData.email}`);
              }
            } else {
              console.log(`No entity data available for user: ${userData.email}, sending basic reminder`);
              // Fallback to basic email if no entity data
              const basicEmailSent = await sendBasicEmail(userData);
              if (basicEmailSent) {
                await updateUserEmailStatus(userId, userData);
              }
            }
          } catch (error) {
            console.error(`Error processing email for user ${userData.email}:`, error);
            // Try to send basic email as fallback
            try {
              const basicEmailSent = await sendBasicEmail(userData);
              if (basicEmailSent) {
                await updateUserEmailStatus(userId, userData);
              }
            } catch (fallbackError) {
              console.error(`Fallback email also failed for user ${userData.email}:`, fallbackError);
            }
          }
        })();
        
        emailPromises.push(emailPromise);
      });
      
      // Wait for all emails to be processed
      await Promise.all(emailPromises);
      
      console.log('Daily email reminder process with reports completed successfully.');
      return null;
    } catch (error) {
      console.error('Error in daily email reminder process:', error);
      throw error;
    }
  });

// Fallback function to send basic email without report
async function sendBasicEmail(userData: UserData): Promise<boolean> {
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
    
    console.log(`Basic email sent successfully to: ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`Failed to send basic email to ${userData.email}:`, error);
    return false;
  }
}

// Optional: Function to manually trigger email sending with reports (for testing)
export const sendEmailRemindersManual = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    // Add authentication check here if needed
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    
    console.log('Manual email reminder trigger with reports...');
    
    const now = new Date();
    const usersRef = db.collection('clients');
    
    const query = usersRef
      .where('emailNotificationsEnabled', '==', true)
      .where('sendOnEmailDate', '<=', admin.firestore.Timestamp.fromDate(now));
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      res.json({ message: 'No users found that need email reminders.', count: 0 });
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let reportCount = 0;
    let basicEmailCount = 0;
    
    for (const doc of snapshot.docs) {
      const userData = doc.data() as UserData;
      const userId = doc.id;
      
      try {
        console.log(`Processing report for user: ${userData.email}`);
        
        // Get entity data and generate PDF report
        const reportData = await getEntityDataAndGenerateReport(userData);
        
        if (reportData) {
          // Send email with PDF attachment
          const emailSent = await sendEmailWithReport(userData, reportData.pdfBuffer, reportData.summary);
          if (emailSent) {
            await updateUserEmailStatus(userId, userData);
            successCount++;
            reportCount++;
          } else {
            errorCount++;
          }
        } else {
          console.log(`No entity data available for user: ${userData.email}, sending basic reminder`);
          // Fallback to basic email if no entity data
          const basicEmailSent = await sendBasicEmail(userData);
          if (basicEmailSent) {
            await updateUserEmailStatus(userId, userData);
            successCount++;
            basicEmailCount++;
          } else {
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing email for user ${userData.email}:`, error);
        errorCount++;
      }
    }
    
    res.json({
      message: 'Manual email reminder process with reports completed',
      total: snapshot.size,
      success: successCount,
      errors: errorCount,
      reportsSent: reportCount,
      basicEmailsSent: basicEmailCount
    });
  } catch (error) {
    console.error('Error in manual email reminder process:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}); 