# Free Retro

Lightweight, unlisted retrospective boards with real-time multiplayer collaboration.

## Language

**Slug**:
A human-readable identifier derived from a retro's title and creation date (e.g. `devrel-2026-08-17`), generated once at creation and never changed afterward. Used in shareable URLs alongside the retro's UUID; the UUID remains the canonical ID everywhere else (storage, Durable Object keys).
_Avoid_: friendly URL, short ID, slug URL (as a stand-in for the concept itself)
