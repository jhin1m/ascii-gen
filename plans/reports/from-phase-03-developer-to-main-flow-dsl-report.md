# Phase 3 report: Flow DSL and presets

Status: DONE_WITH_CONCERNS. `node tests/run.js` = 134 passed, 0 failed (94 old + 40 new). Nothing committed.

## Files
- `js/core/flow-dsl.js` (133 lines): tokenizer + parser. `parse(text)` -> `{nodes:[{key,name,kind}], edges:[{from,to,style,bidir,label,line}], groups}` or `{error:{line,col,msg}}`. Caps: 4000 chars, 40 lines, 40 nodes, 80 edges, 8 per group, 40-char names.
- `js/core/flow-graph.js` (102): `analyze(graph)` -> `{mode:'tiers',tiers,links,back}` | `{mode:'hub',center,spokes,extra,tails,tailEdges}` | `{error:{code:'unsupported',msg}}`.
- `js/blocks/flow-presets.js` (29): `ADG.flowPresets.presetDsl(id, names)`, `ids()`, `label(id)`.
- `js/blocks/flow.js` (232): rewritten block (still exports `drawNode`, `nodeHeight`). Config now `{preset?, dsl, caption, nodes:{key:data}}`.
- `js/templates/agent-pipeline.js`: flow = `presetDsl('fan', ...)` + `nodes`.
- Tests: new `tests/flow-dsl.test.js`, `tests/flow-layout.test.js`; edited `tests/blocks.test.js`, `tests/layout.test.js` (see deviations).

## Decisions
- Node data keyed by node key (`lead`, second instance `lead#2`); `id` in node data overrides the anchor id. Template uses `'lead#2': {id:'review'}` so the side-column link to `review` still works.
- Label `: text` belongs to the last operator of the line only (chain `a -> b ..> c : x` labels b..>c).
- Edge label on a fan-out = caption above the bus; `cfg.caption` is the fallback for the first fan-out. On other links the label sits right of the arrow.
- Back edge style follows the operator: `..>` is dashed in the gutter (ref shows it solid; layout is the same).
- Rank = longest path after removing DFS back edges (DFS starts at first-declared node, so `lead -> router ... router ..> lead` resolves `router..>lead` as the back edge).
- Supported tier joins: 1->1, 1->n, n->1 (all sources must feed it), n->n pairwise. Anything else, edge skipping a tier, >1 back edge, back edge not between the rightmost nodes of their tiers, two hub centers, extra edges in a hub, stray nodes -> "unsupported graph: ..." (block draws one `[!] flow: ...` line, no anchors).
- Wrapped tier (>4, up to 8): rows of 4; each extra row gets its own bus fed by a `:` continuation at the trunk. Allowed only as the last tier (otherwise unsupported) because fan-in from a wrapped tier cannot be drawn faithfully.
- Hub: spokes 1-4 = top/left/right/bottom; 5th+ spokes = one table below (row anchors per spoke); `hub -> x` tails stacked below joined by `:`. Hub needs >= ~46 flow columns else error line.
- Connector junctions drawn after nodes so table `╧/╤` on borders is not overwritten.
- Default node (no data): box titled with the name, color of the actor whose display name (or id) matches.

## Deviations / contract changes
- Flow cfg contract changed (legacy `top/table/fan/bottom/loop` removed, as phase says "replace"). Test edits only to follow it: `tpl.flow.table` -> `tpl.flow.nodes.router` (+`id:'router'` for the table-anchor test), `flow.top.lines` -> `flow.nodes.lead.lines`.
- Default footer from actor data is not generated (YAGNI; phase 4 generators fill `nodes`). Template supplies footers.
- A name cannot self-loop in DSL (repeat in a line = new instance), so `a ..> a` is not expressible; the guard remains in flow-graph.

