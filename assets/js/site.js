// Sitenin tek etkileşim dosyası: tema düğmesi, kod bloklarında Kopyala butonu,
// geniş ekranda İçindekiler'in açık gelmesi. Metinler <html> üzerindeki data-* alanlarından
// gelir, böylece iki dilde de aynı dosya çalışır.
(function () {
  var root = document.documentElement;

  // Tema düğmesi
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* kaydedilemezse sadece bu sayfada geçerli */ }
    });
  }

  // Kod bloklarına Kopyala butonu
  var copyLabel = root.dataset.copy || "Copy";
  var copiedLabel = root.dataset.copied || "Copied";
  document.querySelectorAll(".prose pre").forEach(function (pre) {
    var host = pre.closest(".highlight") || pre;
    if (host.querySelector(".copy-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = copyLabel;
    btn.addEventListener("click", function () {
      var code = pre.querySelector("code") || pre;
      var text = code.innerText.replace(/\n$/, "");
      var done = function () {
        btn.textContent = copiedLabel;
        btn.classList.add("done");
        setTimeout(function () { btn.textContent = copyLabel; btn.classList.remove("done"); }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done);
      } else {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "absolute";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* kopyalanamadı */ }
        document.body.removeChild(area);
      }
    });
    if (host === pre) {
      var wrap = document.createElement("div");
      wrap.className = "highlight";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      host = wrap;
    }
    host.appendChild(btn);
  });

  // İçindekiler: geniş ekranda açık, okunan başlık vurgulanır
  var toc = document.querySelector(".toc");
  if (toc && window.matchMedia("(min-width: 75rem)").matches) {
    toc.open = true;
    var links = Array.prototype.slice.call(toc.querySelectorAll("a[href^='#']"));
    var targets = links.map(function (a) {
      return document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
    });
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var i = targets.indexOf(entry.target);
          links.forEach(function (a, j) { a.classList.toggle("active", i === j); });
        });
      }, { rootMargin: "0px 0px -70% 0px" });
      targets.forEach(function (t) { if (t) observer.observe(t); });
    }
  }
})();
