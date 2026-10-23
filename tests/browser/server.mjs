import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../../src/worker.js";

// Isolated, disposable planner. These credentials never connect to production.
export async function startServer() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../../schema.sql", import.meta.url), "utf8"));
  const env = {
    DB: {
      prepare(query) {
        let args = [];
        return {
          bind(...values) {
            args = values;
            return this;
          },
          async first() {
            return sql.prepare(query).get(...args) || null;
          },
          async run() {
            return sql.prepare(query).run(...args);
          },
        };
      },
    },
    SYNC_TOKEN: "s".repeat(64),
    MCP_WRITE_TOKEN: "w".repeat(64),
    MCP_READ_TOKEN: "r".repeat(64),
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        const file = new URL(
          "../../public/" + (path === "/" ? "index.html" : path.slice(1)),
          import.meta.url,
        );
        if (
          !file.href.startsWith(new URL("../../public/", import.meta.url).href)
        )
          return new Response("Missing", { status: 404 });
        try {
          return new Response(readFileSync(file), {
            headers: {
              "Content-Type": path.endsWith(".svg")
                ? "image/svg+xml"
                : path.endsWith(".js")
                  ? "text/javascript"
                  : "text/html",
            },
          });
        } catch {
          return new Response("Missing", { status: 404 });
        }
      },
    },
  };
  const server = http.createServer(async (req, res) => {
    try {
      const parts = [];
      for await (const part of req) parts.push(part);
      const response = await worker.fetch(
        new Request(`http://127.0.0.1:${server.address().port}${req.url}`, {
          method: req.method,
          headers: req.headers,
          ...(parts.length
            ? { body: Buffer.concat(parts), duplex: "half" }
            : {}),
        }),
        env,
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(500);
      res.end(error.message);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      sql.close();
    },
  };
}
