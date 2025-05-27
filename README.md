# Release Notes - BetterNexusMods v0.1.6

## New Features & Enhancements:

This version introduces several new features to enhance your Nexus Mods browsing experience. All features can be toggled on or off via the extension's popup menu.

*   **Hide Downloaded Mods:** Automatically hides mods that you have already downloaded, decluttering mod listings.
*   **Changelog on Hover:** Quickly view a mod's recent changelog by simply hovering over a designated icon or area (details may vary based on Nexus Mods page structure).
*   **Infinite Scrolling:** Seamlessly load more mods as you scroll down on mod listing pages, eliminating the need for pagination.
*   **Display Post Count:** Shows the number of posts (comments) directly on the mod tile or mod page, giving you a quick insight into community discussion.

We hope you enjoy these new improvements! Please report any issues or provide feedback.

# Known Issues - BetterNexusMods Extension

## Active Issues
1.  **Post Counts Not Appearing on Subsequent Pages/Infinite Scroll**
    -   **Description**: Post counts are correctly displayed on the initial mod listing page. However, when navigating to subsequent pages or when new mods are loaded via infinite scroll (e.g., by `infinitescroll.js`), the post counts do not appear for these newly loaded mod tiles.
    -   **Status**: Newly reported.
    -   **Suspected Cause**: The `MutationObserver` (`modTileObserver`) in `setupModComponentObserver` might not be correctly identifying or processing all newly added mod tiles after the initial page load, or `addPostsCountToModComponent` is not being (re)triggered effectively for these new tiles.
    -   **Status**: Under investigation.
    -   **Suspected Cause**: Potential issues with JSDOM's handling of `innerHTML` with SVGs, `insertBefore`/`appendChild` in an async context, or the interaction with `@testing-library/dom`'s `waitFor`.
    -   **Last Attempted Fix**: Reverted temporary simplification of `postsElement.innerHTML` as it broke browser functionality. Next step is to add more detailed logging within `waitFor` and the script itself during test execution.

## Resolved Issues
-   **Duplicate/Persistent Post Count Icons**
    -   **Description**: Post count icons were not correctly removed when the "display posts count" option was toggled off, and duplicates appeared when toggled back on.
    -   **Status**: Resolved (Commit: `2a9f57b`).
    -   **Fix**: Corrected logic in `removePostCountElements` and the `chrome.storage.onChanged` listener.
-   **ReferenceError: observer is not defined**
    -   **Description**: A `ReferenceError` occurred in `setupModComponentObserver` in Brave browser due to incorrect variable usage.
    -   **Status**: Resolved.
    -   **Fix**: Corrected `observer.observe(...)` to `modTileObserver.observe(...)`.
-   **Jest Tests Failing for `modComponentTweaks.js`**
    -   **Description**: Jest tests for `modComponentTweaks.js` were failing due to issues with mocking `fetchPostsCount`, DOM element assertions, and environment variable (`global.isTestEnvironment`) setup.
    -   **Status**: Resolved.
    -   **Fix**: Implemented conditional logic in `fetchPostsCount` based on `global.isTestEnvironment` (set in `jest.setup.js`), corrected DOM querying in tests, and ensured `waitFor` allowed asynchronous updates to complete.
-   **Post Count Display Issues in Browser**
    -   **Description**: Post counts were not appearing or appearing incorrectly in the browser due to: a) `ReferenceError: global is not defined` because of direct use of `global.isTestEnvironment`, and b) incorrect DOM element selection logic for sibling spans, and c) incorrect insertion order priority.
    -   **Status**: Resolved.
    -   **Fix**: Changed `global.isTestEnvironment` checks to `(typeof global !== 'undefined' && global.isTestEnvironment)`. Corrected sibling span selection to use `child.matches()` instead of `child.querySelector()`. Re-prioritized DOM insertion logic to favor placing posts after 'downloads' span.
