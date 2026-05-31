import gzip
import re
import logging
import sys
import bcrypt
from datetime import datetime, date
from sqlmodel import Session, create_engine, select, delete
from typing import Dict, List, Any

# Add parent directory to path for imports
sys.path.append('.')

from app.config import settings
from app.models.crm import (
    User, Product, Organization, Contact, Lead, Deal, Task, Note,
    Activity, Expense, ClientPayment
)

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BACKUP_PATH = "../frappe-bench/sites/crm.piriyathu.com/private/backups/20260427_233013-crm_piriyathu_com-database.sql.gz"

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def parse_date(date_str: str) -> date:
    if not date_str or date_str == 'NULL':
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        return None

def parse_datetime(dt_str: str) -> datetime:
    if not dt_str or dt_str == 'NULL':
        return datetime.utcnow()
    try:
        return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S.%f')
    except:
        return datetime.utcnow()

class BackupMigration:
    def __init__(self):
        self.engine = create_engine(settings.database_url)
        self.session = Session(self.engine)
        self.table_data = {}
        self.default_password_hash = get_password_hash("password")

    def parse_backup(self):
        logger.info(f"Parsing backup file: {BACKUP_PATH}")
        current_table = None
        in_values = False
        with gzip.open(BACKUP_PATH, "rt") as f:
            for line in f:
                line = line.strip()
                if not line: continue
                if line.startswith("INSERT INTO"):
                    match = re.search(r"INSERT INTO `(.*?)` VALUES", line)
                    if match:
                        current_table = match.group(1)
                        if current_table not in self.table_data:
                            self.table_data[current_table] = []
                        in_values = True
                        continue
                if in_values:
                    if line.endswith(";"):
                        line = line[:-1]
                        in_values = False
                    records = re.findall(r"\((.*?)\)(?:,|$)", line)
                    for rec in records:
                        cols = re.findall(r"'(?:''|[^'])*'|[^,]+", rec)
                        parsed_cols = [c.strip().strip("'").replace("''", "'") if c.strip().startswith("'") else c.strip() for c in cols]
                        self.table_data[current_table].append(parsed_cols)
        logger.info(f"Parsed {len(self.table_data)} tables from backup")

    def migrate_users(self):
        logger.info("Migrating Users...")
        rows = self.table_data.get("tabUser", [])
        for row in rows:
            if len(row) < 10: continue
            email = row[0]
            if not email or '@' not in email: continue
            full_name = row[12] if len(row) > 12 else row[8]
            enabled = row[7] == '1'
            existing = self.session.exec(select(User).where(User.email == email)).first()
            if not existing:
                user = User(
                    username=email, email=email, full_name=full_name,
                    role="Business Admin" if email in ["joseph.p.j@icloud.com", "Administrator"] else "Business User",
                    hashed_password=self.default_password_hash, is_active=enabled,
                    created_at=parse_datetime(row[1]), updated_at=parse_datetime(row[2])
                )
                self.session.add(user)
        self.session.commit()

    def migrate_products(self):
        logger.info("Migrating Products...")
        rows = self.table_data.get("tabCRM Product", []) + self.table_data.get("tabProduct", [])
        for row in rows:
            if len(row) < 9: continue
            product_code = row[0]
            if not self.session.exec(select(Product).where(Product.product_code == product_code)).first():
                product = Product(
                    product_code=product_code,
                    product_name=row[8] if len(row) > 8 else product_code,
                    is_active=True,
                    created_at=parse_datetime(row[1]), updated_at=parse_datetime(row[2])
                )
                self.session.add(product)
        self.session.commit()

    def migrate_organizations(self):
        logger.info("Migrating Organizations...")
        # Check both tabCRM Organization and tabOrganization
        rows = self.table_data.get("tabCRM Organization", []) + self.table_data.get("tabOrganization", [])
        products = {p.product_code: p.id for p in self.session.exec(select(Product)).all()}
        for row in rows:
            if len(row) < 8: continue
            org_name = row[7]
            if not self.session.exec(select(Organization).where(Organization.organization_name == org_name)).first():
                product_code = row[8] if len(row) > 8 else None
                product_id = products.get(product_code)
                if not product_id:
                    # Fallback to first product or skip
                    product_id = list(products.values())[0] if products else None
                
                org = Organization(
                    organization_name=org_name, product_id=product_id,
                    assigned_to=row[9] if len(row) > 9 else None,
                    status="Active",
                    created_at=parse_datetime(row[1]), updated_at=parse_datetime(row[2])
                )
                self.session.add(org)
        self.session.commit()

    def migrate_leads(self):
        logger.info("Migrating Leads...")
        rows = self.table_data.get("tabCRM Lead", [])
        products = {p.product_code: p.id for p in self.session.exec(select(Product)).all()}
        for row in rows:
            if len(row) < 40: continue
            lead_name = row[20]
            if not self.session.exec(select(Lead).where(Lead.lead_name == lead_name)).first():
                product_code = row[48] if len(row) > 48 else None
                product_id = products.get(product_code)
                if not product_id: continue
                lead = Lead(
                    lead_name=lead_name, product_id=product_id,
                    email=row[0] if '@' in row[0] else None,
                    status=row[34], assigned_to=row[13],
                    created_at=parse_datetime(row[1]), updated_at=parse_datetime(row[2])
                )
                self.session.add(lead)
        self.session.commit()

    def migrate_deals(self):
        logger.info("Migrating Deals...")
        rows = self.table_data.get("tabDeal", [])
        products = {p.product_code: p.id for p in self.session.exec(select(Product)).all()}
        
        org_rows = self.table_data.get("tabCRM Organization", []) + self.table_data.get("tabOrganization", [])
        frappe_org_to_name = {row[0]: row[7] for row in org_rows}
        local_org_map = {o.organization_name: o.id for o in self.session.exec(select(Organization)).all()}
        
        migrated_count = 0
        updated_count = 0
        
        for row in rows:
            if len(row) < 15: continue
            deal_title = row[7]
            product_id = products.get(row[8])
            if not product_id: continue
            
            frappe_org_id = row[11]
            org_name = frappe_org_to_name.get(frappe_org_id)
            local_org_id = local_org_map.get(org_name)
            
            existing = self.session.exec(select(Deal).where(Deal.deal_title == deal_title)).first()
            if not existing:
                deal = Deal(
                    deal_title=deal_title,
                    product_id=product_id,
                    organization_id=local_org_id,
                    assigned_to=row[9],
                    deal_status=row[13],
                    probability=int(float(row[14])) if row[14] and row[14] != 'NULL' else 0,
                    deal_value=float(row[15]) if row[15] and row[15] != 'NULL' else 0,
                    created_at=parse_datetime(row[1]),
                    updated_at=parse_datetime(row[2])
                )
                self.session.add(deal)
                migrated_count += 1
            else:
                if local_org_id and existing.organization_id != local_org_id:
                    existing.organization_id = local_org_id
                    self.session.add(existing)
                    updated_count += 1
                    
        self.session.commit()
        logger.info(f"Deals: {migrated_count} migrated, {updated_count} updated with org links")

    def migrate_all(self):
        self.parse_backup()
        self.migrate_users()
        self.migrate_products()
        self.migrate_organizations()
        self.migrate_leads()
        self.migrate_deals()
        logger.info("Migration complete!")

if __name__ == "__main__":
    migrator = BackupMigration()
    migrator.migrate_all()
