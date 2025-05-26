// === Mod Component Tweaks ===================================================
// This file contains tweaks to enhance the mod component display

/**
 * Adds the number of posts to the mod component footer
 * Matches the style of other elements (endorsements, downloads, size)
 */
function addPostsCountToModComponent() {
  // Find all mod tiles on the page
  const modTiles = document.querySelectorAll('[data-e2eid="mod-tile"]');
  
  modTiles.forEach(async (modTile) => {
    // Skip if we've already processed this tile
    if (modTile.hasAttribute('data-posts-added')) return;
    modTile.setAttribute('data-posts-added', 'true');
    
    // Find the footer where we'll add the posts count
    const footer = modTile.querySelector('.bg-surface-high.mt-auto.flex.min-h-8.items-center.gap-x-4.rounded-b.px-3');
    if (!footer) return;
    
    // Get the mod URL from the tile
    const modLink = modTile.querySelector('a[href*="/mods/"]');
    if (!modLink) return;
    
    const modUrl = modLink.href;
    if (!modUrl) return;
    
    try {
      // Fetch the mod page to get the posts count
      const postsCount = await fetchPostsCount(modUrl);
      if (!postsCount) return;
      
      // Create the posts count element
      const postsElement = document.createElement('span');
      postsElement.innerHTML = `
        <p class="typography-body-sm text-neutral-moderate flex items-center gap-x-1 leading-4">
          <svg viewBox="0 0 24 24" role="presentation" class="shrink-0" style="width: 1rem; height: 1rem;">
            <path d="M17,12V3A1,1 0 0,0 16,2H3A1,1 0 0,0 2,3V17L6,13H16A1,1 0 0,0 17,12M21,6H19V15H6V17A1,1 0 0,0 7,18H18L22,22V7A1,1 0 0,0 21,6Z" style="fill: currentcolor;"></path>
          </svg>
          <span class="sr-only">Posts </span>
          <span data-e2eid="mod-tile-posts">${postsCount}</span>
        </p>
      `;
      
      // Find the file size element - we want to insert our posts count before this
      // or after the downloads element if file size doesn't exist
      const fileSizeElement = footer.querySelector('[data-e2eid="mod-tile-file-size"]')?.closest('span');
      const downloadsElement = footer.querySelector('[data-e2eid="mod-tile-downloads"]')?.closest('span');
      
      if (fileSizeElement) {
        // Insert before the file size element
        footer.insertBefore(postsElement, fileSizeElement);
      } else if (downloadsElement) {
        // Insert after the downloads element
        if (downloadsElement.nextSibling) {
          footer.insertBefore(postsElement, downloadsElement.nextSibling);
        } else {
          footer.appendChild(postsElement);
        }
      } else {
        // Fallback: just append to the footer
        footer.appendChild(postsElement);
      }
    } catch (error) {
      console.error('Error adding posts count:', error);
    }
  });
}

/**
 * Fetches the posts count from the mod page
 * @param {string} modUrl - The URL of the mod page
 * @returns {Promise<string|null>} - The formatted posts count or null if not found
 */
async function fetchPostsCount(modUrl) {
  try {
    // Check cache first
    const cached = getFromPostsCache(modUrl);
    if (cached) return cached;
    
    // Add tab=posts to the URL if it doesn't already have it
    const postsUrl = modUrl.includes('?tab=posts') ? modUrl : `${modUrl}?tab=posts`;
    
    const response = await fetch(postsUrl, {
      credentials: 'same-origin',
      headers: {
        'Accept': 'text/html',
        'Cache-Control': 'max-age=3600'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find the posts count from the tab
    const postsTab = doc.querySelector('#mod-page-tab-posts .alert');
    if (!postsTab) return null;
    
    const postsCount = postsTab.textContent.trim();
    
    // Save to cache
    saveToPostsCache(modUrl, postsCount);
    
    return postsCount;
  } catch (error) {
    console.error('Error fetching posts count:', error);
    return null;
  }
}

// === Cache functionality for posts count ===================================
const POSTS_CACHE_PREFIX = 'nmdh_posts_';
const POSTS_CACHE_EXPIRY_DAYS = 1; // Cache posts count for 1 day

// Get a unique key for localStorage
function getPostsCacheKey(url) {
  return POSTS_CACHE_PREFIX + btoa(url).replace(/[^a-z0-9]/gi, '');
}

// Save to localStorage with expiry
function saveToPostsCache(url, data) {
  try {
    const cacheData = {
      data,
      expiry: Date.now() + (POSTS_CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    };
    localStorage.setItem(getPostsCacheKey(url), JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Failed to save posts count to cache:', e);
  }
}

// Get from localStorage, returns null if expired or not found
function getFromPostsCache(url) {
  try {
    const cached = localStorage.getItem(getPostsCacheKey(url));
    if (!cached) return null;
    
    const { data, expiry } = JSON.parse(cached);
    if (Date.now() > expiry) {
      localStorage.removeItem(getPostsCacheKey(url)); // Clean up expired
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

// === Observer to handle dynamically loaded content =========================
function setupModComponentObserver() {
  // Create a mutation observer to watch for new mod tiles
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    
    // Check if any relevant nodes were added
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a mod tile or contains mod tiles
            if (node.matches('[data-e2eid="mod-tile"]') || 
                node.querySelector('[data-e2eid="mod-tile"]')) {
              shouldProcess = true;
              break;
            }
          }
        }
      }
    });
    
    // If relevant nodes were added, process them
    if (shouldProcess) {
      addPostsCountToModComponent();
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Also run once on page load
  addPostsCountToModComponent();
}

// === Initialize the module =================================================
function initModComponentTweaks() {
  // Check if we're on a page with mod components
  if (document.querySelector('[data-e2eid="mod-tile"]')) {
    setupModComponentObserver();
  } else {
    // If no mod tiles yet, wait for them to appear
    const observer = new MutationObserver((mutations, obs) => {
      if (document.querySelector('[data-e2eid="mod-tile"]')) {
        setupModComponentObserver();
        obs.disconnect(); // Stop observing once we've found mod tiles
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Initialize when the document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModComponentTweaks);
} else {
  initModComponentTweaks();
}
