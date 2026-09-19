#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
images/ に追加・更新された画像を、長辺1200px以下 + WebP に変換する。
圏外キャッシュ(Service Worker)のサイズを抑えるため。
変換後、birds.json の image パスも新しいファイル名(.webp)に書き換える。

使い方:
  python3 scripts/optimize_images.py <対象ファイル1> <対象ファイル2> ...
GitHub Actions (optimize-images.yml) から、変更のあった画像ファイルだけを渡して呼ばれる。
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parent.parent
BIRDS_JSON = ROOT / "birds.json"
MAX_SIDE = 1200


def optimize(path: Path) -> Path | None:
    if path.suffix.lower() == ".webp":
        return None  # 既にwebpなら対象外
    if not path.exists():
        return None  # 削除された画像はスキップ

    img = Image.open(path).convert("RGB")
    w, h = img.size
    scale = MAX_SIDE / max(w, h)
    if scale < 1:
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    new_path = path.with_suffix(".webp")
    img.save(new_path, "WEBP", quality=82, method=6)
    if new_path != path:
        path.unlink()  # 元ファイル(jpg/png等)は削除し、webpに一本化
    return new_path


def update_birds_json(rename_map: dict):
    if not rename_map or not BIRDS_JSON.exists():
        return
    data = json.loads(BIRDS_JSON.read_text(encoding="utf-8"))
    changed = False
    for b in data:
        old = b.get("image")
        if old in rename_map:
            b["image"] = rename_map[old]
            changed = True
    if changed:
        BIRDS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"birds.json を更新: {len(rename_map)} 件のパスを差し替え")


def main():
    targets = sys.argv[1:]
    if not targets:
        print("対象ファイルが指定されていません(変更なしとみなして終了)")
        return

    rename_map = {}
    for t in targets:
        path = ROOT / t
        if "images/" not in t:
            continue
        try:
            new_path = optimize(path)
        except Exception as e:
            print(f"WARN: {t} の最適化に失敗しました({e})。元ファイルのまま残します。")
            continue
        if new_path:
            rel_old = t
            rel_new = str(new_path.relative_to(ROOT))
            rename_map[rel_old] = rel_new
            print(f"{rel_old} -> {rel_new}")

    update_birds_json(rename_map)


if __name__ == "__main__":
    main()
