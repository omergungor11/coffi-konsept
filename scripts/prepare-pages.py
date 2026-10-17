#!/usr/bin/env python3
"""Prepare local Next.js route content from the published reference pages.

Only public markup and presentation assets are retained. No Nuxt runtime,
analytics, remote forms, or hydration payload is included in the application.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen
import html, importlib.util, json, re

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('mirror', ROOT/'scripts/mirror-assets.py')
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)
BASE = 'https://deltacafes.com'
REF = ROOT/'reference/pages'
DATA = ROOT/'src/data/pages'
CSS = ROOT/'public/styles/pages'
for folder in [REF, DATA, CSS]: folder.mkdir(parents=True, exist_ok=True)

class PageNode(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source=source; self.start=None; self.end=None; self.depth=0
        self.lines=[0]
        for m in re.finditer('\n', source): self.lines.append(m.end())
    def current_position(self):
        line,col=self.getpos(); return self.lines[line-1]+col
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if self.start is None and a.get('data-component')=='page':
            self.start=self.current_position(); self.depth=1
        elif self.start is not None and self.end is None and tag=='div': self.depth+=1
    def handle_endtag(self,tag):
        if self.start is not None and self.end is None and tag=='div':
            self.depth-=1
            if self.depth==0:self.end=self.current_position()+len('</div>')

def fetch(url):
    req=Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urlopen(req,timeout=20) as r:return r.read()

home=(ROOT/'reference/home.html').read_text()
routes=set(re.findall(r'href="(?:https://deltacafes.com)?/en/([^"?#]+)',home))
routes.update(f.stem.replace('__','/') for f in REF.glob('*.html'))
routes.discard(''); routes.discard('_payload.json')

def prepare(route):
    filename=route.replace('/','__')
    source_file=REF/(filename+'.html')
    try:
        if not source_file.exists():source_file.write_bytes(fetch(BASE+'/en/'+route))
        source=source_file.read_text()
        node=PageNode(source);node.feed(source)
        if node.start is None or node.end is None:return route,'no page node'
        markup=source[node.start:node.end]
        markup=re.sub(r'<!--.*?-->', '', markup, flags=re.S)
        markup=re.sub(r'<script\b.*?</script>', '', markup, flags=re.S)
        markup=re.sub(r'\s(?:srcset|sizes)="[^"]*"', '', markup)
        markup=markup.replace('https://deltacafes.com/en/','/en/').replace('https://deltacafes.com/cafe-dos-acores','/en/the-azores-coffee')
        # Neutralise the transition-only clipping mask; React owns route transitions.
        markup=re.sub(r'style="clip-path:url\(#[^)]+\);position:absolute;"','',markup)
        page_class=re.search(r'<body[^>]*class="([^"]+)"',source)
        title=re.search(r'<title>(.*?)</title>',source,re.S)
        inline=re.findall(r'<style[^>]*>(.*?)</style>',source,re.S)
        links=re.findall(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"',source)
        styles=[]
        for href in links:
            url=urljoin(BASE,html.unescape(href));dest=mirror.local_path(url)
            if not dest.exists():dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(fetch(url))
            def absolute_css(match):
                raw=match.group(1).strip().strip('\'"')
                if raw.startswith(('data:','#')):return match.group(0)
                return 'url("'+urljoin(url,raw)+'")'
            styles.append(re.sub(r'url\(([^)]+)\)',absolute_css,dest.read_text()))
        styles.extend(inline)
        css='\n'.join(styles)
        # Let the shared downloader keep deterministic paths for repeated assets.
        media=[]
        for u in re.findall(r'(?:src|poster|data-file)="([^"]+)"',markup):
            if u.startswith(('data:','blob:')):continue
            if mirror.MEDIA.search(html.unescape(u)) or urlsplit(html.unescape(u)).path=='/_vercel/image':media.append(u)
        for u in re.findall(r'url\(\s*[\'"]?([^\)\'"]+)',css):
            if not u.startswith(('data:','#')):media.append(u)
        return route,{'filename':filename,'markup':markup,'bodyClass':page_class.group(1) if page_class else 'page',
                      'title':html.unescape(title.group(1).strip()) if title else 'Delta Cafés',
                      'css':css,'media':media}
    except Exception as error:return route,str(error)

pages={};errors={}
with ThreadPoolExecutor(max_workers=6) as pool:
    for future in as_completed([pool.submit(prepare,r) for r in sorted(routes)]):
        route,value=future.result()
        if isinstance(value,str):errors[route]=value;print('Page failed:',route,value,flush=True)
        else:
            pages[route]=value
            for url in value['media']:mirror.register(url)
            print('Prepared',route,flush=True)

print('Mirroring route assets:',len(mirror.assets),flush=True)
mirror.batch(mirror.assets)
manifest={**json.loads((ROOT/'src/data/detail-asset-manifest.json').read_text()),**mirror.manifest}
manifest={k:v for k,v in manifest.items() if (ROOT/'public'/v.lstrip('/')).exists()}
aliases=dict(manifest)
for key,value in list(manifest.items()):aliases[key.replace('&','&amp;')]=value
pattern=re.compile('|'.join(map(re.escape,sorted(aliases,key=len,reverse=True))))
def rewrite(text):return pattern.sub(lambda m:aliases[m.group(0)],text)
index={}
for route,page in pages.items():
    filename=page.pop('filename');page.pop('media');css=page.pop('css')
    page['markup']=rewrite(page['markup'])
    page['stylesheet']='/styles/pages/'+filename+'.css'
    (DATA/(filename+'.json')).write_text(json.dumps(page,ensure_ascii=False))
    (CSS/(filename+'.css')).write_text(rewrite(css))
    index[route]={'file':filename+'.json','title':page['title'],'bodyClass':page['bodyClass']}
(ROOT/'src/data/page-index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2))
(ROOT/'src/data/detail-asset-manifest.json').write_text(json.dumps(manifest,indent=2))
(ROOT/'reference/detail-download-errors.json').write_text(json.dumps({'pages':errors,'assets':mirror.failed},indent=2))
print('Prepared',len(index),'local routes; asset failures:',len(mirror.failed),flush=True)
