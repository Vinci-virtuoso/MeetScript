import {
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
  type ReactNode,
} from 'react';
type Meeting = {
  id: string;
  title: string;
  created_at: number;
  state: string;
  visibility: string;
  duration_seconds: number;
  reason?: string;
};
type Action = {
  id: string;
  meeting_id: string;
  title: string;
  status: string;
  owner_id: string | null;
  due_date: string | null;
  revision: number;
  meeting_title?: string;
};
type User = { id: string; email: string };
type Workspace = { id: string; name: string; role: string };
type Segment = {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker?: string | null;
};
const sampleMeetings: Meeting[] = [
  {
    id: 'design-review',
    title: 'Product design review',
    created_at: Date.UTC(2026, 10, 5, 9),
    state: 'ready',
    visibility: 'private',
    duration_seconds: 1920,
  },
  {
    id: 'engineering-sync',
    title: 'Engineering weekly sync',
    created_at: Date.UTC(2026, 10, 4, 13),
    state: 'partial',
    visibility: 'workspace',
    duration_seconds: 1460,
  },
  {
    id: 'research',
    title: 'Customer research debrief',
    created_at: Date.UTC(2026, 10, 3, 10),
    state: 'ready',
    visibility: 'private',
    duration_seconds: 2280,
  },
];
const sampleSegments: Segment[] = [
  {
    id: 's1',
    start_ms: 74000,
    end_ms: 96000,
    speaker: null,
    text: 'The research is clear: people need to find the decision, then check what was actually said. Let’s keep the transcript one click away from the minutes.',
  },
  {
    id: 's2',
    start_ms: 204000,
    end_ms: 229000,
    speaker: null,
    text: 'We agreed to put recording controls at the top of the meeting. Stop should always be visible, including on mobile. I will share the updated prototype after this review.',
  },
  {
    id: 's3',
    start_ms: 492000,
    end_ms: 519000,
    speaker: null,
    text: 'Let’s test the evidence links with five participants before the next iteration. We still need to decide how to explain missing audio when retention expires.',
  },
];
const sampleActions: Action[] = [
  {
    id: 'a1',
    meeting_id: 'design-review',
    title: 'Share the updated recording controls prototype',
    status: 'open',
    owner_id: null,
    due_date: null,
    revision: 1,
    meeting_title: 'Product design review',
  },
  {
    id: 'a2',
    meeting_id: 'design-review',
    title: 'Test evidence links with five participants',
    status: 'open',
    owner_id: null,
    due_date: null,
    revision: 1,
    meeting_title: 'Product design review',
  },
  {
    id: 'a3',
    meeting_id: 'engineering-sync',
    title: 'Review the partial recording recovery flow',
    status: 'open',
    owner_id: null,
    due_date: null,
    revision: 1,
    meeting_title: 'Engineering weekly sync',
  },
];
function Icon({ name = 'notebook' }: { name?: string }) {
  const paths: Record<string, ReactNode> = {
    notebook: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    meetings: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9h10M7 13h7M7 17h4" />
      </>
    ),
    chat: <path d="M4 4h16v12H9l-5 4V4Z" />,
    actions: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3h3l3 3 2-3h4l2-3-1-3 2-2-2-3-3-1-1-3Z" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-3c0-6 16-6 16 0v3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    source: (
      <>
        <path d="M8 5H4v15h13v-4M11 4h9v9M20 4l-11 11" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-11v2" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    audio: (
      <>
        <path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? paths.notebook}
    </svg>
  );
}
function Brand() {
  return (
    <a href="/" className="brand">
      <Icon />
      MeetScript
    </a>
  );
}
function Theme() {
  const [value, set] = useState('system');
  useEffect(() => {
    set(localStorage.getItem('ms-theme') ?? 'system');
  }, []);
  return (
    <select
      className="theme-select"
      aria-label="Color theme"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        set(v);
        localStorage.setItem('ms-theme', v);
        document.documentElement.dataset.theme =
          v === 'system'
            ? matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : v;
      }}
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}
function Badge({ state }: { state: string }) {
  const text: Record<string, string> = {
    ready: 'Minutes ready',
    partial: 'Partial recording',
    waiting_for_admission: 'Waiting for admission',
    denied: 'Admission denied',
    failed: 'Capture failed',
    cancelled: 'Cancelled',
    processing: 'Processing',
    recording: 'Audio recording',
    stopping: 'Stop requested',
  };
  return (
    <span
      className={`badge ${state === 'ready' ? 'success' : state === 'partial' ? 'warning' : ['failed', 'denied'].includes(state) ? 'danger' : 'info'}`}
    >
      {text[state] ?? state}
    </span>
  );
}
function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? 'error' : ''}`}
      role={error ? 'alert' : undefined}
    >
      <Icon name="info" />
      <div>{children}</div>
    </div>
  );
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Footer() {
  return (
    <footer className="public-footer">
      <span>MeetScript · A quieter kind of meeting notebook.</span>
      <div className="row">
        <a href="/about">About</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
    </footer>
  );
}
function PublicNav() {
  return (
    <nav className="public-nav" aria-label="Main navigation">
      <Brand />
      <div className="row">
        <a className="about-link" href="/about">
          About the project
        </a>
        <Theme />
        <a className="button" href="/sign-in">
          Sign in
        </a>
      </div>
    </nav>
  );
}
function Source({
  base = '/sample',
  id = 's1',
  time = '01:14',
}: {
  base?: string;
  id?: string;
  time?: string;
}) {
  return (
    <a
      className="citation"
      href={`${base}/meetings/design-review?tab=transcript#${id}`}
    >
      <Icon name="source" />
      {time} · transcript
    </a>
  );
}
function Landing() {
  return (
    <>
      <PublicNav />
      <main id="main">
        <section className="hero">
          <div>
            <p className="eyebrow">
              A little less note-taking. A lot more clarity.
            </p>
            <h1>
              Your meetings,
              <br />
              with receipts.
            </h1>
            <p className="lead">
              Keep the conversation. Find the decisions. Turn what was said into
              minutes you can actually trace back.
            </p>
            <div className="row">
              <a className="button primary" href="/sample">
                Explore the notebook <Icon name="arrow" />
              </a>
              <a className="button" href="/sign-in">
                Sign in
              </a>
            </div>
            <p className="note">
              <Icon name="lock" /> Private by default. Visible recording. You
              stay in control.
            </p>
            <p className="small muted">
              Live capture is not yet available. This preview uses clearly
              labelled sample meetings.
            </p>
          </div>
          <article className="preview">
            <header>
              <span className="sample-label">
                Sample meeting — not a live recording
              </span>
              <div className="spread">
                <span className="eyebrow" style={{ margin: 0 }}>
                  MEETING NOTEBOOK
                </span>
                <Badge state="ready" />
              </div>
              <h2 style={{ margin: '18px 0 8px' }}>Product design review</h2>
              <span className="small muted">
                5 November 2026 · 32 min · Private
              </span>
            </header>
            <h3>The important part, kept.</h3>
            <p className="small">
              The team agreed to keep recording controls visible and put the
              original evidence one click from every decision.
            </p>
            <Source />
            <hr className="divider" />
            <div className="spread">
              <h3 style={{ margin: 0 }}>Next steps</h3>
              <span className="badge">Draft · needs review</span>
            </div>
            <div className="action-row">
              <Icon name="actions" />
              <div>
                <p>Share the updated recording controls prototype</p>
                <small>Unassigned · No due date inferred</small>
              </div>
            </div>
          </article>
        </section>
        <section className="steps" aria-label="How it works">
          <div>
            <p className="number">01 / BRING THE CONVERSATION</p>
            <h3>A link. Clear consent.</h3>
            <p>
              The planned capture flow uses a pasted Meet link and a visibly
              named recording bot. Everyone’s consent comes first.
            </p>
          </div>
          <div>
            <p className="number">02 / KEEP THE EVIDENCE</p>
            <h3>Minutes with a source.</h3>
            <p>
              Follow a decision back to the precise transcript segment. Unknown
              speakers stay unknown.
            </p>
          </div>
          <div>
            <p className="number">03 / FOLLOW THROUGH</p>
            <h3>Actions you can review.</h3>
            <p>
              Confirm the next step, correct a detail, and keep ownership and
              dates explicit.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
function Legal({ path }: { path: string }) {
  const about = path === '/about',
    privacy = path === '/privacy';
  return (
    <>
      <PublicNav />
      <main id="main" className="prose">
        <p className="eyebrow">
          {about ? 'THE PROJECT' : 'DRAFT · OWNER REVIEW REQUIRED'}
        </p>
        <h1>
          {about
            ? 'Meetings deserve a better memory.'
            : privacy
              ? 'Privacy & recording'
              : 'Terms of use'}
        </h1>
        <p className="muted">Last updated 7 November 2026</p>
        {about ? (
          <>
            <p>
              MeetScript is a portfolio project exploring a quiet, evidence-led
              meeting notebook: audio, timestamped transcripts, cited minutes,
              and actions reviewed by people.
            </p>
            <h2>Built around explicit consent</h2>
            <p>
              The proposed recording bot is visibly named “MeetScript —
              recording.” Camera and microphone stay off. Host admission does
              not replace participant consent. Authentication-required or denied
              meetings fail explicitly.
            </p>
            <h2>Cloudflare architecture</h2>
            <p>
              Astro and React provide the interface. Workers and D1 enforce
              workspace access. Planned capture uses Cloudflare Containers
              controlled by Durable Objects, private R2 audio, Workers AI, and
              Vectorize.
            </p>
            <Notice>
              Real capture, transcription, and retrieval have not passed live
              acceptance. Public samples are illustrative fixtures.
            </Notice>
            <a href="/sample">Explore a sample notebook →</a>
          </>
        ) : (
          <>
            <Notice>
              Draft policy. The owner must approve recording disclosure,
              retention, contact details, and applicable terms before release.
            </Notice>
            <h2>{privacy ? 'Recording and consent' : 'Authorized use'}</h2>
            <p>
              Only verified, active workspace members may request a recording.
              The organizer must disclose the bot’s presence and obtain
              affirmative participant consent under an approved procedure. Stop
              if consent is withdrawn.
            </p>
            <h2>Private content and retention</h2>
            <p>
              Meetings are creator-private by default. Proposed pilot retention
              is 30 days for audio and 90 days for transcripts, minutes, and
              actions. Workspace owners can shorten these values. Generated
              answers must expire with their evidence.
            </p>
            <h2>Deletion and limitations</h2>
            <p>
              Deletion blocks access immediately, then queues removal of media,
              transcripts, embeddings, and dependent answers. Cleanup failures
              must be visible and retried. Backup expiry and restore procedures
              require verification before release.
            </p>
            <h2>AI output needs review</h2>
            <p>
              Generated minutes can be incomplete or incorrect. Review evidence
              before acting. Mixed audio does not reliably identify speakers.
            </p>
            <h2>Contact</h2>
            <p>
              The owner’s support and privacy contact is not configured. Public
              release remains blocked until it is supplied.
            </p>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let accessToken = '';
let refreshPromise: Promise<void> | null = null;
async function refreshAccess() {
  if (!refreshPromise)
    refreshPromise = (async () => {
      const r = await fetch('/auth/web/refresh', { method: 'POST' });
      if (r.ok && r.status !== 204)
        accessToken = ((await r.json()) as { accessToken: string }).accessToken;
      else accessToken = '';
    })().finally(() => {
      refreshPromise = null;
    });
  await refreshPromise;
}
async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  if (!accessToken) await refreshAccess();
  let r = await fetch(path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401 && accessToken) {
    await refreshAccess();
    r = await fetch(path, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  const data = (await r.json()) as {
    message: string;
    accessToken: string;
    challengeId: string;
  };
  if (!r.ok)
    throw new HttpError(data.message ?? 'The request failed.', r.status);
  return data as unknown as T;
}
function SignIn({ path }: { path: string }) {
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [challengeId, setChallenge] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    setChallenge(sessionStorage.getItem('ms-challenge') ?? '');
    setEmail(sessionStorage.getItem('ms-email') ?? '');
    setSent(path.endsWith('/code') && !!sessionStorage.getItem('ms-challenge'));
  }, [path]);
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/auth/web/code/${sent ? 'verify' : 'send'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sent ? { challengeId, code } : { email }),
      });
      const data = (await r.json()) as {
        message: string;
        accessToken: string;
        challengeId: string;
      };
      if (!r.ok) throw new Error(data.message);
      if (sent) {
        accessToken = data.accessToken;
        sessionStorage.removeItem('ms-challenge');
        location.href = '/app';
      } else {
        setChallenge(data.challengeId);
        sessionStorage.setItem('ms-challenge', data.challengeId);
        sessionStorage.setItem('ms-email', email);
        setSent(true);
        history.replaceState({}, '', '/sign-in/code');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PublicNav />
      <main id="main" className="auth card">
        <p className="eyebrow">YOUR MEETING NOTEBOOK</p>
        <h1>{sent ? 'Check your email' : 'Welcome back.'}</h1>
        <p className="muted">
          {sent
            ? `Enter the six-digit code sent to ${email}.`
            : 'Sign in with a one-time email code. No passwords to remember.'}
        </p>
        <form onSubmit={submit}>
          {sent ? (
            <div className="field">
              <label htmlFor="code">Verification code</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? 'Please wait…'
              : sent
                ? 'Verify and sign in'
                : 'Send sign-in code'}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: 24 }}>
          Email delivery requires an owner-configured auth mail service.{' '}
          <a href="/sample">Explore the sample</a> while setup is incomplete.
        </p>
        {sent && (
          <button
            onClick={() => {
              setSent(false);
              setCode('');
            }}
          >
            Use a different email
          </button>
        )}
      </main>
      <Footer />
    </>
  );
}
function JoinDialog({
  sample,
  onClose,
  workspace,
}: {
  sample: boolean;
  onClose: () => void;
  workspace?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [valid, setValid] = useState(false),
    [consent, setConsent] = useState(false);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const data = new FormData(e.currentTarget),
      url = String(data.get('url'));
    try {
      const u = new URL(url);
      if (
        u.origin !== 'https://meet.google.com' ||
        !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname) ||
        u.username ||
        u.password ||
        url.includes('\\')
      )
        throw new Error();
    } catch {
      setError(
        'Use a Google Meet URL such as https://meet.google.com/abc-defg-hij.',
      );
      return;
    }
    if (!consent) {
      setError('Confirm recording disclosure and consent authority.');
      return;
    }
    setBusy(true);
    try {
      if (sample)
        throw new Error(
          'This is a sample workspace. No bot will join. Live capture remains unavailable until G0 passes.',
        );
      await api(`/api/workspaces/${workspace}/meetings`, {
        url,
        title: data.get('title') || 'Untitled meeting',
        timezone: data.get('timezone'),
        durationMinutes: Number(data.get('duration')),
        visibility: data.get('visibility'),
        consent: true,
        consentVersion: 'draft-1',
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="join-title">
      <div className="dialog-head">
        <h2 id="join-title">Join a meeting</h2>
        <button
          className="icon-button"
          aria-label="Close join dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <Notice>
        Live capture is unavailable. The Cloudflare feasibility gate has not
        passed.
      </Notice>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="meet-url">Google Meet URL</label>
          <input
            id="meet-url"
            name="url"
            type="url"
            required
            placeholder="https://meet.google.com/abc-defg-hij"
            aria-describedby="meet-help"
            onChange={(e) =>
              setValid(
                /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:[?#].*)?$/.test(
                  e.target.value,
                ),
              )
            }
          />
          <small id="meet-help">
            The host must admit MeetScript. Some meetings require authentication
            and cannot be joined.
          </small>
        </div>
        <div className="field">
          <label htmlFor="title">
            Meeting title <span className="muted">(optional)</span>
          </label>
          <input id="title" name="title" maxLength={160} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="visibility">Who can access</label>
            <select id="visibility" name="visibility">
              <option value="private">Private · only me</option>
              <option value="workspace">Workspace members</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="duration">Maximum duration</label>
            <select id="duration" name="duration">
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
              <option value="120">120 minutes</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="timezone">Meeting timezone</label>
          <input
            id="timezone"
            name="timezone"
            defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
            required
          />
        </div>
        <p className="small muted">
          Bot identity: <strong>MeetScript — recording</strong>. Audio only;
          microphone and camera off. Pilot limits: 2 concurrent recordings, 600
          minutes per rolling 30 days. These limits still require live
          validation.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I have disclosed audio recording and have affirmative participant
            consent and authority to record. I will stop if consent is
            withdrawn.
          </span>
        </label>
        {error && (
          <p role="alert" className="form-error" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}
        <p className="small muted">
          {!valid ? 'Enter a valid Meet link. ' : ''}
          {!consent ? 'Confirm consent to continue.' : ''}
        </p>
        <div
          className="row"
          style={{ justifyContent: 'flex-end', marginTop: 24 }}
        >
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!valid || !consent || busy}>
            {busy ? 'Checking…' : 'Join meeting'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function MeetingList({
  meetings,
  base,
}: {
  meetings: Meeting[];
  base: string;
}) {
  return (
    <>
      {meetings.map((m) => (
        <a key={m.id} className="meeting-row" href={`${base}/meetings/${m.id}`}>
          <div>
            <h3>{m.title}</h3>
            <div className="meta">
              <span>
                {new Date(m.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span>{Math.round(m.duration_seconds / 60)} min maximum</span>
              <span>
                {m.visibility === 'private' ? 'Private' : 'Workspace'}
              </span>
            </div>
          </div>
          <Badge state={m.state} />
        </a>
      ))}
    </>
  );
}
export default function Notebook({ path }: { path: string }) {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  const sample = path.startsWith('/sample'),
    base = sample ? '/sample' : '/app',
    route = sample ? path.replace('/sample', '/app') : path;
  const [join, setJoin] = useState(false),
    [drawer, setDrawer] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [meetings, setMeetings] = useState<Meeting[]>([]),
    [actions, setActions] = useState<Action[]>([]),
    [loading, setLoading] = useState(!sample),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [visibility, setVisibility] = useState(''),
    [empty, setEmpty] = useState(false);
  const workspace = workspaces[0];
  const mainRef = useRef<HTMLElement>(null),
    menuRef = useRef<HTMLButtonElement>(null),
    drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (sample) {
      setUser({ id: 'sample', email: 'sample@example.invalid' });
      setWorkspaces([
        { id: 'sample', name: 'The sample notebook', role: 'owner' },
      ]);
      setMeetings(sampleMeetings);
      try {
        setActions(
          JSON.parse(localStorage.getItem('ms-sample-actions') ?? 'null') ??
            sampleActions,
        );
      } catch {
        setActions(sampleActions);
      }
      setEmpty(new URLSearchParams(location.search).get('state') === 'empty');
      return;
    }
    if (
      !route.startsWith('/app') &&
      route !== '/account' &&
      route !== '/onboarding'
    )
      return;
    let alive = true;
    (async () => {
      try {
        const me = await api<{ user: User; workspaces: Workspace[] }>(
          '/api/me',
        );
        if (!alive) return;
        setUser(me.user);
        setWorkspaces(me.workspaces);
        if (me.workspaces[0]) {
          const w = me.workspaces[0].id;
          const [m, a] = await Promise.all([
            api<{ items: Meeting[] }>(`/api/workspaces/${w}/meetings`),
            api<{ items: Action[] }>(`/api/workspaces/${w}/actions`),
          ]);
          if (alive) {
            setMeetings(m.items);
            setActions(a.items);
          }
        }
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setMeetings([]);
          setActions([]);
          if (e instanceof HttpError && e.status === 401) {
            setUser(null);
            accessToken = '';
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sample, route]);
  useEffect(() => {
    if (!drawer) return;
    const el = drawerRef.current!;
    const previous = document.activeElement as HTMLElement;
    const links = el.querySelectorAll<HTMLElement>('a,button');
    links[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawer(false);
        return;
      }
      if (e.key === 'Tab') {
        const first = links[0],
          last = links[links.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [drawer]);
  async function updateAction(action: Action, patch: Partial<Action>) {
    setError('');
    try {
      let updated: Action;
      if (sample) {
        updated = { ...action, ...patch, revision: action.revision + 1 };
      } else
        updated = await api<Action>(
          `/api/workspaces/${workspace?.id}/meetings/${action.meeting_id}/actions/${action.id}`,
          {
            title: patch.title ?? action.title,
            status: patch.status ?? action.status,
            ownerId: action.owner_id,
            dueDate:
              patch.due_date === undefined ? action.due_date : patch.due_date,
            expectedRevision: action.revision,
          },
          'PATCH',
        );
      const next = actions.map((a) => (a.id === action.id ? updated : a));
      setActions(next);
      if (sample)
        localStorage.setItem('ms-sample-actions', JSON.stringify(next));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (path === '/') return <Landing />;
  if (['/about', '/privacy', '/terms'].includes(path))
    return <Legal path={path} />;
  if (path.startsWith('/sign-in')) return <SignIn path={path} />;
  const active = route.split('/')[2] ?? 'overview',
    detail = route.startsWith('/app/meetings/'),
    meetingId = route.split('/')[3],
    filtered = empty
      ? []
      : meetings.filter(
          (m) =>
            m.title.toLowerCase().includes(search.toLowerCase()) &&
            (!status || m.state === status) &&
            (!visibility || m.visibility === visibility),
        );
  const heading = detail
    ? 'Meeting notebook'
    : route === '/account' || route === '/app/account'
      ? 'Your account'
      : route === '/onboarding'
        ? 'Create your workspace'
        : ({
            overview: 'Overview',
            meetings: 'Meetings',
            chat: 'Chat',
            actions: 'Actions',
            settings: 'Workspace settings',
          }[active] ?? 'Page not found');
  const nav = [
    ['overview', 'Overview', 'home', base],
    ['meetings', 'Meetings', 'meetings', `${base}/meetings`],
    ['chat', 'Chat', 'chat', `${base}/chat`],
    ['actions', 'Actions', 'actions', `${base}/actions`],
  ];
  function actionRows(items: Action[]) {
    return items.map((a) => (
      <div className="action-row" key={a.id}>
        <input
          aria-label={`Complete: ${a.title}`}
          type="checkbox"
          checked={a.status === 'complete'}
          onChange={(e) =>
            updateAction(a, { status: e.target.checked ? 'complete' : 'open' })
          }
        />
        <div style={{ flex: 1 }}>
          <p
            style={{
              textDecoration:
                a.status === 'complete' ? 'line-through' : undefined,
            }}
          >
            {a.title}
          </p>
          <small>
            {a.owner_id ?? 'Unassigned'} · {a.due_date ?? 'No due date'}
            <br />
            {a.meeting_title}
          </small>
        </div>
        {active === 'actions' && (
          <ActionEdit action={a} save={(patch) => updateAction(a, patch)} />
        )}
      </div>
    ));
  }
  return (
    <>
      <aside
        ref={drawerRef}
        className={`sidebar ${drawer ? 'open' : ''}`}
        aria-label="Workspace navigation"
        role={drawer ? 'dialog' : undefined}
        aria-modal={drawer || undefined}
      >
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        >
          <Icon name="close" />
        </button>
        <Brand />
        <div className="workspace">
          <strong>{workspace?.name ?? 'Your workspace'}</strong>
          <small>
            {sample
              ? 'Illustrative fixtures'
              : (user?.email ?? 'Sign-in required')}
          </small>
        </div>
        <nav className="nav-group" aria-label="Notebook">
          {nav.map(([id, label, icon, url]) => (
            <a
              className="nav-link"
              key={id}
              href={url}
              aria-current={active === id ? 'page' : undefined}
            >
              <Icon name={icon} />
              {label}
            </a>
          ))}
        </nav>
        <nav className="nav-group nav-bottom" aria-label="Manage workspace">
          <a
            className="nav-link"
            href={`${base}/settings/workspace`}
            aria-current={active === 'settings' ? 'page' : undefined}
          >
            <Icon name="settings" />
            Settings
          </a>
          <a
            className="nav-link"
            href={sample ? `${base}/account` : '/account'}
          >
            <Icon name="user" />
            Account
          </a>
        </nav>
        <footer>
          A quieter kind of meeting notebook.
          <br />
          <a href="/privacy">Privacy & consent</a>
        </footer>
      </aside>
      <div className="shell">
        <header className="topbar">
          <button
            ref={menuRef}
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" />
          </button>
          <span className="breadcrumb">
            Notebook <span aria-hidden="true"> / </span> {heading}
          </span>
          <div className="toolbar">
            <Theme />
            <button className="primary" onClick={() => setJoin(true)}>
              <Icon name="plus" />
              Join meeting
            </button>
          </div>
        </header>
        {sample && (
          <div className="sample-banner">
            Sample workspace — not a live recording. Changes affect sample data
            in this browser only.{' '}
            <a href="/sign-in">Sign in to your workspace</a>
          </div>
        )}
        <main ref={mainRef} id="main" className="page" tabIndex={-1}>
          <header className="page-header">
            <div className="spread">
              <div>
                <p className="eyebrow muted">
                  {sample ? 'THE SAMPLE NOTEBOOK' : 'YOUR MEETING NOTEBOOK'}
                </p>
                <h1>{heading}</h1>
                <p>
                  {active === 'overview'
                    ? 'Less searching. More following through.'
                    : active === 'meetings'
                      ? 'Every conversation, with its context.'
                      : active === 'actions'
                        ? 'The next steps, ready for a human review.'
                        : active === 'chat'
                          ? 'Ask a question. Follow the evidence.'
                          : ''}
                </p>
              </div>
              {sample && active === 'overview' && (
                <button onClick={() => setEmpty(!empty)}>
                  {empty ? 'Show sample meetings' : 'Preview empty state'}
                </button>
              )}
            </div>
          </header>
          {error && (
            <Notice error>
              <p>{error}</p>
              {!user ? (
                <a href="/sign-in">Sign in</a>
              ) : (
                <button onClick={() => location.reload()}>Retry</button>
              )}
            </Notice>
          )}
          {loading ? (
            <div className="pending" role="status">
              Loading your notebook…
            </div>
          ) : !user && !sample ? (
            <div className="card">
              <Empty
                title="Your notebook is private"
                action={
                  <a className="button primary" href="/sign-in">
                    Sign in
                  </a>
                }
              >
                Sign in to access your workspace. You can also explore the
                labelled public sample.
              </Empty>
              <p style={{ textAlign: 'center' }}>
                <a href="/sample">Explore the sample notebook</a>
              </p>
            </div>
          ) : !workspace ? (
            <Onboarding />
          ) : detail ? (
            <MeetingDetail
              meeting={meetings.find((m) => m.id === meetingId)}
              base={base}
              sample={sample}
              workspace={workspace.id}
              actions={actions}
              actionRows={actionRows}
            />
          ) : active === 'overview' ? (
            <>
              <Notice>
                <p>
                  Live capture is unavailable while the Cloudflare feasibility
                  test is pending.{' '}
                  {sample
                    ? 'These notes demonstrate the intended experience.'
                    : 'Your workspace data stays separate from public samples.'}
                </p>
              </Notice>
              <div className="grid">
                <section className="card">
                  <div className="card-head">
                    <h2>Recent minutes</h2>
                    <a className="text-link" href={`${base}/meetings`}>
                      All meetings →
                    </a>
                  </div>
                  {filtered.length ? (
                    <MeetingList meetings={filtered} base={base} />
                  ) : (
                    <Empty
                      title="Room for your first conversation"
                      action={
                        <button onClick={() => setJoin(true)}>
                          Review the join flow
                        </button>
                      }
                    >
                      When capture is available, paste a Meet link and confirm
                      consent. Your notes will appear here.
                    </Empty>
                  )}
                </section>
                <section className="card">
                  <div className="card-head">
                    <h2>Open actions</h2>
                    <span className="badge">
                      {empty
                        ? 0
                        : actions.filter((a) => a.status === 'open')
                            .length}{' '}
                      to review
                    </span>
                  </div>
                  {!empty && actions.some((a) => a.status === 'open') ? (
                    actionRows(actions.filter((a) => a.status === 'open'))
                  ) : (
                    <Empty title="A clear page">
                      No open actions in this workspace.
                    </Empty>
                  )}
                  <a className="text-link" href={`${base}/actions`}>
                    Review all actions →
                  </a>
                </section>
              </div>
              <p className="usage">
                {sample
                  ? 'Sample usage is excluded from operational totals.'
                  : 'Capture disabled · No recording has been started.'}
                <a href={`${base}/settings/usage`}>Operational limits →</a>
              </p>
            </>
          ) : active === 'meetings' ? (
            <>
              <div className="filters">
                <input
                  type="search"
                  aria-label="Search meetings"
                  placeholder="Search meeting titles…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Meeting status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="ready">Minutes ready</option>
                  <option value="partial">Partial</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
                <select
                  aria-label="Meeting visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="">All access</option>
                  <option value="private">Private</option>
                  <option value="workspace">Workspace</option>
                </select>
              </div>
              <section className="card">
                {filtered.length ? (
                  <MeetingList meetings={filtered} base={base} />
                ) : (
                  <Empty
                    title={
                      search || status || visibility
                        ? 'No matching meetings'
                        : 'No meetings yet'
                    }
                    action={
                      <button
                        onClick={() => {
                          setSearch('');
                          setStatus('');
                          setVisibility('');
                        }}
                      >
                        Clear filters
                      </button>
                    }
                  >
                    Try a different search or return when your first meeting is
                    ready.
                  </Empty>
                )}
              </section>
            </>
          ) : active === 'actions' ? (
            <ActionsPanel actions={actions} render={actionRows} />
          ) : active === 'chat' ? (
            <Chat sample={sample} base={base} workspace={workspace.id} />
          ) : active === 'settings' ? (
            <Settings
              sample={sample}
              path={route}
              base={base}
              workspace={workspace}
            />
          ) : route === '/account' ||
            route === '/app/account' ||
            route === '/app/account' ? (
            <Account user={user} sample={sample} />
          ) : route === '/onboarding' ? (
            <Onboarding />
          ) : (
            <Empty
              title="Page not found"
              action={<a href={base}>Back to the notebook</a>}
            >
              This page is unavailable.
            </Empty>
          )}
        </main>
      </div>
      {join && (
        <JoinDialog
          sample={sample}
          workspace={workspace?.id}
          onClose={() => setJoin(false)}
        />
      )}
    </>
  );
}
function ActionsPanel({
  actions,
  render,
}: {
  actions: Action[];
  render: (a: Action[]) => ReactNode;
}) {
  const [status, setStatus] = useState('open'),
    [q, setQ] = useState('');
  const filtered = actions.filter(
    (a) =>
      (!status || a.status === status) &&
      a.title.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="filters">
        <input
          type="search"
          aria-label="Search actions"
          placeholder="Find an action…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Action status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Open actions</option>
          <option value="complete">Completed</option>
          <option value="">All actions</option>
        </select>
      </div>
      <section className="card">
        {filtered.length ? (
          render(filtered)
        ) : (
          <Empty title="Nothing to follow up">
            There are no actions matching these filters.
          </Empty>
        )}
      </section>
    </>
  );
}
function ActionEdit({
  action,
  save,
}: {
  action: Action;
  save: (patch: Partial<Action>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)}>Edit</button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby={`edit-${action.id}`}
      >
        <div className="dialog-head">
          <h2 id={`edit-${action.id}`}>Review action</h2>
          <button
            className="icon-button"
            aria-label="Close action editor"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            await save({
              title: String(data.get('title')),
              due_date: String(data.get('due')) || null,
            });
            setBusy(false);
            setOpen(false);
          }}
        >
          <div className="field">
            <label htmlFor={`title-${action.id}`}>Action</label>
            <textarea
              id={`title-${action.id}`}
              name="title"
              defaultValue={action.title}
              required
              maxLength={300}
            />
          </div>
          <div className="field">
            <label htmlFor={`due-${action.id}`}>Due date (optional)</label>
            <input
              id={`due-${action.id}`}
              name="due"
              type="date"
              defaultValue={action.due_date ?? ''}
            />
            <small>No date was inferred from the sample conversation.</small>
          </div>
          <p className="small muted">
            Owner: {action.owner_id ?? 'Unassigned'} · Revision{' '}
            {action.revision}
          </p>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save reviewed action'}
          </button>
        </form>
      </dialog>
    </>
  );
}
function MeetingDetail({
  meeting,
  base,
  sample,
  workspace,
  actions,
  actionRows,
}: {
  meeting?: Meeting;
  base: string;
  sample: boolean;
  workspace: string;
  actions: Action[];
  actionRows: (a: Action[]) => ReactNode;
}) {
  const [tab, setTab] = useState('minutes'),
    [segments, setSegments] = useState<Segment[]>([]),
    [error, setError] = useState(''),
    [q, setQ] = useState('');
  useEffect(() => {
    const v = new URLSearchParams(location.search).get('tab');
    if (v && ['minutes', 'transcript', 'audio', 'actions'].includes(v))
      setTab(v);
    if (sample) setSegments(sampleSegments);
    else if (meeting)
      api<{ segments: Segment[] }>(
        `/api/workspaces/${workspace}/meetings/${meeting.id}/transcript`,
      )
        .then((d) => setSegments(d.segments))
        .catch((e) => setError(e.message));
  }, [sample, meeting?.id, workspace]);
  if (!meeting)
    return (
      <Empty
        title="Meeting unavailable"
        action={<a href={`${base}/meetings`}>Back to meetings</a>}
      >
        This meeting may have been deleted, or you may not have access.
      </Empty>
    );
  return (
    <>
      <div
        className="spread"
        style={{ marginBottom: 24, alignItems: 'flex-start' }}
      >
        <div>
          <h2>{meeting.title}</h2>
          <p className="small muted">
            {new Date(meeting.created_at).toLocaleString()} ·{' '}
            {meeting.visibility} · {Math.round(meeting.duration_seconds / 60)}{' '}
            min maximum
          </p>
        </div>
        <Badge state={meeting.state} />
      </div>
      {meeting.state === 'partial' && (
        <Notice>
          This sample illustrates partial media. The end of the recording is
          missing; minutes cannot establish what was said after the available
          interval.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      <div className="tabs" role="tablist" aria-label="Meeting content">
        {['minutes', 'transcript', 'audio', 'actions'].map((t) => (
          <button
            role="tab"
            key={t}
            id={`tab-${t}`}
            aria-controls={`panel-${t}`}
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={(e) => {
              const tabs = ['minutes', 'transcript', 'audio', 'actions'];
              let next = t;
              if (e.key === 'ArrowRight')
                next = tabs[(tabs.indexOf(t) + 1) % 4];
              else if (e.key === 'ArrowLeft')
                next = tabs[(tabs.indexOf(t) + 3) % 4];
              else if (e.key === 'Home') next = 'minutes';
              else if (e.key === 'End') next = 'actions';
              else return;
              e.preventDefault();
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        <div className="detail">
          <section className="card content">
            {tab === 'minutes' ? (
              sample ? (
                <>
                  <div className="row" style={{ marginBottom: 24 }}>
                    <span className="badge warning">
                      AI draft · needs review
                    </span>
                    <span className="small muted">Sample transcript v1</span>
                  </div>
                  <h2>Summary</h2>
                  <p>
                    The team focused on making meeting evidence easy to find,
                    with recording controls visible throughout the experience.
                  </p>
                  <Source base={base} />
                  <h2>Decisions</h2>
                  <p>
                    Keep recording controls at the top of the meeting, including
                    on mobile.
                  </p>
                  <Source base={base} id="s2" time="03:24" />
                  <h2>Unresolved questions</h2>
                  <p>
                    How should the product explain missing audio after retention
                    expires?
                  </p>
                  <Source base={base} id="s3" time="08:12" />
                  <h2>Actions to review</h2>
                  {actionRows(
                    actions.filter((a) => a.meeting_id === meeting.id),
                  )}
                </>
              ) : (
                <Empty title="Minutes are not available">
                  Real audio processing has not been configured. No minutes have
                  been generated for this meeting.
                </Empty>
              )
            ) : tab === 'transcript' ? (
              <>
                <div className="field">
                  <label htmlFor="transcript-search">Find in transcript</label>
                  <input
                    id="transcript-search"
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search the conversation…"
                  />
                </div>
                {segments.length ? (
                  segments
                    .filter((s) =>
                      s.text.toLowerCase().includes(q.toLowerCase()),
                    )
                    .map((s) => (
                      <article key={s.id} id={s.id} className="segment">
                        <div className="segment-header">
                          <a href={`#${s.id}`}>
                            {String(Math.floor(s.start_ms / 60000)).padStart(
                              2,
                              '0',
                            )}
                            :
                            {String(
                              Math.floor(s.start_ms / 1000) % 60,
                            ).padStart(2, '0')}
                          </a>
                          <strong className="small">
                            {s.speaker ?? 'Unknown speaker'}
                          </strong>
                        </div>
                        <p>{s.text}</p>
                      </article>
                    ))
                ) : (
                  <Empty title="No transcript available">
                    Transcript text appears only after successful audio
                    processing.
                  </Empty>
                )}
              </>
            ) : tab === 'audio' ? (
              <Empty
                title={
                  sample
                    ? 'Sample audio is not provided'
                    : 'Audio is unavailable'
                }
              >
                <span>
                  {sample
                    ? 'This is a text fixture. There is no participant recording or generated waveform to play.'
                    : 'No retained playable recording is available for this meeting.'}
                </span>
              </Empty>
            ) : (
              actionRows(actions.filter((a) => a.meeting_id === meeting.id))
            )}
          </section>
          <aside className="card">
            <h3>Evidence, one click away.</h3>
            <p className="small muted">
              Minutes are drafts. Check the original words before acting on a
              decision.
            </p>
            {sample &&
              sampleSegments.map((s, i) => (
                <div className="evidence-item" key={s.id}>
                  <span className="small muted">Unknown speaker</span>
                  <p>{s.text.slice(0, 105)}…</p>
                  <Source
                    base={base}
                    id={s.id}
                    time={['01:14', '03:24', '08:12'][i]}
                  />
                </div>
              ))}
            <hr className="divider" />
            <a href={`${base}/chat`}>Ask a question about your meetings →</a>
          </aside>
        </div>
      </div>
    </>
  );
}
function Chat({
  sample,
  base,
  workspace,
}: {
  sample: boolean;
  base: string;
  workspace: string;
}) {
  const [question, setQuestion] = useState(''),
    [messages, setMessages] = useState<
      { question: string; answer: string; source: boolean }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (sample) {
        const source = /decid|record|control|agree/i.test(question);
        setMessages([
          ...messages,
          {
            question,
            answer: source
              ? 'The team agreed to keep recording controls at the top of the meeting, including on mobile. This is a fixed sample answer, not a live AI response.'
              : 'I could not find that in the selected meetings. This sample only includes the design review excerpts.',
            source,
          },
        ]);
        setQuestion('');
      } else
        await api(`/api/workspaces/${workspace}/chat`, {
          question,
          meetingIds: [],
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="chat-layout">
      <aside className="card chat-history">
        <h3>Your conversations</h3>
        <p className="small muted">
          {sample
            ? 'Sample conversation · browser session only'
            : 'No conversations yet.'}
        </p>
        <button onClick={() => setMessages([])}>
          <Icon name="plus" />
          New conversation
        </button>
        <hr className="divider" />
        <p className="small muted">Scope</p>
        <span className="badge">
          {sample ? 'Product design review' : 'Authorized workspace'}
        </span>
      </aside>
      <section className="card thread">
        <div className="chat-messages">
          {messages.length ? (
            messages.map((m, i) => (
              <div key={i}>
                <div className="message user">
                  <strong>You</strong>
                  <p>{m.question}</p>
                </div>
                <div className="message">
                  <strong>MeetScript {sample ? '· sample answer' : ''}</strong>
                  <p>{m.answer}</p>
                  {m.source && <Source base={base} id="s2" time="03:24" />}
                </div>
              </div>
            ))
          ) : (
            <Empty title="Start with a question">
              Ask what was decided, what remains open, or where a next step came
              from. Answers should lead you back to the source.
            </Empty>
          )}
        </div>
        {error && <Notice error>{error}</Notice>}
        <form className="composer" onSubmit={send}>
          <label htmlFor="question">Ask about the selected meetings</label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What did we decide about recording controls?"
            maxLength={2000}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="row">
            <small className="muted">
              {sample
                ? 'Sample responses · no live AI'
                : 'Read-only · evidence required'}
            </small>
            <button className="primary" disabled={!question.trim() || busy}>
              {busy ? 'Checking…' : 'Send'}
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function Settings({
  sample,
  path,
  base,
  workspace,
}: {
  sample: boolean;
  path: string;
  base: string;
  workspace: Workspace;
}) {
  const section = path.split('/')[3] ?? 'workspace';
  const [settings, setSettings] = useState({
      name: workspace.name,
      audio_days: 30,
      content_days: 90,
      revision: 1,
    }),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [members, setMembers] = useState<
      { email: string; role: string; status: string }[]
    >([]),
    [usage, setUsage] = useState<{
      reservedSeconds: number;
      capturedSeconds: number;
    } | null>(null);
  useEffect(() => {
    if (sample) {
      setMembers([
        { email: 'sample@example.invalid', role: 'owner', status: 'active' },
      ]);
      return;
    }
    api<typeof settings>(`/api/workspaces/${workspace.id}/settings`)
      .then(setSettings)
      .catch((e) => setError(e.message));
    if (section === 'members')
      api<{ items: typeof members }>(`/api/workspaces/${workspace.id}/members`)
        .then((d) => setMembers(d.items))
        .catch((e) => setError(e.message));
    if (section === 'usage')
      api<NonNullable<typeof usage>>(`/api/workspaces/${workspace.id}/usage`)
        .then(setUsage)
        .catch((e) => setError(e.message));
  }, [sample, workspace.id, section]);
  async function save(e: SubmitEvent) {
    e.preventDefault();
    setError('');
    try {
      if (!sample) {
        const result = await api<{ revision: number }>(
          `/api/workspaces/${workspace.id}/settings`,
          {
            name: settings.name,
            audioDays: settings.audio_days,
            contentDays: settings.content_days,
            expectedRevision: settings.revision,
          },
          'PATCH',
        );
        setSettings({ ...settings, revision: result.revision });
      }
      setMessage(
        sample ? 'Sample settings updated in this view.' : 'Settings saved.',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <nav className="settings-nav" aria-label="Settings">
        {['workspace', 'members', 'privacy', 'usage'].map((t) => (
          <a
            key={t}
            href={`${base}/settings/${t}`}
            aria-current={section === t ? 'page' : undefined}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </a>
        ))}
      </nav>
      {error && <Notice error>{error}</Notice>}
      {message && <p role="status">{message}</p>}
      <section className="card settings-form">
        {section === 'workspace' || section === 'privacy' ? (
          <form onSubmit={save}>
            <h2>
              {section === 'privacy'
                ? 'Privacy & retention'
                : 'Workspace details'}
            </h2>
            {section === 'workspace' ? (
              <div className="field">
                <label htmlFor="workspace-name">Workspace name</label>
                <input
                  id="workspace-name"
                  value={settings.name}
                  onChange={(e) =>
                    setSettings({ ...settings, name: e.target.value })
                  }
                  required
                  maxLength={80}
                />
              </div>
            ) : (
              <>
                <Notice>
                  Recording disclosure is a draft. The owner must approve an
                  affirmative consent and stop procedure before real use.
                </Notice>
                <div className="field">
                  <label htmlFor="audio-days">Audio retention (days)</label>
                  <input
                    id="audio-days"
                    type="number"
                    min={1}
                    max={30}
                    value={settings.audio_days}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        audio_days: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="content-days">
                    Transcript & minutes retention (days)
                  </label>
                  <input
                    id="content-days"
                    type="number"
                    min={1}
                    max={90}
                    value={settings.content_days}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        content_days: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <p className="small muted">
                  Automatic retention cleanup is not yet configured. Setting a
                  policy does not establish that deletion has run.
                </p>
              </>
            )}
            <button
              className="primary"
              disabled={!['admin', 'owner'].includes(workspace.role)}
            >
              Save settings
            </button>
            <hr className="divider" />
            <h3>Export & deletion</h3>
            <p className="small muted">
              Workspace export, ownership transfer, and complete cleanup are
              pending implementation. They must be verified before release.
            </p>
          </form>
        ) : section === 'members' ? (
          <>
            <h2>Workspace members</h2>
            {members.map((m) => (
              <div className="meeting-row" key={m.email}>
                <div>
                  <strong className="small">{m.email}</strong>
                  <p className="small muted">Verified identity · {m.status}</p>
                </div>
                <span className="badge">{m.role}</span>
              </div>
            ))}
            <Notice>
              Membership enrollment and revocation controls are pending. Meeting
              invitations and calendar scheduling are outside core scope.
            </Notice>
          </>
        ) : section === 'usage' ? (
          <>
            <h2>Operational safety limits</h2>
            <p className="muted small">
              No paid plans. Limits protect recording and model resources.
            </p>
            {sample ? (
              <Notice>
                Sample meetings are excluded from usage. No real recording is
                running.
              </Notice>
            ) : usage ? (
              <div className="mini-stats">
                <div>
                  <strong>{Math.ceil(usage.capturedSeconds / 60)}</strong>
                  <span>captured minutes</span>
                </div>
                <div>
                  <strong>{Math.ceil(usage.reservedSeconds / 60)}</strong>
                  <span>reserved minutes</span>
                </div>
                <div>
                  <strong>
                    {Math.max(
                      0,
                      600 -
                        Math.ceil(
                          (usage.capturedSeconds + usage.reservedSeconds) / 60,
                        ),
                    )}
                  </strong>
                  <span>remaining minutes</span>
                </div>
              </div>
            ) : (
              <p role="status">Loading usage…</p>
            )}
            <hr className="divider" />
            <p>
              Proposed pilot limits: 600 minutes per rolling 30 days, 2
              concurrent sessions per workspace, and 120 minutes per session.
            </p>
            <p className="small muted">
              Live capture stays disabled until infrastructure, quota
              coordination, and real audio are validated.
            </p>
          </>
        ) : (
          <Empty title="Setting unavailable">Choose a setting above.</Empty>
        )}
      </section>
    </>
  );
}
function Account({ user, sample }: { user: User | null; sample: boolean }) {
  return (
    <section className="card settings-form">
      <h2>Identity & sessions</h2>
      <p>{user?.email}</p>
      <span className="badge success">
        {sample ? 'Sample identity' : 'Email verified'}
      </span>
      <hr className="divider" />
      <div className="spread">
        <div>
          <h3>Appearance</h3>
          <p className="small muted">Saved in this browser.</p>
        </div>
        <Theme />
      </div>
      <hr className="divider" />
      <button
        onClick={async () => {
          if (sample) {
            location.href = '/';
            return;
          }
          await fetch('/auth/web/logout', { method: 'POST' });
          accessToken = '';
          location.href = '/sign-in';
        }}
      >
        Sign out
      </button>
      <p className="small muted" style={{ marginTop: 24 }}>
        Session management and account deletion with ownership transfer are
        pending implementation.
      </p>
    </section>
  );
}
function Onboarding() {
  const [name, setName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="card settings-form">
      <h2>A place for your conversations.</h2>
      <p className="muted">
        Create a private workspace. Recording will remain unavailable until live
        feasibility and consent procedures are approved.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/api/workspaces', { name });
            location.href = '/app';
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="new-workspace">Workspace name</label>
          <input
            id="new-workspace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create workspace'}
        </button>
      </form>
    </section>
  );
}
