import { pods } from "./pods";
import { concepts, dataTypes, translations } from "./registry";
import { TranslationService, UnknownTypeError } from "./service";
import { Translator } from "./translator";
import { uiHtml } from "./ui";

export const translator = new Translator(dataTypes, translations);
const service = new TranslationService(translator);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
  });

const error = (status: number, message: string) => json({ error: message }, status);

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && parts.length === 0) {
    return new Response(uiHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  if (parts[0] !== "api") return error(404, "Not found");

  // GET /api/types — every known data type, grouped by concept
  if (request.method === "GET" && parts[1] === "types" && parts.length === 2) {
    return json({
      concepts: concepts.map((c) => ({ ...c, types: dataTypes.filter((t) => t.concept === c.id) })),
    });
  }

  // GET /api/translations — the translation table
  if (request.method === "GET" && parts[1] === "translations" && parts.length === 2) {
    return json(translations.map(({ from, to, description, lossless }) => ({ from, to, description, lossless })));
  }

  // POST /api/translate { from, to, record } — translate an arbitrary record
  if (request.method === "POST" && parts[1] === "translate" && parts.length === 2) {
    let body: { from?: string; to?: string; record?: Record<string, unknown> };
    try {
      body = await request.json();
    } catch {
      return error(400, "Body must be JSON: { from, to, record }");
    }
    if (!body.from || !body.to || typeof body.record !== "object" || body.record === null) {
      return error(400, "Body must be JSON: { from, to, record }");
    }
    for (const t of [body.from, body.to]) if (!translator.getType(t)) return error(404, `Unknown data type: ${t}`);
    try {
      return json(translator.translate(body.record, body.from, body.to));
    } catch (e) {
      return error(422, (e as Error).message);
    }
  }

  // GET /api/pods
  if (request.method === "GET" && parts[1] === "pods" && parts.length === 2) {
    return json(Object.values(pods).map(({ id, label, webId }) => ({ id, label, webId })));
  }

  if (request.method === "GET" && parts[1] === "pods" && parts.length === 4) {
    const pod = pods[parts[2]];
    if (!pod) return error(404, `Unknown pod: ${parts[2]}`);
    switch (parts[3]) {
      // GET /api/pods/:id/types — stored + virtual (translatable) types
      case "types":
        return json(await service.advertise(pod));
      // GET /api/pods/:id/type-index — the same, as a Solid-style JSON-LD type index
      case "type-index":
        return json(await service.typeIndex(pod, `${url.origin}/api`));
      // GET /api/pods/:id/data?type=<type IRI> — records served in the requested type
      case "data": {
        const type = url.searchParams.get("type");
        if (!type) return error(400, "Missing ?type=<data type IRI>");
        try {
          return json({ pod: pod.id, type, records: await service.read(pod, type) });
        } catch (e) {
          if (e instanceof UnknownTypeError) return error(404, e.message);
          throw e;
        }
      }
    }
  }

  return error(404, "Not found");
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await handle(request);
    } catch (e) {
      return error(500, (e as Error).message);
    }
  },
} satisfies ExportedHandler;
