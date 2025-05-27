// Infinite Scroll for Nexus Mods main mods page
let isInfiniteScrollEnabled = true; // Default to true, will be updated from storage
let scrollListenerAttached = false;

(function() {
    console.log('[Betternexusmods] infiniteScroll.js loaded', window.location.href);
    // Only run on the main mods listing page for any game
    if (!/^https?:\/\/(www\.|[a-z0-9-]+\.)?nexusmods\.com\/games\/[^/]+\/mods(\/|$|\?)/.test(window.location.href)) {
        console.log('[Betternexusmods] infiniteScroll.js: Not a mods page, skipping.');
        return;
    }

    // Check user option before enabling infinite scroll
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ infiniteScroll: true }, function(options) {
            isInfiniteScrollEnabled = (typeof options.infiniteScroll === 'undefined') ? true : options.infiniteScroll;
            if (isInfiniteScrollEnabled) {
                console.log('[Betternexusmods] Infinite Scroll INITIALLY ENABLED');
                initInfiniteScroll();
            } else {
                console.log('[Betternexusmods] Infinite Scroll INITIALLY DISABLED');
            }
        });
    } else {
        // fallback: default enabled
        console.log('[Betternexusmods] Infinite Scroll INITIALLY ENABLED (no chrome.storage)');
        initInfiniteScroll(); // isInfiniteScrollEnabled remains true by default
    }

    let loading = false;
    let nextPageUrl = null;

    function getModListContainer() {
        // Try common Nexus Mods containers
        return document.querySelector('.mod-list, .mods-grid, .mods-list, main .w-full > div > .flex.flex-wrap');
    }
    function clickNextPageButton() {
        let nav = document.querySelector('nav[aria-label="Pagination navigation"]');
        if (!nav) nav = document.querySelector('nav.flex.flex-col.items-start.gap-6.sm\\:flex-row.sm\\:items-center');
        if (!nav) {
            console.warn('[Betternexusmods] Infinite Scroll: No pagination nav found');
            return false;
        }
        const nextBtn = nav.querySelector('button[aria-label="Go to next page"]:not(:disabled)');
        if (nextBtn) {
            console.log('[Betternexusmods] Infinite Scroll: Clicking next page button');
            nextBtn.click();
            return true;
        } else {
            console.log('[Betternexusmods] Infinite Scroll: No next page button found or it is disabled');
            return false;
        }
    }

    function appendNextPage() {
        if (loading) {
            console.log('[Betternexusmods] Infinite Scroll: Already loading');
            return;
        }
        loading = true;
        // Show a loading indicator
        let loader = document.getElementById('nmdh-infinite-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'nmdh-infinite-loader';
            loader.textContent = 'Loading more mods...';
            loader.style = 'text-align:center; padding: 1em; color: #888;';
            document.body.appendChild(loader);
        }
        const clicked = clickNextPageButton();
        setTimeout(() => {
            loading = false;
            if (clicked && loader) loader.remove();
            if (!clicked && loader) loader.textContent = 'No more mods.';
        }, 1200); // Allow time for mods to load
    }

    function onScroll() {
        if (loading) return;
        // Only trigger when at the very bottom of the page
        if ((window.innerHeight + Math.ceil(window.scrollY)) >= document.body.offsetHeight) {
            appendNextPage();
        }
    }

    function initInfiniteScroll() {
        if (isInfiniteScrollEnabled && !scrollListenerAttached) {
            window.addEventListener('scroll', onScroll);
            scrollListenerAttached = true;
            console.log('[Betternexusmods] Infinite Scroll: Event listener ADDED');
        } else if (!isInfiniteScrollEnabled && scrollListenerAttached) {
            window.removeEventListener('scroll', onScroll);
            scrollListenerAttached = false;
            console.log('[Betternexusmods] Infinite Scroll: Event listener REMOVED');
        }
    }

    function disableInfiniteScroll() {
        if (scrollListenerAttached) {
            window.removeEventListener('scroll', onScroll);
            scrollListenerAttached = false;
            console.log('[Betternexusmods] Infinite Scroll: Event listener REMOVED due to option change');
        }
        // Remove loader if it exists
        let loader = document.getElementById('nmdh-infinite-loader');
        if (loader) loader.remove();
    }

    // Listen for changes from popup or options page
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function(changes, namespace) {
            if (namespace === 'sync' && changes.infiniteScroll) {
                isInfiniteScrollEnabled = changes.infiniteScroll.newValue;
                if (isInfiniteScrollEnabled) {
                    console.log('[Betternexusmods] Infinite Scroll turned ON by user');
                    initInfiniteScroll(); // This will add the listener if not already present
                } else {
                    console.log('[Betternexusmods] Infinite Scroll turned OFF by user');
                    disableInfiniteScroll(); // This will remove the listener
                }
            }
        });
    }
})();
