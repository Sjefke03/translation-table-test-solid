import { Parser } from "n3";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { NS, TYPE } from "../src/registry";

const ORIGIN = "https://svc.example";
const ALICE = `${ORIGIN}/mock-pod/alice/profile/card#me`;
const BOB = `${ORIGIN}/mock-pod/bob/profile/card#me`;

const call = (path: string, accept = "application/json") => worker.fetch(new Request(`${ORIGIN}${path}`, { headers: { accept } }));
const getJson = async (path: string) => {
  const res = await call(path);
  return { status: res.status, body: (await res.json()) as any };
};
const view = (kind: string, webId: string, type?: string) =>
  `/api/view/${kind}?${new URLSearchParams({ webid: webId, ...(type ? { type } : {}) })}`;

describe("mock Solid pod", () => {
  it("serves a WebID profile pointing at a public type index", async () => {
    const res = await call("/mock-pod/alice/profile/card", "text/turtle");
    expect(res.headers.get("content-type")).toBe("text/turtle");
    const quads = new Parser({ baseIRI: `${ORIGIN}/mock-pod/alice/profile/card` }).parse(await res.text());
    const index = quads.find((q) => q.predicate.value === "http://www.w3.org/ns/solid/terms#publicTypeIndex");
    expect(index?.object.value).toBe(`${ORIGIN}/mock-pod/alice/settings/publicTypeIndex.ttl`);
  });

  it("marks containers as LDP BasicContainers", async () => {
    const res = await call("/mock-pod/alice/health/hospital-a/temperature/", "text/turtle");
    expect(res.headers.get("link")).toContain("ldp#BasicContainer");
  });
});

describe("translated view of a pod", () => {
  it("discovers resources through type index registrations, instances and containers", async () => {
    const { body } = await getJson(view("types", ALICE));
    expect(body.pod.name).toBe("Alice");
    expect(body.pod.resources.map((r: any) => r.url).sort()).toEqual(
      [
        "/mock-pod/alice/health/hospital-a/glucose.ttl",
        "/mock-pod/alice/health/hospital-a/temperature/2026-09-01.ttl",
        "/mock-pod/alice/health/hospital-a/temperature/2026-09-02.ttl",
        "/mock-pod/alice/health/hospital-b/temperature.ttl",
        "/mock-pod/alice/health/hospital-b/weight.ttl",
      ].map((p) => ORIGIN + p),
    );
    expect(body.pod.warnings).toEqual([]);
  });

  it("advertises stored and virtual types", async () => {
    const { body } = await getJson(view("types", ALICE));
    const byType = Object.fromEntries(body.types.map((a: any) => [a.type, a]));
    // Both temperature formats are stored natively; Kelvin is only reachable through translation.
    expect(byType[TYPE.tempCelsiusA]).toMatchObject({ availability: "stored", recordCount: 4 });
    expect(byType[TYPE.tempFahrenheitB]).toMatchObject({ availability: "stored", recordCount: 4 });
    expect(byType[TYPE.tempKelvinRx]).toMatchObject({ availability: "virtual", recordCount: 4 });
    expect(byType[TYPE.glucoseMmolB]).toMatchObject({ availability: "virtual", storedAs: [TYPE.glucoseMgdlA] });
  });

  it("serves all of Alice's temperatures in °F, translating the °C ones", async () => {
    const { body } = await getJson(view("data", ALICE, TYPE.tempFahrenheitB));
    const sorted = [...body.records].sort((a: any, b: any) => a.data.timestamp.localeCompare(b.data.timestamp));
    expect(sorted.map((r: any) => r.data.tempF)).toEqual([98.24, 101.12, 99.5, 101.3]);
    expect(sorted.map((r: any) => r.provenance.translated)).toEqual([true, true, false, false]);
    expect(sorted[0].data.patient).toBe(ALICE);
    expect(sorted[0].provenance.source).toBe(`${ORIGIN}/mock-pod/alice/health/hospital-a/temperature/2026-09-01.ttl#it`);
  });

  it("returns Turtle by default, with prov:wasDerivedFrom on translated records", async () => {
    const res = await call(view("data", ALICE, TYPE.tempFahrenheitB), "text/turtle");
    expect(res.headers.get("content-type")).toContain("text/turtle");
    const quads = new Parser().parse(await res.text());
    const temps = quads.filter((q) => q.predicate.value === `${NS.hb}tempF`).map((q) => Number(q.object.value));
    expect(temps.sort()).toEqual([101.12, 101.3, 98.24, 99.5].sort());
    const derived = quads.filter((q) => q.predicate.value === "http://www.w3.org/ns/prov#wasDerivedFrom");
    expect(derived).toHaveLength(2);
  });

  it("serves JSON-LD on request", async () => {
    const res = await call(view("data", BOB, TYPE.glucoseMgdlA), "application/ld+json");
    const nodes = (await res.json()) as any[];
    const values = nodes.map((n) => Number(n[`${NS.ha}glucoseMgDl`][0]["@value"]));
    expect(values).toEqual([97.3, 142.3]);
    expect(nodes[0]["@type"]).toEqual([TYPE.glucoseMgdlA]);
  });

  it("publishes a Solid type index of the translated view", async () => {
    const res = await call(view("type-index", BOB), "text/turtle");
    const quads = new Parser().parse(await res.text());
    const forClass = quads.filter((q) => q.predicate.value === "http://www.w3.org/ns/solid/terms#forClass").map((q) => q.object.value);
    expect(forClass.sort()).toEqual([TYPE.glucoseMgdlA, TYPE.glucoseMmolB].sort());
    const instances = quads.filter((q) => q.predicate.value === "http://www.w3.org/ns/solid/terms#instance");
    expect(instances[0].object.value).toMatch(/^https:\/\/svc\.example\/api\/view\/data\?webid=/);
  });

  it("returns errors for unreachable pods and unknown types", async () => {
    expect((await getJson(view("types", `${ORIGIN}/mock-pod/nobody/profile/card#me`))).status).toBe(502);
    expect((await getJson(view("data", ALICE, "urn:nope"))).status).toBe(404);
    expect((await getJson("/api/view/types")).status).toBe(400);
  });
});

describe("misc", () => {
  it("translates ad-hoc records via POST /api/translate", async () => {
    const res = await worker.fetch(
      new Request(`${ORIGIN}/api/translate`, {
        method: "POST",
        body: JSON.stringify({ from: TYPE.weightLbB, to: TYPE.weightKgA, record: { patient: "x", weightLb: 220, timestamp: "t" } }),
      }),
    );
    expect(((await res.json()) as any).record).toEqual({ patientId: "x", weightKg: 99.79, measuredAt: "t" });
  });

  it("serves the test UI at /", async () => {
    const res = await call("/", "text/html");
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Pod Translation Service");
  });
});
