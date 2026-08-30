import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { registrerAuth } from "./auth/index.js";
import { authRoutes } from "./routes/auth.js";
import { inviterteRoutes } from "./routes/inviterte.js";
import { bilderRoutes } from "./routes/bilder.js";
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

export interface BuildServerValg {
  // Global innloggingskrav. Av i tester (som kaller endepunktene direkte).
  krevAuth?: boolean;
}

export async function buildServer(valg: BuildServerValg = {}) {
  const krevAuth = valg.krevAuth ?? true;

  // Standard 1 MiB-grense er for lav for base64-kodede PDF/bilder i fakturaparsing.
  const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 });

  // CORS: lokalt (KLIENT_URL tom) tillates alle origins. I produksjon settes
  // KLIENT_URL til klientens domene (komma-separert for flere).
  const klientUrl = process.env.KLIENT_URL?.trim();
  await app.register(cors, {
    origin: klientUrl ? klientUrl.split(",").map((s) => s.trim()) : true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"],
  });

  // Ma registreres for rutene - onRequest-hooken beskytter alle ikke-apne stier.
  await registrerAuth(app, krevAuth);

  // Ma awaites før ruter registreres — swagger sin onRoute-hook fanger kun
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

  authRoutes(app);
  inviterteRoutes(app);
  bilderRoutes(app);
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
