export default defineNuxtPlugin(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8%", threshold: 0.12 }
  );

  const observe = () => {
    document
      .querySelectorAll("[data-reveal]:not(.is-visible)")
      .forEach((node) => observer.observe(node));
  };

  onNuxtReady(observe);
  useRouter().afterEach(() => requestAnimationFrame(observe));
});
