# Eval summary

Agent eval 2026-10-31: 10 questions x 3 runs per server, model claude-sonnet-5-5. Benchmarks 2026-10-31, median of 7 runs.

| Measure | shopify-multistore-mcp 0.3.0 | alex-brecher/shopify-multi-store 2.0.3 |
|---|---|---|
| Questions answered correctly | **30 of 30 (100%)** | 27 of 30 (90%) |
| Tool calls per question (median) | **1** | 2 |
| Time per question, end to end (median) | **7.4 s** | 8.8 s |
| Model cost per question (median) | **2.3¢** | 3.7¢ |
| Tools in the list sent with every message | 14 (~10k tokens) | 29 (~12k tokens) |
| One store's details, one call | 526 ms | **5 ms** |
| Unfulfilled orders across 3 stores | 541 ms | **7 ms** |
| Unfulfilled orders across 8 stores | 1.1 s | **12 ms** |
| Installed size | 28 MB, plus 397 MB of Shopify's CLI and Dev MCP on first start | **32 MB** |

Version 0.2 asked stores one at a time: 1.6 s for 3 stores and 4.2 s for 8.

## Per question

| Question | shopify-multistore-mcp | alex-brecher/shopify-multi-store |
|---|---|---|
| How many orders are still waiting to be fulfilled in each store, and which order has been waiting longest in each? | 3/3 | 0/3 |
| What did each store sell over the last 7 days? Leave out cancelled and test orders, and give each total in the store's own currency. | 3/3 | 3/3 |
| Which products have 5 or fewer units left in each store? Give me the SKUs. | 3/3 | 3/3 |
| Compare SKU HB-BEANS-1KG across all my stores: price, compare-at price and stock in each. | 3/3 | 3/3 |
| Which active products does harbour sell that tidewater doesn't carry at all? | 3/3 | 3/3 |
| Which active products have no image, in each store? | 3/3 | 3/3 |
| Is any SKU used by more than one product or variant inside the same store? Tell me which store. | 3/3 | 3/3 |
| How many active products does each store have? | 3/3 | 3/3 |
| What currency and time zone does the northpaper store use? | 3/3 | 3/3 |
| Which of my stores sell something with "linen" in the name, and at what price? | 3/3 | 3/3 |

Mock: 198 Admin API requests, 0 rejected by the schema, fields answered with an empty default: none.
