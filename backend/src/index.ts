import { buildServer } from "./server.js";
import { sikreAdmin } from "./auth/index.js";
import { ensureSystemData } from "./db/systemdata.js";

await sikreAdmin();
await ensureSystemData();

const app = await buildServer();
const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
