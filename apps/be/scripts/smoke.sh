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

# --- catalog/manage-dress (partial update + owner-only retire; photos are pasted links) ---

DRESS1_ID=$(curl -sf "$BASE/dresses?q=VD-001" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data[0].id))")

patch=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/dresses/$DRESS1_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Váy cưới ren trắng (sửa)","rentalPrice":1800000,"photoUrls":["https://example.com/vd001-a.jpg","https://example.com/vd001-b.jpg"]}')
echo "PATCH /dresses/:id -> $patch (expect 200)"

patched=$(curl -sf "$BASE/dresses/$DRESS1_ID" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.name+':'+j.photoUrls.length+':'+j.rentalPrice)})")
echo "GET after PATCH -> $patched (expect 'Váy cưới ren trắng (sửa):2:1800000' — omitted fields kept)"

dupcode=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/dresses/$DRESS1_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"VD-900"}')
echo "PATCH code to a taken one -> $dupcode (expect 409)"

patch404=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH \
  "$BASE/dresses/00000000-0000-4000-8000-000000000999" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Ma"}')
echo "PATCH unknown dress -> $patch404 (expect 404)"

retire=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/dresses/$DRESS1_ID/retire" \
  -H "Authorization: Bearer $TOKEN")
echo "POST /dresses/:id/retire -> $retire (expect 200; token belongs to the owner)"

retire2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/dresses/$DRESS1_ID/retire" \
  -H "Authorization: Bearer $TOKEN")
echo "POST retire again -> $retire2 (expect 409)"

retired_avail=$(curl -sf "$BASE/dresses/$DRESS1_ID/availability?startDate=2026-10-01&endDate=2026-10-02" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability of a RETIRED dress -> available=$retired_avail (expect false even with a free calendar)"

# --- rentals/today-board (bookings on VD-900: 08-01..08-03, 08-06..08-07, 08-20..08-21) ---

board_out=$(curl -sf "$BASE/rentals/today-board?date=2026-08-01" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dueOut.length+':'+j.dueBack.length+':'+j.dueOut[0].dresses[0].code)})")
echo "today-board 2026-08-01 -> $board_out (expect 1:0:VD-900 — the 08-01 rental goes out)"

board_back=$(curl -sf "$BASE/rentals/today-board?date=2026-08-03" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dueOut.length+':'+j.dueBack.length)})")
echo "today-board 2026-08-03 -> $board_back (expect 0:1 — the 08-01..08-03 rental comes back)"

# A single-day rental must show on BOTH lists. 09-20 clears every earlier buffer.
oneday=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Phạm Thị D\",\"customerPhone\":\"0977000111\",\"startDate\":\"2026-09-20\",\"endDate\":\"2026-09-20\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals 09-20..09-20 (single day) -> $oneday (expect 201)"

board_both=$(curl -sf "$BASE/rentals/today-board?date=2026-09-20" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const same=j.dueOut.length===1&&j.dueBack.length===1&&j.dueOut[0].rentalId===j.dueBack[0].rentalId;console.log(j.dueOut.length+':'+j.dueBack.length+':'+same)})")
echo "today-board 2026-09-20 -> $board_both (expect 1:1:true — single-day rental on both lists, same rental)"

board_quiet=$(curl -sf "$BASE/rentals/today-board?date=2026-08-10" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dueOut.length+':'+j.dueBack.length)})")
echo "today-board 2026-08-10 (quiet day) -> $board_quiet (expect 0:0)"

board_bad=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rentals/today-board?date=2026-02-30" \
  -H "Authorization: Bearer $TOKEN")
echo "today-board 2026-02-30 (no such day) -> $board_bad (expect 400, not a 500 from the ::date cast)"

board_default=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rentals/today-board" \
  -H "Authorization: Bearer $TOKEN")
echo "today-board without date -> $board_default (expect 200 — server-today default)"

# --- rentals/return-rental (pickup → out, return settles, overdue surfaces) ---
# State: VD-900 has booked rentals 08-01..08-03, 08-06..08-07, 08-20..08-21, 09-20..09-20.

RID1=$(curl -sf "$BASE/rentals/today-board?date=2026-08-01" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).dueOut[0].rentalId))")

pickup=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/pickup" \
  -H "Authorization: Bearer $TOKEN")
echo "POST /rentals/:id/pickup -> $pickup (expect 200; booked -> out)"

pickup2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/pickup" \
  -H "Authorization: Bearer $TOKEN")
echo "POST pickup again -> $pickup2 (expect 409; already out)"

