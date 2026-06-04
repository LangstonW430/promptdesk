export interface SampleTag {
  label: string
  color: string
}

export interface SampleNote {
  body: string
  noteType: string
  daysAgo: number
}

export interface SampleTask {
  title: string
  dueDaysFromNow: number
}

export interface SampleClientDef {
  companyName: string
  contactName: string
  email: string
  industry: string
  status: string
  estimatedValue: number
  lastContactDaysAgo: number
  nextFollowupDaysFromNow: number
  painPoints: string
  tags: SampleTag[]
  notes: SampleNote[]
  task: SampleTask
}

export const SAMPLE_CLIENTS: SampleClientDef[] = [
  {
    companyName: 'Meridian Creative Studio',
    contactName: 'Priya Nair',
    email: 'priya@meridiancreative.com',
    industry: 'Design & Branding',
    status: 'contacted',
    estimatedValue: 8500,
    lastContactDaysAgo: 12,
    nextFollowupDaysFromNow: -3,
    painPoints: 'Needs a new brand identity and website overhaul before a product launch.',
    tags: [
      { label: 'web-design', color: '#6366f1' },
      { label: 'retainer', color: '#10b981' },
    ],
    notes: [
      {
        body: 'Had an intro call with Priya. She wants a full brand refresh — logo, style guide, and a new 5-page site. Timeline is 8 weeks. Budget confirmed at $8.5k.',
        noteType: 'call',
        daysAgo: 12,
      },
      {
        body: 'Sent over a scope doc and proposal outline. She mentioned they may want ongoing retainer support after launch.',
        noteType: 'note',
        daysAgo: 8,
      },
    ],
    task: {
      title: 'Follow up with Priya on proposal — she was reviewing with her co-founder',
      dueDaysFromNow: -3,
    },
  },
  {
    companyName: 'Peaks & Partners LLC',
    contactName: 'James Callahan',
    email: 'j.callahan@peakspartners.com',
    industry: 'Management Consulting',
    status: 'proposal_sent',
    estimatedValue: 22000,
    lastContactDaysAgo: 5,
    nextFollowupDaysFromNow: 7,
    painPoints: 'Looking for an operations consultant to streamline onboarding and reduce churn.',
    tags: [{ label: 'consulting', color: '#f59e0b' }],
    notes: [
      {
        body: 'James referred by a former client. They are scaling fast and losing new hires in the first 60 days. Want a process audit and playbook.',
        noteType: 'note',
        daysAgo: 18,
      },
      {
        body: 'Delivered full proposal. $22k for a 12-week engagement. James said the board reviews next week.',
        noteType: 'call',
        daysAgo: 5,
      },
    ],
    task: {
      title: 'Check in with James after board review — ask for a decision timeline',
      dueDaysFromNow: 7,
    },
  },
  {
    companyName: 'Brightleaf Marketing',
    contactName: 'Sofia Mendez',
    email: 'sofia@brightleafmktg.com',
    industry: 'Digital Marketing',
    status: 'negotiating',
    estimatedValue: 5000,
    lastContactDaysAgo: 35,
    nextFollowupDaysFromNow: -5,
    painPoints: 'Wants help setting up an email nurture sequence and lead scoring in HubSpot.',
    tags: [
      { label: 'marketing', color: '#ec4899' },
    ],
    notes: [
      {
        body: 'Sofia wants to set up automated email sequences for their trial users. They use HubSpot. Agreed on $5k scope in principle.',
        noteType: 'note',
        daysAgo: 40,
      },
    ],
    task: {
      title: 'Re-engage Sofia — deal was close to closing, no response in 5 weeks',
      dueDaysFromNow: -5,
    },
  },
  {
    companyName: 'Tomlin & Reyes Architects',
    contactName: 'Marcus Tomlin',
    email: 'marcus@tomlinreyes.com',
    industry: 'Architecture & Real Estate',
    status: 'lead',
    estimatedValue: 15000,
    lastContactDaysAgo: 3,
    nextFollowupDaysFromNow: 2,
    painPoints: 'Growing firm needs a custom project management portal and client-facing dashboard.',
    tags: [
      { label: 'architecture', color: '#8b5cf6' },
      { label: 'consulting', color: '#f59e0b' },
    ],
    notes: [
      {
        body: 'Marcus found us via LinkedIn. They have 12 architects and manage 30+ active projects. Wants a custom dashboard to share project milestones with clients. Initial scope estimated $12–18k.',
        noteType: 'note',
        daysAgo: 3,
      },
    ],
    task: {
      title: 'Send discovery questionnaire to Marcus and schedule a scoping call',
      dueDaysFromNow: 2,
    },
  },
  {
    companyName: 'Sunriver Spa Group',
    contactName: 'Lena Park',
    email: 'lena@sunriverspa.com',
    industry: 'Wellness & Hospitality',
    status: 'contacted',
    estimatedValue: 3200,
    lastContactDaysAgo: 40,
    nextFollowupDaysFromNow: -10,
    painPoints: 'Small spa group wants a booking and membership site, simple and affordable.',
    tags: [{ label: 'wellness', color: '#14b8a6' }],
    notes: [
      {
        body: 'Lena reached out about building a booking site for 3 spa locations. Wants online memberships too. Budget is tight at ~$3–4k. Sent a ballpark quote.',
        noteType: 'note',
        daysAgo: 40,
      },
    ],
    task: {
      title: 'Reach out to Lena — went quiet after receiving the quote',
      dueDaysFromNow: -10,
    },
  },
]
