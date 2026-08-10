import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
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
