import sqlite3
import datetime

DB_PATH = 'dev.db'

def setup_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Clear existing deals and expenses
    cursor.execute("DELETE FROM expense")
    cursor.execute("DELETE FROM deal")
    conn.commit()

    # Get organizations map
    cursor.execute("SELECT id, organization_name FROM organization")
    org_map = {name: id for id, name in cursor.fetchall()}
    # Add variations
    org_map['Four Square Contracting'] = org_map.get('Four Square Contracting') or org_map.get('Four Square Contractors')
    org_map['Imperial Electrical Contractors'] = org_map.get('Imperial Electrical Contractors') or org_map.get('Imperial Electricals')

    # Deals data from image
    deals = [
        ('DEAL-00004', 'R2S Realtors', 'Ready to Close', 90, 70000, 70000, 0),
        ('DEAL-00002', 'Computek', 'Ready to Close', 90, 500000, 475000, 25000),
        ('DEAL-00003', 'R2S Realtors', 'Won', 100, 40000, 0, 40000),
        ('DEAL-00008', 'Kammal by Riya', 'Ready to Close', 90, 40000, 40000, 0),
        ('DEAL-00011', 'Aquaneeta', 'Won', 100, 18000, 10000, 8000),
        ('DEAL-00010', 'Four Square Contracting', 'Ready to Close', 90, 51600, 51600, 0),
        ('DEAL-00007', 'Amicare', 'Negotiation', 70, 25000, 25000, 0),
        ('DEAL-00001', 'Avosys', 'Ready to Close', 90, 115000, 115000, 0),
        ('DEAL-00005', 'Imperial Electrical Contractors', 'Qualification', 10, 100000, 100000, 0),
        ('DEAL-00006', 'Inspire Electric', 'Qualification', 10, 250000, 250000, 0),
        ('DEAL-00009', 'Fun Riders', 'Lost', 0, 240000, 240000, 0),
        ('DEAL-00012', 'Hemito Digital Pvt Ltd', 'Qualification', 10, 130000, 130000, 0),
    ]

    deal_name_to_id = {}
    now = datetime.datetime.now().isoformat()

    for title, org_name, status, prob, val, collect, received in deals:
        org_id = org_map.get(org_name)
        if not org_id:
            # Try fuzzy match or creating?
            # Actually, most should exist.
            print(f"Warning: Org {org_name} not found")
        
        cursor.execute("""
            INSERT INTO deal (
                deal_title, product_id, organization_id, deal_status, probability, 
                deal_value, to_collect, total_payments_received, total_expenses,
                payment_summary_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (title, 2, org_id, status, prob, val, collect, received, 0.0, 'Pending', now, now))
        deal_name_to_id[title] = cursor.lastrowid

    # Expenses data from image
    expenses = [
        ('2026-04-20', 'Cursor Pro Purchase', 'DEAL-00004', 2295.00),
        ('2026-04-13', 'Cursor Pro Purchase', 'DEAL-00003', 2295.00),
        ('2026-04-12', 'R2S Theme Purchase', 'DEAL-00004', 1805.00),
        ('2026-04-02', 'Domain Purchase', 'DEAL-00007', 766.44),
        ('2026-03-31', 'Bugfree Template Purchase', 'DEAL-00007', 2149.00),
        ('2026-03-31', 'Codex purchase', 'DEAL-00007', 1999.00),
        ('2026-03-28', 'Codex', 'DEAL-00011', 2000.00),
        ('2026-03-25', 'Server 1 - Prod', None, 8000.00),
        ('2026-03-25', 'Server 2 - Dev', None, 7400.00),
        ('2026-03-25', 'Codex', 'DEAL-00002', 2000.00),
        ('2026-03-25', 'Codex 2', 'DEAL-00002', 2000.00),
        ('2026-03-25', 'Google Maps Platform', 'DEAL-00002', 1000.00),
        ('2026-03-25', 'Codex', 'DEAL-00003', 2000.00),
        ('2026-03-19', 'Kammal by riya Theme', 'DEAL-00008', 3942.00),
    ]

    for date, title, deal_name, amount in expenses:
        deal_id = deal_name_to_id.get(deal_name) if deal_name else None
        cursor.execute("""
            INSERT INTO expense (
                expense_title, expense_scope, borne_by, expense_date, amount, deal_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (title, 'Deal' if deal_id else 'General', 'joseph.p.j@icloud.com', date, amount, deal_id, now, now))

    # Update total_expenses in deals
    cursor.execute("""
        UPDATE deal 
        SET total_expenses = (
            SELECT SUM(amount) FROM expense WHERE expense.deal_id = deal.id
        )
        WHERE id IN (SELECT deal_id FROM expense WHERE deal_id IS NOT NULL)
    """)

    conn.commit()
    conn.close()
    print("Manual migration complete!")

if __name__ == '__main__':
    setup_data()
