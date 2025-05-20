// === helpers ================================================================
function getToolbar() {
  // first toolbar row with left/right buttons
  return document.querySelector(".flex.items-center.gap-x-3");
}

function ensureToggleExists() {
  const toolbar = getToolbar();
  if (!toolbar) return; // toolbar not yet in DOM

  if (document.querySelector("#nmdh-toggle")) return; // already added

  // -------------------------------------------------------------------------
  // build the checkbox+label
  const wrapper = document.createElement("label");
  wrapper.id = "nmdh-toggle";
  wrapper.className = "nmdh-label"; // styled in CSS
  wrapper.innerHTML = `
    <input type="checkbox" id="nmdh-checkbox" checked />
    <span>Hide downloaded mods</span>
  `;

  // put it at the very left
  toolbar.prepend(wrapper);

  // hook behaviour
  wrapper.firstElementChild.addEventListener("change", refreshVisibility);
}

function refreshVisibility() {
  const shouldHide =
    document.querySelector("#nmdh-checkbox")?.checked ?? true;

  document
    .querySelectorAll('[data-e2eid="mod-tile-downloaded"]')
    .forEach(flag => {
      const card =
        flag.closest('[data-e2eid="mod-tile"], .file-row, li, article');
      if (card) card.classList.toggle("nmdh-hidden", shouldHide);
    });
}

// === boot ===================================================================
function init() {
  ensureToggleExists();
  refreshVisibility();
}

// initial run
init();

// watch for SPA navigations / infinite scroll / toolbar creation
const obs = new MutationObserver(init);
obs.observe(document.documentElement, { childList: true, subtree: true });