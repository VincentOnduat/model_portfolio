import { describe, expect, it } from 'vitest';
import { isAccountEligibleForModel } from '../validation.js';

describe('isAccountEligibleForModel', () => {
  it('rejects an account with no consent, regardless of type', () => {
    const result = isAccountEligibleForModel(
      { hasConsent: false, accountType: 'ISA' },
      { eligibleAccountTypes: [] },
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/consent/i);
  });

  it('accepts any account type when the model has no restriction', () => {
    const result = isAccountEligibleForModel(
      { hasConsent: true, accountType: 'SIPP' },
      { eligibleAccountTypes: [] },
    );
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects an account type the model does not accept', () => {
    const result = isAccountEligibleForModel(
      { hasConsent: true, accountType: 'SIPP' },
      { eligibleAccountTypes: ['ISA', 'GIA'] },
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('ISA/GIA');
  });

  it('accepts an account type the model explicitly restricts to', () => {
    const result = isAccountEligibleForModel(
      { hasConsent: true, accountType: 'ISA' },
      { eligibleAccountTypes: ['ISA', 'GIA'] },
    );
    expect(result.eligible).toBe(true);
  });

  it('checks consent before type suitability', () => {
    const result = isAccountEligibleForModel(
      { hasConsent: false, accountType: 'SIPP' },
      { eligibleAccountTypes: ['ISA'] },
    );
    expect(result.reason).toMatch(/consent/i);
  });
});
