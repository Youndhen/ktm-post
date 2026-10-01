#!/usr/bin/env bash
#
# One-time: create the CloudFront distribution in front of the ALB.
#
# This creates billable resources. Read the CloudFront section of DEPLOY.md.
#
# Required:
#   ALB_DNS       the load balancer's DNS name, e.g. ktm-post-123.ap-south-1.elb.amazonaws.com
#   ACM_CERT_ARN  an ACM certificate for SITE_DOMAIN issued in us-east-1
# Optional:
#   SITE_DOMAIN    default www.ktmpost.com
#   ORIGIN_VERIFY  shared secret sent to the ALB; generated and printed if unset
#
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_DOMAIN="${SITE_DOMAIN:-www.ktmpost.com}"
: "${ALB_DNS:?ALB_DNS is required}"
: "${ACM_CERT_ARN:?ACM_CERT_ARN (us-east-1) is required}"
ORIGIN_VERIFY="${ORIGIN_VERIFY:-$(openssl rand -hex 16)}"

# With --output text an empty result prints "None", not an empty string.
existing="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='ktm-post'].[Id,DomainName]" --output text)"
if [[ -n "$existing" && "$existing" != "None" ]]; then
  echo "A ktm-post distribution already exists: $existing"
  echo "Update it in the console or with 'aws cloudfront update-distribution'."
  exit 0
fi

ensure_cache_policy() {
  local file="$1" name id
  name="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["CachePolicyConfig"]["Name"])' "$file")"
  id="$(aws cloudfront list-cache-policies --type custom \
    --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='${name}'].CachePolicy.Id" --output text)"
  if [[ -z "$id" || "$id" == "None" ]]; then
    id="$(aws cloudfront create-cache-policy --cli-input-json "file://${file}" \
      --query 'CachePolicy.Id' --output text)"
    echo "==> created cache policy ${name} (${id})" >&2
  else
    echo "==> using cache policy ${name} (${id})" >&2
  fi
  echo "$id"
}

PAGES_CACHE_POLICY_ID="$(ensure_cache_policy infra/cloudfront/cache-policy-pages.json)"
IMAGES_CACHE_POLICY_ID="$(ensure_cache_policy infra/cloudfront/cache-policy-images.json)"
CALLER_REFERENCE="ktm-post-$(date +%s)"

RENDERED="$(mktemp "${TMPDIR:-/tmp}/ktm-post-cloudfront.XXXXXX")"
trap 'rm -f "$RENDERED"' EXIT
CALLER_REFERENCE="$CALLER_REFERENCE" SITE_DOMAIN="$SITE_DOMAIN" ALB_DNS="$ALB_DNS" \
ORIGIN_VERIFY="$ORIGIN_VERIFY" PAGES_CACHE_POLICY_ID="$PAGES_CACHE_POLICY_ID" \
IMAGES_CACHE_POLICY_ID="$IMAGES_CACHE_POLICY_ID" ACM_CERT_ARN="$ACM_CERT_ARN" \
python3 - infra/cloudfront/distribution.json "$RENDERED" <<'PY'
import json, os, sys
src, dst = sys.argv[1], sys.argv[2]
raw = open(src).read()
for key in ("CALLER_REFERENCE","SITE_DOMAIN","ALB_DNS","ORIGIN_VERIFY",
            "PAGES_CACHE_POLICY_ID","IMAGES_CACHE_POLICY_ID","ACM_CERT_ARN"):
    raw = raw.replace("${%s}" % key, os.environ[key])
if "${" in raw:
    sys.exit("unsubstituted placeholder remains in distribution config")
json.loads(raw)
open(dst, "w").write(raw)
PY

echo "==> creating distribution"
aws cloudfront create-distribution --distribution-config "file://${RENDERED}" \
  --query 'Distribution.[Id,DomainName]' --output text

cat <<EOF

Next steps (see DEPLOY.md, "CloudFront"):
  1. Add an ALB listener rule that returns 403 unless the request carries
       X-Origin-Verify: ${ORIGIN_VERIFY}
     Keep this value somewhere safe; it is not stored anywhere else.
  2. Point the ${SITE_DOMAIN} DNS record (CNAME or alias) at the distribution
     domain printed above instead of the ALB.
  3. Wait for the distribution status to become Deployed (10-15 minutes).
EOF
