import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDevOutbox, devOutbox } from "./dev.js";
import { createEmailProvider, emailTransport, parseFrom } from "./index.js";

afterEach(() => {
  vi.restoreAllMocks();
  clearDevOutbox();
});

describe("email seam", () => {
  it("parses the from header", () => {
    expect(parseFrom("rent-split <login@rent-split.local>")).toEqual({ name: "rent-split", email: "login@rent-split.local" });
    expect(parseFrom("login@rent-split.local")).toEqual({ name: "", email: "login@rent-split.local" });
    expect(parseFrom(undefined).email).toBe("login@rent-split.local");
  });

  it("picks mailysend only with a key and an https url, then resend, then dev", () => {
    expect(emailTransport({ MAILYSEND_API_KEY: "k", MAILYSEND_API_URL: "https://m.example.com" })).toBe("mailysend");
    expect(emailTransport({ MAILYSEND_API_KEY: "k", MAILYSEND_API_URL: "http://m.example.com" })).toBe("dev");
    expect(emailTransport({ MAILYSEND_API_URL: "https://m.example.com" })).toBe("dev");
    expect(emailTransport({ RESEND_API_KEY: "r" })).toBe("resend");
    expect(emailTransport({})).toBe("dev");
  });

  it("dev transport logs one line without the body and keeps the message", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await createEmailProvider({ EMAIL_FROM: "rent-split <login@rent-split.local>" }).send({
      to: "Ana@Example.com",
      subject: "Your code",
      html: "<p>123456</p>",
      text: "Your code is 123456\nIt expires in 10 minutes.",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(spy.mock.calls[0]![0]));
    expect(line.msg).toBe("email_dev");
    expect(line.to).toBe("ana@example.com");
    expect(line.firstLine).toBe("Your code is 123456");
    expect(line.html).toBeUndefined();
    expect(devOutbox("ana@example.com")).toHaveLength(1);
    expect(devOutbox("ben@example.com")).toHaveLength(0);
  });
});
