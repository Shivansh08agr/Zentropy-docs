# Zentropy v2 - Comprehensive Project Analysis Report

**Project**: Zentropy v2 Custodial Wallet
**Version**: 2.0.0
**Date**: 2026-03-26
**Technology Stack**: Python (FastAPI), React (Vite), Rust, Cairo (Starknet)

---

## TABLE OF CONTENTS

1. [Introduction](#introduction)
2. [Installation & Setup](#installation--setup)
3. [Project Structure](#project-structure)
4. [Core Architecture & Objectives](#core-architecture--objectives)
5. [Module Breakdown](#module-breakdown)
   - [Module 1: PQC Backend](#module-1-pqc-backend)
   - [Module 2: Wallet UI](#module-2-quantum-wallet-ui)
   - [Module 3: Starknet Contracts](#module-3-starknet-contracts)
   - [Module 4: ZK Prover](#module-4-zk-prover)
6. [Layout & Pages (Frontend Architecture)](#layout--pages-frontend-architecture)
7. [Limitations](#limitations)
8. [Recommended Diagrams](#recommended-diagrams)

---

## INTRODUCTION

### Project Overview

Zentropy v2 is a **post-quantum cryptographic custodial wallet system** built on Starknet. It bridges quantum-resistant cryptography with blockchain infrastructure by:

- **Generating ML-DSA-44 (Dilithium) keypairs** for users instead of ECDSA
- **Verifying quantum signatures off-chain** using a Rust ZK prover
- **Batching transactions in Merkle trees** for efficient on-chain commitment
- **Deploying abstract accounts on Starknet** that validate proof commitments
- **Managing multiple users through an organization model** with API key authentication

### Key Innovations

1. **Post-Quantum Readiness**: Uses NIST-standardized ML-DSA-44 (successor to Dilithium) instead of ECDSA
2. **Proof-Based Execution**: Off-chain signature verification + on-chain commitment checks
3. **Merkle Batching**: Multiple transactions combined into single on-chain batch
4. **Custodial Multi-User**: Organizations can manage wallets for multiple users
5. **HSM Integration Ready**: Key encryption infrastructure prepared for hardware security modules

### Problem Statement

Current blockchain wallets rely on ECDSA, which quantum computers could compromise. Zentropy provides:

- **Quantum resistance** through post-quantum algorithms
- **Private key protection** via AES-256-GCM encryption
- **Immutable audit trails** for compliance
- **Zero-knowledge proof commitments** for transaction integrity

---

## INSTALLATION & SETUP

### Prerequisites

```bash
# System requirements
- Python 3.10+
- Rust 1.70+
- Scarb (Starknet's Scarb build tool)
- PostgreSQL 13+ (or SQLite for development)
- Node.js 18+
- liboqs native library (libssl-dev on Ubuntu)
```

### Step 1: Clone and Environment Setup

```bash
cd /d/BlockDev/Cryptography/Zentropy-private/Quantum-Guard

# Copy environment template
cp .env.example .env

# Update critical values in .env:
# - STARKNET_RPC=<your_sepolia_rpc_url>
# - STARKNET_PRIVATE_KEY=<your_private_key>
# - STARKNET_ACCOUNT_CONFIG=<path_to_account.json>
# - DATABASE_URL=postgresql://... or sqlite:///...
# - QUANTUMGUARD_MASTER_SECRET=<64_char_hex_string>
# - BOOTSTRAP_SECRET=<unique_secret>
```

### Bootstrap Secret
When creating your first organization on the frontend, use the following pre-generated bootstrap secret:

```text
4299a9d291bf7b2cc88b22aa95f25bd042233c60ff1686a99d80907bc6ce0cd3
```

### Step 2: Install Dependencies

```bash
# Install Python dependencies
make setup

# Verify liboqs installation
python3 -c "import oqs; print('✓ OQS version:', oqs.OQS_VERSION)"

# Build Rust prover binary
make build-phase2

# Build Cairo smart contracts
make build-phase3

# Install frontend dependencies
cd quantum_wallet_ui/frontend && npm install
```

### Step 3: Initialize Database

```bash
# PostgreSQL (recommended for production)
createdb quantumguard
psql quantumguard < pqc_backend/v2/db/schema.sql

# Or SQLite (development)
sqlite3 data/quantumguard_v2.db < pqc_backend/v2/db/schema.sql
```

### Step 4: Deploy Smart Contracts

```bash
# Set CONTRACT ADDRESS in .env
cd starknet_contracts
./deploy.sh

# Returns: 0x<deployed_contract_address>
```

### Step 5: Start Services

```bash
# Terminal 1: Backend API
make run-v2-api
# Runs on http://localhost:8000

# Terminal 2: ZK Prover
make run-prover
# Runs on http://localhost:8001

# Terminal 3: Frontend
cd quantum_wallet_ui/frontend && npm run dev
# Runs on http://localhost:5173
```

### Docker Quick Start

```bash
# Development
docker compose up

# Production
docker compose -f docker-compose.prod.yml up

# Environment setup for production
make env-init-prod
# Configure secrets in .env
docker compose -f docker-compose.prod.yml build &&\
docker compose -f docker-compose.prod.yml up -d
```

### Testing

```bash
# Backend tests
make test-v2

# Prover tests
make test-phase2

# Smart contract tests
make test-phase3

# All tests
make test-all

# Smoke test (full transfer flow)
make smoke-v2-transfer
```

---

## PROJECT STRUCTURE

```
Quantum-Guard/
├── pqc_backend/                    # Phase 4: Multi-User API
│   └── v2/
│       ├── app.py                  # FastAPI entry point
│       ├── api/
│       │   └── routes.py            # REST endpoints (POST/GET)
│       ├── db/
│       │   ├── connection.py        # asyncpg pool management
│       │   ├── migrations.py        # Schema initialization
│       │   └── schema.sql           # PostgreSQL/SQLite DDL
│       ├── models/
│       │   ├── schemas.py           # Pydantic request/response models
│       │   └── enums.py             # PQC algorithms, statuses
│       ├── services/
│       │   ├── key_service.py       # Dilithium key generation + AES encryption
│       │   ├── wallet_service.py    # User/wallet/account CRUD
│       │   ├── transaction_service.py # Transfer execution + Starknet submission
│       │   ├── merkle_service.py    # Merkle tree batching
│       │   ├── audit_service.py     # Immutable audit log
│       │   ├── deployment_service.py # Account deployment orchestration
│       │   └── starknet_felt_utils.py # Address normalization
│       └── tests/
│           ├── test_api_validation.py
│           ├── test_audit_service.py
│           └── test_integration.py
│
├── quantum_wallet_ui/              # Phase 4: React Frontend
│   └── frontend/
│       ├── src/
│       │   ├── api/
│       │   │   └── client.js        # Axios HTTP client + auth interceptors
│       │   ├── pages/
│       │   │   ├── Landing.jsx      # Marketing landing page
│       │   │   ├── Login.jsx        # Org authentication (API key)
│       │   │   ├── Dashboard.jsx    # Wallet overview + balance
│       │   │   ├── CreateWallet.jsx # Register new user + keys
│       │   │   ├── SendTokens.jsx   # Transfer form
│       │   │   ├── ReceiveTokens.jsx # Show wallet address
│       │   │   ├── Transactions.jsx # Transaction list
│       │   │   ├── TransactionHistory.jsx # Detailed history
│       │   │   └── ProverStatus.jsx # Prover health check
│       │   ├── components/
│       │   │   ├── Layout.jsx       # Sidebar + main content
│       │   │   ├── WalletCard.jsx   # Balance + address display
│       │   │   ├── Button.jsx       # Styled button component
│       │   │   ├── Card.jsx         # Card container
│       │   │   ├── ErrorBoundary.jsx # React error handler
│       │   │   ├── Sidebar.jsx      # Navigation menu
│       │   │   └── StatusBadge.jsx  # Status indicator
│       │   ├── context/
│       │   │   └── WalletContext.jsx # Global wallet state management
│       │   ├── App.jsx              # Main router
│       │   ├── main.jsx             # React DOM mount
│       │   └── index.css            # Tailwind styling
│       ├── package.json             # React 19, Vite, Tailwind
│       ├── vite.config.js           # Build configuration
│       └── index.html               # HTML entry point
│
├── starknet_contracts/             # Phase 3: Cairo Smart Contracts
│   ├── Scarb.toml                   # Starknet build manifest
│   ├── src/
│   │   ├── lib.cairo                # Module exports
│   │   ├── quantum_account.cairo    # Smart wallet with proof validation
│   │   ├── merkle_audit.cairo       # On-chain Merkle root storage + audit
│   │   └── account_factory.cairo    # CounterFactual account deployment
│   ├── tests/
│   │   └── test_quantum_account.cairo # Cairo unit tests
│   ├── target/
│   │   └── dev/
│   │       ├── quantum_guard_contract.contract_class.json
│   │       └── quantum_guard_contract_ABI.json  # Public ABI
│   └── deploy.sh                    # Deployment script (starkli invoke)
│
├── zk_prover/                      # Phase 2: Rust ZK Prover
│   ├── Cargo.toml                   # Rust manifest
│   ├── src/
│   │   ├── main.rs                  # CLI entry point + server setup
│   │   ├── lib.rs                   # Library exports
│   │   ├── prover.rs                # ML-DSA verification + proof generation
│   │   └── server.rs                # Actix HTTP server (port 8001)
│   ├── target/
│   │   └── release/
│   │       └── prover               # Compiled binary
│   └── tests/
│       └── (Cargo test cases)
│
├── scripts/
│   ├── smoke_transfer_v2.sh        # Integration test script
│   └── (other automation)
│
├── docker/
│   ├── Dockerfile                   # Backend container
│   └── (build scripts)
│
├── Dockerfile                       # Main backend image
├── docker-compose.yml               # Development stack
├── docker-compose.prod.yml          # Production stack
├── requirements.txt                 # Python dependencies
├── Makefile                         # Build automation
├── .env.example                     # Environment template
└── .env.production.example          # Production template
```

<!-- ### Database Schema (PostgreSQL/SQLite)

**Core Tables:**

- `organizations` — Multi-tenancy container
- `users` — End users within orgs
- `wallets` — Wallet container (1 wallet per user)
- `accounts` — Smart contract accounts (Starknet deployed accounts)
- `transactions` — Transfer records
- `merkle_batches` — Batch roots + metadata
- `merkle_batch_leaves` — Individual tx commitments in batch
- `audit_logs` — Immutable operation log -->

---

## CORE ARCHITECTURE & OBJECTIVES

### Architecture Overview

Zentropy follows a **4-phase distributed architecture**:

![Architecture Overview](/core-architecture.png)

### Data Flow: Transaction Lifecycle

```
1. User initiates transfer via UI
   ↓
2. Backend signs with Dilithium key (AES-256-GCM decryption)
   ↓
3. Signature + public key sent to Rust Prover (port 8001)
   ↓
4. Prover verifies signature → generates SHA-256 commitment
   ↓
5. Commitment added to current Merkle batch
   ↓
6. When batch full (or timeout), compute Merkle root
   ↓
7. Submit batch root to smart contract on Starknet
   ↓
8. Contract validates against stored identity → executes transfer
   ↓
9. Balance updated on-chain; audit log created
```

### Core Objectives

| Objective                     | Implementation                               | Status     |
| ----------------------------- | -------------------------------------------- | ---------- |
| **Post-Quantum Ready**        | ML-DSA-44 (NIST-standardized)                | ✓ Complete |
| **Private Key Protection**    | AES-256-GCM encryption + optional HSM        | ✓ Complete |
| **Immutable Audit**           | Linked hash chain for compliance             | ✓ Complete |
| **Proof-Based Execution**     | Off-chain verification + on-chain commitment | ✓ Complete |
| **Multi-User Support**        | Organization + API key model                 | ✓ Complete |
| **Merkle Efficiency**         | Batch up to N transactions                   | ✓ Complete |
| **Counterfactual Deployment** | Wallet address pre-calculated                | ✓ Complete |
| **Balance Queries**           | Real-time on-chain balance refresh           | ✓ Complete |
| **Prover Failover**           | Python fallback if Rust unavailable          | ⚠ Partial  |

---

## MODULE BREAKDOWN

### MODULE 1: PQC Backend

#### Purpose

Multi-user custodial wallet API that orchestrates key management, transaction signing, batch creation, and smart contract deployment.

#### Key Responsibilities

1. **User & Wallet Management**
   - Register users with organizations (API key authentication)
   - Generate ML-DSA-44 keypairs + encrypt with AES-256-GCM
   - Create counterfactual Starknet account addresses
   - Store encrypted keys in PostgreSQL

2. **Transaction Processing**
   - Decrypt user's private key
   - Sign transaction data with Dilithium
   - Route signature to Rust prover for commitment
   - Batch commits into Merkle trees
   - Submit batches to smart contract

3. **Smart Contract Deployment**
   - Detect transaction status on Starknet
   - Execute deployment via starkli CLI
   - Track deployment state (pending → deployed)
   - Handle retries + error recovery

4. **Audit & Compliance**
   - Record all operations with immutable hashes
   - Verify audit chain integrity
   - Support time-range queries

#### Architecture

**Service Layer** (`services/`):

```
KeyService
├── gen_keypair()           → (public_key, encrypted_secret)
├── decrypt_private_key()   → bytes
└── rotate_keys()           → new keypair with audit trail

WalletService
├── register_user()         → user_id, wallet_id, contract_address
├── list_users()            → [user]
├── get_full_user_wallet()  → {user, wallet, account, keys}
└── refresh_account_balance_from_chain() → wei

TransactionService
├── execute_transfer()      → {tx_id, status, proof}
├── get_transaction()       → transaction detail
├── list_transactions()     → paginated history
└── get_transaction_status_from_starknet() → {status, error}

MerkleService
├── force_finalize()        → batch_id (compute root, store)
├── batch_add_commit()      → leaf added to pending batch
├── get_proof_for_tx()      → merkle_proof_path
└── list_batches()          → all batch metadata

DeploymentService
├── deploy_account()        → runs starkli, updates status
├── auto_deploy_enabled()   → boolean
└── deploy_account_via_new_connection() → fresh DB conn

AuditService
├── log()                   → create immutable audit record
├── get_log()               → audit history for user/org
└── verify_chain_integrity() → SHA-256 linked hash chain
```

**REST API Routes** (`api/routes.py`):

```
POST   /api/v2/org/create                    → Create organization (bootstrap)
POST   /api/v2/users/register                → Register user + generate keys
GET    /api/v2/users                         → List org users
GET    /api/v2/users/{user_id}/wallet        → Get wallet + balance
GET    /api/v2/users/{user_id}/transactions  → Transaction history
POST   /api/v2/transactions/transfer         → Execute transfer
GET    /api/v2/transactions/{tx_id}          → Transaction detail
GET    /api/v2/batches                       → List Merkle batches
GET    /api/v2/batches/{batch_id}            → Batch + leaves
GET    /api/v2/proof/{tx_id}                 → Merkle proof path
POST   /api/v2/batches/force-finalize        → Finalize pending batch
GET    /api/v2/audit/{user_id}               → Audit log
GET    /api/v2/audit/verify-chain            → Verify chain integrity
GET    /api/v2/health                        → Health/status check
POST   /api/v2/users/{user_id}/deployment/retry → Retry deployment
GET    /api/v2/users/{user_id}/deployment-status → Deployment state
```

#### Dependencies

```
fastapi >= 0.104.0          # Web framework
uvicorn >= 0.24.0           # ASGI server
asyncpg >= 0.29.0           # PostgreSQL async driver
aiosqlite >= 0.19.0         # SQLite async driver
starknet-py >= 0.29.0       # Starknet RPC client
cryptography >= 41.0.0      # AES-256-GCM encryption
requests >= 2.31.0          # Sync HTTP client
httpx >= 0.25.0             # Async HTTP client
pydantic >= 2.5.0           # Data validation
mnemonic >= 0.21            # BIP-39 seed phrases
liboqs-python >= 0.10.0     # Dilithium binding
```

#### Key Files

| File                                 | Purpose                                  |
| ------------------------------------ | ---------------------------------------- |
| `v2/app.py`                          | FastAPI initialization, CORS, lifecycle  |
| `v2/api/routes.py`                   | 702 lines: All REST endpoints            |
| `v2/services/key_service.py`         | Key generation, AES encryption, rotation |
| `v2/services/wallet_service.py`      | User/wallet/account CRUD                 |
| `v2/services/transaction_service.py` | Sign → Prove → Batch → Submit flow       |
| `v2/services/merkle_service.py`      | Merkle tree construction + batching      |
| `v2/services/audit_service.py`       | Immutable audit log (SHA-256 chain)      |
| `v2/services/deployment_service.py`  | Starknet deployment orchestration        |
| `v2/db/connection.py`                | asyncpg + SQLite pool management         |
| `v2/db/migrations.py`                | Schema initialization                    |
| `v2/models/schemas.py`               | Pydantic request/response models         |
| `v2/models/enums.py`                 | Algorithms, statuses, audit actions      |

#### Configuration

Environment variables (`.env`):

```
API_HOST=0.0.0.0
API_PORT=8000
DATABASE_URL=postgresql://user:pass@localhost/quantumguard
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173,...
QUANTUMGUARD_MASTER_SECRET=<64-char-hex>
BOOTSTRAP_SECRET=<unique-bootstrap-secret>
AUTO_DEPLOY_WALLET_ON_REGISTER=false
WALLET_DEPLOY_COMMAND=starkli invoke ...
STARKNET_RPC=https://...
STARKNET_PRIVATE_KEY=0x...
STARKNET_ACCOUNT_CONFIG=/path/to/account.json
PROVER_URL=http://localhost:8001
```

#### Key Algorithms & Data Structures

**1. Seed Phrase Generation (BIP-39)**

```
private_key → PBKDF2(password) → 256-bit entropy
entropy → select 24 words from wordlist → seed_phrase
seed_phrase → user can backup/recover keys
```

**2. Key Encryption (AES-256-GCM)**

```
master_key = PBKDF2(QUANTUMGUARD_MASTER_SECRET)
encrypted_key = AES-256-GCM(private_key, master_key, nonce)
Store: {encrypted_key, nonce, tag} in DB
Decrypt: AES-256-GCM-Decrypt(encrypted_key, master_key, nonce, tag)
```

**3. Merkle Batch Tree**

```
Transaction 1 → Hash → Leaf 1
Transaction 2 → Hash → Leaf 2
...
Leaf 1 + Leaf 2 → Hash → Node 12
...
All Nodes → Hash → Merkle Root
Root stored on-chain (quantum_account contract)
```

**4. Audit Chain (Linked Hash)**

```
Log Entry 1: {action, timestamp, hash}
hash = SHA-256(entry1 + prev_hash)
Log Entry 2: {action, timestamp, hash}
hash = SHA-256(entry2 + entry1.hash)
...
Verification: recompute all hashes, ensure chain unbroken
```

#### Security Considerations

| Aspect                | Implementation                            |
| --------------------- | ----------------------------------------- |
| **Key Encryption**    | AES-256-GCM (authenticated encryption)    |
| **Master Key**        | HSM-ready (currently env var in dev)      |
| **Database**          | PostgreSQL with role-based access control |
| **API Auth**          | Bearer token (API key → org_id)           |
| **CORS**              | Whitelist approved origins only           |
| **Audit**             | Immutable hash chain prevents tampering   |
| **Replay Protection** | Nonce per transaction on-chain            |

---

### MODULE 2: Quantum Wallet UI

#### Purpose

React-based frontend for user interaction with Zentropy wallet. Provides authentication, wallet creation, transfers, and transaction history.

#### Key Responsibilities

1. **Authentication & Authorization**
   - Organizations log in with API key
   - Client stores API key in sessionStorage
   - All API calls include `Authorization: Bearer <key>` header
   - Automatic logout if key expires

2. **Wallet Management**
   - Display user's wallet address + balance (real-time)
   - Show deployment status (counterfactual → deployed)
   - Support wallet creation (generate keys on backend)
   - Display seed phrase one-time (user must backup)

3. **Transactions**
   - Transfer form with validation (amount, recipient)
   - Submit to backend for signing + proving + batching
   - Monitor transaction status (pending → submitted → confirmed)
   - Display error messages with fallback error handling

4. **UI/UX**
   - Responsive Tailwind CSS styling
   - Real-time balance updates every 5 seconds
   - Status indicators (connected, deploying, etc.)
   - Error boundaries prevent full app crashes
   - Navigation via React Router v7

#### Architecture

**Page Components** (`pages/`):

```
Landing.jsx
├── Marketing copy
├── Call-to-action buttons
└── Links to login/register

Login.jsx
├── API key input field
├── Organization authentication
├── Route to dashboard on success
└── Error handling (invalid key)

Dashboard.jsx
├── Welcome message
├── WalletCard (address, balance)
├── Quick action buttons (send, receive, etc.)
├── Transaction list preview
└── Deployment status indicator

CreateWallet.jsx
├── Email + username form
├── POST /users/register
├── Display seed phrase (one-time copy)
├── Confirmation dialog
└── Redirect to dashboard

SendTokens.jsx
├── Transfer form (recipient, amount)
├── Validation (amount > 0, address format)
├── POST /transactions/transfer
├── Poll transaction status
├── Success/error display

ReceiveTokens.jsx
├── Display wallet address (QRCode ready)
├── Copy-to-clipboard button
└── Instructions

Transactions.jsx
├── List of all transactions
├── Status badges (pending, confirmed, failed)
├── Filter/sort options
└── Links to detail page

TransactionHistory.jsx
├── Paginated transaction history
├── GET /users/{user_id}/transactions
├── Real-time status updates
└── Explorer link generation

ProverStatus.jsx
├── GET /health endpoint
├── Prover status (connected, degraded, offline)
├── Backend status (DB, Starknet RPC)
└── Diagnostic info
```

**Global State** (`context/WalletContext.jsx`):

```
WalletProvider
├── State:
│   ├── user (current user data)
│   ├── wallet (balance, address, status)
│   ├── transactions (cached history)
│   ├── loading (boolean)
│   └── error (error message)
└── Actions:
    ├── fetchUserWallet()
    ├── fetchTransactions()
    ├── createWallet()
    ├── transfer()
    └── logout()
```

**HTTP Client** (`api/client.js`):

```javascript
API Base URL: VITE_API_URL (from .env)
Authorization: Bearer <stored_api_key>

Features:
├── Request interceptor (add Bearer token)
├── Response interceptor (extract error messages)
├── Pydantic error parsing (detail as array)
├── Automatic status code handling (401 → logout)
└── Timeout: 30s per request

Methods:
├── register(email, username)
├── getWallet(user_id)
├── getTransactions(user_id, limit, offset)
├── transfer(user_id, to_address, amount_strk)
├── getTransaction(tx_id)
├── getHealth()
└── custom(method, path, data)
```

**Component Hierarchy**

```
App
├── BrowserRouter
│   └── Routes
│       ├── Landing (/)
│       ├── Login (/login)
│       └── ProtectedPage (requires API key)
│           ├── Dashboard (/dashboard)
│           ├── CreateWallet (/wallet)
│           ├── SendTokens (/send)
│           ├── ReceiveTokens (/receive)
│           ├── Transactions (/transactions)
│           ├── TransactionHistory (/history)
│           └── ProverStatus (/prover)
│
WalletProvider
├── ErrorBoundary
│   └── Layout
│       ├── Sidebar (navigation)
│       └── MainContent (page-specific)
│
Components:
├── WalletCard (balance display)
├── Card (container)
├── Button (styled button)
├── StatusBadge (status indicator)
├── ErrorBoundary (error fallback)
└── (others as needed)
```

#### Dependencies

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.13.0",
  "axios": "^1.13.5",
  "tailwindcss": "^4.1.18",
  "vite": "^7.3.1"
}
```

#### Build & Deployment

```bash
# Development
npm run dev          # Runs Vite dev server (port 5173)

# Production
npm run build        # Builds to dist/ folder (Vue production mode)
npm run preview      # Preview production build locally

# Quality assurance
npm run lint         # ESLint validation
npm run test:smoke   # Lint + build (CI pipeline)
```

#### Configuration

**Vite Config** (`vite.config.js`):

```
API_URL: http://localhost:8000 (dev)
API_KEY: auto-initialized from VITE_API_KEY
Preview port: 4173
```

**Environment Variables** (`.env.local`):

```
VITE_API_URL=http://localhost:8000
VITE_API_KEY=<org_api_key_for_local_testing>
```

#### Key Features

1. **Real-Time Balance**: Refreshes every 5 seconds via polling
2. **Transaction Monitoring**: Polls /api/v2/transactions/{tx_id} until confirmed
3. **Error Recovery**: Pydantic validation error parsing (detail array → readable message)
4. **Deployment Status**: Shows lifecycle (counterfactual → pending → deployed)
5. **Prover Health**: Indicates backend connectivity issues
6. **Responsive Design**: Mobile-first Tailwind CSS

#### Error Handling Strategy

```javascript
// Pydantic validation errors format:
{
  detail: [
    { type: "value_error", loc: ["field"], msg: "error message" },
    ...
  ]
}

// Extract readable message:
extractErrorMessage(err.response?.data?.detail) → string

// Display in UI:
if (error) {
  return <div className="error">{error.readableMessage}</div>
}
```

---

### MODULE 3: Starknet Contracts

#### Purpose

Cairo smart contracts that validate proof commitments and store Merkle batch roots on-chain. Part of Starknet account abstraction pattern.

#### Key Modules

**1. quantum_account.cairo** (Main smart wallet)

```cairo
Storage:
├── owner_pubkey_hash: felt252      # Identity anchor (SHA-256 of public key)
├── tx_nonce: u64                   # Replay protection counter
├── approved_provers: Map           # Whitelisted prover addresses

Entry Points:
├── __validate_transaction__()      # Validate proof commitment
├── __execute_transaction__()       # Execute transfer if valid
├── set_owner_pubkey_hash()         # Initialize account
├── set_approved_prover()           # Whitelist prover address
└── execute_with_proof()            # Execute with proof verification

Flow:
1. Receive: {to_address, amount, proof_commitment}
2. Load owner_pubkey_hash from storage
3. Verify proof_commitment matches owner identity
4. Check nonce for replay protection
5. Execute transfer via Starknet transfer contract
6. Increment nonce
```

**2. merkle_audit.cairo** (Batch management)

```cairo
Storage:
├── batch_roots: Map                # batch_id → Merkle root (felt252)
├── batch_tx_counts: Map            # batch_id → transaction count
├── approved_committers: Map        # Whitelisted batch submitters

Entry Points:
├── commit_batch_root()             # Store Merkle root on-chain
├── verify_in_batch()               # Prove tx included in batch
├── get_batch_root()                # Query root for batch_id
└── set_approved_committer()        # Whitelist submitter

Flow:
1. Backend computes Merkle root from batch
2. Calls commit_batch_root(batch_id, root)
3. Contract stores root in batch_roots map
4. Users can verify their tx proof against root
```

**3. account_factory.cairo** (Deployment)

```cairo
Storage:
├── account_class_hash: ClassHash   # Compiled quantum_account
├── deployed_accounts: Map          # salt → deployed address
├── total_deployed: u32             # Counter

Entry Points:
├── deploy_wallet()                 # Deploy counterfactual account
├── get_deployed_address()          # Query deployed address by salt
└── set_account_class()             # Update account class hash

Flow:
1. Receive: salt, public_key_hash
2. Compute deterministic address: hash(salt, class_hash)
3. Deploy new instance of quantum_account to address
4. Initialize owner_pubkey_hash
5. Return address to backend
```

#### Storage Design

**Merkle Root Commitment**

```
Batch ID: 12345
Transactions: [tx1, tx2, tx3, ...]

On-chain:
batch_roots[12345] = 0xabcdef...  # SHA-256 root

Off-chain (user verification):
tx1 → leaf1
tx2 → leaf2
tx3 → leaf3
Merkle proof path: [hash(leaf2, leaf3), hash(left_subtree)]
Verify: root == compute_merkle_root(leaf1, proof_path)
```

#### Interfaces & ABI

**QuantumAccount ABI:**

```
execute_with_proof(to: felt252, amount: u256, proof: felt252)
  → Response (success)

__validate_transaction__()
  → bool (true if proof valid)
```

**Factory ABI:**

```
deploy_wallet(salt: felt252, pubkey_hash: felt252)
  → Address (newly deployed account)

get_deployed_address(salt: felt252)
  → Address
```

#### Build & Deployment

```bash
# Build contracts
cd starknet_contracts && scarb build

# Output:
# target/dev/quantum_guard_contract.contract_class.json
# target/dev/quantum_guard_contract_ABI.json

# Deploy via starkli:
starkli invoke <factory_address> deploy_wallet \
  <salt> <pubkey_hash> \
  --rpc https://... \
  --account ~/.starkli/account.json \
  --private-key 0x...

# Returns: {transaction_hash, contract_address}
```

#### Key Algorithms

**1. Counterfactual Address Calculation**

```
address = hash(
  CLASS_HASH = hash(contract_code),
  SALT = user_specific_salt,
  CONSTRUCTOR_ARGS = [owner_pubkey_hash]
)

Advantage:
- Address pre-calculated before deployment
- User can receive tokens before account exists
- On-chain deployment optional (if no activity)
```

**2. Proof Verification (On-Chain)**

```
Input: proof_commitment (SHA-256)
Stored: owner_pubkey_hash

Algorithm (simplified):
1. Load owner_pubkey_hash from storage
2. Verify: proof_commitment matches (or is derived from) pubkey_hash
3. If match: execute transaction
4. If no match: revert with "Invalid proof"

Note: Full signature verification done off-chain by Rust prover
      On-chain only verifies commitment
```

#### Security Considerations

| Aspect                | Implementation                                |
| --------------------- | --------------------------------------------- |
| **Key Storage**       | Public key hash (not raw key) stored on-chain |
| **Replay Protection** | Nonce counter prevents same tx twice          |
| **Whitelist**         | Only approved provers/submitters              |
| **Immutability**      | Cairo storage is permanent (on Starknet)      |
| **Access Control**    | Entry points check caller permissions         |

#### Testing

```bash
scarb cairo-test

# Runs unit tests for:
├── Account initialization
├── Proof verification logic
├── Merkle root commitment
├── Nonce increment
└── Access control
```

---

### MODULE 4: ZK Prover

#### Purpose

Rust-based off-chain signature verification service. Receives Dilithium signatures, verifies them, and generates cryptographic proof commitments for on-chain validation.

#### Core Responsibility

```
Prover Input:
├── public_key (ML-DSA-44 public key, bytes)
├── signature (Dilithium signature, bytes)
├── message (transaction data, bytes)
└── Optional: nonce, salt

Prover Processing:
1. Verify signature using oqs::sig library
2. If valid: compute SHA-256(public_key + signature + message)
3. If invalid: return error

Prover Output:
{
  "valid": true,
  "proof_commitment": "0xabcdef...",
  "proof_path": [node_hashes],
  "timestamp": 1234567890
}
```

#### Architecture

**Main Components**

```
src/
├── main.rs
│   ├── CLI entry point
│   ├── parse commands (test, verify, serve)
│   └── route to handlers
│
├── lib.rs
│   ├── QuantumProver struct
│   └── VerifyRequest/Response types
│
├── prover.rs
│   ├── QuantumProver::new()
│   ├── verify_signature()      → bool
│   ├── generate_proof()        → commitment
│   ├── VerifyRequest (input)
│   └── SignatureProof (output)
│
└── server.rs
    ├── Actix-web HTTP server
    ├── POST /verify (JSON endpoint)
    ├── GET /health
    └── Error handling + CORS
```

**QuantumProver Struct**

```rust
pub struct QuantumProver {
    sig_alg: oqs::sig::Sig,  // ML-DSA-44 instance
}

impl QuantumProver {
    pub fn new() -> Result<Self> {
        let sig_alg = oqs::sig::Sig::new(
            oqs::sig::Algorithm::MlDsa44
        )?;
        Ok(Self { sig_alg })
    }

    pub fn verify_signature(
        &self,
        public_key: &[u8],
        signature: &[u8],
        message: &[u8],
    ) -> Result<bool> {
        self.sig_alg.verify(message, signature, public_key)
    }

    pub fn generate_proof(
        &self,
        public_key: &[u8],
        signature: &[u8],
        message: &[u8],
    ) -> Result<SignatureProof> {
        // Verify first
        let valid = self.verify_signature(public_key, signature, message)?;

        if !valid {
            return Ok(SignatureProof {
                valid: false,
                proof_commitment: String::new(),
                error: Some("Signature verification failed".into()),
            });
        }

        // Compute SHA-256 commitment
        let mut hasher = Sha256::new();
        hasher.update(public_key);
        hasher.update(signature);
        hasher.update(message);
        let commitment = format!("0x{}", hex::encode(hasher.finalize()));

        Ok(SignatureProof {
            valid: true,
            proof_commitment: commitment,
            error: None,
        })
    }
}
```

**HTTP Server** (Actix-web)

```rust
pub async fn start_server(port: u16) -> Result<()> {
    let prover = Arc::new(QuantumProver::new()?);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(prover.clone()))
            .wrap(middleware::Logger::default())
            .route("/health", web::get().to(health))
            .route("/verify", web::post().to(verify))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

// Endpoint: POST /verify
async fn verify(
    req: web::Json<VerifyRequest>,
    prover: web::Data<Arc<QuantumProver>>,
) -> Result<web::Json<SignatureProof>> {
    let public_key = base64::decode(&req.public_key)?;
    let signature = base64::decode(&req.signature)?;
    let message = base64::decode(&req.message)?;

    let proof = prover.generate_proof(&public_key, &signature, &message)?;
    Ok(web::Json(proof))
}

// Endpoint: GET /health
async fn health() -> web::Json<HealthResponse> {
    web::Json(HealthResponse {
        status: "ok".into(),
        prover: "ml_dsa_44".into(),
    })
}
```

**Data Types**

```rust
#[derive(Serialize, Deserialize)]
pub struct VerifyRequest {
    pub public_key: String,      // Base64-encoded
    pub signature: String,       // Base64-encoded
    pub message: String,         // Base64-encoded (transaction data)
    pub nonce: Option<u64>,
}

#[derive(Serialize, Deserialize)]
pub struct SignatureProof {
    pub valid: bool,
    pub proof_commitment: String,  // "0x..." SHA-256 hex
    pub proof_path: Option<Vec<String>>,  // Merkle path
    pub timestamp: u64,
    pub error: Option<String>,
}
```

#### Operating Modes

**Mode 1: CLI Verify (stdin → stdout)**

```bash
# Input JSON from stdin
echo '{"public_key":"...", "signature":"...", "message":"..."}' | \
  ./prover verify

# Output JSON to stdout
{"valid":true,"proof_commitment":"0xabcdef..."}
```

**Mode 2: HTTP Server**

```bash
./prover serve --port 8001

# Backend calls:
curl -X POST http://localhost:8001/verify \
  -H "Content-Type: application/json" \
  -d '{"public_key":"...", "signature":"...", "message":"..."}'

# Response:
{"valid":true,"proof_commitment":"0xabcdef..."}
```

**Mode 3: Self-Test**

```bash
./prover test

# Generates keypair, signs, verifies, produces proof
# Output: self-test results
```

#### Integration with Backend

**Call Flow:**

```
Backend (Python)
  ↓
1. Decrypt user's private key (AES-256-GCM)
2. Sign transaction with Dilithium
3. Call Prover via HTTP:
   POST http://localhost:8001/verify
   {
     public_key: base64(pubkey),
     signature: base64(sig),
     message: base64(tx_data)
   }
4. Receive proof_commitment
5. Store in merkle_batch_leaves table
6. When batch ready, commit to smart contract
```

#### Dependencies

```toml
[dependencies]
oqs = { version = "0.11", features = ["sigs"] }  # Post-quantum crypto
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sha2 = "0.10"  # SHA-256 hashing
clap = { version = "4.4", features = ["derive"] }
base64 = "0.22"  # Base64 encoding
actix-web = "4"  # HTTP server
tokio = { version = "1", features = ["full"] }
```

#### Build & Deployment

```bash
# Development build
cargo build

# Release build (optimized)
cargo build --release
# Output: target/release/prover (~50MB)

# Test
cargo test --release

# Run
./target/release/prover serve --port 8001
```

#### Security Considerations

| Aspect                   | Implementation                                |
| ------------------------ | --------------------------------------------- |
| **Key Verification**     | NIST-standardized ML-DSA-44 algo              |
| **Signature Validation** | liboqs crypto library (audited)               |
| **Commitment**           | SHA-256 (collision-resistant)                 |
| **Server**               | Accepts HTTP (should be behind reverse proxy) |
| **Input Validation**     | Base64 decode + length checks                 |
| **Availability**         | Fallback to Python if Rust unavailable        |

#### Limitations & Fallback

```python
# backend/v2/services/transaction_service.py

try:
    proof = await call_rust_prover(signature, pubkey, message)
except Exception as e:
    logger.warning("Rust prover failed, using Python fallback: %s", e)
    proof = await call_python_prover_fallback(signature, pubkey, message)
```

The Python fallback uses `oqs` library directly (same algorithm, slower).

---

## LAYOUT & PAGES (FRONTEND ARCHITECTURE)

### Page Flow Diagram

```
User Journey:

[Landing] (public)
  ↓ (click "Login")
[Login] (enter API key)
  ↓ (success)
[Dashboard] (overview)
  ├─ [Create Wallet] (register new user)
  ├─ [Send Tokens] (transfer)
  ├─ [Receive Tokens] (share address)
  ├─ [Transactions] (all txs)
  ├─ [Transaction History] (detailed)
  └─ [Prover Status] (health)
```

### Page Specifications

#### 1. Landing Page (`/`)

**Purpose**: Marketing & entry point

**Components**:

```
┌─────────────────────────────────────────┐
│ Zentropy Logo | [Login] [Get Started] │
├─────────────────────────────────────────┤
│                                           │
│  What is Zentropy?                   │
│  Post-quantum secure wallet on Starknet  │
│                                           │
│  Features:                                │
│  ✓ ML-DSA-44 (Quantum-safe)              │
│  ✓ Merkle-batched transactions           │
│  ✓ Custodial multi-user support          │
│                                           │
│  [Get Started] [Learn More]               │
│                                           │
└─────────────────────────────────────────┘
```

**Interactions**:

- Click [Login] → Navigate to `/login`
- Click [Get Started] → Navigate to `/login`

---

#### 2. Login Page (`/login`)

**Purpose**: Organization authentication

**Form**:

```
┌─────────────────────────────────────────┐
│ Login to Zentropy                    │
├─────────────────────────────────────────┤
│                                           │
│ Organization API Key                     │
│ [___________________________________]    │
│                                           │
│ [ ] Remember me                          │
│                                           │
│ [Login]  [Cancel]                        │
│                                           │
│ Error (if any): Invalid API key          │
│                                           │
└─────────────────────────────────────────┘
```

**Logic**:

```javascript
onLogin(apiKey) {
  // 1. Store in sessionStorage
  setApiKey(apiKey)

  // 2. Test API key by calling /users
  try {
    const users = await api.listUsers()
    // 3. Navigate to dashboard
    navigate('/dashboard')
  } catch (err) {
    // Show error
    setError(extractErrorMessage(err))
  }
}
```

**Backend Calls**:

- `GET /api/v2/users` (verify API key)

---

#### 3. Dashboard Page (`/dashboard`)

**Purpose**: Wallet overview & quick actions

**Layout**:

```
┌──────────────────────────────────────────────────┐
│ Sidebar | Dashboard                              │
├────────────────────────────────────────────────┤
│                                                 │
│ Welcome back, User123!                          │
│                                                 │
│ ┌─ Wallet ─────────────────────────────────┐  │
│ │                                            │  │
│ │ Address: 0x123...abc                      │  │
│ │ Balance: 5.123456 STRK                    │  │
│ │ Status:  🟢 Deployed                      │  │
│ │                                            │  │
│ │ [Copy] [Show QR] [Request Funds]          │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ Quick Actions:                                  │
│ [Send] [Receive] [History]                     │
│                                                 │
│ Recent Transactions:                            │
│ TX#1 | To: 0x456... | 0.5 STRK | ✓ Confirmed  │
│ TX#2 | To: 0x789... | 1.0 STRK | ⏳ Pending    │
│                                                 │
│ [View All]                                      │
│                                                 │
└──────────────────────────────────────────────────┘
```

**Backend Calls**:

```
GET /api/v2/users/{user_id}/wallet          → Balance, address
GET /api/v2/users/{user_id}/transactions    → Recent txs
GET /api/v2/health                           → Prover status
```

**Polling**: Every 5 seconds refresh balance

---

#### 4. Create Wallet Page (`/wallet`)

**Purpose**: Register new user

**Form 1: User Registration**

```
┌─────────────────────────────────────────┐
│ Create New Wallet                        │
├─────────────────────────────────────────┤
│                                           │
│ Email                                    │
│ [user@example.com________________]       │
│                                           │
│ Username                                 │
│ [john_doe__________________]             │
│                                           │
│ [Create Wallet]                          │
│                                           │
└─────────────────────────────────────────┘
```

**Form 2: Seed Phrase (One-Time Display)**

```
┌─────────────────────────────────────────┐
│ ⚠️ SAVE YOUR SEED PHRASE                │
├─────────────────────────────────────────┤
│                                           │
│ Your recovery phrase (24 words):          │
│                                           │
│ word1  word2  word3  word4               │
│ word5  word6  word7  word8               │
│ ...                                       │
│                                           │
│ [Copy] [Print] [I've saved it]           │
│                                           │
│ ⚠️ Never share this phrase!              │
│                                           │
│ [Continue to Dashboard]                  │
│                                           │
└─────────────────────────────────────────┘
```

**Backend Calls**:

```
POST /api/v2/users/register
{
  email: "user@example.com",
  username: "john_doe"
}

Response:
{
  user_id: "user_123",
  wallet_id: "wallet_456",
  contract_address: "0x789...",
  public_key: "0xabcd...",
  seed_phrase: "word1 word2 ... word24",
  deployment_status: "pending" | "counterfactual" | "deployed"
}
```

---

#### 5. Send Tokens Page (`/send`)

**Purpose**: Transfer tokens

**Form**:

```
┌─────────────────────────────────────────┐
│ Send Tokens                              │
├─────────────────────────────────────────┤
│                                           │
│ Recipient Address                        │
│ [0x_______________________________]      │
│                                           │
│ Amount (STRK)                            │
│ [50.5________________]                   │
│                                           │
│ [Send] [Cancel]                          │
│                                           │
│ Gas Fee (estimated): 0.001 STRK           │
│ Total: 50.501 STRK                       │
│                                           │
│ Status: ⏳ Processing...                 │
│                                           │
└─────────────────────────────────────────┘
```

**Validation**:

```javascript
// Must pass:
- Amount > 0
- Amount <= wallet balance
- Recipient address valid (0x... format)
- Not empty strings
```

**Submission Flow**:

```
User clicks [Send]
  ↓
Validate form
  ↓
POST /api/v2/transactions/transfer
{
  user_id: "user_123",
  to_address: "0xabc...",
  amount_strk: 50.5
}
  ↓
Backend:
  1. Sign with Dilithium
  2. Send to Prover
  3. Batch into Merkle tree
  4. Commit to smart contract
  5. Return tx_id
  ↓
Poll GET /api/v2/transactions/{tx_id}
  Until status = "confirmed"
  ↓
Show success message
[✓ Sent 50.5 STRK to 0xabc...]
```

**Backend Calls**:

```
POST /api/v2/transactions/transfer                → Initiate
GET /api/v2/transactions/{tx_id}                  → Poll status (every 2s)
GET /api/v2/health                                → Check prover
```

---

#### 6. Receive Tokens Page (`/receive`)

**Purpose**: Share wallet address

**Display**:

```
┌─────────────────────────────────────────┐
│ Receive Tokens                           │
├─────────────────────────────────────────┤
│                                           │
│    ┌──────────────────────┐              │
│    │  [QR Code]           │              │
│    │  (if QR.js loaded)   │              │
│    └──────────────────────┘              │
│                                           │
│ Wallet Address:                          │
│ 0x789defabcdef789defabcdef789defab       │
│                                           │
│ [Copy Address] [Share] [Request]         │
│                                           │
│ This address can receive tokens from       │
│ any wallet on Starknet Sepolia.          │
│                                           │
└─────────────────────────────────────────┘
```

**Interactions**:

- [Copy Address] → Copy to clipboard
- [Share] → Open share dialog (Email, Discord, etc.)
- [Request] → Open faucet link (if available)

---

#### 7. Transactions Page (`/transactions`)

**Purpose**: View all transactions

**List**:

```
┌─────────────────────────────────────────┐
│ All Transactions                         │
├─────────────────────────────────────────┤
│                                           │
│ Type | To Address    | Amount | Status   │
│──────────────────────────────────────────│
│ OUT  | 0x456...890  | 1.0   | ✓ Confirm │
│ OUT  | 0x123...456  | 0.5   | ⏳ Pendin │
│ IN   | from 0x789.. | 2.0   | ✓ Confirm │
│      | more...      |       |           │
│                                           │
│ [Previous] [Next]                        │
│ Page 1 of 5, 50 per page                 │
│                                           │
└─────────────────────────────────────────┘
```

**Status Colors**:

- 🟢 ✓ Confirmed (green)
- 🟡 ⏳ Pending (yellow)
- 🔴 ✗ Failed (red)

**Sorting**:

- By date (newest first)
- By amount
- By status

**Backend Calls**:

```
GET /api/v2/users/{user_id}/transactions?limit=50&offset=0
```

---

#### 8. Transaction History Page (`/history`)

**Purpose**: Detailed history view

**Layout**:

```
┌────────────────────────────────────────────────┐
│ Transaction History                            │
├────────────────────────────────────────────────┤
│                                                 │
│ Filter: [All ▼] [Last 7 days ▼]               │
│                                                 │
│ TX ID        | Date       | From      | To     │
│──────────────────────────────────────────────│
│ #0x1234...   | 2026-03-26 | Me        | 0x456  │
│             | 15:30:45   |           |        │
│             | Status: Confirmed ✓              │
│             | Block: 123456                    │
│             | Fee: 0.001 STRK                  │
│             | [View on Explorer] [Copy Hash] │
│                                                 │
│ #0x5678...   | 2026-03-25 | 0x789     | Me     │
│ ...more...                                     │
│                                                 │
└────────────────────────────────────────────────┘
```

**Details Per Transaction**:

- TX Hash (copyable)
- Timestamp
- From/To addresses
- Amount
- Status
- Block number (if confirmed)
- Gas fee
- Explorer link (Starkscan)

**Backend Calls**:

```
GET /api/v2/users/{user_id}/transactions
GET /api/v2/transactions/{tx_id}                  → Detailed view
```

---

#### 9. Prover Status Page (`/prover`)

**Purpose**: Diagnostic & health check

**Display**:

```
┌─────────────────────────────────────────┐
│ System Status                            │
├─────────────────────────────────────────┤
│                                           │
│ Backend API:      🟢 Connected            │
│ Database:         🟢 Connected            │
│ Starknet RPC:     🟢 Connected            │
│ ZK Prover:        🟢 Connected            │
│   ├─ Mode: Rust HTTP                     │
│   ├─ Endpoint: http://localhost:8001     │
│   └─ Response: 45ms                      │
│                                           │
│ Version Info:                             │
│ ├─ Backend: v2.0.0                      │
│ ├─ Prover: ML-DSA-44                    │
│ └─ Frontend: 0.0.0                      │
│                                           │
│ [Refresh] [Show Logs]                   │
│                                           │
└─────────────────────────────────────────┘
```

**Backend Calls**:

```
GET /api/v2/health

Response:
{
  status: "ok" | "degraded",
  database: "connected" | "disconnected",
  starknet_rpc: "connected" | "disconnected",
  prover: "connected" | "degraded" | "disconnected",
  prover_mode: "rust_http" | "python_fallback",
  prover_ready: true | false
}
```

---

### Navigation & Routing

**React Router Structure** (`App.jsx`):

```jsx
<Router>
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<Login />} />

    <Route
      path="/dashboard"
      element={
        <ProtectedPage>
          <Dashboard />
        </ProtectedPage>
      }
    />
    <Route
      path="/wallet"
      element={
        <ProtectedPage>
          <CreateWallet />
        </ProtectedPage>
      }
    />
    <Route
      path="/send"
      element={
        <ProtectedPage>
          <SendTokens />
        </ProtectedPage>
      }
    />
    <Route
      path="/receive"
      element={
        <ProtectedPage>
          <ReceiveTokens />
        </ProtectedPage>
      }
    />
    <Route
      path="/transactions"
      element={
        <ProtectedPage>
          <Transactions />
        </ProtectedPage>
      }
    />
    <Route
      path="/history"
      element={
        <ProtectedPage>
          <TransactionHistory />
        </ProtectedPage>
      }
    />
    <Route
      path="/prover"
      element={
        <ProtectedPage>
          <ProverStatus />
        </ProtectedPage>
      }
    />
  </Routes>
</Router>
```

**Sidebar Menu** (`Sidebar.jsx`):

```
Dashboard
├─ [Dashboard]        → /dashboard
├─ [Create Wallet]    → /wallet
├─ [Send]             → /send
├─ [Receive]          → /receive
├─ [Transactions]     → /transactions
├─ [History]          → /history
├─ [Prover Status]    → /prover
└─ [Logout]           → Clear API key, go to /login
```

---

### State Management

**WalletContext** (`context/WalletContext.jsx`):

```javascript
const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Actions
  const fetchUserWallet = async (userId) => {
    setLoading(true);
    try {
      const data = await api.getWallet(userId);
      setWallet(data);
      setError(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const transfer = async (userId, toAddress, amount) => {
    try {
      const result = await api.transfer(userId, toAddress, amount);
      return result; // tx_id, status, etc.
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  };

  // ... more actions

  return (
    <WalletContext.Provider value={{ user, wallet, transactions, loading, error, fetchUserWallet, transfer, ... }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
```

**Usage in Components**:

```jsx
function Dashboard() {
  const { wallet, loading, error, fetchUserWallet } = useWallet();

  useEffect(() => {
    fetchUserWallet(userId);

    // Poll every 5 seconds
    const interval = setInterval(() => {
      fetchUserWallet(userId);
    }, 5000);

    return () => clearInterval(interval);
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h1>Wallet Balance: {wallet.balance_strk} STRK</h1>
      ...
    </div>
  );
}
```

---

### Error Handling

**API Error Response Format** (from Pydantic):

```json
// Validation error (detail is array):
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "amount_strk"],
      "msg": "ensure this value is greater than 0",
      "input": 0
    }
  ]
}

// Generic error (detail is string):
{
  "detail": "Invalid API key"
}
```

**Frontend Error Extractor** (`api/client.js`):

```javascript
export function extractErrorMessage(err) {
  const detail = err.response?.data?.detail;

  if (!detail) {
    return err.message || "Unknown error";
  }

  // If detail is string, return as-is
  if (typeof detail === "string") {
    return detail;
  }

  // If detail is array of validation errors, extract messages
  if (Array.isArray(detail)) {
    return detail.map((e) => e.msg).join("; ");
  }

  return JSON.stringify(detail);
}
```

**Usage in Components**:

```jsx
try {
  await api.transfer(user_id, to_address, amount);
} catch (err) {
  setError(extractErrorMessage(err));
  return <div className="alert alert-error">{error}</div>;
}
```

---

## LIMITATIONS

### Functional Limitations

| Limitation                          | Impact                                                  | Workaround/Roadmap                                |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| **Signature verification on-chain** | Smart contract only validates commitment, not signature | Off-chain verification is sufficient for use case |
| **Fixed batch timeout**             | May cause delays if batch not full                      | User can force-finalize batch via API             |
| **No multi-signature**              | Only single user per wallet                             | Future: implement 2-of-3 custody model            |
| **No transaction scheduling**       | All transfers execute immediately                       | Future: add scheduled transfers                   |
| **Balance only on-chain**           | No off-chain balance cache                              | Real-time queries to Starknet RPC required        |
| **No token swaps**                  | Direct transfer only                                    | Future: integrate DEX (Ekubo, etc.)               |

### Performance Limitations

| Limitation                            | Impact                                    | Current Strategy                         |
| ------------------------------------- | ----------------------------------------- | ---------------------------------------- |
| **Merkle batch finalization latency** | Up to N seconds per batch submission      | Async processing; user polled for status |
| **RPC provider bottleneck**           | Starknet RPC rate limits                  | Use Nethermind free tier (rate-limited)  |
| **Prover HTTP latency**               | Network + computation overhead            | Rust binary (50MB) prevents embedding    |
| **Database connection pool**          | Limited concurrent users                  | asyncpg pool size tunable (default: 20)  |
| **Frontend polling**                  | 5-second refresh rate limits real-time UX | WebSocket upgrade planned                |

### Security Limitations

| Limitation                               | Mitigation                                                    |
| ---------------------------------------- | ------------------------------------------------------------- |
| **Master key in .env (dev)**             | HSM integration stub prepared; production-ready config exists |
| **API key in sessionStorage**            | Secure option: use httpOnly cookies + CSRF tokens             |
| **HTTP prover endpoint**                 | Should run behind reverse proxy (nginx) with TLS              |
| **No rate limiting (v2)**                | Can implement in FastAPI middleware                           |
| **Seed phrase displayed plaintext**      | User responsible for secure handling; no fallback recovery    |
| **Deterministic counterfactual address** | If salt leaked, account address is predictable                |

### Operational Limitations

| Limitation                             | Impact                               | Mitigation                                               |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| **Requires PostgreSQL for production** | Higher ops complexity than SQLite    | Docker compose provided; cloud migration straightforward |
| **Starknet testnet only**              | Not mainnet-ready                    | Planned: migrate to mainnet after audit                  |
| **Manual deployment script**           | Risk of human error                  | Automation roadmap: CI/CD pipeline                       |
| **No automatic key rotation**          | Long-lived keys in DB                | Future: implement key versioning + rotation scheduler    |
| **No sharding**                        | Single database scales to ~10k users | Planned: multi-tenant database sharding                  |

### Integration Limitations

| Limitation                        | Impact                              | Workaround                               |
| --------------------------------- | ----------------------------------- | ---------------------------------------- |
| **No native mobile app**          | Web-only (responsive design)        | Planned: React Native mobile client      |
| **No hardware wallet support**    | Manual key import only              | Ledger/Trezor integration on roadmap     |
| **Limited blockchain ecosystems** | Starknet only (no Ethereum, Solana) | Future: multi-chain support              |
| **No fiat on-ramp**               | Users must provide STRK tokens      | Partner with Banxa/Ramp for fiat gateway |
| **No governance DAO**             | Centralized administration          | Future: DAO governance for treasury      |

### Known Bugs & Issues

1. **Incorrect Deployment Address Extraction**
   - **Status**: Fixed (2026-03-25)
   - **Symptom**: Wallets deployed successfully but stored factory address instead of user account
   - **Root Cause**: `deployment_service._parse_deploy_output()` extracted factory address
   - **Solution**: Mandatory `_resolve_deployed_address()` call + validation

2. **Pydantic Validation Error Format**
   - **Status**: Fixed (2026-03-19)
   - **Symptom**: Frontend crashed when detail was array of objects
   - **Root Cause**: Expected string, received Pydantic error array
   - **Solution**: `extractErrorMessage()` in `api/client.js` handles both formats

3. **Function Signature Mismatch**
   - **Status**: Fixed (2026-03-19)
   - **Symptom**: CreateWallet.jsx called `createWallet(label, photo)` with wrong args
   - **Root Cause**: API expects object `{email, username}`
   - **Solution**: Updated frontend to pass correct object format

### Scalability Limitations

```
Current Bottlenecks:

Single Database Instance
  ├─ Max concurrent connections: ~100 (PostgreSQL default)
  ├─ Max users: ~10,000 (with connection pooling)
  └─ Fix: Database sharding (hash by user_id)

Single Prover Instance
  ├─ Max signatures/sec: ~50 (Rust single-threaded)
  ├─ Latency: 100-500ms per signature
  └─ Fix: Horizontal scaling (load balancer + multiple instances)

Frontend Polling
  ├─ Max frontends: ~100 (with 5s refresh)
  ├─ RPC calls/sec: 20 calls/sec
  └─ Fix: WebSocket push notifications

Starknet RPC Rate Limits
  ├─ Free tier: 1000 req/day
  ├─ Paid tier: 100 req/sec
  └─ Fix: Run local Starknet node or use dedicated provider
```

---

## RECOMMENDED DIAGRAMS

### 1. System Architecture Diagram

**Type**: C4 Component Diagram

**What to show**:

```
┌─────────────────────────────────────────────────────────┐
│                  Zentropy Architecture                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Frontend (React Vite)    Backend (FastAPI)  Rust        │
│  ┌────────────────────┐  ┌──────────────┐  Prover       │
│  │ Dashboard          │  │ API Routes   │  ┌──────────┐ │
│  │ Create Wallet      │  │ KeyService   │  │ Sign     │ │
│  │ Send Tokens        │  │ WalletSvc    │  │ Verify   │ │
│  │ Transactions       │  │ TxService    │  │ Commit   │ │
│  └────────────────────┘  │ MerkleSvc    │  └──────────┘ │
│           ↓              │ AuditService │       ↑        │
│           ↓              │ DeploySvc    │       ↓        │
│  ┌────────────────────┐  └──────────────┘  (HTTP)       │
│  │ API Client (Axios) │         ↓                        │
│  │ Interceptors       │         ↓                        │
│  │ Error Handling     │  ┌──────────────┐                │
│  └────────────────────┘  │ PostgreSQL   │                │
│                          │ (SQLite dev) │                │
│                          └──────────────┘                │
│                                                           │
│  Smart Contracts (Cairo)       External Services        │
│  ┌──────────────────────┐      ┌──────────────────────┐ │
│  │ quantum_account      │      │ Starknet RPC Node    │ │
│  │ merkle_audit         │      │ Nethermind/Alchemy   │ │
│  │ account_factory      │      └──────────────────────┘ │
│  └──────────────────────┘                               │
│           ↑                                              │
│           │ (starkli invoke)                            │
│           └──────────────────────────────────────────   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Tools to use**:

- Lucidchart, Draw.io, or PlantUML
- Shows: Components, data flows, technology stack

---

### 2. Transaction Lifecycle Flow

**Type**: Sequence Diagram

**What to show**:

```
Participant Order:
1. User (Frontend)
2. Backend API
3. Database
4. Rust Prover
5. Smart Contract (Starknet)

Sequence:
User → API: POST /api/v2/transactions/transfer
API → DB: Load encrypted private key
API → API: Decrypt key (AES-256-GCM)
API → API: Sign transaction (Dilithium)
API → Prover: POST /verify (signature + pubkey + message)
Prover → Prover: Verify signature
Prover → Prover: Compute SHA-256 commitment
Prover → API: Return proof_commitment
API → DB: Add leaf to merkle_batch_leaves
API → DB: If batch ready, finalize
DB → DB: Compute Merkle root
API → SC: Submit batch root via starkli invoke
SC → SC: Validate proof
SC → SC: Execute transfer
API → DB: Update tx status to "submitted"
API → User: Return tx_id + status
User → API: Poll GET /api/v2/transactions/{tx_id}
API → Starknet RPC: Check transaction status
API → User: Return "confirmed" when done
```

**Tools to use**:

- Mermaid (sequence diagram)
- PlantUML
- Lucidchart

**Code (Mermaid)**:

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant Prover as Rust Prover
    participant SC as Smart Contract

    User->>FE: Click [Send 50 STRK to 0x456]
    FE->>API: POST /api/v2/transactions/transfer
    API->>DB: SELECT encrypted_private_key WHERE user_id
    API->>API: Decrypt (AES-256-GCM)
    API->>API: Sign (Dilithium)
    API->>Prover: POST /verify
    Prover->>Prover: oqs::sig::Sig::verify()
    Prover->>Prover: SHA-256(pubkey||sig||message)
    Prover->>API: {valid: true, proof_commitment: 0x...}
    API->>DB: INSERT merkle_batch_leaves
    API->>DB: IF batch_ready: FINALIZE
    API->>API: Compute Merkle root
    API->>SC: starkli invoke (root + proofs)
    SC->>SC: Validate commitment
    SC->>SC: Transfer STRK
    API->>DB: UPDATE transactions SET status='submitted'
    API->>FE: Return tx_id + status
    FE->>User: Display "Transfer submitted"

    loop Every 2 seconds
        FE->>API: GET /api/v2/transactions/{tx_id}
        API->>Starknet RPC: Check tx status
        API->>FE: Return status
    end

    FE->>User: Display "Transfer confirmed ✓"
```

---

### 3. Data Model (ER Diagram)

**Type**: Entity-Relationship Diagram

**What to show**:

```
┌─────────────────────────────────────────────────────────┐
│                  Database Schema                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  organizations                                           │
│  ├─ org_id (PK)                                         │
│  ├─ org_name                                            │
│  ├─ api_key (unique)                                    │
│  └─ admin_email                                         │
│           │                                              │
│           │ 1:N                                          │
│           └─→ users                                      │
│               ├─ user_id (PK)                           │
│               ├─ org_id (FK)                            │
│               ├─ email                                  │
│               ├─ username                               │
│               └─ created_at                             │
│                      │                                   │
│                      │ 1:1                              │
│                      └─→ wallets                         │
│                          ├─ wallet_id (PK)             │
│                          ├─ user_id (FK)               │
│                          ├─ wallet_name                │
│                          └─ status                     │
│                                 │                       │
│                                 │ 1:1                  │
│                                 └─→ accounts            │
│                                     ├─ account_id (PK) │
│                                     ├─ wallet_id (FK)  │
│                                     ├─ account_address  │
│                                     ├─ public_key_pq    │
│                                     ├─ encrypted_sk     │
│                                     ├─ nonce            │
│                                     ├─ balance_wei      │
│                                     └─ deploy_status    │
│                                            │            │
│                                            │ 1:N        │
│                                            └─→ trans.   │
│                                                         │
│  merkle_batches                                        │
│  ├─ batch_id (PK)                                      │
│  ├─ org_id (FK)                                        │
│  ├─ merkle_root                                        │
│  ├─ status (pending|finalized)                         │
│  └─ tx_count                                           │
│           │                                             │
│           │ 1:N                                         │
│           └─→ merkle_batch_leaves                       │
│               ├─ leaf_id (PK)                          │
│               ├─ batch_id (FK)                         │
│               ├─ tx_id (FK)                            │
│               └─ proof_commitment                      │
│                                                         │
│  transactions                                          │
│  ├─ tx_id (PK)                                         │
│  ├─ account_id (FK)                                    │
│  ├─ to_address                                         │
│  ├─ amount_wei                                         │
│  ├─ status                                             │
│  ├─ tx_hash (Starknet)                                │
│  └─ created_at                                         │
│                                                         │
│  audit_logs                                            │
│  ├─ log_id (PK)                                        │
│  ├─ org_id (FK)                                        │
│  ├─ user_id (FK)                                       │
│  ├─ action (register|transfer|deploy)                 │
│  ├─ prev_hash (for chain integrity)                   │
│  └─ timestamp                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Tools to use**:

- Lucidchart ER tool
- Draw.io database template
- MySQL Workbench

---

### 4. Merkle Tree Batching

**Type**: Tree Diagram

**What to show**:

```
Transaction Batch (Batch #12345):
├─ TX 1 → Leaf Hash 1
├─ TX 2 → Leaf Hash 2
├─ TX 3 → Leaf Hash 3
└─ TX 4 → Leaf Hash 4

         Merkle Root (0xabcdef...)
         /              \
    Node 12             Node 34
    /    \              /    \
   L1    L2            L3    L4

   ↓
   On-chain storage:
   batch_roots[12345] = 0xabcdef...

   Off-chain user verification:
   User has Merkle path: [L2, Node34]
   Can prove: SHA-256(L1, SHA-256(L2, SHA-256(L3, L4))) == Root
```

**Tools to use**:

- ASCII diagram (shown above)
- Lucidchart
- Custom Merkle tree visualizer

---

### 5. Cryptographic Key Material Flow

**Type**: Data Flow Diagram

[![](https://mermaid.ink/img/pako:eNqNVttu20YQ_ZXBFoJtVHKpmy98KCBLrC3ElgVRMeCGQbCiVtLCIldZUrEUx2_pW4sidYGgTYOiQC9vBfrW78kPtJ_Q2eXqaqoODdjcuZydOWeW3hviiy4jNslkbnjIYxtuvBBgKx6wgG3ZsNWhEdvKLmwXVHLaGbJoy4SiYyR5QOW0KoZCqpxPLKp-krSFv80m8SKm1-sUO8X1mCMhu0wuR-VpfoE05CHb6IyYL8LuSiF5apWt8jwiZjLmq5WWLXzmAf5wHGHQ0VU_8aa4dIFm-yI-84CeCGOXv9Ss5UujyZay33rh7W0m44W9obj2B1TG0K4lCZkMVBFSBBDFU2ysD_6QRhGLIBYQ8ID7gIxDyEQIQyGukiwdU2M98IVk0OPDoW3ozkaxFFfMNrSYZe6ad-OBXRhNsr7qWrl7a1AjKXwWRQYt4WwJTXX5f2hZObHzVlZO8fcacpfGdFakZnoOS-nS0sDml2HVdKyjdQxWga5gPdywKrGsKix7YQIajTt9SUcDaA5wwvPwxCPNk4rrQN6Gx67TgpZzXHfbrUq7ft7wyNMkSz1dLpkfc1SlfbSwPo6Y3PbIvz-_-VW_e2THtm3V_yKmxfo65O69euVqnJIwI8Ai8pR3xPMIgz_8-MM_f38LQ7224ew0V3MruVIJHrHpiHIJxyzcgIERkd7u-zewPRp3rtg0i1LzF_iyk1aey1hXJ3z9FxzVm7nioTYhQxIpgu1CKXeN029y1fwtcleJgFwOPNJiz8csij2Cy89VxytMaGPS53rf2qXKT3WomlaLhtwubnfecHLt-pkDtbrbPK1cQk9I6FD_ajzCEnYxU-uiM1nYTR-EwmIQCjY8ci7BaVRbl001BbBdaeNYuO2dj5iHM6rkxSY0o2_fKxUDbXuG_MO207j47MQ9SxXCCX05HcWJeN9BxXFzhfJe7rh6NnPhbhtUx4Amajzb-O537FWnsO4zI37alrWjJ0mhr1WhzixFqYA-zHiqUjoz0mbzlTBvcOFTCEXoM8O2AUmhRMt4z20MM6fpIq0zHVI7ekDK4kLKog14khtupap1dOvHjXrj-CNUbE9qSFPC5GtcgVqm8XcqaHfO-W96eZ946En82ms606SrsSXZ71ZkN64NiS7vh-pb8dM3SrwaH_J4wMeBtm9O0Rlf6SAaj_EwL7W1PBiosTqpSYP3Ok60YJul3k3zG8PK-Jix0UWvCZCc-xWHWs3MDwxCaTEIJRuarfPzL-DYaTgf_W1vSvHCfN3f_aIobuH_bWO14YJJ3puu83iP8RMaDTTEH39CVQSjcczAPakoic3XGV69goj31Z94srMBBlMDHgcsNHPyVtUhekv2tPE8D6sDykN1xj-8u1MtuLG6P5yHOe1IPeDYkWY4afS-JrspvqWPgu7JiLoelqw1uuJllSVtXuonpXcdYpqaq0-ypC95l9g9OoxYlgRMBlStib6oekRfYD1i4yteE688gpczTBrR8EshAmLHcoxpUoz7g9liPEIiWY1TnKdgjixxN3VLHYcxsfcLZY1B7BsyIXZxf2_3sFC29g8PDqxyySpkyZTY1u6hZRUPrMLh4X55f2__oHSbJS_1rujK50voKOX3yqWCVS5mCety1OcsuZrrG_rtfxDgl2A?type=png)](https://mermaid.live/edit#pako:eNqNVttu20YQ_ZXBFoJtVHKpmy98KCBLrC3ElgVRMeCGQbCiVtLCIldZUrEUx2_pW4sidYGgTYOiQC9vBfrW78kPtJ_Q2eXqaqoODdjcuZydOWeW3hviiy4jNslkbnjIYxtuvBBgKx6wgG3ZsNWhEdvKLmwXVHLaGbJoy4SiYyR5QOW0KoZCqpxPLKp-krSFv80m8SKm1-sUO8X1mCMhu0wuR-VpfoE05CHb6IyYL8LuSiF5apWt8jwiZjLmq5WWLXzmAf5wHGHQ0VU_8aa4dIFm-yI-84CeCGOXv9Ss5UujyZay33rh7W0m44W9obj2B1TG0K4lCZkMVBFSBBDFU2ysD_6QRhGLIBYQ8ID7gIxDyEQIQyGukiwdU2M98IVk0OPDoW3ozkaxFFfMNrSYZe6ad-OBXRhNsr7qWrl7a1AjKXwWRQYt4WwJTXX5f2hZObHzVlZO8fcacpfGdFakZnoOS-nS0sDml2HVdKyjdQxWga5gPdywKrGsKix7YQIajTt9SUcDaA5wwvPwxCPNk4rrQN6Gx67TgpZzXHfbrUq7ft7wyNMkSz1dLpkfc1SlfbSwPo6Y3PbIvz-_-VW_e2THtm3V_yKmxfo65O69euVqnJIwI8Ai8pR3xPMIgz_8-MM_f38LQ7224ew0V3MruVIJHrHpiHIJxyzcgIERkd7u-zewPRp3rtg0i1LzF_iyk1aey1hXJ3z9FxzVm7nioTYhQxIpgu1CKXeN029y1fwtcleJgFwOPNJiz8csij2Cy89VxytMaGPS53rf2qXKT3WomlaLhtwubnfecHLt-pkDtbrbPK1cQk9I6FD_ajzCEnYxU-uiM1nYTR-EwmIQCjY8ci7BaVRbl001BbBdaeNYuO2dj5iHM6rkxSY0o2_fKxUDbXuG_MO207j47MQ9SxXCCX05HcWJeN9BxXFzhfJe7rh6NnPhbhtUx4Amajzb-O537FWnsO4zI37alrWjJ0mhr1WhzixFqYA-zHiqUjoz0mbzlTBvcOFTCEXoM8O2AUmhRMt4z20MM6fpIq0zHVI7ekDK4kLKog14khtupap1dOvHjXrj-CNUbE9qSFPC5GtcgVqm8XcqaHfO-W96eZ946En82ms606SrsSXZ71ZkN64NiS7vh-pb8dM3SrwaH_J4wMeBtm9O0Rlf6SAaj_EwL7W1PBiosTqpSYP3Ok60YJul3k3zG8PK-Jix0UWvCZCc-xWHWs3MDwxCaTEIJRuarfPzL-DYaTgf_W1vSvHCfN3f_aIobuH_bWO14YJJ3puu83iP8RMaDTTEH39CVQSjcczAPakoic3XGV69goj31Z94srMBBlMDHgcsNHPyVtUhekv2tPE8D6sDykN1xj-8u1MtuLG6P5yHOe1IPeDYkWY4afS-JrspvqWPgu7JiLoelqw1uuJllSVtXuonpXcdYpqaq0-ypC95l9g9OoxYlgRMBlStib6oekRfYD1i4yteE688gpczTBrR8EshAmLHcoxpUoz7g9liPEIiWY1TnKdgjixxN3VLHYcxsfcLZY1B7BsyIXZxf2_3sFC29g8PDqxyySpkyZTY1u6hZRUPrMLh4X55f2__oHSbJS_1rujK50voKOX3yqWCVS5mCety1OcsuZrrG_rtfxDgl2A)

**Tools to use**:

- Draw.io
- Lucidchart
- Mermaid

---

### 6. Frontend Navigation & State Flow

**Type**: State Machine Diagram

**What to show**:

```
                 ┌─────────────────┐
                 │   [Landing]     │
                 │  (public page)  │
                 └────────┬────────┘
                          │
                    [Click Login]
                          │
                          ↓
                 ┌─────────────────┐
                 │    [Login]      │
                 │  Enter API Key  │
                 └────────┬────────┘
                          │
                  [Submit API Key]
                          │
                  ┌───────┴───────┐
                  ↓               ↓
          ┌─────────────┐  ┌─────────────┐
          │   Valid     │  │  Invalid    │
          └──────┬──────┘  └─────────────┘
                 │              │
                 │          [Show Error]
                 │              │
                 │         [Retry]
                 │              │
                 └──────────┬───┘
                            │
                            ↓
                 ┌──────────────────────┐
                 │    [Dashboard]       │
                 │ (main protected hub) │
                 └──────┬───┬───┬───┬───┘
                        │   │   │   │
                ┌───────┘   │   │   └───────┐
                │           │   │           │
                ↓           ↓   ↓           ↓
         ┌──────────────┐ ... [Wallet]  [Send]
         │[Receive]     │      [...] [History][Prover]
         └──────────────┘
                 │
            [Logout] (in any page)
                 │
                 ↓
         ┌──────────────────────┐
         │ Clear API Key        │
         │ Redirect to [Login]  │
         └──────────────────────┘
```

**Tools to use**:

- Draw.io state machine tool
- PlantUML state diagram
- Mermaid stateDiagram

---

### 7. Module Dependencies

**Type**: Dependency Graph

**What to show**:

```
┌──────────────────────────────────────────────┐
│        Zentropy Module Dependency Graph   │
├──────────────────────────────────────────────┤
│                                               │
│  Frontend (React)                            │
│  ├─→ api/client.js (HTTP + auth)            │
│  │   └─→ Backend API (FastAPI)              │
│  │                                           │
│  └─→ context/WalletContext (state mgmt)     │
│      └─→ api/client.js                      │
│                                               │
│  Backend API (FastAPI)                      │
│  ├─→ api/routes.py (endpoints)              │
│  │   └─→ services/* (business logic)        │
│  │                                           │
│  ├─→ services/key_service.py                │
│  │   └─→ liboqs-python (Dilithium)          │
│  │   └─→ cryptography (AES-256-GCM)         │
│  │                                           │
│  ├─→ services/wallet_service.py             │
│  │   └─→ db/connection.py (asyncpg/sqlite)  │
│  │                                           │
│  ├─→ services/transaction_service.py        │
│  │   ├─→ key_service (decrypt + sign)       │
│  │   ├─→ merkle_service (batch)             │
│  │   ├─→ starknet-py (blockchain calls)     │
│  │   └─→ (HTTP to Rust Prover)              │
│  │                                           │
│  ├─→ services/deployment_service.py         │
│  │   └─→ subprocess (starkli invoke)        │
│  │                                           │
│  ├─→ services/audit_service.py              │
│  │   └─→ db/connection.py (query/insert)    │
│  │                                           │
│  └─→ db/connection.py                       │
│      └─→ PostgreSQL / SQLite                │
│                                               │
│  Rust Prover                                 │
│  ├─→ prover.rs (ML-DSA verification)        │
│  │   └─→ oqs::sig (liboqs bindings)         │
│  │   └─→ sha2 (SHA-256)                     │
│  │                                           │
│  └─→ server.rs (Actix HTTP)                 │
│      └─→ Backend calls POST /verify        │
│                                               │
│  Smart Contracts (Cairo)                    │
│  ├─→ quantum_account.cairo                  │
│  │   └─→ Starknet framework                 │
│  │                                           │
│  ├─→ merkle_audit.cairo                     │
│  │   └─→ Starknet framework                 │
│  │                                           │
│  └─→ account_factory.cairo                  │
│      └─→ Starknet framework                │
│                                               │
│  External Services                          │
│  ├─→ Starknet RPC (Nethermind)             │
│  ├─→ BIP-39 wordlist (mnemonic lib)        │
│  └─→ Starknet testnet node                 │
│                                               │
└──────────────────────────────────────────────┘
```

**Tools to use**:

- Lucidchart
- Draw.io with custom node/arrow styling
- Dependency-cruiser (for code-based generation)

---

### 8. Deployment Topology

**Type**: Infrastructure Diagram

**What to show**:

```
┌──────────────────────────────────────────────────────────┐
│           Zentropy Deployment Topology                │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Development (Local Makefile):                           │
│  ┌──────────────┐      ┌──────────────┐                 │
│  │ Frontend Dev │      │ Backend API  │                 │
│  │ (Vite 5173)  │      │ (uvicorn     │                 │
│  │              │      │  8000)       │                 │
│  └──────────────┘      └──────────────┘                 │
│         ↑                      ↑                          │
│         │                      │                          │
│   npm run dev         make run-v2-api                    │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Rust Prover      │  │ SQLite Database  │             │
│  │ (port 8001)      │  │ (local file)     │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                            │
│                                                            │
│  Production (Docker):                                     │
│                                                            │
│  ┌──────────────────────────────────────────┐           │
│  │         Docker Network (bridge)           │           │
│  ├──────────────────────────────────────────┤           │
│  │                                            │           │
│  │ Frontend Container        API Container  │           │
│  │ ┌──────────────────┐  ┌──────────────┐  │           │
│  │ │ Node.js + nginx  │  │ FastAPI      │  │           │
│  │ │ (port 80/443)    │  │ (port 8000)  │  │           │
│  │ │ dist/ (static)   │  └──────────────┘  │           │
│  │ └──────────────────┘                    │           │
│  │        ↑                   ↓              │           │
│  │     Reverse Proxy    Database Conn    │           │
│  │     (public)               │              │           │
│  │                    ┌────────────────┐    │           │
│  │                    │ PostgreSQL DB  │    │           │
│  │                    │ (port 5432)    │    │           │
│  │                    └────────────────┘    │           │
│  │                                            │           │
│  └──────────────────────────────────────────┘           │
│         ↑                          ↑                      │
│         │                          │                      │
│   Internet             Internal (bridge)                │
│                                                            │
│  External Services:                                       │
│  ┌─────────────────────┐  ┌──────────────────┐          │
│  │ Starknet RPC        │  │ Rust Prover      │          │
│  │ (Nethermind)        │  │ (separate svc)   │          │
│  │ https://...         │  │ (port 8001)      │          │
│  └─────────────────────┘  └──────────────────┘          │
│                                                            │
└──────────────────────────────────────────────────────────┘

Docker Compose Services:
├─ quantum-guard-backend (FastAPI)
├─ quantum-guard-postgres (PostgreSQL)
└─ quantum-guard-frontend (nginx)

(Prover runs as separate binary or container)
```

**Tools to use**:

- Lucidchart
- Draw.io AWS/GCP architecture kit
- ArchiMate diagram

---

### Summary: Diagram Mapping

| Diagram                   | Type             | Tool                | When to Use               |
| ------------------------- | ---------------- | ------------------- | ------------------------- |
| **System Architecture**   | C4 Component     | Draw.io, Lucidchart | Overview for stakeholders |
| **Transaction Lifecycle** | Sequence         | Mermaid, PlantUML   | Technical deep-dive       |
| **Data Model**            | ER Diagram       | Lucidchart, Draw.io | Database design review    |
| **Merkle Batching**       | Tree             | ASCII/Draw.io       | Explain proof mechanism   |
| **Key Material Flow**     | DFD              | Mermaid, Draw.io    | Security audit            |
| **Frontend Navigation**   | State Machine    | Mermaid, Draw.io    | UX walkthrough            |
| **Module Dependencies**   | Dependency Graph | Lucidchart          | Architecture review       |
| **Deployment Topology**   | Infrastructure   | Lucidchart, Draw.io | DevOps/Infrastructure     |

---

## APPENDIX: QUICK REFERENCE

### Environment Setup Checklist

```bash
☐ Clone repository
☐ Create .env from .env.example
☐ Update STARKNET_RPC, PRIVATE_KEY, ACCOUNT_CONFIG
☐ Update DATABASE_URL (PostgreSQL or SQLite)
☐ Update QUANTUMGUARD_MASTER_SECRET (64-char hex)
☐ Update BOOTSTRAP_SECRET (unique secret)
☐ Create database (PostgreSQL)
☐ Run `make setup` (install dependencies)
☐ Build Phase 2 (Rust prover): `make build-phase2`
☐ Build Phase 3 (Cairo contracts): `make build-phase3`
☐ Deploy contracts: `./starknet_contracts/deploy.sh`
☐ Update CONTRACT_ADDRESS in .env
☐ Start backend: `make run-v2-api`
☐ Start prover: `make run-prover`
☐ Install frontend deps: `cd quantum_wallet_ui/frontend && npm install`
☐ Start frontend: `npm run dev`
☐ Test: `make test-all`
```

### API Endpoints Summary

```
POST   /api/v2/org/create
GET    /api/v2/users
POST   /api/v2/users/register
GET    /api/v2/users/{user_id}/wallet
GET    /api/v2/users/{user_id}/transactions
GET    /api/v2/users/{user_id}/deployment-status
POST   /api/v2/users/{user_id}/sender-profile
POST   /api/v2/users/{user_id}/deployment/retry
POST   /api/v2/transactions/transfer
GET    /api/v2/transactions/{tx_id}
GET    /api/v2/batches
GET    /api/v2/batches/{batch_id}
GET    /api/v2/proof/{tx_id}
POST   /api/v2/batches/force-finalize
GET    /api/v2/audit/{user_id}
GET    /api/v2/audit/verify-chain
GET    /api/v2/health
```

### Key Technologies

| Component               | Tech                | Version       |
| ----------------------- | ------------------- | ------------- |
| **Backend API**         | FastAPI + Uvicorn   | 0.104.0+      |
| **Database**            | PostgreSQL / SQLite | 13+           |
| **Frontend**            | React + Vite        | 19.2.0, 7.3.1 |
| **Prover**              | Rust + Actix        | 1.70+         |
| **Smart Contracts**     | Cairo + Starknet    | 2024_07       |
| **Post-Quantum Crypto** | liboqs (ML-DSA-44)  | 0.10.0+       |
| **Blockchain**          | Starknet Sepolia    | testnet       |

---

**End of Report**

_Last Updated: 2026-03-26_
