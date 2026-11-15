import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4173);
const types = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".webp":"image/webp",
  ".ico":"image/x-icon"
};

const server = createServer((request,response) => {
  if (!["GET","HEAD"].includes(request.method || "")) {
    response.writeHead(405,{"content-type":"text/plain; charset=utf-8","allow":"GET, HEAD"});
    response.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const relative = pathname === "/" ? "app/index.html" : pathname.replace(/^\/+/, "");
  const file = resolve(root,relative);
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404,{"content-type":"text/plain; charset=utf-8"});
    response.end("Not found");
    return;
  }

  response.writeHead(200,{
    "content-type":types[extname(file)] || "application/octet-stream",
    "x-content-type-options":"nosniff",
    "referrer-policy":"strict-origin-when-cross-origin",
    "cache-control":"no-store"
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(file).pipe(response);
});

server.listen(port,"127.0.0.1",() => {
  process.stdout.write(`UNIQUE DESIGN STUDIO: http://127.0.0.1:${port}/\nPress Ctrl+C to stop.\n`);
});
