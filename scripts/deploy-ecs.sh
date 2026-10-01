#!/usr/bin/env bash
#
# Build, push and deploy ktm-post to ECS Fargate.
#
# This script makes real changes to your AWS account and can incur cost.
# Read DEPLOY.md before running it the first time.
#
# Usage:
#   SECRET_ARN=arn:aws:secretsmanager:...:secret:ktm-post/app-AbCdEf ./scripts/deploy-ecs.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

AWS_REGION="${AWS_REGION:-ap-south-1}"
ECR_REPO="${ECR_REPO:-ktm-post}"
CLUSTER="${CLUSTER:-ktm-post}"
SERVICE="${SERVICE:-ktm-post}"
SITE_URL="${SITE_URL:-https://www.ktmpost.com}"
TARGET_ARCH="${TARGET_ARCH:-arm64}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"

case "$TARGET_ARCH" in
  arm64) PLATFORM=linux/arm64; CPU_ARCHITECTURE=ARM64 ;;
  amd64) PLATFORM=linux/amd64; CPU_ARCHITECTURE=X86_64 ;;
  *) echo "TARGET_ARCH must be arm64 or amd64, got '$TARGET_ARCH'" >&2; exit 1 ;;
esac

: "${SECRET_ARN:?SECRET_ARN is required - the Secrets Manager secret holding DATABASE_URL, BETTER_AUTH_SECRET and the CLOUDINARY_* values}"

# DATABASE_URL is needed at BUILD time: "/" and "/news" are statically
# generated from the database. Fall back to the local .env if not exported.
if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')"
fi
: "${DATABASE_URL:?DATABASE_URL is required at build time}"

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_URI="${REGISTRY}/${ECR_REPO}:${IMAGE_TAG}"

echo "==> account ${AWS_ACCOUNT_ID} | region ${AWS_REGION} | ${PLATFORM}"
echo "==> image ${IMAGE_URI}"

echo "==> ensuring ECR repository exists"
aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$ECR_REPO" --region "$AWS_REGION" \
       --image-scanning-configuration scanOnPush=true >/dev/null

echo "==> logging in to ECR"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "==> building for ${PLATFORM} and pushing"
docker buildx build \
  --platform "$PLATFORM" \
  --build-arg DATABASE_URL="$DATABASE_URL" \
  --build-arg NEXT_PUBLIC_SITE_URL="$SITE_URL" \
  --tag "$IMAGE_URI" \
  --push \
  .

echo "==> rendering task definition"
RENDERED="$(mktemp -t ktm-post-taskdef)"
AWS_ACCOUNT_ID="$AWS_ACCOUNT_ID" AWS_REGION="$AWS_REGION" IMAGE_URI="$IMAGE_URI" \
SITE_URL="$SITE_URL" SECRET_ARN="$SECRET_ARN" CPU_ARCHITECTURE="$CPU_ARCHITECTURE" \
python3 - infra/ecs/task-definition.json "$RENDERED" <<'PY'
import json, os, sys
src, dst = sys.argv[1], sys.argv[2]
raw = open(src).read()
for key in ("AWS_ACCOUNT_ID","AWS_REGION","IMAGE_URI","SITE_URL","SECRET_ARN","CPU_ARCHITECTURE"):
    raw = raw.replace("${%s}" % key, os.environ[key])
if "${" in raw:
    sys.exit("unsubstituted placeholder remains in task definition")
json.loads(raw)  # fail loudly on malformed JSON before hitting the API
open(dst, "w").write(raw)
PY

echo "==> registering task definition"
TASK_DEF_ARN="$(aws ecs register-task-definition \
  --cli-input-json "file://${RENDERED}" \
  --region "$AWS_REGION" \
  --query 'taskDefinition.taskDefinitionArn' --output text)"
rm -f "$RENDERED"
echo "    $TASK_DEF_ARN"

if aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --region "$AWS_REGION" \
     --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "==> updating service ${SERVICE}"
  aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" \
    --task-definition "$TASK_DEF_ARN" --region "$AWS_REGION" >/dev/null
  echo "==> waiting for the deployment to stabilise"
  aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE" --region "$AWS_REGION"
  echo "==> done"
else
  echo
  echo "Service '${SERVICE}' does not exist yet on cluster '${CLUSTER}'."
  echo "Task definition ${TASK_DEF_ARN} is registered and ready."
  echo "Create the service once (see DEPLOY.md), then re-run this script to deploy."
fi
