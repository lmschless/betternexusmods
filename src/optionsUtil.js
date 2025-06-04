(function(window){
  function saveOptions(e) {
    if (e && e.preventDefault) e.preventDefault();
    const hideDownloadedMods = document.getElementById('hideDownloadedMods').checked;
    const hoverChangelogs = document.getElementById('hoverChangelogs').checked;
    const infiniteScroll = document.getElementById('infiniteScroll').checked;
    const displayPostCount = document.getElementById('displayPostCount').checked;
    const data = {
      hideDownloadedMods,
      hoverChangelogs,
      infiniteScroll,
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
      hideDownloadedMods: true,
      hoverChangelogs: true,
      infiniteScroll: true,
      displayPostCount: true,
      darkMode: false
    }, function(items) {
      document.getElementById('hideDownloadedMods').checked = (typeof items.hideDownloadedMods === 'boolean') ? items.hideDownloadedMods : true;
      document.getElementById('hoverChangelogs').checked = (typeof items.hoverChangelogs === 'boolean') ? items.hoverChangelogs : true;
      document.getElementById('infiniteScroll').checked = (typeof items.infiniteScroll === 'boolean') ? items.infiniteScroll : true;
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
