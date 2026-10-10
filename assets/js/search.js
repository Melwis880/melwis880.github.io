// Site araması (Pagefind JS API, hazır arayüz kullanılmıyor).
// - Üst kısım: büyüteç (ya da "/" veya Ctrl+K) menüyü arama kutusuna çevirir, sonuçlar
//   yazdıkça altta açılır. Ok tuşları sonuçlarda gezer, Enter açar, Esc kapatır.
// - /search/ sayfası: aynı motor, ?q= ile gelen sorguyu tam liste olarak gösterir.
// Pagefind dizini CI'da build'den sonra üretilir; yerelde yoksa kısa bir not gösterilir.
// Metinler #site-search üzerindeki data-strings (JSON) alanından gelir.
(function () {
  var box = document.getElementById("site-search");
  if (!box) return;

  var S = JSON.parse(box.dataset.strings || "{}");
  var searchPage = box.dataset.searchPage;
  var loading = null;

  function loadPagefind() {
    if (!loading) {
      loading = import(box.dataset.pagefind).then(function (pf) {
        return Promise.resolve(pf.init && pf.init()).then(function () { return pf; });
      });
      loading.catch(function () { loading = null; });
    }
    return loading;
  }

  // Sorguyu çalıştırır; daha yeni bir sorgu geldiyse null döner.
  async function search(q) {
    var pf = await loadPagefind();
    return pf.debouncedSearch(q, {}, 150);
  }

  function fill(text, value) { return (text || "").replace("%s", value); }

  function statusLine(text) {
    var p = document.createElement("p");
    p.className = "search-status";
    p.textContent = text;
    return p;
  }

  function hit(data, tag) {
    var a = document.createElement("a");
    a.className = "search-hit";
    a.href = data.url;
    a.setAttribute("role", "option");
    var meta = document.createElement("span");
    meta.className = "search-hit-meta";
    meta.textContent = [data.meta.type, data.meta.date].filter(Boolean).join(" · ");
    var title = document.createElement("span");
    title.className = "search-hit-title";
    title.textContent = data.meta.title || data.url;
    var excerpt = document.createElement("span");
    excerpt.className = "search-hit-excerpt";
    excerpt.innerHTML = data.excerpt; // Pagefind'in kaçışlı alıntısı; sadece <mark> etiketi içerir
    a.append(meta, title, excerpt);
    if (!tag) return a;
    var li = document.createElement(tag);
    li.appendChild(a);
    return li;
  }

  function countText(n) { return fill(n === 1 ? S.countOne : S.countOther, n); }

  /* ---------- Üst kısımdaki açılır arama ---------- */
  var header = box.closest(".site-header");
  var toggle = header.querySelector(".search-toggle");
  var form = box.querySelector("form");
  var input = box.querySelector("input");
  var panel = box.querySelector(".search-panel");
  var hits = [];
  var active = -1;

  function setActive(i) {
    hits.forEach(function (h, j) {
      h.classList.toggle("active", i === j);
      h.setAttribute("aria-selected", i === j ? "true" : "false");
    });
    active = i;
    if (hits[i]) hits[i].scrollIntoView({ block: "nearest" });
  }

  function open() {
    header.classList.add("is-searching");
    box.hidden = false;
    input.focus();
    loadPagefind().catch(function () {});
  }

  function close() {
    header.classList.remove("is-searching");
    box.hidden = true;
    panel.hidden = true;
    input.value = "";
    input.setAttribute("aria-expanded", "false");
    if (toggle) toggle.focus();
  }

  async function update() {
    var q = input.value.trim();
    hits = [];
    active = -1;
    if (!q) { panel.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    var res;
    try {
      res = await search(q);
    } catch (e) {
      panel.replaceChildren(statusLine(S.unavailable));
      return;
    }
    if (res === null || input.value.trim() !== q) return;
    var data = await Promise.all(res.results.slice(0, 6).map(function (r) { return r.data(); }));
    if (input.value.trim() !== q) return;
    if (!res.results.length) {
      panel.replaceChildren(statusLine(fill(S.none, q)));
      return;
    }
    hits = data.map(function (d) { return hit(d); });
    var all = document.createElement("a");
    all.className = "search-all";
    all.href = searchPage + "?q=" + encodeURIComponent(q);
    all.textContent = countText(res.results.length) + " · " + S.all + " →";
    panel.replaceChildren.apply(panel, hits.concat([all]));
  }

  if (toggle) {
    toggle.addEventListener("click", function (e) { e.preventDefault(); open(); });
  }
  box.querySelector(".search-close").addEventListener("click", close);
  input.addEventListener("input", update);
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!hits.length) return;
      var next = active + (e.key === "ArrowDown" ? 1 : -1);
      setActive((next + hits.length) % hits.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      hits[active].click();
    }
  });
  form.addEventListener("submit", function (e) {
    if (!input.value.trim()) e.preventDefault();
  });

  document.addEventListener("keydown", function (e) {
    var el = document.activeElement;
    var typing = el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      var pageInput = document.querySelector("#search-page input");
      if (pageInput) pageInput.focus(); else open();
    } else if (e.key === "Escape" && !box.hidden) {
      close();
    }
  });
  document.addEventListener("click", function (e) {
    if (!box.hidden && !header.contains(e.target)) close();
  });

  /* ---------- /search/ sayfası ---------- */
  var page = document.getElementById("search-page");
  if (!page) return;
  var pInput = page.querySelector("input");
  var pStatus = page.querySelector(".search-status");
  var pList = page.querySelector(".search-results");
  var more = page.querySelector(".load-more");
  var current = [];
  var shown = 0;

  async function showMore() {
    var batch = current.slice(shown, shown + 10);
    var data = await Promise.all(batch.map(function (r) { return r.data(); }));
    data.forEach(function (d) { pList.appendChild(hit(d, "li")); });
    shown += batch.length;
    more.hidden = shown >= current.length;
  }

  async function pageUpdate() {
    var q = pInput.value.trim();
    var url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
    history.replaceState(null, "", url);
    pList.replaceChildren();
    more.hidden = true;
    current = [];
    shown = 0;
    if (!q) { pStatus.textContent = ""; return; }
    var res;
    try {
      res = await search(q);
    } catch (e) {
      pStatus.textContent = S.unavailable;
      return;
    }
    if (res === null || pInput.value.trim() !== q) return;
    current = res.results;
    pStatus.textContent = current.length ? countText(current.length) : fill(S.none, q);
    if (current.length) await showMore();
  }

  page.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); pageUpdate(); });
  pInput.addEventListener("input", pageUpdate);
  more.addEventListener("click", showMore);
  var initial = new URLSearchParams(window.location.search).get("q");
  if (initial) { pInput.value = initial; pageUpdate(); }
})();
