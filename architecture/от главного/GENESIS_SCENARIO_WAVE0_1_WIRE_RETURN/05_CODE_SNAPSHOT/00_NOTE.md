# Code snapshot

In-repo sources of truth:

```text
app/terminal/cognitive_shadow/scenario_join.py
app/terminal/cognitive_shadow/scenario/shadow_publish.py
app/terminal/cognitive_shadow/shadow_consumer.py  # +scenario_set field
app/terminal/cognitive_shadow/shadow_sink.py      # +append_scenario_set
app/terminal/cognitive_shadow/assembly_join.py    # preserves scenario_set
app/terminal/cognitive_shadow/no_influence.py     # allowlist authorized scenario
tests/cognitive_shadow/scenario/test_wave0_1_wire_v1.py
```

This folder mirrors the touched files for desk review.
