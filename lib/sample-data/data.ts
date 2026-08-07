export interface SampleTag {
  label: string
  color: string
}

export interface SampleNote {
  body: string
  noteType: string
  daysAgo: number
}

export interface SampleProjectTask {
  title: string
  isDone: boolean
}

export interface SampleProjectTimeEntry {
  daysAgo: number
  hours: number
  rate: number
  description: string
  isBillable: boolean
}

export interface SampleProject {
  title:        string
  status:       'proposed' | 'active' | 'completed' | 'on_hold' | 'cancelled'
  startDaysAgo: number
  endDaysAgo:   number | null
  budget:       number | null
  deliverables: string[]
  timeEntries:  SampleProjectTimeEntry[]
  tasks:        SampleProjectTask[]
}

export interface SampleClientDef {
  companyName:              string
  contactName:              string
  email:                    string
  industry:                 string
  status:                   string
  lastContactDaysAgo:       number
  nextFollowupDaysFromNow:  number
  painPoints:               string
  tags:                     SampleTag[]
  notes:                    SampleNote[]
  projects?:                SampleProject[]
}

export const SAMPLE_CLIENTS: SampleClientDef[] = [
  // ── Won client with active projects ─────────────────────────────────────────
  {
    companyName: 'Hartwell Digital',
    contactName: 'Dana Hartwell',
    email: 'dana@hartwelldigital.com',
    industry: 'Digital Marketing',
    status: 'won',
    lastContactDaysAgo: 2,
    nextFollowupDaysFromNow: 14,
    painPoints: 'Needed a complete rebrand and SEO overhaul to compete in a crowded market.',
    tags: [
      { label: 'web-design', color: '#6366f1' },
      { label: 'retainer', color: '#10b981' },
    ],
    notes: [
      {
        body: 'Intro call with Dana. They rebranded 3 years ago and the site looks dated. Wants a fresh identity, new homepage, and a content-led SEO push. Budget confirmed at $14k split across two phases.',
        noteType: 'call',
        daysAgo: 55,
      },
      {
        body: 'Sent proposal. Dana loved the phased approach — design first, then SEO. Signed off same day.',
        noteType: 'email',
        daysAgo: 50,
      },
    ],
    projects: [
      {
        title: 'Brand & Website Redesign',
        status: 'completed',
        startDaysAgo: 48,
        endDaysAgo: 6,
        budget: 8500,
        deliverables: [
          'Logo & brand guide',
          'Homepage redesign',
          '4 interior pages',
          'Email templates',
        ],
        timeEntries: [
          { daysAgo: 46, hours: 3,   rate: 120, description: 'Discovery & brand audit',          isBillable: true },
          { daysAgo: 42, hours: 5,   rate: 120, description: 'Wireframes & sitemap',              isBillable: true },
          { daysAgo: 38, hours: 8,   rate: 120, description: 'Visual design — homepage',          isBillable: true },
          { daysAgo: 34, hours: 6,   rate: 120, description: 'Visual design — interior pages',    isBillable: true },
          { daysAgo: 28, hours: 3.5, rate: 120, description: 'Client review & revisions round 1', isBillable: true },
          { daysAgo: 22, hours: 12,  rate: 120, description: 'Frontend development',              isBillable: true },
          { daysAgo: 14, hours: 3,   rate: 120, description: 'QA & cross-browser testing',        isBillable: true },
          { daysAgo: 8,  hours: 1.5, rate: 120, description: 'Launch & DNS handover',             isBillable: true },
        ],
        tasks: [
          { title: 'Export final brand guide as PDF',           isDone: true },
          { title: 'Hand off all source files to client',       isDone: true },
          { title: 'Submit site to Google Search Console',      isDone: true },
        ],
      },
      {
        title: 'SEO & Content Strategy',
        status: 'active',
        startDaysAgo: 10,
        endDaysAgo: null,
        budget: 5500,
        deliverables: [
          'Keyword research report',
          'On-page SEO audit',
          '10 pillar articles',
          'Internal linking map',
        ],
        timeEntries: [
          { daysAgo: 9, hours: 1,   rate: 120, description: 'Project kick-off call',   isBillable: true },
          { daysAgo: 7, hours: 4.5, rate: 120, description: 'Keyword research',         isBillable: true },
          { daysAgo: 4, hours: 5,   rate: 120, description: 'On-page audit — 20 pages', isBillable: true },
        ],
        tasks: [
          { title: 'Deliver keyword research report to Dana',   isDone: true },
          { title: 'Write pillar article #1 — "Digital Marketing ROI"', isDone: false },
          { title: 'Build internal linking map in Airtable',    isDone: false },
          { title: 'Schedule content calendar review call',     isDone: false },
        ],
      },
    ],
  },

  // ── Active pipeline clients (no projects yet) ────────────────────────────────
  {
    companyName: 'Meridian Creative Studio',
    contactName: 'Priya Nair',
    email: 'priya@meridiancreative.com',
    industry: 'Design & Branding',
    status: 'contacted',
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
    projects: [
      {
        title:        'Website & content refresh',
        status:       'proposed',
        startDaysAgo: 0,
        endDaysAgo:   null,
        budget:       8500,
        deliverables: [
          'Site audit',
          'Content plan',
          'Homepage rebuild',
        ],
        timeEntries:  [],
        tasks:        [],
      },
    ],
  },
  {
    companyName: 'Peaks & Partners LLC',
    contactName: 'James Callahan',
    email: 'j.callahan@peakspartners.com',
    industry: 'Management Consulting',
    status: 'proposal_sent',
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
    projects: [
      {
        title:        'Full brand identity',
        status:       'proposed',
        startDaysAgo: 0,
        endDaysAgo:   null,
        budget:       22000,
        deliverables: [
          'Discovery workshop',
          'Logo suite',
          'Brand guidelines',
          'Collateral pack',
        ],
        timeEntries:  [],
        tasks:        [],
      },
    ],
  },
  {
    companyName: 'Brightleaf Marketing',
    contactName: 'Sofia Mendez',
    email: 'sofia@brightleafmktg.com',
    industry: 'Digital Marketing',
    status: 'negotiating',
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
    projects: [
      {
        title:        'Campaign landing pages',
        status:       'proposed',
        startDaysAgo: 0,
        endDaysAgo:   null,
        budget:       5000,
        deliverables: [
          '3 landing pages',
          'A/B test setup',
        ],
        timeEntries:  [],
        tasks:        [],
      },
    ],
  },
  {
    companyName: 'Tomlin & Reyes Architects',
    contactName: 'Marcus Tomlin',
    email: 'marcus@tomlinreyes.com',
    industry: 'Architecture & Real Estate',
    status: 'lead',
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
    projects: [
      {
        title:        'Portfolio site build',
        status:       'proposed',
        startDaysAgo: 0,
        endDaysAgo:   null,
        budget:       15000,
        deliverables: [
          'Project gallery',
          'Case study templates',
          'CMS setup',
        ],
        timeEntries:  [],
        tasks:        [],
      },
    ],
  },
  {
    companyName: 'Sunriver Spa Group',
    contactName: 'Lena Park',
    email: 'lena@sunriverspa.com',
    industry: 'Wellness & Hospitality',
    status: 'contacted',
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
    projects: [
      {
        title:        'Booking flow redesign',
        status:       'proposed',
        startDaysAgo: 0,
        endDaysAgo:   null,
        budget:       3200,
        deliverables: [
          'Booking UX audit',
          'Checkout redesign',
        ],
        timeEntries:  [],
        tasks:        [],
      },
    ],
  },
]
