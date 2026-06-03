# RC4-C Operator UI Language/Layout Hotfix Report

Status: CANDIDATE — browser manual acceptance still required.

## Scope

This hotfix is limited to frontend operator UI language and layout normalization.

It does not add:
- execution
- trading buttons
- order endpoints
- API keys
- signed endpoints
- backend safety changes

## Language contract

Implemented:

- Supported UI languages: RU and EN only.
- Default language: RU.
- Unknown localStorage language falls back to RU.
- Ukrainian UI fallback is forbidden.
- Added `frontend/src/i18n/dictionary.ts` as the explicit language contract.
- Added `verify:frontend-language`.

Checks:

- no Ukrainian UI words from the forbidden list
- no Ukrainian-specific characters in frontend source
- RU/EN dictionary exists
- language fallback marker exists
- reset-layout RU/EN labels exist

## Layout normalization

Implemented:

- compact summary before raw for Revision Timeline
- compact summary before raw for Replay Panel
- timeline cards for revisions
- raw DTO blocks with internal scroll
- long hash/raw text cannot expand panels
- windows keep content inside scrollable area
- panel content uses responsive grid where appropriate

## Reset layout behavior

Implemented:

- reset requires confirmation
- reset is manual only
- RU confirmation: `Сбросить сохранённую раскладку? Это действие нельзя отменить.`
- EN confirmation: `Reset saved layout? This action cannot be undone.`

## Verify

Passed locally:

```text
npm run check:core — PASS
npm run verify:frontend-language — PASS
npm run verify:layout-normalization — PASS
npm run verify:operator-ui — PASS
npm run verify:frontend-layout — PASS
npm run verify:rc4-c-ui-hotfix — PASS
npm run verify:rc4-c — PASS
npm run verify:readonly-surface — PASS
npm run build:frontend — PASS
```

## Browser acceptance still required

Manual browser checks still required:

- RU mode has no Ukrainian text
- EN mode has no Ukrainian text
- language persists after reload
- Revision Timeline uses available space properly
- Replay Panel uses available space properly
- raw JSON scrolls internally
- layout persistence remains stable after restart
