import type { PodSource } from "./pods";
import type { DataRecord } from "./registry";
import type { Translator, TranslationStep } from "./translator";

export interface AdvertisedType {
  type: string;
  label: string;
  concept: string;
  unit: string;
  /** "stored": at least one resource is natively in this type. "virtual": only available via translation. */
  availability: "stored" | "virtual";
  storedAs: string[];
  recordCount: number;
}

export interface ServedRecord {
  data: DataRecord;
  provenance: {
    resource: string;
    storedType: string;
    translated: boolean;
    path: TranslationStep[];
    /** The record as it is stored in the pod. */
    original: DataRecord;
  };
}

/**
 * The translation layer between applications and a pod. Applications ask for the type
 * they understand; the service collects every stored resource whose type can be
 * translated into it and returns all records in the requested shape.
 */
export class TranslationService {
  constructor(private translator: Translator) {}

  async advertise(pod: PodSource): Promise<AdvertisedType[]> {
    const resources = await pod.listResources();
    const result: AdvertisedType[] = [];
    for (const target of this.translator.allTypes()) {
      const sources = resources.filter((r) => this.translator.findPath(r.type, target.id) !== null);
      if (sources.length === 0) continue;
      result.push({
        type: target.id,
        label: target.label,
        concept: target.concept,
        unit: target.unit,
        availability: sources.some((r) => r.type === target.id) ? "stored" : "virtual",
        storedAs: [...new Set(sources.map((r) => r.type))],
        recordCount: sources.reduce((n, r) => n + r.records.length, 0),
      });
    }
    return result;
  }

  async read(pod: PodSource, targetType: string): Promise<ServedRecord[]> {
    if (!this.translator.getType(targetType)) throw new UnknownTypeError(targetType);
    const out: ServedRecord[] = [];
    for (const resource of await pod.listResources()) {
      if (this.translator.findPath(resource.type, targetType) === null) continue;
      for (const record of resource.records) {
        const { record: data, path } = this.translator.translate(record, resource.type, targetType);
        out.push({
          data,
          provenance: { resource: resource.path, storedType: resource.type, translated: path.length > 0, path, original: record },
        });
      }
    }
    return out;
  }

  /** Solid-style type index (JSON-LD) listing stored and virtual registrations. */
  async typeIndex(pod: PodSource, baseUrl: string): Promise<object> {
    const advertised = await this.advertise(pod);
    return {
      "@context": {
        solid: "http://www.w3.org/ns/solid/terms#",
        tr: "https://translation-service.example/vocab#",
      },
      "@id": `${baseUrl}/pods/${pod.id}/type-index`,
      "@type": ["solid:TypeIndex", "solid:ListedDocument"],
      "tr:pod": pod.webId,
      "@graph": advertised.map((a) => ({
        "@type": "solid:TypeRegistration",
        "solid:forClass": { "@id": a.type },
        "solid:instance": { "@id": `${baseUrl}/pods/${pod.id}/data?type=${encodeURIComponent(a.type)}` },
        "tr:concept": a.concept,
        "tr:unit": a.unit,
        "tr:availability": a.availability,
      })),
    };
  }
}

export class UnknownTypeError extends Error {
  constructor(type: string) {
    super(`Unknown data type: ${type}`);
  }
}
