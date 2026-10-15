import { availableData, conceptByCode, LOINC_SYSTEM, patientId } from "./fhir";
import { pkceChallenge, sign, verify } from "./jwt";
import { concepts } from "./registry";
import type { PodSnapshot } from "./solid";
import { consentPage, errorPage, choosePodPage } from "./smartui";
import type { Translator } from "./translator";

/**
 * A small SMART App Launch (v2) authorization server: standalone launch, public clients,
 * authorization code + PKCE (S256). The consent step reads the pod and shows the pod owner
 * everything available (stored and translatable), and the owner grants per LOINC code.
 *
 * Demo limitation: the consent screen does not authenticate the pod owner. A real deployment
 * would log the owner in with Solid-OIDC first and only show pods their WebID controls.
 */

export interface SmartContext {
  origin: string;
  secret: string;
  translator: Translator;
  loadPod: (webId: string) => Promise<PodSnapshot>;
  examplePods: { label: string; webId: string }[];
}

export interface AccessToken {
  t: "access";
  webId: string;
  codes: string[];
  patientRead: boolean;
  clientId: string;
  scope: string;
}

interface AuthCode {
  t: "code";
  webId: string;
  codes: string[];
  patientRead: boolean;
  clientId: string;
  redirectUri: string;
  challenge: string;
  scope: string;
}

const CODE_TTL = 120;
const TOKEN_TTL = 3600;

export const fhirBase = (origin: string) => `${origin}/fhir`;

