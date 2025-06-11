import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

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
}

// Function to send email using SendGrid
async function sendEmail(userData: UserData): Promise<boolean> {
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
    
    console.log(`Email sent successfully to: ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${userData.email}:`, error);
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

// Main function that runs daily to check and send emails
export const sendDailyEmailReminders = functions.pubsub
  .schedule('0 9 * * *') // Run daily at 9:00 AM
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting daily email reminder process...');
      
      const now = new Date();
      const usersRef = db.collection('clients');
      
      // Query for users who:
      // 1. Have email notifications enabled
      // 2. Have sendOnEmailDate that is today or in the past
      // 3. Haven't been sent an email recently (optional check)
      const query = usersRef
        .where('emailNotificationsEnabled', '==', true)
        .where('sendOnEmailDate', '<=', admin.firestore.Timestamp.fromDate(now));
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        console.log('No users found that need email reminders.');
        return null;
      }
      
      console.log(`Found ${snapshot.size} users that need email reminders.`);
      
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
            const emailSent = await sendEmail(userData);
            if (emailSent) {
              await updateUserEmailStatus(userId, userData);
            }
          } catch (error) {
            console.error(`Error processing email for user ${userData.email}:`, error);
          }
        })();
        
        emailPromises.push(emailPromise);
      });
      
      // Wait for all emails to be processed
      await Promise.all(emailPromises);
      
      console.log('Daily email reminder process completed successfully.');
      return null;
    } catch (error) {
      console.error('Error in daily email reminder process:', error);
      throw error;
    }
  });

// Optional: Function to manually trigger email sending (for testing)
export const sendEmailRemindersManual = functions.https.onRequest(async (req, res) => {
  try {
    // Add authentication check here if needed
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    
    console.log('Manual email reminder trigger...');
    
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
    
    for (const doc of snapshot.docs) {
      const userData = doc.data() as UserData;
      const userId = doc.id;
      
      try {
        const emailSent = await sendEmail(userData);
        if (emailSent) {
          await updateUserEmailStatus(userId, userData);
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing email for user ${userData.email}:`, error);
        errorCount++;
      }
    }
    
    res.json({
      message: 'Manual email reminder process completed',
      total: snapshot.size,
      success: successCount,
      errors: errorCount
    });
  } catch (error) {
    console.error('Error in manual email reminder process:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}); 