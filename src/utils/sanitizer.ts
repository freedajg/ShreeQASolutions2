/**
 * Sanitizes model responses:
 * - Strips <think>...</think> tags and planning chatter
 * - Strips "Here is the draft email:", "Note:", markdown boilerplate
 * - Cleans up leaked prompt instructions
 */
export function sanitizeModelOutput(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // Strip <think>...</think> blocks including multi-line
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Strip common thinking headers if any remained
  text = text.replace(/^(?:Here's a thinking process|Detailed thinking on|Thinking Process):?[\s\S]*?(?=\n\n[A-Z#*])/i, '');

  // Strip "Here is the email:" or "Here is the response:" prefixes
  text = text.replace(/^(?:Here is the email draft|Here is the email|Here is the drafted follow-up|Email Draft|Draft email):?\s*/i, '');

  // Strip trailing notes like "Note: This email is under 110 words..."
  text = text.replace(/\n\s*Note:\s*(?:This email|Remember|Please note)[\s\S]*$/i, '');

  // Trim extra leading/trailing whitespace
  return text.trim();
}
