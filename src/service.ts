import { DataFactory, type Quad } from "n3";
import { recordQuads, RDF_TYPE, VOCAB, writeTurtle } from "./rdf";
import { NS, type DataRecord } from "./registry";
import type { PodSnapshot } from "./solid";
import type { Translator, TranslationStep } from "./translator";

const { namedNode, literal, quad } = DataFactory;
const TR = VOCAB.tr;

export interface AdvertisedType {
  type: string;
  label: string;
  concept: string;
  unit: string;
  /** "stored": at least one pod resource holds this class. "virtual": only available via translation. */
  availability: "stored" | "virtual";
  storedAs: string[];
  recordCount: number;
}

export interface ServedRecord {
  /** Subject IRI in the served view. Native records keep their pod IRI. */
  id: string;
  data: DataRecord;
  provenance: {
    resource: string;
    storedType: string;
    /** Subject IRI of the record as stored in the pod. */
    source: string;
    /** The record as it is stored in the pod. */
    original: DataRecord;
    translated: boolean;
    path: TranslationStep[];
  };
}

export const PREFIXES = {
  solid: VOCAB.solid,
  prov: VOCAB.prov,
  xsd: VOCAB.xsd,
  tr: TR,
  ha: NS.ha,
  hb: NS.hb,
  rx: NS.rx,
};

/**
 * The translation layer between applications and a pod. Applications ask for the class
 * they understand; the service collects every registered pod resource whose class can be
 * translated into it and returns all records as that class. Nothing is written to the pod.
 */
export class TranslationService {
  constructor(private translator: Translator) {}

  advertise(pod: PodSnapshot): AdvertisedType[] {
    const result: AdvertisedType[] = [];
    for (const target of this.translator.allTypes()) {
      const sources = pod.resources.filter((r) => this.translator.findPath(r.type, target.id) !== null);
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

  /** `viewUrl` is the URL of the served view; translated records get IRIs inside it. */
  read(pod: PodSnapshot, targetType: string, viewUrl: string): ServedRecord[] {
    if (!this.translator.getType(targetType)) throw new UnknownTypeError(targetType);
    const out: ServedRecord[] = [];
    for (const resource of pod.resources) {
      if (this.translator.findPath(resource.type, targetType) === null) continue;
      for (const record of resource.records) {
        const { record: data, path } = this.translator.translate(record.data, resource.type, targetType);
        const translated = path.length > 0;
        out.push({
          id: translated ? `${viewUrl}#r${out.length + 1}` : record.id,
          data,
          provenance: { resource: resource.url, storedType: resource.type, source: record.id, original: record.data, translated, path },
        });
      }
    }
    return out;
  }

  /** RDF for served records; translated ones carry prov:wasDerivedFrom their stored original. */
  recordsToQuads(records: ServedRecord[], targetType: string): Quad[] {
    const type = this.translator.getType(targetType)!;
    const quads: Quad[] = [];
    for (const r of records) {
      quads.push(...recordQuads(r.id, type, r.data));
      if (r.provenance.translated) {
        const s = namedNode(r.id);
        quads.push(
          quad(s, namedNode(`${VOCAB.prov}wasDerivedFrom`), namedNode(r.provenance.source)),
          quad(s, namedNode(`${TR}translatedFrom`), namedNode(r.provenance.storedType)),
          quad(s, namedNode(`${TR}translationPath`), literal(r.provenance.path.map((p) => p.description).join(" | "))),
        );
      }
    }
    return quads;
  }

  /**
   * A Solid type index for the *translated view* of a pod: one solid:TypeRegistration per
   * class the service can serve, pointing at the service's data view for that class.
   * Apps that already understand Solid type indexes can discover virtual types the same way.
   */
  typeIndexQuads(pod: PodSnapshot, indexUrl: string, dataUrl: (type: string) => string): Quad[] {
    const index = namedNode(indexUrl);
    const quads = [
      quad(index, namedNode(RDF_TYPE), namedNode(`${VOCAB.solid}TypeIndex`)),
      quad(index, namedNode(RDF_TYPE), namedNode(`${VOCAB.solid}ListedDocument`)),
      quad(index, namedNode(`${TR}viewOf`), namedNode(pod.webId)),
    ];
    this.advertise(pod).forEach((a, i) => {
      const reg = namedNode(`${indexUrl}#reg${i + 1}`);
      quads.push(
        quad(reg, namedNode(RDF_TYPE), namedNode(`${VOCAB.solid}TypeRegistration`)),
        quad(reg, namedNode(`${VOCAB.solid}forClass`), namedNode(a.type)),
        quad(reg, namedNode(`${VOCAB.solid}instance`), namedNode(dataUrl(a.type))),
        quad(reg, namedNode(`${TR}availability`), namedNode(`${TR}${a.availability === "stored" ? "Stored" : "Virtual"}`)),
        quad(reg, namedNode(`${TR}concept`), namedNode(a.concept)),
        quad(reg, namedNode(`${TR}ucumUnit`), literal(a.unit)),
        ...a.storedAs.map((s) => quad(reg, namedNode(`${TR}storedAs`), namedNode(s))),
      );
    });
    return quads;
  }

  turtle(quads: Quad[]): Promise<string> {
    return writeTurtle(quads, PREFIXES);
  }
}

export class UnknownTypeError extends Error {
  constructor(type: string) {
    super(`Unknown data type: ${type}`);
  }
}
