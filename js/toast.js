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
    if (type === "success") return "+";
    if (type === "error") return "!";
    if (type === "warn") return "!";
    return "i";
  }

  window.showToast = function showToast(message, type = "info", title = "", timeoutMs = 2600) {
    const host = ensureHost();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon = document.createElement("div");
    icon.className = "ico";
    icon.textContent = iconFor(type);

    const text = document.createElement("div");
    text.className = "txt";

    if (title) {
      const titleNode = document.createElement("div");
      titleNode.className = "title";
      titleNode.textContent = title;
      text.appendChild(titleNode);
    }

    const body = document.createElement("div");
    body.textContent = String(message || "");
    text.appendChild(body);

    const closeBtn = document.createElement("button");
    closeBtn.className = "close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Fermer");
    closeBtn.textContent = "x";
    closeBtn.addEventListener("click", () => toast.remove());

    toast.append(icon, text, closeBtn);
    host.appendChild(toast);

    if (timeoutMs > 0) {
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, timeoutMs);
    }
  };
})();
