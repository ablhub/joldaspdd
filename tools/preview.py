#!/usr/bin/env python3
"""Render scene previews to PNG files for visual checking.
Usage: python3 tools/preview.py <input.json> <outdir> [--ids a,b,c] [--per 6]
Prints the list of PNG files. Open them with the Read tool to look at them."""
import sys, os, json, subprocess, asyncio, argparse
from playwright.async_api import async_playwright
ap=argparse.ArgumentParser(); ap.add_argument('inp'); ap.add_argument('outdir'); ap.add_argument('--ids',default=''); ap.add_argument('--per',type=int,default=6)
a=ap.parse_args()
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
a.outdir=os.path.abspath(a.outdir); os.makedirs(a.outdir,exist_ok=True)
data=json.load(open(a.inp))
qs=data if isinstance(data,list) else data.get('questions',[])
qs=[q for q in qs if q.get('scene') or q.get('sign')]
if a.ids: s=set(a.ids.split(',')); qs=[q for q in qs if q['id'] in s]
chunks=[qs[i:i+a.per] for i in range(0,len(qs),a.per)]
base=os.path.splitext(os.path.basename(a.inp))[0]
async def main():
    outs=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1130,'height':800})
        for i,ch in enumerate(chunks):
            tmpj=os.path.join(a.outdir,f'_{base}_{i}.json'); json.dump(ch,open(tmpj,'w'),ensure_ascii=False)
            tmph=os.path.join(a.outdir,f'_{base}_{i}.html')
            subprocess.run(['node',os.path.join(root,'tools','render.js'),tmpj,tmph],check=True,capture_output=True)
            await pg.goto('file://'+tmph); await pg.wait_for_timeout(150)
            png=os.path.join(a.outdir,f'{base}-{i+1:02d}.png'); await pg.screenshot(path=png,full_page=True); outs.append(png)
            os.remove(tmpj); os.remove(tmph)
        await b.close()
    print('\n'.join(outs) if outs else 'no scenes')
asyncio.run(main())
