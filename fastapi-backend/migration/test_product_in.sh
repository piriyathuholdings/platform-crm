#!/bin/bash

BASE_URL="http://127.0.0.1:8000"
USERNAME="joseph.p.j@icloud.com"
PASSWORD="password"

# Login and save cookies
curl -s -c cookies.txt -X POST "$BASE_URL/api/method/login" \
     -H "Content-Type: application/json" \
     -d "{\"usr\": \"$USERNAME\", \"pwd\": \"$PASSWORD\"}" > /dev/null

echo "Testing Product lookup with 'in' filter:"
FILTERS='[["name", "in", ["11"]]]'
ENCODED_FILTERS=$(echo -n $FILTERS | jq -sRr @uri)
curl -s -g -b cookies.txt -X GET "$BASE_URL/api/resource/Product?filters=$ENCODED_FILTERS" | jq .

rm cookies.txt
