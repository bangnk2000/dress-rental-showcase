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

# --- rentals/availability-check + catalog get-dress ---
# Bookings so far on VD-900: 08-01..08-03 (blocked through 08-05), 08-06..08-07 (blocked through 08-09).

detail=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dresses/$RENTAL_DRESS_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "GET /dresses/:id -> $detail (expect 200)"

ghostdress=$(curl -s -o /dev/null -w '%{http_code}' \
  "$BASE/dresses/00000000-0000-4000-8000-000000000999" -H "Authorization: Bearer $TOKEN")
echo "GET /dresses/:id unknown -> $ghostdress (expect 404)"

# A later booking isolates the CANDIDATE-side buffer: 08-20..08-21 blocks through 08-23.
rent3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Lê Thị C\",\"customerPhone\":\"0987654321\",\"startDate\":\"2026-08-20\",\"endDate\":\"2026-08-21\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals 08-20..08-21 -> $rent3 (expect 201)"

avail_free=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=2026-08-16&endDate=2026-08-17" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability 08-16..08-17 -> available=$avail_free (expect true; buffered range 08-16..08-19 stays clear)"

avail_buffer=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=2026-08-17&endDate=2026-08-18" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.available+':'+j.conflicts.length)})")
echo "availability 08-17..08-18 -> $avail_buffer (expect false:1 — the CANDIDATE buffer 08-17..08-20 hits the 08-20 booking)"

avail_overlap=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=2026-08-02&endDate=2026-08-02" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability 08-02..08-02 -> available=$avail_overlap (expect false; direct overlap)"

ranges=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/booked-ranges" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.data.length+':'+j.data[0].blockedUntilDate)})")
echo "GET /dresses/:id/booked-ranges -> $ranges (expect 3:2026-08-05 — buffer materialized in blockedUntilDate)"

avail_bad=$(curl -s -o /dev/null -w '%{http_code}' \
  "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=2026-08-18&endDate=2026-08-17" \
  -H "Authorization: Bearer $TOKEN")
echo "availability end before start -> $avail_bad (expect 400)"

avail_ghost=$(curl -s -o /dev/null -w '%{http_code}' \
  "$BASE/dresses/00000000-0000-4000-8000-000000000999/availability?startDate=2026-08-16&endDate=2026-08-17" \
  -H "Authorization: Bearer $TOKEN")
echo "availability unknown dress -> $avail_ghost (expect 404)"

[ "$unauth" = "401" ] && [ "$create" = "201" ] && [ "$dup" = "409" ] && [ "$me" = "owner" ] \
  && [ "$rent" = "201" ] && [ "$buffered" = "409" ] && [ "$free" = "201" ] \
  && [ "$ghost" = "404" ] && [ "$badrange" = "400" ] \
  && [ "$detail" = "200" ] && [ "$ghostdress" = "404" ] && [ "$rent3" = "201" ] \
  && [ "$avail_free" = "true" ] && [ "$avail_buffer" = "false:1" ] \
  && [ "$avail_overlap" = "false" ] && [ "$ranges" = "3:2026-08-05" ] \
  && [ "$avail_bad" = "400" ] && [ "$avail_ghost" = "404" ] \
  && echo "SMOKE: ALL PASS" || { echo "SMOKE: FAIL"; exit 1; }
