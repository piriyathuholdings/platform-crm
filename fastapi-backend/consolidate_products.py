import sqlite3

def consolidate_products():
    conn = sqlite3.connect('dev.db')
    cursor = conn.cursor()
    
    # Target products
    computemate_id = 11
    stitchingmate_id = 10
    
    # Old IDs to merge into Computemate
    to_computemate = [1, 2, 3, 4, 5, 7, 8, 9]
    # Old IDs to merge into Stitchingmate
    to_stitchingmate = [6]
    
    tables = [
        ('organization', 'product_id'),
        ('contact', 'product_id'),
        ('lead', 'product_id'),
        ('deal', 'product_id'),
        ('task', 'product_id'),
        ('note', 'product_id'),
        ('activity', 'product_id'),
        ('userproductaccess', 'product_id')
    ]
    
    print("Consolidating products...")
    
    # Merge into Computemate
    for old_id in to_computemate:
        for table, column in tables:
            cursor.execute(f"UPDATE {table} SET {column} = ? WHERE {column} = ?", (computemate_id, old_id))
            if cursor.rowcount > 0:
                print(f"Moved {cursor.rowcount} records from product {old_id} to {computemate_id} (Computemate) in {table}")
                
    # Merge into Stitchingmate
    for old_id in to_stitchingmate:
        for table, column in tables:
            cursor.execute(f"UPDATE {table} SET {column} = ? WHERE {column} = ?", (stitchingmate_id, old_id))
            if cursor.rowcount > 0:
                print(f"Moved {cursor.rowcount} records from product {old_id} to {stitchingmate_id} (Stitchingmate) in {table}")

    # Now delete the other products
    cursor.execute("DELETE FROM product WHERE id NOT IN (?, ?)", (computemate_id, stitchingmate_id))
    print(f"Deleted {cursor.rowcount} old product records.")
    
    conn.commit()
    conn.close()
    print("Product consolidation complete!")

if __name__ == "__main__":
    consolidate_products()
