// Infinite Scroll for Nexus Mods main mods page
(function() {
    // Only run on the main mods listing page (support www and subdomains, http/https)
    if (!/^https?:\/\/(www\.|[a-z0-9-]+\.)?nexusmods\.com\/[^/]+\/mods\/?(\?.*)?$/.test(window.location.href)) return;

    // Check user option before enabling infinite scroll
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ infiniteScroll: true }, function(options) {
            if (options.infiniteScroll) {
                initInfiniteScroll();
            }
        });
    } else {
        // fallback: default enabled
        initInfiniteScroll();
    }

    let loading = false;
    let nextPageUrl = null;

    function getNextPageUrl() {
        // Find the pagination next link
        const nextLink = document.querySelector('.pagination a[rel="next"]');
        return nextLink ? nextLink.href : null;
    }

    function appendNextPage() {
        if (loading || !nextPageUrl) return;
        loading = true;

        // Show a loading indicator
        let loader = document.getElementById('nmdh-infinite-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'nmdh-infinite-loader';
            loader.style.textAlign = 'center';
            loader.style.padding = '20px';
            loader.textContent = 'Loading more mods...';
            document.body.appendChild(loader);
        }
        loader.style.display = 'block';

        fetch(nextPageUrl, { credentials: 'same-origin' })
            .then(response => response.text())
            .then(html => {
                // Parse the next page
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                // Get mod cards from the next page
                const modList = doc.querySelector('.mod-list');
                const nextModList = document.querySelector('.mod-list');
                if (modList && nextModList) {
                    // Move all mod cards
                    modList.querySelectorAll('.mod-tile, .file-row, li, article').forEach(card => {
                        nextModList.appendChild(card);
                    });
                }
                // Update nextPageUrl
                nextPageUrl = (function() {
                    const nextLink = doc.querySelector('.pagination a[rel="next"]');
                    return nextLink ? nextLink.href : null;
                })();
                if (!nextPageUrl) loader.textContent = 'No more mods.';
                else loader.style.display = 'none';
            })
            .catch(() => {
                loader.textContent = 'Failed to load more mods.';
            })
            .finally(() => {
                loading = false;
            });
    }

    function onScroll() {
        if (loading || !nextPageUrl) return;
        // If near bottom of page, load next
        if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 500)) {
            appendNextPage();
        }
    }

    function initInfiniteScroll() {
        nextPageUrl = getNextPageUrl();
        if (!nextPageUrl) return;
        window.addEventListener('scroll', onScroll);
    }

    // Wait for DOM ready
    document.addEventListener('DOMContentLoaded', initInfiniteScroll);
})();
