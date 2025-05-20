// src/content/features/changelogHover.js
(function() {
  'use strict';
  
  const isFetching = new Map();

  // Cache functions
  function getCacheKey(url) {
    const CHANGELOG_CACHE_PREFIX = 'nmdh_changelog_';
    return CHANGELOG_CACHE_PREFIX + btoa(url).replace(/[^a-z0-9]/gi, '');
  }
  
  function saveToCache(url, data) {
    try {
      const CACHE_EXPIRY_DAYS = 7;
      const cacheData = {
        data,
        expiry: Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      };
      localStorage.setItem(getCacheKey(url), JSON.stringify(cacheData));
    } catch (e) {
      console.warn('[Nexus Mods Helper] Failed to save to cache:', e);
    }
  }
  
  function getFromCache(url) {
    try {
      const cached = localStorage.getItem(getCacheKey(url));
      if (!cached) return null;
      
      const { data, expiry } = JSON.parse(cached);
      if (Date.now() > expiry) {
        localStorage.removeItem(getCacheKey(url));
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  // Create the ChangelogHover object
  const ChangelogHover = {
    isFetching,
    
    init() {
      this.setupChangelogHover();
      
      // Set up a mutation observer to handle dynamically loaded content
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length > 0) {
            this.setupChangelogHover();
          }
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    },
  
    async fetchModChangelog(modUrl) {
      if (this.isFetching.has(modUrl)) return;
      this.isFetching.set(modUrl, true);
      
      try {
        // Try to get from cache first
        const cachedData = getFromCache(modUrl);
        if (cachedData) return cachedData;
        
        const response = await fetch(modUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract changelog (this selector might need adjustment based on Nexus Mods' HTML structure)
        const changelogElement = doc.querySelector('.changelog-content, .changelog, [data-changelog]');
        if (!changelogElement) return null;
        
        const changelog = changelogElement.textContent.trim();
        
        // Save to cache
        saveToCache(modUrl, changelog);
        return changelog;
      } catch (error) {
        console.error('[Nexus Mods Helper] Error fetching changelog:', error);
        return null;
      } finally {
        this.isFetching.delete(modUrl);
      }
  },
  
    setupChangelogHover() {
      const tooltip = document.createElement('div');
      tooltip.className = 'changelog-tooltip';
      document.body.appendChild(tooltip);
      
      let hoverTimeout;
      let currentElement = null;
      
      const updatePosition = () => {
        if (!currentElement) return;
        const rect = currentElement.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
      };
      
      const showTooltip = (element, content) => {
        if (!content) return;
        
        clearTimeout(hoverTimeout);
        currentElement = element;
        
        tooltip.textContent = content;
        tooltip.style.display = 'block';
        
        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        
        // Add a small delay before showing to prevent flickering
        hoverTimeout = setTimeout(() => {
          tooltip.style.opacity = '1';
        }, 100);
      };
      
      const hideTooltip = () => {
        clearTimeout(hoverTimeout);
        tooltip.style.opacity = '0';
        
        setTimeout(() => {
          if (tooltip.style.opacity === '0') {
            tooltip.style.display = 'none';
            currentElement = null;
          }
        }, 200);
        
        window.removeEventListener('scroll', updatePosition, true);
      };
      
      const handleHover = async (element) => {
        if (currentElement === element) return;
        
        const changelogUrl = element.getAttribute('data-changelog-url');
        if (!changelogUrl) return;
        
        showTooltip(element, 'Loading changelog...');
        
        try {
          const changelog = await this.fetchModChangelog(changelogUrl);
          if (currentElement === element) {
            showTooltip(element, changelog || 'No changelog available');
          }
        } catch (error) {
          console.error('[Nexus Mods Helper] Error in handleHover:', error);
          if (currentElement === element) {
            showTooltip(element, 'Error loading changelog');
          }
        }
      };
      
      document.addEventListener('mouseover', (e) => {
        const element = e.target.closest('[data-changelog-url]');
        if (element) {
          handleHover(element);
        } else if (currentElement) {
          hideTooltip();
        }
      });
      
      document.addEventListener('mouseout', (e) => {
        const element = e.target.closest('[data-changelog-url]');
        if (!element || !element.contains(e.relatedTarget)) {
          hideTooltip();
        }
      });
      
      document.addEventListener('click', hideTooltip);
    }
  };
  
  // Expose to window
  window.ChangelogHover = ChangelogHover;
  
  // Initialize if this script is loaded directly
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.ChangelogHover?.init) {
        window.ChangelogHover.init();
      }
    });
  } else if (window.ChangelogHover?.init) {
    window.ChangelogHover.init();
  }
  
})();