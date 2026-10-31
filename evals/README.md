# Evals

These compare shopify-multistore-mcp with [alex-brecher/shopify-multi-store](https://github.com/alex-brecher/shopify-multi-store) (published as Shopify Multi-Store MCP, npm `shopify-multi-store-mcp-server` 2.0.3), the closest alternative, on the same stores and the same questions. The latest numbers are in [results/SUMMARY.md](results/SUMMARY.md), and every run's raw output is in [results/](results/).

## What runs

**One mock Shopify store, shared by both servers.** [mock/server.js](mock/server.js) is a local Admin GraphQL API. It validates and executes every request against Shopify's own published Admin schema for the requested version (the files Shopify's Dev MCP ships), implements the Admin API's search syntax and paging, and answers from [mock/fixtures.js](mock/fixtures.js): three stores (harbour, tidewater, northpaper) with catalogues, stock and orders dated relative to the run. A field the fixtures do not hold is answered with an empty value and counted, and the count is in the summary. No order sits within a day and a half of the 7-day boundary, so "the last 7 days" means the same orders however a server reads it.

**Each server as its users run it.** shopify-multistore-mcp runs from this repo. Its Shopify CLI calls go through [fake-shopify-cli.mjs](fake-shopify-cli.mjs), which forwards `store execute` to the mock and waits 470 ms first, the start-up time measured for Shopify CLI 5.0.0, so shopify-multistore-mcp pays its real per-call overhead. alex-brecher/shopify-multi-store runs from its published npm package in a container ([competitor/Dockerfile](competitor/Dockerfile)), pointed at the mock through its own `baseUrl` and test-HTTP settings, with an access token per store. Neither pays network time to Shopify, which in real use adds a round trip to every call for both.

**Agent eval** ([agent.mjs](agent.mjs), [tasks.mjs](tasks.mjs)). The same assistant answers ten multi-store questions through each server: `claude -p` with a pinned model, no built-in tools, no settings, hooks or CLAUDE.md, and only the server under test. Every expected answer is computed from the fixtures, and grading is a script: each fact must appear in the part of the answer that talks about its store, so a figure attached to the wrong store fails. Unfulfilled orders follow Shopify admin's Unfulfilled view (unfulfilled or partially fulfilled, not cancelled).

**Benchmarks** ([bench.mjs](bench.mjs)). No model: the size of each server's tool list, the time for one cross-store question at 3 and 8 stores (including shopify-multistore-mcp with stores asked one at a time, as 0.2 did), one single-store read, and what each installs.

## Run them

You need Node 22.12+, Docker, the `claude` CLI, and Shopify's Admin schema files, which `npx shopify-multistore-mcp doctor` downloads.

```bash
cd evals && npm install && cd ..
docker build -t shopify-multistore-mcp-eval/competitor:2.0.3 evals/competitor
node evals/bench.mjs --runs 7
node evals/agent.mjs --repeats 3 --parallel 4
node evals/summary.mjs
```

## What they do not show

- Real stores. The mock follows Shopify's schema and search syntax but not its rate limits, query-cost limits or data quirks, and nobody has yet signed in to a real store with shopify-multistore-mcp.
- Other models. One model answered every question.
- Neutral questions. The shopify-multistore-mcp team wrote the ten questions and the fixtures. They are the questions an agency asks about several client stores, and both servers have a ready-made report for most of them, but they were not chosen by a third party.
- Earlier runs, kept in [results/](results/). Run 1 graded one question on product titles only; shopify-multistore-mcp's answer named the products by handle, which was correct, so the grader now accepts either and shopify-multistore-mcp's report now shows titles. Run 2 found shopify-multistore-mcp costing more per question (4.8¢ against 3.7¢) because its tool list changed while Shopify's Dev MCP started, which spoiled the AI app's prompt cache; shopify-multistore-mcp now serves the tool list it saw last time from the first message, and run 3 (the summary) measured 2.3¢. alex-brecher/shopify-multi-store's results were the same in every run: the unfulfilled-orders question failed each time.
