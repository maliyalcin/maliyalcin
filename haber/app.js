(() => {
  const $ = (id) => document.getElementById(id);
  const main = $("main");
  let days = [];
  let pos = 0;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
  const fmtDay = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  async function getJSON(path) {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  function renderItem(it) {
    const hot = it.importance === 3 ? '<span class="hot">● Önemli</span>' : "";
    const tags = (it.tags || []).length ? `<div class="tags">${it.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "";
    return `<li class="item">
      <a class="t" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener">${esc(it.title)}</a>
      <div class="meta">${hot}<span>${esc(it.source)}</span><span>·</span><span>${esc(it.published)}</span></div>
      <p class="sum">${esc(it.summary)}</p>${tags}
    </li>`;
  }

  function render(doc) {
    const cats = doc.categories || [];
    const total = cats.reduce((n, c) => n + (c.items || []).length, 0);
    let html = doc.headline ? `<div class="headline"><span>Günün öne çıkanı</span>${esc(doc.headline)}</div>` : "";
    html += cats
      .map((c) => {
        const n = (c.items || []).length;
        const body = n
          ? `<ul class="items">${c.items.map(renderItem).join("")}</ul>`
          : `<div class="empty">Bu kategoride dün kayda değer bir haber bulunamadı.</div>`;
        return `<details class="cat" ${n ? "open" : ""}>
          <summary><span class="ic">${esc(c.icon)}</span>
            <span class="ct">${esc(c.title)}${c.brief ? `<small>${esc(c.brief)}</small>` : ""}</span>
            <span class="badge ${n ? "has" : ""}">${n}</span><span class="chev">›</span></summary>
          ${body}</details>`;
      })
      .join("");
    const gen = doc.generated_at ? new Date(doc.generated_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }) : "";
    html += `<footer>${total} haber · ${gen ? gen + " itibarıyla hazırlandı" : ""}${doc.verified_by ? " · kontrol: " + esc(doc.verified_by) : ""}</footer>`;
    main.innerHTML = html;
  }

  async function show(i) {
    pos = i;
    $("prev").disabled = pos >= days.length - 1;
    $("next").disabled = pos <= 0;
    const d = days[pos];
    $("day").textContent = fmtDay(d);
    main.innerHTML = '<div class="state">Yükleniyor…</div>';
    try {
      render(await getJSON(`data/${d}.json`));
      window.scrollTo(0, 0);
    } catch {
      main.innerHTML = `<div class="state"><b>Bu gün açılamadı</b>İnternet bağlantınızı kontrol edin.</div>`;
    }
  }

  $("prev").onclick = () => pos < days.length - 1 && show(pos + 1);
  $("next").onclick = () => pos > 0 && show(pos - 1);

  (async () => {
    try {
      days = (await getJSON("data/index.json")).days || [];
    } catch {
      days = [];
    }
    if (!days.length) {
      $("prev").disabled = $("next").disabled = true;
      $("day").textContent = "Henüz bülten yok";
      main.innerHTML = `<div class="state"><b>İlk bülten bu gece hazırlanacak</b>Her gece 00:00'dan sonra hazırlanır, sabah 06:00'da hazırdır.</div>`;
      return;
    }
    show(0);
  })();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
