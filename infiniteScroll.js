// Infinite Scroll for Nexus Mods main mods page
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
            if (typeof options.infiniteScroll === 'undefined' || options.infiniteScroll === true) {
                console.log('[Betternexusmods] Infinite Scroll ENABLED');
                initInfiniteScroll();
            } else {
                console.log('[Betternexusmods] Infinite Scroll DISABLED');
            }
        });
    } else {
        // fallback: default enabled
        console.log('[Betternexusmods] Infinite Scroll ENABLED (no chrome.storage)');
        initInfiniteScroll();
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
        // No need for nextPageUrl logic; just scroll and click next page button
        window.addEventListener('scroll', onScroll);
        console.log('[Betternexusmods] Infinite Scroll: Initialized (button click mode)');
    }

    // Wait for DOM ready
    document.addEventListener('DOMContentLoaded', initInfiniteScroll);
})();
