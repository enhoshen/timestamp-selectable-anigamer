// content.js

// Helper function for throttling calls
function throttle(callback, interval) {
  let waiting = false;
  return function(...args) {
    if (!waiting) {
      callback.apply(this, args);
      // waiting = true;
      // requestAnimationFrame(() => {
      //   waiting = false;
      // });
      setTimeout(() => {
      }, interval);
    }
  };
}

// Floating window structure - timestamp is now inside the copy button
const floatingWindowHTML = `
  <div id="extension-floating-window">
    <div id="extension-window-header">
      <button id="extension-hide-reveal-button">_</button>
      <button id="extension-copy-button">
        <p id="extension-timestamp-display">Loading...</p>
      </button>
    </div>
  </div>
`;

// Floating window styles
const floatingWindowCSS = `
  #extension-floating-window {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 250px;
    height: 100px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    z-index: 9999;
    font-family: Arial, sans-serif;
    overflow: hidden;
    transition: all 0.3s ease-in-out;
  }
  /* Minimized state: transforms into a tab on the right edge */
  #extension-floating-window.minimized {
    width: 250px; /* Reduced width for the tab */
    height: 100px; /* Fixed height for the tab */
    right: 0; /* Snap to the right edge */
    top: 20px; /* Maintain vertical position */
    box-shadow: 0 0 10px rgba(0,0,0,0.6);
  }
  #extension-window-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: rgba(0, 0, 0, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    cursor: grab; /* Indicate draggable */
  }
  /* Styling for the hide/reveal button to make it a visible box */
  #extension-hide-reveal-button {
    background-color: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: white;
    font-size: 1.1em;
    cursor: pointer;
    padding: 5px 10px; /* Increased padding */
    border-radius: 5px;
    font-weight: bold;
    width: 60px; /* Fixed width for button */
    height: 15px; /* Fixed height for button */
    display: flex;
    justify-content: center;
    align-items: center;
    transition: background-color 0.2s ease;
  }
  #extension-hide-reveal-button:hover {
    background-color: rgba(255, 255, 255, 0.4);
  }
  /* Style for the copy button which now contains the timestamp */
  #extension-copy-button {
    background-color: #4CAF50; /* Green */
    color: white;
    border: none;
    border-radius: 5px;
    padding: 8px 15px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-grow: 1; /* Allow button to grow to fill available space */
    margin-left: 10px; /* Space between hide button and copy button */
  }
  #extension-copy-button:hover {
    background-color: #45a049;
  }
  #extension-copy-button p {
    margin: 0; /* Remove default margin from paragraph */
    font-size: 1.1em;
    word-break: break-all; /* Ensure long timestamps are broken */
  }
  /* Hide content when minimized */
  #extension-floating-window.minimized #extension-window-header {
    border-bottom: none;
    padding: 5px;
    background-color: rgba(0, 0, 0, 0.7);
  }
  #extension-floating-window.minimized #extension-window-header span {
    display: none; /* Hide title when minimized */
  }
  /* Ensure the timestamp text is visible in minimized state if header is shown */
  #extension-floating-window.minimized #extension-copy-button p {
      display: block; /* Ensure it's visible if the header is */
  }
`;

let isWindowVisible = true;
let isDragging = false;
let offsetX, offsetY;
let initialRight, initialTop; // To store position before minimizing
let timestampDisplayElement;
let copyButtonElement;
let hideRevealButtonElement;
let floatingWindowElement;

// Add a listener for messages from the extension popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleFloatingWindow') {
    toggleWindowVisibility();
    // After toggling, we should send the *new* state back to the popup
    sendResponse({ isVisible: isWindowVisible });
  } else if (message.action === 'getFloatingWindowVisibility') {
    sendResponse({ isVisible: isWindowVisible });
  }
  return true; // Indicates an asynchronous response
});