## Open issues
- Hub preset in the pipeline template with side-column links: links to nodes absent from the hub are skipped with the existing `console.warn` (expected; hub is not the template's default).
- Table nodes in multi-column tiers get narrow widths at small block widths (clipped, no crash).
- Tier-row/hub heights in very narrow widths (<46) not tuned; verified only for no crash and exact width.

## Review fixes (H1, M1, M4, M5)
Tests: 139 passed, 0 failed. Re-dump of agent-pipeline@96 unchanged.
- H1: DSL idents = actor ids. Ident matching an actor id takes title `ctx.N(id)` (spaces/diacritics kept) and color slot from that actor; others are free nodes. `nodes` and anchors keyed by id (`id#2` for repeats). `presetDsl(id)` has no names arg now, render uses it for empty DSL. Rename test: titles change, anchor ids and custom node data stay, 0 warnings. Display-name matching removed (ids only). Spec line updated in the phase file.
- M1: `Object.create(null)` for every key map in flow-dsl, flow-graph (incl. findBack state), flow.js (`pm`, `nodes`). `constructor -> toString -> __proto__` test (keys, tiers, back edge).
- M4: flow anchors with a node to their left carry `reach:false` (extra-spoke table rows too). `side-column` exports a link only if a provider in its row has a reachable anchor with that id AND the milestone row lies inside the anchor rows; otherwise silent (no providers in row = old behaviour, layout decides). Hub in the template: 0 warnings at 80/96/120 x 2 borders; arrows to `lead` (center, behind left spoke) and `review` (absent) are skipped; `worker` arrow is also skipped because its milestone sits below the spoke rows (snap only moves down). Two existing layout tests changed from "warns" to "silent" (researcher behind sibling, milestone too low) since the drop is now silent by design.
- M5: `parse()` normalizes to NFC; BODY accepts `\p{M}`; tokenizer reads by code point (astral letters work; columns still UTF-16 units).
- Files also touched: `js/blocks/side-column.js`, `tests/layout.test.js`.

## agent-pipeline @ 96 cols, ascii border
```
                                                                                                
                         AGENT PIPELINE · LEAD WORKS · ADVISOR ON CALL                          
 =============================================/##/============================================= 
         [#] lead high    [#] workers medium    [#] router forks    [#] advisor on call         
                           > /advisor on      Advisor set to on call                            
                                                                                                
       + plan  >   / fork   >  3 delegate  >  4 work  >  5 merge  >  6 review  >  7 ship        
                                                                                                
 +-------------------------+          +----------------------------------------------+          
 |    ADVISOR · on call    |          |             LEAD · main session              |          
 | watches · reads it all  |          |         effort [####] high · ctx 1M          |<- - - -+ 
 |<> before a plan         |- - - - ->|               plans + decides                |  split : 
 | : right approach?       |          +-----------------------+----------------------+        : 
 | : » run migration first |                                  |                               : 
 | :                       |                                  |                               : 
 | : listening             |    +=============================+============================+  : 
 | :                       |    | ROUTER · fork layer · one call · < 0.5 s     1,683 forks |  : 
 | : | |   | | |     | |   |    | fork         p(top)                        route         |  : 
 | : + + + + + + + + + +   |    |>which file   [##################.:.] 0.84  sharp -> code |  : 
 | : | |   | | |     | |   |    | which tool   [##########.:...:...:.] 0.46  split -> lead +- + 
 | :                       |    | retry/stop   [###########:...:...:.] 0.54  split -> lead |    
 | : reads every tool      |    | - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |    
 | : call and result       |    | sharp: runs in code, lead never sees it                  |    
 | :                       |    +=============================+============================+    
 | : calls               6 |                                  :                                 
 | : tokens           643k |                delegate · 3 workers · effort medium                
 | :                       |             +- - - - - - - - - - + - - - - - - - - -+              
 | : silent on every       |             v                   v                   v              
 | : routine turn          |    +-----------------+ +-----------------+ +-----------------+     
 | :                       |    |     worker      | |    explorer     | |   researcher    |     
 | : never writes code     |    |  lead · medium  | |  lead · medium  | |  lead · medium  |     
 | :                       |    | edits + checks  | | reads the code  | | pulls the docs  |     
 |<> error again           |- ->| - - - - - - - - | | - - - - - - - - | | - - - - - - - - |     
 | : wrong place?          |    | $ idle          | | $ idle          | | $ idle          |     
 | : » stop retrying       |    | [...:...:...:.] | | [...:...:...:.] | | [...:...:...:.] |     
 | :                       |    |      [..]       | |      [..]       | |      [..]       |     
 | :                       |    +-----------------+ +-----------------+ +-----------------+     
 | :                       |             |                   |                   |              
 | :                       |             +- - - - - - - - - - + - - - - - - - - -+              
 | :                       |                                  v                                 
 | :                       |               +------------------------------------+               
 | :                       |               |    back to main session · high     |               
 | :                       |               |          review + verify           |               
 |<> before done           |- - - - - - - >|    advisor reviews · lead ships    |               
 | : what did I miss?      |               |    4 diffs · no edits until go     |               
 | : » add 1 test          |               +------------------------------------+               
 +-------------------------+                                                                    
                                                                                                
 +- session timeline  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - + 
 | advisor    ....<>...............|............................<>..................<>....... | 
 | lead       ##############.......|............###.###..####...................############# | 
 | router     ..................||||.|.||.||.|.||||.......................................... | 
 | worker     .....................|..................=======xxxxxxx======................... | 
 | explorer   .....................|.................==============.......................... | 
 | researcher .....................|..................======================................. | 
 |            +---------------+----^-----+-----------+----------+----------+--------+-------+ | 
 |                   plan         fork      delegate     work       merge    review    ship   | 
 +- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - + 
                                                                                                
 +- tail -f session.log - - - - - - - - - - - - - - - - - - -+ +- who sees what - - - - - - - + 
 | 23:58 lead      session start · 6 actors online           | | router  @################### | 
 | 23:59 advisor   listening · reads every tool call         | |         every fork           | 
 | 00:00 lead      plan: check agents, draft missing, diff   | | lead    @######............. | 
 | 00:00 advisor   advising · before a plan -> reviewed      | |         splits only          | 
 | 00:01 lead      fork: route 3 questions                   | | advisor @#.................. | 
 | 00:02 router    which file  explorer.md  0.84 sharp ->_   | |         3 moments            | 
 +- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+ +- - - - - - - - - - - - - - - + 
                                                                                                
 > █                                                                                            
```

### N1 / N3 follow-up
Tests: 140 passed, 0 failed.
- `layout.compose` now returns `skipped: [{from, to, reason}]` (always an array); `from` = milestone title (side-column sends `from`; falls back to the block key). Reasons: `missing` (no such anchor id), `unreachable` (other row, `reach:false`, blocked path or no room), `out-of-rows`. No console warning for skipped links anymore. Other return fields unchanged.
- side-column again exports every link (the earlier silent filter is removed); layout is the single place that decides and reports. It still snaps only to reachable anchors in its row.
- Tests: `leadd` typo -> missing; fan template -> skipped `[]`; behind-sibling case -> unreachable; milestone too low -> out-of-rows; hub template -> `{lead: unreachable, worker: out-of-rows, review: missing}` at 80/96/120 x both borders, self-check 0. `tests/blocks.test.js` side-column link assertion gained `from`.
- N3: header comment of `js/blocks/flow.js` rewritten (no stale "actor names" preset text).
