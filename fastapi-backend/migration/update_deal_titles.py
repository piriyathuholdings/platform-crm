from sqlmodel import Session, select
from app.db import engine
from app.models.crm import Deal, Organization

def update_deal_titles():
    with Session(engine) as session:
        deals = session.exec(select(Deal)).all()
        orgs = {o.id: o.organization_name for o in session.exec(select(Organization)).all()}
        
        for deal in deals:
            org_name = orgs.get(deal.organization_id, "Unknown Organization")
            product_type = ""
            
            # Mapping logic based on user request
            name_lower = org_name.lower()
            if "computek" in name_lower:
                product_type = "ERP"
            elif "r2s realtors" in name_lower:
                if deal.deal_value == 70000:
                    product_type = "website Intergration"
                elif deal.deal_value == 40000:
                    product_type = "Website"
                else:
                    product_type = "Website"
            elif "kammal by riya" in name_lower:
                product_type = "website"
            elif "aquaneeta" in name_lower:
                product_type = "website"
            elif "four square" in name_lower:
                product_type = "website"
            elif "amicare" in name_lower:
                product_type = "website"
            elif "avosys" in name_lower:
                product_type = "erp"
            elif "imperial" in name_lower:
                product_type = "crm"
            elif "inspire" in name_lower:
                product_type = "erp"
            elif "fun riders" in name_lower:
                product_type = "erp"
            elif "hemito digital" in name_lower:
                product_type = "crm"
            else:
                product_type = "Deal" # Fallback
                
            new_title = f"{org_name} - {product_type}"
            print(f"Updating Deal {deal.id}: '{deal.deal_title}' -> '{new_title}'")
            deal.deal_title = new_title
            session.add(deal)
        
        session.commit()
        print("All deals updated successfully.")

if __name__ == "__main__":
    update_deal_titles()
