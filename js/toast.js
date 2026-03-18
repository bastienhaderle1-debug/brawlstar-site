// js/toast.js
(function () {
  function ensureHost() {
    let host = document.querySelector(".toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "toasts";
      document.body.appendChild(host);
    }
    return host;
  }

  function iconFor(type) {
    if (type === "success") return "✓";
    if (type === "error") return "!";
    if (type === "warn") return "⚠";
    return "i";
  }

  window.showToast = function showToast(message, type = "info", title = "", timeoutMs = 2600) {
    const host = ensureHost();

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    toast.innerHTML = `
      <div class="ico">${iconFor(type)}</div>
      <div class="txt">
        ${title ? `<div class="title">${title}</div>` : ""}
        <div>${String(message || "")}</div>
      </div>
      <button class="close" type="button" aria-label="Fermer">×</button>
    `;

    const closeBtn = toast.querySelector(".close");
    closeBtn.addEventListener("click", () => toast.remove());

    host.appendChild(toast);

    if (timeoutMs > 0) {
      setTimeout(() => {
        // évite erreur si déjà fermé
        if (toast && toast.parentNode) toast.remove();
      }, timeoutMs);
    }
  };
})();
