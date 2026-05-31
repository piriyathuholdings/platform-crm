#!/bin/bash

BASE_URL="http://127.0.0.1:8000"
USERNAME="joseph.p.j@icloud.com"
PASSWORD="password"

# Login and save cookies
curl -s -c cookies.txt -X POST "$BASE_URL/api/method/login" \
     -H "Content-Type: application/json" \
     -d "{\"usr\": \"$USERNAME\", \"pwd\": \"$PASSWORD\"}" > /dev/null

echo "Updating Deal 1 with invalid contact:"
curl -s -b cookies.txt -X PUT "$BASE_URL/api/resource/Deal/1" \
     -H "Content-Type: application/json" \
     -d "{\"contact\": \"INVALID_CONTACT\"}" | jq .

rm cookies.txt
