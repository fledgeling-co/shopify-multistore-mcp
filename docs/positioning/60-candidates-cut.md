# shopify-multi-mcp — Candidates considered and cut

33 candidates generated under 5 frames (trawl, standard tier, run 2026-10-31 with `claude-sonnet-5-5` as the generator in five isolated runs); 3 shortlisted plus the status quo. This is the rest.

**The frozen baseline** — the README's opening line on the day of the run:

> One MCP server for many Shopify stores. Each store keeps its own Shopify sign-in, every store tool takes a store argument naming the store it acts on, and the Shopify code doing the work is always the newest verified release of Shopify's own CLI and Dev MCP.

Its default mechanisms: category "MCP server" (developer tooling), no named enemy, no beachhead, the word "many stores".

The five frames were an agency ops lead switching between 9 client stores (ordinary stakeholder), a merchant with three regional stores and no budget line (operational constraint), Shopify's head of AI developer tools briefed to take the position first (adversary), a hotel concierge's key rack (cross-domain mechanism), and a wedding planner who has never used Shopify (wild seat). No frame apoptosed: every frame produced at least one candidate that passed the soundness, feasibility and fit floors.

## Clusters

Candidates were clustered by mechanism: two belong to one cluster when they would produce the same hero line under different words. One survived per cluster, and only where its four axes did not collide with another survivor's.

| Cluster | Members | Outcome |
|---|---|---|
| Stay signed in to every store (enemy: the official connector's sign-out-to-switch) | 1.2, 2.1, 3.1, 4.1, 5.1 | Survives as **Territory A**, with the agency beachhead from 1.1 and 4.1 |
| Ask once, every store side by side (enemy: the export-and-paste spreadsheet) | 1.1, 1.6, 2.2, 3.5, 4.4, 5.4 | Survives as **Territory B**, with the own-stores merchant beachhead from 1.6, 2.2 and 5.4 |
| Look before you buy (read-only diligence across candidate stores) | 4.6, 5.7 | Survives as **Territory J**, the non-obvious slot |
| Read-only, look-don't-touch safety | 1.3, 2.3, 3.2, 5.3 | Cut as a territory; becomes a proof point under A and J |
| Every answer names its store (wrong-store insurance) | 2.5, 3.3, 4.2, 5.2 | Cut as a territory; becomes a proof point under A and B |
| Keyless, no developer app | 1.4, 2.4, 3.4, 4.3, 5.5 | Cut as a territory; becomes a proof point everywhere |
| Always on Shopify's newest tools | 1.5, 2.7, 3.6, 4.5 | Cut; too close to the baseline's own frame |
| One config line instead of one per store | 3.7 | Cut; developer-only, baseline-adjacent |
| Dev store against live store parity | 5.6 | Cut; real but narrow |
| Free developer on call | 2.6 | Cut as a trap |

## Cut

| Candidate | Frame that produced it | Why cut | Killed by |
|---|---|---|---|
| Read-only safety layer ("Let AI look. Not touch.") | stakeholder, constraint, adversary, wild | Its natural beachhead (agency owners and cautious merchants) collides with A's and B's, so it cannot be a distinct territory; the capability is strong and moves into A and J as a proof point | four-axis distinctness (beachhead) |
| Wrong-store insurance ("Every answer says which store it came from.") | constraint, adversary, mechanism, wild | Same beachhead collision with A; the labelling is the strongest proof point A has | four-axis distinctness (beachhead) |
| Keyless, no developer app ("No app. No keys. Just approve each store.") | all five | True (T-003) but it is a setup claim, not a reason to choose the category; its non-developer beachhead is undercut because installation still needs a line added to an AI app's settings | T-005 (setup still needs a config edit) |
| Always current ("Always on Shopify's latest, checked before it runs.") | stakeholder, constraint, adversary, mechanism | Differs from the baseline in wording only; the baseline already leads on it | baseline boss gate (TIES) |
| One line in your AI app | adversary | Developer-only and a restatement of the baseline's category | baseline boss gate (TIES) |
| Dev against live parity ("Check your dev store against production in one question.") | wild | Real job, small audience; overlaps the developer cluster | fit floor passed, shortlist coverage |
| Free developer on call ("A Shopify developer on call for every store, at no charge.") | constraint | Trap: docs search and validation are not a developer, so the promise fails at the first theme change a merchant asks for | ledger rule: promissory copy beyond shipped capability |

## Cut for missing evidence, not for being wrong

Read-only safety may out-sell A with agencies if their clients' contracts forbid AI write access; nothing in the run measured that. It is recorded as an assumption in `80-pre-commitment-tests.md` rather than a dead end.

## Did you consider…

"Just position it as a better Shopify connector" is Territory A's category frame. "Sell it to developers" is the baseline, carried as the status quo row in `00-decision.md`. A candidate a reader names that appears nowhere here goes back through `/trawl:trawl` rather than being answered from memory.

## What this could not establish

Whether the wild seat's acquirer beachhead (J) is reachable at all: no frame or panel member measured how many store buyers use AI assistants.
