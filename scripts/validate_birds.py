#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
birds.json の構文・必須項目・選択肢の表記ゆれをチェックする。
ローカルでも `python3 scripts/validate_birds.py` で実行できるほか、
GitHub Actions (validate-birds-json.yml) が push 時に自動実行する。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
BIRDS_JSON = ROOT / "birds.json"

REQUIRED_FIELDS = ["id", "name", "kana", "row", "size", "colors", "seasons",
                    "habitats", "beak", "features", "similar", "image"]

VALID_SIZE = {"特大", "大", "中", "小"}
VALID_COLORS = {"茶系", "白系", "黒系", "赤系", "黄系", "青系", "緑系", "灰系"}
VALID_SEASONS = {"春", "夏", "秋", "冬"}
VALID_HABITATS = {"市街・住宅地", "河川・湖沼", "農耕地", "海", "森林", "草地", "裸地", "高山"}
VALID_ROWS = {"ア", "カ", "サ", "タ", "ナ", "ハ", "マ", "ヤ", "ラ", "ワ"}
VALID_VOICE_TYPES = {"単音", "連続音", "フレーズ", "複雑なメロディ", "その他", None}


def fail(msg: str, errors: list):
    errors.append(msg)


def main():
    errors = []

    if not BIRDS_JSON.exists():
        print(f"NG: {BIRDS_JSON} が見つかりません")
        sys.exit(1)

    try:
        data = json.loads(BIRDS_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"NG: JSON構文エラー — {e}")
        sys.exit(1)

    if not isinstance(data, list):
        print("NG: ルートは配列(リスト)である必要があります")
        sys.exit(1)

    ids_seen = set()
    for i, b in enumerate(data):
        label = f"[{i}] {b.get('name', b.get('id', '???'))}"

        for field in REQUIRED_FIELDS:
            if field not in b:
                fail(f"{label}: 必須項目 '{field}' がありません", errors)

        bid = b.get("id")
        if bid in ids_seen:
            fail(f"{label}: id '{bid}' が重複しています", errors)
        ids_seen.add(bid)

        if b.get("size") not in VALID_SIZE:
            fail(f"{label}: size '{b.get('size')}' は {VALID_SIZE} のいずれかにしてください", errors)

        for c in b.get("colors", []):
            if c not in VALID_COLORS:
                fail(f"{label}: colors に不正な値 '{c}'(表記ゆれの可能性。{VALID_COLORS} のいずれか)", errors)

        for s in b.get("seasons", []):
            if s not in VALID_SEASONS:
                fail(f"{label}: seasons に不正な値 '{s}'", errors)

        for h in b.get("habitats", []):
            if h not in VALID_HABITATS:
                fail(f"{label}: habitats に不正な値 '{h}'(表記ゆれの可能性。{VALID_HABITATS} のいずれか)", errors)

        if b.get("row") not in VALID_ROWS:
            fail(f"{label}: row '{b.get('row')}' が50音行(ア〜ワ)ではありません", errors)

        if b.get("voice_type") not in VALID_VOICE_TYPES:
            fail(f"{label}: voice_type '{b.get('voice_type')}' は {VALID_VOICE_TYPES - {None}} のいずれか(未設定ならnull)", errors)

        for sim in b.get("similar", []):
            if not any(other.get("name") == sim or other.get("name", "").startswith(sim) for other in data):
                # 警告扱い(存在しない種名でもビルドは止めない)
                print(f"WARN: {label}: similar '{sim}' に一致する種が見つかりません(表記ゆれの可能性)")

    if errors:
        print(f"NG: {len(errors)} 件のエラー")
        for e in errors:
            print(" -", e)
        sys.exit(1)

    print(f"OK: {len(data)} 種、問題なし")


if __name__ == "__main__":
    main()