function createFloatingWindow() {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = floatingWindowCSS;
  document.head.appendChild(styleSheet);

  const div = document.createElement('div');
  div.innerHTML = floatingWindowHTML;
  document.body.appendChild(div.firstElementChild);

  floatingWindowElement = document.getElementById('extension-floating-window');
  timestampDisplayElement = document.getElementById('extension-timestamp-display');
  copyButtonElement = document.getElementById('extension-copy-button');
  hideRevealButtonElement = document.getElementById('extension-hide-reveal-button');

  // Ensure elements are found before adding listeners
  if (!floatingWindowElement || !timestampDisplayElement || !copyButtonElement || !hideRevealButtonElement) {
    console.error('Extension: Failed to find essential DOM elements.');
    return;
  }

  hideRevealButtonElement.addEventListener('click', toggleWindowVisibility);
  copyButtonElement.addEventListener('click', copyTimestampToClipboard);

  // Add drag functionality
  const header = document.getElementById('extension-window-header');
  header.addEventListener('mousedown', startDrag);
  // Throttle mousemove event for performance
  // document.addEventListener('mousemove', throttle(dragWindow, 30)); // Throttle to ~60fps
  // document.addEventListener('mousemove', dragWindow);
  document.addEventListener('mousemove', throttle(captureMouse, captureInterval));
  document.addEventListener('mouseup', stopDrag);
  // document.addEventListener('mouseup', dragWindow);

  // Add a general click listener to the floating window itself, as a potential workaround
  // for the disappearance issue observed when the window is not interacted with.
  floatingWindowElement.addEventListener('click', () => {
    // This click might help stabilize the window or player elements.
    updateTimestampDisplay();
  });
}

function startDrag(e) {
  // console.log("start dragging")
  // Prevent drag if clicking on buttons within the header
  if (e.target === hideRevealButtonElement || e.target === copyButtonElement || e.target.parentNode === copyButtonElement) return;

  isDragging = true;
  // Calculate the offset from the mouse pointer to the element's top-left corner
  offsetX = e.clientX - floatingWindowElement.getBoundingClientRect().left;
  offsetY = e.clientY - floatingWindowElement.getBoundingClientRect().top;

  // Store current position to restore later
  initialRight = floatingWindowElement.style.right;
  initialTop = floatingWindowElement.style.top;
  if (!initialRight || !initialTop || initialRight === 'auto' || initialTop === 'auto') { // Set defaults if not already set or auto
    initialRight = '20px';
    initialTop = '20px';
  }

  // Prevent default text selection behavior during drag
  e.preventDefault();
  // console.log("end dragging")
}
let mouse = { x: 0, y: 0 }
let captureInterval = 50;
function captureMouse(e) {
  mouse.x = e.x;
  mouse.y = e.y;
}

function dragWindow(e) {
  if (!isDragging) return;
  // console.log("dragging");

  // Calculate new position based on mouse movement and offset
  // let newX = e.clientX - offsetX;
  // let newY = e.clientY - offsetY;
  let newX = mouse.x - offsetX;
  let newY = mouse.y - offsetY;

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const windowWidth = floatingWindowElement.offsetWidth;
  const windowHeight = floatingWindowElement.offsetHeight;

  // Constrain movement within viewport bounds
  newX = Math.max(0, Math.min(newX, viewportWidth - windowWidth));
  newY = Math.max(0, Math.min(newY, viewportHeight - windowHeight));

  // Update element's position using CSS properties
  floatingWindowElement.style.left = newX + 'px';
  // floatingWindowElement.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
  floatingWindowElement.style.right = 'auto'; // Important: 'right' needs to be 'auto' when positioning with 'left'
  floatingWindowElement.style.top = newY + 'px';
  floatingWindowElement.style.bottom = 'auto'; // Important: 'bottom' needs to be 'auto' when positioning with 'top'
}

function stopDrag() {
  isDragging = false;
  // When drag stops, revert to using 'right' and 'top' for static positioning
  const currentLeft = parseFloat(floatingWindowElement.style.left);
  const currentTop = parseFloat(floatingWindowElement.style.top);

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const windowWidth = floatingWindowElement.offsetWidth;
  const windowHeight = floatingWindowElement.offsetHeight;

  // Check if left/top are valid positions after drag
  if (!isNaN(currentLeft) && currentLeft >= 0 && currentLeft <= viewportWidth - windowWidth) {
    floatingWindowElement.style.left = currentLeft + 'px';
  } else {
    floatingWindowElement.style.left = 'auto'; // Clear if invalid, will fall back to right
  }

  if (!isNaN(currentTop) && currentTop >= 0 && currentTop <= viewportHeight - windowHeight) {
    floatingWindowElement.style.top = currentTop + 'px';
  } else {
    floatingWindowElement.style.top = 'auto'; // Clear if invalid, will fall back to initialTop
  }

  // If left/top were cleared or invalid, use stored initial values
  // if (floatingWindowElement.style.left === 'auto' || floatingWindowElement.style.left === '') floatingWindowElement.style.left = 'auto';
  // if (floatingWindowElement.style.top === 'auto' || floatingWindowElement.style.top === '') floatingWindowElement.style.top = 'auto';
  // if (floatingWindowElement.style.right === '' || floatingWindowElement.style.right === 'auto') floatingWindowElement.style.right = initialRight;
  // if (floatingWindowElement.style.bottom === '' || floatingWindowElement.style.bottom === 'auto') floatingWindowElement.style.bottom = initialTop;
}

