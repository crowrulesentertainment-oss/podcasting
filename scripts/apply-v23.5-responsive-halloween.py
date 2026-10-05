from pathlib import Path
import re

ROOT=Path('.')
CSS='<link rel="stylesheet" href="css/v23.5-responsive-halloween.css?v=20261005-v23.5" data-crow-v23-responsive-halloween>'
for path in sorted(ROOT.glob('*.html')):
    text=path.read_text(encoding='utf-8')
    original=text
    text=re.sub(r'\s*<link[^>]+v23\.5-responsive-halloween\.css[^>]*>','',text,flags=re.I)
    # Make every page explicitly use the Halloween theme without replacing page-specific classes.
    text=re.sub(r'<body(?![^>]*\bcr-halloween-theme\b)([^>]*)>',r'<body class="cr-halloween-theme"\1>',text,count=1,flags=re.I)
    if '</head>' in text.lower():
        text=re.sub(r'(</head>)',CSS+r'\n\1',text,count=1,flags=re.I)
    if text!=original:path.write_text(text,encoding='utf-8')
