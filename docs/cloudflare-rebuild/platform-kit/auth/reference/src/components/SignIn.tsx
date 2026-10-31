import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ApiClientError, loadSession, sendCode, verifyCode } from "@/lib/auth-client";
import { CodeSendSchema, CodeVerifySchema } from "@/schemas/auth";

type Step = { kind: "email" } | { kind: "code"; email: string; cooldownUntil: number };

const OAUTH_MESSAGES: Record<string, string> = {
  access_denied: "GitHub sign-in was cancelled. Try again, or use your email.",
  oauth_no_email: "GitHub shared no verified email. Add one on GitHub, or sign in with your email.",
  not_configured: "GitHub sign-in is not set up on this deployment. Sign in with your email.",
};

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/splits";
}

export function SignIn({ githubEnabled }: { githubEnabled: boolean }) {
  const params = React.useMemo(() => new URLSearchParams(typeof location === "undefined" ? "" : location.search), []);
  const next = safeNext(params.get("next"));
  const oauthError = params.get("error");
  const [step, setStep] = React.useState<Step>({ kind: "email" });
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ tone: "info" | "danger"; title: string; text: string; action?: "resend" } | null>(
    oauthError
      ? { tone: "danger", title: "GitHub sign-in did not finish.", text: OAUTH_MESSAGES[oauthError] ?? "Try again, or sign in with your email." }
      : null,
  );
  const [now, setNow] = React.useState(Date.now());
  // Set after hydration: a test must not type into the controlled inputs before React owns them.
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);

  React.useEffect(() => {
    void loadSession().then((s) => {
      if (s.status === "signed-in") location.replace(next);
    });
  }, [next]);

  React.useEffect(() => {
    if (step.kind !== "code") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setNotice(null);
    const parsed = CodeSendSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError("Enter a valid email address, like ana@example.com.");
      return;
    }
    setBusy(true);
    try {
      const { cooldownSeconds } = await sendCode(parsed.data.email, navigator.language);
      setCode("");
      setStep({ kind: "code", email: parsed.data.email, cooldownUntil: Date.now() + cooldownSeconds * 1000 });
    } catch (err) {
      const e = err as ApiClientError;
      if (e.code === "too_many_requests") {
        const seconds = Number(e.fields.retryAfterSeconds ?? 60);
        setNotice({ tone: "danger", title: "Too many codes requested.", text: `Wait ${seconds} seconds, then try again.` });
      } else if (e.code === "invalid_email") setFieldError("Enter a valid email address, like ana@example.com.");
      else setNotice({ tone: "danger", title: "The code was not sent.", text: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (step.kind !== "code") return;
    setNotice(null);
    setFieldError(null);
    setBusy(true);
    try {
      const { cooldownSeconds } = await sendCode(step.email, navigator.language);
      setCode("");
      setStep({ ...step, cooldownUntil: Date.now() + cooldownSeconds * 1000 });
      setNotice({ tone: "info", title: "New code sent.", text: `Check ${step.email} again.` });
    } catch (err) {
      const e = err as ApiClientError;
      const seconds = Number(e.fields.retryAfterSeconds ?? 60);
      setNotice({ tone: "danger", title: "A new code was not sent.", text: e.code === "too_many_requests" ? `Wait ${seconds} seconds, then try again.` : "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (step.kind !== "code") return;
    setFieldError(null);
    setNotice(null);
    const parsed = CodeVerifySchema.safeParse({ email: step.email, code });
    if (!parsed.success) {
      setFieldError("Enter the 6 digits from the email.");
      return;
    }
    setBusy(true);
    try {
      await verifyCode(parsed.data.email, parsed.data.code);
      location.assign(next);
    } catch (err) {
      const e = err as ApiClientError;
      if (e.code === "invalid_code") setFieldError("That code is not right. Check the email and try again.");
      else if (e.code === "code_expired") setNotice({ tone: "danger", title: "This code expired.", text: "Codes last 10 minutes. Send a new code to continue.", action: "resend" });
      else if (e.code === "too_many_attempts") setNotice({ tone: "danger", title: "Too many wrong codes.", text: "That code is now void. Send a new code to try again.", action: "resend" });
      else if (e.code === "too_many_requests") setNotice({ tone: "danger", title: "Too many attempts from this network.", text: `Wait ${Number(e.fields.retryAfterSeconds ?? 60)} seconds, then try again.` });
      else setNotice({ tone: "danger", title: "Sign-in did not finish.", text: "Check your connection and try again." });
      setBusy(false);
    }
  }

  const cooldownLeft = step.kind === "code" ? Math.max(0, Math.ceil((step.cooldownUntil - now) / 1000)) : 0;

  return (
    <Card className="mx-auto w-full max-w-md" data-testid={`sign-in-${step.kind}`} data-ready={ready ? "true" : undefined}>
      {step.kind === "email" ? (
        <>
          <CardHeader>
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Enter your email. We send a 6 digit code; there is no password.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {notice && (
              <Alert variant={notice.tone === "danger" ? "destructive" : "default"}>
                <AlertTitle>{notice.title}</AlertTitle>
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={submitEmail} className="flex flex-col gap-4" noValidate>
              <Field data-invalid={fieldError ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby="email-hint"
                />
                {fieldError ? <FieldError id="email-hint">{fieldError}</FieldError> : <FieldDescription id="email-hint">The code goes to this address.</FieldDescription>}
              </Field>
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Spinner />}
                Send code
              </Button>
            </form>
            {githubEnabled && (
              <>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <Separator className="flex-1" />
                  <span>or</span>
                  <Separator className="flex-1" />
                </div>
                <Button render={<a href="/auth/web/github/start" />} variant="outline" className="w-full">
                  Continue with GitHub
                </Button>
              </>
            )}
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader>
            <CardTitle className="text-lg">Check your email</CardTitle>
            <CardDescription>
              We sent a 6 digit code to <span className="font-medium text-text">{step.email}</span>. It lasts 10 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {notice && (
              <Alert variant={notice.tone === "danger" ? "destructive" : "default"} data-testid="code-notice">
                <AlertTitle>{notice.title}</AlertTitle>
                <AlertDescription>
                  <p>{notice.text}</p>
                  {notice.action === "resend" && (
                    <Button variant="outline" onClick={resend} disabled={busy || cooldownLeft > 0}>
                      {cooldownLeft > 0 ? `Send a new code in ${cooldownLeft} s` : "Send a new code"}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={submitCode} className="flex flex-col gap-4" noValidate>
              <Field data-invalid={fieldError ? true : undefined}>
                <FieldLabel htmlFor="code">Code</FieldLabel>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby="code-hint"
                  className="font-medium tracking-[0.3em] tabular-nums"
                />
                {fieldError ? <FieldError id="code-hint">{fieldError}</FieldError> : <FieldDescription id="code-hint">6 digits, no spaces.</FieldDescription>}
              </Field>
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Spinner />}
                Sign in
              </Button>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Button variant="link" className="px-0" onClick={() => { setStep({ kind: "email" }); setNotice(null); setFieldError(null); }}>
                Use a different email
              </Button>
              <Button variant="link" className="px-0" onClick={resend} disabled={busy || cooldownLeft > 0}>
                {cooldownLeft > 0 ? `Send a new code in ${cooldownLeft} s` : "Send a new code"}
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}
