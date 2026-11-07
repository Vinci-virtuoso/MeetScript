import { z } from 'zod';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function normalizeMeetUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError(
      400,
      'invalid_meet_url',
      'Enter a valid Google Meet URL.',
    );
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'meet.google.com' ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname) ||
    input.includes('\\') ||
    !/^https:\/\/meet\.google\.com\//.test(input)
  )
    throw new ApiError(
      400,
      'invalid_meet_url',
      'Use https://meet.google.com/abc-defg-hij.',
    );
  return `https://meet.google.com${url.pathname}`;
}
export const joinSchema = z
  .object({
    url: z.string().max(300),
    title: z.string().trim().min(1).max(160).default('Untitled meeting'),
    timezone: z
      .string()
      .max(80)
      .refine((t) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: t });
          return true;
        } catch {
          return false;
        }
      }, 'Invalid timezone'),
    visibility: z.enum(['private', 'workspace']).default('private'),
    durationMinutes: z.number().int().min(1).max(120),
    consent: z.literal(true),
    consentVersion: z.string().max(40),
  })
  .strict();
export const terminal = new Set([
  'ready',
  'partial',
  'failed',
  'denied',
  'cancelled',
]);
const transitions: Record<string, string[]> = {
  queued: ['starting', 'cancelled', 'failed'],
  starting: ['joining', 'stopping', 'cancelled', 'failed'],
  joining: ['waiting_for_admission', 'stopping', 'denied', 'failed'],
  waiting_for_admission: ['recording', 'stopping', 'denied', 'failed'],
  recording: ['stopping', 'failed'],
  stopping: ['processing', 'partial', 'failed', 'cancelled'],
  processing: ['ready', 'partial', 'failed'],
};
export function transition(
  current: string,
  next: string,
  eventEpoch: number,
  currentEpoch: number,
): string {
  if (eventEpoch !== currentEpoch || current === next || terminal.has(current))
    return current;
  if (!transitions[current]?.includes(next))
    throw new ApiError(
      409,
      'invalid_transition',
      'Capture event is out of order.',
    );
  return next;
}
export const citationSchema = z.object({
  version: z.number().int().positive(),
  segmentId: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
});
export type Citation = z.infer<typeof citationSchema>;
export interface Segment {
  id: string;
  version: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker?: string | null;
}
export function validateCitations(
  citations: Citation[],
  segments: Segment[],
): boolean {
  return (
    citations.length > 0 &&
    citations.every((c) =>
      segments.some(
        (s) =>
          s.id === c.segmentId &&
          s.version === c.version &&
          c.startMs >= s.start_ms &&
          c.endMs <= s.end_ms &&
          c.startMs < c.endMs,
      ),
    )
  );
}
export const minutesSchema = z.object({
  summary: z.array(
    z.object({
      text: z.string().max(3000),
      citations: z.array(citationSchema).min(1),
    }),
  ),
  decisions: z.array(
    z.object({
      text: z.string().max(3000),
      citations: z.array(citationSchema).min(1),
    }),
  ),
  questions: z.array(
    z.object({
      text: z.string().max(3000),
      citations: z.array(citationSchema).min(1),
    }),
  ),
  actions: z.array(
    z.object({
      title: z.string().max(300),
      owner: z.string().nullable(),
      dueDate: z.string().nullable(),
      citations: z.array(citationSchema).min(1),
    }),
  ),
});
export function validateMinutes(input: unknown, segments: Segment[]) {
  const result = minutesSchema.parse(input);
  for (const item of [
    ...result.summary,
    ...result.decisions,
    ...result.questions,
    ...result.actions,
  ])
    if (!validateCitations(item.citations, segments))
      throw new ApiError(
        422,
        'invalid_citation',
        'Generated output cites unavailable evidence.',
      );
  return result;
}
export async function hash(value: string | ArrayBuffer) {
  const data =
    typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
