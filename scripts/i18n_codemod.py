"""One-off codemod: wraps known English JSX text/attributes in t() and emits src/i18n/hiExtra.ts.
Usage: python3 scripts/i18n_codemod.py   (run from repo root; idempotent)"""
import glob, html, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import importlib
TABLE = {}
for mod, name in (('i18n_table_a', 'TABLE_A'), ('i18n_table_b', 'TABLE_B'), ('i18n_table_c', 'TABLE_C'), ('i18n_table_d', 'TABLE_D'), ('i18n_table_e', 'TABLE_E'), ('i18n_table_f', 'TABLE_F'), ('i18n_table_g', 'TABLE_G')):
    try: TABLE.update(getattr(importlib.import_module(mod), name))
    except ModuleNotFoundError: pass

def q(s): return s.replace('\\', '\\\\').replace("'", "\\'")
changed = {}

def lookup(raw):
    norm = re.sub(r'\s+', ' ', html.unescape(raw)).strip()
    return norm if norm in TABLE else None

def transform(src):
    def text(m):
        key = lookup(m.group(3))
        if not key: return m.group(0)
        return f"{m.group(1)}{m.group(2)}{{t('{q(key)}')}}{m.group(4)}{m.group(5)}"
    src = re.sub(r'([>}])(\s*)([^<>{}=;]*[A-Za-z][^<>{}=;]*?)(\s*)([<{])', text, src)
    def attr(m):
        key = lookup(m.group(2))
        return f"{m.group(1)}={{t('{q(key)}')}}" if key else m.group(0)
    src = re.sub(r'\b(placeholder|title|aria-label|label)="([^"{}]+)"', attr, src)
    return src

def find_functions(src):
    return [(m.start(), m.group(1)) for m in re.finditer(r'^(?:export )?(?:default )?function (\w+)\(', src, re.M)]

def body_open(src, start):
    i = src.index('(', start); depth = 0
    while True:
        c = src[i]
        if c == '(': depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0: break
        i += 1
    return src.index('{', i)

def add_hooks(src, path):
    funcs = find_functions(src)
    bounds = [f[0] for f in funcs] + [len(src)]
    inserts = []
    for idx, (start, name) in enumerate(funcs):
        span = src[start:bounds[idx + 1]]
        if "t('" not in span.replace("it('", ''): continue
        if 'useLang()' in span or 'useLang(' in span: continue
        if not name[0].isupper():
            print('  WARN non-component uses t():', path, name); continue
        inserts.append(body_open(src, start) + 1)
    for pos in sorted(inserts, reverse=True):
        src = src[:pos] + "\n  const { t } = useLang();" + src[pos:]
    return src, bool(inserts)

def ensure_import(src, path):
    if re.search(r"import\s*\{[^}]*\buseLang\b[^}]*\}\s*from\s*'[^']*i18n'", src): return src
    rel = os.path.relpath('src/i18n', os.path.dirname(path)).replace(os.sep, '/')
    if not rel.startswith('.'): rel = './' + rel
    m = re.search(r"^import .*$", src, re.M)
    line = f"import {{ useLang }} from '{rel}';\n"
    return src[:m.start()] + line + src[m.start():] if m else line + src

for path in sorted(glob.glob('src/**/*.tsx', recursive=True)):
    if '.test.' in path or path.startswith('src/i18n'): continue
    src = open(path).read()
    out = transform(src)
    if out == src: continue
    out, hooked = add_hooks(out, path)
    if "t('" in out: out = ensure_import(out, path)
    open(path, 'w').write(out)
    changed[path] = sum(out.count(f"t('{q(k)}')") for k in TABLE)
    print('updated', path)

with open('src/i18n/hiExtra.ts', 'w') as f:
    f.write("/** Hindi translations keyed by their English source text (used as t() keys in components).\n * Machine-drafted — please have a native speaker review. */\n")
    f.write("export const hiExtra: Record<string, string> = " + json.dumps(TABLE, ensure_ascii=False, indent=2) + ";\n")
print('translations:', len(TABLE))
