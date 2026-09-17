#!/usr/bin/env bash
# Runtime proof for the bootstrap + rentals slices (see root feature_list.json evidence).
# Requires: app running on :3000, FRESH DB migrated, owner seeded (changeme).
#
# Dates are RELATIVE to the shop's today (FR-RENT-10 made create clock-aware: start <= today is
# born 'out'), anchored at D0 = today+3 so every advance-booking fixture stays 'booked' whatever
# day the script runs. Business rejections are 422 outcomes (ADR 0001), not 409s.
set -euo pipefail
BASE=${BASE:-http://localhost:3000/api/v1}

# Day helper: shop-timezone calendar day, offset in days from NOW.
day() { TZ=Asia/Ho_Chi_Minh date -d "+$1 days" +%F; }
TODAY=$(day 0)
D0=$(day 3)    # anchor: first rental start (was 08-01 in the fixed-date era)
D1=$(day 4);  D2=$(day 5);  D3=$(day 6);  D4=$(day 7);  D5=$(day 8);  D6=$(day 9)
D15=$(day 18); D16=$(day 19); D17=$(day 20); D19=$(day 22); D20=$(day 23)
D40=$(day 43)  # quiet day: no fixture books it
D50=$(day 53)  # single-day rental
D61=$(day 64); D62=$(day 65)  # cancel fixture

TOKEN=$(curl -sf -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"owner","password":"changeme"}' \
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
echo "POST /dresses duplicate code -> $dup (expect 422 — rejected_dress_code_taken)"

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
  -d "{\"customerName\":\"Nguyễn Thị Hoa\",\"customerPhone\":\"0903123456\",\"startDate\":\"$D0\",\"endDate\":\"$D2\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals D0..D2 -> $rent (expect 201)"

# D3..D5 does NOT overlap the rental days, only the 2-day cleaning buffer (blocked through D4).
buffered=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Trần Văn B\",\"customerPhone\":\"0912345678\",\"startDate\":\"$D3\",\"endDate\":\"$D5\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals D3..D5 (buffer overlap) -> $buffered (expect 422 — rejected_dress_unavailable)"

free=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Trần Văn B\",\"customerPhone\":\"0912345678\",\"startDate\":\"$D5\",\"endDate\":\"$D6\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals D5..D6 (past the buffer) -> $free (expect 201)"

ghost=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Ma\",\"customerPhone\":\"0900000000\",\"startDate\":\"$D40\",\"endDate\":\"$D40\",\"items\":[{\"dressId\":\"00000000-0000-4000-8000-000000000999\"}]}")
echo "POST /rentals unknown dress -> $ghost (expect 422 — rejected_dress_not_found)"

badrange=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Lỗi\",\"customerPhone\":\"0900000001\",\"startDate\":\"$D2\",\"endDate\":\"$D0\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals end before start -> $badrange (expect 400)"

# --- rentals/availability-check + catalog get-dress ---
# Bookings so far on VD-900: D0..D2 (blocked through D4), D5..D6 (blocked through D6+2).

detail=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dresses/$RENTAL_DRESS_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "GET /dresses/:id -> $detail (expect 200)"

ghostdress=$(curl -s -o /dev/null -w '%{http_code}' \
  "$BASE/dresses/00000000-0000-4000-8000-000000000999" -H "Authorization: Bearer $TOKEN")
echo "GET /dresses/:id unknown -> $ghostdress (expect 404)"

# A later booking isolates the CANDIDATE-side buffer: D19..D20 blocks through D20+2.
rent3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Lê Thị C\",\"customerPhone\":\"0987654321\",\"startDate\":\"$D19\",\"endDate\":\"$D20\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals D19..D20 -> $rent3 (expect 201)"

avail_free=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=$D15&endDate=$D16" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability D15..D16 -> available=$avail_free (expect true; buffered range stays clear of D19)"

avail_buffer=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=$D16&endDate=$D17" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.available+':'+j.conflicts.length)})")
echo "availability D16..D17 -> $avail_buffer (expect false:1 — the CANDIDATE buffer D16..D19 hits the D19 booking)"

avail_overlap=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=$D1&endDate=$D1" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability D1..D1 -> available=$avail_overlap (expect false; direct overlap)"

ranges=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/booked-ranges" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.data.length+':'+j.data[0].blockedUntilDate)})")
echo "GET /dresses/:id/booked-ranges -> $ranges (expect 3:$D4 — buffer materialized in blockedUntilDate)"

