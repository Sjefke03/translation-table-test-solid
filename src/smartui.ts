import type { GrantedConcept } from "./fhir";
import type { PodSnapshot } from "./solid";

// Server-rendered pages for the SMART authorization step, plus the demo SMART app.

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const short = (iri: string) => iri.split("#").pop();

const CSS = `
  :root { --bg:#f7f7f5; --panel:#fff; --text:#1d1d1b; --muted:#6b6b66; --line:#e3e2dd; --accent:#2f6f5e; --virtual:#8a5a00; --virtual-bg:#fff4dc; --stored-bg:#e3f2ec; --warn:#a33; --warn-bg:#fdecec; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161615; --panel:#1f1f1d; --text:#ecebe6; --muted:#9a9993; --line:#33332f; --accent:#7cc4ad; --virtual:#f0c36a; --virtual-bg:#3a2f17; --stored-bg:#1c3a31; --warn:#f08a8a; --warn-bg:#3a1f1f; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, sans-serif; }
  main { max-width:760px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-size:21px; margin:0 0 6px; } h2 { font-size:16px; margin:24px 0 8px; }
  a { color:var(--accent); }
  .muted { color:var(--muted); font-size:13px; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:12px; overflow-x:auto; }
  .item { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid var(--line); }
  .item:last-child { border-bottom:0; }
  .item input[type=checkbox] { width:20px; height:20px; margin-top:2px; flex:none; accent-color:var(--accent); }
  .item.disabled { opacity:.55; }
  .badge { display:inline-block; font-size:12px; padding:1px 8px; border-radius:999px; margin:2px 4px 0 0; }
  .stored { background:var(--stored-bg); color:var(--accent); } .virtual { background:var(--virtual-bg); color:var(--virtual); }
  .note { background:var(--warn-bg); color:var(--warn); border-radius:6px; padding:8px 12px; font-size:13px; margin:12px 0; }
  .actions { display:flex; gap:12px; margin-top:16px; flex-wrap:wrap; }
  button { font:inherit; padding:8px 18px; border-radius:6px; border:1px solid var(--accent); background:var(--accent); color:var(--panel); cursor:pointer; }
  button.secondary { background:transparent; color:var(--accent); }
  select, input[type=text], input:not([type]) { font:inherit; padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:var(--panel); color:var(--text); width:100%; }
  label.block { display:block; font-size:13px; color:var(--muted); margin:10px 0 4px; }
  code { font-size:12px; word-break:break-all; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:7px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
  .num { font-variant-numeric:tabular-nums; font-weight:600; }
  pre { margin:0; font-size:12px; white-space:pre-wrap; word-break:break-all; }
`;

