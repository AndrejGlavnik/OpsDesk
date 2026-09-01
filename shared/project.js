(function () {
  const themeKey = "ag-project-theme-v1";
  const root = document.documentElement;

  const safeStorage = {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Storage can be unavailable in strict privacy modes. */
      }
    }
  };

  const download = (filename, content, type = "text/plain;charset=utf-8") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const result = document.execCommand("copy");
      textarea.remove();
      return result;
    }
  };

  const uid = (prefix = "item") => {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  let toastTimer;
  const toast = (message) => {
    let target = document.querySelector("[data-toast]");
    if (!target) {
      target = document.createElement("div");
      target.className = "toast";
      target.dataset.toast = "";
      target.setAttribute("role", "status");
      document.body.appendChild(target);
    }
    target.textContent = message;
    target.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => target.classList.remove("show"), 2400);
  };

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    document.querySelectorAll("[data-theme-button]").forEach((button) => {
      const darkMode = theme === "dark";
      button.setAttribute("aria-checked", String(darkMode));
      button.setAttribute("aria-label", "Dark mode");
      button.setAttribute("title", `Switch to ${darkMode ? "light" : "dark"} mode`);
    });
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", theme === "dark" ? "#0b0d12" : "#f4f6f8");
  };

  const storedTheme = safeStorage.get(themeKey, null);
  const preferredTheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(storedTheme || preferredTheme);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-button]");
    if (!button) return;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    safeStorage.set(themeKey, next);
  });

  document.querySelectorAll("[data-year]").forEach((target) => {
    target.textContent = new Date().getFullYear();
  });

  globalThis.OpsTools = { storage: safeStorage, download, copy, uid, escapeHtml, toast };
})();
