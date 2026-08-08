import { createRoscoServer } from "./app.js";

const port = Number(process.env.PORT ?? 3_000);
const signingSecret = process.env.ROOM_SIGNING_SECRET ??
  (process.env.NODE_ENV === "production" ? "" : "development-only-secret-change-me-123456");

if (signingSecret.length < 32) {
  throw new Error("ROOM_SIGNING_SECRET es obligatorio y debe tener al menos 32 caracteres");
}

const server = createRoscoServer(signingSecret);
server.httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Rosco escuchando en el puerto ${port}`);
});