const page = (title: string, body: string, script = "") => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><main>${body}</main>${script}</body></html>`;

const hidden = (p: Record<string, string>) =>
  Object.entries(p)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");

const host = (uri: string) => {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
};

export const errorPage = (message: string) => page("Authorization error", `<h1>Authorization error</h1><p>${esc(message)}</p>`);

export function choosePodPage(p: Record<string, string>, pods: { label: string; webId: string }[], error?: string): string {
  return page(
    "Choose your pod",
    `<h1>Share health data with <b>${esc(p.client_id)}</b></h1>
    <p class="muted">The app will receive data at <code>${esc(host(p.redirect_uri))}</code>. First pick the Solid pod that holds your data.</p>
    ${error ? `<div class="note">${esc(error)}</div>` : ""}
    <form method="get" action="/smart/authorize" class="panel">
      ${hidden(p)}
      <label class="block" for="preset">Example pod</label>
      <select id="preset" onchange="document.getElementById('webid').value=this.value">
        ${pods.map((x) => `<option value="${esc(x.webId)}">${esc(x.label)}</option>`).join("")}
      </select>
      <label class="block" for="webid">Your WebID</label>
      <input id="webid" name="webid" value="${esc(pods[0]?.webId)}" spellcheck="false">
      <div class="actions"><button type="submit">Continue</button></div>
    </form>`,
  );
}

export function consentPage(
  p: Record<string, string>,
  pod: PodSnapshot,
  data: GrantedConcept[],
  requested: { codes: string[]; patientRead: boolean },
): string {
  const items = data
    .map((c) => {
      const asked = requested.codes.includes(c.code);
      return `<label class="item${asked ? "" : " disabled"}">
        <input type="checkbox" name="code" value="${esc(c.code)}" ${asked ? "checked" : "disabled"}>
        <div>
          <b>${esc(c.label)}</b> <span class="muted">LOINC ${esc(c.code)} · ${c.recordCount} record${c.recordCount === 1 ? "" : "s"}${asked ? "" : " · not requested by the app"}</span><br>
          <span class="muted">Stored as ${c.storedAs.map((s) => `<code>${esc(short(s.type))}</code> (${s.records})`).join(", ")}</span><br>
          ${c.units.map((u) => `<span class="badge ${u.availability}" title="${esc(u.type)}">${esc(u.symbol)} · ${u.availability}</span>`).join("")}
        </div>
      </label>`;
    })
    .join("");
  const missing = requested.codes.filter((c) => !data.some((d) => d.code === c));
  return page(
    "Grant access",
    `<h1><b>${esc(p.client_id)}</b> wants to read your health data</h1>
    <p class="muted">From the Solid pod of <b>${esc(pod.name ?? pod.webId)}</b> (<code>${esc(pod.webId)}</code>) ·
      <a href="/smart/authorize?${esc(new URLSearchParams(p).toString())}">use another pod</a><br>
      Data will be sent to <code>${esc(host(p.redirect_uri))}</code>.</p>
    <div class="note">Demo: you are not asked to log in. A real deployment authenticates the pod owner with Solid-OIDC before this screen.</div>
    <form method="post" action="/smart/authorize">
      ${hidden({ ...p, webid: pod.webId })}
      <h2>All data available in this pod</h2>
      <p class="muted">Each item can be served in every unit shown. <span class="badge stored">stored</span> is how it sits in the pod;
      <span class="badge virtual">virtual</span> units are translated on the fly.</p>
      <div class="panel">
        ${items || `<p class="muted">No data in this pod that can be shared through FHIR.</p>`}
        ${
          requested.patientRead
            ? `<label class="item"><input type="checkbox" name="patient" checked><div><b>Basic identity</b><br><span class="muted">Your name and WebID</span></div></label>`
            : ""
        }
      </div>
      ${missing.length ? `<p class="muted">Requested but not in this pod: ${missing.map((m) => `LOINC ${esc(m)}`).join(", ")}</p>` : ""}
      ${
        pod.unknownClasses.length
          ? `<p class="muted">Also registered in this pod, but not shareable here (no FHIR mapping): ${pod.unknownClasses.map((c) => `<code>${esc(c)}</code>`).join(", ")}</p>`
          : ""
      }
      <div class="actions">
        <button type="submit" name="decision" value="approve">Allow selected</button>
        <button type="submit" name="decision" value="deny" class="secondary">Deny</button>
      </div>
    </form>`,
  );
}

/**
 * Demo SMART app: standalone launch with PKCE, then reads the grant and FHIR Observations.
 * The inline script avoids template literals so it can live in this template string.
 */
export const demoAppHtml = page(
  "SMART demo app",
  `<p class="muted" style="margin:0 0 6px"><a href="/">← Walkthrough</a></p>
  <h1>SMART demo app</h1>
  <p class="muted">A third-party app connecting to the pod translation service with SMART on FHIR (standalone launch, PKCE).
  It asks for access, you pick what to share, and it then reads FHIR Observations in the units it prefers.</p>
  <div id="connect" class="panel">
    <label class="block" for="scope">Scopes the app requests</label>
    <select id="scope">
      <option value="launch/patient patient/Patient.rs patient/Observation.rs">All observations + identity</option>
      <option value="launch/patient patient/Observation.rs?code=http://loinc.org|8310-5">Body temperature only</option>
      <option value="launch/patient patient/Observation.rs?code=http://loinc.org|8310-5 patient/Observation.rs?code=http://loinc.org|2339-0">Temperature + glucose</option>
    </select>
    <div class="actions"><button id="go">Connect to a pod</button></div>
  </div>
  <div id="result" hidden>
    <div class="panel"><div id="tokeninfo"></div><div class="actions"><button class="secondary" id="disconnect">Disconnect</button></div></div>
    <h2>Granted data</h2>
    <div id="grant"></div>
    <details class="panel"><summary class="muted">Last FHIR response</summary><pre id="raw"></pre></details>
  </div>
  <div id="error" class="note" hidden></div>`,
  `<script>
var CLIENT_ID = "pod-demo-app";
var REDIRECT = location.origin + "/smart/demo";
var FHIR = location.origin + "/fhir";
var store = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
              set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
              del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} } };

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function b64url(bytes) { var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, ""); }
function random() { var a = new Uint8Array(32); crypto.getRandomValues(a); return b64url(a); }
function showError(msg) { var e = document.getElementById("error"); e.hidden = false; e.textContent = msg; }

