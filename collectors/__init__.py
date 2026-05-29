"""Connected Procurement detection collectors.

Live-collection phase. Each collector reads the registry (data/) and live federal
sources and writes *pending* detection records to collectors/state/ only. A collector
never writes to data/, never amends a methodology entry, and never decides membership
or ingestion. Detection surfaces a candidate; a human-gated ingest session decides what
becomes of it. registry.validate does not load collectors/state/, so nothing a collector
emits can silently enter the registry.

See docs/handoffs/2026-05-28-session-01.md (the planning artifact, source of truth) and
docs/handoffs/2026-05-29-session-02.md (this build).
"""
