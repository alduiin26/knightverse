#!/usr/bin/env python3
"""Rebuild assets/css/site.css after adding or changing Tailwind classes in the pages.

The pages used to load Tailwind from cdn.tailwindcss.com at runtime. Now the styles are built once
with the same Tailwind version (v3.4.17) and served from this site, so no outside script runs on
our pages. Every word in the pages that could be a class (also inside JavaScript strings) is kept.

Needs Python 3 with Playwright:  pip install playwright && python -m playwright install chromium
Run from the repo root:          python3 tools/build-css.py
Offline? Point TAILWIND_JS at a saved copy of https://cdn.tailwindcss.com/3.4.17
"""
import asyncio
import os
import re
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['index.html', 'store.html', 'whitepaper.html', 'game.html', 'infofi.html']
OUT = ROOT / 'assets' / 'css' / 'site.css'
TAILWIND_URL = 'https://cdn.tailwindcss.com/3.4.17'
CONFIG = {'theme': {'extend': {'colors': {'brand': {
    'gold': '#FFD700', 'goldHover': '#e6c200', 'dark': '#0a0a0a', 'card': '#121212', 'border': '#262626'}}}}}


def tailwind_source():
    local = os.environ.get('TAILWIND_JS')
    if local:
        return Path(local).read_text(encoding='utf-8')
    with urllib.request.urlopen(TAILWIND_URL) as r:
        return r.read().decode('utf-8')


def candidates():
    tokens = set()
    for page in PAGES:
        text = (ROOT / page).read_text(encoding='utf-8')
        tokens.update(re.findall(r"[^<>\"'`\s]*[^<>\"'`\s:]", text))
    return sorted(t for t in tokens if len(t) < 120)


async def main():
    tokens = candidates()
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content('<!DOCTYPE html><html><head></head><body><div id="all"></div></body></html>')
        await page.add_script_tag(content=tailwind_source())
        await page.evaluate('cfg => { tailwind.config = cfg }', CONFIG)
        await page.evaluate("cls => { document.getElementById('all').className = cls.join(' ') }", tokens)
        await page.wait_for_timeout(1500)
        css = await page.evaluate("[...document.querySelectorAll('style')].map(s => s.textContent).join('\\n')")
        await browser.close()
    head = ('/*! KnightVerse site styles. Built from Tailwind CSS v3.4.17 (MIT, https://tailwindcss.com)\n'
            ' * with the brand colors, for: ' + ', '.join(PAGES) + '.\n'
            ' * Rebuild after adding new classes: python3 tools/build-css.py (see README). */\n')
    OUT.write_text(head + css, encoding='utf-8')
    print(f'{len(tokens)} candidate words -> {len(css):,} bytes of CSS in {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    asyncio.run(main())
