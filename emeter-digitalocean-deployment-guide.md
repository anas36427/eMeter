# Deploying eMeter on DigitalOcean — Step by Step

Covers: `energy-hub-ui` (React/Vite frontend), `electricity_system` (Django backend), and Managed PostgreSQL, using App Platform for a low-maintenance production setup.

---

## 0. Before you start

- [ ] Push `eMeter.web` to GitHub (App Platform deploys from a Git repo — GitHub, GitLab, or Bitbucket)
- [ ] Make sure `.gitignore` excludes `db.sqlite3`, `.env`, `node_modules/`, and `venv/`
- [ ] Create a DigitalOcean account and claim the $200/60-day new-account credit
- [ ] Have your domain name ready (optional at this stage, can add later)

---

## 1. Create the Postgres database first

*(You already have the detailed version of this from earlier — summary here for the full flow)*

1. Dashboard → **Create → Databases → PostgreSQL**
2. Basic plan, 1 GB RAM (~$15/mo) is enough to start
3. Pick a region — **pick this same region for everything else below**
4. Name it `emeter-production-db`, create it
5. Once ready, copy the **private connection string** — you'll need it in step 4

---

## 2. Deploy the Django backend on App Platform

1. Dashboard → **Create → Apps**
2. Connect your GitHub account, select the `eMeter.web` repo, branch `main`
3. When it scans the repo, point the **source directory** to `electricity_system/`
4. App Platform auto-detects Python/Django. Set:
   - **Build command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - **Run command**: `gunicorn electricity_system.wsgi --bind 0.0.0.0:8080`
5. Choose the **Basic** plan, smallest instance size (~$5–12/mo depending on RAM you pick)
6. **Add environment variables** (App-Level → Environment Variables):
   ```
   DATABASE_URL=<the private connection string from step 1>
   DJANGO_SECRET_KEY=<generate a new one, don't reuse dev key>
   DEBUG=False
   ALLOWED_HOSTS=<your-app>.ondigitalocean.app
   ```
7. Under **Networking**, make sure this app and the database are in the **same VPC** so they talk over the private network
8. Deploy. First deploy takes a few minutes.
9. Once live, open the **Console** tab (or use `doctl` / SSH into a one-off job) and run:
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

---

## 3. Deploy the React frontend on App Platform

You can add this as a **second component in the same App Platform app**, or as its own app — either works. Same app is simpler to manage as one unit.

1. In the same App Platform app → **Create Component → Static Site**
2. Source directory: `energy-hub-ui/`
3. Build command: `npm install && npm run build`
4. Output directory: `dist` (Vite's default build output folder)
5. Environment variable:
   ```
   VITE_API_URL=https://<your-backend-app>.ondigitalocean.app
   ```
6. Deploy — static sites are free on App Platform

---

## 4. Point the frontend at the backend (CORS)

In `electricity_system/settings.py`, make sure your deployed frontend URL is allowed:

```python
CORS_ALLOWED_ORIGINS = [
    "https://<your-frontend-app>.ondigitalocean.app",
]
```

Redeploy the backend after this change.

---

## 5. (Optional but recommended) Add Spaces for file storage

For `pdf_generator.py` output and the `eMeter_Offline_Sync.json` export — don't store these on App Platform's ephemeral filesystem, since it resets on every deploy.

1. Dashboard → **Create → Spaces Object Storage** (~$5/mo, 250 GiB)
2. Generate an API key: **API → Spaces Keys**
3. Install `django-storages[boto3]` and point Django's `DEFAULT_FILE_STORAGE` at the Space, using the access key/secret as env vars

---

## 6. Custom domain + SSL

1. In App Platform → your app → **Settings → Domains**
2. Add your domain (e.g. `emeter.amu.ac.in` or whatever the university assigns)
3. Update your DNS provider's records to point to DigitalOcean (they'll show you the exact CNAME/A record)
4. SSL certificates are issued and renewed automatically — no manual cert management

---

## 7. Set up auto-deploy

By default, App Platform redeploys automatically on every push to your connected branch. For a university production system, it's safer to:
1. Use a `staging` branch for testing changes
2. Only auto-deploy from `main`/`production`
3. Test on staging, then merge to trigger the real deploy

(Configurable under **Settings → App Spec** or per-component "Autodeploy" toggle.)

---

## 8. Confirm backups and monitoring

- **Database backups**: Cluster → **Settings → Backups** — confirm daily backups + point-in-time recovery are active (on by default)
- **App metrics**: App Platform → your app → **Insights** tab shows CPU, memory, request rate — set up alerts here (Settings → Alerts) for things like high CPU or app crashes, so your IT office gets notified before users complain

---

## 9. Final checklist before handing to the university's IT office

- [ ] `DEBUG=False` confirmed in production env vars
- [ ] `DJANGO_SECRET_KEY` is a fresh production key, not the dev one
- [ ] Database backups verified (do a test restore once, don't just trust the toggle)
- [ ] Custom domain + SSL working
- [ ] IT office has been given DigitalOcean account access (as a team member, not full owner, if you want to retain control while they operate it)
- [ ] Document the env vars somewhere they can find later (a password manager or internal wiki, not a plaintext file in the repo)

---

## Rough monthly cost recap

| Component | Cost |
|---|---|
| Backend (App Platform) | $5–12 |
| Frontend (App Platform static) | Free |
| Postgres (Managed DB) | $15 |
| Spaces (file storage) | $5 |
| **Total** | **~$25–32/month** |
