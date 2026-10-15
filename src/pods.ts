import { TYPE, type DataRecord } from "./registry";

/** A collection of records of one data type, as stored in a pod (e.g. one container/resource). */
export interface StoredResource {
  path: string;
  type: string;
  records: DataRecord[];
}

/**
 * Abstraction over a Solid pod. The mock implementation below holds data in memory;
 * a real implementation would read the pod's type index and fetch the registered
 * resources (e.g. with @inrupt/solid-client and an authenticated fetch).
 */
export interface PodSource {
  id: string;
  label: string;
  webId: string;
  listResources(): Promise<StoredResource[]>;
}

export class InMemoryPod implements PodSource {
  constructor(
    public id: string,
    public label: string,
    public webId: string,
    private resources: StoredResource[],
  ) {}

  async listResources(): Promise<StoredResource[]> {
    return this.resources;
  }
}

/**
 * Alice was treated in two hospitals. Hospital A wrote its measurements into her pod
 * in °C / mg/dL / kg, Hospital B in °F / mmol/L / lb. Same meaning, different shapes.
 */
const alice = new InMemoryPod("alice", "Alice (records from Hospital A and B)", "https://alice.pod.example/profile/card#me", [
  {
    path: "/health/hospital-a/temperature.json",
    type: TYPE.tempCelsiusA,
    records: [
      { patientId: "alice", temperatureC: 36.8, measuredAt: "2026-09-01T08:00:00Z" },
      { patientId: "alice", temperatureC: 38.4, measuredAt: "2026-09-02T08:00:00Z" },
    ],
  },
  {
    path: "/health/hospital-b/temperature.json",
    type: TYPE.tempFahrenheitB,
    records: [
      { patient: "alice", tempF: 99.5, timestamp: "2026-10-03T09:30:00Z" },
      { patient: "alice", tempF: 101.3, timestamp: "2026-10-04T09:30:00Z" },
    ],
  },
  {
    path: "/health/hospital-a/glucose.json",
    type: TYPE.glucoseMgdlA,
    records: [{ patientId: "alice", glucoseMgDl: 126, measuredAt: "2026-09-01T07:45:00Z" }],
  },
  {
    path: "/health/hospital-b/weight.json",
    type: TYPE.weightLbB,
    records: [{ patient: "alice", weightLb: 143.3, timestamp: "2026-10-03T09:00:00Z" }],
  },
]);

/** Bob only has data from Hospital B. */
const bob = new InMemoryPod("bob", "Bob (records from Hospital B only)", "https://bob.pod.example/profile/card#me", [
  {
    path: "/health/hospital-b/glucose.json",
    type: TYPE.glucoseMmolB,
    records: [
      { patient: "bob", glucoseMmolL: 5.4, timestamp: "2026-10-01T07:00:00Z" },
      { patient: "bob", glucoseMmolL: 7.9, timestamp: "2026-10-02T07:00:00Z" },
    ],
  },
]);

export const pods: Record<string, PodSource> = { alice, bob };
