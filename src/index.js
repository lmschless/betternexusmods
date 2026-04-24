(function(window){
  const betterNexusMods = {};
  window.betterNexusMods = betterNexusMods;

  const FILTER_OFF = 'off';
  const FILTER_HIDE = 'hide';
  const FILTER_SHOW = 'show';

  let currentOptions = {
    downloadedModsFilter: FILTER_HIDE,
    hideDownloadedMods: true // legacy compatibility
  };

  // Gracefully handle storage access in case the extension context is gone
  function safeStorageGet(defaults, cb) {
    try {
      chrome.storage.sync.get(defaults, items => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('chrome.storage get error:', chrome.runtime.lastError);
          cb(defaults);
        } else {
          cb(items);
        }
      });
    } catch (err) {
      console.error('chrome.storage get exception:', err);
      cb(defaults);
    }
  }

  function safeStorageSet(data) {
    try {
      chrome.storage.sync.set(data, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('chrome.storage set error:', chrome.runtime.lastError);
        }
      });
    } catch (err) {
      console.error('chrome.storage set exception:', err);
    }
  }

  function safeAddStorageListener(listener) {
    try {
      chrome.storage.onChanged.addListener(listener);
    } catch (err) {
      console.error('chrome.storage.onChanged exception:', err);
    }
  }

  function normalizeOptions(items = {}) {
    let downloadedModsFilter = items.downloadedModsFilter;

    // Migrate old boolean setting if the new one is not present
    if (!downloadedModsFilter) {
      if (typeof items.hideDownloadedMods === 'boolean') {
        downloadedModsFilter = items.hideDownloadedMods ? FILTER_HIDE : FILTER_OFF;
      } else {
        downloadedModsFilter = FILTER_HIDE;
      }
    }

    if (![FILTER_OFF, FILTER_HIDE, FILTER_SHOW].includes(downloadedModsFilter)) {
      downloadedModsFilter = FILTER_HIDE;
    }

    return {
      ...items,
      downloadedModsFilter,
      hideDownloadedMods: downloadedModsFilter === FILTER_HIDE // legacy compatibility
    };
  }

  // === helpers ================================================================
  function getToolbar() {
    // first toolbar row with left/right buttons
    return document.querySelector(".flex.items-center.gap-x-3");
  }

  function getFilterDropdown() {
    return document.querySelector("#nmdh-filter");
  }

  function getUpdatedOnlyCheckbox() {
    return document.querySelector("#nmdh-updated-only");
  }

  function ensureToggleExists(options) {
    const toolbar = getToolbar();
    if (!toolbar) return; // toolbar not yet in DOM

    const existingToggle = document.querySelector("#nmdh-toggle");
    const existingUpdatedToggle = document.querySelector("#nmdh-updated-toggle");

    if (window.location.href.includes('search')) {
      if (existingToggle) {
        existingToggle.remove();
      }
      if (existingUpdatedToggle) {
        existingUpdatedToggle.remove();
      }
      return; // Do not add toggle on search pages
    }

    if (!existingUpdatedToggle) {
      const updatedWrapper = document.createElement("label");
      updatedWrapper.id = "nmdh-updated-toggle";
      updatedWrapper.className = "nmdh-label"; // styled in CSS
      updatedWrapper.innerHTML = `
        <span>Updated</span>
        <input id="nmdh-updated-only" type="checkbox" aria-label="Only show mods with updates available">
      `;

      // Put it to the left of the downloaded mods control
      toolbar.prepend(updatedWrapper);
    }

    if (!existingToggle) {
      const wrapper = document.createElement("div");
      wrapper.id = "nmdh-toggle";
      wrapper.className = "nmdh-label"; // styled in CSS
      wrapper.innerHTML = `
        <span>Downloaded mods</span>
        <select id="nmdh-filter">
          <option value="${FILTER_OFF}">Off</option>
          <option value="${FILTER_HIDE}">Hide</option>
          <option value="${FILTER_SHOW}">Only</option>
        </select>
      `;

      // put it at the very left
      if (document.querySelector("#nmdh-updated-toggle")) {
        document.querySelector("#nmdh-updated-toggle").after(wrapper);
      } else {
        toolbar.prepend(wrapper);
      }
    }

    const dropdown = getFilterDropdown();
    const updatedOnlyCheckbox = getUpdatedOnlyCheckbox();
    if (!dropdown) return;

    dropdown.value = (options && options.downloadedModsFilter) || FILTER_HIDE;

    if (!dropdown.dataset.nmdhBound) {
      dropdown.addEventListener("change", refreshVisibility);
      dropdown.dataset.nmdhBound = "true";
    }

    if (updatedOnlyCheckbox && !updatedOnlyCheckbox.dataset.nmdhBound) {
      updatedOnlyCheckbox.addEventListener("change", refreshVisibility);
      updatedOnlyCheckbox.dataset.nmdhBound = "true";
    }
  }

  function getModCards() {
    const cards = new Set();

    // Primary mod tile selector
    document.querySelectorAll('[data-e2eid="mod-tile"]').forEach(card => {
      cards.add(card);
    });

    // Also include cards discoverable from the downloaded marker
    document
      .querySelectorAll('[data-e2eid="mod-tile-downloaded"]')
      .forEach(flag => {
        const card = flag.closest('[data-e2eid="mod-tile"], .file-row, li, article');
        if (card) {
          cards.add(card);
        }
      });

    // Also include cards discoverable from the update-available marker
    document
      .querySelectorAll('[data-e2eid="mod-tile-update-available"]')
      .forEach(flag => {
        const card = flag.closest('[data-e2eid="mod-tile"], .file-row, li, article');
        if (card) {
          cards.add(card);
        }
      });

    return Array.from(cards);
  }

  function isDownloadedCard(card) {
    return !!card.querySelector('[data-e2eid="mod-tile-downloaded"]');
  }

  function isUpdatedCard(card) {
    return !!card.querySelector('[data-e2eid="mod-tile-update-available"]');
  }

  function refreshVisibility() {
    let filterMode = FILTER_OFF;
    const dropdown = getFilterDropdown();
    const updatedOnlyCheckbox = getUpdatedOnlyCheckbox();
    const onlyUpdated = !window.location.href.includes('search') && !!updatedOnlyCheckbox?.checked;

    if (window.location.href.includes('search')) {
      filterMode = FILTER_OFF; // Force mods to be visible on search pages
    } else {
      filterMode = dropdown?.value ?? currentOptions.downloadedModsFilter ?? FILTER_HIDE;
    }

    getModCards().forEach(card => {
      const downloaded = isDownloadedCard(card);
      const updated = isUpdatedCard(card);
      let shouldHide = false;

      if (filterMode === FILTER_HIDE) {
        shouldHide = downloaded;
      } else if (filterMode === FILTER_SHOW) {
        shouldHide = !downloaded;
      }

      if (onlyUpdated && !updated) {
        shouldHide = true;
      }

      card.classList.toggle("nmdh-hidden", shouldHide);
    });

    // Save user choice only when it actually changes to avoid hitting write limits
    if (dropdown && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const newValue = dropdown.value;
      if (currentOptions.downloadedModsFilter !== newValue) {
        currentOptions.downloadedModsFilter = newValue;
        currentOptions.hideDownloadedMods = newValue === FILTER_HIDE; // legacy compatibility

        safeStorageSet({
          downloadedModsFilter: newValue,
          hideDownloadedMods: newValue === FILTER_HIDE // keep old key in sync for compatibility
        });
      }
    }
  }

  // === boot ===================================================================
  function init() {
    // Get user options from chrome.storage, then run logic
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      safeStorageGet(
        {
          downloadedModsFilter: FILTER_HIDE,
          hideDownloadedMods: true // legacy fallback
        },
        function(items) {
          betterNexusMods.options = currentOptions = normalizeOptions(items);
          ensureToggleExists(currentOptions);
          refreshVisibility();
        }
      );
    } else {
      ensureToggleExists(currentOptions);
      refreshVisibility();
    }
  }

  // initial run
  init();

  // Listen for changes from popup or options page
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    safeAddStorageListener(function(changes, namespace) {
      if (namespace === 'sync') {
        if (changes.downloadedModsFilter || changes.hideDownloadedMods) {
          const updatedItems = {
            ...currentOptions
          };

          if (changes.downloadedModsFilter) {
            updatedItems.downloadedModsFilter = changes.downloadedModsFilter.newValue;
          }

          // Legacy compatibility if some other part of the extension still writes the old boolean
          if (changes.hideDownloadedMods && !changes.downloadedModsFilter) {
            updatedItems.hideDownloadedMods = changes.hideDownloadedMods.newValue;
          }

          currentOptions = normalizeOptions(updatedItems);

          const dropdown = getFilterDropdown();
          if (dropdown) {
            dropdown.value = currentOptions.downloadedModsFilter;
          }

          refreshVisibility();
        }
      }
    });
  }

  // watch for SPA navigations / toolbar creation
  const container = document.querySelector("main") || document.body;
  const obs = new MutationObserver(init);
  if (container) obs.observe(container, { childList: true, subtree: true });
})(window);
