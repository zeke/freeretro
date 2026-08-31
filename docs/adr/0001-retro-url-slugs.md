# Retro URLs accept a slug, but the UUID stays the canonical ID

Retro IDs must stay UUIDs created with `crypto.randomUUID()` (storage keys, Durable Object
names, API responses). To give retros readable share links, we generate a slug from the title
and creation date at creation time and store it alongside the UUID. `/retro/:idOrSlug` resolves
either form to the same retro. The slug is immutable even if the retro is later renamed, so
existing links never break. This keeps the UUID invariant intact while satisfying the request
for readable URLs, at the cost of maintaining a second lookup path and a slug collision scheme
(numeric suffix on duplicate title+date).
