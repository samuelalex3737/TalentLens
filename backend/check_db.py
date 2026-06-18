import sqlite3, os

db = os.path.join("data", "talentlens.db")
print(f"Exists: {os.path.exists(db)}, Size: {os.path.getsize(db)}")

conn = sqlite3.connect(db)
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]
print(f"Tables: {tables}")

for t in tables:
    c.execute(f"PRAGMA table_info({t})")
    cols = [r[1] for r in c.fetchall()]
    print(f"  {t}: {cols}")

if "candidates" in tables:
    c.execute("PRAGMA table_info(candidates)")
    existing = [r[1] for r in c.fetchall()]
    needed = ["bias_risk", "bias_explanation", "notes"]
    missing = [col for col in needed if col not in existing]
    if missing:
        print(f"\nMissing columns: {missing}")
        for col in missing:
            c.execute(f"ALTER TABLE candidates ADD COLUMN {col} TEXT DEFAULT ''")
            print(f"  Added: {col}")
        conn.commit()
        print("Done!")
    else:
        print("\nAll required columns present.")

conn.close()
