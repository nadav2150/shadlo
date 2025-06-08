interface GoogleUser {
  lastLoginTime: string | null;
  suspended?: boolean;
  isAdmin: boolean;
  isDelegatedAdmin?: boolean;
  changePasswordAtNextLogin?: boolean;
  isMailboxSetup: boolean;
  isEnrolledIn2Sv: boolean;
  connectedToAWS?: boolean;
  sensitiveGroups?: string[];
}

export function calculateRiskScore(user: GoogleUser): {
  score: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  factors: string[];
} {
  let score = 0;
  const factors: string[] = [];

  // Check last login time
  if (!user.lastLoginTime || user.lastLoginTime.startsWith('1970-01-01')) {
    score += 5;
    factors.push('Never logged in');
  } else {
    const lastLoginDate = new Date(user.lastLoginTime);
    const now = new Date();
    const daysSinceLastLogin = Math.floor((now.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastLogin > 180) {
      score += 4;
      factors.push('No login activity for over 180 days');
    } else if (daysSinceLastLogin > 90) {
      score += 3;
      factors.push('No login activity for over 90 days');
    }
  }

  // Check if user is suspended
  if (user.suspended) {
    score += 2;
    factors.push('Account is suspended');
  }

  // Check admin status
  if (user.isAdmin) {
    score += 3;
    factors.push('User has admin privileges');
  }

  // Check delegated admin status
  if (user.isDelegatedAdmin) {
    score += 2;
    factors.push('User has delegated admin privileges');
  }

  // Check password change requirement
  if (user.changePasswordAtNextLogin) {
    score += 1;
    factors.push('Password change required at next login');
  }

  // Check mailbox setup
  if (!user.isMailboxSetup) {
    score += 1;
    factors.push('Mailbox not set up');
  }

  // Check 2SV enrollment
  if (!user.isEnrolledIn2Sv) {
    score += 2;
    factors.push('Not enrolled in 2-Step Verification');
  }

  // Check AWS connection
  if (user.connectedToAWS) {
    score += 4;
    factors.push('Connected to AWS');
  }

  // Check sensitive group membership
  const sensitiveGroups = user.sensitiveGroups || [];
  if (sensitiveGroups.some(group => ['admin', 'finance', 'devops'].includes(group.toLowerCase()))) {
    score += 2;
    factors.push('Member of sensitive group');
  }

  // Determine risk level based on score
  let level: 'Low' | 'Medium' | 'High' | 'Critical';
  if (score >= 15) {
    level = 'Critical';
  } else if (score >= 10) {
    level = 'High';
  } else if (score >= 5) {
    level = 'Medium';
  } else {
    level = 'Low';
  }

  return {
    score,
    level,
    factors
  };
} 