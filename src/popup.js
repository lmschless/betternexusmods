const { saveOptions, restoreOptions } = window.optionsUtil;

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('options-form').addEventListener('submit', saveOptions);
