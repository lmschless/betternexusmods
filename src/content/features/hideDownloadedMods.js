// src/content/features/hideDownloadedMods.js
export const HideDownloadedMods = {
  init() {
    try {
      this.ensureToggleExists();
      this.refreshVisibility();
      
      document.addEventListener('change', (e) => {
        if (e.target.matches('#nmdh-checkbox')) {
          this.refreshVisibility();
        }
      });
    } catch (error) {
      console.error('[Nexus Mods Helper] Error in HideDownloadedMods.init:', error);
    }
  },

  getToolbar() {
    return document.querySelector(".flex.items-center.gap-x-3");
  },

  ensureToggleExists() {
    const toolbar = this.getToolbar();
    if (!toolbar || document.querySelector("#nmdh-toggle")) return;

    const wrapper = document.createElement("label");
    wrapper.id = "nmdh-toggle";
    wrapper.className = "nmdh-label";
    wrapper.innerHTML = `
      <input type="checkbox" id="nmdh-checkbox" checked />
      <span>Hide downloaded mods</span>
    `;

    toolbar.prepend(wrapper);
    
    const checkbox = wrapper.querySelector('#nmdh-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', () => this.refreshVisibility());
    }
  },

  refreshVisibility() {
    const checkbox = document.querySelector("#nmdh-checkbox");
    if (!checkbox) return;
    
    const shouldHide = checkbox.checked;
    document
      .querySelectorAll('[data-e2eid="mod-tile-downloaded"]')
      .forEach(flag => {
        const card = flag.closest('[data-e2eid="mod-tile"], .file-row, li, article');
        if (card) card.classList.toggle("nmdh-hidden", shouldHide);
      });
  }
}