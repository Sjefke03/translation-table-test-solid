/**
 * Two mock Solid pods served by this Worker under /mock-pod/<name>/, as plain Turtle
 * documents laid out like a real pod: WebID profile, public type index, LDP containers.
 * The service reads them over HTTP with the same code path it uses for real pods.
 *
 * Alice was treated in two hospitals. Hospital A wrote its measurements into her pod as
 * ha:* classes (°C, mg/dL), Hospital B as hb:* classes (°F, lb). Same meaning, different shapes.
 */

const PREFIXES = `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix ldp: <http://www.w3.org/ns/ldp#>.
@prefix pim: <http://www.w3.org/ns/pim/space#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix ha: <https://hospital-a.example/vocab#>.
@prefix hb: <https://hospital-b.example/vocab#>.
`;

const profile = (name: string, pod: string) => `${PREFIXES}
<> a foaf:PersonalProfileDocument; foaf:primaryTopic <#me>.
<#me> a foaf:Person;
  foaf:name "${name}";
  pim:storage </mock-pod/${pod}/>;
  solid:publicTypeIndex </mock-pod/${pod}/settings/publicTypeIndex.ttl>.
`;

const container = (...children: string[]) => `${PREFIXES}
<> a ldp:Container, ldp:BasicContainer;
  ldp:contains ${children.map((c) => `<${c}>`).join(", ")}.
`;

const documents: Record<string, string> = {
  // ---------------------------------------------------------------- alice
  "/mock-pod/alice/profile/card": profile("Alice", "alice"),

  "/mock-pod/alice/settings/publicTypeIndex.ttl": `${PREFIXES}
<> a solid:TypeIndex, solid:ListedDocument.

<#temperature-a> a solid:TypeRegistration;
  solid:forClass ha:BodyTemperatureCelsius;
  solid:instanceContainer </mock-pod/alice/health/hospital-a/temperature/>.

<#temperature-b> a solid:TypeRegistration;
  solid:forClass hb:BodyTemperatureFahrenheit;
  solid:instance </mock-pod/alice/health/hospital-b/temperature.ttl>.

<#glucose-a> a solid:TypeRegistration;
  solid:forClass ha:BloodGlucoseMgPerDl;
  solid:instance </mock-pod/alice/health/hospital-a/glucose.ttl>.

<#weight-b> a solid:TypeRegistration;
  solid:forClass hb:BodyWeightLb;
  solid:instance </mock-pod/alice/health/hospital-b/weight.ttl>.
`,

  "/mock-pod/alice/health/hospital-a/temperature/": container("2026-09-01.ttl", "2026-09-02.ttl"),

  "/mock-pod/alice/health/hospital-a/temperature/2026-09-01.ttl": `${PREFIXES}
<#it> a ha:BodyTemperatureCelsius;
  ha:patient </mock-pod/alice/profile/card#me>;
  ha:temperatureC 36.8;
  ha:measuredAt "2026-09-01T08:00:00Z"^^xsd:dateTime.
`,

  "/mock-pod/alice/health/hospital-a/temperature/2026-09-02.ttl": `${PREFIXES}
<#it> a ha:BodyTemperatureCelsius;
  ha:patient </mock-pod/alice/profile/card#me>;
  ha:temperatureC 38.4;
  ha:measuredAt "2026-09-02T08:00:00Z"^^xsd:dateTime.
`,

  "/mock-pod/alice/health/hospital-b/temperature.ttl": `${PREFIXES}
<#m1> a hb:BodyTemperatureFahrenheit;
  hb:subject </mock-pod/alice/profile/card#me>;
  hb:tempF 99.5;
  hb:timestamp "2026-10-03T09:30:00Z"^^xsd:dateTime.

<#m2> a hb:BodyTemperatureFahrenheit;
  hb:subject </mock-pod/alice/profile/card#me>;
  hb:tempF 101.3;
  hb:timestamp "2026-10-04T09:30:00Z"^^xsd:dateTime.
`,

  "/mock-pod/alice/health/hospital-a/glucose.ttl": `${PREFIXES}
<#g1> a ha:BloodGlucoseMgPerDl;
  ha:patient </mock-pod/alice/profile/card#me>;
  ha:glucoseMgDl 126;
  ha:measuredAt "2026-09-01T07:45:00Z"^^xsd:dateTime.
`,

  "/mock-pod/alice/health/hospital-b/weight.ttl": `${PREFIXES}
<#w1> a hb:BodyWeightLb;
  hb:subject </mock-pod/alice/profile/card#me>;
  hb:weightLb 143.3;
  hb:timestamp "2026-10-03T09:00:00Z"^^xsd:dateTime.
`,

  // ---------------------------------------------------------------- bob
  "/mock-pod/bob/profile/card": profile("Bob", "bob"),

  "/mock-pod/bob/settings/publicTypeIndex.ttl": `${PREFIXES}
<> a solid:TypeIndex, solid:ListedDocument.

<#glucose-b> a solid:TypeRegistration;
  solid:forClass hb:BloodGlucoseMmolPerL;
  solid:instance </mock-pod/bob/health/hospital-b/glucose.ttl>.
`,

  "/mock-pod/bob/health/hospital-b/glucose.ttl": `${PREFIXES}
<#g1> a hb:BloodGlucoseMmolPerL;
  hb:subject </mock-pod/bob/profile/card#me>;
  hb:glucoseMmolL 5.4;
  hb:timestamp "2026-10-01T07:00:00Z"^^xsd:dateTime.

<#g2> a hb:BloodGlucoseMmolPerL;
  hb:subject </mock-pod/bob/profile/card#me>;
  hb:glucoseMmolL 7.9;
  hb:timestamp "2026-10-02T07:00:00Z"^^xsd:dateTime.
`,
};

export const mockPods = [
  { name: "alice", label: "Alice (records from Hospital A and B)" },
  { name: "bob", label: "Bob (records from Hospital B only)" },
];

export const mockWebId = (origin: string, name: string) => `${origin}/mock-pod/${name}/profile/card#me`;

/** Serves a mock pod document, or returns null when the path is not part of a mock pod. */
export function serveMockPod(pathname: string): Response | null {
  const body = documents[pathname];
  if (body === undefined) return null;
  const isContainer = pathname.endsWith("/");
  return new Response(body, {
    headers: {
      "content-type": "text/turtle",
      "access-control-allow-origin": "*",
      link: isContainer
        ? '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type", <http://www.w3.org/ns/ldp#Resource>; rel="type"'
        : '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
    },
  });
}
