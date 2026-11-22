import { Client, Lead } from '../types';

// The MVP team list (TEAM_MEMBERS) was removed in step 2-e: the header shows the signed-in
// profile and owner names come from `team_members`. The MVP names still in the sample rows
// below must be gone from the build before go-live (open item, 2–7 Dec security review).

// Helper to compute dates relative to today so overdue & 90-day counts are always mathematically exact
function daysOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function yearsOffset(years: number, daysTweak: number = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + daysTweak);
  return d.toISOString().split('T')[0];
}

export function getInitialClients(): Client[] {
  // CMMI cycle = 3 years, ISO/IPA cycle = 1 year
  return [
    {
      id: 'c-1',
      company: 'Axon Infotech Ltd',
      contactName: 'Suresh Nambiar',
      email: 'suresh.n@axoninfotech.in',
      phone: '+91 98450 12345',
      service: 'CMMI',
      level: 'ML5',
      // CMMI renewed after 3 years. Date 3 years + 42 days ago -> Overdue by 42 days!
      lastAppraisalDate: yearsOffset(3, -42),
      contractValue: 1250000,
      owner: 'Ramesh',
      notes: 'Bengaluru delivery center. Long-standing client. Renewal audit preparation overdue.',
      activity: [
        {
          at: new Date(Date.now() - 40 * 86400000).toISOString(),
          note: 'Sent renewal warning reminder for CMMI ML5 reassessment.',
          author: 'Ramesh',
        },
        {
          at: new Date(Date.now() - 15 * 86400000).toISOString(),
          note: 'Suresh requested revised appraisal fee breakdown and audit window for Q4.',
          author: 'Pramila',
        },
      ],
    },
    {
      id: 'c-2',
      company: 'Cybershield Technologies',
      contactName: 'Deepak Varma',
      email: 'deepak.v@cybershield.co.in',
      phone: '+91 97110 88231',
      service: 'ISO',
      level: '27001:2022',
      // ISO renewed after 1 year. Date 1 year + 18 days ago -> Overdue by 18 days!
      lastAppraisalDate: yearsOffset(1, -18),
      contractValue: 450000,
      owner: 'Mahesh',
      notes: 'ISMS surveillance audit due. Transition from 2013 to 2022 standard in progress.',
      activity: [
        {
          at: new Date(Date.now() - 20 * 86400000).toISOString(),
          note: 'Internal surveillance audit findings shared with CTO Deepak.',
          author: 'Mahesh',
        },
      ],
    },
    {
      id: 'c-3',
      company: 'Navayuga Cybernetics Private Limited',
      contactName: 'Radhika Kulkarni',
      email: 'radhika@navayuga-cyber.com',
      phone: '+91 98201 44512',
      service: 'CMMI',
      level: 'ML3',
      // CMMI renewed after 3 years. Date 3 years minus 28 days -> Due in 28 days (Within 90d)!
      lastAppraisalDate: yearsOffset(3, 28),
      contractValue: 850000,
      owner: 'Pramila',
      notes: 'Pune unit appraisal due next month. Pre-assessment artifact check scheduled.',
      activity: [
        {
          at: new Date(Date.now() - 10 * 86400000).toISOString(),
          note: 'Reviewed PIID artifacts for Systems & Software engineering groups.',
          author: 'Pramila',
        },
      ],
    },
    {
      id: 'c-4',
      company: 'Trinetra Software Solutions',
      contactName: 'Arjun Sen',
      email: 'arjun.sen@trinetrasoft.in',
      phone: '+91 94330 90123',
      service: 'ISO',
      level: '9001 & 27001',
      // ISO renewal due in 45 days (Within 90d)
      lastAppraisalDate: yearsOffset(1, 45),
      contractValue: 520000,
      owner: 'Sunita',
      notes: 'Kolkata HQ and Salt Lake DC. Dual ISO standard renewal.',
      activity: [
        {
          at: new Date(Date.now() - 5 * 86400000).toISOString(),
          note: 'Confirmed Stage 1 documentation review timeline with quality head.',
          author: 'Sunita',
        },
      ],
    },
    {
      id: 'c-5',
      company: 'Vayu Aerospace Systems',
      contactName: 'Col. Arvind Rao (Retd.)',
      email: 'arvind.rao@vayu-aero.com',
      phone: '+91 98800 66789',
      service: 'CMMI',
      level: 'ML3 DEV',
      // CMMI renewal due in 72 days (Within 90d)
      lastAppraisalDate: yearsOffset(3, 72),
      contractValue: 1100000,
      owner: 'Ramesh',
      notes: 'Avionics DO-178C mapping with CMMI DEV v2.0. Hyderabad aerospace park.',
      activity: [],
    },
    {
      id: 'c-6',
      company: 'Bharat FinTech Systems',
      contactName: 'Neha Mittal',
      email: 'neha.m@bharatfintech.co',
      phone: '+91 98190 33451',
      service: 'ISO',
      level: '27701 (Privacy)',
      // ISO renewal due in 120 days (Upcoming 180d)
      lastAppraisalDate: yearsOffset(1, 120),
      contractValue: 600000,
      owner: 'Pramila',
      notes: 'PIMS certification renewal. RBI compliance audit alignment required.',
      activity: [],
    },
    {
      id: 'c-7',
      company: 'Dhruv Digital Labs',
      contactName: 'Kartik Iyer',
      email: 'kartik@dhruvdigitallabs.com',
      phone: '+91 98402 77890',
      service: 'CMMI',
      level: 'ML5',
      // CMMI renewal due in 160 days (Upcoming 180d)
      lastAppraisalDate: yearsOffset(3, 160),
      contractValue: 1450000,
      owner: 'Ramesh',
      notes: 'High maturity CAR and OPM statistical process control audits scheduled.',
      activity: [],
    },
    {
      id: 'c-8',
      company: 'Sarvodaya Health Informatics',
      contactName: 'Dr. Vivek Sharma',
      email: 'vivek@sarvodayahi.org',
      phone: '+91 99100 55432',
      service: 'ISO',
      level: '13485 (Medical)',
      // ISO renewal due in 220 days (Later)
      lastAppraisalDate: yearsOffset(1, 220),
      contractValue: 480000,
      owner: 'Sunita',
      notes: 'Medical device software certification. Gurgaon health-tech center.',
      activity: [],
    },
    {
      id: 'c-9',
      company: 'Kalyani Cloud Dynamics',
      contactName: 'Meera Deshmukh',
      email: 'meera.d@kalyanicloud.com',
      phone: '+91 98220 11987',
      service: 'IPA',
      level: 'Process Audit',
      // IPA renewal due in 260 days (Later)
      lastAppraisalDate: yearsOffset(1, 260),
      contractValue: 380000,
      owner: 'Mahesh',
      notes: 'Infrastructure and process assessment for government cloud empanelment.',
      activity: [],
    },
    {
      id: 'c-10',
      company: 'Samudra Telecom Networks',
      contactName: 'Girish Patil',
      email: 'girish@samudratel.com',
      phone: '+91 98900 44211',
      service: 'ISO',
      level: '22301 (BCMS)',
      // ISO renewal due in 290 days (Later)
      lastAppraisalDate: yearsOffset(1, 290),
      contractValue: 500000,
      owner: 'Mahesh',
      notes: 'Business Continuity Management audit across 4 data centers in Maharashtra.',
      activity: [],
    },
    {
      id: 'c-11',
      company: 'Zenith Core Analytics',
      contactName: 'Pooja Hegde',
      email: 'pooja.hegde@zenithcore.io',
      phone: '+91 98860 88901',
      service: 'CMMI',
      level: 'ML3 SVC',
      // CMMI renewal due in 500 days (Later)
      lastAppraisalDate: yearsOffset(3, 500),
      contractValue: 780000,
      owner: 'Pramila',
      notes: 'CMMI Services appraisal completed last year. Mid-term review due in 2027.',
      activity: [],
    },
    {
      id: 'c-12',
      company: 'Tejas Process Engineering',
      contactName: 'Naveen Reddy',
      email: 'naveen@tejasprocess.in',
      phone: '+91 98480 33112',
      service: 'ISO',
      level: '9001:2015',
      // ISO renewal due in 310 days (Later)
      lastAppraisalDate: yearsOffset(1, 310),
      contractValue: 320000,
      owner: 'Sunita',
      notes: 'Industrial IoT embedded firmware QA process validation.',
      activity: [],
    },
  ];
}

