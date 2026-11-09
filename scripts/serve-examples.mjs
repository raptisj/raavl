import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

// Explicit public files: no repository, dotfiles, or arbitrary filesystem paths.
const publicFiles = new Map([
  ["/", ["examples/index.html", "text/html"]],
  ["/index.html", ["examples/index.html", "text/html"]],
  ["/app.js", ["examples/app.js", "text/javascript"]],
  ["/workflows.js", ["examples/workflows.js", "text/javascript"]],
  ["/style.css", ["examples/style.css", "text/css"]],
  ["/docs/api.md", ["docs/design/api.md", "text/plain"]],
  ["/docs/workflows.md", ["docs/design/workflows.md", "text/plain"]],
]);
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT");
const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const path = new URL(request.url, "http://localhost").pathname;
  const entry = publicFiles.get(path);
  if (!entry) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(new URL(`../${entry[0]}`, import.meta.url));
    response.writeHead(200, {
      "Content-Type": `${entry[1]}; charset=utf-8`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    console.error(error.message);
    response.writeHead(500).end("Unable to read example file");
  }
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Ravl API review: http://127.0.0.1:${port}`);
  console.log(
    "Phase 1 design preview. Library playback is not implemented yet.",
  );
});
