import { Client, Lead, BriefingData, BriefingCard } from '../types';
import { getDaysUntilRenewal, formatFullDate, getDaysAgo } from './dateUtils';
import { formatINR } from './currency';

export function computeBriefing(
  clients: Client[],
  leads: Lead[],
  userName: string = 'Pramila',
): BriefingData {
  const now = new Date();
  const hour = now.getHours();

  let greetingTime = 'Good morning';
  if (hour >= 12 && hour < 17) {
    greetingTime = 'Good afternoon';
  } else if (hour >= 17 || hour < 5) {
    greetingTime = 'Good evening';
  }
  const greeting = `${greetingTime}, ${userName}`;
  const dateStr = formatFullDate(now);

  // 1. Lapsed clients (days < 0)
  const lapsedClients = clients
    .filter((c) => getDaysUntilRenewal(c, now) < 0)
    .sort((a, b) => getDaysUntilRenewal(a, now) - getDaysUntilRenewal(b, now)); // most overdue first
  const totalLapsedValue = lapsedClients.reduce((sum, c) => sum + c.contractValue, 0);

  // 2. Renewals within 90 days (0 <= days <= 90)
  const due90Clients = clients
    .filter((c) => {
      const d = getDaysUntilRenewal(c, now);
      return d >= 0 && d <= 90;
    })
    .sort((a, b) => getDaysUntilRenewal(a, now) - getDaysUntilRenewal(b, now)); // closest first
  const totalDue90Value = due90Clients.reduce((sum, c) => sum + c.contractValue, 0);

  // 3. Quiet leads: open leads (not Won/Lost) where lastContactDate is >= 7 days ago
  const quietLeads = leads
    .filter(
      (l) => l.stage !== 'Won' && l.stage !== 'Lost' && getDaysAgo(l.lastContactDate, now) >= 7,
    )
    .sort((a, b) => getDaysAgo(b.lastContactDate, now) - getDaysAgo(a.lastContactDate, now)); // most quiet first
  const totalQuietValue = quietLeads.reduce((sum, l) => sum + l.value, 0);

  // 4. Proposals out and undecided (stage === 'Proposal sent')
  const proposalsOut = leads
    .filter((l) => l.stage === 'Proposal sent')
    .sort((a, b) => b.value - a.value);
  const totalProposalValue = proposalsOut.reduce((sum, l) => sum + l.value, 0);

  const summaryLine = `${lapsedClients.length} lapsed, ${due90Clients.length} due within 90 days, ${quietLeads.length} quiet leads. I have read all ${clients.length} client records and ${leads.length} leads.`;

  const cards: BriefingCard[] = [];

  // Card 1: Lapsed
  if (lapsedClients.length > 0) {
    const worst = lapsedClients[0];
    const daysOverdue = Math.abs(getDaysUntilRenewal(worst, now));
    cards.push({
      id: 'brief-card-lapsed',
      type: 'lapsed',
      title: 'Certifications already lapsed',
      tag: `${lapsedClients.length} clients (${formatINR(totalLapsedValue)})`,
      tagColor: 'rose',
      worstOffender: worst.company,
      valueAtStake: worst.contractValue,
      owner: worst.owner,
      detail: `${worst.company} (${worst.service} ${worst.level || ''}) is ${daysOverdue} days overdue. Owned by ${worst.owner}.`,
      actionPrompt: `What is the risk with ${worst.company} and how should we re-engage them for their ${worst.service} renewal?`,
    });
  }

  // Card 2: Due in 90 days
  if (due90Clients.length > 0) {
    const nextDue = due90Clients[0];
    const daysLeft = getDaysUntilRenewal(nextDue, now);
    cards.push({
      id: 'brief-card-due-soon',
      type: 'due_soon',
      title: 'Renewals landing within 90 days',
      tag: `${due90Clients.length} renewals (${formatINR(totalDue90Value)})`,
      tagColor: 'amber',
      worstOffender: nextDue.company,
      valueAtStake: nextDue.contractValue,
      owner: nextDue.owner,
      detail: `${nextDue.company} (${nextDue.service} ${nextDue.level || ''}) renews in ${daysLeft} days. Handled by ${nextDue.owner}.`,
      actionPrompt: `Prepare a renewal plan and audit timeline for ${nextDue.company} due in ${daysLeft} days.`,
    });
  }

  // Card 3: Quiet leads
  if (quietLeads.length > 0) {
    const worstQuiet = quietLeads[0];
    const daysQuiet = getDaysAgo(worstQuiet.lastContactDate, now);
    cards.push({
      id: 'brief-card-quiet-leads',
      type: 'quiet_leads',
      title: 'Leads gone quiet (>7 days)',
      tag: `${quietLeads.length} leads (${formatINR(totalQuietValue)})`,
      tagColor: 'cyan',
      worstOffender: worstQuiet.company,
      valueAtStake: worstQuiet.value,
      owner: worstQuiet.owner,
      detail: `${worstQuiet.company} has had no contact for ${daysQuiet} days (${worstQuiet.contactName}, ${worstQuiet.stage}). Owned by ${worstQuiet.owner}.`,
      actionPrompt: `Draft a personalized follow-up for ${worstQuiet.company} (${worstQuiet.contactName}) taking into account our previous discussion.`,
    });
  }

  // Card 4: Proposals out
  if (proposalsOut.length > 0) {
    const topProp = proposalsOut[0];
    cards.push({
      id: 'brief-card-proposals',
      type: 'proposals_out',
      title: 'Proposals out & undecided',
      tag: `${proposalsOut.length} open (${formatINR(totalProposalValue)})`,
      tagColor: 'brand',
      worstOffender: topProp.company,
      valueAtStake: topProp.value,
      owner: topProp.owner,
      detail: `Largest proposal is ${topProp.company} for ${formatINR(topProp.value)} (${topProp.contactName}). Handled by ${topProp.owner}.`,
      actionPrompt: `Review status of open proposals, specifically ${topProp.company} worth ${formatINR(topProp.value)}.`,
    });
  }

  // Suggested question chips
  const chips: string[] = [
    'Which renewals are due in the next 90 days and what is our action plan?',
    quietLeads[0]
      ? `Shall I draft a follow-up for ${quietLeads[0].company}?`
      : 'Which leads need attention this week?',
    'Who among us has the most revenue at risk right now?',
    'Summarize our active pipeline conversion bottlenecks',
  ];

  return {
    greeting,
    dateStr,
    summaryLine,
    cards,
    chips,
  };
}
