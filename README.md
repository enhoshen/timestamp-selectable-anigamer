# Selectable Video Time Chrome Extension

This Chrome extension allows users to select and copy the current timestamp displayed in Video
from site `ani.gamer (巴哈姆特動畫瘋)`

## Installation Instructions for Developers

To install and use this extension locally:

1.  **Clone the repository** (or create the project folder as described below if you don't have it in a Git repository).

2.  **Navigate to the project directory:**

    ```bash
    cd ~/timestamp-selectable-anigamer/
    ```

3.  **Load the Extension in Chrome:**
    - Open Google Chrome.
    - Navigate to `chrome://extensions/`.
    - Enable "Developer mode" by toggling the switch in the top-right corner.
    - Click the "Load unpacked" button in the top-left corner.
    - Select the `~/timestamp-selectable-anigamer/` directory.

The extension should now be active on the specified websites, making the video current time display selectable.

## How it Works

The extension injects custom CSS into matching web pages. This CSS targets the Video.js current time display element and sets its `user-select` property to `text` (with vendor prefixes for compatibility) using `!important` to override any conflicting styles on the page.

```css
/* Styles in styles.css */
.BH_background
  .container-player
  .player
  .videoframe
  .video
  #video-container
  .video-js
  .vjs-control-bar
  .vjs-time-control.vjs-current-time
  .vjs-current-time-display {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}
```

# Notes

Generated with help from google gemini
