import gzip
import re

backup_path = "frappe-bench/sites/crm.piriyathu.com/private/backups/20260427_233013-crm_piriyathu_com-database.sql.gz"

def get_sample(table_name):
    print(f"--- {table_name} ---")
    in_values = False
    with gzip.open(backup_path, "rt") as f:
        for line in f:
            if line.startswith(f"INSERT INTO `{table_name}`"):
                in_values = True
                continue
            if in_values:
                print(line[:1000])
                break

get_sample("tabDeal")
get_sample("tabCRM Task") # Wait, was it tabTask or tabCRM Task? I checked tabTask earlier.
get_sample("tabTask")
get_sample("tabNote")
get_sample("tabFCRM Note")
get_sample("tabCRM Deal") # Just in case
