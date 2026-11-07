import { describe, it, expect } from 'vitest';
import {
  normalizeMeetUrl,
  transition,
  validateMinutes,
  joinSchema,
} from '../src/server/domain';
describe('Google Meet URL boundary', () => {
  it('normalizes tracking queries', () =>
    expect(
      normalizeMeetUrl('https://meet.google.com/abc-defg-hij?authuser=0#x'),
    ).toBe('https://meet.google.com/abc-defg-hij'));
  it.each([
    'http://meet.google.com/abc-defg-hij',
    'https://evil.test/abc-defg-hij',
    'https://meet.google.com.evil.test/abc-defg-hij',
    'https://meet.google.com@evil.test/abc-defg-hij',
    'https://x:pass@meet.google.com/abc-defg-hij',
    'https://meet.google.com:444/abc-defg-hij',
    'https://meet.google.com/lookup/test',
    'https://meet.google.com/abc-defg-hij/other',
    'file:///abc-defg-hij',
    'https://meet.google.com\\@evil.test/abc-defg-hij',
    'https://meet.google.com/%61bc-defg-hij',
    ' https://meet.google.com/abc-defg-hij',
    'https://meet.google.com:443/abc-defg-hij',
  ])('rejects %s', (url) => expect(() => normalizeMeetUrl(url)).toThrow());
});
describe('Capture event fencing', () => {
  it('does not accept stale runner events', () =>
    expect(transition('stopping', 'recording', 1, 2)).toBe('stopping'));
  it('never regresses terminal state', () =>
    expect(transition('cancelled', 'starting', 1, 1)).toBe('cancelled'));
  it('rejects jumping over admission', () =>
    expect(() => transition('joining', 'recording', 1, 1)).toThrow());
  it('allows admitted recording', () =>
    expect(transition('waiting_for_admission', 'recording', 1, 1)).toBe(
      'recording',
    ));
});
it('requires affirmative consent and a valid timezone', () => {
  const v = {
    url: 'https://meet.google.com/abc-defg-hij',
    title: 'Test',
    timezone: 'Africa/Lagos',
    visibility: 'private',
    durationMinutes: 30,
    consent: true,
    consentVersion: 'draft-1',
  };
  expect(joinSchema.safeParse(v).success).toBe(true);
  expect(joinSchema.safeParse({ ...v, consent: false }).success).toBe(false);
  expect(joinSchema.safeParse({ ...v, timezone: 'Mars/Orbit' }).success).toBe(
    false,
  );
  expect(joinSchema.safeParse({ ...v, scheduledAt: 'tomorrow' }).success).toBe(
    false,
  );
});
const segments = [
  {
    id: 's1',
    version: 1,
    start_ms: 100,
    end_ms: 1000,
    text: 'Check the source',
  },
];
it('validates cited draft facts against exact transcript version and interval', () => {
  const valid = {
    summary: [
      {
        text: 'Check the source',
        citations: [{ segmentId: 's1', version: 1, startMs: 100, endMs: 1000 }],
      },
    ],
    decisions: [],
    questions: [],
    actions: [],
  };
  expect(validateMinutes(valid, segments)).toEqual(valid);
  expect(() =>
    validateMinutes(
      {
        ...valid,
        summary: [
          {
            text: 'Invented',
            citations: [
              { segmentId: 's1', version: 2, startMs: 100, endMs: 1000 },
            ],
          },
        ],
      },
      segments,
    ),
  ).toThrow();
  expect(() =>
    validateMinutes(
      { ...valid, summary: [{ text: 'Uncited', citations: [] }] },
      segments,
    ),
  ).toThrow();
});
