const POSTS_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

// Simple in-memory cache to avoid hitting chrome.storage write limits
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

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'fetchPostCount' && msg.url) {
    handlePostCount(msg.url)
      .then(data => respond({ data }))
      .catch(err => respond({ error: err.toString() }));
    return true; // indicates async response
  }
});

async function handlePostCount(url) {
  const cached = postsCache[url];
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const data = await queueFetchPostCount(url);
  postsCache[url] = { data, expiry: Date.now() + POSTS_CACHE_EXPIRY_MS };
  return data;
}

async function fetchPostCount(url) {
  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) throw new Error('Network error');
  const text = await resp.text();
  const match = text.match(/data-nexus-posts-count="(\d+)"/);
  return match ? match[1] : '0';
}
