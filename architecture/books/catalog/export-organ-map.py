#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
from pathlib import Path
KB = Path(r"D:\genessis\architecture\books\knowledge_base")
data = json.loads((KB/"03_organs"/"organ_knowledge_links.json").read_text(encoding="utf-8-sig"))
out = KB/"10_reports"/"organ_map_export.json"
out.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print("wrote", out, "count", data.get("count"))
