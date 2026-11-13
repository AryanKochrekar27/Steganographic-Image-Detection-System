/*
 * content.js — StegoDetect Guard
 *
 * Adds a "Scan for Steganography" option when the user right-clicks
 * an image on any webpage. Sends the image URL to the background worker
 * which pings the Flask API and shows a notification.
 */

(function () {
  'use strict';

  let lastRightClickedImg = null;

  // Track the last image the user right-clicked
  document.addEventListener('contextmenu', (e) => {
    const el = e.target;
    if (el.tagName === 'IMG' && el.src) {
      lastRightClickedImg = el.src;
    } else {
      lastRightClickedImg = null;
    }
  });

  // Listen for scan request from background (triggered via context menu)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_LAST_IMG') {
      sendResponse({ url: lastRightClickedImg });
    } else if (msg.type === 'FETCH_BLOB') {
      fetch(msg.url)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = () => sendResponse({ dataUri: reader.result });
          reader.onerror = () => sendResponse({ error: 'Failed to read blob in content script' });
          reader.readAsDataURL(blob);
        })
        .catch(err => sendResponse({ error: err.message }));
      return true; // Keep message channel open for async response
    }
  });

})();
