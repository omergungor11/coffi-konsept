#!/usr/bin/env python3
"""Reproducibly mirror Delta homepage media/CSS; Nuxt JS is reference-only."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, parse_qs, unquote, quote
from urllib.request import Request, urlopen
import hashlib, html, json, re, time

ROOT=Path(__file__).resolve().parents[1]
BASE='https://deltacafes.com'
PUBLIC=ROOT/'public'; REF=ROOT/'reference'
manifest={}; failed={}; complete=set(); css_order=[]; js_queue=set(); assets=set()
MEDIA=re.compile(r'\.(?:png|jpg|jpeg|webp|avif|gif|svg|ico|mp4|webm|mov|mp3|riv|woff2?|ttf|otf|wasm)(?:\?|$)',re.I)

def norm(u,base=BASE+'/en'):
    return urljoin(base,html.unescape(u).replace('\\u002F','/').replace('\\/','/'))

def local_path(u):
    p=urlsplit(u)
    if p.path.endswith('.js') and p.netloc=='deltacafes.com': return REF/'nuxt'/Path(p.path).name
    if p.path.endswith('_payload.json'): return REF/'payload.json'
    if p.netloc=='deltacafes.com' and not p.query: return PUBLIC/p.path.lstrip('/')
    if p.path=='/_vercel/image':
        source=parse_qs(p.query).get('url',['image.jpg'])[0]
        stem=Path(urlsplit(source).path).stem
        return PUBLIC/'assets'/'images'/(stem+'-'+hashlib.sha1(u.encode()).hexdigest()[:10]+'.'+Path(urlsplit(source).path).suffix.lstrip('.'))
    name=Path(p.path).name or 'asset'
    if p.query:
        path=Path(name); name=path.stem+'-'+hashlib.sha1(p.query.encode()).hexdigest()[:10]+path.suffix
    return PUBLIC/'assets'/p.netloc/name

def register(u,base=BASE+'/en'):
    if not u or u.startswith(('data:','#','blob:')): return None
    u=norm(u,base); p=urlsplit(u)
    if p.scheme not in ('http','https'): return None
    dest=local_path(u)
    if str(dest).startswith(str(PUBLIC)):
        target='/'+str(dest.relative_to(PUBLIC))
        manifest[u]=target
        if p.netloc=='deltacafes.com': manifest[p.path+('?' + p.query if p.query else '')]=target
    assets.add(u)
    return u

class PageParser(HTMLParser):
    def __init__(self): super().__init__(); self.instyle=False; self.style=''
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='style': self.instyle=True; self.style=''
        if tag=='link':
            href=a.get('href',''); rel=a.get('rel','')
            if rel=='stylesheet': css_order.append(('link',norm(href))); register(href)
            elif href.endswith('.js') and '/_nuxt/' in href: js_queue.add(norm(href))
            elif MEDIA.search(href) or href.endswith('.webmanifest'): register(href)
        if tag=='script' and a.get('src','').endswith('.js') and '/_nuxt/' in a['src']: js_queue.add(norm(a['src']))
        if tag in ('img','source','video','image','use'):
            for key in ('src','poster','href','xlink:href'):
                if key in a: register(a[key])
            for part in a.get('srcset','').split(','):
                if part.strip(): register(part.strip().split()[0])
        if 'style' in a: scan_css(a['style'],BASE+'/en')
    def handle_data(self,data):
        if self.instyle: self.style+=data
    def handle_endtag(self,tag):
        if tag=='style': self.instyle=False; css_order.append(('inline',self.style)); scan_css(self.style,BASE+'/en')

def scan_css(s,base):
    for u in re.findall(r'url\(\s*[\'\"]?([^\)\'\"]+)',s): register(u.strip(),base)

def scan_media(s,base=BASE+'/en'):
    s=s.replace('\\u002F','/').replace('\\/','/')
    for u in re.findall(r'https?://[^\s"\'<>\\]+',s):
        if MEDIA.search(u): register(u,base)
    for u in re.findall(r'["\']((?:/|\.\./|\./)[^"\'\s<>]+)["\']',s):
        if MEDIA.search(u): register(u,base)

def download(u):
    dest=local_path(u)
    if dest.exists() and dest.stat().st_size: return u,dest,None
    dest.parent.mkdir(parents=True,exist_ok=True)
    err=None
    for attempt in range(3):
        try:
            req=Request(quote(u,safe="/:?=&%+@,;!$'()*[]~-"),headers={'User-Agent':'Mozilla/5.0','Accept':'*/*'})
            with urlopen(req,timeout=25) as r: data=r.read()
            dest.write_bytes(data)
            return u,dest,None
        except Exception as e:
            err=str(e); time.sleep(attempt+0.2)
    # Optimized Vercel URLs occasionally reject non-browser clients; original media is equivalent at full size.
    if urlsplit(u).path=='/_vercel/image':
        try:
            src=parse_qs(urlsplit(u).query)['url'][0]
            with urlopen(Request(src,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as r: dest.write_bytes(r.read())
            return u,dest,None
        except Exception as e: err=str(e)
    return u,dest,err

def batch(urls):
    results=[]
    with ThreadPoolExecutor(max_workers=12) as pool:
        fs=[pool.submit(download,u) for u in sorted(set(urls)-complete)]
        for f in as_completed(fs):
            u,p,e=f.result(); complete.add(u)
            if e: failed[u]=e
            else: results.append((u,p))
    return results

def main():
    source=(REF/'home.html').read_text()
    PageParser().feed(source); scan_media(source)
    payload=re.search(r'data-src="([^\"]+_payload.json[^\"]*)"',source)
    if payload:
        result=batch([norm(payload.group(1))])
        for u,p in result: scan_media(p.read_text(),u)
    print('Initial media/CSS:',len(assets),'JS:',len(js_queue),flush=True)
    # Follow module dependencies, including lazily imported component chunks.
    for depth in range(6):
        pending=js_queue-complete
        if not pending: break
        print('JavaScript reference depth',depth,'files',len(pending),flush=True)
        for u,p in batch(pending):
            s=p.read_text(); scan_media(s,u)
            for dep in re.findall(r'["\']((?:\./|/_nuxt/)?[\w.-]+\.(?:js|css))["\']',s):
                dep=norm(dep,u)
                if dep.endswith('.js'): js_queue.add(dep)
                else: register(dep)
    # CSS can refer to fonts or background images, so follow it before the final asset pass.
    for step in range(3):
        pending=assets-complete
        if not pending: break
        print('Asset pass',step,'files',len(pending),flush=True)
        for u,p in batch(pending):
            if p.suffix=='.css': scan_css(p.read_text(),u)
    def rewrite_css(s,base):
        def sub(m):
            raw=m.group(1).strip().strip('\'"'); u=norm(raw,base)
            return 'url("'+manifest.get(u,raw)+'")'
        return re.sub(r'url\(([^)]+)\)',sub,s)
    pieces=[]
    for kind,value in css_order:
        if kind=='inline': pieces.append(rewrite_css(value,BASE+'/en'))
        else:
            p=local_path(value)
            if p.exists(): pieces.append('/* '+value+' */\n'+rewrite_css(p.read_text(),value))
    (PUBLIC/'styles').mkdir(parents=True,exist_ok=True)
    (PUBLIC/'styles'/'original.css').write_text('\n'.join(pieces))
    # Reference modules contain source-only asset paths that are not deployed.
    # Never replace a working remote URL with a local destination that failed.
    valid_manifest={u:v for u,v in manifest.items() if (PUBLIC/v.lstrip('/')).is_file()}
    (REF/'asset-manifest.json').write_text(json.dumps(valid_manifest,indent=2))
    (ROOT/'src/data').mkdir(parents=True,exist_ok=True)
    (ROOT/'src/data/asset-manifest.json').write_text(json.dumps(valid_manifest,indent=2))
    (REF/'asset-download-errors.json').write_text(json.dumps(failed,indent=2))
    print('Done:',len(complete),'downloads;',len(manifest),'aliases;',len(failed),'failures',flush=True)
    print(json.dumps(failed,indent=2),flush=True)

if __name__=='__main__': main()
