// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleWindowButton');

  toggleButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleFloatingWindow' });
      }
    });
  });
});
