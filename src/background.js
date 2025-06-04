const POSTS_CACHE_PREFIX = 'nmdh_posts_';
const POSTS_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

function getCacheKey(url) {
  return POSTS_CACHE_PREFIX + btoa(url).replace(/[^a-z0-9]/gi, '');
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'fetchPostCount' && msg.url) {
    handlePostCount(msg.url).then(data => respond({ data }))
      .catch(err => respond({ error: err.toString() }));
    return true; // indicates async response
  }
});

async function handlePostCount(url) {
  const key = getCacheKey(url);
  const stored = await chrome.storage.local.get(key);
  if (stored[key]) {
    try {
      const item = JSON.parse(stored[key]);
      if (Date.now() < item.expiry) {
        return item.data;
      }
    } catch (e) {}
  }
  const data = await fetchPostCount(url);
  await chrome.storage.local.set({ [key]: JSON.stringify({ data, expiry: Date.now() + POSTS_CACHE_EXPIRY_MS }) });
  return data;
}

async function fetchPostCount(url) {
  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) throw new Error('Network error');
  const text = await resp.text();
  const match = text.match(/data-nexus-posts-count="(\d+)"/);
  return match ? match[1] : '0';
}
