#!/usr/bin/env bash
# Runtime proof for the bootstrap + rentals slices (see root feature_list.json evidence).
# Requires: app running on :3000, FRESH DB migrated, owner seeded (changeme).
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

# --- rentals/create-rental (cleaning buffer = 2 days unless overridden) ---

RENTAL_DRESS_ID=$(curl -sf -X POST "$BASE/dresses" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"VD-900","name":"Váy chứng thực thuê","rentalPrice":1200000,"depositAmount":2000000}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")
echo "POST /dresses (rental fixture) -> id=$RENTAL_DRESS_ID"

rent=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Nguyễn Thị Hoa\",\"customerPhone\":\"0903123456\",\"startDate\":\"2026-08-01\",\"endDate\":\"2026-08-03\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals 08-01..08-03 -> $rent (expect 201)"

# 08-04..08-06 does NOT overlap the rental days, only the 2-day cleaning buffer (blocked through 08-05).
buffered=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Trần Văn B\",\"customerPhone\":\"0912345678\",\"startDate\":\"2026-08-04\",\"endDate\":\"2026-08-06\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals 08-04..08-06 (buffer overlap) -> $buffered (expect 409)"

free=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Trần Văn B\",\"customerPhone\":\"0912345678\",\"startDate\":\"2026-08-06\",\"endDate\":\"2026-08-07\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals 08-06..08-07 (past the buffer) -> $free (expect 201)"

ghost=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"customerName":"Ma","customerPhone":"0900000000","startDate":"2026-09-01","endDate":"2026-09-02","items":[{"dressId":"00000000-0000-4000-8000-000000000999"}]}')
echo "POST /rentals unknown dress -> $ghost (expect 404)"

badrange=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Lỗi\",\"customerPhone\":\"0900000001\",\"startDate\":\"2026-09-10\",\"endDate\":\"2026-09-09\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals end before start -> $badrange (expect 400)"

[ "$unauth" = "401" ] && [ "$create" = "201" ] && [ "$dup" = "409" ] && [ "$me" = "owner" ] \
  && [ "$rent" = "201" ] && [ "$buffered" = "409" ] && [ "$free" = "201" ] \
  && [ "$ghost" = "404" ] && [ "$badrange" = "400" ] \
  && echo "SMOKE: ALL PASS" || { echo "SMOKE: FAIL"; exit 1; }