board_after_pickup=$(curl -sf "$BASE/rentals/today-board?date=2026-08-01" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).dueOut.length))")
echo "today-board 2026-08-01 after pickup -> dueOut=$board_after_pickup (expect 0; an out rental is with the customer)"

board_back_status=$(curl -sf "$BASE/rentals/today-board?date=2026-08-03" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).dueBack[0].status))")
echo "today-board 2026-08-03 due-back status -> $board_back_status (expect out)"

board_overdue=$(curl -sf "$BASE/rentals/today-board?date=2026-08-04" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.overdue.length+':'+j.overdue[0].status)})")
echo "today-board 2026-08-04 overdue -> $board_overdue (expect 1:out — end 08-03 already past)"

ret=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"lateFee":200000,"damageFee":0,"depositRefund":2800000,"note":"Trễ 1 ngày"}')
echo "POST /rentals/:id/return (fees + refund) -> $ret (expect 200)"

ret2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
echo "POST return again -> $ret2 (expect 409; already returned)"

board_after_return=$(curl -sf "$BASE/rentals/today-board?date=2026-08-04" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.overdue.length+':'+j.dueBack.length)})")
echo "today-board 2026-08-04 after return -> $board_after_return (expect 0:0; returned rentals leave the board)"

badfee=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"lateFee":-5}')
echo "POST return negative fee -> $badfee (expect 400)"

ghostpick=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/rentals/00000000-0000-4000-8000-000000000999/pickup" -H "Authorization: Bearer $TOKEN")
echo "POST pickup unknown rental -> $ghostpick (expect 404)"

ghostret=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/rentals/00000000-0000-4000-8000-000000000999/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
echo "POST return unknown rental -> $ghostret (expect 404)"

# --- rentals/list-rentals ---
# State: 4 rentals on VD-900 — 08-01 (RETURNED, Nguyễn Thị Hoa), 08-06 (Trần Văn B),
# 08-20 (Lê Thị C), 09-20 (Phạm Thị D). ORDER BY created_at DESC → newest first.

list_all=$(curl -sf "$BASE/rentals" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.count+':'+j.data.length+':'+j.data[0].customerName)})")
echo "GET /rentals -> $list_all (expect 4:4:Phạm Thị D — newest first)"

list_q=$(curl -sf "$BASE/rentals?q=Hoa" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.count+':'+j.data[0].customerName)})")
echo "GET /rentals?q=Hoa -> $list_q (expect 1:Nguyễn Thị Hoa)"

list_phone=$(curl -sf "$BASE/rentals?q=0912" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).count))")
echo "GET /rentals?q=0912 (phone search) -> $list_phone (expect 1 — Trần Văn B)"

list_status=$(curl -sf "$BASE/rentals?status=returned" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.count+':'+j.data[0].dresses[0].code)})")
echo "GET /rentals?status=returned -> $list_status (expect 1:VD-900 — dresses ride along)"

list_page=$(curl -sf "$BASE/rentals?limit=2&page=2" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.data.length+':'+j.page+':'+j.count)})")
echo "GET /rentals?limit=2&page=2 -> $list_page (expect 2:2:4)"

list_badstatus=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rentals?status=weird" \
  -H "Authorization: Bearer $TOKEN")
echo "GET /rentals?status=weird -> $list_badstatus (expect 400)"

# --- rentals/cancel-rental (cancelled frees the calendar AT THE DB LEVEL) ---

RID5=$(curl -sf -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Võ Thị E\",\"customerPhone\":\"0966000222\",\"startDate\":\"2026-10-01\",\"endDate\":\"2026-10-02\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")
echo "POST /rentals 10-01..10-02 (cancel fixture) -> id=$RID5"

avail_before=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=2026-10-01&endDate=2026-10-02" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability 10-01..10-02 before cancel -> $avail_before (expect false)"

cancel=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID5/cancel" \
  -H "Authorization: Bearer $TOKEN")
echo "POST /rentals/:id/cancel -> $cancel (expect 200)"

cancel2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID5/cancel" \
  -H "Authorization: Bearer $TOKEN")
echo "POST cancel again -> $cancel2 (expect 409; already cancelled)"

avail_after=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=2026-10-01&endDate=2026-10-02" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability 10-01..10-02 after cancel -> $avail_after (expect true — calendar freed)"

rebook=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Đỗ Thị G\",\"customerPhone\":\"0955000333\",\"startDate\":\"2026-10-01\",\"endDate\":\"2026-10-02\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals SAME dates after cancel -> $rebook (expect 201 — EXCLUDE ignores non-blocking rows)"

