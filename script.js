const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const partsSearch = document.querySelector("#parts-search");
const partsStats = document.querySelector("#parts-stats");
const elcatsTree = document.querySelector("#elcats-tree");
const partsResults = document.querySelector("#parts-results");

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const normalizeSearch = (value) => String(value ?? "").trim().toLowerCase();

const diagramMatches = (diagram, query) => {
  if (!query) {
    return true;
  }

  const haystack = [
    diagram.groupTitleUk,
    diagram.groupTitle,
    diagram.sectionUk,
    diagram.section,
    diagram.titleUk,
    diagram.title,
    diagram.diagId,
    ...(diagram.parts ?? []).flatMap((part) => [
      part.partNumber,
      part.nameUk,
      part.nameEn,
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
};

const renderElcatsTree = (items, query) => {
  if (!elcatsTree) {
    return;
  }

  const grouped = new Map();
  for (const item of items) {
    const title = `${item.parentUk} ${item.titleUk} ${item.id}`.toLowerCase();
    if (query && !title.includes(query)) {
      continue;
    }
    const parent = item.parentUk || "Без групи";
    if (!grouped.has(parent)) {
      grouped.set(parent, []);
    }
    grouped.get(parent).push(item);
  }

  elcatsTree.innerHTML = Array.from(grouped.entries())
    .map(([parent, children]) => `
      <details class="catalog-group" open>
        <summary>${escapeHtml(parent)} <span>${children.length}</span></summary>
        <ul>
          ${children
            .map((item) => `
              <li>
                <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
                  <strong>${escapeHtml(item.titleUk)}</strong>
                  <span>${escapeHtml(item.id)}</span>
                </a>
              </li>
            `)
            .join("")}
        </ul>
      </details>
    `)
    .join("");
};

const renderDiagrams = (diagrams, query, coverageText) => {
  if (!partsResults) {
    return;
  }

  const matched = diagrams.filter((diagram) => diagramMatches(diagram, query));
  const prioritized = [
    ...matched.filter((diagram) => (diagram.parts ?? []).length > 0),
    ...matched.filter((diagram) => (diagram.parts ?? []).length === 0),
  ].slice(0, 80);

  partsResults.innerHTML = prioritized
    .map((diagram) => {
      const parts = (diagram.parts ?? []).slice(0, 14);
      const badge = parts.length > 0
        ? `<span class="status done">${parts.length} OEM-рядків</span>`
        : `<span class="status warning">Очікує дозбору</span>`;
      return `
        <article class="diagram-card">
          <div class="diagram-media">
            ${diagram.imageLarge ? `<img src="${escapeHtml(diagram.imageLarge)}" alt="${escapeHtml(diagram.titleUk)}">` : ""}
          </div>
          <div class="diagram-body">
            <div class="diagram-heading">
              <span>${escapeHtml(diagram.groupTitleUk)} · ${escapeHtml(diagram.diagId)}</span>
              ${badge}
            </div>
            <h3>${escapeHtml(diagram.titleUk)}</h3>
            <a class="source-link" href="${escapeHtml(diagram.url)}" target="_blank" rel="noreferrer">Відкрити джерело</a>
            ${parts.length > 0 ? `
              <div class="part-table-wrap">
                <table class="part-table">
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Назва</th>
                      <th>OEM-код</th>
                      <th>К-сть</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${parts
                      .map((part) => `
                        <tr>
                          <td>${escapeHtml(part.no)}</td>
                          <td>${escapeHtml(part.nameUk)}</td>
                          <td><code>${escapeHtml(part.partNumber)}</code></td>
                          <td>${escapeHtml(part.qty)}</td>
                        </tr>
                      `)
                      .join("")}
                  </tbody>
                </table>
              </div>
            ` : `
              <p class="catalog-muted">Схема є в дереві, але таблиця деталей ще не витягнута через тимчасовий ліміт доступу до джерела.</p>
            `}
          </div>
        </article>
      `;
    })
    .join("");

  if (partsStats) {
    partsStats.textContent =
      `${coverageText} · показано ${prioritized.length} з ${matched.length} схем за поточним фільтром`;
  }
};

const initPartsCatalog = async () => {
  if (!partsResults || !elcatsTree || !partsStats) {
    return;
  }

  try {
    const response = await fetch("data/parts-catalog.json");
    const catalog = await response.json();
    const coverage = catalog.metadata.coverage;
    const coverageText =
      `Elcats: ${coverage.elcatsSections} розділів · RealOEM: ${coverage.realOemFetchedDiagrams}/${coverage.realOemDiagrams} схем із таблицями · ${coverage.realOemPartsRows} OEM-рядків`;
    partsStats.textContent = coverageText;

    const render = () => {
      const query = normalizeSearch(partsSearch?.value);
      renderElcatsTree(catalog.elcatsTree, query);
      renderDiagrams(catalog.realOemDiagrams, query, coverageText);
    };

    partsSearch?.addEventListener("input", render);
    render();
  } catch (error) {
    partsStats.textContent = "Не вдалося завантажити каталог запчастин";
    partsResults.innerHTML = `<p class="catalog-muted">${escapeHtml(error.message)}</p>`;
  }
};

initPartsCatalog();
