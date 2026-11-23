import { describe, expect, it } from 'vitest';
import {
  EMAIL_PATTERN,
  LIMITS,
  MAX_AMOUNT,
  MESSAGES,
  checkChoice,
  cleanText,
  parseAmount,
  validateClient,
  validateEngagement,
  validateFinancials,
  type ClientFormValues,
  type EngagementFormValues,
} from './validate';

const emptyClient = (): ClientFormValues => ({
  clientCode: '',
  name: '',
  industry: '',
  address: '',
  city: '',
  stateCountry: '',
  contactPerson: '',
  designation: '',
  email: '',
  phone: '',
  website: '',
  priority: '',
  doNotContact: false,
});

const emptyEngagement = (): EngagementFormValues => ({
  certificationType: '',
  standardFramework: '',
  scope: '',
  status: '',
  initialEngagementDate: '',
  completionDate: '',
  certificateNumber: '',
  validFrom: '',
  validTo: '',
  certificationBody: '',
  surveillanceDueDate: '',
  lastAuditDate: '',
  nextAuditDate: '',
  ownerId: '',
  leadSource: '',
  remarks: '',
  lastContactedOn: '',
  nextFollowUpOn: '',
});

const CHOICES = {
  certificationTypes: ['ISO 27001', 'CMMI'],
  statuses: ['Lead', 'Proposal', 'On Hold'],
  leadSources: ['Referral'],
  owners: ['owner-1'],
};

const PRIORITIES = ['High', 'Medium', 'Low'];

describe('cleanText', () => {
  it('trims, and turns an empty or blank value into null', () => {
    expect(cleanText('  Pune  ')).toBe('Pune');
    expect(cleanText('')).toBeNull();
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(null)).toBeNull();
    expect(cleanText(undefined)).toBeNull();
  });
});

describe('validateClient', () => {
  it('requires the company name (blank counts as empty)', () => {
    const result = validateClient({ ...emptyClient(), name: '   ' }, PRIORITIES);
    expect(result).toEqual({ ok: false, errors: { name: MESSAGES.name } });
  });

  it('allows a 200-character name and refuses 201, counting characters, not UTF-16 units', () => {
    const ok = validateClient({ ...emptyClient(), name: '₹'.repeat(199) + '😀' }, PRIORITIES);
    expect(ok.ok).toBe(true);
    const tooLong = validateClient({ ...emptyClient(), name: 'a'.repeat(201) }, PRIORITIES);
    expect(tooLong).toEqual({ ok: false, errors: { name: MESSAGES.tooLong(200) } });
  });

  it('enforces every client column limit from the migration', () => {
    const fields = [
      'clientCode',
      'industry',
      'address',
      'city',
      'stateCountry',
      'contactPerson',
      'designation',
      'phone',
      'website',
    ] as const;
    for (const field of fields) {
      const max = LIMITS[field];
      const atLimit = validateClient(
        { ...emptyClient(), name: 'Client01 Demo Ltd', [field]: 'x'.repeat(max) },
        PRIORITIES,
      );
      expect(atLimit.ok, field).toBe(true);
      const over = validateClient(
        { ...emptyClient(), name: 'Client01 Demo Ltd', [field]: 'x'.repeat(max + 1) },
        PRIORITIES,
      );
      expect(over, field).toEqual({ ok: false, errors: { [field]: MESSAGES.tooLong(max) } });
    }
  });

  it('accepts emails the database accepts', () => {
    for (const email of ['client01@example.com', 'a.b+c@sub.example.co.in', 'x@y.z']) {
      expect(EMAIL_PATTERN.test(email), email).toBe(true);
      const result = validateClient({ ...emptyClient(), name: 'C', email }, PRIORITIES);
      expect(result.ok, email).toBe(true);
    }
  });

  it('refuses emails the database refuses', () => {
    for (const email of ['client01', 'client01@example', 'a b@example.com', 'a@@example.com']) {
      const result = validateClient({ ...emptyClient(), name: 'C', email }, PRIORITIES);
      expect(result, email).toEqual({ ok: false, errors: { email: MESSAGES.email } });
    }
  });

  it('returns the input with empty fields as null, never filled in', () => {
    const result = validateClient(
      { ...emptyClient(), name: ' Client01 Demo Ltd ', city: 'Pune', priority: 'High' },
      PRIORITIES,
    );
    expect(result).toEqual({
      ok: true,
      input: {
        clientCode: null,
        name: 'Client01 Demo Ltd',
        industry: null,
        address: null,
        city: 'Pune',
        stateCountry: null,
        contactPerson: null,
        designation: null,
        email: null,
        phone: null,
        website: null,
        priority: 'High',
        doNotContact: false,
      },
    });
  });
});

