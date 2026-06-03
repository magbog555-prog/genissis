# Scenario Audit — Wave 3 / Health Truth Cleanup

## Law
Unknown is better than fake true. Health must report only what the runtime has actually observed.

## Scenario HT-001 — Cold runtime has unknown websocket status

Given a new runtime with empty persistence.  
When `getHealthSnapshot()` is called before any health event.  
Then `wsConnected` is `unknown`, not `true`.  
And `healthTruthComplete` is `false`.  
And diagnostics include `connection_state_unknown`, `ws_status_unknown`, and `health_truth_partial`.

Evidence: `tests/scenarios/core-health-truth.ts`

## Scenario HT-002 — Explicit connected event sets websocket true

Given runtime health truth is unknown.  
When a valid `system.health.changed` event is committed with `connection=websocket` and `status=connected`.  
Then `wsConnected` is `true`.  
And the connection source event id is recorded.

Evidence: `tests/scenarios/core-health-truth.ts`

## Scenario HT-003 — Explicit disconnected event sets websocket false

Given websocket truth was previously known.  
When a valid `system.health.changed` event is committed with `connection=websocket` and `status=disconnected`.  
Then `wsConnected` is `false`.  
And the connection source event id is recorded.

Evidence: `tests/scenarios/core-health-truth.ts`

## Scenario HT-004 — Old connection observation becomes stale

Given a connection observation exists.  
When its timestamp is older than `MBG_HEALTH_CONNECTION_STATUS_TTL_MS`.  
Then `wsConnected` is `stale`.  
And diagnostics include `connection_state_stale` and `health_truth_partial`.

Evidence: `tests/scenarios/core-health-truth.ts`

## Scenario HT-005 — Health endpoint does not report fake true

Given the runtime API `/health` endpoint.  
When `/health` is requested from a cold runtime.  
Then response health has `wsConnected=unknown`, not `true`.  
And `healthTruthComplete=false`.

Evidence: `tests/scenarios/core-health-truth.ts`

## Scenario HT-006 — Existing tests still pass

Given the Wave 3 health cleanup patch.  
When the existing default scenario test is executed.  
Then it passes.

Evidence: `npm test`, exit 0.
