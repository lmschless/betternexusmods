let modTileObserver = null;
let modTileIntersectionObserver = null;

// If you truly want *all* tiles in the current view, keep this high.
// Background queue already limits concurrency.
const MAX_POST_FETCHES = 500;
let postsFetched = 0;

// === Helpers ===============================================================

function getGameSlugFromUrl() {
  // Gallery route: /games/mewgenics/mods
  // Detail route: /mewgenics/mods/17
  const m = location.pathname.match(/^\/games\/([^\/]+)/i);
  return m ? m[1] : null;
}

function buildModUrlFromIds(modTile) {
  const modId =
    modTile.getAttribute("mod_id") ||
    modTile.getAttribute("data-mod-id") ||
    modTile.dataset?.modId ||
    modTile.dataset?.mod_id;

  const game = getGameSlugFromUrl();
  if (!modId || !game) return null;

  return `${location.origin}/${game}/mods/${modId}`;
}

function getModUrlFromTile(modTile) {
  // Older route sometimes had mod_href (your earlier screenshots)
  const attr = modTile.getAttribute("mod_href");
  if (attr) {
    try {
      return new URL(attr, location.origin).href;
    } catch {
      return attr;
    }
  }

  // NEW: /games/... gallery route usually has anchors inside the tile
  const anchors = Array.from(modTile.querySelectorAll("a[href]"));

  // Prefer: /<game>/mods/<id>
  const best = anchors.find(a => /\/mods\/\d+(\?|#|$)/.test(a.getAttribute("href")));
  if (best) return new URL(best.getAttribute("href"), location.origin).href;

  // Next: anything containing /mods/
  const anyMods = anchors.find(a => (a.getAttribute("href") || "").includes("/mods/"));
  if (anyMods) return new URL(anyMods.getAttribute("href"), location.origin).href;

  // Final fallback: build from mod_id + /games/<slug> in URL
  const fallback = buildModUrlFromIds(modTile);
  if (fallback) return fallback;

  return null;
}

function buildPostsUrl(modUrl) {
  try {
    const url = new URL(modUrl, location.origin);
    url.searchParams.set("tab", "posts");
    return url.href;
  } catch {
    return modUrl.includes("?") ? `${modUrl}&tab=posts` : `${modUrl}?tab=posts`;
  }
}

function getFooterFromTile(modTile) {
  // Footer in your screenshot: div.mt-auto...bg-surface-high...px-3
  // Make selectors resilient to class order and minor changes.
  return (
    modTile.querySelector('[data-e2eid="mod-tile-footer"]') ||
    modTile.querySelector("div.bg-surface-high.mt-auto") ||
    modTile.querySelector("div.mt-auto.bg-surface-high") ||
    modTile.querySelector("div.bg-surface-high") ||
    null
  );
}

function buildPostsElement(initialText = "...", postsUrl = "#") {
  const container = document.createElement("span");
  container.classList.add("mod-tile-posts-count-element");

  // Match the style of other footer items (downloads, size, etc.)
  container.innerHTML = `
    <a class="typography-body-sm flex items-center gap-x-1 leading-4" style="white-space:nowrap; color:#f5f6fa; background:rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.32); border-radius:4px; padding:0.125rem 0.375rem; text-decoration:underline; text-underline-offset:0.15em; cursor:pointer;" aria-label="View mod posts">
      <svg viewBox="0 0 24 24" role="presentation" class="shrink-0" style="width: 1rem; height: 1rem;">
        <path d="M17,12V3A1,1 0 0,0 16,2H3A1,1 0 0,0 2,3V17L6,13H16A1,1 0 0,0 17,12M21,6H19V15H6V17A1,1 0 0,0 7,18H18L22,22V7A1,1 0 0,0 21,6Z" style="fill: currentcolor;"></path>
      </svg>
      <span class="sr-only">Posts</span>
      <span data-e2eid="mod-tile-posts">${initialText}</span>
    </a>
  `;

  const link = container.querySelector("a");
  link.href = postsUrl;
  link.addEventListener("click", event => event.stopPropagation());

  return container;
}

/**
 * Ask background.js for the posts count (cached + queued there).
 */
async function fetchPostsCount(modUrl) {
  if ((typeof global !== "undefined" && global.isTestEnvironment)) {
    return "123";
  }

  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "fetchPostCount", url: modUrl }, resp => {
      if (!resp) return resolve(null);
      if (resp.error) return resolve(null);
      resolve(resp.data ?? null);
    });
  });
}

