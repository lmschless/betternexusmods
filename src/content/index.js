// src/content/index.js

async function loadModule(importFn) {
  try {
    return await importFn();
  } catch (error) {
    console.error('[Nexus Mods Helper] Error loading module:', error);
    return null;
  }
}

async function init() {
  try {
    // Load modules
    const { HideDownloadedMods } = await loadModule(
      () => import('./features/hideDownloadedMods.js')
    );
    
    const { ChangelogHover } = await loadModule(
      () => import('./features/changelogHover.js')
    );
    
    // Initialize features if they exist
    if (HideDownloadedMods?.init) HideDownloadedMods.init();
    if (ChangelogHover?.init) ChangelogHover.init();
    
    // Setup observer for dynamic content
    const observer = new MutationObserver((mutations) => {
      const nodesAdded = mutations.some(mutation => 
        mutation.addedNodes && mutation.addedNodes.length > 0
      );
      
      if (nodesAdded) {
        if (HideDownloadedMods?.init) HideDownloadedMods.init();
        if (ChangelogHover?.init) ChangelogHover.init();
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
