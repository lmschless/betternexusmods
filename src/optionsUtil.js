(function(window){
  function saveOptions(e) {
    if (e && e.preventDefault) e.preventDefault();
    const hideDownloadedMods = document.getElementById('hideDownloadedMods').checked;
    const displayPostCount = document.getElementById('displayPostCount').checked;
    const downloadedModsFilter = hideDownloadedMods ? 'hide' : 'off';
    const data = {
      hideDownloadedMods,
      downloadedModsFilter,
      displayPostCount
    };
    const darkModeEl = document.getElementById('darkMode');
    if (darkModeEl) {
      data.darkMode = darkModeEl.checked;
    }
    chrome.storage.sync.set(data, function() {
      if (darkModeEl) applyDarkMode(darkModeEl.checked);
      const status = document.getElementById('status');
      if (status) {
        status.textContent = 'Options saved.';
        setTimeout(() => { status.textContent = ''; }, 1000);
      }
    });
  }

  function restoreOptions() {
    chrome.storage.sync.get({
      downloadedModsFilter: 'hide',
      hideDownloadedMods: true,
      displayPostCount: true,
      darkMode: false
    }, function(items) {
      const hideDownloadedMods = typeof items.downloadedModsFilter === 'string'
        ? items.downloadedModsFilter === 'hide'
        : items.hideDownloadedMods !== false;
      document.getElementById('hideDownloadedMods').checked = hideDownloadedMods;
      document.getElementById('displayPostCount').checked = (typeof items.displayPostCount === 'boolean') ? items.displayPostCount : true;
      const darkModeEl = document.getElementById('darkMode');
      if (darkModeEl) {
        darkModeEl.checked = (typeof items.darkMode === 'boolean') ? items.darkMode : false;
      }
      applyDarkMode(items.darkMode);
    });
  }

  function applyDarkMode(enabled) {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('dark-mode', !!enabled);
    }
  }

  window.optionsUtil = { saveOptions, restoreOptions, applyDarkMode };
})(window);
