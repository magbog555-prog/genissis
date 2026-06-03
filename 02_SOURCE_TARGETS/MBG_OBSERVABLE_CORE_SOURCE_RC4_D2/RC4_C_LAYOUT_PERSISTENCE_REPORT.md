# RC4-C Layout Persistence Report

## Status

RC4-C adds versioned frontend layout persistence on top of RC4-B.

```text
Stage: RC4-C — Layout Persistence
Base: RC4-B Frontend UX/Layout Hotfix
Storage: localStorage
Schema: rc4-c-layout-v1
Key: mbg.rc4c.layout.v1
```

## Persisted state

```text
open tabs
tab order
active tab
panel x/y positions
panel width/height
panel visible/hidden state
panel collapsed state
z order
compact mode
RU language
adapter mode
selected scenario
workspace mode
theme / density / scale / visual settings
block accent colors
```

## Manual reset only

The reset button clears the versioned layout key and resets the operator workspace intentionally.

```text
Reset layout = manual action only
No automatic layout reset on reload
No automatic layout reset on frontend restart
```

## Window/content rule

```text
The window owns the size.
Content scrolls inside the window.
Raw JSON scrolls inside its own container.
```

## Safety

RC4-C does not add execution, POST endpoints, private API keys, trading buttons, strategies, or signed endpoints.

```text
NO PROOF → NO ALLOW remains unchanged
executionSurface = closed
actionVerdict = prohibited
trustState = UNCERTAIN
```
