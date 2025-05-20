// src/content/index.js

// Function to load a script with error handling
function loadScript(scriptPath) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptPath);
    script.onload = () => {
      console.log(`[Nexus Mods Helper] Loaded script: ${scriptPath}`);
      resolve();
    };
    script.onerror = (error) => {
      console.error(`[Nexus Mods Helper] Error loading script ${scriptPath}:`, error);
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

  console.log('[Nexus Mods Helper] Initializing features...');
  
  // Initialize features if they exist
  if (window.HideDownloadedMods?.init) {
    console.log('[Nexus Mods Helper] Initializing HideDownloadedMods');
    window.HideDownloadedMods.init();
  }
  
  if (window.ChangelogHover?.init) {
    console.log('[Nexus Mods Helper] Initializing ChangelogHover');
    window.ChangelogHover.init();
  }
}

// Main initialization function
async function init() {
  try {
    console.log('[Nexus Mods Helper] Starting initialization...');
    
    // Load feature scripts
    await loadScript('src/content/features/hideDownloadedMods.js');
    await loadScript('src/content/features/changelogHover.js');
    
    // Initial feature initialization
    initializeFeatures();
    
    // Setup observer for dynamic content
    const observer = new MutationObserver((mutations) => {
      const nodesAdded = mutations.some(mutation => 
        mutation.addedNodes && mutation.addedNodes.length > 0
      );
      
      if (nodesAdded) {
        console.log('[Nexus Mods Helper] New content detected, reinitializing features...');
        initializeFeatures();
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    console.log('[Nexus Mods Helper] Initialization complete');
  } catch (error) {
    console.error('[Nexus Mods Helper] Error during initialization:', error);
  }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  console.log('[Nexus Mods Helper] Waiting for DOM to load...');
  document.addEventListener('DOMContentLoaded', init);
} else {
  console.log('[Nexus Mods Helper] DOM already loaded, initializing...');
  init();
}
