import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadSession, signOut, subscribeSession, type SessionState } from "@/lib/auth-client";

/** The signed-in header state: email, plan link, sign out. Signed out: a sign-in link. */
export function AccountMenu({ next }: { next: string }) {
  const [session, setSession] = React.useState<SessionState>({ status: "loading" });
  React.useEffect(() => {
    const unsubscribe = subscribeSession(setSession);
    void loadSession();
    return unsubscribe;
  }, []);

  if (session.status === "loading") return <Skeleton className="h-11 w-28" aria-hidden="true" />;
  if (session.status === "signed-out") {
    return (
      <Button render={<a href={`/sign-in?next=${encodeURIComponent(next)}`} />} variant="outline" data-testid="account-sign-in">
        Sign in
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-3" data-testid="account-signed-in">
      <a href="/account/plan" className="max-w-[12rem] truncate text-sm text-text-muted underline-offset-4 hover:underline" title={session.user.email}>
        {session.user.email}
      </a>
      <Button
        variant="ghost"
        onClick={async () => {
          await signOut();
          location.assign("/");
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
