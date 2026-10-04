/* Content generators. Actors + steps (+ the flow graph) are the shared source: a block with
   `auto: true` gets its content fields generated from them at every frame, so renaming an actor,
   adding a step or changing the flow updates it. A block without `auto: true` is hand-written and
   kept as is (the editor flips auto off when the user edits it, ↺ flips it back on).
   Word choices never depend on the seed (seed changes numbers only).
   Name tokens work in every block, auto or not, and are resolved last:
     {@id} actor name   {@id^} upper-cased   {@step} current step   {@step^}   {@stepn} "2/7" */
(function (ADG) {
  const R = () => ADG.random;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const STEP_W = 10; // pattern cells per step

  /** Visible flow block config (first in layout order), or null. */
  function flowBlock(config) {
    const blocks = isObj(config.blocks) ? config.blocks : {};
    for (const row of ADG.blocks.util.arr(config.layout, 40)) {
      for (const it of (Array.isArray(row) ? row : [row])) {
        const key = typeof it === 'string' ? it : it && it.block;
        const b = typeof key === 'string' && own(blocks, key) && isObj(blocks[key]) ? blocks[key] : null;
        if (b && !b.hidden && (b.type || key) === 'flow') return b;
      }
    }
    return null;
  }

  /** Parsed + analysed flow graph of the config, or null when there is none / it is invalid. */
  function flowPlan(config) {
    const b = flowBlock(config);
    if (!b) return null;
    const dsl = String(b.dsl || '').trim() || ADG.flowPresets.presetDsl(typeof b.preset === 'string' ? b.preset : 'fan');
    const g = ADG.flowDsl.parse(dsl);
    if (g.error) return null;
    const plan = ADG.flowGraph.analyze(g);
    if (plan.error) return null;
    const nodes = Object.create(null);
    g.nodes.forEach((n) => { nodes[n.key] = n; });
    const data = isObj(b.nodes) ? b.nodes : {};
    plan.nodes = nodes;
    plan.idOf = (k) => (isObj(data[k]) && typeof data[k].id === 'string' && data[k].id) || k;
    return plan;
  }

  /**
   * Who is active when. Flow tiers split the steps in order (hub: center first + last, spokes in
   * between); actors outside the graph are "on call" (a few moments); with no flow, actors take
   * turns. → { ids, names, steps, byActor:{id:[step]}, byStep:[[id]], oncall:{id:true}, glyph:{id}, plan }
   */
  function activity(config) {
    const ctx = ADG.layout.makeCtx(config);
    const ids = ADG.blocks.util.arr(config.actors, 20).map((a) => a && a.id).filter((id) => ctx.slot(id));
    const N = ctx.steps.length, byActor = {}, glyph = {}, oncall = {};
    ids.forEach((id) => { byActor[id] = []; });
    const plan = N ? flowPlan(config) : null;
    const mark = (key, s, g) => {
      const id = plan.nodes[key] && plan.nodes[key].name;
      if (!own(byActor, id)) return;
      byActor[id].push(s);
      if (!glyph[id]) glyph[id] = plan.nodes[key].kind === 'table' ? '|' : g;
    };
    /** Steps of part i when `list` is cut into T ordered parts (every part gets at least one). */
    const part = (list, i, T) => {
      const a = Math.min(list.length - 1, Math.floor((i * list.length) / T));
      return list.slice(a, Math.max(a + 1, Math.floor(((i + 1) * list.length) / T)));
    };
    const all = ctx.steps.map((_, s) => s);
    if (plan && plan.mode === 'tiers') {
      plan.tiers.forEach((keys, i) => part(all, i, plan.tiers.length).forEach((s) => keys.forEach((k) => mark(k, s, keys.length > 1 ? '=' : '#'))));
    } else if (plan) {
      mark(plan.center, 0, '#'); mark(plan.center, N - 1, '#');
      const sp = plan.spokes.concat(plan.extra), mid = N > 2 ? all.slice(1, -1) : all;
      sp.forEach((k, i) => part(mid, i, sp.length).forEach((s) => mark(k, s, '=')));
      plan.tails.forEach((k) => mark(k, N - 1, '#'));
    }
    ids.forEach((id, i) => {
      if (byActor[id].length || !N) return;
      if (plan) { oncall[id] = true; byActor[id] = [0, Math.floor((N - 1) / 2), N - 1]; glyph[id] = '<>'; }
      else { for (let s = i % ids.length; s < N; s += ids.length) byActor[id].push(s); glyph[id] = '#'; }
    });
    const byStep = ctx.steps.map(() => []);
    ids.forEach((id) => {
      byActor[id] = Array.from(new Set(byActor[id])).filter((s) => s >= 0 && s < N).sort((a, b) => a - b);
      byActor[id].forEach((s) => { if (!oncall[id]) byStep[s].push(id); });
    });
    return { ids, names: ctx.N, steps: ctx.steps, byActor, byStep, oncall, glyph, plan };
  }

  const nameTok = (id) => '{' + id + ':{@' + id + '}}';

  /** Activity pattern of one actor, STEP_W cells per step. */
  function pattern(id, A, r) {
    const N = A.steps.length, out = new Array(N * STEP_W).fill('.');
    const g = A.glyph[id] || '#';
    A.byActor[id].forEach((s) => {
      const a = s * STEP_W;
      if (g === '<>') { out[a + 4] = '<'; out[a + 5] = '>'; return; }
      const from = a + r.int(0, 2), to = a + STEP_W - r.int(0, 2);
      for (let c = from; c < to; c++) out[c] = g === '|' && r() < 0.3 ? '.' : g;
      if (g === '#' && to - from > 5 && r() < 0.5) out[from + r.int(2, to - from - 3)] = '.';
    });
    return out.join('');
  }

  const PHRASES = [
    ['{step}: started', '{step} · {n} tasks queued', '{step}: reading context'],
    ['{step} · {n} files touched', '{step} · checks passed', '{step}: {n} items done'],
    ['{step} · handing off', '{step} · done in {n}.{d} s', '{step}: ready for next step']
  ];

  /** Phrase placeholders in one pass, so text put in (a step name) is never re-read as a placeholder. */
  const fill = (s, vals) => s.replace(/\{(step|n|d)\}/g, (m, k) => String(vals[k]));

  /** Clock text for minute m after 09:00. */
  const clock = (m) => String(9 + Math.floor(m / 60) % 15).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  const GEN = {
    header(b, A) {
      return { legend: A.ids.slice(0, 6).map((id) => nameTok(id) + (A.oncall[id] ? ' on call' : '')) };
    },
    timeline(b, A, seed) {
      return { rows: A.ids.slice(0, 12).map((id) => ({ actor: id, pattern: pattern(id, A, R().rng(seed, 'timeline:' + id)) })) };
    },
    log(b, A, seed) {
      const lines = [];
      let m = 0;
      A.steps.forEach((step, s) => {
        const who = A.byStep[s].length ? A.byStep[s].slice(0, 2) : A.ids.slice(0, 1);
        Object.keys(A.oncall).forEach((id) => { if (A.byActor[id].indexOf(s) >= 0) who.push(id); });
        who.forEach((id, k) => {
          const w = R().rng(0, 'log:' + s + ':' + k), r = R().rng(seed, 'log:' + s + ':' + k);
          m += r.int(1, 3);
          const msg = A.oncall[id] ? 'advising · ' + step + ' -> reviewed'
            : fill(w.pick(PHRASES[Math.min(2, k)]), { n: r.int(2, 9), d: r.int(0, 9), step });
          lines.push({ t: clock(m), actor: id, msg, step: s });
        });
      });
      return { lines };
    },
    meters(b, A, seed) {
      const N = Math.max(1, A.steps.length);
      const order = A.ids.slice().sort((x, y) => (A.oncall[x] ? 1 : 0) - (A.oncall[y] ? 1 : 0) || A.byActor[y].length - A.byActor[x].length);
      return {
        items: order.slice(0, 3).map((id) => {
          const r = R().rng(seed, 'meter:' + id), n = A.byActor[id].length;
          const share = A.oncall[id] ? 0.1 : n / N;
          return { actor: id, ratio: +Math.max(0.05, Math.min(1, share + r.range(-0.12, 0.12))).toFixed(2), note: A.oncall[id] ? n + ' moments' : n + ' of ' + N + ' steps' };
        })
      };
    },
    status(b, A, seed, step) {
      const items = [{ k: 'step', v: '{a2b:{@step}}' }];
      A.ids.filter((id) => !A.oncall[id]).slice(0, 3).forEach((id) => {
        const s = A.byActor[id], state = s.indexOf(step) >= 0 ? 'busy' : s.length && s[s.length - 1] < step ? 'done' : 'idle';
        items.push({ k: '{@' + id + '}', v: '{' + id + ':' + state + '}' });
      });
      const r = R().rng(seed, 'status');
      items.push({ k: 'events', v: '{a3b:' + (r.int(40, 400) * (Math.max(0, step) + 1)).toLocaleString('en-US') + '}' });
      return { items };
    },
    'side-column'(b, A, seed) {
      const P = A.plan, r = R().rng(seed, 'side');
      const watcher = Object.keys(A.oncall)[0] || A.ids[0];
      let targets = [];
      if (P && P.mode === 'tiers') {
        const T = P.tiers.length;
        targets = [0, Math.floor(T / 2), T - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => ({ key: P.tiers[i][0], s: Math.floor((i * A.steps.length) / T) }));
      } else if (P) {
        targets = [P.spokes[0], P.spokes[1], P.tails[0] || P.spokes[3]].filter(Boolean).map((key, i) => ({ key, s: i }));
      }
      const items = [];
      targets.forEach((t, i) => {
        const id = P.nodes[t.key].name;
        // the first milestone opens the column so it can snap level with the first node
        if (i === 1) items.push({ kind: 'note', text: '{m:listening}' });
        items.push({ kind: 'milestone', title: 'before ' + (A.steps[t.s] || 'done'), q: A.ids.indexOf(id) >= 0 ? 'check {@' + id + '}?' : 'check ' + id + '?', a: ['looks right', 'add 1 test', 'stop retrying'][i % 3], link: P.idOf(t.key) });
        if (i === 0) items.push({ kind: 'pulse', bits: Array.from({ length: 10 }, () => (r() > 0.35 ? '1' : '0')).join('') }, { kind: 'kv', k: 'calls', v: String(r.int(2, 12)) }, { kind: 'kv', k: 'tokens', v: r.int(100, 999) + 'k' });
      });
      if (!targets.length) items.push({ kind: 'note', text: '{m:listening}' }, { kind: 'kv', k: 'steps', v: String(A.steps.length) }, { kind: 'kv', k: 'actors', v: String(A.ids.length) });
      return { title: watcher ? '{a2b:{@' + watcher + '^} · on call}' : 'on call', sub: 'watches every step', items };
    }
  };

  /** Generated fields of one block (null when its type has no generator). */
  function generate(type, cfg, A, seed, step) {
    return own(GEN, type) ? GEN[type](cfg || {}, A, Math.floor(Number(seed)) || 0, step) : null;
  }
  const hasGenerator = (type) => own(GEN, type);

  /** Fill every `auto: true` block of a (cloned) config in place; returns the activity used. */
  function apply(config) {
    const A = activity(config), blocks = isObj(config.blocks) ? config.blocks : {};
    const step = ADG.layout.makeCtx(config).step; // clamped like the layout does
    Object.keys(blocks).forEach((key) => {
      const b = blocks[key];
      if (!isObj(b) || b.auto !== true) return;
      const out = generate(typeof b.type === 'string' ? b.type : key, b, A, config.seed, step);
      if (out) Object.assign(b, out);
    });
    return A;
  }

  /** Replace name/step tokens in every string of config.blocks (in place). */
  function resolveTokens(config) {
    const ctx = ADG.layout.makeCtx(config), N = ctx.steps.length;
    const step = ctx.steps[ctx.step] || '';
    const sub = (s) => s.replace(/\{@([A-Za-z0-9_-]+)(\^?)\}/g, (m, id, up) => {
      let v;
      if (id === 'step') v = step;
      else if (id === 'stepn') v = N ? (ctx.step + 1) + '/' + N : '';
      else if (ctx.slot(id)) v = ctx.N(id);
      else return m;
      return up ? v.toUpperCase() : v;
    });
    const walk = (v, depth) => {
      if (depth > 8) return v;
      if (typeof v === 'string') return v.indexOf('{@') >= 0 ? sub(v) : v;
      if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = walk(v[i], depth + 1); return v; }
      if (isObj(v)) { Object.keys(v).forEach((k) => { v[k] = walk(v[k], depth + 1); }); }
      return v;
    };
    if (isObj(config.blocks)) walk(config.blocks, 0);
    return config;
  }

  ADG.generators = { activity, flowPlan, generate, hasGenerator, apply, resolveTokens, STEP_W };
})(window.ADG = window.ADG || {});
