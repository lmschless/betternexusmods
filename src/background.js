const POSTS_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

// In-memory cache to reduce storage reads/writes
const postsCache = {};

// === Request queue to limit concurrent fetches ==============================
const MAX_ACTIVE_POST_REQUESTS = 3;
let activePostRequests = 0;
const postRequestQueue = [];

function processPostQueue() {
  if (activePostRequests >= MAX_ACTIVE_POST_REQUESTS) return;
  const next = postRequestQueue.shift();
  if (!next) return;

  activePostRequests++;
  fetchPostCount(next.url)
    .then(data => next.resolve(data))
    .catch(err => next.reject(err))
    .finally(() => {
      activePostRequests--;
      processPostQueue();
    });
}

function queueFetchPostCount(url) {
  return new Promise((resolve, reject) => {
    postRequestQueue.push({ url, resolve, reject });
    processPostQueue();
  });
}

// Purge expired keys at startup
purgeExpiredStorage();

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === "fetchPostCount" && msg.url) {
    handlePostCount(msg.url)
      .then(data => respond({ data }))
      .catch(err => respond({ error: err?.toString?.() || String(err) }));
    return true; // async response
  }
});

// === URL normalization ======================================================

function normalizeModUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    // Canonical mod page, keep path only
    u.hash = "";
    u.search = "";
    u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function addTabPosts(url) {
  try {
    const u = new URL(url);
    u.searchParams.set("tab", "posts");
    return u.toString();
  } catch {
    return url.includes("?") ? `${url}&tab=posts` : `${url}?tab=posts`;
  }
}

// === Extraction =============================================================

function extractPostsCount(htmlText) {
  // Your provided HTML snippet / screenshot 3:
  // <li id="mod-page-tab-posts"> ... <span class="alert">6</span>
  const m1 = htmlText.match(
    /<li[^>]*\bid=["']mod-page-tab-posts["'][\s\S]*?<span[^>]*\bclass=["'][^"']*\balert\b[^"']*["'][^>]*>\s*([\d,]+)\s*<\/span>/i
  );
  if (m1 && m1[1]) return m1[1].replace(/,/g, "");

  // Fallback: older attribute-based extraction (kept just in case)
  const m2 = htmlText.match(/data-nexus-posts-count=["'](\d+)["']/i);
  if (m2 && m2[1]) return m2[1];

  return null;
}

// === Main logic =============================================================

async function handlePostCount(rawUrl) {
  const url = normalizeModUrl(rawUrl);

  // in-memory cache
  const cached = postsCache[url];
  if (cached && Date.now() < cached.expiry) return cached.data;

  // persistent cache
  const stored = await readPostCountFromStorage(url);
  if (stored !== null && stored !== undefined) {
    postsCache[url] = { data: stored, expiry: Date.now() + POSTS_CACHE_EXPIRY_MS };
    return stored;
  }

  // fetch + parse
  const data = await queueFetchPostCount(url);

  postsCache[url] = { data, expiry: Date.now() + POSTS_CACHE_EXPIRY_MS };
  writePostCountToStorage(url, data, Date.now() + POSTS_CACHE_EXPIRY_MS);

  return data;
}

async function fetchPostCount(url) {
  // Use include to reduce “logged out HTML” surprises
  const doFetch = async (u) => {
    const resp = await fetch(u, { credentials: "include", redirect: "follow" });
    if (!resp.ok) throw new Error(`Network error (${resp.status})`);
    const text = await resp.text();
    return extractPostsCount(text);
  };

  // Try canonical mod page first
  let count = await doFetch(url);

  // If not found, try explicit tab=posts (some sites render tab content differently)
  if (count === null) {
    count = await doFetch(addTabPosts(url));
  }

  // If still not found, return "0"
  return count ?? "0";
}

// === Storage helpers ========================================================

function readPostCountFromStorage(url) {
  const key = `postCount_${url}`;
  return new Promise(resolve => {
    try {
      chrome.storage.local.get(key, items => {
        const entry = items[key];
        if (entry && entry.expiry && entry.expiry > Date.now()) {
          resolve(entry.value);
        } else {
          if (entry) chrome.storage.local.remove(key);
          resolve(null);
        }
      });
    } catch (err) {
      console.error("readPostCountFromStorage error:", err);
      resolve(null);
    }
  });
}

function writePostCountToStorage(url, value, expiry) {
  const key = `postCount_${url}`;
  try {
    chrome.storage.local.set({ [key]: { value, expiry } });
  } catch (err) {
    console.error("writePostCountToStorage error:", err);
  }
}

function purgeExpiredStorage() {
  try {
    chrome.storage.local.get(null, items => {
      const now = Date.now();
      const toRemove = Object.entries(items)
        .filter(([_, val]) => val && val.expiry && now >= val.expiry)
        .map(([key]) => key);

      if (toRemove.length) chrome.storage.local.remove(toRemove);
    });
  } catch (err) {
    console.error("purgeExpiredStorage error:", err);
  }
}