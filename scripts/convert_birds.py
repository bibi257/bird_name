#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1 birds.json (スズメ大/留鳥/6分類habitat) を
v2スキーマ(小中大特大/春夏秋冬/8分類habitats/50音row/voice_type)へ自動変換する。
開発計画_v2.md の変換ルールに対応。
"""
import json
import re
import sys
from pathlib import Path

SRC = Path(__file__).parent / "birds.v1.json"
DST = Path(__file__).parent.parent / "birds.json"

# --- 大きさ変換 ---
SIZE_MAP = {
    "スズメ大": "小",
    "ムクドリ大": "中",
    "ハト大": "中",
    "カラス大": "大",
    "それ以上": "特大",
}

# --- 色変換(既存の単色名 → 「〜系」) ---
COLOR_MAP = {
    "茶": "茶系", "白": "白系", "黒": "黒系", "赤・橙": "赤系",
    "黄": "黄系", "青": "青系", "緑": "緑系", "灰": "灰系",
}

# --- 季節変換(留鳥/夏鳥/冬鳥/旅鳥 → 春夏秋冬の複数フラグ) ---
SEASON_MAP = {
    "留鳥": ["春", "夏", "秋", "冬"],
    "夏鳥": ["春", "夏"],
    "冬鳥": ["秋", "冬"],
    "旅鳥": ["春", "秋"],
}

# --- 生息地変換(既存6分類語 → サントリー準拠8分類) ---
HABITAT_MAP = {
    "市街地": "市街・住宅地", "公園": "市街・住宅地", "駅": "市街・住宅地", "駐車場": "市街・住宅地",
    "水辺": "河川・湖沼", "河川": "河川・湖沼", "池": "河川・湖沼", "渓流": "河川・湖沼", "河川敷": "河川・湖沼",
    "田畑": "農耕地",
    "海岸": "海",
    "林": "森林", "藪": "森林",
    "草地": "草地", "芝生": "草地",
}

# --- 50音の行判定 ---
ROW_TABLE = [
    ("ア", "あいうえおぁぃぅぇぉ"), ("カ", "かきくけこがぎぐげごゃゅょ" ),
    ("サ", "さしすせそざじずぜぞ"), ("タ", "たちつてとだぢづでど っ"),
    ("ナ", "なにぬねの"), ("ハ", "はひふへほばびぶべぼぱぴぷぺぽ"),
    ("マ", "まみむめも"), ("ヤ", "やゆよ"),
    ("ラ", "らりるれろ"), ("ワ", "わをん"),
]

def kana_row(kana: str) -> str:
    if not kana:
        return "ア"
    c = kana[0]
    for row, chars in ROW_TABLE:
        if c in chars:
            return row
    return "ア"

# --- 特徴文から鳴き声表現を抽出(「」内の擬音語) ---
VOICE_TEXT_RE = re.compile(r"「([^」]+)」")

def extract_voice(features: str):
    m = VOICE_TEXT_RE.search(features)
    if not m:
        return None, None
    text = m.group(1)
    # ざっくりタイプ分類:繰り返し記号や長さで推定(あとで手動修正前提)
    if "ホー" in text or "ケキョ" in text or "カッコウ" in text:
        vtype = "フレーズ"
    elif len(text) <= 3:
        vtype = "単音"
    elif re.search(r"(.)\1", text) or "、" in text:
        vtype = "連続音"
    else:
        vtype = "その他"
    return vtype, text

def convert_one(b: dict) -> dict:
    size = SIZE_MAP.get(b.get("size"), "中")
    colors = [COLOR_MAP.get(c, c) for c in b.get("colors", [])]
    seasons = SEASON_MAP.get(b.get("season"), ["春", "夏", "秋", "冬"])
    habitats = sorted({HABITAT_MAP.get(h, h) for h in b.get("habitat", [])})
    voice_type, voice_text = extract_voice(b.get("features", ""))
    return {
        "id": b["id"],
        "name": b["name"],
        "kana": b.get("kana", ""),
        "row": kana_row(b.get("kana", "")),
        "size": size,
        "colors": colors,
        "seasons": seasons,
        "habitats": habitats,
        "beak": b.get("beak", ""),
        "voice_type": voice_type,
        "voice_text": voice_text,
        "audio": None,
        "features": b.get("features", ""),
        "similar": b.get("similar", []),
        "image": b.get("image", ""),
    }

def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    converted = [convert_one(b) for b in data]
    # 名前順ではなく50音行→kana順に並べる(一覧の既定順)
    row_order = {r: i for i, (r, _) in enumerate(ROW_TABLE)}
    converted.sort(key=lambda b: (row_order.get(b["row"], 99), b["kana"]))
    DST.write_text(json.dumps(converted, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(converted)} 種を変換 → {DST}")
    no_voice = sum(1 for b in converted if not b["voice_text"])
    print(f"鳴き声テキスト未抽出: {no_voice} 種(features内に「」が無かったもの。手動で補うと鳴き声タブが充実します)")

if __name__ == "__main__":
    main()
