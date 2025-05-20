// src/content/index.js

// Function to load a module with error handling
function loadModule(modulePath) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(modulePath);
    script.type = 'module';
    script.onload = () => resolve();
    script.onerror = (error) => {
      console.error(`[Nexus Mods Helper] Error loading module ${modulePath}:`, error);
      resolve();
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

// Function to initialize features
function initializeFeatures() {
  // Check if features are already initialized
  if (window.nmhInitialized) return;
  window.nmhInitialized = true;

  // Initialize features if they exist
  if (window.HideDownloadedMods?.init) window.HideDownloadedMods.init();
  if (window.ChangelogHover?.init) window.ChangelogHover.init();
}

// Main initialization function
async function init() {
  try {
    // Load feature modules
    await loadModule('src/content/features/hideDownloadedMods.js');
    await loadModule('src/content/features/changelogHover.js');
    
    // Initial feature initialization
    initializeFeatures();
    
    // Setup observer for dynamic content
    const observer = new MutationObserver((mutations) => {
      const nodesAdded = mutations.some(mutation => 
        mutation.addedNodes && mutation.addedNodes.length > 0
      );
      
      if (nodesAdded) {
        initializeFeatures();
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  } catch (error) {
    console.error('[Nexus Mods Helper] Error during initialization:', error);
  }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