RID6=$(curl -sf "$BASE/rentals/today-board?date=2026-08-20" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).dueOut[0].rentalId))")
pickup3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID6/pickup" \
  -H "Authorization: Bearer $TOKEN")
cancel_out=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID6/cancel" \
  -H "Authorization: Bearer $TOKEN")
echo "cancel an OUT rental -> $cancel_out (expect 409 after pickup=$pickup3 — out must be returned)"

cancel404=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/rentals/00000000-0000-4000-8000-000000000999/cancel" -H "Authorization: Bearer $TOKEN")
echo "cancel unknown rental -> $cancel404 (expect 404)"

list_cancelled=$(curl -sf "$BASE/rentals?status=cancelled" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).count))")
echo "GET /rentals?status=cancelled -> $list_cancelled (expect 1 — history kept)"

# --- payments/list-payments (read side of the return settlement) ---

pay_list=$(curl -sf "$BASE/rentals/$RID1/payments" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.data.length+':'+j.data[0].kind+':'+j.data[0].amount+':'+j.data[1].kind+':'+j.data[1].amount)})")
echo "GET /rentals/:id/payments (returned rental) -> $pay_list (expect 2:deposit_refund:2800000:late_fee:200000 — same-transaction rows tie-break on kind)"

pay_empty=$(curl -sf "$BASE/rentals/$RID6/payments" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.length))")
echo "GET payments of an unsettled rental -> $pay_empty (expect 0)"

pay404=$(curl -s -o /dev/null -w '%{http_code}' \
  "$BASE/rentals/00000000-0000-4000-8000-000000000999/payments" -H "Authorization: Bearer $TOKEN")
echo "GET payments of unknown rental -> $pay404 (expect 404)"

[ "$unauth" = "401" ] && [ "$create" = "201" ] && [ "$dup" = "409" ] && [ "$me" = "owner" ] \
  && [ "$rent" = "201" ] && [ "$buffered" = "409" ] && [ "$free" = "201" ] \
  && [ "$ghost" = "404" ] && [ "$badrange" = "400" ] \
  && [ "$detail" = "200" ] && [ "$ghostdress" = "404" ] && [ "$rent3" = "201" ] \
  && [ "$avail_free" = "true" ] && [ "$avail_buffer" = "false:1" ] \
  && [ "$avail_overlap" = "false" ] && [ "$ranges" = "3:2026-08-05" ] \
  && [ "$avail_bad" = "400" ] && [ "$avail_ghost" = "404" ] \
  && [ "$patch" = "200" ] && [ "$patched" = "Váy cưới ren trắng (sửa):2:1800000" ] \
  && [ "$dupcode" = "409" ] && [ "$patch404" = "404" ] \
  && [ "$retire" = "200" ] && [ "$retire2" = "409" ] && [ "$retired_avail" = "false" ] \
  && [ "$board_out" = "1:0:VD-900" ] && [ "$board_back" = "0:1" ] && [ "$oneday" = "201" ] \
  && [ "$board_both" = "1:1:true" ] && [ "$board_quiet" = "0:0" ] \
  && [ "$board_bad" = "400" ] && [ "$board_default" = "200" ] \
  && [ "$pickup" = "200" ] && [ "$pickup2" = "409" ] && [ "$board_after_pickup" = "0" ] \
  && [ "$board_back_status" = "out" ] && [ "$board_overdue" = "1:out" ] \
  && [ "$ret" = "200" ] && [ "$ret2" = "409" ] && [ "$board_after_return" = "0:0" ] \
  && [ "$badfee" = "400" ] && [ "$ghostpick" = "404" ] && [ "$ghostret" = "404" ] \
  && [ "$list_all" = "4:4:Phạm Thị D" ] && [ "$list_q" = "1:Nguyễn Thị Hoa" ] \
  && [ "$list_phone" = "1" ] && [ "$list_status" = "1:VD-900" ] \
  && [ "$list_page" = "2:2:4" ] && [ "$list_badstatus" = "400" ] \
  && [ -n "$RID5" ] && [ "$avail_before" = "false" ] && [ "$cancel" = "200" ] \
  && [ "$cancel2" = "409" ] && [ "$avail_after" = "true" ] && [ "$rebook" = "201" ] \
  && [ "$pickup3" = "200" ] && [ "$cancel_out" = "409" ] && [ "$cancel404" = "404" ] \
  && [ "$list_cancelled" = "1" ] \
  && [ "$pay_list" = "2:deposit_refund:2800000:late_fee:200000" ] \
  && [ "$pay_empty" = "0" ] && [ "$pay404" = "404" ] \
  && echo "SMOKE: ALL PASS" || { echo "SMOKE: FAIL"; exit 1; }
