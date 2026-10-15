import { extractRecords, objects, parseTurtle, subjectsOfType, VOCAB, type RdfRecord } from "./rdf";
import type { Translator } from "./translator";

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** A pod resource holding instances of one registered class. */
export interface StoredResource {
  url: string;
  type: string;
  records: RdfRecord[];
}

export interface PodSnapshot {
  webId: string;
  name?: string;
  storage?: string;
  typeIndexes: string[];
  resources: StoredResource[];
  /** Classes registered in the pod's type index that the registry cannot translate. */
  unknownClasses: string[];
  warnings: string[];
}

const MAX_RESOURCES = 100;
const S = VOCAB.solid;

const docUrl = (iri: string) => iri.split("#")[0];

/**
 * Reads a Solid pod the way a Solid app would: WebID profile -> public type index ->
 * type registrations -> instances / instance containers (LDP) -> RDF resources.
 *
 * `fetchFn` is where authentication plugs in: pass a Solid-OIDC authenticated fetch
 * (e.g. from @inrupt/solid-client-authn) to also read the private type index and
 * non-public resources. Without it only public data is visible.
 */
export async function readPod(webId: string, translator: Translator, fetchFn: FetchFn): Promise<PodSnapshot> {
  const getTurtle = async (url: string) => {
    const res = await fetchFn(url, { headers: { accept: "text/turtle" } });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return parseTurtle(await res.text(), docUrl(url));
  };

  const profile = await getTurtle(docUrl(webId));
  const snapshot: PodSnapshot = {
    webId,
    name: objects(profile, webId, "http://xmlns.com/foaf/0.1/name")[0],
    storage: objects(profile, webId, `${VOCAB.pim}storage`)[0],
    typeIndexes: [
      ...objects(profile, webId, `${S}publicTypeIndex`),
      ...objects(profile, webId, `${S}privateTypeIndex`),
    ],
    resources: [],
    unknownClasses: [],
    warnings: [],
  };

  // class IRI -> resource URLs registered for it
  const registered = new Map<string, Set<string>>();
  for (const indexUrl of snapshot.typeIndexes) {
    try {
      const index = await getTurtle(indexUrl);
      for (const reg of subjectsOfType(index, `${S}TypeRegistration`)) {
        const instances = objects(index, reg, `${S}instance`);
        for (const container of objects(index, reg, `${S}instanceContainer`)) {
          try {
            const listing = await getTurtle(container);
            instances.push(...objects(listing, container, `${VOCAB.ldp}contains`));
          } catch (e) {
            snapshot.warnings.push((e as Error).message);
          }
        }
        for (const cls of objects(index, reg, `${S}forClass`)) {
          if (!translator.getType(cls)) {
            if (!snapshot.unknownClasses.includes(cls)) snapshot.unknownClasses.push(cls);
            continue;
          }
          const set = registered.get(cls) ?? new Set();
          instances.forEach((i) => set.add(docUrl(i)));
          registered.set(cls, set);
        }
      }
    } catch (e) {
      // A private type index without an authenticated fetch is expected to fail.
      snapshot.warnings.push((e as Error).message);
    }
  }

  let fetched = 0;
  for (const [cls, urls] of registered) {
    const type = translator.getType(cls)!;
    for (const url of urls) {
      if (++fetched > MAX_RESOURCES) {
        snapshot.warnings.push(`Stopped after ${MAX_RESOURCES} resources`);
        return snapshot;
      }
      try {
        const records = extractRecords(await getTurtle(url), type);
        snapshot.resources.push({ url, type: cls, records });
      } catch (e) {
        snapshot.warnings.push((e as Error).message);
      }
    }
  }
  return snapshot;
}
