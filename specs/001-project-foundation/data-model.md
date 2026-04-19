# Data Model — Project Foundation & Navigation Shell

**Not applicable.** This feature introduces no persistence and no data entities.

The seven MVP entities declared by constitution §4 R2 (`salespeople`, `clients`, `products`, `product_variants`, `orders`, `order_items`, `payment_receipts`) are materialised in block **002 — WatermelonDB Schema & Data Layer**. Components created in this feature (the placeholder home and auth screens) MUST NOT reach for any storage API; they are purely structural.

This file exists so the spec-kit artifact set is complete and so `/speckit-analyze` has something to diff against in later features.
