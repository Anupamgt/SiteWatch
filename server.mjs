// Clustered production server.
//
// `next start` runs a single Node process, so on a multi-core host only one
// event loop accepts connections and renders pages. Under high concurrency that
// one loop saturates CPU, the accept backlog overflows, and new connections are
// refused (clients see "dial: i/o timeout"). This server forks one worker per
// CPU core (Node `cluster`), so every core accepts and renders in parallel,
// multiplying throughput and connection-acceptance capacity.
//
// Notes:
//   - SCHED_NONE lets each worker accept on the shared listening socket (the
//     kernel load-balances) instead of routing every connection through the
//     primary, which removes the single-accepter bottleneck.
//   - Login rate limiting is DB-backed (lib/rateLimit.ts), so it stays correct
//     across all workers.
//   - Use `npm run start:single` for the classic single-process `next start`.
//
// Env:
//   PORT             port to listen on (default 3000)
//   WEB_CONCURRENCY  number of workers (default = CPU count)
//   LISTEN_BACKLOG   TCP listen backlog (default 1024; capped by net.core.somaxconn)

import os from "node:os";
import cluster from "node:cluster";
import http from "node:http";
import next from "next";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const backlog = parseInt(process.env.LISTEN_BACKLOG || "1024", 10);
const workers = Math.max(
  1,
  parseInt(process.env.WEB_CONCURRENCY || String(os.cpus().length), 10)
);

// Only cluster in production with more than one worker; `next dev` and
// single-worker runs go straight to serving so nothing about local dev changes.
if (cluster.isPrimary && workers > 1 && !dev) {
  cluster.schedulingPolicy = cluster.SCHED_NONE;
  console.log(
    `[cluster] primary ${process.pid} starting ${workers} workers on :${port}`
  );
  for (let i = 0; i < workers; i++) cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    console.error(
      `[cluster] worker ${worker.process.pid} exited (${signal || code}); restarting`
    );
    cluster.fork();
  });
} else {
  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();
  const server = http.createServer((req, res) => handle(req, res));
  // Keep upstream connections alive a touch longer than typical LB idle so
  // reverse proxies can reuse them instead of reconnecting per request.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.listen({ port, backlog }, () => {
    console.log(`[worker ${process.pid}] ready on http://localhost:${port}`);
  });
}
