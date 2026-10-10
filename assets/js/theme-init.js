// Sayfa çizilmeden önce temayı ayarlar (beyaz yanıp sönmeyi önlemek için <head> içinde,
// defer olmadan yüklenir). Ziyaretçi seçim yaptıysa o, yoksa varsayılan koyu tema.
(function () {
  var theme = "dark";
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") theme = saved;
  } catch (e) { /* gizli pencere ya da kapalı depolama: varsayılanla devam */ }
  document.documentElement.setAttribute("data-theme", theme);
})();
