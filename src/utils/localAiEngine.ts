import { Client, Lead, ToolProposal } from '../types';
import { getDaysUntilRenewal, formatStandardDate, getDaysAgo } from './dateUtils';
import { formatINR } from './currency';

export interface LocalEngineResult {
  replyText: string;
  proposal?: ToolProposal;
  suggestedDrafts?: Array<{
    id: string;
    company: string;
    contactName: string;
    type: 'lead' | 'client';
    email: string;
  }>;
}

export function generateDraftEmailOffline(
  entity: {
    company: string;
    contactName: string;
    owner: string;
    meetingContext?: string;
    notes?: string;
    service?: string;
    serviceInterest?: string;
  }
): string {
  const firstName = entity.contactName.split(' ')[0] || entity.contactName;
  const standard = entity.service || entity.serviceInterest || 'process certification';
  const owner = entity.owner || 'Pramila';

  let recallSentence = `When we spoke, I took you through our ${standard} assessment roadmap and audit scope for your team.`;
  if (entity.meetingContext) {
    let ctx = entity.meetingContext;
    // Transform 3rd person to 1st person
    ctx = ctx.replace(/^(?:Pramila|Ramesh|Mahesh|Sunita)\s+(?:walked|presented|spoke with|discussed|took|finalized|had|held)\s+[^.]+?(?:through|on|regarding|with)\s+/i, 'When we spoke, I took you through ');
    ctx = ctx.replace(/\b(?:Pramila|Ramesh|Mahesh|Sunita)\b/g, 'I');
    ctx = ctx.replace(/\bhis\b|\bher\b/g, 'my');
    ctx = ctx.replace(/\bhe\b|\bshe\b/g, 'I');
    if (!ctx.endsWith('.')) ctx += '.';
    recallSentence = ctx;
  }

  const emailLines = [
    `Hi ${firstName},`,
    '',
    recallSentence,
    `I would like to reconnect and review the remaining questions before we finalize the audit schedule.`,
    '',
    `Could we connect for fifteen minutes on either:`,
    `• Tuesday at 11:30 AM IST`,
    `• Thursday at 3:30 PM IST`,
    '',
    `Please let me know if one of these works for you, or feel free to suggest an alternative time.`,
    '',
    `Regards,`,
    owner,
  ];

  return emailLines.join('\n');
}

