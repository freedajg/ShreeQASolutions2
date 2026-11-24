// Screens that are built but switched off until SQAS has what they need.
// WhatsApp: hidden until a WhatsApp Business account exists (PRD: no WhatsApp in v1, 29-Sep).
// Turning it on is this one line; the table, rules and queue already work.
export const WHATSAPP_ENABLED = false;

/** Menu name of the outreach screen: "Calls" while WhatsApp is hidden. */
export const OUTREACH_LABEL = WHATSAPP_ENABLED ? 'WhatsApp & Calls' : 'Call Log';
