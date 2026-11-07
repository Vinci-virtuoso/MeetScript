---
version: alpha
name: MeetScript
description: A quiet meeting notebook with precise evidence and visible recording controls.
colors:
  primary: "#176B60"
  primary-hover: "#115348"
  ink: "#172B29"
  muted: "#526763"
  canvas: "#F6F8F6"
  surface: "#FFFFFF"
  subtle: "#EAF1EE"
  border: "#CBD7D1"
  control-border: "#71847C"
  focus: "#146C94"
  success: "#216343"
  success-bg: "#EAF5ED"
  warning: "#80520B"
  warning-bg: "#FFF4D6"
  danger: "#A12C35"
  danger-bg: "#FDEDEF"
  info: "#235D83"
  info-bg: "#EDF5FC"
  dark-canvas: "#101A18"
  dark-surface: "#182622"
  dark-subtle: "#21362E"
  dark-ink: "#EDF4EF"
  dark-muted: "#B1C5BC"
  dark-border: "#41564C"
  dark-control-border: "#819B8C"
  dark-accent: "#83D6B8"
  dark-focus: "#8ED1F4"
typography:
  h1:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 2rem
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  h2:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  h3:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.4
  timestamp:
    fontFamily: ui-monospace, monospace
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  compact: 12px
  md: 16px
  lg: 24px
  xl: 32px
  section: 48px
  hero: 64px
components:
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  control-outline:
    backgroundColor: "{colors.control-border}"
    size: 1px
  focus-ring:
    backgroundColor: "{colors.focus}"
    size: 2px
  dark-divider:
    backgroundColor: "{colors.dark-border}"
    height: 1px
  dark-control-outline:
    backgroundColor: "{colors.dark-control-border}"
    size: 1px
  dark-focus-ring:
    backgroundColor: "{colors.dark-focus}"
    size: 2px
  dark-button-secondary:
    backgroundColor: "{colors.dark-subtle}"
    textColor: "{colors.dark-ink}"
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  secondary-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink}"
    height: 44px
    rounded: "{rounded.md}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    height: 44px
    rounded: "{rounded.md}"
  status-ready:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
  status-pending:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
  status-failed:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
  status-processing:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info}"
  dark-page:
    backgroundColor: "{colors.dark-canvas}"
    textColor: "{colors.dark-ink}"
  dark-card:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
  dark-secondary-text:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-muted}"
  dark-button-primary:
    backgroundColor: "{colors.dark-accent}"
    textColor: "{colors.dark-canvas}"
---

## Overview
A simple, polished portfolio product: a calm notebook, not a generic SaaS metrics dashboard. One teal accent, crisp editorial hierarchy, generous whitespace and visible evidence. The meeting is the main object. Put “Join meeting” within easy reach and “Stop recording” beside real capture status. Distinguish verified system events, model drafts and human-reviewed work. No pricing, Inbox, Calendar connection, upgrade badges or invented enterprise logos.

Light theme is the default; respect system preference with a persistent light/dark/system selector. Implement all core states in both themes, not a partially inverted afterthought. Use a small wordmark plus a simple transcript-line icon; decorative art must never replace useful empty-state copy. Public demonstration fixtures are labelled “Sample meeting — not a live recording,” isolated from private workspaces and never counted as integration evidence.

## Colors
Front matter is the normative token source. Do not scatter ad-hoc colors into components. Primary/primary-hover are white-text filled buttons; ink and muted are body/secondary text on light surfaces. Borders separate cards; use the stronger control-border for input/interactive boundaries. A 2px focus ring with 2px surface offset uses focus/dark-focus, never only a color change. Links are underlined in prose; citation links have time text plus a source icon.

