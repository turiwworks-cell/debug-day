// Serve the browser-stored planner on a stable local origin.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const assets = new URL("./public/", import.meta.url);
const types = { html: "text/html", js: "text/javascript", svg: "image/svg+xml" };
const port = 8787;
const server = createServer(async (request, response) => {
  const path = (request.url || "/").split("?")[0];
  const file = path === "/" ? "index.html" : path.slice(1);
  const match = /^[-a-zA-Z0-9]+\.(html|js|svg)$/.exec(file);
  if (!match || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(new URL(file, assets));
    response.writeHead(200, { "Content-Type": types[match[1]] + "; charset=utf-8", "Cache-Control": "no-cache" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch {
    response.writeHead(404).end();
  }
});
server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? "Port 8787 is already in use. Close the previous local server and try again." : error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => console.log("Debug Day is ready at http://127.0.0.1:8787"));
