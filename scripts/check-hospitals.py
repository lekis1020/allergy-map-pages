#!/usr/bin/env python3
"""
Hospital doctor change detector for kaaaci-map.
Compares scraped doctor data against src/data/allergy-hospitals.json.
If differences are found, updates JSON, commits, and opens a PR.

Input: JSON via stdin or --scraped file, mapping hospital_name -> {dept: [doctor_names]}
"""

import argparse, json, subprocess, sys
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).resolve().parent.parent
HOSPITALS_JSON = REPO_ROOT / "data" / "allergy-hospitals.json"
# Local-only (gitignored): doctors scraped from hospital sites who are not
# society members, mapping hospital_name -> {dept: [doctor_names]}
EXCLUSIONS_JSON = REPO_ROOT / "data" / "doctor-exclusions.json"

def load_json(p):
    with open(p) as f: return json.load(f)

def norm(s):
    return s.strip().replace(" ", "")

def apply_exclusions(scraped, exclusions):
    """Drop excluded (non-society-member) names from scraped data."""
    dropped = []
    out = {}
    for hosp, depts in scraped.items():
        ex_h = exclusions.get(hosp, {})
        out[hosp] = {}
        for dept, names in depts.items():
            ex = {norm(n) for n in ex_h.get(dept, [])}
            kept = [n for n in names if norm(n) not in ex]
            dropped += [f"{hosp}/{dept}/{n}" for n in names if norm(n) in ex]
            out[hosp][dept] = kept
    return out, dropped

def compare_doctors(cur, scr):
    # Only compare depts present in scraped data — update_json never touches
    # unscraped depts, so reporting them as removed would be misleading.
    changes = {}
    for dept in scr:
        c = {norm(n) for n in cur.get(dept, [])}
        s = {norm(n) for n in scr.get(dept, [])}
        a, r = sorted(s - c), sorted(c - s)
        if a or r: changes[dept] = {"added": a, "removed": r}
    return changes

def compare_all(current, scraped):
    results, by_name = {}, {h["name"]: h for h in current}
    for name, depts in scraped.items():
        if name not in by_name:
            results[name] = {"_new": True, "doctors": depts}
        else:
            ch = compare_doctors(by_name[name]["doctors"], depts)
            if ch: results[name] = ch
    return results

def update_json(current, scraped):
    out = []
    for h in current:
        if h["name"] in scraped:
            nd = h["doctors"].copy()
            for d, names in scraped[h["name"]].items():
                nd[d] = sorted({norm(n) for n in names})
            h = {**h, "doctors": nd}
        out.append(h)
    return out

def report(changes):
    if not changes: return "No changes detected. All hospital doctor data is up to date."
    lines = ["## Hospital Doctor Changes\n"]
    for hosp, depts in sorted(changes.items()):
        lines.append(f"### {hosp}")
        for d, ch in sorted(depts.items()):
            p = []
            if ch.get("added"): p.append(f"+{','.join(ch['added'])}")
            if ch.get("removed"): p.append(f"-{','.join(ch['removed'])}")
            lines.append(f"- **{d}**: {' | '.join(p)}")
        lines.append("")
    return "\n".join(lines)

def create_pr(report_text):
    ds = datetime.now().strftime("%Y-%m")
    branch = f"auto/hospital-update-{ds}"
    r = subprocess.run(["git", "diff", "--quiet", str(HOSPITALS_JSON)], cwd=REPO_ROOT, capture_output=True)
    if r.returncode == 0:
        print("No changes to commit.")
        return None
    subprocess.run(["git", "checkout", "-b", branch], cwd=REPO_ROOT, check=True)
    subprocess.run(["git", "add", str(HOSPITALS_JSON)], cwd=REPO_ROOT, check=True)
    subprocess.run(["git", "commit", "-m", f"Update hospital doctors ({ds})"], cwd=REPO_ROOT, check=True)
    subprocess.run(["git", "push", "origin", branch], cwd=REPO_ROOT, check=True)
    r = subprocess.run(["gh", "pr", "create", "--title", f"Hospital doctor update ({ds})",
        "--body", report_text, "--base", "main", "--head", branch],
        cwd=REPO_ROOT, capture_output=True, text=True)
    if r.returncode == 0: return r.stdout.strip()
    sys.stderr.write(f"PR failed: {r.stderr}\n")
    return None

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--scraped", type=Path, help="Path to scraped JSON file (default: stdin)")
    p.add_argument("--dry-run", action="store_true", help="Show changes without modifying files or creating PR")
    args = p.parse_args()
    cur = load_json(HOSPITALS_JSON)
    print(f"Loaded {len(cur)} hospitals from JSON")
    scr = load_json(args.scraped) if args.scraped else json.load(sys.stdin)
    print(f"Scraped data from {len(scr)} hospitals")
    if EXCLUSIONS_JSON.exists():
        scr, dropped = apply_exclusions(scr, load_json(EXCLUSIONS_JSON))
        if dropped:
            print(f"Excluded {len(dropped)} non-member doctor(s): {', '.join(dropped)}")
    ch = compare_all(cur, scr)
    rpt = report(ch)
    print(rpt)
    if not ch:
        print("No changes.")
        return
    if args.dry_run:
        print("[DRY RUN] Would update JSON and create PR. Use without --dry-run to apply.")
        return
    upd = update_json(cur, scr)
    with open(HOSPITALS_JSON, "w") as f:
        json.dump(upd, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Updated {HOSPITALS_JSON}")
    url = create_pr(rpt)
    if url: print(f"PR: {url}")

if __name__ == "__main__":
    main()
