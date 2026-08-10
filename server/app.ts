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
 * Serves the built Vinext (Vite) frontend (`dist/`) from the Fastify server
 * so a single service can answer both API requests and the storefront UI.
 *
 * - `dist/client/*` (Vite's client build output — JS, CSS, and other
 *   assets) is served from the site root with short-lived caching.
 * - Any other GET request that isn't already handled by an API route and
 *   isn't a static asset falls back to the built `index.html` in
 *   `dist/client/`, so client-side routing keeps working (SPA-style
 *   fallback).
 */
async function registerFrontend(app: FastifyInstance) {
  const distDir = join(process.cwd(), "dist");
  const clientDir = join(distDir, "client");
  const indexHtmlPath = join(clientDir, "index.html");

  if (!existsSync(distDir)) {
    app.log.warn("dist directory not found; frontend will not be served");
    return;
  }

  if (existsSync(clientDir)) {
    await app.register(fastifyStatic, {
      root: clientDir,
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
