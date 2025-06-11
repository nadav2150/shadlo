// Load environment variables from .env file
require('dotenv').config();

const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Test email configuration
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Test user data with AWS and Google credentials
const testUser = {
  email: 'nadav2150@gmail.com',
  companyName: 'Test Company',
  reportEmailAddress: 'nadav2150@gmail.com',
  emailNotificationsEnabled: true,
  reportFrequency: 'weekly',
  // Add your actual AWS credentials here for testing
  awsAccessKeyId: 'AKIAXVLH4NXQO2TXXEGX',
  awsSecretAccessKey: 'l9vYgidOQquFarpPoWs6OqNkO97sf/3khnagkJTc',
  awsRegion: 'us-east-1',
  // Add your actual Google refresh token here for testing
  googleRefreshToken:"1//09Vj22BXiPXw3CgYIARAAGAkSNwF-L9IrUW67rGdI6mWVonzk-HAhgOb_8m-9uoicTjisXmn_f3m9G9XWYI51jVQJODWcEaF3z_Y"
};

// Mock entity data for testing (since we can't easily test AWS/Google APIs in this script)
const mockEntityData = {
  awsUsers: [
    {
      userName: 'test-user-1',
      createDate: '2023-01-01T00:00:00Z',
      lastUsed: '2024-01-15T00:00:00Z',
      policies: [{ name: 'ReadOnlyAccess', type: 'managed' }],
      hasMFA: true,
      provider: 'aws',
      type: 'user',
      riskAssessment: {
        riskLevel: 'low',
        score: 1,
        factors: ['MFA enabled', 'Recent activity']
      }
    }
  ],
  awsRoles: [
    {
      roleName: 'test-role-1',
      createDate: '2023-01-01T00:00:00Z',
      lastUsed: '2024-01-10T00:00:00Z',
      policies: [{ name: 'AdministratorAccess', type: 'managed' }],
      trustPolicy: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}',
      provider: 'aws',
      type: 'role',
      riskAssessment: {
        riskLevel: 'high',
        score: 7,
        factors: ['Administrator access', 'High permissions']
      }
    }
  ],
  googleUsers: [
    {
      id: 'test-google-user-1',
      primaryEmail: 'test@example.com',
      name: { fullName: 'Test User', givenName: 'Test', familyName: 'User' },
      isAdmin: false,
      isEnrolledIn2Sv: true,
      provider: 'google',
      type: 'user',
      createDate: '2023-01-01T00:00:00Z',
      lastUsed: '2024-01-20T00:00:00Z',
      policies: [],
      hasMFA: true,
      suspended: false,
      riskAssessment: {
        riskLevel: 'low',
        score: 0,
        factors: ['2FA enabled', 'Recent activity']
      }
    }
  ]
};

// Function to generate a simple PDF for testing
async function generateTestPDF(companyName) {
  const { jsPDF } = require('jspdf');
  
  const doc = new jsPDF();
  
  // Add header
  doc.setFontSize(20);
  doc.text('Security Entities Report', 15, 20);
  doc.setFontSize(12);
  doc.text(`Company: ${companyName}`, 15, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 35);
  doc.text('(Test Report)', 15, 40);
  
  // Add summary
  doc.setFontSize(14);
  doc.text('Security Score Summary', 15, 55);
  doc.setFontSize(10);
  doc.text(`Total Entities: ${mockEntityData.awsUsers.length + mockEntityData.awsRoles.length + mockEntityData.googleUsers.length}`, 15, 65);
  doc.text(`AWS Users: ${mockEntityData.awsUsers.length}`, 15, 70);
  doc.text(`AWS Roles: ${mockEntityData.awsRoles.length}`, 15, 75);
  doc.text(`Google Users: ${mockEntityData.googleUsers.length}`, 15, 80);
  
  // Add entity details without table for now
  doc.setFontSize(12);
  doc.text('Entity Details:', 15, 95);
  
  let yPos = 105;
  const allEntities = [...mockEntityData.awsUsers, ...mockEntityData.awsRoles, ...mockEntityData.googleUsers];
  
  allEntities.forEach((entity, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    const name = entity.userName || entity.roleName || entity.primaryEmail;
    const riskFactors = entity.riskAssessment?.factors || [];
    const riskFactorText = riskFactors.length > 0 
      ? riskFactors.slice(0, 2).join(', ') + (riskFactors.length > 2 ? '...' : '')
      : 'None';
    
    doc.setFontSize(10);
    doc.text(`${index + 1}. ${name} (${entity.type}, ${entity.provider})`, 15, yPos);
    doc.setFontSize(8);
    doc.text(`   Risk Level: ${entity.riskAssessment?.riskLevel || 'low'}`, 20, yPos + 5);
    doc.text(`   Risk Factors: ${riskFactorText}`, 20, yPos + 10);
    
    yPos += 20;
  });

  // Convert to buffer
  return Buffer.from(doc.output('arraybuffer'));
}