avail_bad=$(curl -s -o /dev/null -w '%{http_code}' \
  "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=$D17&endDate=$D16" \
  -H "Authorization: Bearer $TOKEN")
echo "availability end before start -> $avail_bad (expect 400)"

avail_ghost=$(curl -s -o /dev/null -w '%{http_code}' \
  "$BASE/dresses/00000000-0000-4000-8000-000000000999/availability?startDate=$D15&endDate=$D16" \
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
echo "PATCH code to a taken one -> $dupcode (expect 422 — rejected_dress_code_taken)"

patch404=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH \
  "$BASE/dresses/00000000-0000-4000-8000-000000000999" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Ma"}')
echo "PATCH unknown dress -> $patch404 (expect 422 — rejected_dress_not_found)"

retire=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/dresses/$DRESS1_ID/retire" \
  -H "Authorization: Bearer $TOKEN")
echo "POST /dresses/:id/retire -> $retire (expect 200; token belongs to the owner)"

retire2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/dresses/$DRESS1_ID/retire" \
  -H "Authorization: Bearer $TOKEN")
echo "POST retire again -> $retire2 (expect 422 — rejected_dress_already_retired)"

retired_avail=$(curl -sf "$BASE/dresses/$DRESS1_ID/availability?startDate=$D61&endDate=$D62" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability of a RETIRED dress -> available=$retired_avail (expect false even with a free calendar)"

# --- rentals/today-board (bookings on VD-900: D0..D2, D5..D6, D19..D20) ---

board_out=$(curl -sf "$BASE/rentals/today-board?date=$D0" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dueOut.length+':'+j.dueBack.length+':'+j.dueOut[0].dresses[0].code)})")
echo "today-board D0 -> $board_out (expect 1:0:VD-900 — the D0 rental goes out)"

board_back=$(curl -sf "$BASE/rentals/today-board?date=$D2" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dueOut.length+':'+j.dueBack.length)})")
echo "today-board D2 -> $board_back (expect 0:1 — the D0..D2 rental comes back)"

# A single-day rental must show on BOTH lists. D50 clears every earlier buffer.
oneday=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Phạm Thị D\",\"customerPhone\":\"0977000111\",\"startDate\":\"$D50\",\"endDate\":\"$D50\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals D50..D50 (single day) -> $oneday (expect 201)"

board_both=$(curl -sf "$BASE/rentals/today-board?date=$D50" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const same=j.dueOut.length===1&&j.dueBack.length===1&&j.dueOut[0].rentalId===j.dueBack[0].rentalId;console.log(j.dueOut.length+':'+j.dueBack.length+':'+same)})")
echo "today-board D50 -> $board_both (expect 1:1:true — single-day rental on both lists, same rental)"

board_quiet=$(curl -sf "$BASE/rentals/today-board?date=$D40" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dueOut.length+':'+j.dueBack.length)})")
echo "today-board D40 (quiet day) -> $board_quiet (expect 0:0)"

board_bad=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rentals/today-board?date=2026-02-30" \
  -H "Authorization: Bearer $TOKEN")
echo "today-board 2026-02-30 (no such day) -> $board_bad (expect 400, not a 500 from the ::date cast)"

board_default=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rentals/today-board" \
  -H "Authorization: Bearer $TOKEN")
echo "today-board without date -> $board_default (expect 200 — server-today default)"

# --- rentals/return-rental (pickup → out, return settles, overdue surfaces) ---
# State: VD-900 has booked rentals D0..D2, D5..D6, D19..D20, D50..D50.

RID1=$(curl -sf "$BASE/rentals/today-board?date=$D0" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).dueOut[0].rentalId))")

# FR-RENT-10: a BOOKED rental cannot be settled — nothing was handed over yet.
ret_booked=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
echo "POST return on a BOOKED rental -> $ret_booked (expect 422 — rejected_return_not_allowed)"

pickup=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/pickup" \
  -H "Authorization: Bearer $TOKEN")
echo "POST /rentals/:id/pickup -> $pickup (expect 200; booked -> out)"

pickup2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/pickup" \
  -H "Authorization: Bearer $TOKEN")
echo "POST pickup again -> $pickup2 (expect 422 — rejected_pickup_not_allowed)"

board_after_pickup=$(curl -sf "$BASE/rentals/today-board?date=$D0" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.dueOut.length+':'+j.dueOut[0].status)})")
echo "today-board D0 after pickup -> dueOut=$board_after_pickup (expect 1:out; a handed-out rental stays on the day's board)"

