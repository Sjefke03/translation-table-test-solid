// Single-page test interface. The inner script deliberately avoids template literals
// so the whole page can live in one TypeScript template string.
export const uiHtml = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pod Translation Service</title>
<style>
  :root { --bg:#f7f7f5; --panel:#fff; --text:#1d1d1b; --muted:#6b6b66; --line:#e3e2dd; --accent:#2f6f5e; --virtual:#8a5a00; --virtual-bg:#fff4dc; --stored-bg:#e3f2ec; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161615; --panel:#1f1f1d; --text:#ecebe6; --muted:#9a9993; --line:#33332f; --accent:#7cc4ad; --virtual:#f0c36a; --virtual-bg:#3a2f17; --stored-bg:#1c3a31; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, sans-serif; }
  main { max-width:960px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:16px; margin:28px 0 8px; }
  p.lead { color:var(--muted); margin:0 0 20px; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; overflow-x:auto; }
  label { font-size:13px; color:var(--muted); display:block; margin-bottom:4px; }
  select { font:inherit; padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:var(--panel); color:var(--text); max-width:100%; }
  .controls { display:flex; gap:16px; flex-wrap:wrap; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
  tr.clickable { cursor:pointer; } tr.clickable:hover { background:var(--bg); } tr.selected { outline:2px solid var(--accent); outline-offset:-2px; }
  .badge { display:inline-block; font-size:12px; padding:1px 8px; border-radius:999px; }
  .stored { background:var(--stored-bg); color:var(--accent); } .virtual { background:var(--virtual-bg); color:var(--virtual); }
  .num { font-variant-numeric:tabular-nums; font-weight:600; }
  .muted { color:var(--muted); font-size:13px; }
  code { font-size:12px; }
  pre { margin:0; font-size:12px; white-space:pre-wrap; word-break:break-all; }
  details { margin-top:12px; }
</style>
</head>
<body>
<main>
  <h1>Pod Translation Service</h1>
  <p class="lead">Test case: Alice's pod holds body temperatures from Hospital A (°C) and Hospital B (°F).
  The service advertises every type it can serve, stored or translated, and an app reads them all in the one type it understands.</p>

  <div class="controls">
    <div><label for="pod">Pod</label><select id="pod"></select></div>
    <div><label for="type">App requests type</label><select id="type"></select></div>
  </div>

  <h2>Advertised types</h2>
  <div class="panel"><table id="advertised"></table></div>

  <h2>Records served to the app</h2>
  <div class="panel">
    <table id="records"></table>
    <details><summary class="muted">Raw API response</summary><pre id="raw"></pre></details>
  </div>
</main>
<script>
var DEFAULT_TYPE = "https://hospital-b.example/vocab#BodyTemperatureFahrenheit";
var types = {};
var podSel = document.getElementById("pod");
var typeSel = document.getElementById("type");

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function short(iri) { return iri.split("#").pop(); }
function getJson(path) { return fetch(path).then(function (r) { return r.json(); }); }

function valueOf(typeId, record) {
  var t = types[typeId];
  return t ? record[t.valueField] + " " + t.symbol : JSON.stringify(record);
}

function loadPod() {
  return getJson("/api/pods/" + podSel.value + "/types").then(function (adv) {
    var current = typeSel.value || DEFAULT_TYPE;
    typeSel.innerHTML = adv.map(function (a) {
      return '<option value="' + esc(a.type) + '">' + esc(a.label) + (a.availability === "virtual" ? " (virtual)" : "") + "</option>";
    }).join("");
    if (adv.some(function (a) { return a.type === current; })) typeSel.value = current;
    var table = document.getElementById("advertised");
    table.innerHTML = "<tr><th>Type</th><th>Concept</th><th>Unit</th><th>Availability</th><th>Stored as</th><th>Records</th></tr>" +
      adv.map(function (a) {
        return '<tr class="clickable" data-type="' + esc(a.type) + '"><td>' + esc(a.label) + '<br><code class="muted">' + esc(short(a.type)) + "</code></td>" +
          "<td>" + esc(a.concept) + "</td><td>" + esc(a.unit) + "</td>" +
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
  return getJson("/api/pods/" + podSel.value + "/data?type=" + encodeURIComponent(typeSel.value)).then(function (res) {
    document.getElementById("raw").textContent = JSON.stringify(res, null, 2);
    document.getElementById("records").innerHTML = "<tr><th>Served value</th><th>Stored value</th><th>Source resource</th><th>Translation</th></tr>" +
      res.records.map(function (r) {
        var p = r.provenance;
        var steps = p.path.length
          ? p.path.map(function (s) { return esc(short(s.from)) + " → " + esc(short(s.to)) + '<br><span class="muted">' + esc(s.description) + "</span>"; }).join("<br>")
          : '<span class="badge stored">native</span>';
        return '<tr><td class="num">' + esc(valueOf(typeSel.value, r.data)) + "</td>" +
          "<td>" + esc(valueOf(p.storedType, p.original)) + "</td>" +
          "<td><code>" + esc(p.resource) + "</code></td><td>" + steps + "</td></tr>";
      }).join("");
  });
}

Promise.all([getJson("/api/types"), getJson("/api/pods")]).then(function (res) {
  res[0].concepts.forEach(function (c) { c.types.forEach(function (t) { types[t.id] = t; }); });
  podSel.innerHTML = res[1].map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.label) + "</option>"; }).join("");
  podSel.addEventListener("change", loadPod);
  typeSel.addEventListener("change", loadData);
  return loadPod();
});
</script>
</body>
</html>`;
