from pathlib import Path
import re

ROOT = Path('.')


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


for path in sorted(ROOT.rglob('*.html')):
    if any(part in {'.git', 'node_modules'} for part in path.parts):
        continue
    text = path.read_text(encoding='utf-8')
    original = text

    logo = "https://cevylpnoexugwgygvtgu.supabase.co/storage/v1/object/sign/images/podcastinglogo.png?token=eyJraWQiOiI5Yzg1OGE1OS1lOTQ3LTQwZjYtYWUwYS0zNDA3MWZlZjIyNmQiLCJhbGciOiJIUzUxMiJ9.eyJ1cmwiOiJpbWFnZXMvcG9kY2FzdGluZ2xvZ28ucG5nIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc5MTIxMjY2MiwiZXhwIjoxOTQ4ODkyNjYyfQ.BKJBftIQ8-xRMhaC0yLHVXCyoS4YNQDrjdIrDwHW7v8jE6nZ8GRscpsVZ1TrmAnSBpTJQqx-disdr5xilI862A"
    preload = f'<link rel="preload" as="image" href="{logo}" fetchpriority="high" data-crow-podcasting-logo-preload>'
    prefix = '../' * (len(path.parent.parts) - len(ROOT.parts))
    css = f'<link rel="stylesheet" href="{prefix}css/sitewide-rebuild-v18.css?v=20261005-v23.5" data-crow-v23-css>'
    js = f'<script src="{prefix}js/sitewide-rebuild-v18.js?v=20261005-v23.3" defer data-crow-v23-js></script>'
    text = re.sub(r'\s*<link[^>]+sitewide-rebuild-v18\.css[^>]*>', '', text, flags=re.I)
    text = re.sub(r'\s*<script[^>]+sitewide-rebuild-v18\.js[^>]*></script>', '', text, flags=re.I)
    text = re.sub(r'(<audio\b[^>]*?)\s+autoplay\b', r'\1', text, flags=re.I)
    text = re.sub(r'<body\b[^>]*>', add_halloween_class, text, count=1, flags=re.I)
    if '<head' in text.lower() and '</head>' in text.lower():
        text = re.sub(r'</head>', css + '\n' + js + '\n</head>', text, count=1, flags=re.I)
    if text != original:
        path.write_text(text, encoding='utf-8')
        print(path)