board_back_status=$(curl -sf "$BASE/rentals/today-board?date=$D2" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).dueBack[0].status))")
echo "today-board D2 due-back status -> $board_back_status (expect out)"

board_overdue=$(curl -sf "$BASE/rentals/today-board?date=$D3" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.overdue.length+':'+j.overdue[0].status)})")
echo "today-board D3 overdue -> $board_overdue (expect 1:out — end D2 already past that board date)"

ret=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"lateFee":200000,"damageFee":0,"depositRefund":2800000,"note":"Trễ 1 ngày"}')
echo "POST /rentals/:id/return (fees + refund) -> $ret (expect 200)"

ret2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
echo "POST return again -> $ret2 (expect 422 — already returned)"

board_after_return=$(curl -sf "$BASE/rentals/today-board?date=$D3" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.overdue.length+':'+j.dueBack.length)})")
echo "today-board D3 after return -> $board_after_return (expect 0:0; returned rentals leave the board)"

badfee=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID1/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"lateFee":-5}')
echo "POST return negative fee -> $badfee (expect 400)"

ghostpick=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/rentals/00000000-0000-4000-8000-000000000999/pickup" -H "Authorization: Bearer $TOKEN")
echo "POST pickup unknown rental -> $ghostpick (expect 422 — rejected_rental_not_found)"

ghostret=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/rentals/00000000-0000-4000-8000-000000000999/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
echo "POST return unknown rental -> $ghostret (expect 422 — rejected_rental_not_found)"

# --- rentals/list-rentals ---
# State: 4 rentals on VD-900 — D0 (RETURNED, Nguyễn Thị Hoa), D5 (Trần Văn B),
# D19 (Lê Thị C), D50 (Phạm Thị D). ORDER BY created_at DESC → newest first.

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
  -d "{\"customerName\":\"Võ Thị E\",\"customerPhone\":\"0966000222\",\"startDate\":\"$D61\",\"endDate\":\"$D62\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")
echo "POST /rentals D61..D62 (cancel fixture) -> id=$RID5"

avail_before=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=$D61&endDate=$D62" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability D61..D62 before cancel -> $avail_before (expect false)"

cancel=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID5/cancel" \
  -H "Authorization: Bearer $TOKEN")
echo "POST /rentals/:id/cancel -> $cancel (expect 200)"

cancel2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID5/cancel" \
  -H "Authorization: Bearer $TOKEN")
echo "POST cancel again -> $cancel2 (expect 422 — already cancelled)"

avail_after=$(curl -sf "$BASE/dresses/$RENTAL_DRESS_ID/availability?startDate=$D61&endDate=$D62" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).available))")
echo "availability D61..D62 after cancel -> $avail_after (expect true — calendar freed)"

rebook=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Đỗ Thị G\",\"customerPhone\":\"0955000333\",\"startDate\":\"$D61\",\"endDate\":\"$D62\",\"items\":[{\"dressId\":\"$RENTAL_DRESS_ID\"}]}")
echo "POST /rentals SAME dates after cancel -> $rebook (expect 201 — EXCLUDE ignores non-blocking rows)"

# FR-RENT-10 §6.Q2: an OUT rental with an EMPTY ledger cancels fine (the mis-creation escape hatch).
RID6=$(curl -sf "$BASE/rentals/today-board?date=$D19" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).dueOut[0].rentalId))")
pickup3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID6/pickup" \
  -H "Authorization: Bearer $TOKEN")
cancel_out=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID6/cancel" \
  -H "Authorization: Bearer $TOKEN")
echo "cancel an OUT rental with an empty ledger -> $cancel_out (expect 200 after pickup=$pickup3 — FR-RENT-10)"

cancel404=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/rentals/00000000-0000-4000-8000-000000000999/cancel" -H "Authorization: Bearer $TOKEN")
echo "cancel unknown rental -> $cancel404 (expect 422 — rejected_rental_not_found)"

list_cancelled=$(curl -sf "$BASE/rentals?status=cancelled" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).count))")
echo "GET /rentals?status=cancelled -> $list_cancelled (expect 2 — history kept: RID5 + the out-clean cancel)"

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

# --- rentals/pickup-before-return (FR-RENT-10: born-out + the money gate on cancel) ---

BORN_DRESS_ID=$(curl -sf -X POST "$BASE/dresses" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"VD-950","name":"Váy giao ngay","rentalPrice":900000,"depositAmount":1500000}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")

