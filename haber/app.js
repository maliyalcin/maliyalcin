(() => {
  const $ = (id) => document.getElementById(id);
  const main = $("main");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Basit biçim: **kalın** ve satır içi `kod`
  const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
  const fmtDay = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  async function getJSON(path) {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  // SVG'yi güvenli hale getir: script, foreignObject, olay öznitelikleri ve dış bağlantılar kaldırılır
  function safeSvg(src) {
    try {
      const doc = new DOMParser().parseFromString(src, "image/svg+xml");
      const svg = doc.documentElement;
      if (svg.nodeName.toLowerCase() !== "svg") return "";
      svg.querySelectorAll("script,foreignObject,iframe,image").forEach((n) => n.remove());
      svg.querySelectorAll("*").forEach((n) => {
        [...n.attributes].forEach((a) => {
          if (/^on/i.test(a.name) || (/href$/i.test(a.name) && !a.value.startsWith("#"))) n.removeAttribute(a.name);
        });
      });
      return new XMLSerializer().serializeToString(svg);
    } catch {
      return "";
    }
  }

  // ---------------- Durum ----------------
  const lists = { haber: { days: [], pos: 0, loaded: false }, tasarim: { days: [], pos: 0, loaded: false } };
  let tab = "haber";
  let detail = null; // {date, id}
  let viewer = null;

  async function loadIndex(kind) {
    const L = lists[kind];
    if (L.loaded) return L;
    try {
      L.days = (await getJSON(kind === "haber" ? "data/index.json" : "tasarim/index.json")).days || [];
    } catch {
      L.days = [];
    }
    L.loaded = true;
    return L;
  }

  function setHeader(text, navOn) {
    $("day").textContent = text;
    const L = lists[tab];
    $("prev").disabled = !navOn || L.pos >= L.days.length - 1;
    $("next").disabled = !navOn || L.pos <= 0;
    $("prev").style.visibility = $("next").style.visibility = navOn ? "visible" : "hidden";
  }

  // ---------------- Haberler ----------------
  function renderItem(it) {
    const hot = it.importance === 3 ? '<span class="hot">● Önemli</span>' : "";
    const tags = (it.tags || []).length ? `<div class="tags">${it.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "";
    return `<li class="item">
      <a class="t" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener">${esc(it.title)}</a>
      <div class="meta">${hot}<span>${esc(it.source)}</span><span>·</span><span>${esc(it.published)}</span></div>
      <p class="sum">${esc(it.summary)}</p>${tags}
    </li>`;
  }

  function renderNews(doc) {
    const cats = doc.categories || [];
    const total = cats.reduce((n, c) => n + (c.items || []).length, 0);
    let html = doc.headline ? `<div class="headline"><span>Günün öne çıkanı</span>${esc(doc.headline)}</div>` : "";
    html += cats
      .map((c) => {
        const n = (c.items || []).length;
        const body = n
          ? `<ul class="items">${c.items.map(renderItem).join("")}</ul>`
          : `<div class="empty">Bu kategoride kayda değer yeni bir haber bulunamadı.</div>`;
        return `<details class="cat" ${n ? "open" : ""}>
          <summary><span class="ic">${esc(c.icon)}</span>
            <span class="ct">${esc(c.title)}${c.brief ? `<small>${esc(c.brief)}</small>` : ""}</span>
            <span class="badge ${n ? "has" : ""}">${n}</span><span class="chev">›</span></summary>
          ${body}</details>`;
      })
      .join("");
    const gen = doc.generated_at
      ? new Date(doc.generated_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })
      : "";
    html += `<footer>${total} haber · ${gen ? gen + " itibarıyla hazırlandı" : ""}${doc.verified_by ? " · kontrol: " + esc(doc.verified_by) : ""}</footer>`;
    main.innerHTML = html;
  }

  async function showNews() {
    const L = await loadIndex("haber");
    if (!L.days.length) {
      setHeader("Henüz bülten yok", false);
      main.innerHTML = `<div class="state"><b>İlk bülten bu gece hazırlanacak</b>Her gece 00:00'dan sonra hazırlanır.</div>`;
      return;
    }
    const d = L.days[L.pos];
    setHeader(fmtDay(d), true);
    main.innerHTML = '<div class="state">Yükleniyor…</div>';
    try {
      renderNews(await getJSON(`data/${d}.json`));
    } catch {
      main.innerHTML = `<div class="state"><b>Bu gün açılamadı</b>İnternet bağlantınızı kontrol edin.</div>`;
    }
  }

  // ---------------- Tasarım Analizleri ----------------
  const dayCache = {};
  async function getDesignDay(d) {
    if (!dayCache[d]) dayCache[d] = await getJSON(`tasarim/${d}.json`);
    return dayCache[d];
  }

  async function showDesignList() {
    const L = await loadIndex("tasarim");
    if (!L.days.length) {
      setHeader("Henüz analiz yok", false);
      main.innerHTML = `<div class="state"><b>İlk 5 tasarım bu gece hazırlanacak</b>Her gece 00:00–08:00 arasında yenilenir.</div>`;
      return;
    }
    const d = L.days[L.pos];
    setHeader(fmtDay(d), true);
    main.innerHTML = '<div class="state">Yükleniyor…</div>';
    try {
      const doc = await getDesignDay(d);
      main.innerHTML =
        doc.designs
          .map((x) => {
            const fig = x.figures && x.figures[0] ? safeSvg(x.figures[0].svg) : "";
            return `<a class="dcard" href="#/tasarim/${esc(d)}/${esc(x.id)}">
              <div class="dthumb">${fig || "⚙️"}</div>
              <div class="dinfo"><span class="chip">${esc(x.category)}</span><b>${esc(x.title)}</b><small>${esc(x.summary)}</small></div>
              <span class="chev">›</span></a>`;
          })
          .join("") + `<footer>Günün ${doc.designs.length} tasarımı · kontrol: ${esc(doc.verified_by || "")}</footer>`;
    } catch {
      main.innerHTML = `<div class="state"><b>Bu gün açılamadı</b>İnternet bağlantınızı kontrol edin.</div>`;
    }
  }

  function calcHtml(a) {
    const steps = (a.steps || [])
      .map(
        (s) => `<div class="step"><div class="lb">${fmt(s.label)}</div>
        ${s.formula ? `<code>${esc(s.formula)}</code>` : ""}
        <div class="res">${esc(s.value)} ${esc(s.unit || "")}</div>${s.note ? `<div class="nt">${fmt(s.note)}</div>` : ""}</div>`
      )
      .join("");
    return `<div class="calcblk"><h4>${esc(a.title)}</h4>${steps}${a.comment ? `<div class="cmt">${fmt(a.comment)}</div>` : ""}</div>`;
  }

  function paras(arr) {
    return (Array.isArray(arr) ? arr : [arr]).filter(Boolean).map((p) => `<p>${fmt(p)}</p>`).join("");
  }

  function figHtml(f) {
    const s = safeSvg(f.svg);
    return s ? `<figure><div class="svgw">${s}</div><figcaption>${fmt(f.caption)}</figcaption></figure>` : "";
  }

  function chatPrompt(x, d, q) {
    const json = new URL(`tasarim/${d}.json`, location.href).href;
    const specs = (x.specs || []).slice(0, 10).map((s) => `- ${s.k}: ${s.v}`).join("\n");
    return (
      `Ben makine tasarımcısıyım (Inventor/AutoCAD). Tasarım Analizleri uygulamamdaki "${x.title}" tasarımı hakkında soruyorum.\n\n` +
      `Tasarım özeti: ${x.chat_context || x.summary}\n\nAna parametreler:\n${specs}\n\n` +
      `Tam analiz (JSON, "${x.id}" kaydı): ${json}\n\nSorum: ${q}`
    );
  }

  const QUICK = [
    "Yük 2 katına çıkarsa motor ve redüktör seçimi nasıl değişir?",
    "Bu mekanizmayı Inventor'da nasıl modellerim, hangi kısıtları kullanmalıyım?",
    "Daha ucuz / daha hassas alternatif tahrik ne olurdu?",
    "Hesaplardaki emniyet katsayılarını açıklar mısın?",
  ];

  async function showDesign(d, id) {
    setHeader(fmtDay(d), false);
    main.innerHTML = '<div class="state">Yükleniyor…</div>';
    let x;
    try {
      x = (await getDesignDay(d)).designs.find((e) => e.id === id);
    } catch {}
    if (!x) {
      main.innerHTML = `<div class="state"><b>Tasarım bulunamadı</b><a href="#/tasarim">Listeye dön</a></div>`;
      return;
    }
    const figs = x.figures || [];
    const legend = ((x.model3d && x.model3d.parts) || [])
      .filter((p) => p.label)
      .map((p) => `<span><i style="background:${esc(p.color || "#999")}"></i>${esc(p.label)}</span>`)
      .join("");
    const pastKey = "sorular:" + d + ":" + id;
    let past = [];
    try { past = JSON.parse(localStorage.getItem(pastKey) || "[]"); } catch {}

    main.innerHTML = `
      <a class="back" href="#/tasarim">‹ Günün tasarımları</a>
      <div class="dhead"><span class="chip">${esc(x.category)}</span><h2>${esc(x.title)}</h2><p>${fmt(x.summary)}</p></div>
      ${x.model3d ? `<div class="v3d" id="v3d"><div class="msg">3B model yükleniyor…</div></div>${legend ? `<div class="legend">${legend}</div>` : ""}` : ""}
      <section class="box"><h3>⚙️ Çalışma prensibi</h3>${paras(x.principle)}${figs.slice(0, 1).map(figHtml).join("")}</section>
      ${(x.components || []).length ? `<section class="box"><h3>🔩 Bileşenler</h3><ul class="comp">${x.components.map((c) => `<li><b>${esc(c.name)}</b> — ${fmt(c.role)}</li>`).join("")}</ul></section>` : ""}
      ${(x.specs || []).length ? `<section class="box"><h3>📋 Tasarım parametreleri</h3><table class="kv">${x.specs.map((s) => `<tr><td>${esc(s.k)}</td><td>${esc(s.v)}</td></tr>`).join("")}</table></section>` : ""}
      <section class="box"><h3>📐 Mühendislik analizi</h3>${(x.analysis || []).map(calcHtml).join("")}${figs.slice(1).map(figHtml).join("")}</section>
      <section class="box pros"><h3>✅ Avantajlar</h3><ul class="pc">${(x.advantages || []).map((a) => `<li>${fmt(a)}</li>`).join("")}</ul></section>
      <section class="box cons"><h3>⚠️ Dezavantajlar</h3><ul class="pc">${(x.disadvantages || []).map((a) => `<li>${fmt(a)}</li>`).join("")}</ul></section>
      ${x.example ? `<section class="box"><h3>🏭 Örnek uygulama</h3>${paras(x.example)}</section>` : ""}
      ${(x.design_tips || []).length ? `<section class="box"><h3>💡 Tasarım ve imalat ipuçları</h3><ul class="pc">${x.design_tips.map((a) => `<li>${fmt(a)}</li>`).join("")}</ul></section>` : ""}
      <section class="box chat"><h3>💬 Bu tasarım hakkında Claude'a sor</h3>
        <p style="font-size:13.5px;color:var(--muted)">Sorunuz bu tasarımın özeti ve tam analiz bağlantısıyla birlikte Claude'a gider; tasarımı yeniden anlatmanıza gerek yok.</p>
        <div class="qs">${QUICK.map((q, i) => `<button data-q="${i}">${esc(q)}</button>`).join("")}</div>
        <textarea id="q" placeholder="Örn: Bu sistemde vidalı mil yerine kayış kullansam ivmelenme nasıl değişir?"></textarea>
        <button class="send" id="send">Claude'a sor ↗</button>
        ${past.length ? `<div class="past">Önceki sorularınız: ${past.slice(-5).reverse().map((p) => `<div>• ${esc(p)}</div>`).join("")}</div>` : ""}
      </section>`;
    window.scrollTo(0, 0);

    main.querySelectorAll(".qs button").forEach((b) => (b.onclick = () => { $("q").value = QUICK[+b.dataset.q]; $("q").focus(); }));
    $("send").onclick = () => {
      const q = $("q").value.trim();
      if (!q) { $("q").focus(); return; }
      try { past.push(q); localStorage.setItem(pastKey, JSON.stringify(past.slice(-20))); } catch {}
      window.open("https://claude.ai/new?q=" + encodeURIComponent(chatPrompt(x, d, q)), "_blank", "noopener");
    };

    if (x.model3d) {
      try {
        await loadScript("viewer3d.js");
        if (detail && detail.id === id) viewer = await window.Viewer3D.mount($("v3d"), x.model3d);
      } catch {
        const el = $("v3d");
        if (el) el.innerHTML = '<div class="msg">3B model yüklenemedi (internet bağlantısı gerekli).</div>';
      }
    }
  }

  const loaded = {};
  function loadScript(src) {
    if (!loaded[src])
      loaded[src] = new Promise((ok, no) => {
        const s = document.createElement("script");
        s.src = src; s.onload = ok; s.onerror = no;
        document.head.appendChild(s);
      });
    return loaded[src];
  }

  // ---------------- Yönlendirme ----------------
  async function route() {
    if (viewer) { viewer.dispose(); viewer = null; }
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    tab = parts[0] === "tasarim" ? "tasarim" : "haber";
    $("t-haber").classList.toggle("on", tab === "haber");
    $("t-tasarim").classList.toggle("on", tab === "tasarim");
    try { localStorage.setItem("sonSekme", tab); } catch {}
    if (tab === "tasarim" && parts[1] && parts[2]) {
      detail = { date: parts[1], id: parts[2] };
      await showDesign(parts[1], parts[2]);
    } else {
      detail = null;
      tab === "tasarim" ? await showDesignList() : await showNews();
      window.scrollTo(0, 0);
    }
  }

  function step(dir) {
    const L = lists[tab];
    const n = L.pos + dir;
    if (n < 0 || n >= L.days.length) return;
    L.pos = n;
    route();
  }
  $("prev").onclick = () => step(1);
  $("next").onclick = () => step(-1);
  window.addEventListener("hashchange", route);

  if (!location.hash) {
    let last = "haber";
    try { last = localStorage.getItem("sonSekme") || "haber"; } catch {}
    history.replaceState(null, "", "#/" + last);
  }
  route();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