export function smartConfiguration(origin: string): object {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/smart/authorize`,
    token_endpoint: `${origin}/smart/token`,
    grant_types_supported: ["authorization_code"],
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [
      "launch/patient",
      "patient/Patient.rs",
      "patient/Observation.rs",
      ...concepts.map((c) => `patient/Observation.rs?code=${LOINC_SYSTEM}|${c.code}`),
    ],
    capabilities: ["launch-standalone", "client-public", "context-standalone-patient", "permission-patient", "permission-v2", "permission-v1"],
  };
}

// ------------------------------------------------------------------ scopes

export interface RequestedScope {
  /** LOINC codes the app asked for (all known codes for a broad Observation scope). */
  codes: string[];
  patientRead: boolean;
  launchPatient: boolean;
}

const READ = /^(rs|r|s|read|\*|cruds)$/;

/** Parses SMART v1/v2 patient scopes. Scopes this server does not grant (openid, user/*, writes) are ignored. */
export function parseScope(scope: string): RequestedScope {
  const codes = new Set<string>();
  let patientRead = false;
  let launchPatient = false;
  for (const s of scope.split(/\s+/).filter(Boolean)) {
    if (s === "launch/patient") {
      launchPatient = true;
      continue;
    }
    const m = /^patient\/(\*|Observation|Patient)\.([a-z*]+)(?:\?(.*))?$/.exec(s);
    if (!m || !READ.test(m[2])) continue;
    const [, resource, , query] = m;
    if (resource === "Patient" || resource === "*") patientRead = true;
    if (resource === "Observation" || resource === "*") {
      const codeParam = query ? new URLSearchParams(query).get("code") : null;
      if (!codeParam) concepts.forEach((c) => codes.add(c.code));
      else for (const token of codeParam.split(",")) {
        const code = token.includes("|") ? token.split("|")[1] : token;
        if (conceptByCode(code)) codes.add(code);
      }
    }
  }
  return { codes: [...codes], patientRead, launchPatient };
}

function grantedScope(codes: string[], patientRead: boolean, launchPatient: boolean): string {
  return [
    ...(launchPatient ? ["launch/patient"] : []),
    ...(patientRead ? ["patient/Patient.rs"] : []),
    ...codes.map((c) => `patient/Observation.rs?code=${LOINC_SYSTEM}|${c}`),
  ].join(" ");
}

// ------------------------------------------------------------------ authorize

const OAUTH_PARAMS = ["response_type", "client_id", "redirect_uri", "scope", "state", "aud", "code_challenge", "code_challenge_method"] as const;
type OAuthParams = Record<(typeof OAUTH_PARAMS)[number], string>;

const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

function redirectWith(redirectUri: string, params: Record<string, string>): Response {
  const target = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) target.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { location: target.toString() } });
}

/** Validates the authorize request. Errors before the redirect URI is trusted are shown, not redirected. */
function validate(p: OAuthParams, ctx: SmartContext): { error?: Response } {
  if (!p.client_id) return { error: html(errorPage("Missing client_id"), 400) };
  let redirect: URL;
  try {
    redirect = new URL(p.redirect_uri);
  } catch {
    return { error: html(errorPage("Missing or invalid redirect_uri"), 400) };
  }
  if (redirect.protocol !== "https:" && redirect.protocol !== "http:") return { error: html(errorPage("redirect_uri must be http(s)"), 400) };
  const fail = (error: string, description: string) => ({ error: redirectWith(p.redirect_uri, { error, error_description: description, state: p.state }) });
  if (p.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported");
  if (p.aud !== fhirBase(ctx.origin)) return fail("invalid_request", `aud must be ${fhirBase(ctx.origin)}`);
  if (!p.code_challenge || p.code_challenge_method !== "S256") return fail("invalid_request", "PKCE with S256 is required");
  if (parseScope(p.scope ?? "").codes.length === 0 && !parseScope(p.scope ?? "").patientRead) {
    return fail("invalid_scope", "Request at least patient/Observation.rs or patient/Patient.rs");
  }
  return {};
}

export async function authorizeGet(url: URL, ctx: SmartContext): Promise<Response> {
  const p = Object.fromEntries(OAUTH_PARAMS.map((k) => [k, url.searchParams.get(k) ?? ""])) as OAuthParams;
  const { error } = validate(p, ctx);
  if (error) return error;
  const webId = url.searchParams.get("webid");
  if (!webId) return html(choosePodPage(p, ctx.examplePods));
  let pod: PodSnapshot;
  try {
    pod = await ctx.loadPod(webId);
  } catch (e) {
    return html(choosePodPage(p, ctx.examplePods, `Could not read pod: ${(e as Error).message}`), 502);
  }
  const requested = parseScope(p.scope);
  return html(consentPage(p, pod, availableData(pod, ctx.translator), requested));
}

export async function authorizePost(request: Request, ctx: SmartContext): Promise<Response> {
  const form = await request.formData();
  const p = Object.fromEntries(OAUTH_PARAMS.map((k) => [k, String(form.get(k) ?? "")])) as OAuthParams;
  const { error } = validate(p, ctx);
  if (error) return error;
  if (form.get("decision") !== "approve") {
    return redirectWith(p.redirect_uri, { error: "access_denied", error_description: "The pod owner denied access", state: p.state });
  }
  const webId = String(form.get("webid") ?? "");
  if (!webId) return html(errorPage("Missing webid"), 400);
  const requested = parseScope(p.scope);
  const codes = form.getAll("code").map(String).filter((c) => requested.codes.includes(c));
  const patientRead = requested.patientRead && form.get("patient") === "on";
  const code = await sign(
    {
      t: "code",
      webId,
      codes,
      patientRead,
      clientId: p.client_id,
      redirectUri: p.redirect_uri,
      challenge: p.code_challenge,
      scope: grantedScope(codes, patientRead, requested.launchPatient),
    } satisfies AuthCode,
    ctx.secret,
    CODE_TTL,
  );
  return redirectWith(p.redirect_uri, { code, state: p.state });
}

// ------------------------------------------------------------------ token

const tokenError = (error: string, description: string, status = 400) =>
  new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*" },
  });

export async function token(request: Request, ctx: SmartContext): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return tokenError("invalid_request", "Body must be application/x-www-form-urlencoded");
  }
  const get = (k: string) => String(form.get(k) ?? "");
  if (get("grant_type") !== "authorization_code") return tokenError("unsupported_grant_type", "Only authorization_code is supported");
  const code = await verify<AuthCode>(get("code"), ctx.secret);
  if (!code || code.t !== "code") return tokenError("invalid_grant", "Invalid or expired code");
  if (code.clientId !== get("client_id")) return tokenError("invalid_grant", "client_id does not match");
  if (code.redirectUri !== get("redirect_uri")) return tokenError("invalid_grant", "redirect_uri does not match");
  if ((await pkceChallenge(get("code_verifier"))) !== code.challenge) return tokenError("invalid_grant", "PKCE verification failed");

  const accessToken = await sign(
    { t: "access", webId: code.webId, codes: code.codes, patientRead: code.patientRead, clientId: code.clientId, scope: code.scope } satisfies AccessToken,
    ctx.secret,
    TOKEN_TTL,
  );
  return new Response(
    JSON.stringify({ access_token: accessToken, token_type: "Bearer", expires_in: TOKEN_TTL, scope: code.scope, patient: patientId(code.webId) }),
    { headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*" } },
  );
}

/** The verified access token on the request, or null. */
export async function bearer(request: Request, secret: string): Promise<AccessToken | null> {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!m) return null;
  const payload = await verify<AccessToken>(m[1], secret);
  return payload?.t === "access" ? payload : null;
}