RID7=$(curl -sf -X POST "$BASE/rentals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"Hồ Thị H\",\"customerPhone\":\"0944000555\",\"startDate\":\"$TODAY\",\"endDate\":\"$TODAY\",\"items\":[{\"dressId\":\"$BORN_DRESS_ID\"}]}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")

born_status=$(curl -sf "$BASE/rentals?q=0944000555" -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data[0].status))")
echo "rental created for TODAY -> status=$born_status (expect out — born delivered)"

born_pickup=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID7/pickup" \
  -H "Authorization: Bearer $TOKEN")
echo "pickup a born-out rental -> $born_pickup (expect 422 — nothing left to hand over)"

collect=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID7/payments/collect" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"deposit":1500000}')
echo "collect deposit on the born-out rental -> $collect (expect 200)"

cancel_money=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID7/cancel" \
  -H "Authorization: Bearer $TOKEN")
echo "cancel with money on file -> $cancel_money (expect 422 — rejected_cancel_has_payments)"

born_return=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rentals/$RID7/return" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"depositRefund":1500000,"expectedDepositCollected":1500000}')
echo "return settles the born-out rental -> $born_return (expect 200 — the only exit once money exists)"

[ "$unauth" = "401" ] && [ "$create" = "201" ] && [ "$dup" = "422" ] && [ "$me" = "owner" ] \
  && [ "$rent" = "201" ] && [ "$buffered" = "422" ] && [ "$free" = "201" ] \
  && [ "$ghost" = "422" ] && [ "$badrange" = "400" ] \
  && [ "$detail" = "200" ] && [ "$ghostdress" = "404" ] && [ "$rent3" = "201" ] \
  && [ "$avail_free" = "true" ] && [ "$avail_buffer" = "false:1" ] \
  && [ "$avail_overlap" = "false" ] && [ "$ranges" = "3:$D4" ] \
  && [ "$avail_bad" = "400" ] && [ "$avail_ghost" = "404" ] \
  && [ "$patch" = "200" ] && [ "$patched" = "Váy cưới ren trắng (sửa):2:1800000" ] \
  && [ "$dupcode" = "422" ] && [ "$patch404" = "422" ] \
  && [ "$retire" = "200" ] && [ "$retire2" = "422" ] && [ "$retired_avail" = "false" ] \
  && [ "$board_out" = "1:0:VD-900" ] && [ "$board_back" = "0:1" ] && [ "$oneday" = "201" ] \
  && [ "$board_both" = "1:1:true" ] && [ "$board_quiet" = "0:0" ] \
  && [ "$board_bad" = "400" ] && [ "$board_default" = "200" ] \
  && [ "$ret_booked" = "422" ] \
  && [ "$pickup" = "200" ] && [ "$pickup2" = "422" ] && [ "$board_after_pickup" = "0" ] \
  && [ "$board_back_status" = "out" ] && [ "$board_overdue" = "1:out" ] \
  && [ "$ret" = "200" ] && [ "$ret2" = "422" ] && [ "$board_after_return" = "0:0" ] \
  && [ "$badfee" = "400" ] && [ "$ghostpick" = "422" ] && [ "$ghostret" = "422" ] \
  && [ "$list_all" = "4:4:Phạm Thị D" ] && [ "$list_q" = "1:Nguyễn Thị Hoa" ] \
  && [ "$list_phone" = "1" ] && [ "$list_status" = "1:VD-900" ] \
  && [ "$list_page" = "2:2:4" ] && [ "$list_badstatus" = "400" ] \
  && [ -n "$RID5" ] && [ "$avail_before" = "false" ] && [ "$cancel" = "200" ] \
  && [ "$cancel2" = "422" ] && [ "$avail_after" = "true" ] && [ "$rebook" = "201" ] \
  && [ "$pickup3" = "200" ] && [ "$cancel_out" = "200" ] && [ "$cancel404" = "422" ] \
  && [ "$list_cancelled" = "2" ] \
  && [ "$pay_list" = "2:deposit_refund:2800000:late_fee:200000" ] \
  && [ "$pay_empty" = "0" ] && [ "$pay404" = "404" ] \
  && [ "$born_status" = "out" ] && [ "$born_pickup" = "422" ] && [ "$collect" = "200" ] \
  && [ "$cancel_money" = "422" ] && [ "$born_return" = "200" ] \
  && echo "SMOKE: ALL PASS" || { echo "SMOKE: FAIL"; exit 1; }
