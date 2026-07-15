# Bot Architecture Reuse Matrix

**Rule:** Do not copy old bot code into GENESIS.

| Source class | Example | Architecture idea | Reuse | Notes |
|---|---|---|---|---|
| Mechanical system books | Pardo, Kurguzkin | Spec → test → freeze parameters | REUSE_CONCEPT / REUSE_TEST_METHOD | Maps to research admission, not Producer |
| Strategy encyclopedias | Katz | Template libraries | ADAPT_WITH_REVIEW | Multiple-testing hazard |
| Indicator computing | LeBeau/Lucas | Feature pipelines | REUSE_DATA_MODEL | Under AFML hygiene only |
| Exchange robot manuals | Chebotarev | Polling/signal/order loop | DO_NOT_REUSE | Obsolete venue assumptions |
| HFT narratives | library “HFT revolution” etc. | Speed hierarchy awareness | REUSE_CONCEPT | Not an implementation blueprint |
| ML trading | Prado AFML | Event labels, purged CV, meta-labels | REUSE_RESEARCH_METHOD | Highest current research value |

## GENESIS mapping fence

```text
Literature bot loop
≠ organ runtime
≠ Producer
≠ Scenario permission
```
