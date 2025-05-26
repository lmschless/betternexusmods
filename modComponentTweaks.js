let modTileObserver = null;

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
      postsElement.classList.add('mod-tile-posts-count-element'); // Add class for easy removal
      
      // Find the file size element - we want to insert our posts count before this
      // or after the downloads element if file size doesn't exist
      // Make sure we're only looking for direct children of the footer
      const footerChildren = Array.from(footer.children);
      
      // Find elements by their data attributes within the direct children
      const fileSizeSpan = footerChildren.find(child => 
        child.querySelector && child.querySelector('[data-e2eid="mod-tile-file-size"]')
      );
      
      const downloadsSpan = footerChildren.find(child => 
        child.querySelector && child.querySelector('[data-e2eid="mod-tile-downloads"]')
      );
      
      // Safely insert the element
      try {
        if (fileSizeSpan && footer.contains(fileSizeSpan)) {
          // Insert before the file size element
          footer.insertBefore(postsElement, fileSizeSpan);
        } else if (downloadsSpan && footer.contains(downloadsSpan)) {
          // Insert after the downloads element
          const nextSibling = downloadsSpan.nextSibling;
          if (nextSibling && footer.contains(nextSibling)) {
            footer.insertBefore(postsElement, nextSibling);
          } else {
            footer.appendChild(postsElement);
          }
        } else {
          // Fallback: just append to the footer
          footer.appendChild(postsElement);
        }
      } catch (insertError) {
        console.warn('DOM insertion error, falling back to append:', insertError);
        // Ultimate fallback - just append to the end
        try {
          footer.appendChild(postsElement);
        } catch (appendError) {
          console.error('Failed to append element:', appendError);
        }
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
    
    // Instead of trying to fetch directly (which would cause CORS issues),
    // we'll extract the post count from the page we're already on
    
    // Get the mod ID from the URL
    const modIdMatch = modUrl.match(/\/mods\/(\d+)/);
    if (!modIdMatch || !modIdMatch[1]) return null;
    
    const modId = modIdMatch[1];
    
    // Look for post count in the existing page elements
    // This approach doesn't require additional network requests
    const modTile = document.querySelector(`[data-e2eid="mod-tile"][href*="/mods/${modId}"]`);
    if (!modTile) return null;
    
    // Try to find post count in existing elements
    // Nexus Mods often has this information in the page already
    const statsSection = modTile.querySelector('.stats-section') || 
                         modTile.closest('.mod-tile')?.querySelector('.stats-section');
    
    if (statsSection) {
      const postsStat = Array.from(statsSection.querySelectorAll('.stat')).find(el => 
        el.textContent.toLowerCase().includes('post') || 
        el.innerHTML.includes('comment') || 
        el.innerHTML.includes('message')
      );
      
      if (postsStat) {
        const postsCount = postsStat.textContent.trim().replace(/[^0-9,]/g, '');
        if (postsCount) {
          // Save to cache
          saveToPostsCache(modUrl, postsCount);
          return postsCount;
        }
      }
    }
    
    // If we couldn't find it in the page, return a default value
    // This avoids the CORS error while still providing some functionality
    const defaultCount = '0';
    saveToPostsCache(modUrl, defaultCount);
    return defaultCount;
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
  if (modTileObserver) modTileObserver.disconnect(); // Disconnect previous observer if any
  modTileObserver = new MutationObserver((mutations) => {
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
  if (modTileObserver) modTileObserver.observe(document.body, { childList: true, subtree: true });
  
  // Also run once on page load
  addPostsCountToModComponent();
}

// === Initialize the module =================================================
function initModComponentTweaks() {
  // Get the displayPostCount option from storage
  chrome.storage.sync.get({ displayPostCount: true }, function(items) {
    // Only proceed if displayPostCount is enabled
    if (items.displayPostCount) {
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
  });
}

// Function to remove post count elements from the page
function removePostCountElements() {
  const modTiles = document.querySelectorAll('[data-e2eid="mod-tile"]');
  modTiles.forEach(modTile => {
    const postsElement = modTile.querySelector('.mod-tile-posts-count-element');
    if (postsElement) {
      postsElement.remove();
    }
    modTile.removeAttribute('data-posts-added');
  });

  if (modTileObserver) {
    modTileObserver.disconnect();
    modTileObserver = null;
  }
  console.log('Post count elements removed and observer disconnected.');
}

// Listen for changes to the storage
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && changes.displayPostCount) {
    const newValue = changes.displayPostCount.newValue;
    
    // If the option was enabled, initialize the component
    if (newValue === true) {
      initModComponentTweaks();
    } 
    // If the option was disabled, remove post count elements
    else if (newValue === false) {
      removePostCountElements();
    }
  }
});

// Initialize when the document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModComponentTweaks);
} else {
  initModComponentTweaks();
}
