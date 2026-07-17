import { createServer } from "node:http";
import { SimulationRuntime } from "./runtime.ts";

const port = Number(process.env.PORT ?? 4010);
const tickMilliseconds = Number(process.env.SIM_TICK_MS ?? 1000);
const runtime = new SimulationRuntime(tickMilliseconds);

async function readBody(
  request: import("node:http").IncomingMessage,
): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of request) body += String(chunk);
  if (!body) return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": process.env.ADMIN_ORIGIN ?? "*",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    writeJson(response, 204, null);
    return;
  }
  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, { ok: true, mode: "SIMULATION" });
    return;
  }
  if (request.method === "GET" && request.url === "/v1/admin/dashboard") {
    writeJson(response, 200, await runtime.snapshot());
    return;
  }
  if (request.method === "POST" && request.url === "/v1/simulation/reset") {
    const body = await readBody(request);
    runtime.reset(body.mode === "random" ? "random" : "repeat");
    runtime.start();
    writeJson(response, 200, await runtime.snapshot());
    return;
  }
  if (request.method === "POST" && request.url === "/v1/simulation/pause") {
    runtime.pause();
    writeJson(response, 200, await runtime.snapshot());
    return;
  }
  if (request.method === "POST" && request.url === "/v1/simulation/resume") {
    runtime.start();
    writeJson(response, 200, await runtime.snapshot());
    return;
  }
  writeJson(response, 404, { error: "NOT_FOUND" });
});

server.listen(port, () => {
  runtime.start();
  console.log(
    `VARBET admin simulator listening on http://localhost:${port} (${tickMilliseconds}ms ticks)`,
  );
});
