# Welcome to ReadItDown

A minimal markdown viewer. This folder exercises every feature.

## Links

- External: [tauri.app](https://tauri.app) opens in your browser
- Relative file: [notes/deep.md](notes/deep.md) opens in a new tab
- Root-absolute file: [/notes/deep.md](/notes/deep.md)
- Anchor: [jump to the table](#table)

## Image

Markdown image (relative path):

![red pixel](img/pixel.png)

## Embedded HTML

<div style="border: 1px solid #d1d9e0; border-radius: 6px; padding: 12px;">
  <b>Raw HTML block</b> with an image tag:
  <img src="img/pixel.png" width="48" height="48" alt="scaled pixel" />
  <details>
    <summary>Click to expand</summary>
    Hidden content inside <code>&lt;details&gt;</code>.
  </details>
</div>

## Table

| Feature | Status | Notes |
|---|---|---|
| Split views | done | one tab strip per pane, drag the divider |
| Edit while viewing | done | Edit button, live preview, Ctrl+S saves |
| Wrap toggle | done | try the Wrap/Scroll button on this long row: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua |

## Code

```rust
fn main() {
    println!("a long line to test horizontal scrolling in nowrap mode ------------------------------------------------ end");
}
```

## Long paragraph

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
