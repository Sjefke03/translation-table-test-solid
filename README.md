# Solid pod translation service (prototype)

A service that sits on top of Solid pods. It reads a pod the way a Solid app would
(WebID profile → type index → LDP resources), tells applications **which RDF classes
it can serve** from that pod (the classes actually stored, plus classes it can derive
by translation), and serves every matching record as the class the application
asks for. Translation happens on read; nothing extra is written to the pod.

```
  app understands hb:BodyTemperatureFahrenheit
 ┌─────┐  GET /api/view/data?webid=…&type=hb:…Fahrenheit   ┌─────────────────────┐
 │ App │ ─────────────────────────────────────────────────▶ │ translation service │
 └─────┘ ◀───────────────────────────────────────────────── │ registry + graph    │
          Turtle: all temperatures as hb:…Fahrenheit,       └──────────┬──────────┘
          translated ones with prov:wasDerivedFrom                     │ WebID profile
                                                                       │ solid:publicTypeIndex
                                                          ┌────────────▼─────────────┐
                                                          │ Solid pod                │
                                                          │  ha:…Celsius   (Hosp. A) │
                                                          │  hb:…Fahrenheit (Hosp. B)│
                                                          └──────────────────────────┘
```

## How it maps onto Solid

| Solid piece | What the service does with it |
|---|---|
| **WebID profile** | Starting point. Pods are identified by the owner's WebID (`?webid=`). Reads `solid:publicTypeIndex` (and `solid:privateTypeIndex`), `foaf:name`, `pim:storage`. |
| **Type index** | Each `solid:TypeRegistration` gives a class (`solid:forClass`) and where its data lives (`solid:instance` or `solid:instanceContainer`). |
| **LDP containers** | For `solid:instanceContainer`, the container's `ldp:contains` lists the resources to read. |
| **RDF resources** | Turtle documents; instances of the registered class are pulled out using the registry's predicate mapping. |
| **Type index (output)** | `/api/view/type-index` is itself a Solid type index of the *translated view*. Every class the service can serve gets a `solid:TypeRegistration` whose `solid:instance` points at the service's data view, marked `tr:Stored` or `tr:Virtual`. Apps that already discover data through type indexes can discover the virtual classes the same way. |
| **Provenance (output)** | Translated records get a new IRI in the view and `prov:wasDerivedFrom` the original pod resource. Native records keep their pod IRI. |

## Concepts

| Term | Meaning | Example |
|---|---|---|
| **Concept** | The shared meaning, a LOINC IRI | `https://loinc.org/8310-5/` body temperature |
| **Data type** | An RDF class representing the concept with its own predicates and unit | `ha:BodyTemperatureCelsius` with `ha:patient`, `ha:temperatureC`, `ha:measuredAt` |
| **Translation** | A directed function between two classes *of the same concept* | `ha:…Celsius` → `hb:…Fahrenheit`: °F = °C × 9/5 + 32, `ha:patient` → `hb:subject` |

Translations form a graph. Without a direct edge the service chains the shortest path
(°F → °C → K). Translations between different concepts are refused when the registry is built.

## Example data (hospital vitals)

| Concept | Hospital A (`ha:`) | Hospital B (`hb:`) | Research (`rx:`) |
|---|---|---|---|
| Body temperature | °C | °F | K |
| Blood glucose | mg/dL | mmol/L (÷ 18.016) | |
| Body weight | kg | lb | |

The Worker hosts two mock pods as plain Turtle under `/mock-pod/` (see `src/mockpod.ts`),
laid out like real pods: profile, public type index, a container and resources.

- **alice** (`/mock-pod/alice/profile/card#me`): temperatures from Hospital A (a container
  of °C readings) and Hospital B (one resource with °F readings), glucose in mg/dL, weight in lb.
- **bob** (`/mock-pod/bob/profile/card#me`): glucose in mmol/L only.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/` | Test UI: Alice's temperatures served as any temperature class |
| GET | `/api/view/types?webid=…` | What the pod holds (resources, type indexes, warnings) and the advertised classes, stored or virtual (JSON) |
| GET | `/api/view/type-index?webid=…` | Solid type index of the translated view (Turtle / JSON-LD) |
| GET | `/api/view/data?webid=…&type=<class IRI>` | Records served as that class. Turtle by default; `Accept: application/ld+json` for JSON-LD, `application/json` for JSON with full provenance. `?format=turtle\|jsonld\|json` overrides. |
| GET | `/api/types`, `/api/translations` | The registry and the translation table |
| GET | `/api/pods` | Example WebIDs |
| POST | `/api/translate` | `{ from, to, record }`: translate one field record ad hoc |
| GET | `/mock-pod/…` | The mock pods' Turtle documents |

```sh
curl -H "Accept: text/turtle" \
  "http://localhost:8787/api/view/data?webid=http%3A%2F%2Flocalhost%3A8787%2Fmock-pod%2Falice%2Fprofile%2Fcard%23me&type=https%3A%2F%2Fhospital-b.example%2Fvocab%23BodyTemperatureFahrenheit"
```

## Run, test, deploy

```sh
npm install
npm test            # vitest: translator, Solid pod reader, HTTP API
npm run typecheck
npm run dev         # wrangler dev → http://localhost:8787
npx wrangler login  # once
npm run deploy      # Cloudflare Workers (*.workers.dev)
```

Once it's deployed you can enter any public WebID in the UI. Classes without a registered
translation are listed as such. (This development container can't reach external pods,
so only the mock pods have been tested.)

## Code layout

- `src/registry.ts`: concepts, RDF classes with predicate mappings, translation functions
- `src/translator.ts`: translation graph (validation, shortest path, chained translation)
- `src/rdf.ts`: Turtle parsing, record extraction, Turtle / JSON-LD serialisation (N3.js)
- `src/solid.ts`: pod reader: WebID → type index → containers → resources
- `src/service.ts`: advertising, reading with translation, provenance, translated type index
- `src/mockpod.ts`: the two mock pods as Turtle documents
- `src/index.ts`: Worker routes and content negotiation
- `src/ui.ts`: test page

## Limitations and next steps

- **Authentication:** only public data is read. `readPod` takes a `fetch` function, so the
  next step is Solid-OIDC: the app logs the user in and the service reads with the user's
  authenticated fetch, or holds its own client credentials the user grants via ACL/ACP.
  Forwarding an app's DPoP-bound token does not work, because DPoP proofs are bound to
  the target URL. The private type index is attempted and reported as a warning when denied.
- **Writes:** translating app writes back into the pod's native class (or a chosen one).
- **Declarative translations:** describe classes as SHACL shapes and units with QUDT/UCUM,
  so unit translations can be generated instead of hand-written.
- **Caching:** the pod is re-read on every request; add ETag-based caching.
- **SSRF:** the service fetches the WebID URLs it is given (http/https only, capped at 100
  resources). Restrict hosts before running it as a shared deployment.
