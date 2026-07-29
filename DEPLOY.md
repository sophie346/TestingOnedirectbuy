# Deploy OneDirectBuy flow control (UI + backend)

| Role | URL |
|------|-----|
| **UI** | https://onetest.onechanneladmin.com |
| **Backend / API** | https://dev-onetest.onechanneladmin.com |

Both hosts hit the same GKE Deployment (`onetest`) — Express serves UI + `/api` + `/health`.

Image: `gcr.io/gentle-epoch-277301/onetest:latest`  
Cluster service: `onetest` (NEG on port 80 → container 8080)

## CI/CD (Cloud Build)

Same pattern as `commonblog-ui-prod` / `onechanneladmin-ui-web-*`:

| Trigger | Branch | Config |
|---------|--------|--------|
| `onetest-prod` | `cicd-prod` | `cloudbuild.yaml` |
| `onetest-dev` | `cicd-dev` | `cloudbuild.yaml` |

Push to either branch → build `gcr.io/gentle-epoch-277301/onetest` → `kubectl rollout restart deployment/onetest`.

## 1. Build image (manual)

```bash
cd D:\TestingOnedirectbuy
gcloud builds submit --config=cloudbuild.yaml --project=gentle-epoch-277301 .
```

## 2. Create / update secret

```bash
kubectl create secret generic onetest-env \
  --from-literal=MONGODB_URI='mongodb+srv://USER:PASS@cluster.mongodb.net/' \
  --from-literal=MONGODB_DB='onedirectbuy-tests' \
  --from-literal=API_TOKEN='your-shared-token' \
  --from-literal=PUBLIC_UI_URL='https://onetest.onechanneladmin.com' \
  --from-literal=PUBLIC_API_URL='https://dev-onetest.onechanneladmin.com' \
  --from-literal=ONEDIRECTBUY_BASE_URL='https://onedirectbuy.com' \
  --from-literal=ONEDIRECTBUY_BUYER_EMAIL='...' \
  --from-literal=ONEDIRECTBUY_BUYER_PASSWORD='...' \
  --from-literal=ONEDIRECTBUY_ADMIN_EMAIL='...' \
  --from-literal=ONEDIRECTBUY_ADMIN_PASSWORD='...' \
  --from-literal=ONEDIRECTBUY_SELLER_EMAIL='...' \
  --from-literal=ONEDIRECTBUY_SELLER_PASSWORD='...' \
  --dry-run=client -o yaml | kubectl apply -f -
```

In-pod Playwright still uses `STATUS_API_URL=http://127.0.0.1:8080` (set in the Deployment). External clients / docs use **`https://dev-onetest.onechanneladmin.com`**.

## 3. Apply Kubernetes Deployment

```bash
kubectl apply -f D:\onechanneladmin-latest\deploymentsAll\ui\deployment-onetest.yaml
kubectl rollout status deployment/onetest
```

## 4. Wire load balancer (after NEG exists)

```bash
gcloud compute network-endpoint-groups list \
  --project=gentle-epoch-277301 \
  --filter="name~onetest" \
  --format="table(name,zone)"
```

Put that `neg_id` into `infra/loadbalancer/terraform.tfvars` under `onetest`, then:

```bash
cd D:\onechanneladmin-latest\infra\loadbalancer
terraform plan
terraform apply
```

`lb-routing.yaml` routes both hosts → `gke-onetest`.  
SSL is covered by the existing `*.onechanneladmin.com` Cloudflare Origin CA wildcard.

## 5. DNS (Cloudflare zone `onechanneladmin.com`)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | onetest | `136.110.171.72` | Proxied or DNS-only |
| A | dev-onetest | `136.110.171.72` | Proxied or DNS-only |

Confirm LB IP:

```bash
gcloud compute addresses describe manual-vm-ip --global --project=gentle-epoch-277301 --format="value(address)"
```

## 6. Verify

```bash
curl -sS https://onetest.onechanneladmin.com/health
curl -sS https://dev-onetest.onechanneladmin.com/health
curl -sS https://dev-onetest.onechanneladmin.com/api/flows
# {"ok":true,"service":"onedirectbuy-flow-control"} on /health
```

Open https://onetest.onechanneladmin.com/ for the Flow Control UI.  
API base: https://dev-onetest.onechanneladmin.com/api/
