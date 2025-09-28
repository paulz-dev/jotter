#!/usr/bin/env node
import net from "node:net";

const host = process.argv[2] || "127.0.0.1";
const port = Number(process.argv[3] || 7020);

const sock = net.createConnection({ host, port }, () => {
  process.stdin.pipe(sock);
  sock.pipe(process.stdout);
});
sock.on("error", (e) => {
  console.error("[bridge] connection error:", e.message);
  process.exit(1);
});
process.on("SIGINT", () => { sock.end(); process.exit(0); });
