#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sinch Conversation API — mock webhook test script
#
# Tests every SMS analytics state that Kesher handles:
#   1. QUEUED_ON_CHANNEL   — message accepted by carrier, awaiting delivery
#   2. DELIVERED           — carrier confirmed delivery to handset
#   3. FAILED              — delivery failed (carrier rejection)
#   4. INBOUND_MESSAGE     — recipient replied to a message
#   5. MESSAGE_SUBMIT_RESPONSE — Sinch accepted the message (no DB update)
#
# Usage:
#   1. Start the dev server: npm run dev
#   2. Set PROVIDER_ID to a real provider_id from your message_recipients table
#      (or any UUID — the DB update will just affect 0 rows, which is safe)
#   3. Set RECIPIENT_PHONE to a real contact_value from message_recipients
#      (or any E.164 number for the inbound test)
#   4. Run: bash scripts/test-sinch-webhooks.sh
#
# All payloads match the exact shape Sinch sends.
# If SINCH_WEBHOOK_SECRET is set in .env.local, set the SECRET var below too.
# ─────────────────────────────────────────────────────────────────────────────

BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINT="$BASE_URL/api/webhooks/sinch"
SECRET="${SINCH_WEBHOOK_SECRET:-}"            # leave empty to skip auth header
PROVIDER_ID="${PROVIDER_ID:-test-sinch-msg-001}"
RECIPIENT_PHONE="${RECIPIENT_PHONE:-+12125551234}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Build auth header argument
if [ -n "$SECRET" ]; then
  AUTH_HEADER=(-H "x-sinch-webhook-secret: $SECRET")
else
  AUTH_HEADER=()
  echo "⚠  SINCH_WEBHOOK_SECRET is empty — running without auth header"
fi

echo ""
echo "Testing Sinch webhooks at: $ENDPOINT"
echo "Provider ID:   $PROVIDER_ID"
echo "Recipient:     $RECIPIENT_PHONE"
echo "Timestamp:     $NOW"
echo ""

# ── Helper ────────────────────────────────────────────────────────────────────

post() {
  local label="$1"
  local payload="$2"
  echo "▶ $label"
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -d "$payload")
  body=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)
  echo "  Status: $status"
  echo "  Body:   $body"
  echo ""
}

# ── 1. QUEUED_ON_CHANNEL ──────────────────────────────────────────────────────
post "1. QUEUED_ON_CHANNEL (carrier accepted, not yet delivered)" \
'{
  "app_id": "test-app-id",
  "project_id": "test-project-id",
  "event_time": "'"$NOW"'",
  "message_delivery_report": {
    "message_id": "'"$PROVIDER_ID"'",
    "status": "QUEUED_ON_CHANNEL",
    "channel_identity": {
      "channel": "SMS",
      "identity": "'"$RECIPIENT_PHONE"'"
    }
  }
}'

# ── 2. DELIVERED ──────────────────────────────────────────────────────────────
post "2. DELIVERED (carrier confirmed handset delivery)" \
'{
  "app_id": "test-app-id",
  "project_id": "test-project-id",
  "event_time": "'"$NOW"'",
  "message_delivery_report": {
    "message_id": "'"$PROVIDER_ID"'",
    "status": "DELIVERED",
    "channel_identity": {
      "channel": "SMS",
      "identity": "'"$RECIPIENT_PHONE"'"
    },
    "reason": null
  }
}'

# ── 3. FAILED (carrier rejection) ────────────────────────────────────────────
post "3. FAILED (unregistered number / carrier rejection)" \
'{
  "app_id": "test-app-id",
  "project_id": "test-project-id",
  "event_time": "'"$NOW"'",
  "message_delivery_report": {
    "message_id": "'"$PROVIDER_ID"'-fail",
    "status": "FAILED",
    "channel_identity": {
      "channel": "SMS",
      "identity": "'"$RECIPIENT_PHONE"'"
    },
    "reason": {
      "code": "UNREGISTERED_NUMBER",
      "description": "Destination number is not registered or reachable",
      "sub_code": "UNREGISTERED"
    }
  }
}'

# ── 4. INBOUND_MESSAGE (recipient reply) ──────────────────────────────────────
post "4. INBOUND_MESSAGE (recipient replied)" \
'{
  "app_id": "test-app-id",
  "project_id": "test-project-id",
  "event_time": "'"$NOW"'",
  "message": {
    "id": "inbound-test-'"$(date +%s)"'",
    "direction": "TO_APP",
    "channel_identity": {
      "channel": "SMS",
      "identity": "'"$RECIPIENT_PHONE"'"
    },
    "contact_message": {
      "text_message": {
        "text": "Thanks for the reminder!"
      }
    },
    "accept_time": "'"$NOW"'"
  }
}'

# ── 5. MESSAGE_SUBMIT_RESPONSE (Sinch accepted the message) ──────────────────
post "5. MESSAGE_SUBMIT_RESPONSE (acknowledged, no DB change expected)" \
'{
  "app_id": "test-app-id",
  "project_id": "test-project-id",
  "accepted_time": "'"$NOW"'",
  "message_submit_response": {
    "message_id": "'"$PROVIDER_ID"'"
  }
}'

# ── 6. Unknown event type (should return 200 and not crash) ──────────────────
post "6. Unknown event (graceful passthrough)" \
'{
  "app_id": "test-app-id",
  "project_id": "test-project-id",
  "event_time": "'"$NOW"'",
  "some_future_event_type": {
    "data": "should be ignored gracefully"
  }
}'

# ── 7. Missing message_id guard ───────────────────────────────────────────────
post "7. DELIVERED with missing message_id (should skip safely)" \
'{
  "app_id": "test-app-id",
  "project_id": "test-project-id",
  "event_time": "'"$NOW"'",
  "message_delivery_report": {
    "status": "DELIVERED",
    "channel_identity": {
      "channel": "SMS",
      "identity": "'"$RECIPIENT_PHONE"'"
    }
  }
}'

# ── 8. Duplicate DELIVERED (idempotency check) ────────────────────────────────
post "8. Duplicate DELIVERED (same message_id twice — idempotent)" \
'{
  "app_id": "test-app-id",
  "project_id": "test-project-id",
  "event_time": "'"$NOW"'",
  "message_delivery_report": {
    "message_id": "'"$PROVIDER_ID"'",
    "status": "DELIVERED",
    "channel_identity": {
      "channel": "SMS",
      "identity": "'"$RECIPIENT_PHONE"'"
    }
  }
}'

echo "✓ All tests complete."
echo ""
echo "Check the dev server logs for [sinch-webhook] lines."
echo "Then check Supabase → message_recipients to verify DB state:"
echo "  - Test 2 should set delivered_at and status='delivered' on provider_id=$PROVIDER_ID"
echo "  - Test 3 should set status='failed' and bounce_type='UNREGISTERED_NUMBER' on provider_id=${PROVIDER_ID}-fail"
echo "  - Test 4 should set replied_at on the most recent recipient matching $RECIPIENT_PHONE"
echo "    and insert a row into inbound_messages"
echo "  - Test 8 (duplicate delivered) should NOT create a second delivered_at timestamp"