Semantic state pairs use the defined light backgrounds/text. In dark theme, use dark-subtle for semantic badge surfaces and these semantic text tokens: success `#9DDFB4`, warning `#F2CE83`, danger `#FFA6AF`, info `#A9D3F3`; keep icon+label, never color alone. Dark primary hover `#A1E5CB`, selected surface `#284B3C`; destructive filled buttons retain danger/white. Dark links use dark-accent. Disabled elements use normal readable text with a disabled label and subtle surface, not low-opacity invisible text. Disabled is not the only explanation for blocked joins.

Validate WCAG AA: 4.5:1 body text, 3:1 large text and meaningful control/focus boundaries. Check both themes and selected/hover/focus/error states. Contrast checking is necessary but does not establish full accessibility.

## Typography
Self-host Inter with system fallback; never block layout on font loading. Page title 32px, section 24px, subsection 18px; mobile title 28px. Landing hero 48px/1.1 at desktop and 36px/1.15 on small screens; maximum 14 words per heading where possible. Body 16px, helper/table labels 14px, timestamps 13px monospace with tabular numbers. Avoid all-caps paragraphs or text below 12px. Transcript/minutes prose stays within 72ch. Title truncation must expose full text through accessible detail, not hover-only tooltips. Dates show local timezone; source offsets remain elapsed mm:ss or hh:mm:ss.

## Layout
Desktop ≥1024px: 224px fixed sidebar, 64px top bar, content max 1240px with 32px outer padding and 24px grid gaps. Sidebar: wordmark/workspace switcher; Overview, Meetings, Chat, Actions; Settings and account below. Top bar: breadcrumb/title context, theme control, primary Join meeting. No more than one filled primary action per region; active recording Stop is deliberately prominent.

Tablet 768–1023px: sidebar becomes an accessible drawer, 24px padding, two-column cards when each has ≥280px. Mobile <768px: 16px padding, one column, 56px header, menu + wordmark + Join button; filter chips wrap or use an explicitly scrollable filter strip. Drawer traps focus, Escape closes, and focus returns to trigger. No horizontal page overflow at 320px; tables become labelled cards rather than clipping columns. Preserve readable touch targets ≥44px. Mobile detail/chat use full-page panels with back controls, not stacked narrow sidebars.

Desktop meeting detail uses an 8/4 content/evidence split (minimum main 560px; collapse below 1100px). Audio player sticks within content bottom, above mobile safe area, without covering focused content. Chat desktop uses 240px conversation rail + flexible thread + optional 320px citation panel; below 1100px sources open in a drawer, below 768px history is a separate sheet. Composer max 760px and never obscures final messages; respect `env(safe-area-inset-bottom)`.

Spacing scale: 4/8/12/16/24/32/48/64px. Forms max 560px; auth card 420px; join dialog 560px; destructive confirmation 480px. Dialogs max-height calc(100dvh - 32px) and scroll internally with labelled heading. Maintain 200% zoom and reflow at 400% without losing controls.

## Elevation & Depth
Cards have 1px border and no default shadow; selected/interactive card gets a border change and subtle surface, not a floating effect. Menus/dialogs: `0 12px 40px rgba(16, 35, 27, 0.16)`; dark `0 12px 40px rgba(0, 0, 0, 0.36)`. Overlay `rgba(10, 24, 19, 0.48)`. Layer tokens: base 0, sticky 10, dropdown 30, dialog 50, toast 60. Never place a toast over the Stop action.

## Shapes
6px small controls/code, 10px inputs/buttons, 16px cards/dialogs, pill only for compact badges and avatars. Icons use consistent 20px size/1.75px stroke (16px in metadata) and a restrained single icon set. Status dots are accompanied by visible text. Avoid excessive pills, nested cards and decorative gradients.

## Components
Use accessible kit primitives adapted to these tokens; preserve semantics. Buttons have default/hover/pressed/focus-visible/disabled/loading; loading keeps width and a text label, prevents duplicate submissions and does not unexpectedly move focus. Inputs have persistent label/helper, required state, inline error linked by aria-describedby, invalid outline plus text. Success/failure notifications are polite live regions unless immediate destructive safety requires assertive feedback. Forms retain entered values after failure.

