import { DataFactory, Parser, Store, Writer, type Quad, type Term } from "n3";
import type { DataRecord, DataType, FieldKind } from "./registry";

const { namedNode, literal, quad } = DataFactory;

export const VOCAB = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  solid: "http://www.w3.org/ns/solid/terms#",
  ldp: "http://www.w3.org/ns/ldp#",
  pim: "http://www.w3.org/ns/pim/space#",
  foaf: "http://xmlns.com/foaf/0.1/",
  prov: "http://www.w3.org/ns/prov#",
  tr: "https://translation-service.example/vocab#",
};

export const RDF_TYPE = `${VOCAB.rdf}type`;

/** A stored record: its RDF subject IRI plus its field values. */
export interface RdfRecord {
  id: string;
  data: DataRecord;
}

export function parseTurtle(text: string, baseIRI: string): Store {
  return new Store(new Parser({ baseIRI, format: "text/turtle" }).parse(text));
}

/** All values of `predicate` on `subject`, as IRIs or literal strings. */
export function objects(store: Store, subject: string, predicate: string): string[] {
  return store.getObjects(namedNode(subject), namedNode(predicate), null).map((o) => o.value);
}

export function subjectsOfType(store: Store, classIri: string): string[] {
  return store.getSubjects(namedNode(RDF_TYPE), namedNode(classIri), null).map((s) => s.value);
}

/** Reads every instance of `type` in the store into a field record. */
export function extractRecords(store: Store, type: DataType): RdfRecord[] {
  return subjectsOfType(store, type.id).map((id) => {
    const data: DataRecord = {};
    for (const [field, spec] of Object.entries(type.fields)) {
      const [obj] = store.getObjects(namedNode(id), namedNode(spec.predicate), null);
      if (obj) data[field] = fromTerm(obj, spec.kind);
    }
    return { id, data };
  });
}

function fromTerm(term: Term, kind: FieldKind): unknown {
  return kind === "decimal" ? Number(term.value) : term.value;
}

function toTerm(value: unknown, kind: FieldKind) {
  switch (kind) {
    case "iri":
      return namedNode(String(value));
    case "decimal":
      return literal(String(value), namedNode(`${VOCAB.xsd}decimal`));
    case "dateTime":
      return literal(String(value), namedNode(`${VOCAB.xsd}dateTime`));
  }
}

/** Quads describing `record` as an instance of `type`. Missing fields are skipped. */
export function recordQuads(subject: string, type: DataType, record: DataRecord): Quad[] {
  const s = namedNode(subject);
  const quads = [quad(s, namedNode(RDF_TYPE), namedNode(type.id))];
  for (const [field, spec] of Object.entries(type.fields)) {
    const value = record[field];
    if (value !== undefined && value !== null) quads.push(quad(s, namedNode(spec.predicate), toTerm(value, spec.kind)));
  }
  return quads;
}

export function writeTurtle(quads: Quad[], prefixes: Record<string, string>): Promise<string> {
  const writer = new Writer({ format: "text/turtle", prefixes });
  writer.addQuads(quads);
  return new Promise((resolve, reject) => writer.end((err, result) => (err ? reject(err) : resolve(result))));
}

/** Minimal expanded-term JSON-LD (one node object per subject), enough for apps and tooling. */
export function toJsonLd(quads: Quad[]): object[] {
  const nodes = new Map<string, Record<string, unknown[]>>();
  for (const q of quads) {
    const node = nodes.get(q.subject.value) ?? { "@id": [q.subject.value] };
    nodes.set(q.subject.value, node);
    const key = q.predicate.value === RDF_TYPE ? "@type" : q.predicate.value;
    let value: unknown;
    if (key === "@type") value = q.object.value;
    else if (q.object.termType === "Literal") value = { "@value": q.object.value, "@type": q.object.datatype.value };
    else value = { "@id": q.object.value };
    (node[key] ??= []).push(value);
  }
  return [...nodes.values()].map((n) => ({ ...n, "@id": n["@id"][0] }));
}
