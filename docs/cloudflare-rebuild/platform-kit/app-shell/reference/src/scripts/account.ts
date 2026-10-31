// The account control on the calculator page: sign in, saved splits, save this split, sign out.
// Plain DOM (no React) so the calculator page keeps its weight; bundled by Astro from index.astro.
import { ApiClientError, loadSession, signOut, subscribeSession, type SessionState } from "../lib/auth-client.js";
import { createSplit } from "../lib/api.js";
import { SPLIT_NAME_MAX, SplitNameSchema } from "../schemas/split.js";

const root = document.getElementById("account");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** appendChild in a loop: the Worker's HTMLRewriter `Element.append` type shadows the DOM one under astro check. */
function add(parent: HTMLElement, ...children: HTMLElement[]): void {
  for (const child of children) parent.appendChild(child);
}

function currentCode(): string | null {
  const code = location.hash.slice(1);
  return code.startsWith("v1.") ? code : null;
}

function render(session: SessionState): void {
  if (!root) return;
  root.replaceChildren();
  if (session.status === "loading") return;
  if (session.status === "signed-out") {
    const link = el("a", { href: `/sign-in?next=${encodeURIComponent("/")}`, class: "btn btn-secondary account-link" }, "Sign in");
    add(root, link);
    return;
  }
  const splits = el("a", { href: "/splits", class: "btn btn-ghost account-link" }, "Saved splits");
  const save = el("button", { type: "button", class: "btn btn-secondary", id: "save-split" }, "Save this split");
  const out = el("button", { type: "button", class: "btn btn-ghost", id: "sign-out" }, "Sign out");
  const status = el("p", { class: "account-status", role: "status", "aria-live": "polite", id: "save-status" });
  const form = el("form", { class: "account-form", hidden: "", "aria-label": "Save this split" });
  const label = el("label", { for: "save-name" }, "Name");
  const input = el("input", { id: "save-name", name: "name", type: "text", maxlength: String(SPLIT_NAME_MAX), autocomplete: "off", placeholder: "Flat on Oak St" });
  const submit = el("button", { type: "submit", class: "btn btn-primary" }, "Save");
  const cancel = el("button", { type: "button", class: "btn btn-ghost" }, "Cancel");
  add(form, label, input, submit, cancel);

  const syncSave = () => {
    const ok = currentCode() !== null;
    save.disabled = !ok;
    save.title = ok ? "" : "Enter the rent first, then save.";
  };
  syncSave();
  window.addEventListener("hashchange", syncSave);
  const observer = new MutationObserver(syncSave);
  observer.observe(document.getElementById("app") ?? document.body, { childList: true, subtree: true, attributes: true });

  save.addEventListener("click", () => {
    status.textContent = "";
    form.hidden = false;
    input.focus();
  });
  cancel.addEventListener("click", () => {
    form.hidden = true;
    save.focus();
  });
  out.addEventListener("click", async () => {
    await signOut();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = currentCode();
    const parsed = SplitNameSchema.safeParse(input.value);
    if (!code) {
      status.textContent = "Enter the rent first, then save.";
      return;
    }
    if (!parsed.success) {
      status.textContent = `Enter a name of 1 to ${SPLIT_NAME_MAX} characters.`;
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    submit.disabled = true;
    try {
      const split = await createSplit(parsed.data, code);
      form.hidden = true;
      input.value = "";
      status.replaceChildren(`Saved as ${split.name}. `, el("a", { href: "/splits" }, "See saved splits"));
    } catch (err) {
      const e = err as ApiClientError;
      if (e.code === "plan_required") {
        status.replaceChildren(`Free accounts keep ${String(e.fields.freeLimit ?? 3)} saved splits. `, el("a", { href: "/pricing" }, "Upgrade to Pro"), " to save more.");
      } else if (e.status === 401) {
        status.replaceChildren("You are signed out. ", el("a", { href: "/sign-in?next=%2F" }, "Sign in again"), ".");
      } else {
        status.textContent = "The split was not saved. Check your connection and try again.";
      }
    } finally {
      submit.disabled = false;
    }
  });
  add(root, splits, save, out, form, status);
}

if (root) {
  subscribeSession(render);
  void loadSession();
}
