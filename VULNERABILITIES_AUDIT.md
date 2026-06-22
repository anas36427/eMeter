# 🛡️ eMeter AMU — Security Vulnerabilities & Code Audit Report

This report presents a security audit of the **eMeter AMU** Electricity Billing Management System. The codebase has been scanned line-by-line across the backend (Django), frontend (React + Vite), and mobile client (React Native + Expo). 

Below is the compiled register of security vulnerabilities identified, categorized by severity, along with technical evidence and concrete remediation recommendations.

---

## 🛑 Critical Severity Vulnerabilities

### 1. Insecure Direct Object Reference (IDOR) & Broken Object Level Authorization (BOLA) in Bill PDF Generation
* **Location:** [views.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/billing/views.py#L1795-L1798) (`api_get_bill_pdf`)
* **Impact:** Any authenticated user can download the detailed PDF bill of *any* consumer by changing the `bill_id` parameter. This leaks highly sensitive Personally Identifiable Information (PII) including full names, physical home/campus addresses, phone numbers, exact utility usage patterns, and transaction amounts.
* **Evidence:**
  ```python
  @api_view(['GET'])
  @require_authenticated
  def api_get_bill_pdf(request, bill_id):
      """API endpoint to download branded PDF bill"""
      bill = get_object_or_404(Bill, id=bill_id) # ❌ No check if request.user owns the bill or is an admin!
  ```
* **Remediation:** Enforce permission checks within the view. Restrict access to the owner of the bill or administrators:
  ```python
  from django.core.exceptions import PermissionDenied

  bill = get_object_or_404(Bill, id=bill_id)
  if not (request.user.role == 'admin' or (bill.consumer and bill.consumer.user == request.user)):
      return JsonResponse({'detail': 'You do not have permission to access this bill.'}, status=403)
  ```

---

### 2. Privilege Escalation & Unauthorized Consumer Registration
* **Location:** [views.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/billing/views.py#L786-L788) (`api_consumer_list`)
* **Impact:** The endpoint accepts `GET` (for listing consumers) and `POST` (for creating consumers) but only enforces general authentication. A malicious consumer could register false consumers, write arbitrary data into the DB, and spoof active load/meter configurations.
* **Evidence:**
  ```python
  @api_view(['GET', 'POST'])
  @require_authenticated
  def api_consumer_list(request):
      if request.method == 'GET':
          consumers = Consumer.objects.all() # ❌ Leaks all consumers' details to standard users
          ...
      if request.method == 'POST':
          # ❌ Creates a new consumer with no admin/meter-reader role validation!
          consumer = Consumer.objects.create(...) 
  ```
* **Remediation:** Apply strict role checks using the custom `@require_role` decorator:
  - Separate `GET` and `POST` actions into separate endpoints, or split logical blocks with role validations.
  - Or wrap the list and registration logic under:
    ```python
    @api_view(['GET', 'POST'])
    @require_role('admin', 'meter_reader') # 🔐 Require operator privileges
    def api_consumer_list(request):
    ```

---

### 3. SSRF and Local File Inclusion (LFI) via PDF HTML Rendering
* **Location:** [pdf_generator.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/billing/pdf_generator.py#L9-L37) (`link_callback`)
* **Impact:** The `xhtml2pdf` library parses local paths on the server when rendering HTML. In `link_callback`, any path not starting with `http` is processed. If an attacker updates their address or name to include directory traversal tags (e.g. `<img src="../../../../etc/passwd">`), the callback resolves this path relative to the base directory and embeds the server's private system files inside the generated PDF document.
* **Evidence:**
  ```python
  if not uri.startswith('http://') and not uri.startswith('https://'):
      # Try finding in the Django project base directory
      path = os.path.join(settings.BASE_DIR, uri.lstrip('/')) # ❌ Traversal (../) is not blocked by lstrip('/')
      if os.path.exists(path):
          return path
  ```
* **Remediation:** 
  1. Validate that the resolved absolute path resides strictly within the static or media directories (`settings.STATIC_ROOT` or `settings.MEDIA_ROOT`).
  2. Block any directory traversal patterns (`../`) or resolve path using `os.path.abspath` and verify the prefix.
  ```python
  from django.utils.path import safe_join

  # Use Django's built-in safe_join to prevent directory traversal
  try:
      resolved_path = safe_join(settings.STATIC_ROOT, uri)
  except ValueError:
      return None
  ```

---

## ⚠️ High Severity Vulnerabilities

### 4. [RESOLVED] Broken Authorization on Consumer Readings and Metadata Access
* **Location:** [views.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/billing/views.py#L1074-L1076) (`api_consumer_readings`), [views.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/billing/views.py#L1095-L1098) (`api_consumer_search`), [views.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/billing/views.py#L743-L746) (`api_get_consumer`)
* **Impact:** Any logged-in user can query arbitrary consumer profiles, fetch historical meter logs, and search consumer records by ID/meter number. Standard clients should only be able to view their own reading records.
* **Evidence:**
  ```python
  @api_view(['GET'])
  @require_authenticated
  def api_consumer_readings(request, consumer_id):
      readings = MeterReading.objects.filter(consumer_id=consumer_id) # ❌ No ownership check
  ```
* **Remediation:** Enforce ownership checks. Verify that the consumer profile corresponds to the requesting user, or that the requester is a staff/operator:
  ```python
  if request.user.role not in ['admin', 'meter_reader']:
      try:
          user_consumer = request.user.consumer_profile
          if user_consumer.id != consumer_id:
              return JsonResponse({'detail': 'Access denied.'}, status=403)
      except Consumer.DoesNotExist:
          return JsonResponse({'detail': 'Access denied.'}, status=403)
  ```

---

### 5. Plaintext Token Storage in React Native AsyncStorage
* **Location:** [api.js](file:///Users/anasahmad/Documents/eMeter.web/eMeterApp/src/services/api.js#L78-L97)
* **Impact:** The mobile app stores the Django REST Framework authentication token (`authToken`), CSRF token, and user session identifiers in React Native's standard `AsyncStorage`. `AsyncStorage` is an unencrypted text storage utility on mobile filesystems. An attacker with physical access to the device or local backups can dump the app sandboxed databases, hijack the credentials, and log into the server.
* **Evidence:**
  ```javascript
  if (response.data.token) {
      const authToken = response.data.token;
      await AsyncStorage.setItem('authToken', authToken); // ❌ Unencrypted storage of secrets!
  }
  ```
* **Remediation:** Replace `AsyncStorage` for sensitive keys (`authToken`) with secure keychain storage, such as **`expo-secure-store`** or **`react-native-keychain`**.

---

### 6. Dynamic CSRF/CORS Over-Permissive Wildcard Trust
* **Location:** [settings.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/electricity_system/settings.py#L261-L267)
* **Impact:** The system configures CORS regexes and CSRF trusted origins to dynamically allow any subdomain under `loca.lt` (Localtunnel). Since anyone can allocate an arbitrary domain on the public `loca.lt` network, an attacker can launch a malicious page on a localtunnel address, trick a logged-in user into visiting it, and exploit this wildcard trust to execute commands or steal CSRF session contexts.
* **Evidence:**
  ```python
  CORS_ALLOWED_ORIGIN_REGEXES = [
      r"^https://.*\.loca\.lt$", # ❌ Trusting all subdomains of a public tunnel service
      ...
  ]
  CSRF_TRUSTED_ORIGINS.append("https://*.loca.lt") # ❌ Trusting wildcard subdomains
  ```
* **Remediation:** In production, disable Localtunnel wildcard origins entirely. Require explicit environment variables (e.g., `CORS_ALLOWED_ORIGINS` configured strictly with absolute production domain strings).

---

## ℹ️ Low Severity & Best Practices

### 7. Hardcoded Fallback Secrets in Production
* **Location:** [settings.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/electricity_system/settings.py#L28-L33) (`SECRET_KEY`), [settings.py](file:///Users/anasahmad/Documents/eMeter.web/electricity_system/electricity_system/settings.py#L119-L124) (`DB_PASSWORD`)
* **Impact:** If environmental configurations are missing in deployment, the system silently degrades to weak default passwords and insecure fallback keys instead of aborting startup.
* **Evidence:**
  ```python
  SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
  if not SECRET_KEY:
      ...
      SECRET_KEY = 'django-insecure-local-dev-key-change-me' # ❌ Safe fallback only in dev
  ```
* **Remediation:** Throw a configuration error on startup if key values are absent:
  ```python
  if not SECRET_KEY:
      raise ImproperlyConfigured("DJANGO_SECRET_KEY environment variable is missing!")
  ```

---

## 🏁 Summary Dashboard

| # | Vulnerability Category | Severity | Component | Mitigation Priority |
|---|------------------------|----------|-----------|---------------------|
| 1 | BOLA / IDOR PDF Fetch | **🛑 Critical** | Backend API | **Immediate** |
| 2 | Privilege Escalation (Registration) | **🛑 Critical** | Backend API | **Immediate** |
| 3 | LFI / SSRF via xhtml2pdf | **🛑 Critical** | Backend Utils | **Immediate** |
| 4 | BOLA / IDOR Readings & Search | **⚠️ High** | Backend API | ✅ Resolved (Mitigated) |
| 5 | Plaintext AsyncStorage Session | **⚠️ High** | Mobile Client | High |
| 6 | Over-permissive CORS/CSRF | **⚠️ High** | Deployment | Medium |
| 7 | Hardcoded Fallback Secrets | **ℹ️ Info** | Deployment | Low |
