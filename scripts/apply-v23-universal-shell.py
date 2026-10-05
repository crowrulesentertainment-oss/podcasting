from pathlib import Path
import re

ROOT = Path('.')
CSS = '<link rel="stylesheet" href="css/sitewide-rebuild-v18.css?v=20261005-v23.5" data-crow-v23-css>'
JS = '<script src="js/sitewide-rebuild-v18.js?v=20261005-v23.3" defer data-crow-v23-js></script>'


def add_halloween_class(match):
    tag = match.group(0)
    if re.search(r'\bcr-halloween-theme\b', tag, re.I):
        return tag
    m = re.search(r'\bclass=(["\'])(.*?)\1', tag, re.I)
    if m:
        value = m.group(2).strip()
        new_value = (value + ' cr-halloween-theme').strip()
        return tag[:m.start(2)] + new_value + tag[m.end(2):]
    return tag[:-1] + ' class="cr-halloween-theme">'


for path in sorted(ROOT.glob('*.html')):
    text = path.read_text(encoding='utf-8')
    original = text
    text = re.sub(r'\s*<link[^>]+sitewide-rebuild-v18\.css[^>]*>', '', text, flags=re.I)
    text = re.sub(r'\s*<script[^>]+sitewide-rebuild-v18\.js[^>]*></script>', '', text, flags=re.I)
    text = re.sub(r'(<audio\b[^>]*?)\s+autoplay\b', r'\1', text, flags=re.I)
    text = re.sub(r'<body\b[^>]*>', add_halloween_class, text, count=1, flags=re.I)
    if '<head' in text.lower() and '</head>' in text.lower():
        text = re.sub(r'</head>', CSS + '\n' + JS + '\n</head>', text, count=1, flags=re.I)
    if text != original:
        path.write_text(text, encoding='utf-8')
        print(path)
