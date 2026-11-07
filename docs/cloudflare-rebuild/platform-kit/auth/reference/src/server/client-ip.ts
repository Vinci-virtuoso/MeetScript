// The client IP for rate limiting. Locally (DEV_MAIL_PEEK=1, never in a deploy env) an
// `X-Dev-Client-IP` header may stand in, so the e2e suite is not throttled by loginbase's 10 sends
// per IP per hour while every browser request arrives from 127.0.0.1.
export function clientIp(request: Request, env: { DEV_MAIL_PEEK?: string }): string {
  if (env.DEV_MAIL_PEEK === "1") {
    const dev = request.headers.get("X-Dev-Client-IP");
    if (dev && /^[0-9a-fA-F.:]{3,45}$/.test(dev)) return dev;
  }
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
