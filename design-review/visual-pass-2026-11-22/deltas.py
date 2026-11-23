# Unblind a paired round: python deltas.py rN  -> prints per-category best/candidate scores and delta
import json, sys
r = sys.argv[1]
rev = json.load(open(f'{r}/reviews.json')); key = json.load(open(f'{r}/blind-key.json'))
out = {}
for cat, k in key.items():
    if cat not in rev: print('missing', cat); continue
    o = rev[cat]; inv = {v: L for L, v in k.items()}
    b, c = o[inv['best']]['score'], o[inv['candidate']]['score']
    pref = o.get('preference'); pref = k.get(pref, pref)
    out[cat] = {'best': b, 'candidate': c, 'delta': round(c - b, 2), 'preferred': pref, 'why': o.get('why', '')}
    print(f"{cat:11s} best {b:4} cand {c:4} delta {c-b:+.1f}  pref {pref}")
json.dump(out, open(f'{r}/unblinded.json', 'w'), indent=1)
