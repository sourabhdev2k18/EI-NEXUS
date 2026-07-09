# EI-Nexus — Cloud Deployment Guide

Platform-agnostic by design: everything below deploys the *same* Docker
container, so whichever cloud your hackathon organizers end up granting
credits for, you don't need to change any code — just point the same image
at a different platform.

**Honest scope note:** these instructions are written and verified for
correctness against each platform's current CLI/console flow, but were not
executed against a live cloud account from this environment (no cloud
credentials or outbound network access available here). Treat the exact
commands as a very high-confidence starting point — validate the first
deploy yourself and tell me what error (if any) comes back, and I'll fix
it immediately.

---

## 0. Test the container locally first (do this before any cloud step)

```bash
docker compose up --build
# open http://localhost:8000 — should behave identically to `python run.py`
```

If you want Gemini enabled in the container:
```bash
cp .env.example .env
# edit .env, add your GEMINI_API_KEY
# then uncomment the env_file lines in docker-compose.yml and re-run
docker compose up --build
```

Confirm the health check passes:
```bash
docker ps   # STATUS column should say "healthy" after ~15s
```

---

## Important: the SQLite persistence caveat

EI-Nexus uses a local SQLite file (`data/ei_nexus.db`) for the audit trail
(resolved incidents, chat history). This is perfect for a single-instance
demo deployment (all 3 options below are single-instance by default) but
has a real limitation on serverless/ephemeral platforms:

- **Cloud Run / App Runner / Container Apps**, by default, can spin up a
  **new container instance per request** or **recycle instances**, and the
  local filesystem is **not** guaranteed to persist between instances.
- For a hackathon demo, this is usually fine — your traffic is low and
  instances typically stay warm during a demo session. But if you restart
  the service or scale to multiple instances, the audit trail can reset.

**Mitigations, cheapest to most robust:**
1. **Do nothing** — acceptable for a demo; the live in-memory state (what
   judges actually see on screen) is unaffected either way.
2. **Mount a persistent volume** — GCP Cloud Run and Azure Container Apps
   both support mounting a persistent volume/file share; commands below
   include this as an optional step.
3. **Migrate to a managed database** — Cloud SQL (GCP) / Azure SQL / Amazon
   RDS, all of which have a free tier. This is the "Stage 2/3" path
   documented in `docs/DESIGN_DOC.md` and is the right call once you're
   past demo day and into a real pilot.

---

## Option A — Google Cloud Run (recommended: generous free tier, simplest for a Flask container)

**Free tier:** 2 million requests/month, 360,000 GB-seconds of memory, no
credit card charge within those limits.

```bash
# 1. Install and authenticate the gcloud CLI (one-time)
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Enable required APIs (one-time)
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# 3. Build and deploy directly from source (Cloud Build handles the Docker build for you)
cd ei-nexus-rca
gcloud run deploy ei-nexus \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8000 \
  --set-env-vars GEMINI_API_KEY=your_key_here

# 4. Cloud Run prints a https://ei-nexus-xxxxx-uc.a.run.app URL — that's your judge-facing link
```

**Optional: persistent volume for the SQLite audit trail**
```bash
gcloud run deploy ei-nexus \
  --source . \
  --execution-environment gen2 \
  --add-volume name=data,type=cloud-storage,bucket=YOUR_BUCKET_NAME \
  --add-volume-mount volume=data,mount-path=/app/data \
  ... (other flags as above)
```

**Update the deployed env var later (e.g. new Gemini key) without redeploying:**
```bash
gcloud run services update ei-nexus --set-env-vars GEMINI_API_KEY=new_key_here
```

---

## Option B — Azure Container Apps (good if your organizers grant Azure credits)

**Free tier:** Azure Container Apps has a free monthly grant (180,000
vCPU-seconds, 360,000 GiB-seconds, 2 million requests) even without a paid
plan.

```bash
# 1. Install and log in (one-time)
az login
az account set --subscription "YOUR_SUBSCRIPTION_NAME"

# 2. Create a resource group and Container Apps environment (one-time)
az group create --name ei-nexus-rg --location eastus
az containerapp env create --name ei-nexus-env --resource-group ei-nexus-rg --location eastus

# 3. Deploy directly from source (Azure builds the image for you via ACR Tasks)
az containerapp up \
  --name ei-nexus \
  --resource-group ei-nexus-rg \
  --environment ei-nexus-env \
  --source . \
  --target-port 8000 \
  --ingress external \
  --env-vars GEMINI_API_KEY=your_key_here

# 4. Azure prints a https://ei-nexus.xxxxx.eastus.azurecontainerapps.io URL
```

**Alternative — Azure App Service (simpler UI, if you prefer the portal):**
1. Portal -> Create a resource -> Web App -> Docker Container
2. Point it at your container registry image (push with `az acr build` first)
3. Set `PORT=8000` and `GEMINI_API_KEY` under Configuration -> Application settings
4. Free tier: F1 plan (1 GB RAM, 60 CPU minutes/day — fine for a demo, not for 24/7 hosting)

---

## Option C — AWS App Runner (simplest AWS option for a single container)

**Free tier:** AWS doesn't give App Runner a dedicated always-free tier, but
new accounts get $100-200 in credits, and App Runner's pay-per-use pricing
is low enough that a demo period costs well under $5. (If your organizers
specifically grant AWS credits, this is the path.)

```bash
# 1. Install and configure the AWS CLI (one-time)
aws configure

# 2. Create an ECR repository and push the image
aws ecr create-repository --repository-name ei-nexus --region us-east-1
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker build -t ei-nexus .
docker tag ei-nexus:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ei-nexus:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ei-nexus:latest

# 3. Create the App Runner service (console is actually easier for this step —
#    Console -> App Runner -> Create service -> Container registry -> pick the ECR image above)
aws apprunner create-service \
  --service-name ei-nexus \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ei-nexus:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": {"GEMINI_API_KEY": "your_key_here"}
      }
    }
  }'

# 4. App Runner prints a https://xxxxx.us-east-1.awsapprunner.com URL
```

**Alternative — AWS Elastic Beanstalk** (also has a free-tier-eligible
t2.micro/t3.micro option) is a reasonable fallback if App Runner isn't
available in your account/region; the same Dockerfile works there too via
"Docker platform" application type.

---

## Which one to actually pick

| If... | Pick |
|---|---|
| You get to choose freely | **GCP Cloud Run** — best free tier, `gcloud run deploy --source .` is genuinely one command |
| Organizers grant Azure credits | Azure Container Apps (`az containerapp up` is similarly one-shot) |
| Organizers grant AWS credits | App Runner (a bit more setup — ECR push required first) |
| You just need *something* live in 5 minutes and don't care which | GCP Cloud Run |

## After you're live: update these files with the real URL

- `judge_one_pager.html` / `EI-Nexus-Judge-OnePager.pdf` — the QR code placeholder
- `booth_display.html` — could add the URL as a footer line
- `README.md` — add a "Live Demo" badge/link at the top

Tell me the URL once it's up and I'll wire it into all of these in one pass.
