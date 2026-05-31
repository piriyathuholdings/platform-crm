#!/bin/bash

BASE_URL="http://127.0.0.1:8000"
USERNAME="joseph.p.j@icloud.com"
PASSWORD="password"

# Login and save cookies
curl -s -c cookies.txt -X POST "$BASE_URL/api/method/login" \
     -H "Content-Type: application/json" \
     -d "{\"usr\": \"$USERNAME\", \"pwd\": \"$PASSWORD\"}" > /dev/null

echo "Fetching a Deal record:"
curl -s -b cookies.txt -X GET "$BASE_URL/api/resource/Deal?limit_page_length=1" | jq '.data[0] | {id, deal_title, product, product_id}'

rm cookies.txt
