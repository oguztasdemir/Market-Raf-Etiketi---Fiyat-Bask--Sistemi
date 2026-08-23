import os
import re
import json

with open('frontend/sayfalar/index.html', encoding='utf-8') as f:
    html = f.read()

# 1. Inline event handlers in HTML
pattern_handler = re.compile(r'(?:onclick|onchange|oninput|onkeydown|onkeyup|onsubmit|onfocus|onblur)\s*=\s*["\']\s*([a-zA-Z0-9_$]+)\s*\(', re.IGNORECASE)
inline_handlers = set(pattern_handler.findall(html))

# 2. Collect JS code by module
js_modules = {}
for root, dirs, files in os.walk('frontend/js'):
    for f in files:
        if f.endswith('.js'):
            p = os.path.join(root, f)
            with open(p, encoding='utf-8') as jf:
                js_modules[p] = jf.read()

all_js_code = '\n'.join(js_modules.values())

# Check missing handlers
missing_handlers = []
for h in sorted(inline_handlers):
    if not (re.search(rf'function\s+{h}\b', all_js_code) or 
            re.search(rf'window\.{h}\b', all_js_code) or 
            re.search(rf'const\s+{h}\s*=', all_js_code) or 
            re.search(rf'let\s+{h}\s*=', all_js_code) or 
            re.search(rf'var\s+{h}\s*=', all_js_code)):
        missing_handlers.append(h)

# 3. getElementById in JS vs HTML
pattern_gid = re.compile(r'document\.getElementById\(\s*[\'"]([a-zA-Z0-9_\-]+)[\'"]\s*\)')
all_gids = set()
for p, code in js_modules.items():
    gids = pattern_gid.findall(code)
    for g in gids:
        all_gids.add((g, p))

missing_dom_elements = []
for gid, p in sorted(all_gids):
    if f'id="{gid}"' not in html and f"id='{gid}'" not in html and f'id={gid}' not in html:
        # Check if created dynamically in any JS
        if f'id="{gid}"' not in all_js_code and f"id='{gid}'" not in all_js_code and not gid.startswith('cart-') and not gid.startswith('preview-') and not gid.startswith('dyn-'):
            missing_dom_elements.append({'id': gid, 'file': p})

# 4. Check Backend API routes called in JS vs Python
pattern_api = re.compile(r'fetch\(\s*[`\'"](/api/[a-zA-Z0-9_/\-]+)')
all_api_calls = set()
for p, code in js_modules.items():
    apis = pattern_api.findall(code)
    for a in apis:
        all_api_calls.add((a, p))

# Collect Python routes
py_code = ''
for root, dirs, files in os.walk('.'):
    if 'venv' in root or '.git' in root:
        continue
    for f in files:
        if f.endswith('.py'):
            with open(os.path.join(root, f), encoding='utf-8', errors='ignore') as pf:
                py_code += '\n' + pf.read()

missing_routes = []
for api, p in sorted(all_api_calls):
    # Match route pattern in Python like @app.route('/api/pos/search' or @pos_bp.route('/search'
    api_endpoint = api.split('/')[-1]
    if api not in py_code and f"'{api}'" not in py_code and f'"{api}"' not in py_code and f"/{api_endpoint}" not in py_code:
        missing_routes.append({'api': api, 'file': p})

# 5. Check CSS Class and ID collisions / overlapping
report = {
    'total_inline_handlers_checked': len(inline_handlers),
    'missing_inline_handlers': missing_handlers,
    'total_dom_id_queries_checked': len(all_gids),
    'missing_dom_elements': missing_dom_elements,
    'total_api_calls_checked': len(all_api_calls),
    'missing_backend_routes': missing_routes
}

print(json.dumps(report, indent=2, ensure_ascii=False))
