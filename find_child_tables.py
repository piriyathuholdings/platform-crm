import gzip
import re

backup_path = "/Users/josephpj/Downloads/20260426_213455-crm_piriyathu_com-database.sql.gz"

tables_with_parent = []
current_table = None

with gzip.open(backup_path, "rt") as f:
    for line in f:
        if line.startswith("CREATE TABLE `"):
            current_table = re.search(r"`(.*?)`", line).group(1)
        if current_table and "`parent`" in line:
            tables_with_parent.append(current_table)
            current_table = None

print("Tables with 'parent' column:")
for t in tables_with_parent:
    if "Expense" in t or "Deal" in t or "Income" in t:
        print(t)
