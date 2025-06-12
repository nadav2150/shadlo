# Shadlo - Cloud Identity & Access Management Dashboard

A comprehensive web application for managing and monitoring cloud identity and access management across multiple cloud providers (AWS IAM, Google Workspace). Built with Remix, TypeScript, and Tailwind CSS.

## 🚀 Features

### 🔐 Multi-Cloud IAM Management
- **AWS IAM Integration**: View and manage IAM users, roles, and policies
- **Google Workspace Integration**: Manage Google users and groups
- **Unified Dashboard**: Single interface for all cloud identities
- **Real-time Monitoring**: Live status and activity tracking

### 📊 Analytics & Reporting
- **Security Analytics**: Comprehensive security insights and metrics
- **User Activity Tracking**: Monitor user actions and access patterns
- **Cost Optimization**: Track resource usage and identify optimization opportunities
- **Compliance Reporting**: Generate compliance reports and audits

### 🏷️ Advanced Tagging System
- **Resource Tagging**: Tag AWS IAM users and roles for better organization
- **Cost Allocation**: Track costs by department, project, or environment
- **Security Classification**: Tag resources by security level and purpose
- **Automated Tag Management**: Bulk tagging operations and templates

### 📧 Automated Notifications
- **Email Reminders**: Automated security report reminders
- **Customizable Schedules**: Weekly or monthly report frequency
- **SendGrid Integration**: Professional email delivery
- **User Preferences**: Individual notification settings

### 🔒 Security Features
- **OAuth Authentication**: Secure Google OAuth integration
- **AWS Credentials Management**: Secure credential storage and rotation
- **Role-Based Access**: Granular permission controls
- **Audit Logging**: Comprehensive activity logging

## 🛠️ Tech Stack

- **Frontend**: Remix, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI Components
- **Backend**: Node.js, Firebase Functions
- **Database**: Prisma ORM
- **Authentication**: Google OAuth, Firebase Auth
- **Cloud Services**: AWS SDK, Google APIs, SendGrid
- **Charts**: Chart.js, React Chart.js 2
- **PDF Generation**: jsPDF
- **Caching**: Redis (ioredis)

## 📁 Project Structure

```
shadlo/
├── app/                          # Main Remix application
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Base UI components (buttons, forms, etc.)
│   │   ├── Alerts.tsx           # Alert/notification components
│   │   ├── AppSidebar.tsx       # Main navigation sidebar
│   │   ├── AwsCredentialsForm.tsx # AWS credentials management
│   │   ├── CredentialsForm.tsx  # Generic credentials form
│   │   ├── LoadingSpinner.tsx   # Loading indicators
│   │   ├── Stats.tsx            # Statistics display components
│   │   └── Timeline.tsx         # Timeline visualization
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utility libraries and configurations
│   │   ├── iam/                 # AWS IAM operations and types
│   │   └── ...                  # Other utility modules
│   ├── routes/                  # Remix route components
│   │   ├── _index.tsx          # Dashboard home page
│   │   ├── entities.tsx        # IAM entities management
│   │   ├── providers.tsx       # Cloud provider management
│   │   ├── settings.tsx        # Application settings
│   │   ├── sign-in.tsx         # Authentication page
│   │   ├── aws-setup.tsx       # AWS configuration
│   │   └── api.*.ts            # API endpoints
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Utility functions
│   ├── entry.client.tsx        # Client-side entry point
│   ├── entry.server.tsx        # Server-side entry point
│   ├── root.tsx                # Root layout component
│   └── tailwind.css            # Tailwind CSS styles
├── functions/                   # Firebase Cloud Functions
│   ├── src/                    # Function source code
│   ├── lib/                    # Function utilities
│   ├── package.json           # Function dependencies
│   ├── test-email.js          # Email testing script
│   └── deploy.sh              # Deployment script
├── prisma/                     # Database schema and migrations
│   └── schema.prisma          # Prisma database schema
├── public/                     # Static assets
├── docs/                       # Documentation files
├── scripts/                    # Build and deployment scripts
├── build/                      # Production build output
├── package.json               # Main project dependencies
├── vite.config.ts             # Vite configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── firebase.json              # Firebase configuration
└── .firebaserc                # Firebase project settings
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20.0.0 or higher
- npm or yarn package manager
- Firebase CLI (for deployment)
- AWS CLI (for AWS integration)
- Google Cloud Console access (for Google Workspace integration)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shadlo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Configure Firebase**
   ```bash
   firebase login
   firebase use <your-project-id>
   ```

5. **Set up database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# SendGrid (for email notifications)
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@yourdomain.com

# Redis (for caching)
REDIS_URL=your_redis_url
```

## 🔧 Configuration

### AWS IAM Setup
1. Create an IAM user with appropriate permissions
2. Generate access keys
3. Apply the IAM policies from `docs/IAM-TAGS-SETUP.md`
4. Configure AWS credentials in the application

### Google Workspace Setup
1. Create a Google Cloud project
2. Enable Google Workspace Admin SDK API
3. Create OAuth 2.0 credentials
4. Configure domain-wide delegation

### Firebase Functions Setup
1. Navigate to the `functions` directory
2. Install dependencies: `npm install`
3. Configure SendGrid API key
4. Deploy functions: `npm run deploy`

## 📚 Documentation

- [Tags Implementation Guide](TAGS-IMPLEMENTATION-SUMMARY.md) - Complete guide for IAM tagging system
- [Firebase Email Setup](FIREBASE_EMAIL_SETUP.md) - Email notification configuration
- [IAM Tags Setup](docs/IAM-TAGS-SETUP.md) - AWS IAM permissions and tagging setup

## 🧪 Testing

```bash
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Test email functionality
cd functions && node test-email.js

# Test AWS integration
npm run test:aws
```

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Firebase Deployment
```bash
# Deploy functions
cd functions && npm run deploy

# Deploy hosting
firebase deploy --only hosting
```

### Environment-Specific Deployments
- **Development**: `npm run dev`
- **Staging**: Configure staging environment variables
- **Production**: Use production Firebase project

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` directory for detailed guides
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Join community discussions for help and ideas

## 🔮 Roadmap

- [ ] Multi-tenant support
- [ ] Advanced role-based access control
- [ ] Integration with additional cloud providers
- [ ] Real-time collaboration features
- [ ] Advanced analytics and reporting
- [ ] Mobile application
- [ ] API rate limiting and optimization
- [ ] Enhanced security features

---

**Built with ❤️ using Remix, TypeScript, and modern web technologies**
