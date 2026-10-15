/**
 * Type and translation registry.
 *
 * A *concept* is the shared meaning ("body temperature", identified by a LOINC code).
 * A *data type* is one concrete representation of that concept: its own field names,
 * its own unit. Two hospitals can store the same concept as different data types.
 * A *translation* is a directed function from one data type to another of the same concept.
 */

export type DataRecord = Record<string, unknown>;

export interface Concept {
  id: string; // e.g. "loinc:8310-5"
  label: string;
}

export interface DataType {
  id: string; // IRI-like identifier advertised to applications
  concept: string; // Concept id this type is a representation of
  label: string;
  unit: string; // UCUM unit code
  symbol: string; // Human-readable unit for display
  /** Field holding the measured value; used for display and docs. */
  valueField: string;
  /** Example record, also serves as lightweight schema documentation. */
  example: DataRecord;
}

export interface Translation {
  from: string;
  to: string;
  description: string;
  /** Whether translating back yields the original value (up to rounding). */
  lossless: boolean;
  apply: (record: DataRecord) => DataRecord;
}

const NS_A = "https://hospital-a.example/vocab#";
const NS_B = "https://hospital-b.example/vocab#";
const NS_F = "https://fhir.example/vocab#";

export const TYPE = {
  tempCelsiusA: `${NS_A}BodyTemperatureCelsius`,
  tempFahrenheitB: `${NS_B}BodyTemperatureFahrenheit`,
  tempKelvinFhir: `${NS_F}BodyTemperatureKelvin`,
  glucoseMgdlA: `${NS_A}BloodGlucoseMgPerDl`,
  glucoseMmolB: `${NS_B}BloodGlucoseMmolPerL`,
  weightKgA: `${NS_A}BodyWeightKg`,
  weightLbB: `${NS_B}BodyWeightLb`,
} as const;

export const concepts: Concept[] = [
  { id: "loinc:8310-5", label: "Body temperature" },
  { id: "loinc:2339-0", label: "Glucose [Mass/volume] in Blood" },
  { id: "loinc:29463-7", label: "Body weight" },
];

export const dataTypes: DataType[] = [
  {
    id: TYPE.tempCelsiusA,
    concept: "loinc:8310-5",
    label: "Body temperature (Hospital A, °C)",
    unit: "Cel",
    symbol: "°C",
    valueField: "temperatureC",
    example: { patientId: "p-001", temperatureC: 37.2, measuredAt: "2026-10-01T08:00:00Z" },
  },
  {
    id: TYPE.tempFahrenheitB,
    concept: "loinc:8310-5",
    label: "Body temperature (Hospital B, °F)",
    unit: "[degF]",
    symbol: "°F",
    valueField: "tempF",
    example: { patient: "p-001", tempF: 98.96, timestamp: "2026-10-01T08:00:00Z" },
  },
  {
    id: TYPE.tempKelvinFhir,
    concept: "loinc:8310-5",
    label: "Body temperature (research export, K)",
    unit: "K",
    symbol: "K",
    valueField: "value",
    example: { subject: "p-001", value: 310.35, unit: "K", effectiveDateTime: "2026-10-01T08:00:00Z" },
  },
  {
    id: TYPE.glucoseMgdlA,
    concept: "loinc:2339-0",
    label: "Blood glucose (Hospital A, mg/dL)",
    unit: "mg/dL",
    symbol: "mg/dL",
    valueField: "glucoseMgDl",
    example: { patientId: "p-001", glucoseMgDl: 99, measuredAt: "2026-10-01T08:00:00Z" },
  },
  {
    id: TYPE.glucoseMmolB,
    concept: "loinc:2339-0",
    label: "Blood glucose (Hospital B, mmol/L)",
    unit: "mmol/L",
    symbol: "mmol/L",
    valueField: "glucoseMmolL",
    example: { patient: "p-001", glucoseMmolL: 5.5, timestamp: "2026-10-01T08:00:00Z" },
  },
  {
    id: TYPE.weightKgA,
    concept: "loinc:29463-7",
    label: "Body weight (Hospital A, kg)",
    unit: "kg",
    symbol: "kg",
    valueField: "weightKg",
    example: { patientId: "p-001", weightKg: 72.5, measuredAt: "2026-10-01T08:00:00Z" },
  },
  {
    id: TYPE.weightLbB,
    concept: "loinc:29463-7",
    label: "Body weight (Hospital B, lb)",
    unit: "[lb_av]",
    symbol: "lb",
    valueField: "weightLb",
    example: { patient: "p-001", weightLb: 159.8, timestamp: "2026-10-01T08:00:00Z" },
  },
];

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

