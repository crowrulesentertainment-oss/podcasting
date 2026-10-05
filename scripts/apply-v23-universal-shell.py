from pathlib import Path
import re

ROOT = Path('.')
CSS = '<link rel="stylesheet" href="css/sitewide-rebuild-v18.css?v=20261005-v23.3" data-crow-v23-css>'
JS = '<script src="js/sitewide-rebuild-v18.js?v=20261005-v23.3" defer data-crow-v23-js></script>'

for path in sorted(ROOT.glob('*.html')):
    text = path.read_text(encoding='utf-8')
    original = text
    # Remove duplicate copies of the current universal assets before adding one canonical copy.
    text = re.sub(r'\s*<link[^>]+sitewide-rebuild-v18\.css[^>]*>', '', text, flags=re.I)
    text = re.sub(r'\s*<script[^>]+sitewide-rebuild-v18\.js[^>]*></script>', '', text, flags=re.I)
    # Page-level audio must never be an independent autoplay source. The V23 universal player owns playback.
    text = re.sub(r'(<audio\b[^>]*?)\s+autoplay\b', r'\1', text, flags=re.I)
    if '<head' in text.lower() and '</head>' in text.lower():
        text = re.sub(r'(</head>)', CSS + '\n' + JS + '\n\\1', text, count=1, flags=re.I)
    if text != original:
        path.write_text(text, encoding='utf-8')
        print(path)
