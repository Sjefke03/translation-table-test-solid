import { base64url, fromBase64url } from "./jwt";
import { concepts, type Concept, type DataRecord, type DataType } from "./registry";
import type { PodSnapshot } from "./solid";
import type { Translator } from "./translator";

/**
 * FHIR R4 view of a pod. Every concept becomes an Observation with a LOINC code; every data
 * type of that concept is one possible valueQuantity unit. Apps pick a unit with the
 * custom `unit` search parameter (UCUM code) and the translator does the conversion.
 */

export const LOINC_SYSTEM = "http://loinc.org";
export const UCUM_SYSTEM = "http://unitsofmeasure.org";
const EXT = "https://translation-service.example/fhir/StructureDefinition";

/** Patient ids are the WebID, base64url-encoded, so they fit FHIR's id rules loosely enough for a demo. */
export const patientId = (webId: string) => base64url(webId);
export const webIdFromPatient = (id: string) => fromBase64url(id);

export const conceptByCode = (code: string) => concepts.find((c) => c.code === code);

export interface GrantedConcept {
  code: string;
  system: string;
  label: string;
  category: string;
  recordCount: number;
  storedAs: { type: string; unit: string; records: number }[];
  /** Every unit the app may ask for; virtual ones are produced by translation. */
  units: { unit: string; symbol: string; type: string; availability: "stored" | "virtual" }[];
}

/** What a pod holds per concept: the "all data available" list shown at consent time and to apps after the grant. */
export function availableData(pod: PodSnapshot, translator: Translator): GrantedConcept[] {
  const out: GrantedConcept[] = [];
  for (const concept of concepts) {
    const stored = pod.resources.filter((r) => translator.getType(r.type)?.concept === concept.id);
    if (stored.length === 0) continue;
    const storedTypes = new Map<string, number>();
    for (const r of stored) storedTypes.set(r.type, (storedTypes.get(r.type) ?? 0) + r.records.length);
    const reachable = translator
      .allTypes()
      .filter((t) => t.concept === concept.id && [...storedTypes.keys()].some((s) => translator.findPath(s, t.id) !== null));
    out.push({
      code: concept.code,
      system: LOINC_SYSTEM,
      label: concept.label,
      category: concept.category,
      recordCount: [...storedTypes.values()].reduce((a, b) => a + b, 0),
      storedAs: [...storedTypes].map(([type, records]) => ({ type, unit: translator.getType(type)!.unit, records })),
      units: reachable.map((t) => ({ unit: t.unit, symbol: t.symbol, type: t.id, availability: storedTypes.has(t.id) ? "stored" : "virtual" })),
    });
  }
  return out;
}

const fieldOfKind = (type: DataType, record: DataRecord, kind: string) => {
  const entry = Object.entries(type.fields).find(([, spec]) => spec.kind === kind);
  return entry ? record[entry[0]] : undefined;
};

// Short stable ids (FNV-1a) derived from the source record and the unit it is served in.
function stableId(input: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 ^ input.charCodeAt(i), 2246822519);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

export interface ObservationQuery {
  codes: string[]; // LOINC codes to include
  unit?: string; // UCUM code to translate into
}

/** FHIR Observations for the requested codes. A `unit` that a concept has no type for skips that concept. */
export function observations(pod: PodSnapshot, translator: Translator, query: ObservationQuery): object[] {
  const out: object[] = [];
  const pid = patientId(pod.webId);
  for (const code of query.codes) {
    const concept = conceptByCode(code);
    if (!concept) continue;
    let target: DataType | undefined;
    if (query.unit) {
      target = translator.allTypes().find((t) => t.concept === concept.id && t.unit === query.unit);
      if (!target) continue; // unit belongs to another concept; other codes may still match
    }
    for (const resource of pod.resources) {
      const stored = translator.getType(resource.type)!;
      if (stored.concept !== concept.id) continue;
      const type = target ?? stored;
      for (const record of resource.records) {
        const { record: data, path } = translator.translate(record.data, stored.id, type.id);
        out.push(toObservation(concept, type, data, { pid, source: record.id, resource: resource.url, storedType: stored, path: path.map((p) => p.description) }));
      }
    }
  }
  return out;
}

function toObservation(
  concept: Concept,
  type: DataType,
  data: DataRecord,
  ctx: { pid: string; source: string; resource: string; storedType: DataType; path: string[] },
): object {
  const translated = ctx.path.length > 0;
  return {
    resourceType: "Observation",
    id: stableId(`${ctx.source}|${type.unit}`),
    meta: {
      source: ctx.resource,
      tag: [{ system: `${EXT}/translation`, code: translated ? "translated" : "native" }],
    },
    extension: [
      { url: `${EXT}/solid-source`, valueUri: ctx.source },
      { url: `${EXT}/stored-as`, valueUri: ctx.storedType.id },
      ...(translated ? [{ url: `${EXT}/translation-path`, valueString: ctx.path.join(" | ") }] : []),
    ],
    status: "final",
    category: [
      {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: concept.category }],
      },
    ],
    code: { coding: [{ system: LOINC_SYSTEM, code: concept.code, display: concept.label }], text: concept.label },
    subject: { reference: `Patient/${ctx.pid}` },
    effectiveDateTime: fieldOfKind(type, data, "dateTime"),
    valueQuantity: { value: data[type.valueField], unit: type.symbol, system: UCUM_SYSTEM, code: type.unit },
  };
}

export function bundle(resources: object[], fhirBase: string, selfUrl: string): object {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    link: [{ relation: "self", url: selfUrl }],
    entry: resources.map((r) => ({
      fullUrl: `${fhirBase}/${(r as { resourceType: string }).resourceType}/${(r as { id: string }).id}`,
      resource: r,
      search: { mode: "match" },
    })),
  };
}

export function patientResource(pod: PodSnapshot): object {
  return {
    resourceType: "Patient",
    id: patientId(pod.webId),
    identifier: [{ system: "urn:ietf:rfc:3986", value: pod.webId }],
    name: pod.name ? [{ text: pod.name }] : undefined,
  };
}

export function capabilityStatement(fhirBase: string): object {
  return {
    resourceType: "CapabilityStatement",
    status: "active",
    date: "2026-10-15",
    kind: "instance",
    fhirVersion: "4.0.1",
    format: ["json"],
    implementation: { description: "FHIR view of Solid pods with on-the-fly unit translation", url: fhirBase },
    rest: [
      {
        mode: "server",
        security: {
          service: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/restful-security-service", code: "SMART-on-FHIR" }] }],
          extension: [
            {
              url: "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
              extension: [
                { url: "authorize", valueUri: `${fhirBase.replace(/\/fhir$/, "")}/smart/authorize` },
                { url: "token", valueUri: `${fhirBase.replace(/\/fhir$/, "")}/smart/token` },
              ],
            },
          ],
        },
        resource: [
          { type: "Patient", interaction: [{ code: "read" }] },
          {
            type: "Observation",
            interaction: [{ code: "search-type" }],
            searchParam: [
              { name: "patient", type: "reference" },
              { name: "code", type: "token", documentation: "LOINC code, e.g. http://loinc.org|8310-5" },
              {
                name: "unit",
                type: "token",
                documentation: "Non-standard. UCUM code to return valueQuantity in (e.g. [degF]); values are translated on the fly. Omit to get each record in its stored unit.",
              },
            ],
          },
        ],
      },
    ],
  };
}
