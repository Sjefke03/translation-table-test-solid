import { describe, expect, it } from "vitest";
import { dataTypes, TYPE, translations } from "../src/registry";
import { Translator } from "../src/translator";

const translator = new Translator(dataTypes, translations);

describe("Translator", () => {
  it("converts Hospital A °C records to Hospital B °F records, including field names", () => {
    const { record, path } = translator.translate(
      { patientId: "p1", temperatureC: 37, measuredAt: "2026-10-01T08:00:00Z" },
      TYPE.tempCelsiusA,
      TYPE.tempFahrenheitB,
    );
    expect(record).toEqual({ patient: "p1", tempF: 98.6, timestamp: "2026-10-01T08:00:00Z" });
    expect(path).toHaveLength(1);
  });

  it("chains translations when there is no direct edge (°F -> °C -> K)", () => {
    const { record, path } = translator.translate({ patient: "p1", tempF: 98.6, timestamp: "t" }, TYPE.tempFahrenheitB, TYPE.tempKelvinRx);
    expect(record).toEqual({ subject: "p1", value: 310.15, effectiveDateTime: "t" });
    expect(path.map((s) => s.to)).toEqual([TYPE.tempCelsiusA, TYPE.tempKelvinRx]);
  });

  it("converts glucose mg/dL <-> mmol/L", () => {
    const toMmol = translator.translate({ patientId: "p1", glucoseMgDl: 126, measuredAt: "t" }, TYPE.glucoseMgdlA, TYPE.glucoseMmolB);
    expect(toMmol.record.glucoseMmolL).toBe(6.99);
    const back = translator.translate(toMmol.record, TYPE.glucoseMmolB, TYPE.glucoseMgdlA);
    expect(back.record.glucoseMgDl).toBeCloseTo(126, 0);
  });

  it("round-trips weight within rounding error", () => {
    const lb = translator.translate({ patientId: "p1", weightKg: 72.5, measuredAt: "t" }, TYPE.weightKgA, TYPE.weightLbB);
    const kg = translator.translate(lb.record, TYPE.weightLbB, TYPE.weightKgA);
    expect(kg.record.weightKg).toBeCloseTo(72.5, 1);
  });

  it("never translates across concepts", () => {
    expect(translator.findPath(TYPE.tempCelsiusA, TYPE.glucoseMgdlA)).toBeNull();
    expect(() => translator.translate({}, TYPE.tempCelsiusA, TYPE.glucoseMgdlA)).toThrow(/No translation path/);
  });

  it("rejects translations registered between different concepts", () => {
    expect(
      () => new Translator(dataTypes, [{ from: TYPE.tempCelsiusA, to: TYPE.weightKgA, description: "bad", lossless: false, apply: (r) => r }]),
    ).toThrow(/crosses concepts/);
  });

  it("reports a clear error for malformed input", () => {
    expect(() => translator.translate({ patientId: "p1", temperatureC: "hot" }, TYPE.tempCelsiusA, TYPE.tempFahrenheitB)).toThrow(/temperatureC/);
  });
});
