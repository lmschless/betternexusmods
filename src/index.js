(function(window){
  const betterNexusMods = {};
  window.betterNexusMods = betterNexusMods;
  let currentOptions = {
    hideDownloadedMods: true,
    hoverChangelogs: true
};

// === helpers ================================================================
function getToolbar() {
  // first toolbar row with left/right buttons
  return document.querySelector(".flex.items-center.gap-x-3");
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

  if (existingToggle) return; // Already added and not a search page

  // -------------------------------------------------------------------------
  // build the checkbox+label (only if not a search page and toggle doesn't exist)
  const wrapper = document.createElement("label");
  wrapper.id = "nmdh-toggle";
  wrapper.className = "nmdh-label"; // styled in CSS
  wrapper.innerHTML = `
    <input type="checkbox" id="nmdh-checkbox" checked />
    <span>Hide downloaded mods</span>
  `;

  // put it at the very left
  toolbar.prepend(wrapper);

  // Set initial checkbox state from options
  if (options && typeof options.hideDownloadedMods === 'boolean') {
    wrapper.firstElementChild.checked = options.hideDownloadedMods;
  }

  // hook behaviour
  wrapper.firstElementChild.addEventListener("change", refreshVisibility);
}

function refreshVisibility() {
  let shouldHide;
  const checkbox = document.querySelector("#nmdh-checkbox");

  if (window.location.href.includes('search')) {
    shouldHide = false; // Force mods to be visible on search pages
  } else {
    // If checkbox exists, use its state, otherwise default (e.g. true, or could be based on initial options)
    shouldHide = checkbox?.checked ?? currentOptions.hideDownloadedMods; 
  }

  document
    .querySelectorAll('[data-e2eid="mod-tile-downloaded"]')
    .forEach(flag => {
      const card =
        flag.closest('[data-e2eid="mod-tile"], .file-row, li, article');
      if (card) {
        card.classList.toggle("nmdh-hidden", shouldHide);
      }
    });

  // Save user choice to chrome.storage only if the checkbox exists
  if (checkbox && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set({ hideDownloadedMods: checkbox.checked });
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
      if (!currentOptions.hoverChangelogs) { // Check live global option
        hideTooltip(); // Ensure it's hidden if setting was turned off
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
    chrome.storage.sync.get({ hideDownloadedMods: true, hoverChangelogs: true }, function(items) {
      betterNexusMods.options = currentOptions = items; // Store retrieved options
      ensureToggleExists(currentOptions);
      refreshVisibility(); // refreshVisibility reads from the DOM checkbox, which ensureToggleExists sets based on currentOptions
      setTimeout(() => {
        setupChangelogHover(currentOptions);
        // Also setup on dynamic content changes (for infinite scroll, etc.) 
        const observer = new MutationObserver((mutations) => {
          const nodesAdded = mutations.some(mutation => 
            mutation.addedNodes && mutation.addedNodes.length > 0
          );
          if (nodesAdded) {
            // Pass current options, which might have been updated by storage.onChanged
            setupChangelogHover(currentOptions); 
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }, 1000);
    });
  } else {
    // fallback if chrome.storage is not available
    // Use default global options if storage is not available
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
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'sync') {
            if (changes.hideDownloadedMods) {
                currentOptions.hideDownloadedMods = changes.hideDownloadedMods.newValue;
                const checkbox = document.querySelector("#nmdh-checkbox");
                if (checkbox) {
                    checkbox.checked = currentOptions.hideDownloadedMods;
                }
                refreshVisibility(); // This will re-apply visibility based on the new checkbox state
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
})();
