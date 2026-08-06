import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the SQL migrations with server bundles so the instrumentation hook can
  // auto-apply them at startup on serverless hosts.
  outputFileTracingIncludes: {
    "/**": ["./migrations/**/*"],
  },
  // `pg` is a Node-only driver; keep it external to the server bundle so its
  // native/optional dependencies resolve at runtime instead of being bundled.
  serverExternalPackages: ["pg"],
  // The component library ships as source (`.tsx`); Next must transpile it
  // rather than expect a pre-built package.
  transpilePackages: ["@forkroom/component-library"],
};

export default nextConfig;
