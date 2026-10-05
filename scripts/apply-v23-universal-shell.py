from pathlib import Path
import re

ROOT = Path('.')
CSS = '<link rel="stylesheet" href="css/sitewide-rebuild-v18.css?v=20261005-v23.5" data-crow-v23-css>'
JS = '<script src="js/sitewide-rebuild-v18.js?v=20261005-v23.3" defer data-crow-v23-js></script>'

for path in sorted(ROOT.glob('*.html')):
    text = path.read_text(encoding='utf-8')
    original = text
    text = re.sub(r'\s*<link[^>]+sitewide-rebuild-v18\.css[^>]*>', '', text, flags=re.I)
    text = re.sub(r'\s*<script[^>]+sitewide-rebuild-v18\.js[^>]*></script>', '', text, flags=re.I)
    text = re.sub(r'(<audio\b[^>]*?)\s+autoplay\b', r'\1', text, flags=re.I)
    # Ensure every page gets the Halloween theme hook without destroying existing body classes.
    if re.search(r'<body\b[^>]*>', text, flags=re.I):
        text = re.sub(r'<body(?![^>]*\bcr-halloween-theme\b)([^>]*)>', lambda m: '<body' + m.group(1)[:-1] + (' ' if m.group(1).strip() else '') + 'class="cr-halloween-theme">', text, count=1, flags=re.I)
    if '<head' in text.lower() and '</head>' in text.lower():
        text = re.sub(r'</head>', CSS + '\n' + JS + '\n</head>', text, count=1, flags=re.I)
    if text != original:
        path.write_text(text, encoding='utf-8')
        print(path)
