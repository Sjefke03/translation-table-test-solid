import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { base64url, pkceChallenge } from "../src/jwt";
import { parseScope } from "../src/smart";

const ORIGIN = "https://svc.example";
const ALICE = `${ORIGIN}/mock-pod/alice/profile/card#me`;
const APP = "https://app.example/callback";
const VERIFIER = "a-sufficiently-long-pkce-code-verifier-0123456789";
const env = { TOKEN_SECRET: "test-secret" };

const call = (path: string, init?: RequestInit) => worker.fetch(new Request(`${ORIGIN}${path}`, init), env);

async function oauthParams(scope: string, overrides: Record<string, string> = {}) {
  return {
    response_type: "code",
    client_id: "test-app",
    redirect_uri: APP,
    scope,
    state: "xyz",
    aud: `${ORIGIN}/fhir`,
    code_challenge: await pkceChallenge(VERIFIER),
    code_challenge_method: "S256",
    ...overrides,
  };
}

async function approve(scope: string, form: Record<string, string | string[]>) {
  const body = new URLSearchParams(await oauthParams(scope));
  body.set("webid", ALICE);
  for (const [k, v] of Object.entries(form)) for (const x of [v].flat()) body.append(k, x);
  return call("/smart/authorize", { method: "POST", body });
}

async function tokenFor(location: string, verifier = VERIFIER) {
  const code = new URL(location).searchParams.get("code")!;
  return call("/smart/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: APP, client_id: "test-app", code_verifier: verifier }),
  });
}

describe("SMART scopes", () => {
  it("parses broad, per-code and v1 scopes", () => {
    expect(parseScope("patient/Observation.rs").codes.sort()).toEqual(["2339-0", "29463-7", "8310-5"]);
    expect(parseScope("patient/Observation.read").codes).toHaveLength(3);
    expect(parseScope("patient/Observation.rs?code=http://loinc.org|8310-5").codes).toEqual(["8310-5"]);
    expect(parseScope("patient/*.rs")).toMatchObject({ patientRead: true });
    expect(parseScope("openid fhirUser user/Observation.rs patient/Observation.c").codes).toEqual([]);
  });
});

describe("SMART discovery", () => {
  it("publishes smart-configuration and a CapabilityStatement", async () => {
    const config = (await (await call("/fhir/.well-known/smart-configuration")).json()) as any;
    expect(config.authorization_endpoint).toBe(`${ORIGIN}/smart/authorize`);
    expect(config.code_challenge_methods_supported).toEqual(["S256"]);
    const cap = (await (await call("/fhir/metadata")).json()) as any;
    expect(cap.resourceType).toBe("CapabilityStatement");
  });
});

describe("SMART standalone launch", () => {
  it("asks for a pod, then shows all data available in it", async () => {
    const q = new URLSearchParams(await oauthParams("patient/Observation.rs?code=http://loinc.org|8310-5"));
    expect(await (await call(`/smart/authorize?${q}`)).text()).toContain("Your WebID");
    q.set("webid", ALICE);
    const html = await (await call(`/smart/authorize?${q}`)).text();
    expect(html).toContain("All data available in this pod");
    expect(html).toContain("Body temperature");
    expect(html).toContain("Body weight"); // available, though not requested
    expect(html).toContain("not requested by the app");
  });

  it("issues a token limited to the granted codes and serves translated FHIR Observations", async () => {
    const auth = await approve("launch/patient patient/Patient.rs patient/Observation.rs", { decision: "approve", code: ["8310-5"], patient: "on" });
    expect(auth.status).toBe(302);
    const location = auth.headers.get("location")!;
    expect(location.startsWith(APP)).toBe(true);
    expect(new URL(location).searchParams.get("state")).toBe("xyz");

    const tok = (await (await tokenFor(location)).json()) as any;
    expect(tok.token_type).toBe("Bearer");
    expect(tok.patient).toBe(base64url(ALICE));
    expect(tok.scope).toBe("launch/patient patient/Patient.rs patient/Observation.rs?code=http://loinc.org|8310-5");
    const auth_ = { headers: { authorization: `Bearer ${tok.access_token}` } };

    const grant = (await (await call("/smart/grant", auth_)).json()) as any;
    expect(grant.data.map((c: any) => c.code)).toEqual(["8310-5"]);
    expect(grant.data[0].units.map((u: any) => u.unit).sort()).toEqual(["Cel", "K", "[degF]"].sort());
    expect(grant.patient.name[0].text).toBe("Alice");

    const inF = (await (await call(`/fhir/Observation?patient=${tok.patient}&unit=${encodeURIComponent("[degF]")}`, auth_)).json()) as any;
    expect(inF.resourceType).toBe("Bundle");
    const values = inF.entry.map((e: any) => e.resource.valueQuantity.value).sort();
    expect(values).toEqual([101.12, 101.3, 98.24, 99.5].sort());
    expect(inF.entry[0].resource.code.coding[0]).toMatchObject({ system: "http://loinc.org", code: "8310-5" });

    const stored = (await (await call("/fhir/Observation", auth_)).json()) as any;
    expect(stored.entry.map((e: any) => e.resource.valueQuantity.code).sort()).toEqual(["Cel", "Cel", "[degF]", "[degF]"]);

    // Glucose and weight exist in the pod but were not granted.
    const glucose = (await (await call("/fhir/Observation?code=http://loinc.org|2339-0", auth_)).json()) as any;
    expect(glucose.total).toBe(0);

    expect((await call(`/fhir/Patient/${tok.patient}`, auth_)).status).toBe(200);
    expect((await call(`/fhir/Patient/${base64url("https://someone.else/#me")}`, auth_)).status).toBe(403);
  });

  it("rejects a wrong PKCE verifier", async () => {
    const auth = await approve("patient/Observation.rs", { decision: "approve", code: "8310-5" });
    const res = await tokenFor(auth.headers.get("location")!, "wrong-verifier");
    expect(((await res.json()) as any).error).toBe("invalid_grant");
  });

  it("redirects with access_denied when the owner denies", async () => {
    const res = await approve("patient/Observation.rs", { decision: "deny" });
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe("access_denied");
  });

  it("rejects a wrong audience", async () => {
    const q = new URLSearchParams(await oauthParams("patient/Observation.rs", { aud: "https://other.example/fhir" }));
    const res = await call(`/smart/authorize?${q}`);
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe("invalid_request");
  });

  it("requires a valid bearer token for FHIR data", async () => {
    expect((await call("/fhir/Observation")).status).toBe(401);
    expect((await call("/fhir/Observation", { headers: { authorization: "Bearer a.b.c" } })).status).toBe(401);
  });
});