export function getInitialLeads(): Lead[] {
  return [
    {
      id: 'l-1',
      company: 'Kavach Embedded Labs',
      contactName: 'Ananya Roy',
      email: 'ananya.roy@kavachlabs.in',
      phone: '+91 98300 12987',
      source: 'External Marketing',
      stage: 'Contacted',
      value: 750000,
      owner: 'Pramila',
      lastContactDate: daysOffset(-11), // 11 days quiet!
      nextFollowUpDate: daysOffset(-4), // overdue follow up
      meetingContext:
        'Pramila walked Ananya through the ISO 27001:2022 roadmap and sent the scope covering their Mumbai and Pune sites. Client was concerned about timeline for SOC2 dual audit.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 14 * 86400000).toISOString(),
          note: 'Lead received from contractor. Mahesh took the intro call.',
          author: 'Mahesh',
        },
        {
          at: new Date(Date.now() - 11 * 86400000).toISOString(),
          note: 'Pramila completed discovery discussion on ISMS scope. Awaiting stakeholder confirmation.',
          author: 'Pramila',
        },
      ],
    },
    {
      id: 'l-2',
      company: 'Pratham Cloud Networks',
      contactName: 'Vikram Joshi',
      email: 'vikram.j@prathamcloud.com',
      phone: '+91 98200 99432',
      source: 'Website inbound',
      stage: 'Proposal sent',
      value: 1200000,
      owner: 'Ramesh',
      lastContactDate: daysOffset(-8), // 8 days quiet!
      nextFollowUpDate: daysOffset(-1),
      meetingContext:
        'Ramesh presented the CMMI ML3 DEV appraisal roadmap and formal commercial proposal of ₹12 Lakhs to Vikram and their VP Engineering. They promised internal review by Friday.',
      serviceInterest: 'CMMI',
      activity: [
        {
          at: new Date(Date.now() - 15 * 86400000).toISOString(),
          note: 'Completed scoping call for 85-member development team.',
          author: 'Ramesh',
        },
        {
          at: new Date(Date.now() - 8 * 86400000).toISOString(),
          note: 'Formal CMMI ML3 proposal sent via email.',
          author: 'Ramesh',
        },
      ],
    },
    {
      id: 'l-3',
      company: 'Daksha Robotics Systems',
      contactName: 'Raghavan Swamy',
      email: 'raghavan@daksharobotics.com',
      phone: '+91 94440 22341',
      source: 'External Marketing',
      stage: 'Demo scheduled',
      value: 650000,
      owner: 'Mahesh',
      lastContactDate: daysOffset(-4),
      nextFollowUpDate: daysOffset(2),
      meetingContext:
        'Mahesh scheduled pre-assessment tool walkthrough for ISO 9001 and AS9100 quality guidelines. Raghavan confirmed 4 QA leads will attend.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 4 * 86400000).toISOString(),
          note: 'Calendar invite sent for process readiness demonstration.',
          author: 'Mahesh',
        },
      ],
    },
    {
      id: 'l-4',
      company: 'Ananta Secure Technologies',
      contactName: 'Harish Pillai',
      email: 'harish@anantasecure.com',
      phone: '+91 98470 55123',
      source: 'Referral',
      stage: 'Proposal sent',
      value: 950000,
      owner: 'Sunita',
      lastContactDate: daysOffset(-9), // 9 days quiet
      nextFollowUpDate: daysOffset(-2),
      meetingContext:
        'Sunita finalized ISO 27001 and ISO 27701 dual certification proposal. Harish requested sample gap analysis template before signing.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 9 * 86400000).toISOString(),
          note: 'Commercial proposal sent with milestone payment schedules.',
          author: 'Sunita',
        },
      ],
    },
    {
      id: 'l-5',
      company: 'Garuda Defense Software',
      contactName: 'Manish Bhatnagar',
      email: 'manish.b@garudadefense.in',
      phone: '+91 98101 77654',
      source: 'Industry Event',
      stage: 'Contacted',
      value: 1400000,
      owner: 'Ramesh',
      lastContactDate: daysOffset(-14), // 14 days quiet!
      nextFollowUpDate: daysOffset(-6),
      meetingContext:
        'Ramesh had preliminary conversation regarding CMMI ML5 high-maturity appraisal for their defense simulation software group in Delhi.',
      serviceInterest: 'CMMI',
      activity: [
        {
          at: new Date(Date.now() - 14 * 86400000).toISOString(),
          note: 'Initial requirements capture completed at Aero India exhibition booth.',
          author: 'Ramesh',
        },
      ],
    },
    {
      id: 'l-6',
      company: 'Shreshtha BioInformatics',
      contactName: 'Tanvi Shah',
      email: 'tanvi@shreshthabio.com',
      phone: '+91 98250 88124',
      source: 'External Marketing',
      stage: 'New',
      value: 400000,
      owner: 'Mahesh',
      lastContactDate: daysOffset(-2),
      nextFollowUpDate: daysOffset(1),
      meetingContext:
        'Mahesh verified lead contact details. Tanvi inquired about ISO 13485 software validation timeline for genomic testing pipeline.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 2 * 86400000).toISOString(),
          note: 'Inbound lead qualified from campaign landing page.',
          author: 'Mahesh',
        },
      ],
    },
    {
      id: 'l-7',
      company: 'Aryabhata Analytics',
      contactName: 'Kunal Singhal',
      email: 'kunal@aryabhata-analytics.io',
      phone: '+91 98118 44321',
      source: 'External Marketing',
      stage: 'Demo done',
      value: 550000,
      owner: 'Pramila',
      lastContactDate: daysOffset(-5),
      nextFollowUpDate: daysOffset(2),
      meetingContext:
        'Pramila walked Kunal through ISO 27001 artifact repository structure and internal audit readiness checklist. Next step is drafting the formal scope.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 5 * 86400000).toISOString(),
          note: 'Interactive audit simulation completed with Kunal and head of DevOps.',
          author: 'Pramila',
        },
      ],
    },
    {
      id: 'l-8',
      company: 'Indus Mobility Solutions',
      contactName: 'Bhaskar Naidu',
      email: 'bhaskar@indusmobility.in',
      phone: '+91 98490 66543',
      source: 'Referral',
      stage: 'Demo done',
      value: 800000,
      owner: 'Sunita',
      lastContactDate: daysOffset(-3),
      nextFollowUpDate: daysOffset(3),
      meetingContext:
        'Sunita showcased Automotive SPICE and CMMI process mapping to Bhaskar and their software architect in Chennai.',
      serviceInterest: 'CMMI',
      activity: [
        {
          at: new Date(Date.now() - 3 * 86400000).toISOString(),
          note: 'Process architecture demo completed. Preparing proposal options.',
          author: 'Sunita',
        },
      ],
    },
    {
      id: 'l-9',
      company: 'Meghdoot AI Systems',
      contactName: 'Pallavi Chhabra',
      email: 'pallavi@meghdootai.com',
      phone: '+91 98180 99887',
      source: 'Website inbound',
      stage: 'New',
      value: 500000,
      owner: 'Pramila',
      lastContactDate: daysOffset(-1),
      nextFollowUpDate: daysOffset(2),
      meetingContext:
        'Pallavi requested guidance on ISO 42001 (Artificial Intelligence Management System) and ISO 27001 scope.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 1 * 86400000).toISOString(),
          note: 'Received web inquiry regarding newly introduced AI certification frameworks.',
          author: 'Pramila',
        },
      ],
    },
    {
      id: 'l-10',
      company: 'Nilgiri IoT Platforms',
      contactName: 'Eswar Murthy',
      email: 'eswar@nilgiriiot.com',
      phone: '+91 94433 11220',
      source: 'External Marketing',
      stage: 'Contacted',
      value: 450000,
      owner: 'Mahesh',
      lastContactDate: daysOffset(-6),
      nextFollowUpDate: daysOffset(1),
      meetingContext:
        'Mahesh spoke with Eswar on firmware security testing standards and baseline ISO 27001 gap audit requirement.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 6 * 86400000).toISOString(),
          note: 'Discovery call completed. Sent standard questionnaire.',
          author: 'Mahesh',
        },
      ],
    },
    {
      id: 'l-11',
      company: 'Surya MedTech Solutions',
      contactName: 'Dr. Alok Verma',
      email: 'alok.v@suryamedtech.in',
      phone: '+91 98711 22998',
      source: 'Referral',
      stage: 'Won',
      value: 680000,
      owner: 'Sunita',
      lastContactDate: daysOffset(-12),
      nextFollowUpDate: daysOffset(30),
      meetingContext:
        'Sunita successfully closed the ISO 13485 and ISO 27001 advisory contract. Kickoff meeting held.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 12 * 86400000).toISOString(),
          note: 'Contract signed. Initial payment received.',
          author: 'Sunita',
        },
      ],
    },
    {
      id: 'l-12',
      company: 'Kaveri Semiconductor Apps',
      contactName: 'Sridhar Rao',
      email: 'sridhar@kaverisemi.com',
      phone: '+91 98455 33001',
      source: 'External Marketing',
      stage: 'Won',
      value: 1350000,
      owner: 'Ramesh',
      lastContactDate: daysOffset(-20),
      nextFollowUpDate: daysOffset(45),
      meetingContext:
        'Ramesh finalized CMMI ML3 DEV appraisal engagement. ATM team training scheduled.',
      serviceInterest: 'CMMI',
      activity: [
        {
          at: new Date(Date.now() - 20 * 86400000).toISOString(),
          note: 'Signed SOW received from board for full appraisal cycle.',
          author: 'Ramesh',
        },
      ],
    },
    {
      id: 'l-13',
      company: 'Vikram MicroSystems',
      contactName: 'Nitin Pandey',
      email: 'nitin@vikrammicro.co',
      phone: '+91 99200 44119',
      source: 'External Marketing',
      stage: 'Lost',
      value: 450000,
      owner: 'Mahesh',
      lastContactDate: daysOffset(-25),
      nextFollowUpDate: '',
      lostReason: 'Chose cut-price independent auditor with no formal appraisal guarantee.',
      meetingContext:
        'Mahesh followed up after proposal. Client preferred a lower quotation from a single freelance practitioner.',
      serviceInterest: 'ISO',
      activity: [
        {
          at: new Date(Date.now() - 25 * 86400000).toISOString(),
          note: 'Deal marked lost. Competitor quoted below market floor.',
          author: 'Mahesh',
        },
      ],
    },
    {
      id: 'l-14',
      company: 'Rudra Secure Mesh',
      contactName: 'Gaurav Dubey',
      email: 'gaurav@rudrasecure.io',
      phone: '+91 98109 88711',
      source: 'Website inbound',
      stage: 'Lost',
      value: 850000,
      owner: 'Pramila',
      lastContactDate: daysOffset(-30),
      nextFollowUpDate: '',
      lostReason:
        'Postponed certification budget to next financial year due to internal restructuring.',
      meetingContext:
        'Pramila held demo with engineering director. Startup decided to freeze process audit budgets until series A.',
      serviceInterest: 'CMMI',
      activity: [
        {
          at: new Date(Date.now() - 30 * 86400000).toISOString(),
          note: 'Marked lost due to client internal budget freeze.',
          author: 'Pramila',
        },
      ],
    },
    {
      id: 'l-15',
      company: 'Tarang Telecom Tech',
      contactName: 'Bhavna Parekh',
      email: 'bhavna@tarangtelecom.in',
      phone: '+91 98210 66334',
      source: 'External Marketing',
      stage: 'Demo scheduled',
      value: 600000,
      owner: 'Mahesh',
      lastContactDate: daysOffset(-2),
      nextFollowUpDate: daysOffset(3),
      meetingContext:
        'Mahesh confirmed demo of process documentation portal with Bhavna and quality team.',
      serviceInterest: 'IPA',
      activity: [
        {
          at: new Date(Date.now() - 2 * 86400000).toISOString(),
          note: 'Scheduled walkthrough call for next Tuesday.',
          author: 'Mahesh',
        },
      ],
    },
  ];
}
