import gzip
import re
import json
import logging
import sys
from datetime import datetime
from sqlmodel import Session, create_engine, select
from typing import Dict, List, Any

# Add parent directory to path for imports
sys.path.append('.')

from app.config import settings
from app.models.crm import Expense, Deal

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BACKUP_PATH = "/Users/josephpj/Downloads/20260426_213455-crm_piriyathu_com-database.sql.gz"

class VersionExpenseMigration:
    def __init__(self):
        self.engine = create_engine(settings.database_url)
        self.session = Session(self.engine)
        self.deals_map = {d.deal_title: d.id for d in self.session.exec(select(Deal)).all()}

    def migrate(self):
        logger.info(f"Parsing Version data from backup: {BACKUP_PATH}")
        extracted_count = 0
        migrated_count = 0
        
        marker = '\\"doctype\\":\\"CRM Deal Expense\\"'
        
        with gzip.open(BACKUP_PATH, "rt") as f:
            for line in f:
                if marker in line:
                    # Fix the line by unescaping JSON quotes
                    # We need to be careful with double backslashes
                    line_fixed = line.replace('\\"', '"').replace('\\\\', '\\')
                    
                    # Now extract JSON blobs
                    # Look for things that look like {"added":...} or similar
                    blobs = re.findall(r'\{[^{}]*?"doctype":\s*?"CRM Deal Expense".*?\}', line_fixed)
                    
                    if not blobs:
                        # Fallback: extract the whole JSON string from the SQL row
                        raw_blobs = re.findall(r'\'(\{.*?\})\'', line_fixed)
                        for rb in raw_blobs:
                            if '"doctype":"CRM Deal Expense"' in rb:
                                try:
                                    data = json.loads(rb)
                                    for section in ["added", "removed", "row_changed"]:
                                        items = data.get(section, [])
                                        for item_data in items:
                                            if isinstance(item_data, list) and len(item_data) > 1 and isinstance(item_data[1], dict):
                                                field = item_data[0]
                                                item = item_data[1]
                                                if field == "expenses" and item.get("doctype") == "CRM Deal Expense":
                                                    if self.process_item(item):
                                                        migrated_count += 1
                                                        extracted_count += 1
                                except:
                                    continue
                    else:
                        for blob in blobs:
                            try:
                                item = json.loads(blob)
                                if self.process_item(item):
                                    migrated_count += 1
                                    extracted_count += 1
                            except:
                                continue
                                
        self.session.commit()
        logger.info(f"Summary: Extracted {extracted_count} Deal Expenses, Migrated {migrated_count} new records")

    def process_item(self, item):
        deal_title = item.get("parent")
        deal_id = self.deals_map.get(deal_title)
        if not deal_id: return False
        
        description = item.get("description", "Deal Expense")
        amount = float(item.get("amount", 0))
        creation = item.get("creation")
        
        if not description or amount == 0: return False

        # Check for existing
        existing = self.session.exec(select(Expense).where(
            Expense.deal_id == deal_id,
            Expense.expense_title == description,
            Expense.amount == amount
        )).first()
        
        if not existing:
            expense = Expense(
                expense_title=description,
                expense_scope="Deal",
                amount=amount,
                expense_date=datetime.strptime(creation[:10], '%Y-%m-%d').date() if creation else datetime.now().date(),
                assigned_to=item.get("owner", "Administrator"),
                deal_id=deal_id,
                created_at=datetime.strptime(creation[:19], '%Y-%m-%d %H:%M:%S') if creation else datetime.now()
            )
            self.session.add(expense)
            return True
        return False

if __name__ == "__main__":
    migrator = VersionExpenseMigration()
    migrator.migrate()