**Join dialog:** URL field, optional title, visibility selector default Private, duration cap and timezone, clearly stated operational limits, checkbox confirming recording disclosure/authority, bot identity preview and “Join meeting” CTA. Submit disabled until valid but display why. States: untouched, valid, malformed/unsupported URL, unverified identity, membership revoked, quota exhausted, submitting, duplicate session (link to existing), infrastructure unavailable and success. No calendar/date scheduling fields. Explain “The host must admit MeetScript. Some meetings require authentication and cannot be joined.”

**Status strip:** icon + truthful stage + last update + elapsed time from server data; queued, starting, joining, waiting, recording, stopping, processing and final states. Recording includes “Audio recording” and Stop; no pulsing activity unless genuine signal exists. Stale heartbeat shows “Connection lost — checking capture,” not recording certainty. Denied/authentication-required have specific copy and safe return actions, never a bypass button. Partial result banner shows captured interval/gaps and recovery status.

**Minutes:** summary paragraph followed by Decisions, Unresolved questions, Actions. Each factual item has small clickable source chips (`12:34 · transcript`). Draft/Reviewed labels are distinct. No evidence state is explicit. Actions include checkbox/status, unassigned owner, unscheduled date and source, with edit drawer and revision conflict resolution; never silently overwrite newer changes.

**Transcript/player:** search within transcript, speaker/Unknown speaker label, timestamp button and selectable text. Clicking a source scrolls/highlights the exact segment and seeks only when the user requests playback; no autoplay. Keyboard player has labelled play/pause, seek with elapsed/total text, speed 0.75/1/1.25/1.5/2 and volume. Transcript is the accessible audio alternative. Show buffering, loading, unsupported playback, retention-expired media and captured gaps. Do not draw a waveform unless derived from actual audio. Recheck access before seeking/export.

**Chat:** scoped header, scope chips, sample question hints only when no history, user/assistant messages, source chips and “Sources” panel with excerpts/time ranges. Enter sends, Shift+Enter inserts newline, visible Send/Stop; do not hijack IME composition. States: empty, composing, sending, streaming, cancelled/incomplete, retryable error, no evidence, indexing, stale/deleted source and access revoked. Stream announcements are throttled to sentence/completion, not per token. Keep scroll position if reading earlier content; show “New response” control rather than forcing bottom. Citation opens exact segment; revoked sources disclose no title/snippet.

