(function(window){
  const betterNexusMods = {};
  window.betterNexusMods = betterNexusMods;

  const FILTER_OFF = 'off';
  const FILTER_HIDE = 'hide';
  const FILTER_SHOW = 'show';

  let currentOptions = {
    downloadedModsFilter: FILTER_HIDE,
    hideDownloadedMods: true, // legacy compatibility
    hoverChangelogs: true
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
      hideDownloadedMods: downloadedModsFilter === FILTER_HIDE, // legacy compatibility
      hoverChangelogs: items.hoverChangelogs !== false
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

  function ensureToggleExists(options) {
    const toolbar = getToolbar();
    if (!toolbar) return; // toolbar not yet in DOM

    const existingToggle = document.querySelector("#nmdh-toggle");

    if (window.location.href.includes('search')) {
      if (existingToggle) {
        existingToggle.remove();
      }
      return; // Do not add toggle on search pages
    }

    if (!existingToggle) {
      const wrapper = document.createElement("label");
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
      toolbar.prepend(wrapper);
    }

    const dropdown = getFilterDropdown();
    if (!dropdown) return;

    dropdown.value = (options && options.downloadedModsFilter) || FILTER_HIDE;

    if (!dropdown.dataset.nmdhBound) {
      dropdown.addEventListener("change", refreshVisibility);
      dropdown.dataset.nmdhBound = "true";
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

    return Array.from(cards);
  }

  function isDownloadedCard(card) {
    return !!card.querySelector('[data-e2eid="mod-tile-downloaded"]');
  }

  function refreshVisibility() {
    let filterMode = FILTER_OFF;
    const dropdown = getFilterDropdown();

    if (window.location.href.includes('search')) {
      filterMode = FILTER_OFF; // Force mods to be visible on search pages
    } else {
      filterMode = dropdown?.value ?? currentOptions.downloadedModsFilter ?? FILTER_HIDE;
    }

    getModCards().forEach(card => {
      const downloaded = isDownloadedCard(card);
      let shouldHide = false;

      if (filterMode === FILTER_HIDE) {
        shouldHide = downloaded;
      } else if (filterMode === FILTER_SHOW) {
        shouldHide = !downloaded;
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

  // === Changelog functionality ==============================================
  const CHANGELOG_CACHE_PREFIX = 'nmdh_changelog_';
  const CACHE_EXPIRY_DAYS = 7; // Cache changelogs for 7 days
  let isFetching = new Map(); // Track in-flight requests by URL

  // Get a unique key for localStorage
  function getCacheKey(url) {
    return CHANGELOG_CACHE_PREFIX + btoa(url).replace(/[^a-z0-9]/gi, '');
  }

  // Save to localStorage with expiry
  function saveToCache(url, data) {
    try {
      const cacheData = {
        data,
        expiry: Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      };
      localStorage.setItem(getCacheKey(url), JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to save to cache:', e);
    }
  }

  // Get from localStorage, returns null if expired or not found
  function getFromCache(url) {
    try {
      const cached = localStorage.getItem(getCacheKey(url));
      if (!cached) return null;

      const { data, expiry } = JSON.parse(cached);
      if (Date.now() > expiry) {
        localStorage.removeItem(getCacheKey(url)); // Clean up expired
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  async function fetchModChangelog(modUrl) {
    // Check cache first
    const cached = getFromCache(modUrl);
    if (cached) return cached;

    // Check if already fetching this URL
    if (isFetching.has(modUrl)) {
      return isFetching.get(modUrl);
    }

    // Create a promise that will resolve when the fetch is complete
    const fetchPromise = (async () => {
      try {
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

        const response = await fetch(modUrl, {
          credentials: 'same-origin',
          headers: {
            'Accept': 'text/html',
            'Cache-Control': 'max-age=3600' // Respect cache headers
          }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find the changelog section
        let changelogSection = null;
        const allDtElements = doc.querySelectorAll('dt');

        for (const dt of allDtElements) {
          if (dt.textContent.includes('Changelog')) {
            changelogSection = dt;
            break;
          }
        }

        if (!changelogSection) return 'No changelog section found';

        // The content is in the next dd element
        const changelogContent = changelogSection.nextElementSibling;
        if (!changelogContent || !changelogContent.matches('dd')) {
          return 'Could not parse changelog';
        }

        // Extract version entries
        const versionEntries = [];
        const listItems = changelogContent.querySelectorAll('li');

        listItems.forEach((li, index) => {
          const version = li.querySelector('h3')?.textContent.trim() || `Version ${index + 1}`;
          const changes = [];

          // Get all list items (both direct and nested)
          const changeItems = li.querySelectorAll('ul.arrowlist li, ul > li');
          changeItems.forEach(item => {
            changes.push(`• ${item.textContent.trim()}`);
          });

          if (changes.length > 0) {
            versionEntries.push(`${version}\n${changes.join('\n')}`);
          }
        });

        // Get the latest 2 versions
        const result = versionEntries.slice(0, 2).join('\n\n') || 'No changelog entries found';

        // Save to cache
        saveToCache(modUrl, result);
        return result;

      } catch (error) {
        console.error('Error fetching changelog:', error);
        return 'Failed to load changelog';
      } finally {
        // Clean up the fetch promise
        isFetching.delete(modUrl);
      }
    })();

    // Store the promise in our map
    isFetching.set(modUrl, fetchPromise);
    return fetchPromise;
  }

  function setupChangelogHover(options) {
    // If disabled, do nothing
    if (options && options.hoverChangelogs === false) return;
    const modElements = document.querySelectorAll('[data-e2eid="mod-tile"]');

    modElements.forEach(modElement => {
      if (modElement.hasAttribute('data-changelog-initialized')) return;
      modElement.setAttribute('data-changelog-initialized', 'true');

      const tooltip = document.createElement('div');
      tooltip.className = 'changelog-tooltip';
      tooltip.style.display = 'none';
      tooltip.style.maxWidth = '400px';
      tooltip.style.whiteSpace = 'pre-line';
      tooltip.style.padding = '10px';
      tooltip.style.backgroundColor = '#2d2d2d';
      tooltip.style.border = '1px solid #444';
      tooltip.style.borderRadius = '4px';
      tooltip.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
      tooltip.style.zIndex = '9999';
      tooltip.style.position = 'absolute';

      document.body.appendChild(tooltip);

      let hoverTimeout;
      let isHovering = false;

      const showTooltip = async () => {
        if (!currentOptions.hoverChangelogs) {
          hideTooltip();
          return;
        }
        if (isHovering) return;
        isHovering = true;

        const rect = modElement.getBoundingClientRect();
        tooltip.style.top = `${rect.top + window.scrollY}px`;
        tooltip.style.left = `${rect.right + 10 + window.scrollX}px`;
        tooltip.textContent = 'Loading changelog...';
        tooltip.style.display = 'block';

        const modLink = modElement.querySelector('a[href^="https://www.nexusmods.com/"]');
        if (modLink?.href) {
          try {
            const changelog = await fetchModChangelog(modLink.href);
            tooltip.textContent = changelog;
          } catch (error) {
            tooltip.textContent = 'Error loading changelog';
          }
        } else {
          tooltip.textContent = 'Could not find mod link';
        }

        isHovering = false;
      };

      const hideTooltip = () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        tooltip.style.display = 'none';
      };

      modElement.addEventListener('mouseenter', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(showTooltip, 300);
      });

      modElement.addEventListener('mouseleave', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        hideTooltip();
      });

      document.addEventListener('click', hideTooltip);
    });
  }

  // === boot ===================================================================
  function init() {
    // Get user options from chrome.storage, then run logic
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      safeStorageGet(
        {
          downloadedModsFilter: FILTER_HIDE,
          hideDownloadedMods: true, // legacy fallback
          hoverChangelogs: true
        },
        function(items) {
          betterNexusMods.options = currentOptions = normalizeOptions(items);
          ensureToggleExists(currentOptions);
          refreshVisibility();
          setTimeout(() => {
            setupChangelogHover(currentOptions);
            // Also setup on dynamic content changes (for infinite scroll, etc.)
            const observer = new MutationObserver((mutations) => {
              const nodesAdded = mutations.some(mutation =>
                mutation.addedNodes && mutation.addedNodes.length > 0
              );
              if (nodesAdded) {
                setupChangelogHover(currentOptions);
                refreshVisibility();
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
          }, 1000);
        }
      );
    } else {
      ensureToggleExists(currentOptions);
      refreshVisibility();
      setTimeout(() => {
        setupChangelogHover(currentOptions);
        const observer = new MutationObserver((mutations) => {
          const nodesAdded = mutations.some(mutation =>
            mutation.addedNodes && mutation.addedNodes.length > 0
          );
          if (nodesAdded) {
            setupChangelogHover(currentOptions);
            refreshVisibility();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }, 1000);
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

        if (changes.hoverChangelogs) {
          currentOptions.hoverChangelogs = changes.hoverChangelogs.newValue;
          if (currentOptions.hoverChangelogs) {
            // If re-enabled, ensure event listeners are set up for existing and future elements
            setupChangelogHover(currentOptions);
          } else {
            // If disabled, hide any active tooltips
            const activeTooltips = document.querySelectorAll('.changelog-tooltip');
            activeTooltips.forEach(tt => tt.style.display = 'none');
          }
        }
      }
    });
  }

  // watch for SPA navigations / infinite scroll / toolbar creation
  const container = document.querySelector("main") || document.body;
  const obs = new MutationObserver(init);
  if (container) obs.observe(container, { childList: true, subtree: true });
})(window);