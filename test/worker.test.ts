import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { TYPE } from "../src/registry";

const get = async (path: string) => {
  const res = await worker.fetch(new Request(`https://svc.example${path}`));
  return { status: res.status, body: (await res.json()) as any };
};

describe("HTTP API", () => {
  it("advertises stored and virtual types for Alice's pod", async () => {
    const { status, body } = await get("/api/pods/alice/types");
    expect(status).toBe(200);
    const byType = Object.fromEntries(body.map((a: any) => [a.type, a]));
    // Both temperature formats are stored natively; Kelvin is only reachable through translation.
    expect(byType[TYPE.tempCelsiusA]).toMatchObject({ availability: "stored", recordCount: 4 });
    expect(byType[TYPE.tempFahrenheitB]).toMatchObject({ availability: "stored", recordCount: 4 });
    expect(byType[TYPE.tempKelvinFhir]).toMatchObject({ availability: "virtual", recordCount: 4 });
    expect(byType[TYPE.glucoseMmolB]).toMatchObject({ availability: "virtual", storedAs: [TYPE.glucoseMgdlA] });
  });

  it("serves all of Alice's temperatures in °F, translating the °C ones", async () => {
    const { body } = await get(`/api/pods/alice/data?type=${encodeURIComponent(TYPE.tempFahrenheitB)}`);
    expect(body.records.map((r: any) => r.data.tempF)).toEqual([98.24, 101.12, 99.5, 101.3]);
    expect(body.records.map((r: any) => r.provenance.translated)).toEqual([true, true, false, false]);
    expect(body.records[0].provenance.original.temperatureC).toBe(36.8);
  });

  it("serves the same data in °C", async () => {
    const { body } = await get(`/api/pods/alice/data?type=${encodeURIComponent(TYPE.tempCelsiusA)}`);
    expect(body.records.map((r: any) => r.data.temperatureC)).toEqual([36.8, 38.4, 37.5, 38.5]);
  });

  it("exposes a Solid-style type index", async () => {
    const { body } = await get("/api/pods/bob/type-index");
    const classes = body["@graph"].map((r: any) => r["solid:forClass"]["@id"]);
    expect(classes.sort()).toEqual([TYPE.glucoseMgdlA, TYPE.glucoseMmolB].sort());
  });

  it("translates ad-hoc records via POST /api/translate", async () => {
    const res = await worker.fetch(
      new Request("https://svc.example/api/translate", {
        method: "POST",
        body: JSON.stringify({ from: TYPE.weightLbB, to: TYPE.weightKgA, record: { patient: "x", weightLb: 220, timestamp: "t" } }),
      }),
    );
    expect(((await res.json()) as any).record).toEqual({ patientId: "x", weightKg: 99.79, measuredAt: "t" });
  });

  it("returns 404s for unknown pods and types", async () => {
    expect((await get("/api/pods/nobody/types")).status).toBe(404);
    expect((await get("/api/pods/alice/data?type=urn:nope")).status).toBe(404);
  });

  it("serves the test UI at /", async () => {
    const res = await worker.fetch(new Request("https://svc.example/"));
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Pod Translation Service");
  });
});
