// Walkthrough: six pages, each from one perspective, all numbers live from this service.
(function () {
  "use strict";

  // ------------------------------------------------------------------ roles + layers
  const ROLES = {
    patient: "Alice · patient",
    hospA: "Hospital A",
    hospB: "Hospital B",
    provider: "Pod provider",
    client: "Client app",
    research: "Research standard",
  };
  const LAYERS = [
    { id: "clients", name: "Clients" },
    { id: "interface", name: "Advertised interfaces" },
    { id: "translation", name: "Translation table" },
    { id: "pod", name: "Solid pod" },
  ];

  const PAGES = [
    { id: "overview", tab: "Overview", role: null },
    { id: "pod", tab: "The patient's pod", role: "patient" },
    { id: "hospitals", tab: "Two hospital standards", role: "hospA" },
    { id: "table", tab: "The translation table", role: "provider" },
    { id: "client", tab: "What a client is offered", role: "client" },
    { id: "switch", tab: "Switching hospitals", role: "hospB" },
  ];

  // ------------------------------------------------------------------ helpers
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const chip = (role, text) => `<span class="chip r-${role}">${esc(text ?? ROLES[role])}</span>`;
  const kind = (k) => `<span class="kind ${k}">${k}</span>`;
  const local = (iri) => iri.split("#").pop();
  const PREFIX = { "https://hospital-a.example/vocab#": "ha:", "https://hospital-b.example/vocab#": "hb:", "https://research.example/vocab#": "rx:" };
  const curie = (iri) => {
    for (const ns in PREFIX) if (iri.startsWith(ns)) return PREFIX[ns] + iri.slice(ns.length);
    return iri;
  };
  const ownerOf = (typeId) => (typeId.includes("hospital-a") ? "hospA" : typeId.includes("hospital-b") ? "hospB" : "research");
  const getJson = (path, accept = "application/json") => fetch(path, { headers: { accept } }).then((r) => r.json());
  const when = (rec) => Object.values(rec).find((v) => typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) || "";
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
  const formula = (t) => t.description.split(";")[0];
  const recs = (n) => `${n} record${n === 1 ? "" : "s"}`;

  let D; // live data, loaded once
  const T = (id) => D.types[id];
  const valueOf = (typeId, rec) => `${rec[T(typeId).valueField]} ${T(typeId).symbol}`;

  async function load() {
    const [pods, reg, translations, smart] = await Promise.all([
      getJson("/api/pods"),
      getJson("/api/types"),
      getJson("/api/translations"),
      getJson("/fhir/.well-known/smart-configuration"),
    ]);
    const webId = pods[0].webId;
    const view = await getJson(`/api/view/types?webid=${encodeURIComponent(webId)}`);
    const types = {};
    const concepts = reg.concepts;
    for (const c of concepts) for (const t of c.types) types[t.id] = { ...t, conceptLabel: c.label, conceptCode: c.code };
    return { webId, concepts, types, translations, smart, view, cache: {} };
  }

  const dataView = (type) => {
    const key = `data:${type}`;
    D.cache[key] ??= getJson(`/api/view/data?webid=${encodeURIComponent(D.webId)}&type=${encodeURIComponent(type)}&format=json`);
    return D.cache[key];
  };

  // ------------------------------------------------------------------ page frame
  function ministack(active) {
    return `<div class="ministack" aria-label="Layer">
      <div class="cap">Layer on this page</div>
      ${LAYERS.map((l) => `<div class="lyr${active.includes(l.id) ? " on" : ""}">${esc(l.name)}</div>`).join("")}
    </div>`;
  }

  function head(page, { title, lede, perspective, sees, layers }) {
    const idx = PAGES.findIndex((p) => p.id === page);
    return `<div class="pagehead">
      <div>
        <div class="eyebrow">Page ${idx + 1} of ${PAGES.length} · ${esc(PAGES[idx].tab)}</div>
        <h2>${title}</h2>
        <p class="lede">${lede}</p>
        <div class="facts">
          <div class="fact"><span class="k">Perspective</span><span>${perspective}</span></div>
          <div class="fact"><span class="k">Who sees this</span><span>${sees}</span></div>
        </div>
      </div>
      ${ministack(layers)}
    </div>`;
  }

  function pager(page) {
    const i = PAGES.findIndex((p) => p.id === page);
    const prev = PAGES[i - 1], next = PAGES[i + 1];
    return `<div class="pager">
      ${prev ? `<a href="#${prev.id}"><span>← Previous</span>${esc(prev.tab)}</a>` : ""}
      ${next ? `<a class="next" href="#${next.id}"><span>Next →</span>${esc(next.tab)}</a>` : ""}
    </div>`;
  }

  // ------------------------------------------------------------------ 1. overview
  function overview() {
    return `
    <div class="eyebrow">Page 1 of ${PAGES.length} · Overview</div>
    <h1>Your data, their standards, nothing breaks</h1>
    <p class="lede">A walkthrough of a translation layer that sits on top of Solid pods. Every number on these pages is read live from the running service and its example pod.</p>

    <h3>Three needs</h3>
    <div class="grid3">
      <div class="need"><div class="who">${chip("patient")}</div>
        <q>“I want my own data, in one place I control.”</q>
        <div class="ans">→ Alice keeps her health records in her own Solid pod.</div></div>
      <div class="need"><div class="who">${chip("hospA")}${chip("hospB")}</div>
        <q>“We have our own standard, and systems built on it.”</q>
        <div class="ans">→ Each hospital writes into the pod in its own vocabulary and units.</div></div>
      <div class="need"><div class="who">${chip("patient", "Alice")}${chip("hospA")}${chip("hospB")}</div>
        <q>“We all want Solid, and our systems must keep working when Alice switches hospital.”</q>
        <div class="ans">→ A second layer above the pod translates between standards on read.</div></div>
    </div>

    <h3>The layers</h3>
    <div class="stack">
      <div class="layer"><div class="name">Clients<small>apps, hospital systems</small></div>
        <div class="desc">Ask for data in the one type they understand. ${chip("client")}${chip("hospA", "Hospital A system")}${chip("hospB", "Hospital B system")}</div>
        <a href="#switch">Page 6 →</a></div>
      <div class="flow">ask for a type ↓ · ↑ get every matching record, in that type</div>
      <div class="layer"><div class="name">Advertised interfaces<small>Solid type index · SMART on FHIR</small></div>
        <div class="desc">Tell a client what it can ask for: what is ${kind("stored")} and what can be ${kind("derived")}.</div>
        <a href="#client">Page 5 →</a></div>
      <div class="layer new"><div class="name">Translation table<small>new layer · managed by the provider</small></div>
        <div class="desc">Recipes that build one data type from another of the same meaning. Applied on read, never written back. ${chip("provider")}</div>
        <a href="#table">Page 4 →</a></div>
      <div class="flow">reads exactly what is stored ↓</div>
      <div class="layer"><div class="name">Solid pod<small>owned by Alice</small></div>
        <div class="desc">Exactly what was written, in the writer's standard. ${chip("patient", "owner: Alice")}${chip("hospA", "writer")}${chip("hospB", "writer")}</div>
        <a href="#pod">Page 2 →</a></div>
    </div>

    <h3>Cast</h3>
    <div class="panel legend">
      <div>${chip("patient")}<span>Owns the pod and decides who may read it.</span></div>
      <div>${chip("hospA")}<span>Treated Alice in September. Its standard: °C, mg/dL, kg, <code>ha:</code> vocabulary.</span></div>
      <div>${chip("hospB")}<span>Treats Alice since October. Its standard: °F, mmol/L, lb, <code>hb:</code> vocabulary.</span></div>
      <div>${chip("provider")}<span>Hosts the pod and manages the translation table above it.</span></div>
      <div>${chip("client")}<span>Any app or hospital system that reads through the translation layer, via Solid or SMART on FHIR.</span></div>
      <div>${chip("research")}<span>A third standard (Kelvin) that nobody writes. It only exists as a derived type.</span></div>
    </div>

    <h3>Two kinds of data, everywhere on these pages</h3>
    <div class="grid2">
      <div class="panel"><div class="val stored"><b>38.4 °C</b><small>stored · in the pod as written</small></div>
        <p class="muted" style="margin-top:10px">${kind("stored")} Solid border: a record that exists in the pod in exactly this form.</p></div>
      <div class="panel"><div class="val derived"><b>101.12 °F</b><small>derived · from 38.4 °C</small></div>
        <p class="muted" style="margin-top:10px">${kind("derived")} Dashed border: built on request by a recipe from the translation table. Never stored.</p></div>
    </div>
    ${pager("overview")}`;
  }

  // ------------------------------------------------------------------ 2. pod
  async function pod() {
    const p = D.view.pod;
    const base = p.storage || D.webId.replace(/profile\/card#me$/, "");
    const rel = (u) => u.replace(base, "");
    const files = [
      { url: D.webId.split("#")[0], what: "WebID profile", role: "patient", by: "Alice" },
      ...p.typeIndexes.map((u) => ({ url: u, what: "Type index: says which data types live where", role: "patient", by: "Alice" })),
      ...p.resources.map((r) => ({ url: r.url, what: `${T(r.type).conceptLabel}, ${r.records} record${r.records === 1 ? "" : "s"} as ${curie(r.type)}`, role: ownerOf(r.type), by: ROLES[ownerOf(r.type)], type: r.type })),
    ].sort((a, b) => rel(a.url).localeCompare(rel(b.url)));

    let lastDir = null;
    const tree = files
      .map((f, i) => {
        const path = rel(f.url);
        const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
        const name = path.slice(dir.length);
        const dirRow = dir !== lastDir ? `<li class="dir">📁 ${esc(dir || "/")}</li>` : "";
        lastDir = dir;
        return `${dirRow}<li><button data-i="${i}" aria-pressed="false"><span class="ico">${f.type ? "◆" : "◇"}</span><span class="fname">${esc(name)}</span>${chip(f.role, f.by === "Alice" ? "Alice" : f.by)}</button></li>`;
      })
      .join("");

    // Summary of what is stored, per concept and writer
    const byConcept = {};
    for (const r of p.resources) {
      const types = (byConcept[T(r.type).conceptLabel] ??= {});
      types[r.type] = (types[r.type] || 0) + r.records;
    }
    const summary = Object.entries(byConcept)
      .map(([label, types]) => `<tr><td><b>${esc(label)}</b></td><td>${Object.entries(types).map(([t, n]) => chip(ownerOf(t), `${n} × ${T(t).symbol} · ${ROLES[ownerOf(t)]}`)).join(" ")}</td></tr>`)
      .join("");

    setTimeout(() => {
      const show = async (i) => {
        const f = files[i];
        document.querySelectorAll(".tree button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.i === String(i))));
        $("#viewer").innerHTML = `<div class="viewer-head"><code>${esc(rel(f.url))}</code><span>${f.type ? kind("stored") : ""} written by ${chip(f.role, f.by)}</span></div>
          <p class="muted" style="font-size:13px">${esc(f.what)}</p><pre class="ttl">Loading…</pre>`;
        const txt = await fetch(f.url, { headers: { accept: "text/turtle" } }).then((r) => r.text());
        $("#viewer pre").textContent = txt.trim();
      };
      document.querySelectorAll(".tree button").forEach((b) => b.addEventListener("click", () => show(Number(b.dataset.i))));
      const first = files.findIndex((f) => f.type && f.url.includes("hospital-b") && f.url.includes("temperature"));
      show(first >= 0 ? first : 0);
    });

    return `${head("pod", {
      title: "Alice's data, exactly as it was written",
      lede: "Alice's pod is ordinary Solid: a profile, a type index and data resources. Two hospitals wrote into it, each in its own standard. Nothing on this page is translated.",
      perspective: chip("patient"),
      sees: `${chip("patient", "Alice")} and anyone she grants access. Hospitals write here; the provider hosts the files.`,
      layers: ["pod"],
    })}
    <div class="files">
      <div class="panel" style="padding:6px"><ul class="tree">${tree}</ul></div>
      <div class="panel" id="viewer"></div>
    </div>
    <h3>What is stored</h3>
    <div class="panel scroll"><table>${summary}</table></div>
    <div class="note plain">The same meaning, body temperature, sits in the pod twice: 2 readings as <code>ha:BodyTemperatureCelsius</code> and 2 as <code>hb:BodyTemperatureFahrenheit</code>. Different classes, different predicates, different units.</div>
    ${pager("pod")}`;
  }

  // ------------------------------------------------------------------ 3. hospitals
  function hospitals() {
    const column = (h) => {
      const types = Object.values(D.types).filter((t) => ownerOf(t.id) === h);
      const rows = types
        .map((t) => `<tr><td><b>${esc(t.conceptLabel)}</b><br><code>${esc(curie(t.id))}</code></td><td><b>${esc(t.symbol)}</b></td>
          <td>${Object.values(t.fields).map((f) => `<code>${esc(curie(f.predicate))}</code>`).join("<br>")}</td></tr>`)
        .join("");
      return `<div class="panel rolebar r-${h}">
        <div style="margin-bottom:8px">${chip(h)} <span class="muted">· its own standard</span></div>
        <div class="scroll"><table><tr><th>Concept / class</th><th>Unit</th><th>Predicates</th></tr>${rows}</table></div>
      </div>`;
    };

    // What each hospital's system can see in Alice's pod without a translation layer
    const concepts = {};
    for (const r of D.view.pod.resources) {
      const c = (concepts[T(r.type).conceptLabel] ??= { total: 0, hospA: 0, hospB: 0 });
      c.total += r.records;
      c[ownerOf(r.type)] = (c[ownerOf(r.type)] || 0) + r.records;
    }
    const blind = (h) =>
      Object.entries(concepts)
        .map(([label, c]) => {
          const seen = c[h] || 0;
          const dots = Array.from({ length: c.total }, (_, i) => `<span class="dot ${i < seen ? "seen" : "unseen"}"></span>`).join("");
          return `<div style="margin-bottom:10px"><div style="font-size:13px"><b>${esc(label)}</b> <span class="muted">· sees ${seen} of ${c.total}</span></div><div class="dots r-${h}">${dots}</div></div>`;
        })
        .join("");

    return `${head("hospitals", {
      title: "Each hospital has its own standard",
      lede: "Hospital A and Hospital B describe the same measurements with different classes, predicates and units. Their systems are built on that, and neither will change it.",
      perspective: `${chip("hospA")} and ${chip("hospB")}, side by side`,
      sees: "Each hospital's IT team knows only its own column. Their systems write records into Alice's pod in that format.",
      layers: ["clients", "pod"],
    })}
    <div class="grid2">${column("hospA")}${column("hospB")}</div>

    <h3>Without a translation layer</h3>
    <p class="muted">Each system reading Alice's pod directly only recognises its own classes. Filled squares are readings it can use; dashed ones it can't.</p>
    <div class="grid2">
      <div class="panel rolebar r-hospA"><div style="margin-bottom:10px">${chip("hospA", "Hospital A system")}</div>${blind("hospA")}</div>
      <div class="panel rolebar r-hospB"><div style="margin-bottom:10px">${chip("hospB", "Hospital B system")}</div>${blind("hospB")}</div>
    </div>
    <div class="note plain">Alice owns all her data, but each hospital sees only half of her temperature history. Owning your data is not enough; it also has to be usable.</div>
    ${pager("hospitals")}`;
  }

  // ------------------------------------------------------------------ 4. translation table
  function chainOrder(ids) {
    const adj = Object.fromEntries(ids.map((id) => [id, new Set()]));
    for (const t of D.translations) if (adj[t.from] && adj[t.to]) { adj[t.from].add(t.to); adj[t.to].add(t.from); }
    let start = ids.find((id) => adj[id].size === 1) || ids[0];
    const order = [start];
    while (true) {
      const next = [...adj[order[order.length - 1]]].find((n) => !order.includes(n));
      if (!next) break;
      order.push(next);
    }
    return order.concat(ids.filter((id) => !order.includes(id)));
  }

  function findRecipePath(from, to) {
    const prev = { [from]: null };
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === to) break;
      for (const t of D.translations) if (t.from === cur && !(t.to in prev)) { prev[t.to] = cur; queue.push(t.to); }
    }
    const path = [];
    for (let n = to; n; n = prev[n]) path.unshift(n);
    return path;
  }

  function table() {
    const advertised = Object.fromEntries(D.view.types.map((a) => [a.type, a]));
    const recipe = (from, to) => D.translations.find((t) => t.from === from && t.to === to);

    const cards = D.concepts
      .map((c) => {
        const order = chainOrder(c.types.map((t) => t.id));
        let html = "";
        order.forEach((id, i) => {
          const t = T(id);
          const a = advertised[id];
          const status = a ? kind(a.availability === "stored" ? "stored" : "derived") : `<span class="planned">not in Alice's pod</span>`;
          html += `<div class="node r-${ownerOf(id)}"><div class="sym">${esc(t.symbol)}</div><div class="cls">${esc(curie(id))}</div>${chip(ownerOf(id))}<div style="margin-top:6px">${status}</div></div>`;
          const next = order[i + 1];
          if (next) {
            const fwd = recipe(id, next), back = recipe(next, id);
            html += `<div class="edge">${fwd ? `<div class="rec">→ ${esc(formula(fwd))}</div>` : ""}${back ? `<div class="rec">← ${esc(formula(back))}</div>` : ""}</div>`;
          }
        });
        return `<div class="panel" style="margin-bottom:14px"><div style="margin-bottom:10px"><b>${esc(c.label)}</b> <span class="muted">· LOINC ${esc(c.code)}</span></div><div class="chain">${html}</div></div>`;
      })
      .join("");

    // Dimensions of one recipe: unit and shape
    const a = T("https://hospital-a.example/vocab#BodyTemperatureCelsius");
    const b = T("https://hospital-b.example/vocab#BodyTemperatureFahrenheit");
    const fieldOf = (t, k) => Object.values(t.fields).find((f) => f.kind === k);
    const KIND_LABEL = { iri: "Patient link", dateTime: "Time of measurement", decimal: "Value" };
    const dimRows = ["decimal", "iri", "dateTime"]
      .map((k) => `<tr><td>${KIND_LABEL[k]}${k === "decimal" ? " <b>+ unit</b>" : ""}</td>
        <td><code>${esc(curie(fieldOf(a, k).predicate))}</code>${k === "decimal" ? ` <b>${esc(a.symbol)}</b>` : ""}</td>
        <td class="arrow">→</td>
        <td><code>${esc(curie(fieldOf(b, k).predicate))}</code>${k === "decimal" ? ` <b>${esc(b.symbol)}</b>` : ""}</td>
        <td class="muted" style="font-size:13px">${k === "decimal" ? esc(formula(recipe(a.id, b.id))) : "renamed, value unchanged"}</td></tr>`)
      .join("");

    const chain = findRecipePath("https://hospital-b.example/vocab#BodyTemperatureFahrenheit", "https://research.example/vocab#BodyTemperatureKelvin");

    const all = D.translations
      .map((t) => `<tr><td>${chip(ownerOf(t.from), T(t.from).symbol)}</td><td class="arrow">→</td><td>${chip(ownerOf(t.to), T(t.to).symbol)}</td><td>${esc(T(t.from).conceptLabel)}</td><td style="font-size:13px">${esc(t.description)}</td></tr>`)
      .join("");

    return `${head("table", {
      title: "The translation table: recipes above the pod",
      lede: "The provider keeps a table of recipes. Each recipe builds one data type from another data type with the same meaning. The pod itself is never rewritten.",
      perspective: chip("provider"),
      sees: `${chip("provider")} manages the recipes. Clients never call them directly; they only see the results (page 5).`,
      layers: ["translation"],
    })}
    <h3>Recipes per concept</h3>
    <p class="muted">Each box is a data type. Arrows are recipes. The badge shows whether Alice's pod holds that type (${kind("stored")}) or it can be built on request (${kind("derived")}).</p>
    ${cards}

    <h3>A recipe changes two dimensions</h3>
    <div class="panel scroll">
      <div style="margin-bottom:8px">${chip("hospA", "°C")}<span class="arrow">→</span>${chip("hospB", "°F")} <span class="muted">· one recipe, every part of the record</span></div>
      <table class="dims"><tr><th>Dimension</th><th>Hospital A</th><th></th><th>Hospital B</th><th>Recipe</th></tr>${dimRows}</table>
    </div>
    <div class="grid2" style="margin-top:14px">
      <div class="panel"><b>Unit</b><p class="muted" style="margin:6px 0 0">The value is converted (°C → °F, mg/dL → mmol/L, kg → lb).</p></div>
      <div class="panel"><b>Shape</b><p class="muted" style="margin:6px 0 0">The vocabulary is mapped (<code>ha:patient</code> → <code>hb:subject</code>), so the record looks native to the reader.</p></div>
    </div>

    <h3>Recipes chain</h3>
    <div class="panel">There is no direct recipe from °F to Kelvin. The table finds a route:
      <div style="margin-top:8px">${chain.map((id) => chip(ownerOf(id), T(id).symbol)).join('<span class="arrow">→</span>')}</div>
      <p class="muted" style="margin:8px 0 0">Adding one recipe for a new standard makes it reachable from every type already connected.</p></div>

    <h3>The full table</h3>
    <div class="panel scroll"><table><tr><th>From</th><th></th><th>To</th><th>Concept</th><th>Recipe</th></tr>${all}</table></div>
    <div class="note">Recipes only connect types with the <b>same meaning</b> (the same LOINC concept). The table refuses a recipe from temperature to weight.</div>
    ${pager("table")}`;
  }

  // ------------------------------------------------------------------ 5. client
  function client() {
    const stored = [...new Set(D.view.pod.resources.map((r) => r.type))];
    const counts = (type) => D.view.pod.resources.filter((r) => r.type === type).reduce((n, r) => n + r.records, 0);
    const row = (type, k, note) => `<div class="trow ${k}"><div class="t"><b>${esc(T(type).conceptLabel)}</b> · ${esc(T(type).symbol)}<code>${esc(curie(type))}</code></div><div style="text-align:right">${kind(k)}<div class="muted" style="font-size:11.5px">${esc(note)}</div></div></div>`;

    const plain = stored.map((t) => row(t, "stored", recs(counts(t)))).join("");
    const layer = D.view.types
      .map((a) => row(a.type, a.availability === "stored" ? "stored" : "derived", a.availability === "stored" ? recs(a.recordCount) : `${recs(a.recordCount)}, from ${a.storedAs.map((s) => T(s).symbol).join(" + ")}`))
      .join("");

    const matrix = D.view.types
      .map((a) => {
        const k = a.availability === "stored" ? "stored" : "derived";
        return `<tr><td><b>${esc(T(a.type).conceptLabel)}</b> · ${esc(T(a.type).symbol)}<br><code class="muted">${esc(curie(a.type))}</code></td><td>${kind(k)}</td>
          <td class="yes">✓</td><td class="yes">✓</td><td class="planned">planned</td><td class="planned">planned</td><td class="planned">planned</td>
          <td><code>Observation?code=${esc(T(a.type).conceptCode)}&amp;unit=${esc(T(a.type).unit)}</code></td></tr>`;
      })
      .join("");

    const s = D.smart;
    return `${head("client", {
      title: "A client is told what it can ask for, not only what is stored",
      lede: "A plain Solid client reads the pod's type index and finds what is stored. Through the translation layer, the same pod also advertises everything that can be derived from it.",
      perspective: `${chip("client")}: an app or a hospital system`,
      sees: `Any client, after Alice grants access (via a Solid login or a SMART on FHIR grant). The recipes behind it stay with the ${chip("provider")}.`,
      layers: ["interface", "clients"],
    })}
    <div class="grid2">
      <div class="panel"><div style="margin-bottom:4px"><b>Plain Solid client</b></div><p class="muted" style="font-size:13px">Reads Alice's type index: exactly what is stored.</p>
        <div class="typelist">${plain}</div></div>
      <div class="panel" style="border-color:color-mix(in srgb, var(--provider) 45%, var(--line))"><div style="margin-bottom:4px"><b>Client of the translation layer</b></div><p class="muted" style="font-size:13px">Reads the advertised type index: stored <i>and</i> derivable.</p>
        <div class="typelist">${layer}</div></div>
    </div>

    <h3>Capabilities per data type</h3>
    <div class="panel scroll"><table>
      <tr><th>Data type</th><th>Origin</th><th>Read</th><th>Search</th><th>Create</th><th>Update</th><th>Delete</th><th>FHIR request</th></tr>
      ${matrix}
    </table></div>
    <div class="note">Today the layer is <b>read-only</b>: derived types are as readable as stored ones. Planned for create, update and delete: a write in a derived type is translated by the reverse recipe and stored in the type the pod already uses.</div>

    <h3>How it is advertised</h3>
    <div class="grid2">
      <div class="panel"><b>SMART on FHIR</b>
        <p class="muted" style="font-size:13px;margin:4px 0 8px">From <a href="/fhir/.well-known/smart-configuration"><code>/.well-known/smart-configuration</code></a></p>
        <div class="caps">${s.capabilities.map((c) => `<code>${esc(c)}</code>`).join("")}</div>
        <p style="font-size:13px;margin:10px 0 4px">Scopes, one per concept:</p>
        <div class="caps">${s.scopes_supported.filter((x) => x.includes("code=")).map((c) => `<code>${esc(c)}</code>`).join("")}</div>
        <p style="margin:12px 0 0"><a href="/smart/demo">Try the grant flow in the SMART demo app →</a></p></div>
      <div class="panel"><b>Solid type index</b>
        <p class="muted" style="font-size:13px;margin:4px 0 8px">The translated view publishes its own type index: one <code>solid:TypeRegistration</code> per type, marked <code>tr:Stored</code> or <code>tr:Virtual</code>.</p>
        <a href="/api/view/type-index?webid=${encodeURIComponent(D.webId)}&format=turtle">Open the advertised type index (Turtle) →</a></div>
    </div>
    ${pager("client")}`;
  }

  // ------------------------------------------------------------------ 6. switching
  async function switching() {
    const A = "https://hospital-a.example/vocab#BodyTemperatureCelsius";
    const B = "https://hospital-b.example/vocab#BodyTemperatureFahrenheit";
    const [ra, rb] = await Promise.all([dataView(A), dataView(B)]);
    const byTime = (x, y) => when(x.data).localeCompare(when(y.data));
    const recA = ra.records.slice().sort(byTime);
    const recB = rb.records.slice().sort(byTime);

    // Timeline of what was actually stored, coloured by writer
    // Evenly spaced (readings are a day apart), with an extra slot where the writer changes.
    const slots = [];
    recA.forEach((r, i) => {
      if (i > 0 && ownerOf(r.provenance.storedType) !== ownerOf(recA[i - 1].provenance.storedType)) slots.push({ move: true });
      slots.push({ r });
    });
    const pos = (i) => ((i + 0.5) / slots.length) * 100;
    const events = slots
      .map((s, i) => {
        if (s.move) return `<div class="move" style="left:${pos(i)}%"><span>Alice moves to Hospital B</span></div>`;
        const r = s.r, role = ownerOf(r.provenance.storedType);
        return `<div class="ev r-${role}" style="left:${pos(i)}%"><div class="lbl">${esc(valueOf(r.provenance.storedType, r.provenance.original))}</div><div class="m"></div><div class="d">${fmtDate(when(r.data))}</div></div>`;
      })
      .join("");

    const panel = (role, type, recs) => {
      const rows = recs
        .map((r) => {
          const p = r.provenance;
          const k = p.translated ? "derived" : "stored";
          const sub = p.translated ? `derived from ${valueOf(p.storedType, p.original)} (${ROLES[ownerOf(p.storedType)]})` : `stored by ${ROLES[ownerOf(p.storedType)]}`;
          return `<div class="reading"><span class="muted">${fmtDate(when(r.data))}</span><div class="val ${k}"><b>${esc(valueOf(type, r.data))}</b><small>${esc(sub)}</small></div></div>`;
        })
        .join("");
      return `<div class="panel rolebar r-${role}">
        <div>${chip(role, `${ROLES[role]} system`)} <span class="muted">· unchanged</span></div>
        <p style="font-size:13px;margin:8px 0 0">Asks for <code>${esc(curie(type))}</code> and gets:</p>
        <div class="readings">${rows}</div>
      </div>`;
    };

    return `${head("switch", {
      title: "Alice switches hospital. Both systems keep working.",
      lede: "Alice was treated at Hospital A in September and moved to Hospital B in October. Neither hospital changed its system, and nobody rewrote the pod.",
      perspective: `${chip("hospA", "Hospital A system")} and ${chip("hospB", "Hospital B system")}, both reading through the translation layer`,
      sees: "Each system sees Alice's full history, in its own standard. Alice decides which systems may read.",
      layers: ["clients", "interface", "translation", "pod"],
    })}
    <h3>What actually happened (stored in the pod)</h3>
    <div class="panel"><div class="timeline"><div class="axis"></div>${events}</div></div>

    <h3>What each system receives</h3>
    <div class="grid2">${panel("hospA", A, recA)}${panel("hospB", B, recB)}</div>

    <div class="note">Before: each system saw 2 of Alice's 4 temperatures (page 3). Now: both see all 4, in the format they were built for. Switching hospital costs Alice nothing, and costs the hospitals nothing either.</div>
    <div class="panel"><b>And the next standard?</b>
      <p class="muted" style="margin:6px 0 0">A research system wants Kelvin. Nobody stores Kelvin, yet it is already on offer: the provider added one recipe (°C → K) and every existing record became available as <code>rx:BodyTemperatureKelvin</code>. <a href="/explorer">See it in the pod explorer →</a></p></div>
    ${pager("switch")}`;
  }

  // ------------------------------------------------------------------ router
  const RENDER = { overview, pod, hospitals, table, client, switch: switching };

  function renderTabs(current) {
    $("#tabs").innerHTML = PAGES.map((p, i) => {
      const color = p.role ? `var(--${p.role})` : "var(--muted)";
      return `<a class="tab" href="#${p.id}"${p.id === current ? ' aria-current="page"' : ""}><span class="n" style="background:${color}">${i + 1}</span>${esc(p.tab)}</a>`;
    }).join("");
    $(`.tab[aria-current="page"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }

  async function route() {
    const id = (location.hash || "#overview").slice(1);
    const page = RENDER[id] ? id : "overview";
    renderTabs(page);
    try {
      D ??= await load();
      $("#page").innerHTML = await RENDER[page]();
      document.title = `${PAGES.find((p) => p.id === page).tab} · Pod Translation Service`;
    } catch (e) {
      $("#page").innerHTML = `<div class="note plain">Could not load live data: ${esc(e.message)}</div>`;
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  route();
})();
