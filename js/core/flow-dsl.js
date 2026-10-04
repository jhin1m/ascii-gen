/* Flow DSL parser: one chain per line, six operators only.
     a -> b -> c          chain                 [a, b, c]       parallel group
     a <-> [b, c, d]      hub & spoke           a ..> b         dashed edge
     x@table              table node            : label         label of the line's last operator
     # comment            ignored (blank lines too)
   A name that matches an actor id takes its title and color from that actor (see blocks/flow.js).
   A name repeated inside one line is a NEW instance (key `name#2`, one tier later); other lines
   refer to the first instance. parse() returns { nodes:[{key,name,kind}], edges:[{from,to,style,
   bidir,label,line}], groups:[[key]] } or { error:{line,col,msg} } (1-based; the caller keeps the
   previous graph). Input is user/share-link text, so size is capped. */
(function (ADG) {
  const MAX_TEXT = 4000, MAX_LINES = 40, MAX_NODES = 40, MAX_EDGES = 80, MAX_GROUP = 8, MAX_NAME = 40;
  const KINDS = ['box', 'table'];
  const START = /[\p{L}\p{N}_]/u, BODY = /[\p{L}\p{M}\p{N}_.\-]/u;
  const OPS = { '->': { style: 'solid', bidir: false }, '..>': { style: 'dashed', bidir: false }, '<->': { style: 'solid', bidir: true } };

  const fail = (line, col, msg) => ({ error: { line, col, msg } });

  /** One line (comment already cut) → tokens { t: 'id'|'op'|'[' |']'|','|'@'|':', v, col }, or an error. */
  function tokenize(s, line) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i], col = i + 1;
      if (/\s/.test(c)) { i++; continue; }
      const op = ['<->', '..>', '->'].find((o) => s.startsWith(o, i));
      if (op) { out.push({ t: 'op', v: op, col }); i += op.length; continue; }
      if ('[],@'.indexOf(c) >= 0) { out.push({ t: c, col }); i++; continue; }
      if (c === ':') { out.push({ t: ':', col, v: s.slice(i + 1).trim() }); break; } // label = rest of line
      const cp = String.fromCodePoint(s.codePointAt(i)); // astral letters are one character
      if (!START.test(cp)) return fail(line, col, 'unexpected character "' + cp + '"');
      let j = i + cp.length;
      // '-' and '.' belong to a name unless they start an operator (a->b, a..>b)
      while (j < s.length && !s.startsWith('->', j) && !s.startsWith('..>', j)) {
        const q = String.fromCodePoint(s.codePointAt(j));
        if (!BODY.test(q)) break;
        j += q.length;
      }
      out.push({ t: 'id', v: s.slice(i, j), col });
      i = j;
    }
    return { tokens: out };
  }

  function parse(text) {
    // decomposed (NFD) Vietnamese from pasted text must read the same as precomposed
    text = String(text == null ? '' : text).normalize('NFC');
    if (text.length > MAX_TEXT) return fail(1, 1, 'DSL too long (max ' + MAX_TEXT + ' characters)');
    const lines = text.split(/\r?\n/);
    if (lines.length > MAX_LINES) return fail(MAX_LINES + 1, 1, 'too many lines (max ' + MAX_LINES + ')');
    // maps keyed by user names: no prototype, so `constructor` or `__proto__` are ordinary names
    const nodes = [], edges = [], groups = [], count = Object.create(null), first = Object.create(null);

    // name occurrence → node key; `lineSeen` makes a repeat inside one line a new instance
    const refer = (name, kind, lineSeen) => {
      let key = lineSeen[name] ? null : first[name];
      if (!key) {
        const n = (count[name] = (count[name] || 0) + 1);
        key = n === 1 ? name : name + '#' + n;
        nodes.push({ key, name, kind: 'box' });
        if (n === 1) first[name] = key;
      }
      lineSeen[name] = true;
      if (kind) nodes.find((n) => n.key === key).kind = kind;
      return key;
    };

    for (let li = 0; li < lines.length; li++) {
      const ln = li + 1, hash = lines[li].indexOf('#');
      const src = hash >= 0 ? lines[li].slice(0, hash) : lines[li];
      if (!src.trim()) continue;
      const tk = tokenize(src, ln);
      if (tk.error) return tk;
      const toks = tk.tokens, lineSeen = Object.create(null);
      let p = 0;
      const eol = () => ({ col: src.length + 1 });
      const peek = () => toks[p] || null;

      const item = () => {
        const t = toks[p++];
        if (!t || t.t !== 'id') return { err: fail(ln, (t || eol()).col, 'expected a name') };
        if (t.v.length > MAX_NAME) return { err: fail(ln, t.col, 'name too long (max ' + MAX_NAME + ')') };
        let kind = null;
        if (peek() && peek().t === '@') {
          p++;
          const k = toks[p++];
          if (!k || k.t !== 'id') return { err: fail(ln, (k || eol()).col, 'expected a kind after @ (' + KINDS.join('|') + ')') };
          if (KINDS.indexOf(k.v) < 0) return { err: fail(ln, k.col, 'unknown kind "' + k.v + '" (' + KINDS.join('|') + ')') };
          kind = k.v;
        }
        return { key: refer(t.v, kind, lineSeen) };
      };
      const term = () => {
        const t = peek();
        if (t && t.t === '[') {
          p++;
          const keys = [];
          for (;;) {
            const it = item();
            if (it.err) return it;
            keys.push(it.key);
            const n = toks[p++];
            if (n && n.t === ',') continue;
            if (n && n.t === ']') break;
            return { err: fail(ln, (n || eol()).col, 'expected "," or "]"') };
          }
          if (keys.length > MAX_GROUP) return { err: fail(ln, t.col, 'group too big (max ' + MAX_GROUP + ')') };
          groups.push(keys);
          return { keys };
        }
        const it = item();
        return it.err ? it : { keys: [it.key] };
      };

      const terms = [], ops = [];
      let label = '';
      for (;;) {
        const t = term();
        if (t.err) return t.err;
        terms.push(t.keys);
        const n = peek();
        if (!n) break;
        if (n.t === ':') { label = n.v; p++; break; }
        if (n.t !== 'op') return fail(ln, n.col, 'unexpected "' + (n.v || n.t) + '"');
        ops.push(n); p++;
      }
      if (p < toks.length) return fail(ln, toks[p].col, 'unexpected "' + (toks[p].v || toks[p].t) + '"');
      ops.forEach((op, i) => {
        const d = OPS[op.v];
        terms[i].forEach((from) => terms[i + 1].forEach((to) => {
          edges.push({ from, to, style: d.style, bidir: d.bidir, label: i === ops.length - 1 ? label : '', line: ln });
        }));
      });
      if (nodes.length > MAX_NODES) return fail(ln, 1, 'too many nodes (max ' + MAX_NODES + ')');
      if (edges.length > MAX_EDGES) return fail(ln, 1, 'too many edges (max ' + MAX_EDGES + ')');
    }
    return { nodes, edges, groups };
  }

  ADG.flowDsl = { parse, KINDS };
})(window.ADG = window.ADG || {});
