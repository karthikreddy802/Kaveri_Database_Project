# Stage 2: Identity & Authentication Design

This document details the identity modeling choices, role mapping, token claims, session revocation strategy, property scoping analysis, and cryptographic algorithm selection for **Kaveri Stays**.

---

## 2.1 Identity Model Defense

### Selected Model
We implemented a **separate `account` table** referencing the pre-existing `guest` table.

```sql
CREATE TABLE public.account (
    account_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    property_id INTEGER,
    guest_id INTEGER
);
```

### Rationale & Defense
1. **Compatibility with Historical Data:** The database contains 11 years of pre-existing guest data. These guest profiles have no password records. Storing credentials directly in the `guest` table would require adding nullable password and role fields, creating data pollution.
2. **Walk-in/Phone Bookings:** Most guests book via phone or walk-in and never log in. They do not need account credentials. Separating `account` from `guest` ensures we only create account rows for guests who explicitly register online.
3. **Role Isolation:** Staff, managers, and owners are not physical guests checking into rooms. If credentials lived in the `guest` table, we would be forced to create "fake" guest records for every employee. This violates database normalization principles.
4. **Hiring Guests:** If a guest is hired as staff, their account `role` can be updated to `'staff'` or `'manager'`, their `property_id` assigned, while maintaining the link to their pre-existing `guest_id`. This preserves their personal stay history cleanly.

---

## 2.2 & 2.3 Roles and Property Scoping constraints

The four system roles are: `guest`, `staff`, `manager`, and `owner`.

We enforce the property assignments at the database level using two `CHECK` constraints on the `account` table:

1. **`check_property_role_scope`:**
   - Staff and Managers belong to **exactly one** property (`property_id` must be `NOT NULL`).
   - Guests and Owners belong to **no property** (`property_id` must be `NULL`).
   
2. **`check_guest_role`:**
   - Guest accounts must map to a physical guest record (`guest_id` must be `NOT NULL`).
   - Owners cannot map to a guest record (`guest_id` must be `NULL`).
   - Staff and Managers can optionally reference a guest record (e.g., if a guest was hired).

---

## 2.4 Password Hashing Cost

- **Hash function:** `bcrypt` (or `argon2` if preferred).
- **Work factor (rounds):** `12` for `bcrypt` (default is 12).
- **Rationale:** 12 rounds provides a balance between security and performance (taking approximately 250-300ms on modern CPUs). This slow execution defeats offline brute-force attacks while not introducing visible latency to users logging in.
- **Timing:** On our environment, a single login check takes ~280ms, proving that the work factor is computationally significant.

---

## 2.5 Staff Account Self-Service Restriction

### Why Staff Accounts Must Not Be Self-Service
Self-service registration allows anyone on the public internet to create an account. If staff or manager accounts were self-service, attackers could self-register as "Staff" or "Manager" and gain unauthorized access to guests' PII, property metrics, or check-in capabilities. Staff accounts must be provisioned exclusively by administrators or owners.

---

## 2.6 Access Token Claims

### Access Token JWT Claims
- **`sub` (Subject):** The internal `account_id` (identifies the account uniquely).
- **`email`:** The account email address (for identification and UI display).
- **`role`:** The account's role (`guest`, `staff`, `manager`, `owner`) (to enforce RBAC).
- **`property_id`:** The property ID the account is scoped to (or `null` if guest/owner) (enforces property-level access control statelessly).
- **`exp` (Expiration):** Short lifespan (e.g. 15 minutes) to minimize the abuse window of stolen tokens.
- **`iat` (Issued At):** Timestamp of token issuance.

### Deliberately Excluded Claims
- **Password hash:** Storing password hashes in a client-readable JWT exposes the hash to offline decryption if the token is intercepted.
- **Detailed PII (phone, address):** Kept out to minimize JWT payload size (keeping HTTP headers lightweight) and to enforce privacy.

### Token Readability
JWTs (when using standard JSON Web Signatures) are **signed, not encrypted**. The header and payload are base64url-encoded strings. Anyone who intercepts or reads the token can decode it and read the claims in plain text. The cryptographic signature only provides **tamper-detection** (verifying the token was not altered since generation); it does not provide data confidentiality.

---

## 2.8 Session Revocation (Fired Manager)

- **Scenario:** A manager is fired at 10:00. Their access token expires at 10:15.
- **Decision:** We will enforce **immediate revocation**.
- **Implementation:**
  - We will implement an active `is_active` boolean field in the `account` table.
  - FastAPI's authentication dependency will run a quick select to verify `is_active = TRUE` for the calling account on every request.
  - Upon firing, the owner sets `is_active = FALSE`. The manager's very next API request will be rejected with `401 Unauthorized` regardless of the token's expiration timestamp.
- **What it costs:** This lookup turns our stateless token validation into a stateful database query. This adds a slight latency overhead (~2-5ms) and database query volume. However, in an enterprise Hotel Management System, immediate revocation of rogue staff is worth this cost.

---

## 2.9 Property Scoping (Mid-Shift Transfer)

- **Option A (Scoping inside the Token):** `property_id` is written into the JWT claims.
- **Option B (Scoping looked up per Request):** `property_id` is queried from the database on every request.

### Mid-Shift Transfer Comparison
- **Under Option A:** If a manager is transferred from Ooty to Coorg, their active access token still contains `property_id = 1` (Ooty). They cannot access Coorg's records, and can still access Ooty's records, until the token expires (up to 15 minutes). The transfer only completes when the token is rotated (via logout/refresh).
- **Under Option B:** The transfer is instantaneous. The moment their record is updated in the database, their next request evaluates against `property_id = 2` (Coorg).

### Selected Option
We choose **Option A** (embedding in the token) due to its superior performance, but we mitigate the transfer delay by keeping the access token lifetime short (15 minutes). If immediate transfer is required, the manager can simply be instructed to log out and log back in, forcing a token refresh.

---

## 2.12 Algorithm Selection (HS256 vs. RS256)

### Selected Algorithm: HS256 (HMAC with SHA-256)
We selected **HS256** (symmetric signature).

### Defense
Kaveri Stays is a single, unified backend codebase where the token-issuer (the auth system) and the token-verifier (the API routers) run within the same application memory space and share the same secure environment configurations. Since there are no third-party microservices verifying our tokens, symmetric signing is faster, computationally lighter, and simpler to deploy securely.

### What Change Would Cause a Switch to RS256
If the system scale increases and we split into a **decoupled microservices architecture** (e.g. a centralized OAuth Identity Provider and separate API resource servers running on different physical hosts). In that scenario, we would use **RS256** so the resource servers only require a public key to verify tokens, and do not need the private key which remains hidden inside the auth server. This prevents a leak in any single API server from allowing token forgery.
