# Forest Bush

**A self-hosted feature flag management platform built for developers.**

Forest Bush allows development teams to control features in their applications without redeploying code. Developers can enable or disable features, gradually roll them out to a percentage of users, manage separate environments, and inspect exactly why a user received a particular feature.

It is designed as a lightweight, self-hosted alternative to commercial feature flag platforms.

**Project status:** Complete and deployed.

**Live links:** [Dashboard](https://forest-bush-ui.onrender.com) · [API](https://forest-bush-api.onrender.com) · [npm SDK](https://www.npmjs.com/package/@forest-bush/sdk-js) · [GitHub Repository](https://github.com/Altamash-beg/Forest-Bush)

---

## Table of Contents

- [What is Forest Bush?](#what-is-forest-bush)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Using the Dashboard](#using-the-dashboard)
- [Using the REST API](#using-the-rest-api)
- [Using the JavaScript SDK](#using-the-javascript-sdk)
- [Environments and Rollouts](#environments-and-rollouts)
- [API Change Impact Analyzer](#api-change-impact-analyzer)
- [Architecture](#architecture)
- [Security Considerations](#security-considerations)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Future Improvements](#future-improvements)

---

## What is Forest Bush?

Imagine you have built a new checkout experience for your application. You want to release it to only 10% of your users before making it available to everyone.

Normally, you might need to deploy new code or maintain separate application versions.

With Forest Bush, you can create a feature flag and control its rollout from a dashboard.

For example:

- Enable a new checkout feature for 10% of users.
- Increase the rollout to 50% after monitoring its behavior.
- Enable it for everyone when you are ready.
- Disable it immediately if something goes wrong.

All of this can happen without redeploying your application.

## Key Features

| Feature | Description |
|---|---|
| Feature Flag Management | Create, update, enable, disable, and delete feature flags. |
| Percentage Rollouts | Release a feature gradually to a percentage of users. |
| Sticky User Assignment | The same user consistently receives the same rollout decision. |
| Environment Management | Maintain separate flag configurations for development, staging, and production. |
| Audit History | Track changes made to feature flags. |
| JavaScript SDK | Integrate feature flags directly into applications. |
| Local-First Evaluation | Evaluate flags locally using a versioned snapshot. |
| Offline Fallback | Continue using the last successfully downloaded snapshot when the API is unavailable. |
| Evaluation Traces | Understand why a particular user received or did not receive a feature. |
| API Change Analysis | Compare OpenAPI specifications and identify potentially breaking changes. |

## How It Works

Forest Bush has three main parts:

1. **Admin Dashboard:** Developers manage feature flags, environments, rollout percentages, and audit history.
2. **Backend API:** Stores flag configurations, evaluates feature flags, manages snapshots, and records changes.
3. **JavaScript SDK:** Allows applications to evaluate feature flags using either remote API requests or local snapshots.

A typical workflow:

```text
Developer
    |
    v
Forest Bush Dashboard
    |
    v
Forest Bush API
    |
    +------ PostgreSQL
    |       Flags, rules, audit history
    |
    +------ Redis
            Evaluation and snapshot cache

Application
    |
    v
JavaScript SDK
    |
    v
Feature Flag Evaluation
    |
    v
Enable or Disable Feature
```

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Backend | Node.js, Express 5 |
| Database | PostgreSQL, Prisma ORM |
| Caching | Redis, ioredis |
| Validation | Zod |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| SDK | TypeScript, npm |
| Infrastructure | Docker, Render, Terraform |
| CI/CD | GitHub Actions |
| Testing | Vitest, Supertest |

---

## Getting Started

You can explore the deployed dashboard or integrate the API and SDK into your own application.

### Live Application

| Service | URL |
|---|---|
| Dashboard | https://forest-bush-ui.onrender.com |
| Backend API | https://forest-bush-api.onrender.com |
| Health Check | https://forest-bush-api.onrender.com/health |
| npm Package | https://www.npmjs.com/package/@forest-bush/sdk-js |

**Note:** The backend and dashboard are hosted on Render's free tier. A service may sleep after inactivity, so the first request can take longer while it starts.

### 1. Open the Dashboard

Visit:

https://forest-bush-ui.onrender.com

The dashboard is the administrative interface for managing feature flags.

The current deployment uses a shared admin API key. This is a single-admin setup, not a public account-registration system.

### 2. Create a Feature Flag

From the dashboard:

1. Enter your admin API key.
2. Select the environment, such as `production`.
3. Create a new feature flag.
4. Provide a unique flag key.
5. Add a description.
6. Choose whether the flag should be enabled.
7. Configure the rollout percentage if required.
8. Save the changes.

For example:

```json
{
  "key": "new-checkout-flow",
  "environment": "production",
  "description": "Controls the new checkout experience",
  "enabled": true,
  "rules": {
    "rolloutPercentage": 25
  }
}
```

This configuration enables the feature flag and sets its rollout percentage to 25%.

---

## Using the REST API

Forest Bush provides REST endpoints that allow applications and developers to interact with feature flags.

### Public Endpoints

These endpoints do not require the admin API key.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Checks whether the API process is running. |
| GET | `/healthz` | Checks database and Redis connectivity. |
| GET | `/flags/:key` | Evaluates a feature flag. |
| GET | `/environments/:envKey/snapshot` | Retrieves an environment snapshot. |

### Evaluate a Feature Flag

Send a GET request:

```http
GET https://forest-bush-api.onrender.com/flags/new-checkout-flow?userId=user-123
```

Example response:

```json
{
  "key": "new-checkout-flow",
  "enabled": true,
  "reason": "rollout_match"
}
```

The response tells your application whether the feature should be enabled for the specified user.

### Evaluate in a Specific Environment

```http
GET https://forest-bush-api.onrender.com/flags/new-checkout-flow?environment=staging&userId=user-123
```

The default environment is `production`.

### Explain an Evaluation

Add `explain=true` to inspect why a user received a particular result:

```http
GET https://forest-bush-api.onrender.com/flags/new-checkout-flow?userId=user-123&explain=true
```

Example response:

```json
{
  "key": "new-checkout-flow",
  "enabled": true,
  "reason": "rollout_match",
  "trace": {
    "environment": "production",
    "flagFound": true,
    "flagEnabled": true,
    "rule": "rolloutPercentage",
    "rolloutPercentage": 25,
    "userId": "user-123",
    "bucket": 17
  }
}
```

The trace helps developers understand the evaluation decision, including the user's rollout bucket and the configured threshold.

### Admin Endpoints

All administrative endpoints require this HTTP header:

```http
x-api-key: YOUR_ADMIN_API_KEY
```

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/flags` | Create a feature flag. |
| GET | `/admin/flags` | List feature flags. |
| GET | `/admin/flags/:key` | Retrieve a specific flag. |
| GET | `/admin/flags/:key/audit` | Retrieve its audit history. |
| PUT | `/admin/flags/:key` | Update or toggle a flag. |
| DELETE | `/admin/flags/:key` | Delete a feature flag. |
| POST | `/admin/analyze` | Analyze changes between OpenAPI specifications. |

Example: Create a feature flag using cURL.

```bash
curl -X POST https://forest-bush-api.onrender.com/admin/flags \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -d '{
    "key": "new-checkout-flow",
    "environment": "production",
    "description": "Controls the new checkout experience",
    "enabled": true,
    "rules": {
      "rolloutPercentage": 25
    }
  }'
```

Replace `YOUR_ADMIN_API_KEY` with your configured key. Never publish your actual key in source code or public repositories.

---

## Using the JavaScript SDK

Forest Bush provides a published JavaScript SDK that makes feature flag evaluation easier from Node.js and other JavaScript applications.

### Installation

Install the package using npm:

```bash
npm install @forest-bush/sdk-js
```

### Remote Evaluation

Remote mode sends evaluation requests to the Forest Bush API.

```ts
import { ForestBushClient } from '@forest-bush/sdk-js';

const forestBush = new ForestBushClient({
  host: 'https://forest-bush-api.onrender.com',
  environment: 'production',
  cacheTTL: 30,
});

const enabled = await forestBush.evaluate(
  'new-checkout-flow',
  false,
  'user-123'
);

if (enabled) {
  console.log('New checkout experience enabled');
} else {
  console.log('Using the existing checkout experience');
}
```

**How it works:**

- `host` specifies the Forest Bush API.
- `environment` selects the environment.
- `cacheTTL` configures the optional in-memory cache duration.
- The first argument to `evaluate()` is the flag key.
- The second argument is the default value.
- The third argument is the user ID.

### Local-First Evaluation

Local mode downloads a versioned snapshot of feature flags and evaluates them inside the application.

```ts
import { ForestBushClient } from '@forest-bush/sdk-js';

const forestBush = new ForestBushClient({
  host: 'https://forest-bush-api.onrender.com',
  mode: 'local',
  pollIntervalSeconds: 30,
});

await forestBush.start();

const enabled = await forestBush.evaluate(
  'new-checkout-flow',
  false,
  'user-123'
);

console.log('Feature enabled:', enabled);

forestBush.stop();
```

**Why use local mode?**

- Feature checks do not require a network request every time.
- The SDK refreshes its snapshot in the background.
- If the API becomes unavailable, the SDK can continue using its last successful snapshot.
- A bootstrap snapshot can be supplied so evaluation can begin immediately.

### Explain an SDK Evaluation

In local mode, you can use `evaluateWithTrace()` to inspect the evaluation result.

```ts
const result = await forestBush.evaluateWithTrace(
  'new-checkout-flow',
  false,
  'user-123'
);

console.log(result);
```

The result includes the enabled state, reason, and trace information.

---

## Environments and Rollouts

### Environment Isolation

Forest Bush supports separate environments:

- `development`
- `staging`
- `production`

Each environment maintains its own feature flag configuration.

This allows developers to test a feature in development or staging before enabling it in production.

### Percentage-Based Rollouts

Percentage rollouts allow teams to release features gradually.

For example:

| Rollout Percentage | Meaning |
|---|---|
| 0% | No users receive the feature. |
| 10% | Approximately 10% of users receive the feature. |
| 25% | Approximately 25% of users receive the feature. |
| 50% | Approximately 50% of users receive the feature. |
| 100% | All eligible users receive the feature. |

Forest Bush uses deterministic user-based assignment so the same user receives a consistent rollout decision for a given flag.

Percentage-based evaluations require a user ID. Anonymous percentage evaluations return disabled with the reason `context_required`.

---

## API Change Impact Analyzer

Forest Bush also includes an API Change Impact Analyzer that compares two OpenAPI specifications using `oasdiff`.

**Endpoint:**

```http
POST /admin/analyze
```

**Authentication:** Requires the `x-api-key` header.

### Example Request

```json
{
  "oldSpec": {
    "openapi": "3.0.0",
    "info": {
      "title": "Example API",
      "version": "1.0.0"
    },
    "paths": {}
  },
  "newSpec": {
    "openapi": "3.0.0",
    "info": {
      "title": "Example API",
      "version": "1.1.0"
    },
    "paths": {}
  }
}
```

Save the request body as `openapi-comparison.json` and run:

```bash
curl -X POST https://forest-bush-api.onrender.com/admin/analyze \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -d @openapi-comparison.json
```

### Release Decisions

| Decision | Meaning |
|---|---|
| `SAFE` | No breaking changes were detected. |
| `BLOCKED` | Potentially breaking changes were detected. |

A successful analysis returns `hasBreakingChanges`, `releaseDecision`, the raw analyzer output, and a structured report.

The analyzer also handles invalid specifications and execution failures rather than treating failed analysis as a safe release.

---

## Architecture

```text
                    Developer
                        |
                        v
               React Admin Dashboard
                        |
                   x-api-key
                        |
                        v
                 Forest Bush API
                        |
              +---------+---------+
              |                   |
              v                   v
          PostgreSQL            Redis
        Flags, Rules,        Evaluation and
        Audit History        Snapshot Cache


                 Client Application
                        |
                        v
                Forest Bush SDK
                        |
                 +------+------+
                 |             |
                 v             v
             Remote API    Local Snapshot
                 |             |
                 +------+------+
                        |
                        v
                Feature Evaluation
```

### Important Engineering Decisions

**1. Versioned Cache Invalidation**

Evaluation cache keys use per-flag and per-environment version information. This allows changes to invalidate cached evaluations without scanning Redis keys.

**2. Local-First SDK**

The SDK can evaluate feature flags from a versioned snapshot instead of making a network request for every evaluation.

**3. Offline Fallback**

When a snapshot refresh fails, the SDK can continue using the last successfully downloaded snapshot.

**4. Explainable Decisions**

Evaluation traces provide details about the rule, rollout percentage, and user bucket used to make a decision.

**5. Consistent Rollout Logic**

The server and SDK use the same deterministic percentage-rollout model so remote and local evaluations agree.

---

## Security Considerations

- Administrative endpoints require an API key.
- Public evaluation endpoints do not require the admin API key.
- Never commit `.env` files, database credentials, or admin API keys to GitHub.
- Do not expose the admin API key in applications distributed to untrusted users.
- The current dashboard uses a shared admin API key and stores it in browser `localStorage`. This is a deliberate limitation of the single-admin portfolio implementation, not a substitute for a multi-user session-based authentication system.

---

## Running Locally

### Prerequisites

Install:

- Node.js
- npm
- PostgreSQL
- Redis (optional)

### 1. Clone the Repository

```bash
git clone https://github.com/Altamash-beg/Forest-Bush.git

cd Forest-Bush
```

### 2. Start the Backend API

```bash
cd api

npm install

npx prisma migrate dev

npm run dev
```

The API listens on:

```text
http://localhost:8080
```

Create an `api/.env` file:

```env
DATABASE_URL="your_postgresql_connection_string"
REDIS_URL="your_redis_connection_string"
PORT=8080
ADMIN_API_KEY="your_strong_admin_secret"
```

Redis is optional. The API can operate without Redis and gracefully disables Redis-backed caching when it is unavailable.

### 3. Start the Dashboard

Open another terminal:

```bash
cd admin-ui

npm install

npm run dev
```

The dashboard uses the local API by default. You can override the API URL using `VITE_API_URL`.

### 4. Build the SDK

Open another terminal:

```bash
cd sdk-js

npm install

npm run build
```

---

## Testing

API integration tests use a separate PostgreSQL database.

```bash
cd api

TEST_DATABASE_URL="your_test_database_connection_string" npm test
```

The test suite runs Prisma migrations against the test database and covers areas including:

- Feature flag evaluation.
- Administrative mutations.
- Environment isolation.
- Cache invalidation.
- Evaluation traces.

---

## Project Structure

```text
Forest-Bush/
│
├── api/
│   ├── src/
│   ├── prisma/
│   └── Dockerfile
│
├── admin-ui/
│   ├── src/
│   └── Dockerfile
│
├── sdk-js/
│   ├── src/
│   └── examples/
│
├── infra/
│   └── terraform/
│
└── .github/
    └── workflows/
```

---

## Future Improvements

The current implementation focuses on the core feature flag workflow. Potential future extensions include:

- Multi-tenant organizations and billing.
- Role-based access control and session-based authentication.
- User-attribute targeting.
- Snapshot signing.
- Experiment analytics.
- Additional language SDKs.

---

## Project Status

**Complete and deployed.**

Forest Bush was developed in three phases:

1. **Stabilization:** Improved rollout contracts, integration tests, and resilient caching.
2. **Core Product:** Added environments, audit history, dashboard workflows, and the published JavaScript SDK.
3. **Advanced Features:** Implemented local-first evaluation, snapshot polling, offline fallback, and evaluation traces.

This project demonstrates practical full-stack engineering, backend API design, database modeling, caching, SDK development, testing, and deployment.

**Built as a portfolio project to demonstrate end-to-end software engineering.**
