interface GoogleUser {
  lastLoginTime: string | null;
  suspended?: boolean;
  isAdmin: boolean;
  isDelegatedAdmin?: boolean;
  changePasswordAtNextLogin?: boolean;
  isMailboxSetup: boolean;
  isEnrolledIn2Sv: boolean;
}

export function calculateRiskScore(user: GoogleUser): {
  score: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  factors: string[];
} {
  let score = 0;
  const factors: string[] = [];

  // Check last login time (1970-01-01 indicates never logged in)
  if (!user.lastLoginTime || user.lastLoginTime.startsWith('1970-01-01')) {
    score += 3;
    factors.push('Never logged in');
  }

  // Check if user is suspended
  if (user.suspended) {
    score += 2;
    factors.push('Account is suspended');
  }

  // Check admin status
  if (user.isAdmin || user.isDelegatedAdmin) {
    score += 2;
    factors.push('User has admin privileges');
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
    score += 1;
    factors.push('Not enrolled in 2-Step Verification');
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