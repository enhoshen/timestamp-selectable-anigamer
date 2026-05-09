// content.js

// Helper function for throttling calls
function throttle(callback, interval) {
  let waiting = false;
  return function (...args) {
    if (!waiting) {
      callback.apply(this, args);
      // waiting = true;
      // requestAnimationFrame(() => {
      //   waiting = false;
      // });
      setTimeout(() => {}, interval);
    }
  };
}

// Floating window structure
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

let isWindowVisible = true;
let isDragging = false;
let offsetX, offsetY;
let initialRight, initialTop; // To store position before minimizing
let timestampDisplayElement;
let copyButtonElement;
let hideRevealButtonElement;
let floatingWindowElement;
let mouse = { x: 0, y: 0 };
let captureInterval = 50;
let updateTimestamp;

// Add a listener for messages from the extension popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleFloatingWindow") {
    toggleWindowVisibility();
    // After toggling, we should send the *new* state back to the popup
    sendResponse({ isVisible: isWindowVisible });
  } else if (message.action === "getFloatingWindowVisibility") {
    sendResponse({ isVisible: isWindowVisible });
  }
  return true; // Indicates an asynchronous response
});

function createFloatingWindow() {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  document.head.appendChild(styleSheet);

  const div = document.createElement("div");
  div.innerHTML = floatingWindowHTML;
  document.body.appendChild(div.firstElementChild);

  floatingWindowElement = document.getElementById("extension-floating-window");
  setElementBottomLeft(floatingWindowElement);
  timestampDisplayElement = document.getElementById(
    "extension-timestamp-display",
  );
  copyButtonElement = document.getElementById("extension-copy-button");
  hideRevealButtonElement = document.getElementById(
    "extension-hide-reveal-button",
  );

  // Ensure elements are found before adding listeners
  if (
    !floatingWindowElement ||
    !timestampDisplayElement ||
    !copyButtonElement ||
    !hideRevealButtonElement
  ) {
    console.error("Extension: Failed to find essential DOM elements.");
    return;
  }

  hideRevealButtonElement.addEventListener("click", toggleWindowVisibility);
  copyButtonElement.addEventListener("click", copyTimestampToClipboard);

  // Add drag functionality
  const header = document.getElementById("extension-window-header");
  header.addEventListener("mousedown", startDrag);
  // Throttle mousemove event for performance
  // document.addEventListener('mousemove', throttle(dragWindow, 30)); // Throttle to ~60fps
  document.addEventListener("mousemove", dragWindow);
  // document.addEventListener(
  //   "mousemove",
  //   throttle(captureMouse, captureInterval),
  // );
  document.addEventListener("mouseup", stopDrag);
  // document.addEventListener('mouseup', dragWindow);
}

function startDrag(e) {
  // console.log("start dragging")
  // Prevent drag if clicking on buttons within the header
  if (
    e.target === hideRevealButtonElement ||
    e.target === copyButtonElement ||
    e.target.parentNode === copyButtonElement
  )
    return;
  clearInterval(updateTimestamp);

  isDragging = true;
  // Calculate the offset from the mouse pointer to the element's top-left corner
  offsetX = e.clientX - floatingWindowElement.getBoundingClientRect().left;
  offsetY = e.clientY - floatingWindowElement.getBoundingClientRect().top;

  // Store current position to restore later
  initialRight = floatingWindowElement.style.right;
  initialTop = floatingWindowElement.style.top;
  if (
    !initialRight ||
    !initialTop ||
    initialRight === "auto" ||
    initialTop === "auto"
  ) {
    initialRight = "20px";
    initialTop = "20px";
  }

  // Prevent default text selection behavior during drag
  e.preventDefault();
  // console.log("end dragging")
}
function captureMouse(e) {
  mouse.x = e.x;
  mouse.y = e.y;
}

function moveWindow(e, captureMouse = true) {
  // Calculate new position based on mouse movement and offset
  let newX;
  let newY;
  if (captureMouse) {
    newX = e.clientX - offsetX;
    newY = e.clientY - offsetY;
  } else {
    // mouse position is captured somewhere else
    newX = mouse.x - offsetX;
    newY = mouse.y - offsetY;
  }

  [newX, newY] = boundaryCheck(newX, newY);

  // Update element's position using CSS properties
  setElementPos(floatingWindowElement, newX, newY);
}

function boundaryCheck(x, y) {
  let newX, newY;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const windowWidth = floatingWindowElement.offsetWidth;
  const windowHeight = floatingWindowElement.offsetHeight;

  newX = Math.max(0, Math.min(x, viewportWidth - windowWidth));
  newY = Math.max(0, Math.min(y, viewportHeight - windowHeight));
  return [newX, newY];
}

function setElementPos(element, x, y) {
  // console.log(`${left}px ${top}px`);
  [x, y] = boundaryCheck(x, y);
  element.style.left = x + "px";
  element.style.right = "auto"; // Important: 'right' needs to be 'auto' when positioning with 'left'
  element.style.top = y + "px";
  element.style.bottom = "auto"; // Important: 'bottom' needs to be 'auto' when positioning with 'top'
}

function setElementBottomLeft(element, padding = 20) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  setElementPos(element, padding, viewportHeight - padding);
}

function dragWindow(e) {
  if (!isDragging) return;
  moveWindow(e);
}

