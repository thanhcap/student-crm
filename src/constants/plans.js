// Plan feature matrix — the single source of truth for what's on what plan.
// hasFeature(plan, key) is used to gate nav items, sections, and limits.
export const PLAN_FEATURES = {
  free: {
    maxContacts: 25,
    emailSequences: false,
    emailInbox: false,
    dealPipeline: true,        // basic — up to 5 deals
    maxDeals: 5,
    networkGraph: false,
    leadGeneration: false,
    calendarBooking: false,
    videoMessages: false,
    birthdayAutomation: false,
    teamFeatures: false,
    apiAccess: false,
    careerSuite: true,         // free — the student use case
    coldOutreach: false,
  },
  pro: {
    maxContacts: Infinity,
    emailSequences: true,
    emailInbox: true,
    dealPipeline: true,
    maxDeals: Infinity,
    networkGraph: true,
    leadGeneration: true,
    calendarBooking: true,
    videoMessages: false,
    birthdayAutomation: true,
    teamFeatures: false,
    apiAccess: true,
    careerSuite: true,
    coldOutreach: true,
  },
  max: {
    maxContacts: Infinity,
    emailSequences: true,
    emailInbox: true,
    dealPipeline: true,
    maxDeals: Infinity,
    networkGraph: true,
    leadGeneration: true,
    calendarBooking: true,
    videoMessages: true,
    birthdayAutomation: true,
    teamFeatures: true,
    apiAccess: true,
    careerSuite: true,
    coldOutreach: true,
  },
};

export function getPlanLevel(plan) {
  return { free: 0, pro: 1, max: 2 }[plan] ?? 0;
}

export function hasFeature(userPlan, feature) {
  const plan = userPlan || 'free';
  return PLAN_FEATURES[plan]?.[feature] ?? PLAN_FEATURES.free[feature] ?? false;
}

export function contactLimit(userPlan) {
  return PLAN_FEATURES[userPlan || 'free']?.maxContacts ?? PLAN_FEATURES.free.maxContacts;
}
