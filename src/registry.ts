/**
 * Type and translation registry.
 *
 * A *concept* is the shared meaning, identified by its LOINC IRI ("body temperature").
 * A *data type* is an RDF class that represents that concept with its own predicates
 * and unit. Two hospitals can write the same concept into a Solid pod as different classes.
 * A *translation* is a directed function from one data type to another of the same concept.
 *
 * Translations work on plain field records; `fields` maps each record field to the RDF
 * predicate used in the pod, so parsing/serialising (src/rdf.ts) stays generic.
 */

export type DataRecord = Record<string, unknown>;

export interface Concept {
  id: string; // LOINC IRI
  code: string; // LOINC code, used as the FHIR Observation.code
  label: string;
  /** FHIR observation-category code. */
  category: "vital-signs" | "laboratory";
}

export type FieldKind = "iri" | "decimal" | "dateTime";

export interface FieldSpec {
  predicate: string;
  kind: FieldKind;
}

export interface DataType {
  id: string; // RDF class IRI, used as solid:forClass in type indexes
  concept: string;
  label: string;
  unit: string; // UCUM unit code
  symbol: string; // Human-readable unit for display
  /** Field holding the measured value. */
  valueField: string;
  fields: Record<string, FieldSpec>;
}

export interface Translation {
  from: string;
  to: string;
  description: string;
  /** Whether translating back yields the original value (up to rounding). */
  lossless: boolean;
  apply: (record: DataRecord) => DataRecord;
}

export const NS = {
  ha: "https://hospital-a.example/vocab#",
  hb: "https://hospital-b.example/vocab#",
  rx: "https://research.example/vocab#",
};

export const TYPE = {
  tempCelsiusA: `${NS.ha}BodyTemperatureCelsius`,
  tempFahrenheitB: `${NS.hb}BodyTemperatureFahrenheit`,
  tempKelvinRx: `${NS.rx}BodyTemperatureKelvin`,
  glucoseMgdlA: `${NS.ha}BloodGlucoseMgPerDl`,
  glucoseMmolB: `${NS.hb}BloodGlucoseMmolPerL`,
  weightKgA: `${NS.ha}BodyWeightKg`,
  weightLbB: `${NS.hb}BodyWeightLb`,
} as const;

const LOINC = {
  temperature: "https://loinc.org/8310-5/",
  glucose: "https://loinc.org/2339-0/",
  weight: "https://loinc.org/29463-7/",
};

export const concepts: Concept[] = [
  { id: LOINC.temperature, code: "8310-5", label: "Body temperature", category: "vital-signs" },
  { id: LOINC.glucose, code: "2339-0", label: "Glucose [Mass/volume] in Blood", category: "laboratory" },
  { id: LOINC.weight, code: "29463-7", label: "Body weight", category: "vital-signs" },
];

// Field layouts per source. Hospital A and B name the same things differently.
const hospitalA = (valueField: string): Record<string, FieldSpec> => ({
  patientId: { predicate: `${NS.ha}patient`, kind: "iri" },
  [valueField]: { predicate: `${NS.ha}${valueField}`, kind: "decimal" },
  measuredAt: { predicate: `${NS.ha}measuredAt`, kind: "dateTime" },
});
const hospitalB = (valueField: string): Record<string, FieldSpec> => ({
  patient: { predicate: `${NS.hb}subject`, kind: "iri" },
  [valueField]: { predicate: `${NS.hb}${valueField}`, kind: "decimal" },
  timestamp: { predicate: `${NS.hb}timestamp`, kind: "dateTime" },
});

export const dataTypes: DataType[] = [
  {
    id: TYPE.tempCelsiusA,
    concept: LOINC.temperature,
    label: "Body temperature (Hospital A, °C)",
    unit: "Cel",
    symbol: "°C",
    valueField: "temperatureC",
    fields: hospitalA("temperatureC"),
  },
  {
    id: TYPE.tempFahrenheitB,
    concept: LOINC.temperature,
    label: "Body temperature (Hospital B, °F)",
    unit: "[degF]",
    symbol: "°F",
    valueField: "tempF",
    fields: hospitalB("tempF"),
  },
  {
    id: TYPE.tempKelvinRx,
    concept: LOINC.temperature,
    label: "Body temperature (research export, K)",
    unit: "K",
    symbol: "K",
    valueField: "value",
    fields: {
      subject: { predicate: `${NS.rx}subject`, kind: "iri" },
      value: { predicate: `${NS.rx}value`, kind: "decimal" },
      effectiveDateTime: { predicate: `${NS.rx}effectiveDateTime`, kind: "dateTime" },
    },
  },
  {
    id: TYPE.glucoseMgdlA,
    concept: LOINC.glucose,
    label: "Blood glucose (Hospital A, mg/dL)",
    unit: "mg/dL",
    symbol: "mg/dL",
    valueField: "glucoseMgDl",
    fields: hospitalA("glucoseMgDl"),
  },
  {
    id: TYPE.glucoseMmolB,
    concept: LOINC.glucose,
    label: "Blood glucose (Hospital B, mmol/L)",
    unit: "mmol/L",
    symbol: "mmol/L",
    valueField: "glucoseMmolL",
    fields: hospitalB("glucoseMmolL"),
  },
  {
    id: TYPE.weightKgA,
    concept: LOINC.weight,
    label: "Body weight (Hospital A, kg)",
    unit: "kg",
    symbol: "kg",
    valueField: "weightKg",
    fields: hospitalA("weightKg"),
  },
  {
    id: TYPE.weightLbB,
    concept: LOINC.weight,
    label: "Body weight (Hospital B, lb)",
    unit: "[lb_av]",
    symbol: "lb",
    valueField: "weightLb",
    fields: hospitalB("weightLb"),
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
    description: "°F = °C × 9/5 + 32; ha:patient→hb:subject, ha:measuredAt→hb:timestamp",
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
    description: "°C = (°F − 32) × 5/9; hb:subject→ha:patient, hb:timestamp→ha:measuredAt",
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
    to: TYPE.tempKelvinRx,
    description: "K = °C + 273.15",
    lossless: true,
    apply: (r) => ({
      subject: r.patientId,
      value: round(num(r, "temperatureC") + 273.15, 2),
      effectiveDateTime: r.measuredAt,
    }),
  },
  {
    from: TYPE.tempKelvinRx,
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
