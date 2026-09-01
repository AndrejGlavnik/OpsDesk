const root = document.documentElement;
const key = "andrejglavnik-theme-v3";
const toggle = document.querySelector("[data-theme-toggle]");
const meta = document.querySelector('meta[name="theme-color"]');

const readTheme = () => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const applyTheme = (theme, persist = false) => {
  root.dataset.theme = theme;
  const dark = theme === "dark";
  toggle?.setAttribute("aria-pressed", String(dark));
  toggle?.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  meta?.setAttribute("content", dark ? "#080b10" : "#f2f5f7");
  if (persist) { try { localStorage.setItem(key, theme); } catch {} }
};

applyTheme(readTheme() || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"));
toggle?.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true));

document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

const reveal = [...document.querySelectorAll(".reveal")];
if (matchMedia("(prefers-reduced-motion:reduce)").matches || !("IntersectionObserver" in window)) {
  reveal.forEach((el) => el.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
  }), { rootMargin: "0px 0px -6%", threshold: .06 });
  reveal.forEach((el) => observer.observe(el));
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("active")));
  button.addEventListener("click", () => {
    const value = button.dataset.filter;
    const group = button.closest(".filter-group");
    group?.querySelectorAll("button").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-status]").forEach((row) => {
      row.hidden = value !== "all" && row.dataset.status !== value;
    });
  });
});
