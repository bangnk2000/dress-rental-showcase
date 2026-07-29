#!/usr/bin/env bash
# Runtime proof for the bootstrap slice (see root feature_list.json evidence).
# Requires: app running on :3000, DB migrated, owner seeded (changeme).
set -euo pipefail
BASE=${BASE:-http://localhost:3000/api/v1}

TOKEN=$(curl -sf -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"changeme"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken))")
echo "login: OK (token issued)"

unauth=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dresses")
echo "GET /dresses without token -> $unauth (expect 401)"

create=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/dresses" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"VD-001","name":"Váy cưới ren trắng","sizeLabel":"M","rentalPrice":1500000,"depositAmount":3000000}')
echo "POST /dresses -> $create (expect 201)"

dup=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/dresses" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"VD-001","name":"Trùng mã","rentalPrice":1,"depositAmount":1}')
echo "POST /dresses duplicate code -> $dup (expect 409)"

count=$(curl -sf "$BASE/dresses?q=VD-001" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).count))")
echo "GET /dresses?q=VD-001 -> count=$count (expect >=1)"

me=$(curl -sf "$BASE/auth/me" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.role)})")
echo "GET /auth/me -> role=$me (expect owner)"

[ "$unauth" = "401" ] && [ "$create" = "201" ] && [ "$dup" = "409" ] && [ "$me" = "owner" ] \
  && echo "SMOKE: ALL PASS" || { echo "SMOKE: FAIL"; exit 1; }