// === Main tile processing ===================================================

async function processModTile(modTile) {
  if (postsFetched >= MAX_POST_FETCHES) return;

  // prevent duplicates
  if (modTile.getAttribute("data-posts-added") === "true") return;
  if (modTile.getAttribute("data-posts-requested") === "true") return;
  modTile.setAttribute("data-posts-requested", "true");

  const footer = getFooterFromTile(modTile);
  if (!footer) return;

  const modUrl = getModUrlFromTile(modTile);
  if (!modUrl) return;

  // If already exists, mark and bail
  if (footer.querySelector('[data-e2eid="mod-tile-posts"]')) {
    modTile.setAttribute("data-posts-added", "true");
    return;
  }

  // Insert placeholder immediately so UI confirms selector correctness
  const postsElement = buildPostsElement("...", buildPostsUrl(modUrl));
  footer.appendChild(postsElement);

  try {
    postsFetched++;
    const postsCount = await fetchPostsCount(modUrl);

    const span = postsElement.querySelector('[data-e2eid="mod-tile-posts"]');
    if (span) span.textContent = postsCount ? String(postsCount) : "0";

    modTile.setAttribute("data-posts-added", "true");
  } catch (err) {
    // remove placeholder if error
    postsElement.remove();
    console.warn("Error adding posts count:", err);
  }
}

/**
 * Adds the number of posts to mod tile footer
 */
function addPostsCountToModComponent() {
  const modTiles = document.querySelectorAll('[data-e2eid="mod-tile"]');
  if (!modTiles || !modTiles.length) return;

  if (!modTileIntersectionObserver) {
    modTileIntersectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          processModTile(entry.target);
        }
      });
    }, { rootMargin: "200px" });
  }

  modTiles.forEach(modTile => {
    if (postsFetched >= MAX_POST_FETCHES) return;
    if (
      modTile.getAttribute("data-posts-added") !== "true" &&
      modTile.getAttribute("data-posts-observed") !== "true"
    ) {
      modTile.setAttribute("data-posts-observed", "true");
      modTileIntersectionObserver.observe(modTile);
    }
  });
}

// === Mutation observer for dynamically added tiles ==========================

function setupModComponentObserver() {
  if (modTileObserver) modTileObserver.disconnect();

  modTileObserver = new MutationObserver(mutations => {
    let shouldProcess = false;

    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (
              node.matches?.('[data-e2eid="mod-tile"]') ||
              node.querySelector?.('[data-e2eid="mod-tile"]')
            ) {
              shouldProcess = true;
              break;
            }
          }
        }
      }
    });

    if (shouldProcess) addPostsCountToModComponent();
  });

  modTileObserver.observe(document.body, { childList: true, subtree: true });

  // Run once immediately
  addPostsCountToModComponent();
}

// === Init / toggle ==========================================================

function removePostCountElements() {
  const modTiles = document.querySelectorAll('[data-e2eid="mod-tile"]');
  modTiles.forEach(modTile => {
    const postsElement = modTile.querySelector(".mod-tile-posts-count-element");
    if (postsElement) postsElement.remove();

    modTile.removeAttribute("data-posts-added");
    modTile.removeAttribute("data-posts-observed");
    modTile.removeAttribute("data-posts-requested");
  });

  postsFetched = 0;

  if (modTileObserver) {
    modTileObserver.disconnect();
    modTileObserver = null;
  }
  if (modTileIntersectionObserver) {
    modTileIntersectionObserver.disconnect();
    modTileIntersectionObserver = null;
  }
}

function initModComponentTweaks() {
  chrome.storage.sync.get({ displayPostCount: true }, function(items) {
    if (!items.displayPostCount) {
      removePostCountElements();
      return;
    }

    if (document.querySelector('[data-e2eid="mod-tile"]')) {
      setupModComponentObserver();
    } else {
      const observer = new MutationObserver((mutations, obs) => {
        if (document.querySelector('[data-e2eid="mod-tile"]')) {
          setupModComponentObserver();
          obs.disconnect();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
}

chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === "sync" && changes.displayPostCount) {
    const newValue = changes.displayPostCount.newValue;
    if (newValue === true) initModComponentTweaks();
    else if (newValue === false) removePostCountElements();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModComponentTweaks);
} else {
  initModComponentTweaks();
}