function toggleWindowVisibility() {
  isWindowVisible = !isWindowVisible;
  if (isWindowVisible) {
    // Restore window to its previous size and position
    floatingWindowElement.classList.remove('minimized');
    hideRevealButtonElement.textContent = '_'; // Restore minimize icon

    // Restore original dimensions and positioning
    floatingWindowElement.style.width = '250px'; // Restore original width
    floatingWindowElement.style.height = '100px'; // Restore auto height
    floatingWindowElement.style.left = 'auto'; // Ensure it uses right/top positioning
    floatingWindowElement.style.top = 'auto';
    floatingWindowElement.style.right = initialRight;
    floatingWindowElement.style.bottom = initialTop;

  } else {
    // Minimize window to a tab
    floatingWindowElement.classList.add('minimized');
    hideRevealButtonElement.textContent = '+'; // Change to '+' to indicate it can be expanded

    // Store current position before minimizing, to restore later
    const computedStyle = window.getComputedStyle(floatingWindowElement);
    initialRight = computedStyle.right;
    initialTop = computedStyle.top;

    // If computed styles are 'auto', fall back to defaults or current inline styles
    if (initialRight === 'auto' || !initialRight) initialRight = floatingWindowElement.style.right || '20px';
    if (initialTop === 'auto' || !initialTop) initialTop = floatingWindowElement.style.top || '20px';

    // Clear inline left/top if they exist from dragging, to allow minimized CSS to take over
    floatingWindowElement.style.left = '';
    floatingWindowElement.style.top = '';
  }
}

function getTimestamp() {
  // Selector for the Video.js current time display element
  const timestampSelector = '.BH_background .container-player .player .videoframe .video #video-container .video-js .vjs-control-bar .vjs-time-control.vjs-current-time .vjs-current-time-display';
  const timeDisplay = document.querySelector(timestampSelector);
  return timeDisplay ? timeDisplay.textContent : null;
}

function updateTimestampDisplay() {
  try {
    const timestamp = getTimestamp();
    if (timestamp) {
      timestampDisplayElement.textContent = timestamp;
    } else {
      timestampDisplayElement.textContent = 'Video not active';
    }
  } catch (error) {
    console.error('Extension: Error updating timestamp display:', error);
    timestampDisplayElement.textContent = 'Error'; // Indicate an error occurred
  }
}

function copyTimestampToClipboard() {
  const timestamp = timestampDisplayElement.textContent;
  if (timestamp && timestamp !== 'Loading...' && timestamp !== 'Video not active' && timestamp !== 'Error') {
    const copy = `* [${timestamp}]()`;
    navigator.clipboard.writeText(copy).then(() => {
      // Feedback: change button text briefly to 'Copied!'
      const originalText = copyButtonElement.querySelector('p').textContent;
      copyButtonElement.querySelector('p').textContent = 'Copied!';
      setTimeout(() => {
        copyButtonElement.querySelector('p').textContent = originalText;
      }, 1500);
    }).catch(err => {
      console.error('Extension: Failed to copy timestamp:', err);
      // Optional: provide error feedback on the display
      const originalText = copyButtonElement.querySelector('p').textContent;
      copyButtonElement.querySelector('p').textContent = 'Copy Failed';
      setTimeout(() => {
        copyButtonElement.querySelector('p').textContent = originalText;
      }, 1500);
    });
  }
}

// Initial setup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    createFloatingWindow();
    // Start polling for the timestamp
    // Use setInterval with error handling to keep the script running
    setInterval(updateTimestampDisplay, 500); // Update every 500ms
    setInterval(dragWindow, 30);
  });
} else {
  // DOM is already ready
  createFloatingWindow();
  setInterval(updateTimestampDisplay, 500); // Update every 500ms
  setInterval(dragWindow, 30);
}