describe('parseAmount', () => {
  it('reads digits with Indian or Western commas and up to 2 decimals', () => {
    expect(parseAmount('4,50,000')).toEqual({ ok: true, value: 450000 });
    expect(parseAmount('450,000')).toEqual({ ok: true, value: 450000 });
    expect(parseAmount(' 1200000.5 ')).toEqual({ ok: true, value: 1200000.5 });
    expect(parseAmount('0')).toEqual({ ok: true, value: 0 });
  });

  it('refuses negatives, letters, symbols and more than 2 decimals', () => {
    for (const text of ['-5000', '4.5 L', '₹5000', '12.345', '1e6', 'abc', '.5']) {
      expect(parseAmount(text), text).toEqual({ ok: false, error: MESSAGES.amount });
    }
  });

  it('refuses an amount that numeric(12, 2) cannot hold', () => {
    expect(parseAmount('9,99,99,99,999.99')).toEqual({ ok: true, value: MAX_AMOUNT });
    expect(parseAmount('10000000000')).toEqual({ ok: false, error: MESSAGES.amountTooBig });
  });

  it('treats an empty amount as not recorded (null), never as 0', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: null });
    expect(parseAmount('   ')).toEqual({ ok: true, value: null });
    expect(validateFinancials({ contractValue: '', paymentStatus: '' }, ['Paid'])).toEqual({
      ok: true,
      input: { contractValue: null, paymentStatus: null },
    });
  });
});

describe('checkChoice', () => {
  it('accepts a listed value or an empty optional one, refuses anything else', () => {
    expect(checkChoice('High', PRIORITIES)).toBeUndefined();
    expect(checkChoice(null, PRIORITIES)).toBeUndefined();
    expect(checkChoice(null, PRIORITIES, MESSAGES.required)).toBe(MESSAGES.required);
    expect(checkChoice('Urgent', PRIORITIES)).toBe(MESSAGES.choice);
    expect(validateClient({ ...emptyClient(), name: 'C', priority: 'Urgent' }, PRIORITIES)).toEqual(
      { ok: false, errors: { priority: MESSAGES.choice } },
    );
  });
});

describe('validateEngagement', () => {
  it('requires certification and stage, and turns typed dates into YYYY-MM-DD', () => {
    expect(validateEngagement(emptyEngagement(), 'client-1', CHOICES)).toEqual({
      ok: false,
      errors: { certificationType: MESSAGES.certification, status: MESSAGES.status },
    });
    const result = validateEngagement(
      {
        ...emptyEngagement(),
        certificationType: 'ISO 27001',
        status: 'Lead',
        lastContactedOn: '28-Sep-2026',
        nextFollowUpOn: '05-oct-2026',
        ownerId: 'owner-1',
      },
      'client-1',
      CHOICES,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input).toMatchObject({
        clientId: 'client-1',
        certificationType: 'ISO 27001',
        status: 'Lead',
        lastContactedOn: '2026-09-28',
        nextFollowUpOn: '2026-10-05',
        ownerId: 'owner-1',
        leadSource: null,
        remarks: null,
        validTo: null,
      });
    }
    const badDate = validateEngagement(
      { ...emptyEngagement(), certificationType: 'CMMI', status: 'Lead', validTo: '31-Feb-2027' },
      'client-1',
      CHOICES,
    );
    expect(badDate).toEqual({ ok: false, errors: { validTo: MESSAGES.date } });
  });

  it('enforces the engagement text limits and refuses an unknown owner', () => {
    const base = { ...emptyEngagement(), certificationType: 'CMMI', status: 'Lead' };
    expect(validateEngagement({ ...base, remarks: 'x'.repeat(5000) }, 'c', CHOICES).ok).toBe(true);
    expect(
      validateEngagement(
        { ...base, remarks: 'x'.repeat(5001), scope: 'y'.repeat(2001), ownerId: 'someone' },
        'c',
        CHOICES,
      ),
    ).toEqual({
      ok: false,
      errors: {
        remarks: MESSAGES.tooLong(5000),
        scope: MESSAGES.tooLong(2000),
        ownerId: MESSAGES.choice,
      },
    });
  });
});
