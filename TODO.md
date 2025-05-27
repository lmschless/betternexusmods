# TODO List - BetterNexusMods Extension

## High Priority
- [x] Finalize and stabilize automated tests for `modComponentTweaks.js`.
  - [x] Ensure `fetchPostsCount` mocking is robust.
  - [x] Resolve issues with JSDOM not reflecting DOM changes for post count element.
  - [ ] Add test case for when `displayPostCount` is false on initial load.
  - [ ] Add test case for toggling `displayPostCount` from true to false.
  - [ ] Add test case for toggling `displayPostCount` from false to true.
  - [ ] Add test case for dynamic content addition (MutationObserver for new mod tiles).
- [ ] Investigate and implement other planned mod component tweaks.

## Medium Priority
- [ ] Refactor `modComponentTweaks.js` to be more modular (e.g., using ES modules) to simplify testing and improve organization.
- [ ] Review and improve caching mechanism for post counts (e.g., consider background script for fetching if content script limitations are hit).

## Low Priority
- [ ] Explore options for more advanced end-to-end testing (e.g., Puppeteer, Playwright) if JSDOM limitations become too restrictive for certain features.
