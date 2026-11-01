import http from "node:http";

const empty = () => ({ bills: [], payments: [], expired_bills: [], bill_events: [] });
let db = empty();
let holdWrites = null;

const compare = {
  eq: (a, b) => String(a) === b,
  gte: (a, b) => new Date(a) >= new Date(b),
};

const picked = (rows, url) => {
  const columns = url.searchParams.get("select");
  if (!columns || columns === "*") return rows;
  const names = columns.split(",");
  return rows.map((row) => Object.fromEntries(names.map((name) => [name, row[name]])));
};

function filtersOf(url) {
  return [...url.searchParams.entries()]
    .map(([key, value]) => [key, ...value.split(/\.(.*)/s)])
    .filter(([, op]) => compare[op]);
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", async () => {
    const url = new URL(req.url, "http://stub");
    const send = (code, value, headers = {}) => {
      res.writeHead(code, { "content-type": "application/json", ...headers });
      res.end(value === undefined ? undefined : JSON.stringify(value));
    };

    if (url.pathname === "/__db") {
      if (req.method === "POST") {
        db = { ...empty(), ...JSON.parse(body) };
        holdWrites = null;
      }
      return send(200, db);
    }
    if (url.pathname === "/__collide") {
      holdWrites = { waiting: [] };
      return send(200, {});
    }
    if (url.pathname.startsWith("/realtime")) return send(202, {});

    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "bill_events" && db.bill_events === null) return send(404, { message: "no table" });
    const rows = db[table];
    if (!rows) return send(404, { message: `unknown ${table}` });
    const filters = filtersOf(url);
    const match = (row) => filters.every(([key, op, value]) => compare[op](row[key], value));

    if (req.method === "GET" || req.method === "HEAD") {
      const found = rows.filter(match);
      if (req.method === "HEAD") return send(200, undefined, { "content-range": `*/${found.length}` });
      if (table === "bill_events") found.sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
      const snapshot = JSON.parse(JSON.stringify(found));
      if (table === "bills" && holdWrites && url.searchParams.get("select")?.includes("updated_at")) {
        await new Promise((release) => {
          holdWrites.waiting.push(release);
          if (holdWrites.waiting.length >= 2) {
            holdWrites.waiting.forEach((go) => go());
            holdWrites = null;
          } else setTimeout(release, 20_000);
        });
      }
      return send(200, picked(snapshot, url));
    }
    if (req.method === "PATCH") {
      const hits = rows.filter(match);
      hits.forEach((row) => Object.assign(row, JSON.parse(body)));
      return send(200, picked(hits, url));
    }
    if (req.method === "POST") {
      const input = JSON.parse(body);
      const added = (Array.isArray(input) ? input : [input]).map((row) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...(table === "bills" ? { updated_at: new Date().toISOString(), secrets: {} } : {}),
        ...row,
      }));
      rows.push(...added);
      const sent = picked(added, url);
      return send(201, (req.headers.accept ?? "").includes("vnd.pgrst.object") ? sent[0] : sent);
    }
    if (req.method === "DELETE") {
      db[table] = rows.filter((row) => !match(row));
      return send(204);
    }
    return send(405, {});
  });
});

server.listen(54399);