document.getElementById("go").addEventListener("click", function () {
  var verifier = random(), state = random();
  crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (hash) {
    store.set("pkce_verifier", verifier); store.set("oauth_state", state);
    var q = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, redirect_uri: REDIRECT, scope: document.getElementById("scope").value,
      state: state, aud: FHIR, code_challenge: b64url(new Uint8Array(hash)), code_challenge_method: "S256" });
    location.href = "/smart/authorize?" + q.toString();
  });
});

document.getElementById("disconnect").addEventListener("click", function () { store.del("token"); location.href = REDIRECT; });

function api(path) {
  var tok = JSON.parse(store.get("token"));
  return fetch(path, { headers: { authorization: "Bearer " + tok.access_token, accept: "application/fhir+json" } }).then(function (r) { return r.json(); });
}

function renderConcept(c, el) {
  var unit = el.querySelector("select").value;
  var q = new URLSearchParams({ patient: JSON.parse(store.get("token")).patient, code: c.system + "|" + c.code });
  if (unit) q.set("unit", unit);
  api("/fhir/Observation?" + q.toString()).then(function (b) {
    document.getElementById("raw").textContent = JSON.stringify(b, null, 2);
    var rows = (b.entry || []).map(function (e) { return e.resource; })
      .sort(function (x, y) { return String(x.effectiveDateTime).localeCompare(String(y.effectiveDateTime)); });
    el.querySelector("tbody").innerHTML = rows.map(function (o) {
      var tag = o.meta.tag[0].code;
      return "<tr><td>" + esc((o.effectiveDateTime || "").slice(0, 16).replace("T", " ")) + "</td>" +
        '<td class="num">' + esc(o.valueQuantity.value) + " " + esc(o.valueQuantity.unit) + "</td>" +
        '<td><span class="badge ' + (tag === "native" ? "stored" : "virtual") + '">' + esc(tag) + "</span></td></tr>";
    }).join("");
  });
}

function loadGrant() {
  var tok = JSON.parse(store.get("token"));
  document.getElementById("connect").hidden = true;
  document.getElementById("result").hidden = false;
  document.getElementById("tokeninfo").innerHTML = "Connected. Granted scope:<br><code>" + esc(tok.scope).split(" ").join("<br>") + "</code>";
  api("/smart/grant").then(function (g) {
    if (g.issue) { showError(g.issue[0].diagnostics); return; }
    var container = document.getElementById("grant");
    if (g.patient && g.patient.name) document.getElementById("tokeninfo").insertAdjacentHTML("afterbegin", "Patient: <b>" + esc(g.patient.name[0].text) + "</b><br>");
    container.innerHTML = g.data.length ? "" : '<p class="muted">Nothing granted.</p>';
    g.data.forEach(function (c) {
      var el = document.createElement("div");
      el.className = "panel";
      el.innerHTML = "<b>" + esc(c.label) + '</b> <span class="muted">LOINC ' + esc(c.code) + "</span>" +
        '<label class="block">Show values in</label><select><option value="">stored unit (as in the pod)</option>' +
        c.units.map(function (u) { return '<option value="' + esc(u.unit) + '">' + esc(u.symbol) + " (" + u.availability + ")</option>"; }).join("") +
        "</select><table><thead><tr><th>When</th><th>Value</th><th></th></tr></thead><tbody></tbody></table>";
      el.querySelector("select").addEventListener("change", function () { renderConcept(c, el); });
      container.appendChild(el);
      renderConcept(c, el);
    });
  });
}

var params = new URLSearchParams(location.search);
if (params.get("error")) {
  showError("Authorization failed: " + params.get("error") + (params.get("error_description") ? " (" + params.get("error_description") + ")" : ""));
} else if (params.get("code")) {
  if (params.get("state") !== store.get("oauth_state")) { showError("State mismatch, start again."); }
  else {
    fetch("/smart/token", { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code: params.get("code"),
      redirect_uri: REDIRECT, client_id: CLIENT_ID, code_verifier: store.get("pkce_verifier") }) })
      .then(function (r) { return r.json(); })
      .then(function (t) {
        if (t.error) { showError(t.error + ": " + t.error_description); return; }
        store.set("token", JSON.stringify(t)); store.del("pkce_verifier"); store.del("oauth_state");
        history.replaceState(null, "", REDIRECT);
        loadGrant();
      });
  }
} else if (store.get("token")) {
  loadGrant();
}
</script>`,
);
