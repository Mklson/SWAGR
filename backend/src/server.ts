import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { leverandorerRoutes } from "./routes/leverandorer.js";
import { varerRoutes } from "./routes/varer.js";
import { variantRoutes } from "./routes/varianter.js";
import { merkerRoutes } from "./routes/merker.js";
import { lokasjonerRoutes } from "./routes/lokasjoner.js";
import { kontekstRoutes } from "./routes/kontekster.js";
import { brukereRoutes } from "./routes/brukere.js";
import { bevegelserRoutes } from "./routes/bevegelser.js";
import { beholdningRoutes } from "./routes/beholdning.js";
import { reservasjonerRoutes } from "./routes/reservasjoner.js";
import { rapporterRoutes } from "./routes/rapporter.js";
import { sporsmalRoutes } from "./routes/sporsmal.js";
import { fakturaerRoutes } from "./routes/fakturaer.js";
import { variantGjenkjenningRoutes } from "./routes/variantGjenkjenning.js";

export async function buildServer() {
  // Standard 1 MiB-grense er for lav for base64-kodede PDF/bilder i fakturaparsing.
  const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 });

  // Kun lokal utvikling: klient-app (Expo web) kjører på en annen port enn
  // API-et, og trenger CORS for å kunne kalle det fra nettleseren. Standard
  // methods-liste i @fastify/cors dekker kun GET/HEAD/POST - PATCH (og
  // PUT/DELETE for fremtidige ruter) må listes eksplisitt, ellers avviser
  // preflight-sjekken dem uten at det vises som feil i selve API-svaret.
  await app.register(cors, { origin: true, methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"] });

  // Må awaites før ruter registreres — swagger sin onRoute-hook fanger kun
  // ruter lagt til etter at plugin-registreringen er fullført.
  await app.register(swagger, {
    openapi: {
      info: {
        title: "ARTKL API",
        description: "Bevegelsesbasert varelager-/POS-system",
        version: "0.1.0",
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get("/health", async () => ({ status: "ok" }));

  leverandorerRoutes(app);
  varerRoutes(app);
  variantRoutes(app);
  merkerRoutes(app);
  lokasjonerRoutes(app);
  kontekstRoutes(app);
  brukereRoutes(app);
  bevegelserRoutes(app);
  beholdningRoutes(app);
  reservasjonerRoutes(app);
  rapporterRoutes(app);
  sporsmalRoutes(app);
  fakturaerRoutes(app);
  variantGjenkjenningRoutes(app);

  return app;
}
