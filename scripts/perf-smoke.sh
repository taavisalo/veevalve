#!/usr/bin/env bash

set -euo pipefail

WEB_URL="${WEB_URL:-http://localhost:3000}"
API_URL="${API_URL:-http://localhost:3001}"

WEB_WARM_HITS="${WEB_WARM_HITS:-15}"
API_LIST_HITS="${API_LIST_HITS:-30}"
API_SEARCH_HITS="${API_SEARCH_HITS:-20}"
API_BY_IDS_HITS="${API_BY_IDS_HITS:-30}"
API_METRICS_HITS="${API_METRICS_HITS:-20}"

BUDGET_WEB_FIRST_TTFB_MS="${BUDGET_WEB_FIRST_TTFB_MS:-250}"
BUDGET_WEB_WARM_TTFB_MS="${BUDGET_WEB_WARM_TTFB_MS:-120}"
BUDGET_API_LIST_TTFB_MS="${BUDGET_API_LIST_TTFB_MS:-120}"
BUDGET_API_SEARCH_TTFB_MS="${BUDGET_API_SEARCH_TTFB_MS:-250}"
BUDGET_API_BY_IDS_TTFB_MS="${BUDGET_API_BY_IDS_TTFB_MS:-80}"
BUDGET_API_METRICS_TTFB_MS="${BUDGET_API_METRICS_TTFB_MS:-120}"

to_ms() {
  awk -v seconds="$1" 'BEGIN { printf "%.1f", seconds * 1000 }'
}

measure_once_ttfb_seconds() {
  local url="$1"
  curl -fsS -o /dev/null -w '%{time_starttransfer}' "$url"
}

measure_avg_ttfb_seconds() {
  local url="$1"
  local hits="$2"

  local total=0
  local value=0
  for _ in $(seq 1 "$hits"); do
    value="$(curl -fsS -o /dev/null -w '%{time_starttransfer}' "$url")"
    total="$(awk -v sum="$total" -v current="$value" 'BEGIN { printf "%.6f", sum + current }')"
  done

  awk -v sum="$total" -v count="$hits" 'BEGIN { printf "%.6f", sum / count }'
}

assert_budget() {
  local label="$1"
  local value_ms="$2"
  local budget_ms="$3"

  if awk -v value="$value_ms" -v budget="$budget_ms" 'BEGIN { exit(value <= budget ? 0 : 1) }'; then
    echo "PASS ${label}: ${value_ms}ms <= ${budget_ms}ms"
    return 0
  fi

  echo "FAIL ${label}: ${value_ms}ms > ${budget_ms}ms"
  return 1
}

echo "Performance smoke check"
echo "WEB_URL=${WEB_URL}"
echo "API_URL=${API_URL}"
echo

API_SAMPLE_HEADERS="$(curl -fsS -D - -o /dev/null "${API_URL}/places?locale=et&limit=1&sort=LATEST&includeBadDetails=false")"
if printf '%s' "$API_SAMPLE_HEADERS" | grep -qi '^server-timing:'; then
  echo "Server-Timing header present on /places"
else
  echo "WARN Server-Timing header missing on /places"
fi

FIRST_ID="$(
  curl -fsS "${API_URL}/places?locale=et&limit=1&sort=LATEST&includeBadDetails=false" \
    | node -e "let raw='';process.stdin.on('data',(chunk)=>raw+=chunk);process.stdin.on('end',()=>{const parsed=JSON.parse(raw);const id=Array.isArray(parsed)&&parsed[0]&&parsed[0].id; if(!id){process.exit(2);} process.stdout.write(String(id));});"
)"

WEB_FIRST_TTFB_S="$(measure_once_ttfb_seconds "${WEB_URL}/")"
WEB_WARM_TTFB_S="$(measure_avg_ttfb_seconds "${WEB_URL}/" "${WEB_WARM_HITS}")"

API_LIST_TTFB_S="$(
  measure_avg_ttfb_seconds \
    "${API_URL}/places?locale=et&limit=10&sort=LATEST&includeBadDetails=false" \
    "${API_LIST_HITS}"
)"
API_SEARCH_TTFB_S="$(
  measure_avg_ttfb_seconds \
    "${API_URL}/places?locale=et&limit=20&sort=LATEST&search=tallinn&includeBadDetails=false" \
    "${API_SEARCH_HITS}"
)"
API_BY_IDS_TTFB_S="$(
  measure_avg_ttfb_seconds \
    "${API_URL}/places/by-ids?locale=et&ids=${FIRST_ID}&includeBadDetails=false" \
    "${API_BY_IDS_HITS}"
)"
API_METRICS_TTFB_S="$(
  measure_avg_ttfb_seconds \
    "${API_URL}/places/metrics" \
    "${API_METRICS_HITS}"
)"

WEB_FIRST_TTFB_MS="$(to_ms "${WEB_FIRST_TTFB_S}")"
WEB_WARM_TTFB_MS="$(to_ms "${WEB_WARM_TTFB_S}")"
API_LIST_TTFB_MS="$(to_ms "${API_LIST_TTFB_S}")"
API_SEARCH_TTFB_MS="$(to_ms "${API_SEARCH_TTFB_S}")"
API_BY_IDS_TTFB_MS="$(to_ms "${API_BY_IDS_TTFB_S}")"
API_METRICS_TTFB_MS="$(to_ms "${API_METRICS_TTFB_S}")"

echo
echo "Measured TTFB (ms)"
echo "web_first=${WEB_FIRST_TTFB_MS}"
echo "web_warm_avg=${WEB_WARM_TTFB_MS}"
echo "api_list_avg=${API_LIST_TTFB_MS}"
echo "api_search_avg=${API_SEARCH_TTFB_MS}"
echo "api_by_ids_avg=${API_BY_IDS_TTFB_MS}"
echo "api_metrics_avg=${API_METRICS_TTFB_MS}"
echo

failures=0

assert_budget "web_first_ttfb" "${WEB_FIRST_TTFB_MS}" "${BUDGET_WEB_FIRST_TTFB_MS}" || failures=$((failures + 1))
assert_budget "web_warm_avg_ttfb" "${WEB_WARM_TTFB_MS}" "${BUDGET_WEB_WARM_TTFB_MS}" || failures=$((failures + 1))
assert_budget "api_list_avg_ttfb" "${API_LIST_TTFB_MS}" "${BUDGET_API_LIST_TTFB_MS}" || failures=$((failures + 1))
assert_budget "api_search_avg_ttfb" "${API_SEARCH_TTFB_MS}" "${BUDGET_API_SEARCH_TTFB_MS}" || failures=$((failures + 1))
assert_budget "api_by_ids_avg_ttfb" "${API_BY_IDS_TTFB_MS}" "${BUDGET_API_BY_IDS_TTFB_MS}" || failures=$((failures + 1))
assert_budget "api_metrics_avg_ttfb" "${API_METRICS_TTFB_MS}" "${BUDGET_API_METRICS_TTFB_MS}" || failures=$((failures + 1))

echo
if [[ "${failures}" -gt 0 ]]; then
  echo "Performance smoke check failed (${failures} budget breaches)."
  exit 1
fi

echo "Performance smoke check passed."
