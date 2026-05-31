import gzip
import re

backup_path = "frappe-bench/sites/crm.piriyathu.com/private/backups/20260425_132940-crm_piriyathu_com-database.sql.gz"
users = ["joseph.p.j@icloud.com", "anju@stitchingmate.com", "ivangeorgearouje@gmail.com"]

results = {user: [] for user in users}

# Table mapping
table_pattern = re.compile(r"INSERT INTO `(.*?)` VALUES")

current_table = None

with gzip.open(backup_path, "rt") as f:
    for line in f:
        table_match = table_pattern.search(line)
        if table_match:
            current_table = table_match.group(1)
        
        if current_table and current_table.startswith("tab"):
            for user in users:
                if user in line:
                    results[user].append(f"{current_table}: {line.strip()[:200]}...")

for user, records in results.items():
    print(f"\nUser: {user}")
    if not records:
        print("No records found")
    else:
        # Group by table for cleaner output
        by_table = {}
        for r in records:
            table = r.split(":")[0]
            if table not in by_table: by_table[table] = 0
            by_table[table] += 1
        for table, count in by_table.items():
            print(f"  - {table}: {count} records")
