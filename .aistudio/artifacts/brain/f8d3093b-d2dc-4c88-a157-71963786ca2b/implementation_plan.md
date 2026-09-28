# Implementation Plan: Direct Send Email Feature in Drishti CRM

## User Request Summary
The user requested a **Send** button in the Draft Follow-Up modal instead of only having "Copy Draft", so that upon reviewing the generated draft, they can dispatch it directly to the lead or client.

Based on the clarifying answers:
1. **Send Mechanism**: Launches the user's email client (via standard `mailto:` link with pre-filled recipient email, encoded subject, and formatted first-person body).
2. **CRM Automation**: Automatically records an activity note in the contact's activity trail (e.g. *"Follow-up email dispatched by [Owner] via default mail client"*) and advances `lastContactDate` to today's date (`YYYY-MM-DD`).
3. **Layout & Actions**: A primary high-contrast gradient **Send Email** button, with **Copy Draft** preserved as a secondary button beside it, plus instant confirmation feedback.
4. **Copy & Guidance Update**: Update the modal banner and status chips to reflect direct dispatch support.

---

## Proposed Changes

### 1. Update `src/context/CrmContext.tsx`
Add a dedicated helper method:
- `logEmailSent(target: { type: 'lead' | 'client'; id: string }, subject: string, recipientEmail: string)`:
  - For **Leads**:
    - Update `lastContactDate` to today (`new Date().toISOString().split('T')[0]`).
    - Append an activity note: `"Sent email follow-up regarding '${subject}' to ${recipientEmail}"`.
  - For **Clients**:
    - Append an activity note: `"Sent renewal follow-up regarding '${subject}' to ${recipientEmail}"`.

### 2. Update `src/components/EmailDraftModal.tsx`
- Replace single "Copy Draft" layout with:
  - **Secondary action**: "Copy Draft" button (retaining clipboard copy and visual tick state).
  - **Primary action**: "Send Email" (with an outbound mail icon `Send`), which:
    1. Validates recipient email address.
    2. Builds formatted `mailto:` URL:
       `mailto:${encodeURIComponent(entity.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    3. Triggers mail client launch.
    4. Automatically invokes `logEmailSent` in CRM context to update activity notes and `lastContactDate`.
    5. Displays a success state (`Sent & Logged!`) and feedback notification.
- Update modal notice text and tags:
  - Header badge: change from `Draft Only` to `Ready to Send`.
  - Banner: *"Review and edit your message below. Clicking **Send Email** opens your default email client with all fields pre-filled and automatically logs the touchpoint in your CRM."*

### 3. Verification & Testing
- Test draft modal with both **Leads** and **Clients**.
- Verify mail client launch trigger.
- Verify `lastContactDate` is updated and activity trail note is recorded.
- Verify **Copy Draft** works as a secondary action.
- Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
