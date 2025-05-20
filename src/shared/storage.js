// src/shared/storage.js
import { CHANGELOG_CACHE_PREFIX, CACHE_EXPIRY_DAYS } from './constants';

function getCacheKey(url) {
  return CHANGELOG_CACHE_PREFIX + btoa(url).replace(/[^a-z0-9]/gi, '');
}

export function saveToCache(url, data) {
  try {
    const cacheData = {
      data,
      expiry: Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    };
    localStorage.setItem(getCacheKey(url), JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Failed to save to cache:', e);
  }
}

export function getFromCache(url) {
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