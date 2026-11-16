#!/usr/bin/env python3
"""게임에서 쓰는 글자만 남겨 갈무리 폰트를 작게 만든다.

사용법: python3 tools/subset-fonts.py <Galmuri11.woff2 경로> <Galmuri11-Bold.woff2 경로>
(폰트 원본: https://github.com/quiple/galmuri , SIL OFL 1.1)
"""
import glob
import os
import sys

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def used_chars():
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars.update('·…—–→←↑↓×✕%°')
    files = glob.glob(os.path.join(ROOT, 'js', '*.js')) + [os.path.join(ROOT, 'index.html')]
    for f in files:
        with open(f, encoding='utf-8') as fh:
            for ch in fh.read():
                if ord(ch) >= 0x80:
                    chars.add(ch)
    return ''.join(sorted(chars))


def run(src, dst, text):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    subset.save_font(font, dst, opts)
    print(dst, os.path.getsize(dst), 'bytes')


if __name__ == '__main__':
    text = used_chars()
    print(len(text), 'glyphs')
    run(sys.argv[1], os.path.join(ROOT, 'fonts', 'galmuri11-sub.woff2'), text)
    run(sys.argv[2], os.path.join(ROOT, 'fonts', 'galmuri11-bold-sub.woff2'), text)
