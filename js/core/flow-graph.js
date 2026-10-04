/* Flow graph analysis: parsed graph → a plan the flow block can draw, or an "unsupported" error.
   Only two shapes are drawn; anything else is refused rather than drawn wrongly:
     tiers — DAG by rank (longest path), tiers joined 1→n (fan-out), n→1 (fan-in), 1→1 or
             n→n pairwise, plus one back edge (a later node to an earlier one, drawn in the right
             gutter). Back edges are the edges that close a cycle in a depth-first walk.
     hub   — one center with `<->` spokes (first 4 around it, the rest in a table below) and
             optional `->` tails from the center, stacked below.
   analyze() → { mode:'tiers', tiers:[[key]], links:[{type,style,label}], back } |
               { mode:'hub', center, spokes, extra, tails } | { error:{ code:'unsupported', msg } } */
(function (ADG) {
  const MAX_TIER = 8, WRAP = 4;
  const unsupported = (msg) => ({ error: { code: 'unsupported', msg: 'unsupported graph: ' + msg } });

  /** Drop repeated from→to edges (a group fed twice, a chain restated on another line). */
  function dedupe(edges) {
    const seen = Object.create(null);
    return edges.filter((e) => {
      const k = e.from + '\u0000' + e.to + (e.bidir ? '<' : '>');
      if (seen[k]) return false;
      return (seen[k] = true);
    });
  }

  function analyzeHub(g, edges) {
    const bi = edges.filter((e) => e.bidir);
    const centers = Object.keys(bi.reduce((o, e) => { o[e.from] = 1; return o; }, Object.create(null)));
    if (centers.length !== 1) return unsupported('a hub needs exactly one center (a <-> [b, c])');
    const center = centers[0], spokes = [], tails = [];
    bi.forEach((e) => { if (e.to === center) return; if (spokes.indexOf(e.to) < 0) spokes.push(e.to); });
    if (!spokes.length) return unsupported('hub without spokes');
    const tailEdges = [];
    for (const e of edges.filter((x) => !x.bidir)) {
      if (e.from !== center || e.to === center || spokes.indexOf(e.to) >= 0) return unsupported('besides the spokes, a hub only draws "hub -> node" below it');
      if (tails.indexOf(e.to) < 0) { tails.push(e.to); tailEdges.push(e); }
    }
    const used = [center].concat(spokes, tails);
    if (g.nodes.some((n) => used.indexOf(n.key) < 0)) return unsupported('node not connected to the hub');
    return { mode: 'hub', center, spokes: spokes.slice(0, 4), extra: spokes.slice(4), tails, tailEdges };
  }

  /** Back edges: edges that point at a node still on the depth-first stack. */
  function findBack(g, edges) {
    const out = Object.create(null), state = Object.create(null), back = []; // maps keyed by node key: no prototype
    g.nodes.forEach((n) => { out[n.key] = []; });
    edges.forEach((e) => out[e.from].push(e));
    const dfs = (k) => {
      state[k] = 1;
      out[k].forEach((e) => { if (state[e.to] === 1) back.push(e); else if (!state[e.to]) dfs(e.to); });
      state[k] = 2;
    };
    g.nodes.forEach((n) => { if (!state[n.key]) dfs(n.key); });
    return back;
  }

  function analyzeTiers(g, edges) {
    const back = findBack(g, edges), fwd = edges.filter((e) => back.indexOf(e) < 0);
    const rank = Object.create(null), pending = Object.create(null);
    g.nodes.forEach((n) => { rank[n.key] = 0; pending[n.key] = 0; });
    fwd.forEach((e) => { pending[e.to]++; });
    // Kahn order: rank = longest path from a node with no incoming edge
    const queue = g.nodes.filter((n) => !pending[n.key]).map((n) => n.key);
    for (let i = 0; i < queue.length; i++) {
      fwd.filter((e) => e.from === queue[i]).forEach((e) => {
        rank[e.to] = Math.max(rank[e.to], rank[queue[i]] + 1);
        if (--pending[e.to] === 0) queue.push(e.to);
      });
    }
    const tiers = [];
    g.nodes.forEach((n) => { (tiers[rank[n.key]] = tiers[rank[n.key]] || []).push(n.key); });
    if (fwd.some((e) => rank[e.to] !== rank[e.from] + 1)) return unsupported('an edge skips a tier');
    if (tiers.some((t) => t.length > MAX_TIER)) return unsupported('more than ' + MAX_TIER + ' nodes in one tier');

    const links = [];
    for (let i = 0; i + 1 < tiers.length; i++) {
      const F = tiers[i], T = tiers[i + 1];
      const es = fwd.filter((e) => rank[e.from] === i);
      const has = (a, b) => es.some((e) => e.from === a && e.to === b);
      let type;
      if (F.length === 1) type = T.length === 1 ? 'one' : 'fanout';
      else if (T.length === 1 && F.every((f) => has(f, T[0]))) type = 'fanin';
      else if (F.length === T.length && es.length === F.length && F.every((f, k) => has(f, T[k]))) type = 'par';
      else return unsupported('tiers ' + (i + 1) + ' and ' + (i + 2) + ' are not joined as fan-out, fan-in or one-to-one');
      if (F.length > WRAP) return unsupported('a tier of more than ' + WRAP + ' nodes must be the last one');
      links.push({ type, style: es[0].style, label: es[0].label || '' });
    }
    if (back.length > 1) return unsupported('only one back edge (..>) is drawn');
    if (back.length) {
      const e = back[0], s = tiers[rank[e.from]], d = tiers[rank[e.to]];
      if (e.from === e.to || s[s.length - 1] !== e.from || d[d.length - 1] !== e.to) return unsupported('a back edge must leave and enter the rightmost node of a tier');
    }
    return { mode: 'tiers', tiers, links, back: back[0] || null };
  }

  function analyze(g) {
    if (!g || g.error || !Array.isArray(g.nodes)) return unsupported('no graph');
    if (!g.nodes.length) return unsupported('empty graph');
    const edges = dedupe(g.edges);
    return edges.some((e) => e.bidir) ? analyzeHub(g, edges) : analyzeTiers(g, edges);
  }

  ADG.flowGraph = { analyze, WRAP };
})(window.ADG = window.ADG || {});
