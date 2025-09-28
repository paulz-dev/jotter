import express from "express";
import cors from "cors";
import { r } from "./routes.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.use(cors());
app.use(express.json());

// health check endpoint
app.get("/health", (_req, res) => res.type("text").send("ok"));

// API
app.use("/api", r);

// Serve the **built** React UI from /ui/dist
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/", express.static(path.join(__dirname, "..", "..", "ui", "dist")));

const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => {
  console.log(`API + UI at http://localhost:${port}`);
});

// error handling for port conflicts (with helpful commands)
server.on("error", (err: any) => {
  if (err?.code === "EADDRINUSE") {
    console.error(`❌ Port ${port} is already in use.`);
    console.error(`   To see the process holding the port:`);
    console.error(`     lsof -nP -iTCP:${port} -sTCP:LISTEN`);
    console.error(`   You can also run the server on another port:`);
    console.error(`     PORT=4000 npm run dev:api`);
  } else {
    console.error("❌ Server error:", err);
  }
  process.exit(1);
});

