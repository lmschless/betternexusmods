// Saves options to chrome.storage
function saveOptions(e) {
    e.preventDefault();
    const hideDownloadedMods = document.getElementById('hideDownloadedMods').checked;
    const hoverChangelogs = document.getElementById('hoverChangelogs').checked;
    const infiniteScroll = document.getElementById('infiniteScroll').checked;
    chrome.storage.sync.set({
        hideDownloadedMods,
        hoverChangelogs,
        infiniteScroll
    }, function() {
        document.getElementById('status').textContent = 'Options saved.';
        setTimeout(() => {
            document.getElementById('status').textContent = '';
        }, 1000);
    });
}

// Restores checkbox state using the preferences stored in chrome.storage.
function restoreOptions() {
    chrome.storage.sync.get({
        hideDownloadedMods: true,
        hoverChangelogs: true,
        infiniteScroll: true
    }, function(items) {
        document.getElementById('hideDownloadedMods').checked = (typeof items.hideDownloadedMods === 'boolean') ? items.hideDownloadedMods : true;
        document.getElementById('hoverChangelogs').checked = (typeof items.hoverChangelogs === 'boolean') ? items.hoverChangelogs : true;
        document.getElementById('infiniteScroll').checked = (typeof items.infiniteScroll === 'boolean') ? items.infiniteScroll : true;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('options-form').addEventListener('submit', saveOptions);
