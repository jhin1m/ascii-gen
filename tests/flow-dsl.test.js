module.exports = ({ ADG, test, assert }) => {
  const { parse } = ADG.flowDsl;
  const { analyze } = ADG.flowGraph;
  const edge = (e) => e.from + (e.bidir ? '<->' : e.style === 'dashed' ? '..>' : '->') + e.to + (e.label ? ':' + e.label : '');
  const edges = (t) => parse(t).edges.map(edge);
  const err = (t) => parse(t).error;

  test('parse: chain, group fan-out/in, kinds', () => {
    const g = parse('a -> b@table -> [c, d] -> e');
    assert.deq(g.nodes.map((n) => n.key + ':' + n.kind), ['a:box', 'b:table', 'c:box', 'd:box', 'e:box']);
    assert.deq(g.edges.map(edge), ['a->b', 'b->c', 'b->d', 'c->e', 'd->e']);
    assert.deq(g.groups, [['c', 'd']]);
  });

  test('parse: hub, dashed, label belongs to the last operator, hyphen and dot names', () => {
    assert.deq(edges('lead <-> [a, b]'), ['lead<->a', 'lead<->b']);
    assert.deq(edges('a ..> b : split'), ['a..>b:split']);
    assert.deq(edges('a -> b ..> c : x'), ['a->b', 'b..>c:x']);
    assert.deq(parse('web-1->db.v2..>cache').nodes.map((n) => n.name), ['web-1', 'db.v2', 'cache']);
    assert.deq(parse('Điều-phối -> Công_nhân1').nodes.map((n) => n.name), ['Điều-phối', 'Công_nhân1']);
  });

  test('parse: a repeated name in one line is a new instance, other lines use the first', () => {
    const g = parse('lead -> router -> [w1, w2] -> lead\nrouter ..> lead : split\nlead -> lead');
    assert.deq(g.nodes.map((n) => n.key), ['lead', 'router', 'w1', 'w2', 'lead#2', 'lead#3']);
    assert.deq(g.edges.map(edge), ['lead->router', 'router->w1', 'router->w2', 'w1->lead#2', 'w2->lead#2', 'router..>lead:split', 'lead->lead#3']);
  });

  test('parse: comments, blank lines, CRLF, kind on a later mention', () => {
    const g = parse('# header\n\na -> b # tail comment\r\n   \nb@table -> c');
    assert.deq(g.edges.map(edge), ['a->b', 'b->c']);
    assert.eq(g.nodes[1].kind, 'table');
    assert.deq(parse('').nodes, []);
  });

  test('parse errors carry line, col and message; nothing partial is returned', () => {
    assert.deq([err('a -> b\nc -> -> d').line, err('a -> b\nc -> -> d').col], [2, 6]);
    assert.deq([err('a ->').line, err('a ->').col], [1, 5]);
    assert.eq(err('a b').col, 3);
    assert.eq(err('a -> [b, c').col, 11);
    assert.eq(err('a -> [b,, c]').col, 9);
    assert.eq(err('a -> [] ').col, 7);
    assert.eq(err('a -> $x').col, 6);
    assert.eq(err('a@grid').col, 3);
    assert.eq(err('-> a').col, 1);
    assert.eq(err('a -> [b, [c]]').col, 10);
    assert.ok(/kind/.test(err('a@').msg));
    assert.eq(parse('a b').nodes, undefined);
  });

  test('parse caps: text, lines, nodes, group size', () => {
    assert.ok(err('a'.repeat(4001)));
    assert.ok(err(new Array(60).fill('a').join('\n')));
    assert.ok(err(Array.from({ length: 35 }, (_, i) => 'n' + i + ' -> m' + i).join('\n').slice(0, 3900)));
    assert.ok(err('a -> [' + Array.from({ length: 9 }, (_, i) => 'x' + i).join(',') + ']'));
    assert.ok(err('x'.repeat(41)));
  });

  test('graph: fan preset ranks into tiers with one back edge', () => {
    const p = analyze(parse(ADG.flowPresets.presetDsl('fan', {})));
    assert.eq(p.mode, 'tiers');
    assert.deq(p.tiers, [['lead'], ['router'], ['worker', 'explorer', 'researcher'], ['lead#2']]);
    assert.deq(p.links.map((l) => l.type), ['one', 'fanout', 'fanin']);
    assert.deq([p.back.from, p.back.to, p.back.label], ['router', 'lead', 'split']);
  });

  test('graph: parallel chains pair up; labels and dashes survive on links', () => {
    const p = analyze(parse('a -> b\nc -> d'));
    assert.deq(p.tiers, [['a', 'c'], ['b', 'd']]);
    assert.eq(p.links[0].type, 'par');
    const q = analyze(parse('a ..> b : go'));
    assert.deq([q.links[0].style, q.links[0].label], ['dashed', 'go']);
  });

  test('graph: hub detection, extra spokes and tails', () => {
    const p = analyze(parse(ADG.flowPresets.presetDsl('hub', {})));
    assert.eq(p.mode, 'hub');
    assert.deq([p.center, p.spokes, p.extra, p.tails], ['lead', ['router', 'worker', 'explorer', 'researcher'], [], ['health']]);
    assert.deq(analyze(parse('h <-> [a, b, c, d, e, f]')).extra, ['e', 'f']);
  });

  test('graph: unsupported shapes are refused, never drawn', () => {
    [
      'a -> b -> c\na -> c',           // edge skips a tier
      '[a, b] -> [c, d]',              // many-to-many
      'a -> b -> c\nb ..> a\nc ..> a', // two back edges
      'a -> [b, c]\nb ..> a',          // back edge from a node that is not rightmost
      'a -> [b, c]\nc ..> a\nb -> d',  // d joins only some of the tier
      '[a, b] <-> c',                  // two hub centers
      'h <-> [a, b]\na -> b',          // edge between spokes
      'h <-> a\nx',                    // node outside the hub
      'a -> [b, c, d, e, f]\nf -> x'   // wide tier that is not last
    ].forEach((t) => {
      const r = analyze(parse(t));
      assert.ok(r.error && r.error.code === 'unsupported', t);
    });
    assert.ok(analyze({ error: { msg: 'x' } }).error);
    assert.ok(analyze(parse('# nothing')).error);
  });

  test('presetDsl: stable actor ids, unknown id is empty', () => {
    const d = ADG.flowPresets.presetDsl('fan');
    assert.ok(d.indexOf('lead -> router@table -> [worker, explorer, researcher] -> lead') === 0, d);
    assert.eq(ADG.flowPresets.presetDsl('nope'), '');
    assert.ok(!parse(d).error && !parse(ADG.flowPresets.presetDsl('hub')).error);
    assert.ok(ADG.flowPresets.ids().indexOf('hub') >= 0);
  });

  test('prototype-like names are ordinary names', () => {
    const t = 'constructor -> toString -> __proto__ -> constructor\n__proto__ ..> constructor : hasOwnProperty';
    const g = parse(t);
    assert.deq(g.nodes.map((n) => n.key), ['constructor', 'toString', '__proto__', 'constructor#2']);
    const p = analyze(g);
    assert.eq(p.mode, 'tiers');
    assert.deq(p.tiers, [['constructor'], ['toString'], ['__proto__'], ['constructor#2']]);
    assert.deq([p.back.from, p.back.to], ['__proto__', 'constructor']);
    assert.eq(({}).polluted, undefined);
  });

  test('decomposed (NFD) Vietnamese reads like precomposed; astral letters are one character', () => {
    const nfd = 'Ti\u00e9n'.normalize('NFD');
    assert.ok(nfd.length > 4);
    const g = parse(nfd + ' -> b');
    assert.ok(!g.error, JSON.stringify(g.error));
    assert.eq(g.nodes[0].name, 'Ti\u00e9n');
    assert.eq(parse('\u{1D49C} -> b').nodes[0].name, '\u{1D49C}');
  });
};