function checkWindow() {
  // When drag stops, revert to using 'right' and 'top' for static positioning
  const currentLeft = parseFloat(floatingWindowElement.style.left);
  const currentTop = parseFloat(floatingWindowElement.style.top);

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const windowWidth = floatingWindowElement.offsetWidth;
  const windowHeight = floatingWindowElement.offsetHeight;

  // Check if left/top are valid positions after drag
  if (
    !isNaN(currentLeft) &&
    currentLeft >= 0 &&
    currentLeft <= viewportWidth - windowWidth
  ) {
    floatingWindowElement.style.left = currentLeft + "px";
  } else {
    floatingWindowElement.style.left = "0px";
  }

  if (
    !isNaN(currentTop) &&
    currentTop >= 0 &&
    currentTop <= viewportHeight - windowHeight
  ) {
    floatingWindowElement.style.top = currentTop + "px";
  } else {
    floatingWindowElement.style.top = viewportHeight - windowHeight + "px"; // Clear if invalid, will fall back to initialTop
  }

  // If left/top were cleared or invalid, use stored initial values
  // if (floatingWindowElement.style.left === 'auto' || floatingWindowElement.style.left === '') floatingWindowElement.style.left = 'auto';
  // if (floatingWindowElement.style.top === 'auto' || floatingWindowElement.style.top === '') floatingWindowElement.style.top = 'auto';
  // if (floatingWindowElement.style.right === '' || floatingWindowElement.style.right === 'auto') floatingWindowElement.style.right = initialRight;
  // if (floatingWindowElement.style.bottom === '' || floatingWindowElement.style.bottom === 'auto') floatingWindowElement.style.bottom = initialTop;
}

function stopDrag(e) {
  if (!isDragging) return;
  isDragging = false;
  // checkWindow(e);
  moveWindow(e);
  updateTimestamp = setInterval(updateTimestampDisplay, 500); // Update every 500ms
}

function toggleWindowVisibility() {
  isWindowVisible = !isWindowVisible;
  if (isWindowVisible) {
    // Restore window to its previous size and position
    floatingWindowElement.classList.remove("minimized");
    hideRevealButtonElement.textContent = "_"; // Restore minimize icon

    // Restore original dimensions and positioning
    floatingWindowElement.style.left = "auto"; // Ensure it uses right/top positioning
    floatingWindowElement.style.top = "auto";
    floatingWindowElement.style.right = initialRight;
    floatingWindowElement.style.bottom = initialTop;
  } else {
    // Minimize window to a tab
    floatingWindowElement.classList.add("minimized");
    hideRevealButtonElement.textContent = "+"; // Change to '+' to indicate it can be expanded

    // Store current position before minimizing, to restore later
    const computedStyle = window.getComputedStyle(floatingWindowElement);
    initialRight = computedStyle.right;
    initialTop = computedStyle.top;

    // If computed styles are 'auto', fall back to defaults or current inline styles
    if (initialRight === "auto" || !initialRight)
      initialRight = floatingWindowElement.style.right || "20px";
    if (initialTop === "auto" || !initialTop)
      initialTop = floatingWindowElement.style.top || "20px";

    // Clear inline left/top if they exist from dragging, to allow minimized CSS to take over
    floatingWindowElement.style.left = "";
    floatingWindowElement.style.top = "";
  }
}

function getTimestamp() {
  // Selector for the Video.js current time display element
  const timestampSelector =
    ".BH_background .container-player .player .videoframe .video #video-container .video-js .vjs-control-bar .vjs-time-control.vjs-current-time .vjs-current-time-display";
  const timeDisplay = document.querySelector(timestampSelector);
  return timeDisplay ? timeDisplay.textContent : null;
}

function updateTimestampDisplay() {
  try {
    const timestamp = getTimestamp();
    if (timestamp) {
      timestampDisplayElement.textContent = timestamp;
    } else {
      timestampDisplayElement.textContent = "Video not active";
    }
  } catch (error) {
    console.error("Extension: Error updating timestamp display:", error);
    timestampDisplayElement.textContent = "Error"; // Indicate an error occurred
  }
}

function copyTimestampToClipboard() {
  const timestamp = timestampDisplayElement.textContent;
  if (
    timestamp &&
    timestamp !== "Loading..." &&
    timestamp !== "Video not active" &&
    timestamp !== "Error"
  ) {
    const copy = `* [${timestamp}]()`;
    navigator.clipboard
      .writeText(copy)
      .then(() => {
        // Feedback: change button text briefly to 'Copied!'
        const originalText = copyButtonElement.querySelector("p").textContent;
        copyButtonElement.querySelector("p").textContent = "Copied!";
        setTimeout(() => {
          copyButtonElement.querySelector("p").textContent = originalText;
        }, 1500);
      })
      .catch((err) => {
        console.error("Extension: Failed to copy timestamp:", err);
        // Optional: provide error feedback on the display
        const originalText = copyButtonElement.querySelector("p").textContent;
        copyButtonElement.querySelector("p").textContent = "Copy Failed";
        setTimeout(() => {
          copyButtonElement.querySelector("p").textContent = originalText;
        }, 1500);
      });
  }
}

// Initial setup
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    createFloatingWindow();
    updateTimestamp = setInterval(updateTimestampDisplay, 500);
  });
} else {
  createFloatingWindow();
  updateTimestamp = setInterval(updateTimestampDisplay, 500);
}
