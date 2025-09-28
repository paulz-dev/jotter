// TCP bridge that runs the MCP stdio server and exposes it on a TCP port.
// One client at a time to avoid JSON interleaving across multiple sockets.
import net from "node:net";
import { spawn } from "node:child_process";

const PORT = Number(process.env.MCP_PORT || 7020);

const mcp = spawn("node", ["/app/dist/mcp/server.js"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

let active = null;

const srv = net.createServer((socket) => {
  if (active) {
    socket.end("MCP bridge busy: one client at a time\n");
    return;
  }
  active = socket;
  socket.on("error", () => socket.destroy());
  socket.on("close", () => { active = null; });

  socket.pipe(mcp.stdin, { end: false });
  mcp.stdout.pipe(socket, { end: false });
});

srv.listen(PORT, "0.0.0.0", () => {
  console.error(`[mcp] TCP bridge listening on ${PORT}`);
});

mcp.on("exit", (code) => {
  console.error("[mcp] child exited:", code);
  process.exit(code ?? 1);
});
