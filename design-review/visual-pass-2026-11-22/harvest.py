# Pull each reviewer's final JSON out of its subagent transcript (JSONL) without echoing it.
# usage: python harvest.py <out.json> <transcript.output>...
import json, sys, re
def last_json(path):
    cands = []
    for line in open(path, encoding='utf-8'):
        try: ev = json.loads(line)
        except Exception: continue
        msg = ev.get('message') or {}
        content = msg.get('content')
        if not isinstance(content, list): continue
        for c in content:
            if c.get('type') == 'text': cands.append(c['text'])
            if c.get('type') == 'tool_use':
                inp = c.get('input') or {}
                for v in inp.values():
                    if isinstance(v, str): cands.append(v)
    for t in reversed(cands):
        s = t.strip()
        s = re.sub(r'^```(json)?', '', s).rstrip('`').strip()
        i, j = s.find('{'), s.rfind('}')
        if i < 0: continue
        try:
            o = json.loads(s[i:j+1])
            if 'category' in o or 'A' in o: return o
        except Exception: pass
    return None
out = {}
for p in sys.argv[2:]:
    o = last_json(p)
    if o is None: print('NO JSON in', p); continue
    key = o.get('category') or (o.get('A') or {}).get('category')
    out[key] = o
json.dump(out, open(sys.argv[1], 'w'), indent=1)
print({k: (v.get('score') if 'score' in v else (v['A'].get('score'), v['B'].get('score'))) for k, v in out.items()})