export function runLocalRuleEngine(
  prompt: string,
  clients: Client[],
  leads: Lead[],
  activeUserName: string = 'Pramila'
): LocalEngineResult {
  const q = prompt.toLowerCase().trim();
  const now = new Date();

  // Find mentioned companies
  const matchedLeads = leads.filter(
    (l) => q.includes(l.company.toLowerCase()) || q.includes(l.contactName.toLowerCase())
  );
  const matchedClients = clients.filter(
    (c) => q.includes(c.company.toLowerCase()) || q.includes(c.contactName.toLowerCase())
  );

  // 1. DRAFT REQUEST
  if (q.includes('draft') || q.includes('email') || q.includes('write to') || q.includes('follow-up for') || q.includes('follow up for')) {
    let target = matchedLeads[0] || matchedClients[0];
    if (!target && leads.length > 0) {
      // Pick worst quiet lead
      const quiet = leads
        .filter((l) => l.stage !== 'Won' && l.stage !== 'Lost')
        .sort((a, b) => getDaysAgo(b.lastContactDate, now) - getDaysAgo(a.lastContactDate, now));
      target = quiet[0] || leads[0];
    }

    if (target) {
      const draft = generateDraftEmailOffline(target as any);
      const isLead = 'stage' in target;
      return {
        replyText: `Here is the first-person follow-up draft for **${target.company}** (${target.contactName}), signed by ${target.owner}. You can copy and send this directly as a reply in your existing email thread.\n\n---\n\n${draft}\n\n---\n\nShall I prepare another draft for another contact?`,
        suggestedDrafts: [
          {
            id: target.id,
            company: target.company,
            contactName: target.contactName,
            type: isLead ? 'lead' : 'client',
            email: target.email,
          },
        ],
      };
    }
  }

  // 2. PROPOSAL / STAGE UPDATE INTENT (e.g. "move Kavach to Demo done" or "change stage of Pratham to Won")
  if (q.includes('move') || q.includes('change') || q.includes('update') || q.includes('set stage')) {
    let targetLead: Lead | undefined = matchedLeads[0];
    if (!targetLead) {
      // Check partial matches
      targetLead = leads.find((l) =>
        q.includes(l.company.split(' ')[0].toLowerCase())
      );
    }

    if (targetLead) {
      let newStage = targetLead.stage;
      if (q.includes('demo done')) newStage = 'Demo done';
      else if (q.includes('demo scheduled')) newStage = 'Demo scheduled';
      else if (q.includes('contacted')) newStage = 'Contacted';
      else if (q.includes('proposal sent') || q.includes('proposal')) newStage = 'Proposal sent';
      else if (q.includes('won')) newStage = 'Won';
      else if (q.includes('lost')) newStage = 'Lost';

      if (newStage !== targetLead.stage) {
        const proposal: ToolProposal = {
          action: 'update_lead',
          id: targetLead.id,
          targetName: targetLead.company,
          changes: { stage: newStage },
          reason: `User requested to update pipeline stage from ${targetLead.stage} to ${newStage}`,
        };

        return {
          replyText: `Proposed update for **${targetLead.company}**: move pipeline stage from \`${targetLead.stage}\` to \`${newStage}\`. Stored data will not change until you click Apply below.`,
          proposal,
        };
      }
    }
  }

  // 3. OVERDUE & RENEWALS
  if (q.includes('overdue') || q.includes('lapsed') || q.includes('renewal') || q.includes('radar') || q.includes('90 days')) {
    const overdue = clients.filter((c) => getDaysUntilRenewal(c, now) < 0);
    const due90 = clients.filter((c) => {
      const d = getDaysUntilRenewal(c, now);
      return d >= 0 && d <= 90;
    });

    let reply = `### Renewal Radar Status\n\n`;
    if (overdue.length > 0) {
      reply += `**🚨 Overdue Certifications (${overdue.length} clients):**\n`;
      overdue.forEach((c) => {
        const days = Math.abs(getDaysUntilRenewal(c, now));
        reply += `- **${c.company}** (${c.service} ${c.level || ''}): **${days} days overdue** · Value: ${formatINR(c.contractValue)} · Owner: ${c.owner}\n`;
      });
      reply += `\n`;
    } else {
      reply += `No client certifications are currently overdue.\n\n`;
    }

    if (due90.length > 0) {
      reply += `**⚠️ Due Within 90 Days (${due90.length} clients):**\n`;
      due90.forEach((c) => {
        const days = getDaysUntilRenewal(c, now);
        reply += `- **${c.company}** (${c.service} ${c.level || ''}): **${days} days remaining** · Value: ${formatINR(c.contractValue)} · Owner: ${c.owner}\n`;
      });
      reply += `\n`;
    }

    const worst = overdue[0] || due90[0];
    if (worst) {
      reply += `Shall I draft a renewal reminder for **${worst.company}**?`;
      return {
        replyText: reply,
        suggestedDrafts: [
          {
            id: worst.id,
            company: worst.company,
            contactName: worst.contactName,
            type: 'client',
            email: worst.email,
          },
        ],
      };
    }
    return { replyText: reply };
  }

  // 4. QUIET LEADS & BOTTLENECKS
  if (q.includes('quiet') || q.includes('stuck') || q.includes('bottleneck') || q.includes('pipeline') || q.includes('attention')) {
    const quiet = leads
      .filter((l) => l.stage !== 'Won' && l.stage !== 'Lost' && getDaysAgo(l.lastContactDate, now) >= 7)
      .sort((a, b) => getDaysAgo(b.lastContactDate, now) - getDaysAgo(a.lastContactDate, now));

    let reply = `### Pipeline Attention & Quiet Leads\n\n`;
    reply += `Found **${quiet.length} open leads** with no recorded touchpoint for 7+ days:\n\n`;
    quiet.forEach((l) => {
      const days = getDaysAgo(l.lastContactDate, now);
      reply += `- **${l.company}** (${l.contactName}): **${days} days quiet** at stage \`${l.stage}\` · Value: ${formatINR(l.value)} · Owner: ${l.owner}\n`;
    });

    if (quiet.length > 0) {
      reply += `\nThe biggest quiet deal is **${quiet[0].company}** (${formatINR(quiet[0].value)}). Shall I draft the follow-up to ${quiet[0].company}?`;
      return {
        replyText: reply,
        suggestedDrafts: [
          {
            id: quiet[0].id,
            company: quiet[0].company,
            contactName: quiet[0].contactName,
            type: 'lead',
            email: quiet[0].email,
          },
        ],
      };
    }
    return { replyText: reply };
  }

  // 5. OWNER / TEAM BREAKDOWN
  if (q.includes('owner') || q.includes('who') || q.includes('team') || q.includes('revenue at risk') || q.includes('ramesh') || q.includes('pramila') || q.includes('mahesh') || q.includes('sunita')) {
    const owners = ['Ramesh', 'Pramila', 'Mahesh', 'Sunita'];
    let reply = `### Owner Breakdown & Risk Distribution\n\n`;

    owners.forEach((owner) => {
      const ownerClients = clients.filter((c) => c.owner.toLowerCase() === owner.toLowerCase());
      const ownerLeads = leads.filter((l) => l.owner.toLowerCase() === owner.toLowerCase());
      const clientVal = ownerClients.reduce((sum, c) => sum + c.contractValue, 0);
      const leadVal = ownerLeads.reduce((sum, l) => sum + l.value, 0);
      const riskClients = ownerClients.filter((c) => getDaysUntilRenewal(c, now) <= 90);
      const riskVal = riskClients.reduce((sum, c) => sum + c.contractValue, 0);

      reply += `**${owner}:**\n`;
      reply += `- Certified Book: ${ownerClients.length} clients (${formatINR(clientVal)})\n`;
      reply += `- Open Pipeline: ${ownerLeads.length} leads (${formatINR(leadVal)})\n`;
      reply += `- Revenue at Risk (<=90d): ${riskClients.length} clients (${formatINR(riskVal)})\n\n`;
    });

    reply += `Shall I draft a review summary for Ramesh and Pramila?`;
    return { replyText: reply };
  }

  // 6. SPECIFIC COMPANY INQUIRY
  if (matchedClients.length > 0) {
    const c = matchedClients[0];
    const days = getDaysUntilRenewal(c, now);
    const status = days < 0 ? `🚨 ${Math.abs(days)} days OVERDUE` : `⏳ Due in ${days} days`;
    let reply = `### Client Record: ${c.company}\n\n`;
    reply += `- **Standard:** ${c.service} ${c.level || ''}\n`;
    reply += `- **Contact:** ${c.contactName} (${c.email}, ${c.phone})\n`;
    reply += `- **Contract Value:** ${formatINR(c.contractValue)}\n`;
    reply += `- **Owner:** ${c.owner}\n`;
    reply += `- **Last Appraisal:** ${formatStandardDate(c.lastAppraisalDate)}\n`;
    reply += `- **Renewal Status:** ${status}\n`;
    reply += `- **Internal Notes:** ${c.notes}\n\n`;
    reply += `Shall I draft the renewal correspondence for **${c.company}**?`;

    return {
      replyText: reply,
      suggestedDrafts: [
        {
          id: c.id,
          company: c.company,
          contactName: c.contactName,
          type: 'client',
          email: c.email,
        },
      ],
    };
  }

  if (matchedLeads.length > 0) {
    const l = matchedLeads[0];
    const daysQuiet = getDaysAgo(l.lastContactDate, now);
    let reply = `### Lead Record: ${l.company}\n\n`;
    reply += `- **Stage:** \`${l.stage}\` · **Value:** ${formatINR(l.value)}\n`;
    reply += `- **Contact:** ${l.contactName} (${l.email}, ${l.phone})\n`;
    reply += `- **Owner:** ${l.owner} · **Source:** ${l.source}\n`;
    reply += `- **Last Contact:** ${formatStandardDate(l.lastContactDate)} (${daysQuiet} days ago)\n`;
    reply += `- **Internal Meeting Context:** "${l.meetingContext}"\n\n`;
    reply += `Shall I draft the follow-up email to **${l.contactName}** at ${l.company}?`;

    return {
      replyText: reply,
      suggestedDrafts: [
        {
          id: l.id,
          company: l.company,
          contactName: l.contactName,
          type: 'lead',
          email: l.email,
        },
      ],
    };
  }

  // 7. DEFAULT / FALLBACK
  const quietTop = leads
    .filter((l) => l.stage !== 'Won' && l.stage !== 'Lost')
    .sort((a, b) => getDaysAgo(b.lastContactDate, now) - getDaysAgo(a.lastContactDate, now))[0];

  let fallback = `I have analyzed the current firm records (${clients.length} clients, ${leads.length} leads). You can ask me to draft follow-ups, inspect renewals due in 90 days, check owner workloads, or review quiet pipeline deals.`;

  if (quietTop) {
    fallback += `\n\nShall I draft the follow-up to **${quietTop.company}**?`;
    return {
      replyText: fallback,
      suggestedDrafts: [
        {
          id: quietTop.id,
          company: quietTop.company,
          contactName: quietTop.contactName,
          type: 'lead',
          email: quietTop.email,
        },
      ],
    };
  }

  return { replyText: fallback };
}