// Test email function with PDF attachment
async function sendTestEmailWithReport(userData) {
  try {
    const toEmail = userData.reportEmailAddress || userData.email;
    const companyName = userData.companyName || 'User';
    
    // Generate test PDF
    console.log('Generating test PDF...');
    const pdfBuffer = await generateTestPDF(companyName);
    
    // Generate filename for the PDF
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const filename = `test-security-report-${companyName}-${day}-${month}-${year}.pdf`;
    
    // Create summary data
    const summary = {
      totalEntities: mockEntityData.awsUsers.length + mockEntityData.awsRoles.length + mockEntityData.googleUsers.length,
      awsUsers: mockEntityData.awsUsers.length,
      awsRoles: mockEntityData.awsRoles.length,
      googleUsers: mockEntityData.googleUsers.length,
      scores: {
        lastUsedScore: 2.5,
        permissionScore: 3.0,
        identityScore: 1.5
      },
      riskLevels: {
        critical: 0,
        high: 1,
        medium: 0,
        low: 2
      }
    };
    
    const emailContent = {
      to: toEmail,
      from: FROM_EMAIL,
      subject: `Test Security Report - ${companyName} - ${day}/${month}/${year}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Test Security Report</h2>
          <p>Hello ${companyName},</p>
          <p>This is a <strong>TEST</strong> security report. Please find the detailed analysis attached to this email.</p>
          
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
          
          <p><strong>Note:</strong> This is a test report with mock data. In production, this would include real entity data from your AWS and Google accounts.</p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>Your Security Team</p>
        </div>
      `,
      text: `
        Test Security Report
        
        Hello ${companyName},
        
        This is a TEST security report. Please find the detailed analysis attached to this email.
        
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
        
        Note: This is a test report with mock data. In production, this would include real entity data from your AWS and Google accounts.
        
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
    console.log(`✅ Test email with PDF report sent successfully to: ${toEmail}`);
    console.log(`📎 PDF filename: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send test email with report to ${userData.email}:`, error);
    return false;
  }
}

// Run test
async function runTest() {
  console.log('🧪 Testing enhanced email functionality with PDF reports...');
  console.log('📧 SendGrid API Key:', SENDGRID_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('📧 From Email:', FROM_EMAIL);
  console.log('📧 Test User:', testUser.email);
  console.log('🏢 Company Name:', testUser.companyName);
  console.log('🔑 AWS Credentials:', testUser.awsAccessKeyId ? '✅ Set' : '❌ Not set');
  console.log('🔑 Google Refresh Token:', testUser.googleRefreshToken ? '✅ Set' : '❌ Not set');
  
  if (!SENDGRID_API_KEY) {
    console.log('❌ Please set SENDGRID_API_KEY environment variable');
    return;
  }
  
  const result = await sendTestEmailWithReport(testUser);
  if (result) {
    console.log('🎉 Test completed successfully!');
    console.log('📋 Check your email for the test report with PDF attachment.');
  } else {
    console.log('💥 Test failed!');
  }
}

runTest(); 