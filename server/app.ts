import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

export async function createApp() {
  const app = Fastify({ logger: true });
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

  await app.register(cors, {
    origin: frontendOrigin,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(cookie);

  await registerFrontend(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "NieprawidÅ‚owe dane.",
        fields: error.flatten().fieldErrors,
      });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "WewnÄ™trzny bÅ‚Ä…d serwera." });
  });

  return app;
}

/**
 * Serves the built Next.js frontend (`.next/`) from the Fastify server so a
 * single service can answer both API requests and the storefront UI.
 *
 * - `.next/static/*` is served under `/_next/static/*` with long-lived,
 *   immutable caching, matching how Next.js expects those assets to be
 *   requested by the built HTML/JS.
 * - `.next/public/*` (Next's copy of the top-level `public/` directory, e.g.
 *   favicon, images) is served from the site root with short-lived caching.
 * - Any other GET request that isn't already handled by an API route and
 *   isn't a static asset falls back to the built `index.html`, so
 *   client-side routing keeps working (SPA-style fallback).
 */
async function registerFrontend(app: FastifyInstance) {
  const nextDir = join(process.cwd(), ".next");
  const staticDir = join(nextDir, "static");
  const publicDir = join(nextDir, "public");
  const indexHtmlPath = join(nextDir, "index.html");

  if (!existsSync(nextDir)) {
    app.log.warn(".next directory not found; frontend will not be served");
    return;
  }

  if (existsSync(staticDir)) {
    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: "/_next/static/",
      decorateReply: false,
      cacheControl: true,
      maxAge: "1y",
      immutable: true,
    });
  }

  if (existsSync(publicDir)) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/",
      decorateReply: false,
      cacheControl: true,
      maxAge: "1h",
    });
  }

  if (existsSync(indexHtmlPath)) {
    const indexHtml = readFileSync(indexHtmlPath, "utf-8");
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return reply.code(404).send({ error: "Not found." });
      }
      return reply.type("text/html").send(indexHtml);
    });
  }
}
