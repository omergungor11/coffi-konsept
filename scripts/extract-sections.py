"""Preserve the published section structure and strip captured animation state."""
from html.parser import HTMLParser
from pathlib import Path
import html,json
class Clean(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.out=[]
 def handle_starttag(self,t,a):
  attrs=[]
  for k,v in a:
   if k=='style':
    v=';'.join(p for p in (v or '').split(';') if p.strip().startswith('--'))
    if not v:continue
   attrs.append(k if v is None else f'{k}="{html.escape(v,quote=True)}"')
  self.out.append('<'+t+(' '+' '.join(attrs) if attrs else '')+'>')
 def handle_endtag(self,t):self.out.append('</'+t+'>')
 def handle_data(self,d):self.out.append(d)
 def handle_entityref(self,n):self.out.append('&'+n+';')
 def handle_charref(self,n):self.out.append('&#'+n+';')
 def handle_comment(self,d):pass
j=json.loads(Path('reference/section-markup.json').read_text())
live=json.loads(Path('reference/live-markup.json').read_text())
for k in ['header','history']:
 p=Clean();p.feed(live[k]);j[k]=''.join(p.out)
Path('src/data/section-markup.json').write_text(json.dumps(j,ensure_ascii=False))
Path('src/data/header-data.json').write_text(Path('reference/header-data.json').read_text())
