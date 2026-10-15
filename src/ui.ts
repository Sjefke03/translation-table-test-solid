// Single-page test interface. The inner script deliberately avoids template literals
// so the whole page can live in one TypeScript template string.
export const uiHtml = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pod Translation Service</title>
<style>
  :root { --bg:#f7f7f5; --panel:#fff; --text:#1d1d1b; --muted:#6b6b66; --line:#e3e2dd; --accent:#2f6f5e; --virtual:#8a5a00; --virtual-bg:#fff4dc; --stored-bg:#e3f2ec; --warn:#a33; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161615; --panel:#1f1f1d; --text:#ecebe6; --muted:#9a9993; --line:#33332f; --accent:#7cc4ad; --virtual:#f0c36a; --virtual-bg:#3a2f17; --stored-bg:#1c3a31; --warn:#f08a8a; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, sans-serif; }
  main { max-width:980px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:16px; margin:28px 0 8px; }
  p.lead { color:var(--muted); margin:0 0 20px; }
  a { color:var(--accent); }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; overflow-x:auto; }
  label { font-size:13px; color:var(--muted); display:block; margin-bottom:4px; }
  select, input { font:inherit; padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:var(--panel); color:var(--text); max-width:100%; }
  input { width:100%; }
  button { font:inherit; padding:6px 14px; border-radius:6px; border:1px solid var(--accent); background:var(--accent); color:var(--panel); cursor:pointer; }
  .controls { display:grid; grid-template-columns: minmax(0,1fr) auto; gap:12px 16px; align-items:end; }
  .controls .wide { grid-column: 1 / -1; }
  .pod-meta { font-size:13px; color:var(--muted); margin-top:8px; }
  .pod-meta code { color:var(--text); }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
  tr.clickable { cursor:pointer; } tr.clickable:hover { background:var(--bg); } tr.selected { outline:2px solid var(--accent); outline-offset:-2px; }
  .badge { display:inline-block; font-size:12px; padding:1px 8px; border-radius:999px; }
  .stored { background:var(--stored-bg); color:var(--accent); } .virtual { background:var(--virtual-bg); color:var(--virtual); }
  .num { font-variant-numeric:tabular-nums; font-weight:600; }
  .muted { color:var(--muted); font-size:13px; }
  .warn { color:var(--warn); font-size:13px; }
  code { font-size:12px; }
  pre { margin:0; font-size:12px; white-space:pre-wrap; word-break:break-all; }
  .links { font-size:13px; margin:0 0 10px; display:flex; gap:14px; flex-wrap:wrap; }
  details { margin-top:12px; }
  @media (max-width:600px) { .controls { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
  <h1>Pod Translation Service</h1>
  <p class="lead">Test case: Alice's Solid pod holds body temperatures written by Hospital A (<code>ha:BodyTemperatureCelsius</code>, °C)
  and Hospital B (<code>hb:BodyTemperatureFahrenheit</code>, °F). The service reads her WebID profile and type index,
  advertises every class it can serve (stored or translated), and serves all readings as the one class an app understands.</p>

  <div class="panel controls">
    <div class="wide"><label for="preset">Example pod</label><select id="preset"></select></div>
    <div><label for="webid">WebID</label><input id="webid" spellcheck="false"></div>
    <div><button id="load">Read pod</button></div>
    <div class="wide"><label for="type">App requests class</label><select id="type"></select></div>
  </div>
  <div class="pod-meta" id="podmeta"></div>

  <h2>Advertised types</h2>
  <div class="links" id="indexlinks"></div>
  <div class="panel"><table id="advertised"></table></div>

  <h2>Records served to the app</h2>
  <div class="links" id="datalinks"></div>
  <div class="panel">
    <table id="records"></table>
    <details><summary class="muted">Turtle served to the app</summary><pre id="ttl"></pre></details>
  </div>
</main>
<script>
var DEFAULT_TYPE = "https://hospital-b.example/vocab#BodyTemperatureFahrenheit";
var types = {};
var presetSel = document.getElementById("preset");
var webidIn = document.getElementById("webid");
var typeSel = document.getElementById("type");

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function short(iri) { return iri.split("#").pop(); }
function rel(url) { return url.indexOf(location.origin) === 0 ? url.slice(location.origin.length) : url; }
function getJson(path) { return fetch(path, { headers: { accept: "application/json" } }).then(function (r) { return r.json(); }); }
function viewUrl(kind, extra) {
  var q = new URLSearchParams({ webid: webidIn.value });
  Object.keys(extra || {}).forEach(function (k) { q.set(k, extra[k]); });
  return "/api/view/" + kind + "?" + q.toString();
}
function link(href, text) { return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(text) + "</a>"; }

function valueOf(typeId, record) {
  var t = types[typeId];
  return t ? record[t.valueField] + " " + t.symbol : JSON.stringify(record);
}

function loadPod() {
  document.getElementById("podmeta").textContent = "Reading pod…";
  return getJson(viewUrl("types")).then(function (res) {
    if (res.error) { document.getElementById("podmeta").innerHTML = '<span class="warn">' + esc(res.error) + "</span>"; return; }
    var pod = res.pod, adv = res.types;
    var webIdDoc = webidIn.value.split("#")[0];
    document.getElementById("podmeta").innerHTML =
      "Owner <b>" + esc(pod.name || "?") + "</b> · " + link(webIdDoc, "WebID profile") +
      pod.typeIndexes.map(function (t) { return " · " + link(t, "type index"); }).join("") +
      " · " + pod.resources.length + " registered resources" +
      (pod.unknownClasses.length ? " · " + pod.unknownClasses.length + " classes without translations" : "") +
      pod.warnings.map(function (w) { return '<div class="warn">' + esc(w) + "</div>"; }).join("");
    document.getElementById("indexlinks").innerHTML =
      "Type index of the translated view: " + link(viewUrl("type-index", { format: "turtle" }), "Turtle") + link(viewUrl("type-index", { format: "jsonld" }), "JSON-LD");

    var current = typeSel.value || DEFAULT_TYPE;
    typeSel.innerHTML = adv.map(function (a) {
      return '<option value="' + esc(a.type) + '">' + esc(a.label) + (a.availability === "virtual" ? " (virtual)" : "") + "</option>";
    }).join("");
    if (adv.some(function (a) { return a.type === current; })) typeSel.value = current;
    var table = document.getElementById("advertised");
    table.innerHTML = "<tr><th>Class</th><th>Concept</th><th>Unit</th><th>Availability</th><th>Stored as</th><th>Records</th></tr>" +
      adv.map(function (a) {
        return '<tr class="clickable" data-type="' + esc(a.type) + '"><td>' + esc(a.label) + '<br><code class="muted">' + esc(short(a.type)) + "</code></td>" +
          "<td>" + link(a.concept, "LOINC " + a.concept.split("/").filter(Boolean).pop()) + "</td><td>" + esc(a.unit) + "</td>" +
          '<td><span class="badge ' + a.availability + '">' + a.availability + "</span></td>" +
          "<td>" + a.storedAs.map(function (s) { return "<code>" + esc(short(s)) + "</code>"; }).join("<br>") + "</td>" +
          '<td class="num">' + a.recordCount + "</td></tr>";
      }).join("");
    Array.prototype.forEach.call(table.querySelectorAll("tr.clickable"), function (row) {
      row.addEventListener("click", function () { typeSel.value = row.getAttribute("data-type"); loadData(); });
    });
    return loadData();
  });
}

function loadData() {
  Array.prototype.forEach.call(document.querySelectorAll("#advertised tr.clickable"), function (row) {
    row.classList.toggle("selected", row.getAttribute("data-type") === typeSel.value);
  });
  if (!typeSel.value) { document.getElementById("records").innerHTML = ""; return; }
  var t = { type: typeSel.value };
  document.getElementById("datalinks").innerHTML = "Served as: " +
    link(viewUrl("data", Object.assign({ format: "turtle" }, t)), "Turtle") +
    link(viewUrl("data", Object.assign({ format: "jsonld" }, t)), "JSON-LD") +
    link(viewUrl("data", Object.assign({ format: "json" }, t)), "JSON + provenance");
  fetch(viewUrl("data", t), { headers: { accept: "text/turtle" } }).then(function (r) { return r.text(); })
    .then(function (txt) { document.getElementById("ttl").textContent = txt; });
  return getJson(viewUrl("data", t)).then(function (res) {
    var when = function (r) { return Object.values(r.data).filter(function (v) { return /^\d{4}-\d\d-\d\dT/.test(v); })[0] || ""; };
    var rows = res.records.slice().sort(function (a, b) { return when(a).localeCompare(when(b)); });
    document.getElementById("records").innerHTML = "<tr><th>Served value</th><th>Stored in pod</th><th>Translation</th></tr>" +
      rows.map(function (r) {
        var p = r.provenance;
        var steps = p.path.length
          ? p.path.map(function (s) { return esc(short(s.from)) + " → " + esc(short(s.to)) + '<br><span class="muted">' + esc(s.description) + "</span>"; }).join("<br>")
          : '<span class="badge stored">native</span>';
        return '<tr><td class="num">' + esc(valueOf(typeSel.value, r.data)) + "</td>" +
          "<td>" + esc(valueOf(p.storedType, p.original)) + '<br><span class="muted">' + link(p.resource, rel(p.source)) + "</span></td>" +
          "<td>" + steps + "</td></tr>";
      }).join("");
  });
}

Promise.all([getJson("/api/types"), getJson("/api/pods")]).then(function (res) {
  res[0].concepts.forEach(function (c) { c.types.forEach(function (t) { types[t.id] = t; }); });
  presetSel.innerHTML = res[1].map(function (p) { return '<option value="' + esc(p.webId) + '">' + esc(p.label) + "</option>"; }).join("") +
    '<option value="">Other pod (enter a WebID)</option>';
  webidIn.value = presetSel.value;
  presetSel.addEventListener("change", function () { if (presetSel.value) { webidIn.value = presetSel.value; loadPod(); } else { webidIn.focus(); } });
  document.getElementById("load").addEventListener("click", loadPod);
  typeSel.addEventListener("change", loadData);
  return loadPod();
});
</script>
</body>
</html>`;