### Screen and route specification
| Route | Populated composition | Empty / transition / failure states |
|---|---|---|
| `/` | Small header, concise hero “Your meetings, with receipts.”, Join/sign-in CTA, labelled sample minutes preview, three-step explanation, privacy/consent note, footer | Signed-in CTA returns to app; demo label always visible; unavailable capture is disclosed, never advertised as verified |
| `/about` | Portfolio project purpose, architecture overview, limitations, evidence-backed capabilities | No customer count/compliance claims; links remain usable without sign-in |
| `/privacy`, `/terms` | Readable prose with version date, contact route supplied by owner, recording/retention rules | Setup placeholder blocks release until owner approves final copy; no fabricated legal approval |
| `/sign-in`, `/sign-in/code` | Focused card, email OTP, optional configured identity login, safe return link | Loading, invalid email/code, expired/used code, resend cooldown, throttled, delivery unavailable, signed-in redirect; no production code reveal |
| `/onboarding` | Workspace name → verified membership → disclosure/retention → paste-first-meeting CTA | New owner versus existing invitation; invalid/expired membership token; retry preserves form; no assistant address step |
| `/app` | Active capture card, recent minutes list, open actions and a small operational usage line | First-run useful CTA; no meetings; processing; failed sessions; unavailable backend with Retry, no misleading zero counts |
| `/app/meetings` | Search, date/status/visibility filters, accessible list with title/date/duration/status/access | Empty first use, no filtered matches with Clear filters, skeleton rows, load error, pagination, permission loss |
| `/app/meetings/:id` | Header/status/stop, Minutes / Transcript / Audio / Actions tabs, contextual chat and source panel | Waiting/admission denied/auth-required; processing by stage; partial/audio gap; model failure; deleted/not found; retained transcript with expired audio; no content flash before auth |
| `/app/chat` | Conversation history, current scope, stream, cited evidence drawer, composer | Empty/indexing/no evidence/cancel/error/revoked/deleted source as above; retry is a new tracked generation |
| `/app/actions` | Assignee/date/status filters, rows/cards, edit drawer with citations | Empty/no matches/loading/save in progress/validation/conflict/rollback; completed state persists on refresh |
| `/app/settings/workspace` | Workspace name, owner controls and danger section | Saving/saved/error/no permission; ownership transfer before deletion |
| `/app/settings/members` | Verified status, roles, membership enroll/revoke controls | Empty optional members; pending/expired token; last-owner guard; revocation confirmation; viewer has no admin controls |
| `/app/settings/privacy` | Retention values, recording disclosure version, export/delete status | Validation/save conflict; deletion pending/failed/retry/complete; irreversible action confirmation |
| `/app/settings/usage` | Captured/reserved/remaining operational minutes and concurrency/duration caps | Loading/error/exhausted; explanation “Operational safety limits — no paid plans”; no purchase CTA |
| `/account` | Profile, verified identity, sessions/revoke, theme, sign-out/delete | Expired session, reauthentication, save/revoke feedback, ownership-transfer blocker |
| 404 / access failure | Neutral “Meeting unavailable” or “Page not found,” safe back navigation | Do not confirm hidden meeting existence; error request ID safe to copy, no private data |

Every data-bearing screen implements loading, populated, empty/no-results, offline/network error with retry, 401/session expiry, permission loss and relevant mutation success/failure. Skeletons match final geometry and are aria-hidden; use a status label. Cached private content is cleared immediately on sign-out/revocation. Avoid empty-data fallbacks on server errors. Focus new route h1; restore focus after dialogs; validation summary links to fields. Persistent banners carry blocking issues; toasts are supplementary.

### Interaction and acceptance details
Motion tokens: fast 120ms, normal 180ms, slow 240ms; easing `cubic-bezier(0.2,0,0,1)`. Restrict motion to opacity/small translation, no endless decorative animation. With prefers-reduced-motion use instant transitions and static progress labels. No autoplay audio. Icon-only controls have accessible names and visible tooltips available on keyboard; tooltips are not the sole label.

Validate complete journeys with keyboard only, VoiceOver or NVDA spot checks, axe, contrast and focus traps/restoration. Screenshot route/state matrix at 390/768/1280 widths in light/dark; additionally test 320px reflow and 200%/400% zoom. Include real long titles, multiline actions, unknown speakers, empty sections, timezone/DST display and network failure fixtures. Required portfolio showcase: overview populated/empty; join invalid/consent; live waiting/recording/stop; rich minutes with sources; transcript/audio; cited chat/no evidence; actions edit; privacy deletion. Fixtures are labelled and never presented as real capture proof. Acceptance report must link screenshots/tests, not only state “responsive.”

## Do's and Don'ts
- Do use clear, specific status copy, timestamps and source links. Don't invent bot presence, transcripts, progress percentages or audio activity.
- Do let people stop recording immediately. Don't hide safety controls behind an overflow menu.
- Do keep one primary action per region and preserve whitespace. Don't turn this into a busy KPI dashboard.
- Do show limitations and Unknown speaker. Don't imply that a mixed audio stream verifies identity.
- Do preserve private data boundaries in screenshots and cache. Don't expose real participant media in the public portfolio.
- Do keep mailbox optional deferred. Don't add Inbox, Calendar, billing, paid plans or upgrade navigation from the legacy kit.
