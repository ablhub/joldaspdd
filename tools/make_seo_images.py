"""Картинки для SEO и соцсетей: src/seo/{favicon.svg,favicon.ico,apple-touch-icon.png,icon-192.png,icon-512.png,og-ru.png,og-kk.png,og-en.png}.
Запуск: python3 tools/make_seo_images.py (нужен playwright с chromium; PIL - для favicon.ico)."""
import os
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'src', 'seo')
os.makedirs(OUT, exist_ok=True)

MARK = ('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 3 L97 50 L50 97 L3 50 Z" fill="#fff" stroke="#1A1A1A" stroke-width="3"/>'
        '<path d="M50 16 L84 50 L50 84 L16 50 Z" fill="#F2B200"/></svg>')
FAVICON = ('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="22" fill="#1A2129"/>'
           '<path d="M50 10 L90 50 L50 90 L10 50 Z" fill="#fff" stroke="#1A1A1A" stroke-width="2"/><path d="M50 22 L78 50 L50 78 L22 50 Z" fill="#F2B200"/></svg>')

OG = {
    'ru': ('Жолдас ПДД', 'Подготовка к экзамену на права в Казахстане', ['1803 вопроса с разбором', '172 знака', '15 категорий', 'Казахский, русский, English']),
    'kk': ('Жолдас ЖЖҚ', 'Қазақстанда жүргізуші куәлігі емтиханына дайындық', ['1803 сұрақ талдауымен', '172 жол белгісі', '15 санат', 'Қазақша, орысша, English']),
    'en': ('Joldas', 'Kazakhstan driving theory test prep', ['1803 questions with explanations', '172 road signs', '15 categories', 'Kazakh, Russian, English']),
}


def og_html(lang):
    title, sub, chips = OG[lang]
    ch = ''.join('<span>%s</span>' % c for c in chips)
    return ('<html><body style="margin:0;width:1200px;height:630px;background:#1A2129;color:#EDF1F4;font-family:\'DejaVu Sans\',Arial,sans-serif;position:relative;overflow:hidden">'
            '<div style="position:absolute;left:70px;top:70px;width:96px;height:96px">%s</div>'
            '<div style="position:absolute;left:190px;top:88px;font-size:64px;font-weight:700;letter-spacing:1px">%s</div>'
            '<div style="position:absolute;left:70px;top:240px;width:1000px;font-size:58px;font-weight:700;line-height:1.15">%s</div>'
            '<div style="position:absolute;left:70px;top:440px;display:flex;gap:14px;flex-wrap:wrap;width:1060px;font-size:28px">'
            '<style>span{background:#26303A;border-radius:999px;padding:10px 22px;color:#F5C33B}</style>%s</div>'
            '<div style="position:absolute;left:0;right:0;bottom:44px;height:10px;background:repeating-linear-gradient(90deg,#F2B200 0 70px,transparent 70px 120px)"></div>'
            '</body></html>' % (MARK, title, sub, ch))


def main():
    with open(os.path.join(OUT, 'favicon.svg'), 'w') as f:
        f.write(FAVICON)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for lang in OG:
            pg = b.new_page(viewport={'width': 1200, 'height': 630})
            pg.set_content(og_html(lang))
            pg.screenshot(path=os.path.join(OUT, 'og-%s.png' % lang))
            pg.close()
        for name, size in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('_fav32.png', 32)):
            pg = b.new_page(viewport={'width': size, 'height': size})
            pg.set_content('<html><body style="margin:0;background:transparent"><div style="width:%dpx;height:%dpx">%s</div></body></html>'
                           % (size, size, FAVICON.replace('<svg ', '<svg width="%d" height="%d" ' % (size, size))))
            pg.screenshot(path=os.path.join(OUT, name), omit_background=True)
            pg.close()
        b.close()
    from PIL import Image
    Image.open(os.path.join(OUT, '_fav32.png')).save(os.path.join(OUT, 'favicon.ico'), sizes=[(32, 32)])
    os.remove(os.path.join(OUT, '_fav32.png'))
    print('images ->', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