const num = (record: DataRecord, field: string): number => {
  const v = record[field];
  if (typeof v !== "number" || Number.isNaN(v)) {
    throw new Error(`Expected numeric field "${field}", got ${JSON.stringify(v)}`);
  }
  return v;
};

// Glucose molar mass is 180.16 g/mol, so 1 mmol/L = 18.016 mg/dL.
const GLUCOSE_MGDL_PER_MMOLL = 18.016;
const LB_PER_KG = 2.20462262;

export const translations: Translation[] = [
  // Temperature: Hospital A (°C) <-> Hospital B (°F)
  {
    from: TYPE.tempCelsiusA,
    to: TYPE.tempFahrenheitB,
    description: "°F = °C × 9/5 + 32; patientId→patient, measuredAt→timestamp",
    lossless: true,
    apply: (r) => ({
      patient: r.patientId,
      tempF: round((num(r, "temperatureC") * 9) / 5 + 32, 2),
      timestamp: r.measuredAt,
    }),
  },
  {
    from: TYPE.tempFahrenheitB,
    to: TYPE.tempCelsiusA,
    description: "°C = (°F − 32) × 5/9; patient→patientId, timestamp→measuredAt",
    lossless: true,
    apply: (r) => ({
      patientId: r.patient,
      temperatureC: round(((num(r, "tempF") - 32) * 5) / 9, 2),
      measuredAt: r.timestamp,
    }),
  },
  // Temperature: Hospital A (°C) <-> research export (K). °F <-> K is reached via °C.
  {
    from: TYPE.tempCelsiusA,
    to: TYPE.tempKelvinFhir,
    description: "K = °C + 273.15",
    lossless: true,
    apply: (r) => ({
      subject: r.patientId,
      value: round(num(r, "temperatureC") + 273.15, 2),
      unit: "K",
      effectiveDateTime: r.measuredAt,
    }),
  },
  {
    from: TYPE.tempKelvinFhir,
    to: TYPE.tempCelsiusA,
    description: "°C = K − 273.15",
    lossless: true,
    apply: (r) => ({
      patientId: r.subject,
      temperatureC: round(num(r, "value") - 273.15, 2),
      measuredAt: r.effectiveDateTime,
    }),
  },
  // Glucose
  {
    from: TYPE.glucoseMgdlA,
    to: TYPE.glucoseMmolB,
    description: `mmol/L = mg/dL ÷ ${GLUCOSE_MGDL_PER_MMOLL}`,
    lossless: true,
    apply: (r) => ({
      patient: r.patientId,
      glucoseMmolL: round(num(r, "glucoseMgDl") / GLUCOSE_MGDL_PER_MMOLL, 2),
      timestamp: r.measuredAt,
    }),
  },
  {
    from: TYPE.glucoseMmolB,
    to: TYPE.glucoseMgdlA,
    description: `mg/dL = mmol/L × ${GLUCOSE_MGDL_PER_MMOLL}`,
    lossless: true,
    apply: (r) => ({
      patientId: r.patient,
      glucoseMgDl: round(num(r, "glucoseMmolL") * GLUCOSE_MGDL_PER_MMOLL, 1),
      measuredAt: r.timestamp,
    }),
  },
  // Weight
  {
    from: TYPE.weightKgA,
    to: TYPE.weightLbB,
    description: `lb = kg × ${LB_PER_KG}`,
    lossless: true,
    apply: (r) => ({
      patient: r.patientId,
      weightLb: round(num(r, "weightKg") * LB_PER_KG, 1),
      timestamp: r.measuredAt,
    }),
  },
  {
    from: TYPE.weightLbB,
    to: TYPE.weightKgA,
    description: `kg = lb ÷ ${LB_PER_KG}`,
    lossless: true,
    apply: (r) => ({
      patientId: r.patient,
      weightKg: round(num(r, "weightLb") / LB_PER_KG, 2),
      measuredAt: r.timestamp,
    }),
  },
];
