import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/mediapipe/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
          },
          // The app makes no client-side calls to any origin but its own —
          // fonts are self-hosted at build time via next/font, there are no
          // third-party <script> tags, and every fetch() in the codebase
          // targets a relative /api/* path. That lets connect-src and
          // script-src both stay locked to 'self' rather than the wildcard
          // most CSPs end up with. 'unsafe-inline' on script-src is a
          // deliberate compromise, not full strict-dynamic CSP — a
          // nonce-based policy (generated per-request in proxy.ts and
          // threaded through the root layout) is a further hardening step,
          // not required for this policy to meaningfully reduce the impact
          // of an XSS bug by blocking exfiltration to an attacker's origin
          // and loading of externally hosted script.
          //
          // 'unsafe-eval' and the ws: connect-src entry are added in
          // development only — Turbopack/React dev mode uses eval() for
          // stack-trace reconstruction and HMR runs over a WebSocket, and
          // without both the dev server's own client-side JS silently fails
          // (React never finishes hydrating, so nothing on the page
          // responds to a click). Production never sends either.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'wasm-unsafe-eval' lets WebAssembly run (the gaze model is WebAssembly). It does not allow eval().
              `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              `connect-src 'self'${isDev ? " ws: http://localhost:*" : ""}`,
              "frame-ancestors 'self'",
              "form-action 'self' https://accounts.google.com",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
