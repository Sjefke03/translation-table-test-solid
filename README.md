# Solid pod translation service (prototype)

A service that sits between applications and Solid pods. It tells applications
**which data types a pod can serve**, both the types that are actually stored and
the types that can be derived by translation. When an app asks for a type, the
service collects every stored resource with the same meaning and returns it in
the requested shape, translating on the fly. Nothing extra is written to the pod.

```
          app wants °F                         pod stores °C (Hospital A) and °F (Hospital B)
 ┌─────┐  GET /data?type=…Fahrenheit  ┌──────────────────────┐  read   ┌──────────────┐
 │ App │ ───────────────────────────▶ │ translation service  │ ──────▶ │  Solid pod   │
 └─────┘ ◀─────────────────────────── │ registry + graph     │ ◀────── │              │
          all records in °F,          └──────────────────────┘         └──────────────┘
          with provenance
```

## Concepts

| Term | Meaning | Example |
|---|---|---|
| **Concept** | The shared meaning, identified by a LOINC code | `loinc:8310-5` body temperature |
| **Data type** | One concrete representation of a concept: field names + unit | `hospital-a#BodyTemperatureCelsius` → `{ patientId, temperatureC, measuredAt }` |
| **Translation** | A directed function between two data types *of the same concept* | °C → °F, also renames `patientId` → `patient` |

Translations form a graph. If there is no direct edge, the service chains the
shortest path (°F → °C → K). Translations between different concepts are refused
when the registry is built.

A type a pod can serve is advertised as:
- `stored`: at least one resource in the pod is natively in this type.
- `virtual`: only reachable through translation.

## Example data (hospital vitals)

| Concept | Hospital A | Hospital B | Other |
|---|---|---|---|
| Body temperature | °C | °F | K (research export) |
| Blood glucose | mg/dL | mmol/L (÷ 18.016) | |
| Body weight | kg | lb | |

Mock pods (`src/pods.ts`):
- **alice**: temperatures from both hospitals (°C and °F), glucose in mg/dL, weight in lb.
- **bob**: glucose in mmol/L only.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/` | Test UI (one case: Alice's temperatures served in any unit) |
| GET | `/api/types` | Concepts and their data types |
| GET | `/api/translations` | The translation table |
| GET | `/api/pods` | Known pods |
| GET | `/api/pods/:id/types` | Advertised types (stored + virtual) |
| GET | `/api/pods/:id/type-index` | The same, as a Solid-style JSON-LD type index |
| GET | `/api/pods/:id/data?type=<IRI>` | Records in the requested type, with provenance (source resource, stored type, translation path, original record) |
| POST | `/api/translate` | `{ from, to, record }`: translate one record ad hoc |

```sh
curl "http://localhost:8787/api/pods/alice/data?type=https%3A%2F%2Fhospital-b.example%2Fvocab%23BodyTemperatureFahrenheit"
```

## Run, test, deploy

```sh
npm install
npm test            # vitest: translator + HTTP API
npm run typecheck
npm run dev         # wrangler dev → http://localhost:8787
npx wrangler login  # once
npm run deploy      # deploys to Cloudflare Workers (*.workers.dev)
```

## Code layout

- `src/registry.ts`: concepts, data types, translation functions
- `src/translator.ts`: translation graph (validation, shortest path, chained translation)
- `src/service.ts`: advertising, reading with translation, type index
- `src/pods.ts`: `PodSource` interface + in-memory mock pods
- `src/index.ts`: Worker HTTP routes
- `src/ui.ts`: test page

## Next steps

- **Real pods:** implement `PodSource` with `@inrupt/solid-client`: read the pod's
  public/private type index, fetch the registered resources, and forward the app's
  authenticated fetch (Solid-OIDC) so the service never sees more than the app may.
- **RDF instead of JSON:** model data types as SHACL shapes and units with UCUM/QUDT,
  so translations can be generated from unit conversion factors.
- **Writes:** translate app writes back into the pod's native type.
- **Lossiness:** the `lossless` flag is there; use it to rank paths or warn apps.
