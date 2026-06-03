# UI Usability Hotfix v0.8.6

- Disabled the auto ResizeObserver size-writing that caused detached windows to “run/shrink” by themselves.
- Window size now saves only after user mouse-up / manual resize.
- Added close (×) button to every block panel; it hides the block and can be restored from Settings.
- Workspace tabs now wrap into two rows and support mouse-wheel horizontal movement.
- Top bar and tab strip radius now obey the global radius setting.
- Detached DTO panels use a full-height JSON layout for Replay / Failure / Provenance / Recovery.
- Block color menu remains available directly on every panel header.
- Added stronger font application for visible controls.
- Build verified with `npm run build`.
