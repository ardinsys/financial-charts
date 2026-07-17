<script setup lang="ts">
const { copy } = useSiteLocale();
const colorMode = useColorMode();
const menuOpen = ref(false);
let lastThemeToggle = 0;

function toggleTheme() {
  const now = performance.now();
  if (now - lastThemeToggle < 1000) return;
  lastThemeToggle = now;

  const theme = colorMode.value === "dark" ? "light" : "dark";
  colorMode.preference = theme;
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(theme);
  localStorage.setItem("ardin-charts-color-mode", theme);
}
</script>

<template>
  <header class="site-header">
    <div class="shell nav-shell">
      <a class="brand" href="/" aria-label="ARDINSYS Charts home">
        <ArdinsysLogo />
        <span class="brand-divider" />
        <span class="product-name">Charts<span>.</span></span>
      </a>

      <nav
        :class="['site-nav', { 'is-open': menuOpen }]"
        aria-label="Main navigation"
      >
        <a href="/#examples" @click="menuOpen = false">{{
          copy.nav.examples
        }}</a>
        <a href="/#engine" @click="menuOpen = false">{{ copy.nav.engine }}</a>
        <a href="/#frameworks" @click="menuOpen = false">{{
          copy.nav.frameworks
        }}</a>
        <a
          href="https://docs.ardinsys.eu/financial-charts/guide/quick-start.html"
          >{{ copy.nav.docs }}</a
        >
      </nav>

      <div class="nav-actions">
        <button
          class="icon-button theme-button"
          type="button"
          aria-label="Toggle color theme"
          @click="toggleTheme"
        >
          <svg
            class="theme-icon theme-sun"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
            />
          </svg>
          <svg
            class="theme-icon theme-moon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
          </svg>
        </button>
        <a
          class="button button-small button-primary desktop-github"
          href="https://github.com/ardinsys/financial-charts"
          >{{ copy.nav.github }}</a
        >
        <button
          :class="['menu-button', { 'is-open': menuOpen }]"
          type="button"
          :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span /><span />
        </button>
      </div>
    </div>
  </header>
</template>
