import { mockPods, mockWebId, serveMockPod } from "./mockpod";
import { toJsonLd } from "./rdf";
import { concepts, dataTypes, translations } from "./registry";
import { TranslationService, UnknownTypeError } from "./service";
import { readPod, type FetchFn } from "./solid";
import { Translator } from "./translator";
import { uiHtml } from "./ui";

export const translator = new Translator(dataTypes, translations);
const service = new TranslationService(translator);

const CORS = { "access-control-allow-origin": "*" };

const json = (body: unknown, status = 200, contentType = "application/json") =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": `${contentType}; charset=utf-8`, ...CORS } });

const turtle = (body: string) => new Response(body, { headers: { "content-type": "text/turtle; charset=utf-8", ...CORS } });

const error = (status: number, message: string) => json({ error: message }, status);

type Format = "turtle" | "jsonld" | "json";

/** ?format= wins (handy for links), otherwise the Accept header. Turtle is the Solid default. */
function negotiate(request: Request, url: URL): Format {
  const f = url.searchParams.get("format");
  if (f === "turtle" || f === "jsonld" || f === "json") return f;
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/ld+json")) return "jsonld";
  if (accept.includes("application/json")) return "json";
  return "turtle";
}

/**
 * Fetch used to read pods. Mock pods on this Worker are served in-process (a Worker
 * cannot reliably fetch its own URL); everything else goes out over the network.
 */
function podFetch(origin: string): FetchFn {
  return async (input, init) => {
    const target = new URL(input);
    if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error(`Unsupported URL: ${input}`);
    if (target.origin === origin) {
      const local = serveMockPod(target.pathname);
      return local ?? new Response("Not found", { status: 404 });
    }
    return fetch(input, init);
  };
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname, origin } = url;

  if (request.method === "GET" && pathname === "/") {
    return new Response(uiHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // The mock Solid pods: plain Turtle documents.
  if (request.method === "GET" && pathname.startsWith("/mock-pod/")) {
    return serveMockPod(pathname) ?? error(404, "Not found");
  }

  if (request.method === "GET" && pathname === "/api/types") {
    return json({ concepts: concepts.map((c) => ({ ...c, types: dataTypes.filter((t) => t.concept === c.id) })) });
  }

  if (request.method === "GET" && pathname === "/api/translations") {
    return json(translations.map(({ from, to, description, lossless }) => ({ from, to, description, lossless })));
  }

  // Example pods to try in the UI.
  if (request.method === "GET" && pathname === "/api/pods") {
    return json(mockPods.map((p) => ({ label: p.label, webId: mockWebId(origin, p.name) })));
  }

  // POST /api/translate { from, to, record }: translate one field record ad hoc.
  if (request.method === "POST" && pathname === "/api/translate") {
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

  // Translated views of a pod, identified by its WebID.
  if (request.method === "GET" && pathname.startsWith("/api/view/")) {
    const webId = url.searchParams.get("webid");
    if (!webId) return error(400, "Missing ?webid=<WebID of the pod owner>");
    let pod;
    try {
      pod = await readPod(webId, translator, podFetch(origin));
    } catch (e) {
      return error(502, `Could not read pod for ${webId}: ${(e as Error).message}`);
    }
    const viewUrl = (path: string, params: Record<string, string>) =>
      `${origin}/api/view/${path}?${new URLSearchParams({ webid: webId, ...params })}`;

    switch (pathname) {
      // What the pod holds and what the service can serve from it.
      case "/api/view/types": {
        const { resources, ...meta } = pod;
        return json({
          pod: { ...meta, resources: resources.map((r) => ({ url: r.url, type: r.type, records: r.records.length })) },
          types: service.advertise(pod),
        });
      }
      // The same, as a Solid type index of the translated view.
      case "/api/view/type-index": {
        const quads = service.typeIndexQuads(pod, viewUrl("type-index", {}), (type) => viewUrl("data", { type }));
        const format = negotiate(request, url);
        return format === "turtle" ? turtle(await service.turtle(quads)) : json(toJsonLd(quads), 200, "application/ld+json");
      }
      // Records served as the requested class.
      case "/api/view/data": {
        const type = url.searchParams.get("type");
        if (!type) return error(400, "Missing ?type=<class IRI>");
        let records;
        try {
          records = service.read(pod, type, viewUrl("data", { type }));
        } catch (e) {
          if (e instanceof UnknownTypeError) return error(404, e.message);
          throw e;
        }
        const format = negotiate(request, url);
        if (format === "json") return json({ webId, type, records, warnings: pod.warnings });
        const quads = service.recordsToQuads(records, type);
        return format === "turtle" ? turtle(await service.turtle(quads)) : json(toJsonLd(quads), 200, "application/ld+json");
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
