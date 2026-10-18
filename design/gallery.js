/* Розкладає кожен <template class="v"> у рамки: телефон 390 px і десктоп 1280 px (зменшено вдвічі), світла й темна.
   Атрибути шаблону: data-id (A/B/C…), data-title, data-desc, data-frames ("pl pd dl dd", типово всі чотири). */
const CAPS = { pl: ["phone", "light", "телефон 390 · світла"], pd: ["phone", "dark", "телефон 390 · темна"],
               dl: ["desktop", "light", "десктоп 1280 · світла"], dd: ["desktop", "dark", "десктоп 1280 · темна"] };
for (const t of document.querySelectorAll("template.v")) {
  const v = document.createElement("section");
  v.className = "g-var";
  v.id = "v-" + (t.dataset.sec || "") + t.dataset.id;
  v.innerHTML = `<h3>Варіант ${t.dataset.id}${t.dataset.title ? " — " + t.dataset.title : ""}</h3><p class="g-note">${t.dataset.desc || ""}</p><div class="g-frames"></div>`;
  const box = v.querySelector(".g-frames");
  for (const key of (t.dataset.frames || "pl pd dl dd").split(" ")) {
    const [kind, theme, cap] = CAPS[key];
    const w = document.createElement("div");
    w.innerHTML = `<p class="g-cap">${cap}</p>`;
    const fr = document.createElement("div");
    fr.className = `fr ${kind}`;
    fr.dataset.theme = theme;
    fr.appendChild(t.content.cloneNode(true));
    // зменшений десктоп займає половину ширини: обгортка фіксує розмір, щоб flex не ламався
    w.appendChild(fr);
    box.appendChild(w);
  }
  t.replaceWith(v);
}
