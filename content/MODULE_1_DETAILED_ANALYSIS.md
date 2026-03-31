# MODULE 1: PQC BACKEND (pqc_backend/v2) - DETAILED ANALYSIS

**Module**: Post-Quantum Cryptographic Multi-User Custodial Wallet API
**Framework**: FastAPI + Uvicorn
**Database**: PostgreSQL (primary) / SQLite (development)
**Lines of Code**: ~5000+ (services + API)

---

## TABLE OF CONTENTS

1. [Module Overview](#module-overview)
2. [Detailed Architecture](#detailed-architecture)
3. [Service Layer Deep Dive](#service-layer-deep-dive)
4. [API Endpoint Reference](#api-endpoint-reference)
5. [Database Schema](#database-schema)
6. [Configuration & Environment](#configuration--environment)
7. [Security Implementation](#security-implementation)
8. [Error Handling](#error-handling)
9. [Testing Strategy](#testing-strategy)
10. [Deployment & Scaling](#deployment--scaling)
11. [Troubleshooting](#troubleshooting)

---

## MODULE OVERVIEW

### Purpose

Zentropy Backend (v2) is a **multi-user custodial wallet API** that:

1. **Manages Users & Wallets**: Per-organization user registration, wallet creation
2. **Handles Keys**: ML-DSA-44 keypair generation + AES-256-GCM encryption
3. **Processes Transactions**: Sign → Prove → Batch → Submit to Starknet
4. **Deploys Accounts**: Counterfactual smart account deployment on Starknet
5. **Maintains Audit Trails**: Immutable hash-linked operation log
6. **Queries Blockchain**: Real-time balance & transaction status checks

### Key Philosophy

- **Custodial Model**: Backend holds encrypted private keys (suitable for institutions)
- **Off-Chain Signing**: Reduces on-chain computation costs
- **Proof-Based Validation**: On-chain contract validates merkle-committed proofs
- **Multi-Tenant**: Organizations can manage multiple users via API key

### Core Requirements

| Requirement             | Implementation               | Status |
| ----------------------- | ---------------------------- | ------ |
| Post-quantum signatures | ML-DSA-44 via liboqs         | ✓      |
| Private key protection  | AES-256-GCM encryption       | ✓      |
| Multi-user support      | Organization model + API key | ✓      |
| Transaction batching    | Merkle tree + batch roots    | ✓      |
| Immutable audit log     | SHA-256 linked hash chain    | ✓      |
| Starknet integration    | starknet-py RPC client       | ✓      |
| Asynchronous processing | asyncio + asyncpg            | ✓      |
| Counterfactual accounts | Pre-calculated addresses     | ✓      |

---

## DETAILED ARCHITECTURE

### File Structure

```
pqc_backend/v2/
├── app.py                          # FastAPI app initialization
│   ├── CORS setup
│   ├── Middleware configuration
│   ├── Lifecycle events (startup/shutdown)
│   └── Logging configuration
│
├── api/
│   ├── __init__.py
│   └── routes.py                   # 702 lines: All REST endpoints
│       ├── Authentication (_get_org_id)
│       ├── Organization bootstrap
│       ├── User management
│       ├── Wallet operations
│       ├── Transaction flows
│       ├── Merkle batch queries
│       ├── Audit log access
│       └── Health checks
│
├── db/
│   ├── __init__.py
│   ├── connection.py               # asyncpg/SQLite connection pool
│   │   ├── get_db() → async context manager
│   │   ├── get_pool()
│   │   └── close_pool()
│   ├── migrations.py               # Schema initialization
│   │   ├── run_migrations()
│   │   └── CREATE TABLE statements
│   └── schema.sql                  # DDL for PostgreSQL/SQLite
│
├── models/
│   ├── __init__.py
│   ├── schemas.py                  # Pydantic models for request/response
│   │   ├── UserCreate
│   │   ├── WalletRegistrationOut
│   │   ├── TransferRequest
│   │   ├── TransactionDetailOut
│   │   ├── MerkleBatchOut
│   │   ├── AuditLogOut
│   │   └── (20+ more models)
│   └── enums.py                    # Python enums for PQC algorithms
│       ├── PQ_ALGORITHM = "ML-DSA-44"
│       ├── KeyStatus
│       ├── DeploymentStatus
│       ├── AuditAction
│       └── AuditEntityType
│
├── services/
│   ├── __init__.py
│   ├── key_service.py              # 400+ lines
│   │   ├── Dilithium keypair generation
│   │   ├── AES-256-GCM encryption/decryption
│   │   ├── Seed phrase (BIP-39) generation
│   │   ├── Key rotation logic
│   │   └── HSM integration hooks
│   │
│   ├── wallet_service.py           # 300+ lines
│   │   ├── User registration
│   │   ├── Wallet CRUD
│   │   ├── Account management
│   │   ├── Balance querying
│   │   ├── Organization operations
│   │   └── Sender profile (relayer vs self)
│   │
│   ├── transaction_service.py      # 450+ lines
│   │   ├── Transfer execution flow
│   │   ├── Signature generation
│   │   ├── Prover integration
│   │   ├── Merkle batching
│   │   ├── Starknet submission
│   │   ├── Transaction status polling
│   │   └── On-chain balance refresh
│   │
│   ├── merkle_service.py           # 300+ lines
│   │   ├── Merkle tree construction
│   │   ├── Batch creation/finalization
│   │   ├── Proof path computation
│   │   ├── Root commitment
│   │   └── Batch queries
│   │
│   ├── deployment_service.py       # 200+ lines
│   │   ├── Account deployment via starkli
│   │   ├── Status tracking
│   │   ├── Retry mechanisms
│   │   ├── Error recovery
│   │   └── Auto-deployment on register
│   │
│   ├── audit_service.py            # 250+ lines
│   │   ├── Immutable audit log creation
│   │   ├── Hash chain verification
│   │   ├── Log retrieval + filtering
│   │   └── Integrity validation
│   │
│   ├── starknet_felt_utils.py      # 100+ lines
│   │   ├── Address normalization
│   │   ├── Felt252 conversion
│   │   ├── SHA-256 hash formatting
│   │   └── Validation utilities
│   │
|   |── bip39_english.txt           # 2000+ lines
│   │   ├── Contains different recovery phrases
│   │   └── Used by waller service.py for the wallet recovery
|   |
│   └── drand_beacon.py             # 100+ lines
│       ├── Module integrates Protocol lab's drand (Distributed Randomness Beacon)
│       ├── Fetches verifiable distributed randomness from drand network
│       └── Injects an unpredictable, unbiased and publically verifiable seed into the ML-DSA-44 key generation process
│
├── tests/
│   ├── conftest.py                 # pytest fixtures
|   |── __init__.py
│   ├── test_api_validation.py      # API input validation
│   ├── test_audit_service.py       # Audit log tests
│   ├── test_integration.py         # End-to-end flows
│   └── (other test files)
│
└── __pycache__/ (compiled)
```

### Dependency Injection Pattern

```python
# Singleton services instantiated in routes.py:
_key_svc = KeyService()
_audit_svc = AuditService()
_wallet_svc = WalletService(key_service=_key_svc, audit_service=_audit_svc)
_merkle_svc = MerkleService(audit_service=_audit_svc)
_tx_svc = TransactionService(
    key_service=_key_svc,
    audit_service=_audit_svc,
    merkle_service=_merkle_svc
)
_deploy_svc = DeploymentService(audit_service=_audit_svc)

# Used in route handlers:
async def register_user(req: UserCreate, ...):
    async with get_db() as conn:
        result = await _wallet_svc.register_user(conn, ...)
```

### Cryptographic Key Material Flow

**Type**: Data Flow Diagram

[![](https://mermaid.ink/img/pako:eNqNVttu20YQ_ZXBFoJtVHKpmy98KCBLrC3ElgVRMeCGQbCiVtLCIldZUrEUx2_pW4sidYGgTYOiQC9vBfrW78kPtJ_Q2eXqaqoODdjcuZydOWeW3hviiy4jNslkbnjIYxtuvBBgKx6wgG3ZsNWhEdvKLmwXVHLaGbJoy4SiYyR5QOW0KoZCqpxPLKp-krSFv80m8SKm1-sUO8X1mCMhu0wuR-VpfoE05CHb6IyYL8LuSiF5apWt8jwiZjLmq5WWLXzmAf5wHGHQ0VU_8aa4dIFm-yI-84CeCGOXv9Ss5UujyZay33rh7W0m44W9obj2B1TG0K4lCZkMVBFSBBDFU2ysD_6QRhGLIBYQ8ID7gIxDyEQIQyGukiwdU2M98IVk0OPDoW3ozkaxFFfMNrSYZe6ad-OBXRhNsr7qWrl7a1AjKXwWRQYt4WwJTXX5f2hZObHzVlZO8fcacpfGdFakZnoOS-nS0sDml2HVdKyjdQxWga5gPdywKrGsKix7YQIajTt9SUcDaA5wwvPwxCPNk4rrQN6Gx67TgpZzXHfbrUq7ft7wyNMkSz1dLpkfc1SlfbSwPo6Y3PbIvz-_-VW_e2THtm3V_yKmxfo65O69euVqnJIwI8Ai8pR3xPMIgz_8-MM_f38LQ7224ew0V3MruVIJHrHpiHIJxyzcgIERkd7u-zewPRp3rtg0i1LzF_iyk1aey1hXJ3z9FxzVm7nioTYhQxIpgu1CKXeN029y1fwtcleJgFwOPNJiz8csij2Cy89VxytMaGPS53rf2qXKT3WomlaLhtwubnfecHLt-pkDtbrbPK1cQk9I6FD_ajzCEnYxU-uiM1nYTR-EwmIQCjY8ci7BaVRbl001BbBdaeNYuO2dj5iHM6rkxSY0o2_fKxUDbXuG_MO207j47MQ9SxXCCX05HcWJeN9BxXFzhfJe7rh6NnPhbhtUx4Amajzb-O537FWnsO4zI37alrWjJ0mhr1WhzixFqYA-zHiqUjoz0mbzlTBvcOFTCEXoM8O2AUmhRMt4z20MM6fpIq0zHVI7ekDK4kLKog14khtupap1dOvHjXrj-CNUbE9qSFPC5GtcgVqm8XcqaHfO-W96eZ946En82ms606SrsSXZ71ZkN64NiS7vh-pb8dM3SrwaH_J4wMeBtm9O0Rlf6SAaj_EwL7W1PBiosTqpSYP3Ok60YJul3k3zG8PK-Jix0UWvCZCc-xWHWs3MDwxCaTEIJRuarfPzL-DYaTgf_W1vSvHCfN3f_aIobuH_bWO14YJJ3puu83iP8RMaDTTEH39CVQSjcczAPakoic3XGV69goj31Z94srMBBlMDHgcsNHPyVtUhekv2tPE8D6sDykN1xj-8u1MtuLG6P5yHOe1IPeDYkWY4afS-JrspvqWPgu7JiLoelqw1uuJllSVtXuonpXcdYpqaq0-ypC95l9g9OoxYlgRMBlStib6oekRfYD1i4yteE688gpczTBrR8EshAmLHcoxpUoz7g9liPEIiWY1TnKdgjixxN3VLHYcxsfcLZY1B7BsyIXZxf2_3sFC29g8PDqxyySpkyZTY1u6hZRUPrMLh4X55f2__oHSbJS_1rujK50voKOX3yqWCVS5mCety1OcsuZrrG_rtfxDgl2A?type=png)](https://mermaid.live/edit#pako:eNqNVttu20YQ_ZXBFoJtVHKpmy98KCBLrC3ElgVRMeCGQbCiVtLCIldZUrEUx2_pW4sidYGgTYOiQC9vBfrW78kPtJ_Q2eXqaqoODdjcuZydOWeW3hviiy4jNslkbnjIYxtuvBBgKx6wgG3ZsNWhEdvKLmwXVHLaGbJoy4SiYyR5QOW0KoZCqpxPLKp-krSFv80m8SKm1-sUO8X1mCMhu0wuR-VpfoE05CHb6IyYL8LuSiF5apWt8jwiZjLmq5WWLXzmAf5wHGHQ0VU_8aa4dIFm-yI-84CeCGOXv9Ss5UujyZay33rh7W0m44W9obj2B1TG0K4lCZkMVBFSBBDFU2ysD_6QRhGLIBYQ8ID7gIxDyEQIQyGukiwdU2M98IVk0OPDoW3ozkaxFFfMNrSYZe6ad-OBXRhNsr7qWrl7a1AjKXwWRQYt4WwJTXX5f2hZObHzVlZO8fcacpfGdFakZnoOS-nS0sDml2HVdKyjdQxWga5gPdywKrGsKix7YQIajTt9SUcDaA5wwvPwxCPNk4rrQN6Gx67TgpZzXHfbrUq7ft7wyNMkSz1dLpkfc1SlfbSwPo6Y3PbIvz-_-VW_e2THtm3V_yKmxfo65O69euVqnJIwI8Ai8pR3xPMIgz_8-MM_f38LQ7224ew0V3MruVIJHrHpiHIJxyzcgIERkd7u-zewPRp3rtg0i1LzF_iyk1aey1hXJ3z9FxzVm7nioTYhQxIpgu1CKXeN029y1fwtcleJgFwOPNJiz8csij2Cy89VxytMaGPS53rf2qXKT3WomlaLhtwubnfecHLt-pkDtbrbPK1cQk9I6FD_ajzCEnYxU-uiM1nYTR-EwmIQCjY8ci7BaVRbl001BbBdaeNYuO2dj5iHM6rkxSY0o2_fKxUDbXuG_MO207j47MQ9SxXCCX05HcWJeN9BxXFzhfJe7rh6NnPhbhtUx4Amajzb-O537FWnsO4zI37alrWjJ0mhr1WhzixFqYA-zHiqUjoz0mbzlTBvcOFTCEXoM8O2AUmhRMt4z20MM6fpIq0zHVI7ekDK4kLKog14khtupap1dOvHjXrj-CNUbE9qSFPC5GtcgVqm8XcqaHfO-W96eZ946En82ms606SrsSXZ71ZkN64NiS7vh-pb8dM3SrwaH_J4wMeBtm9O0Rlf6SAaj_EwL7W1PBiosTqpSYP3Ok60YJul3k3zG8PK-Jix0UWvCZCc-xWHWs3MDwxCaTEIJRuarfPzL-DYaTgf_W1vSvHCfN3f_aIobuH_bWO14YJJ3puu83iP8RMaDTTEH39CVQSjcczAPakoic3XGV69goj31Z94srMBBlMDHgcsNHPyVtUhekv2tPE8D6sDykN1xj-8u1MtuLG6P5yHOe1IPeDYkWY4afS-JrspvqWPgu7JiLoelqw1uuJllSVtXuonpXcdYpqaq0-ypC95l9g9OoxYlgRMBlStib6oekRfYD1i4yteE688gpczTBrR8EshAmLHcoxpUoz7g9liPEIiWY1TnKdgjixxN3VLHYcxsfcLZY1B7BsyIXZxf2_3sFC29g8PDqxyySpkyZTY1u6hZRUPrMLh4X55f2__oHSbJS_1rujK50voKOX3yqWCVS5mCety1OcsuZrrG_rtfxDgl2A)


## SERVICE LAYER DEEP DIVE

### 1. KeyService

**Responsibility**: Generate, store, encrypt, and manage quantum-resistant signing keys.

**Core Methods**:

```python
class KeyService:
    async def gen_keypair(
        self,
        conn,
        user_id: str,
        org_id: str,
        key_version: int = 1,
    ) -> dict:
        """
        Generate ML-DSA-44 keypair and seed phrase.
        Encrypt private key with AES-256-GCM.

        Returns:
        {
            'public_key': bytes,
            'public_key_hash': SHA-256(public_key),
            'encrypted_secret': encrypted bytes,
            'encrypted_secret_nonce': nonce,
            'encrypted_secret_tag': auth tag,
            'seed_phrase': 'word1 word2 ... word24'
        }
        """
```

**Algorithm**:

1. **Generate keypair**:

   ```python
   sig_alg = oqs.sig.Sig(oqs.sig.Algorithm.MlDsa44)
   public_key, private_key = sig_alg.keypair()
   # public_key: ~1312 bytes
   # private_key: ~2560 bytes
   ```

2. **Compute public key hash**:

   ```python
   public_key_hash = SHA256(public_key)  # 32 bytes
   # Used as identity anchor on blockchain
   ```

3. **Generate seed phrase**:

   ```python
   entropy = secrets.token_bytes(32)  # 256 bits
   seed_words = bip39_wordlist[entropy[i:i+11] & 2047]  # 24 words
   seed_phrase = " ".join(seed_words)
   # User stores this for recovery
   ```

4. **Encrypt private key**:

   ```python
   master_key = _get_master_key()  # PBKDF2 from env var
   cipher_key = master_key[:32]    # AES-256
   nonce = secrets.token_bytes(12) # 96-bit for GCM
   cipher = AES(cipher_key, mode=GCM, nonce=nonce)
   ciphertext, tag = cipher.encrypt_and_digest(private_key)
   # Store: (ciphertext, nonce, tag)
   ```

5. **Store in database**:
   ```sql
   INSERT INTO keys (
       key_id, user_id, org_id, key_version,
       public_key_pq, public_key_pq_hash,
       encrypted_secret_key, encrypted_secret_nonce,
       encrypted_secret_tag, seed_phrase,
       created_at, status
   ) VALUES (...)
   ```

**Decryption Flow**:

```python
async def get_private_key(self, conn, user_id: str) -> bytes:
    """Load and decrypt private key from DB."""
    key_row = await conn.fetchrow(
        "SELECT * FROM keys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        user_id
    )

    master_key = _get_master_key()
    cipher = AES(master_key[:32], mode=GCM, nonce=key_row['nonce'])
    private_key = cipher.decrypt_and_verify(
        key_row['ciphertext'],
        key_row['tag']
    )
    return private_key
```

**Security Considerations**:

- **Master key**: Currently from `.env` (dev). Production should use HSM (AWS CloudHSM, Azure Key Vault, HashiCorp Vault).
- **Nonce reuse**: Each encryption uses fresh random nonce (critical for GCM security).
- **Seed phrase**: Displayed once to user; no recovery from hash.
- **Key rotation**: Deprecated keys marked with `status='retired'`; new keypair on rotation.

---

### 2. WalletService

**Responsibility**: Manage users, wallets, and accounts within organizations.

**Core Methods**:

```python
class WalletService:
    async def register_user(
        self,
        conn,
        org_id: str,
        email: str,
        username: str,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Create new user, wallet, account, and keypair.
        User gets counterfactual account address.

        Returns:
        {
            'user_id': 'uuid',
            'wallet_id': 'uuid',
            'account_id': 'uuid',
            'contract_address': '0x...',
            'public_key': bytes,
            'public_key_hash': '0x...',
            'seed_phrase': 'word1 word2 ... word24'
        }
        """
        # 1. Create user
        user_id = uuid4().hex
        await conn.execute(
            "INSERT INTO users (...) VALUES (...)",
            user_id, org_id, email, username, ip_address, now()
        )

        # 2. Create wallet
        wallet_id = uuid4().hex
        await conn.execute(
            "INSERT INTO wallets (...) VALUES (...)",
            wallet_id, user_id, username + "'s wallet", 'active', now()
        )

        # 3. Generate keypair + seed phrase
        key_result = await self._key_svc.gen_keypair(conn, user_id, org_id)

        # 4. Compute counterfactual address
        public_key_hash = key_result['public_key_hash']
        contract_address = compute_address(public_key_hash)

        # 5. Create account (not yet deployed)
        account_id = uuid4().hex
        await conn.execute(
            "INSERT INTO accounts (...) VALUES (...)",
            account_id, wallet_id, contract_address,
            key_result['public_key'], public_key_hash,
            key_result['encrypted_secret'], ...
        )

        # 6. Audit log
        await self._audit_svc.log(
            conn, org_id, user_id,
            AuditAction.USER_CREATED, AuditEntityType.USER,
            {"user_id": user_id, "wallet_id": wallet_id}
        )

        return {
            'user_id': user_id,
            'wallet_id': wallet_id,
            'account_id': account_id,
            'contract_address': contract_address,
            'public_key': key_result['public_key'],
            'public_key_hash': public_key_hash,
            'seed_phrase': key_result['seed_phrase'],
        }

    async def get_full_user_wallet(self, conn, user_id: str) -> dict:
        """Fetch user + wallet + account + keys in one query."""
        # Query joins: users → wallets → accounts → keys
        # Returns nested dict with all relationships

    async def refresh_account_balance_from_chain(
        self,
        conn,
        contract_address: str,
        deployed: bool = False,
    ) -> Optional[str]:
        """
        Query Starknet RPC for STRK balance.
        Update account.balance_wei in DB.

        Returns: wei (as string for big integers)
        """
        # 1. Call RPC: starknet_call(contract_address, 'balanceOf', [...])
        # 2. Parse response
        # 3. UPDATE balance_wei in DB
        # 4. Return balance
```

**Data Relationships**:

```
Organization (1)
  └─→ Users (N)
      └─→ Wallets (1 per user)
          └─→ Accounts (1 per wallet)
              └─→ Keys (N, with rotation)
```

**Counterfactual Address Calculation**:

```python
def compute_counterfactual_address(
    salt: felt252,
    public_key_hash: felt252,
    class_hash: felt252 = QUANTUM_ACCOUNT_CLASS_HASH
) -> felt252:
    """
    Starknet deterministic address formula:

    address = hash(
        PREFIX = "DEPLOY",
        CLASS_HASH = class_hash of quantum_account contract,
        SALT = user-specific salt,
        CONSTRUCTOR_ARGS = [owner_pubkey_hash]
    )

    Advantage:
    - Address pre-calculated before contract deployment
    - User can receive funds to non-existent account
    - Deployment is optional (lazy activation)
    """
    # Implementation uses starknet-py
    constructor_args = [public_key_hash]
    address = compute_address(
        class_hash, salt, constructor_args
    )
    return address
```

---

### 3. TransactionService

**Responsibility**: Execute complete transaction lifecycle: sign, prove, batch, submit.

**Core Flow**:

```python
class TransactionService:
    async def execute_transfer(
        self,
        conn,
        user_id: str,
        org_id: str,
        to_address: str,
        amount_strk: float,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Execute: Sign → Prove → Batch → Submit → Poll

        Returns:
        {
            'tx_id': 'uuid',
            'status': 'signed' | 'batched' | 'submitted' | 'pending' | 'confirmed',
            'batch_id': 'batch_123',
            'tx_hash': '0x...',
            'created_at': timestamp,
            'amount_strk': '50.5',
            'amount_wei': '50500000000000000000'
        }
        """

        # 1. Fetch user account
        user = await self._wallet_svc.get_user(conn, user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        wallet = await self._wallet_svc.get_wallet_by_user(conn, user_id)
        account = await self._wallet_svc.get_account_by_wallet(conn, wallet['wallet_id'])

        # Validate account is deployed
        if account['deployment_status'] != 'deployed':
            raise ValueError(f"Account not deployed yet")

        # 2. Convert amount to wei
        amount_wei = int(amount_strk * 10**18)  # STRK has 18 decimals

        # 3. Create transaction record (status: 'signed')
        tx_id = uuid4().hex
        now = time.time()
        await conn.execute(
            """INSERT INTO transactions (
                tx_id, account_id, to_address, amount_wei,
                status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            tx_id, account['account_id'], to_address, str(amount_wei),
            'signed', now, now
        )

        # 4. Sign with Dilithium
        private_key = await self._key_svc.get_private_key(conn, user_id)
        sig_alg = oqs.sig.Sig(oqs.sig.Algorithm.MlDsa44)

        # Build message: (to_address, amount_wei, nonce)
        message = _encode_transfer_message(
            to_address, amount_wei, account['nonce']
        )

        signature = sig_alg.sign(message, private_key)
        # signature: ~2420 bytes

        # 5. Call Rust Prover
        prover_url = self._resolve_prover_endpoint()
        if not prover_url:
            raise RuntimeError("Prover not available")

        proof = await self._call_prover(
            prover_url,
            public_key=account['public_key_pq'],
            signature=signature,
            message=message
        )

        if not proof['valid']:
            raise ValueError("Signature verification failed in prover")

        proof_commitment = proof['proof_commitment']  # "0x..."

        # 6. Add to Merkle batch
        batch_id, leaf_index = await self._merkle_svc.add_transaction_to_batch(
            conn, org_id, tx_id, proof_commitment
        )

        # 7. Update transaction status
        await conn.execute(
            """UPDATE transactions
               SET status = $1, batch_id = $2, proof_commitment = $3
               WHERE tx_id = $4""",
            'batched', batch_id, proof_commitment, tx_id
        )

        # 8. Check if batch is ready to finalize
        batch = await self._merkle_svc.get_batch(conn, batch_id)
        if batch['tx_count'] >= BATCH_SIZE:
            # Finalize immediately
            await self._merkle_svc.finalize_batch(conn, batch_id)
            batch_id = await self._submit_batch_to_chain(conn, batch_id)
            status = 'submitted'
        else:
            status = 'batched'

        # 9. Log audit entry
        await self._audit_svc.log(
            conn, org_id, user_id,
            AuditAction.TRANSFER_INITIATED, AuditEntityType.TRANSACTION,
            {"tx_id": tx_id, "amount": amount_strk, "to": to_address}
        )

        return {
            'tx_id': tx_id,
            'status': status,
            'batch_id': batch_id,
            'created_at': now,
            'amount_strk': f"{amount_strk:.6f}",
            'amount_wei': str(amount_wei),
        }

    async def _call_prover(
        self,
        prover_url: str,
        public_key: bytes,
        signature: bytes,
        message: bytes,
    ) -> dict:
        """HTTP call to Rust prover service."""
        import httpx

        payload = {
            'public_key': base64.b64encode(public_key).decode(),
            'signature': base64.b64encode(signature).decode(),
            'message': base64.b64encode(message).decode(),
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{prover_url.rstrip('/')}/verify",
                json=payload
            )

        if response.status_code != 200:
            raise RuntimeError(f"Prover error: {response.text}")

        return response.json()
        # Returns: {'valid': bool, 'proof_commitment': '0x...'}

    async def _submit_batch_to_chain(
        self,
        conn,
        batch_id: str,
    ) -> str:
        """Submit Merkle root to smart contract via starkli."""
        batch = await self._merkle_svc.get_batch(conn, batch_id)
        merkle_root = batch['merkle_root']

        # Execute: starkli invoke <factory> commit_batch_root batch_id merkle_root
        cmd = [
            'starkli', 'invoke',
            QUANTUM_ACCOUNT_CONTRACT_ADDRESS,
            'commit_batch_root',
            str(batch_id),
            merkle_root,
            '--rpc', STARKNET_RPC,
            '--account', STARKNET_ACCOUNT_CONFIG,
            '--private-key', STARKNET_PRIVATE_KEY,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if result.returncode != 0:
            raise RuntimeError(f"starkli invoke failed: {result.stderr}")

        # Parse tx_hash from output
        tx_hash = _parse_tx_hash_from_output(result.stdout)

        # Update batch status
        await conn.execute(
            """UPDATE merkle_batches
               SET status = $1, tx_hash = $2, submitted_at = $3
               WHERE batch_id = $4""",
            'submitted', tx_hash, time.time(), batch_id
        )

        # Update all transactions in batch
        await conn.execute(
            """UPDATE transactions
               SET status = $1, tx_hash = $2
               WHERE batch_id = $3""",
            'submitted', tx_hash, batch_id
        )

        return tx_hash
```

**Transaction States**:

```
┌──────────┐
│ signed   │ ← User calls /transfer
└─────┬────┘
      │ (signature verified by prover)
      ↓
 ┌──────────┐
 │ batched  │ ← Added to Merkle batch
 └─────┬────┘
       │ (batch finalized)
       ↓
┌──────────────┐
│ submitted    │ ← Submitted to Starknet
└─────┬────────┘
      │ (status polled)
      ↓
┌──────────────┐
│ pending      │ ← On-chain, awaiting confirmation
└─────┬────────┘
      │ (Starknet confirms)
      ↓
┌──────────────┐
│ confirmed    │ ← Transfer complete
└──────────────┘
```

---

### 4. MerkleService

**Responsibility**: Construct Merkle trees, batch transactions, compute roots, generate proofs.

**Algorithm - Building the Tree**:

```
Transaction 1 → Hash → Leaf 1 (0xa1b2...)
Transaction 2 → Hash → Leaf 2 (0xc3d4...)
Transaction 3 → Hash → Leaf 3 (0xe5f6...)
Transaction 4 → Hash → Leaf 4 (0x7890...)

Step 1: Pair leaves
  Leaf 1 + Leaf 2 → Node 12 = SHA256(Leaf 1 || Leaf 2)
  Leaf 3 + Leaf 4 → Node 34 = SHA256(Leaf 3 || Leaf 4)

Step 2: Hash pairs
  Node 12 + Node 34 → Root = SHA256(Node 12 || Node 34)

Result:
         Root (0xabcd...)
        /         \
    Node 12     Node 34
    /    \      /      \
  L1    L2    L3      L4
```

**Storage**:

```sql
-- Batch metadata
INSERT INTO merkle_batches (
    batch_id, org_id, merkle_root, status, tx_count, created_at
) VALUES (batch_123, org_456, 0xabcd..., 'pending', 4, 1711000000)

-- Batch leaves (one per transaction)
INSERT INTO merkle_batch_leaves (
    leaf_id, batch_id, tx_id, proof_commitment, leaf_index, proof_path
) VALUES (
    leaf_1, batch_123, tx_001, 0xa1b2..., 0,
    json('["0xc3d4...", "0x7890..."]')  -- Merkle path to root
)
```

**Proof Verification (User-side)**:

```python
# User wants to verify their tx is in batch
# They have: Leaf value, Proof path, Root

proof_path = [0xc3d4, 0x7890]  # Sibling nodes
leaf = 0xa1b2
root = 0xabcd

# Recompute root
computed = leaf
for sibling in proof_path:
    computed = SHA256(computed || sibling)

assert computed == root  # ✓ Transaction included in batch
```

---

### 5. DeploymentService

**Responsibility**: Deploy counterfactual accounts to Starknet.

**Deployment Lifecycle**:

```python
class DeploymentService:
    async def deploy_account(
        self,
        conn,
        account_id: str,
        org_id: str,
        user_id: str,
    ) -> dict:
        """
        Deploy counterfactual account via starkli.

        States:
        counterfactual → pending → deployed
        """

        account = await conn.fetchrow(
            "SELECT * FROM accounts WHERE account_id = $1", account_id
        )

        # 1. Mark as pending
        now = time.time()
        await conn.execute(
            """UPDATE accounts
               SET deployment_status = $1,
                   deployment_attempts = COALESCE(deployment_attempts, 0) + 1,
                   last_deployment_attempt = $2
               WHERE account_id = $3""",
            'pending', now, account_id
        )

        # 2. Build starkli command
        public_key_hash = account['public_key_pq_hash']
        cmd = f"""
        starkli invoke {FACTORY_ADDRESS} deploy_wallet \\
            {public_key_hash} \\
            --rpc {STARKNET_RPC} \\
            --account {STARKNET_ACCOUNT_CONFIG} \\
            --private-key {STARKNET_PRIVATE_KEY}
        """

        # 3. Execute deployment
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True,
                timeout=DEPLOY_TIMEOUT_SECONDS
            )
            if result.returncode != 0:
                raise RuntimeError(f"Deploy failed: {result.stderr}")

            # 4. Parse tx_hash + deployed address
            tx_hash = _parse_tx_hash(result.stdout)
            deployed_address = _parse_deployed_address(result.stdout)

            # 5. Verify address matches counterfactual
            if deployed_address != account['account_address']:
                raise ValueError("Deployed address mismatch!")

            # 6. Update account status
            await conn.execute(
                """UPDATE accounts
                   SET deployment_status = $1,
                       deployment_tx_hash = $2,
                       deployed_at = $3,
                       updated_at = $4
                   WHERE account_id = $5""",
                'deployed', tx_hash, now, now, account_id
            )

            # 7. Audit log
            await self._audit_svc.log(
                conn, org_id, user_id,
                AuditAction.ACCOUNT_DEPLOYED, AuditEntityType.ACCOUNT,
                {"deployment_tx_hash": tx_hash}
            )

            return {
                'account_id': account_id,
                'deployment_status': 'deployed',
                'deployment_tx_hash': tx_hash,
                'deployed_at': now,
            }

        except Exception as e:
            logger.error(f"Deployment failed: {e}")

            # Update with error
            await conn.execute(
                """UPDATE accounts
                   SET deployment_status = $1,
                       deployment_error_message = $2,
                       updated_at = $3
                   WHERE account_id = $4""",
                'failed', str(e), now, account_id
            )
            raise
```

**Auto-Deployment on Register**:

```python
# In routes.py, register_user endpoint:
if _deploy_svc.auto_deploy_enabled():
    # Set status to 'pending'
    await conn.execute(
        "UPDATE accounts SET deployment_status = $1 WHERE account_id = $2",
        'pending', result['account_id']
    )

    # Queue background task
    asyncio.create_task(
        _auto_deploy_account_task(account_id, org_id, user_id)
    )

    result['deployment_status'] = 'pending'
else:
    result['deployment_status'] = 'counterfactual'
```

---

### 6. AuditService

**Responsibility**: Maintain immutable, time-ordered audit trail with integrity verification.

**Hash Chain**:

```
Entry 1:
  timestamp: 1711000000
  action: USER_REGISTERED
  entity: user_123
  data: {...}
  prev_hash: "0x" (genesis)
  entry_hash: SHA256(timestamp || action || entity || data || prev_hash)
  → entry_hash_1 = 0xabc123...

Entry 2:
  prev_hash: 0xabc123...
  entry_hash: SHA256(timestamp || action || entity || data || 0xabc123...)
  → entry_hash_2 = 0xdef456...

Entry 3:
  prev_hash: 0xdef456...
  entry_hash: SHA256(timestamp || action || entity || data || 0xdef456...)
  → entry_hash_3 = 0x789ghi...

Chain Verification:
  - Load all entries in order
  - Recompute hashes
  - Verify each entry's prev_hash matches previous entry's entry_hash
  - If any mismatch: chain tampered with
```

**Implementation**:

```python
class AuditService:
    async def log(
        self,
        conn,
        org_id: str,
        user_id: Optional[str],
        action: AuditAction,
        entity_type: AuditEntityType,
        entity_data: dict,
    ) -> str:
        """Create audit log entry and return entry_hash."""

        # Get previous entry
        prev_entry = await conn.fetchrow(
            """SELECT entry_hash FROM audit_logs
               WHERE org_id = $1
               ORDER BY created_at DESC LIMIT 1""",
            org_id
        )

        prev_hash = prev_entry['entry_hash'] if prev_entry else '0x'

        # Build entry
        now = time.time()
        log_id = uuid4().hex

        entry = {
            'timestamp': now,
            'action': action.value,
            'entity_type': entity_type.value,
            'entity_data': json.dumps(entity_data),
            'prev_hash': prev_hash,
        }

        # Compute hash
        entry_hash = self._compute_entry_hash(entry)

        # Store
        await conn.execute(
            """INSERT INTO audit_logs (
                log_id, org_id, user_id, action, entity_type,
                entity_data, prev_hash, entry_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
            log_id, org_id, user_id, action.value, entity_type.value,
            json.dumps(entity_data), prev_hash, entry_hash, now
        )

        return entry_hash

    async def verify_chain_integrity(self, conn, org_id: str) -> dict:
        """Verify hash chain is unbroken."""

        entries = await conn.fetch(
            """SELECT * FROM audit_logs
               WHERE org_id = $1
               ORDER BY created_at ASC"""
        )

        if not entries:
            return {'valid': True, 'count': 0, 'message': 'No entries'}

        prev_hash = '0x'
        for i, entry in enumerate(entries):
            if entry['prev_hash'] != prev_hash:
                return {
                    'valid': False,
                    'count': len(entries),
                    'error_at': i,
                    'message': f'Chain broken at entry {i}'
                }

            # Recompute hash
            computed = self._compute_entry_hash({
                'timestamp': entry['created_at'],
                'action': entry['action'],
                'entity_type': entry['entity_type'],
                'entity_data': entry['entity_data'],
                'prev_hash': entry['prev_hash'],
            })

            if computed != entry['entry_hash']:
                return {
                    'valid': False,
                    'count': len(entries),
                    'error_at': i,
                    'message': f'Hash mismatch at entry {i}'
                }

            prev_hash = entry['entry_hash']

        return {
            'valid': True,
            'count': len(entries),
            'message': 'Chain integrity verified',
        }

    def _compute_entry_hash(self, entry: dict) -> str:
        """Compute SHA-256 of entry."""
        import hashlib

        content = json.dumps(entry, sort_keys=True)
        hash_obj = hashlib.sha256(content.encode())
        return '0x' + hash_obj.hexdigest()
```

---

## API ENDPOINT REFERENCE

### Authentication

**Header Required**:

```
Authorization: Bearer <api_key>
Content-Type: application/json
```

**Flow**:

```
1. Extract API key from "Bearer <key>"
2. Query: SELECT * FROM organizations WHERE api_key = $1
3. If found: org_id = row.org_id
4. If not found: 401 Unauthorized
```

### Endpoints

#### 1. Organization Bootstrap

**POST /api/v2/org/create**

Creates first organization (protected by bootstrap secret).

```bash
curl -X POST http://localhost:8000/api/v2/org/create \
  -H "Content-Type: application/json" \
  -d '{
    "org_name": "My Bank",
    "admin_email": "admin@mybank.com",
    "bootstrap_secret": "$BOOTSTRAP_SECRET"
  }'

Response (201):
{
  "org_id": "org_12345",
  "org_name": "My Bank",
  "api_key": "qg_org_abc123...",
  "admin_email": "admin@mybank.com"
}
```

**Security**: Requires exact match of `BOOTSTRAP_SECRET` environment variable.

---

#### 2. User Registration

**POST /api/v2/users/register**

Register new user and create wallet.

```bash
curl -X POST http://localhost:8000/api/v2/users/register \
  -H "Authorization: Bearer qg_org_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "username": "alice"
  }'

Response (200):
{
  "user_id": "user_abc123",
  "wallet_id": "wallet_xyz789",
  "contract_address": "0x123...abc",
  "public_key": "0xabcd...",
  "public_key_hash": "0x...sha256...",
  "seed_phrase": "word1 word2 ... word24",
  "sender_model": "relayer",
  "deployment_status": "counterfactual | pending | deployed"
}
```

**Actions**:

- Generate ML-DSA-44 keypair
- Create BIP-39 seed phrase
- Encrypt private key with AES-256-GCM
- Create counterfactual Starknet account address
- If `AUTO_DEPLOY_WALLET_ON_REGISTER=true`: queue deployment

**⚠️ Important**: Seed phrase displayed once. User must backup. No recovery method.

---

#### 3. List Users

**GET /api/v2/users**

List all users in organization.

```bash
curl -X GET http://localhost:8000/api/v2/users?limit=50&offset=0 \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "total": 3,
  "users": [
    {
      "user_id": "user_abc123",
      "email": "alice@example.com",
      "username": "alice",
      "created_at": 1711000000
    },
    ...
  ]
}
```

**Query Parameters**:

- `limit` (1-500, default 50)
- `offset` (>=0, default 0)

---

#### 4. Get User Wallet

**GET /api/v2/users/{user_id}/wallet**

Get wallet details, balance, and deployment status.

```bash
curl -X GET http://localhost:8000/api/v2/users/user_abc123/wallet \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "user_id": "user_abc123",
  "wallet_id": "wallet_xyz789",
  "wallet_name": "alice's wallet",
  "contract_address": "0x123...abc",
  "public_key_hash": "0xsha256...",
  "deployment_status": "deployed",
  "nonce": 5,
  "balance_strk": "50.123456",
  "balance_wei": "50123456000000000000",
  "status": "active",
  "sender_model": "relayer"
}
```

**Balance Refresh**: Queries Starknet RPC in real-time if account deployed.

---

#### 5. Transfer Tokens

**POST /api/v2/transactions/transfer**

Execute complete transfer: sign, prove, batch, submit.

```bash
curl -X POST http://localhost:8000/api/v2/transactions/transfer \
  -H "Authorization: Bearer qg_org_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_abc123",
    "to_address": "0x789...def",
    "amount_strk": 50.5
  }'

Response (200):
{
  "tx_id": "tx_123xyz",
  "status": "batched | submitted",
  "batch_id": "batch_456",
  "tx_hash": "0x...",
  "created_at": 1711000000,
  "amount_strk": "50.5",
  "amount_wei": "50500000000000000000"
}
```

**Validation**:

- `user_id` exists within org
- `to_address` is valid Starknet address (0x + hex)
- `amount_strk` > 0
- Account is deployed
- Balance >= amount

**Flow** (async):

1. Sign with Dilithium
2. Send to Prover for verification + commitment
3. Add to Merkle batch
4. If batch ready, finalize & submit to chain
5. Poll Starknet RPC for confirmation

---

#### 6. Get Transaction Detail

**GET /api/v2/transactions/{tx_id}**

Get transaction status and details.

```bash
curl -X GET http://localhost:8000/api/v2/transactions/tx_123xyz \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "tx_id": "tx_123xyz",
  "account_id": "account_abc",
  "to_address": "0x789...def",
  "amount_strk": "50.5",
  "amount_wei": "50500000000000000000",
  "status": "confirmed | pending | submitted | signed | failed",
  "tx_hash": "0x...",
  "starknet_status": "confirmed | pending | rejected | failed",
  "batch_id": "batch_456",
  "proof_commitment": "0x...",
  "created_at": 1711000000,
  "confirmed_at": 1711000030,
  "error_message": null,
  "explorer_url": "https://sepolia.starkscan.co/tx/0x..."
}
```

**Polling Strategy** (frontend):

- Poll every 2-5 seconds
- Continue until status = "confirmed" or status = "failed"
- Display explorer URL when confirmed

---

#### 7. Transaction History

**GET /api/v2/users/{user_id}/transactions**

Get paginated transaction history.

```bash
curl -X GET "http://localhost:8000/api/v2/users/user_abc123/transactions?limit=20&offset=0" \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "total": 42,
  "limit": 20,
  "offset": 0,
  "transactions": [
    {
      "tx_id": "tx_001",
      "to_address": "0x...",
      "amount_strk": "1.5",
      "status": "confirmed",
      "created_at": 1711000030
    },
    ...
  ]
}
```

**Sorting**: By `created_at DESC` (newest first)

---

#### 8. Merkle Batches

**GET /api/v2/batches**

List all Merkle batches.

```bash
curl -X GET http://localhost:8000/api/v2/batches?limit=50 \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "batches": [
    {
      "batch_id": "batch_456",
      "merkle_root": "0x...",
      "status": "pending | finalized | submitted",
      "tx_count": 10,
      "created_at": 1711000000,
      "finalized_at": 1711000010,
      "tx_hash": "0x..." // on-chain hash
    },
    ...
  ]
}
```

---

#### 9. Batch Detail

**GET /api/v2/batches/{batch_id}**

Get batch and all leaves (transactions).

```bash
curl -X GET http://localhost:8000/api/v2/batches/batch_456 \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "batch_id": "batch_456",
  "merkle_root": "0xabcd...",
  "status": "finalized",
  "tx_count": 10,
  "leaves": [
    {
      "leaf_id": "leaf_001",
      "tx_id": "tx_123",
      "leaf_index": 0,
      "proof_commitment": "0x...",
      "proof_path": ["0x...", "0x...", ...]
    },
    ...
  ]
}
```

---

#### 10. Merkle Proof

**GET /api/v2/proof/{tx_id}**

Get Merkle proof for transaction verification.

```bash
curl -X GET http://localhost:8000/api/v2/proof/tx_123 \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "tx_id": "tx_123",
  "batch_id": "batch_456",
  "leaf_index": 0,
  "proof_commitment": "0xabc...",
  "proof_path": [
    "0xsib1...",
    "0xsib2...",
    "0xsib3..."
  ]
}
```

**Use Case**: User can independently verify their transaction is in batch.

---

#### 11. Force Finalize Batch

**POST /api/v2/batches/force-finalize**

Finalize current pending batch immediately (no wait).

```bash
curl -X POST http://localhost:8000/api/v2/batches/force-finalize \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "status": "finalized | no_pending_transactions",
  "batch_id": "batch_456"
}
```

---

#### 12. Audit Log

**GET /api/v2/audit/{user_id}**

Get immutable audit trail for user.

```bash
curl -X GET "http://localhost:8000/api/v2/audit/user_abc123?limit=100&offset=0" \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "user_id": "user_abc123",
  "audit_logs": [
    {
      "log_id": "log_001",
      "action": "USER_REGISTERED | TRANSFER_INITIATED | ACCOUNT_DEPLOYED",
      "entity_type": "USER | TRANSACTION | ACCOUNT",
      "entity_data": {...},
      "timestamp": 1711000000,
      "entry_hash": "0xsha256..."
    },
    ...
  ]
}
```

---

#### 13. Audit Chain Verification

**GET /api/v2/audit/verify-chain**

Verify hash chain integrity (tamper detection).

```bash
curl -X GET http://localhost:8000/api/v2/audit/verify-chain \
  -H "Authorization: Bearer qg_org_abc123..."

Response (200):
{
  "valid": true | false,
  "count": 42,
  "message": "Chain integrity verified | Chain broken at entry 5",
  "error_at": null | 5
}
```

---

#### 14. Health Check

**GET /api/v2/health**

Check backend and dependencies status.

```bash
curl -X GET http://localhost:8000/api/v2/health

Response (200):
{
  "status": "ok | degraded",
  "database": "connected | disconnected",
  "starknet_rpc": "https://...",
  "prover": "connected | degraded | disconnected",
  "prover_ready": true | false,
  "prover_mode": "rust_http | python_fallback",
  "prover_endpoint": "http://localhost:8001"
}
```

---

## DATABASE SCHEMA

### Tables Overview

```sql
-- Multi-tenancy
CREATE TABLE organizations (
    org_id TEXT PRIMARY KEY,
    org_name VARCHAR(255),
    api_key VARCHAR(255) UNIQUE NOT NULL,
    admin_email VARCHAR(255),
    created_at REAL
);

-- Users
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(org_id),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(255),
    ip_address TEXT,
    created_at REAL
);

-- Wallets (1:1 per user)
CREATE TABLE wallets (
    wallet_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(user_id),
    wallet_name VARCHAR(255),
    status VARCHAR(50),
    created_at REAL
);

-- Accounts (smart contract accounts)
CREATE TABLE accounts (
    account_id TEXT PRIMARY KEY,
    wallet_id TEXT REFERENCES wallets(wallet_id),
    account_address TEXT UNIQUE,  -- Counterfactual address
    public_key_pq BYTEA,          -- ML-DSA-44 public key
    public_key_pq_hash TEXT,      -- SHA-256(public_key)
    encrypted_secret_key BYTEA,   -- AES-256-GCM ciphertext
    encrypted_secret_nonce BYTEA, -- 12-byte nonce
    encrypted_secret_tag BYTEA,   -- GCM auth tag
    nonce BIGINT DEFAULT 0,       -- Replay protection
    balance_wei TEXT DEFAULT '0', -- On-chain balance
    deployment_status TEXT,       -- counterfactual | pending | deployed | failed
    deployment_tx_hash TEXT,      -- Starknet tx that deployed account
    deployment_attempts INT DEFAULT 0,
    last_deployment_attempt REAL,
    deployed_at REAL,
    deployment_error_message TEXT,
    sender_model TEXT DEFAULT 'relayer',  -- relayer | user_account
    submitter_address TEXT,       -- If user_account: submitter's address
    submitter_account_config TEXT, -- Account config JSON
    submitter_private_key_encrypted BYTEA,  -- Optional user-provided key
    created_at REAL,
    updated_at REAL
);

-- Keys (with rotation)
CREATE TABLE keys (
    key_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(user_id),
    org_id TEXT REFERENCES organizations(org_id),
    key_version INT,
    public_key_pq BYTEA,
    public_key_pq_hash TEXT,
    encrypted_secret_key BYTEA,
    encrypted_secret_nonce BYTEA,
    encrypted_secret_tag BYTEA,
    seed_phrase TEXT,              -- BIP-39 mnemonic
    status VARCHAR(50) DEFAULT 'active',  -- active | retired
    created_at REAL
);

-- Transactions
CREATE TABLE transactions (
    tx_id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(account_id),
    batch_id TEXT,  -- REFERENCES merkle_batches(batch_id)
    to_address TEXT,
    amount_wei TEXT,
    proof_commitment TEXT,
    status TEXT,  -- signed | batched | submitted | pending | confirmed | failed
    tx_hash TEXT,  -- Starknet transaction hash
    starknet_status TEXT,  -- pending | confirmed | rejected | failed
    error_message TEXT,
    created_at REAL,
    confirmed_at REAL,
    updated_at REAL
);

-- Merkle batches
CREATE TABLE merkle_batches (
    batch_id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(org_id),
    merkle_root TEXT,
    status TEXT,  -- pending | finalized | submitted
    tx_count INT DEFAULT 0,
    tx_hash TEXT,  -- Starknet tx that submitted batch
    created_at REAL,
    finalized_at REAL,
    submitted_at REAL
);

-- Merkle batch leaves
CREATE TABLE merkle_batch_leaves (
    leaf_id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES merkle_batches(batch_id),
    tx_id TEXT REFERENCES transactions(tx_id),
    leaf_index INT,
    proof_commitment TEXT,
    proof_path TEXT  -- JSON array of sibling hashes
);

-- Audit logs (immutable)
CREATE TABLE audit_logs (
    log_id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(org_id),
    user_id TEXT REFERENCES users(user_id),
    action TEXT,  -- USER_REGISTERED | TRANSFER_INITIATED | ...
    entity_type TEXT,  -- USER | TRANSACTION | ACCOUNT | ...
    entity_data TEXT,  -- JSON
    prev_hash TEXT,  -- Hash of previous entry (for chain)
    entry_hash TEXT,  -- SHA-256 hash of this entry
    created_at REAL,
    PRIMARY KEY (org_id, log_id)
);
```

### Indexes for Performance

```sql
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_accounts_wallet_id ON accounts(wallet_id);
CREATE INDEX idx_accounts_address ON accounts(account_address);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_batch_id ON transactions(batch_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_merkle_batches_org_id ON merkle_batches(org_id);
CREATE INDEX idx_merkle_batches_status ON merkle_batches(status);
CREATE INDEX idx_merkle_leaves_batch_id ON merkle_batch_leaves(batch_id);
CREATE INDEX idx_merkle_leaves_tx_id ON merkle_batch_leaves(tx_id);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## CONFIGURATION & ENVIRONMENT

### Environment Variables

```bash
# API Server
API_HOST=0.0.0.0
API_PORT=8000

# Environment
ENV=development | production
LOG_LEVEL=INFO | DEBUG | WARNING | ERROR

# Database (v2)
DATABASE_URL=postgresql://user:pass@localhost:5432/quantumguard
# OR
DATABASE_URL=sqlite:///path/to/quantumguard_v2.db

# Starknet
STARKNET_RPC=https://free-rpc.nethermind.io/sepolia-juno/v0_7
STARKNET_CHAIN_ID=SN_SEPOLIA
STARKNET_PRIVATE_KEY=0x...
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_ACCOUNT_CONFIG=/path/to/account-sepolia.json

# Smart Contract Addresses
QUANTUM_ACCOUNT_CONTRACT_ADDRESS=0x...
ACCOUNT_FACTORY_ADDRESS=0x...

# Wallet Deployment
AUTO_DEPLOY_WALLET_ON_REGISTER=true | false
WALLET_DEPLOY_COMMAND="starkli invoke {account_address} deploy_account {public_key_hash_felt} ..."
WALLET_DEPLOY_TIMEOUT_SECONDS=90

# ZK Prover
PROVER_URL=http://localhost:8001
# OR
PROVER_HOST=127.0.0.1
PROVER_PORT=8001

# Security
QUANTUMGUARD_MASTER_SECRET=<64-char hex string for AES master key>
BOOTSTRAP_SECRET=<unique secret for org bootstrap>

# CORS
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://yourfrontend.com

# Rate Limiting (optional)
RATE_LIMIT_RPM=60

# Storage
MERKLE_STORAGE_DIR=/data/merkle_batches

# Fallback Options
ALLOW_INSECURE_PQC_FALLBACK=0  # Use Python fallback if liboqs unavailable
```

### Production Configuration

```bash
# .env.production
ENV=production
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=WARNING

# Database: Use managed PostgreSQL (RDS, Supabase, Neon)
DATABASE_URL=postgresql://prod_user:STRONG_PASSWORD@prod.db.amazonaws.com:5432/quantumguard

# Starknet Mainnet (after audit)
STARKNET_RPC=https://starknet-mainnet.public.blastapi.io
STARKNET_CHAIN_ID=SN_MAIN

# Put secrets in environment (not .env file)
# Use AWS Secrets Manager / Azure Key Vault / HashiCorp Vault
QUANTUMGUARD_MASTER_SECRET=$(aws secretsmanager get-secret-value --secret-id qg-master-key)
BOOTSTRAP_SECRET=$(aws secretsmanager get-secret-value --secret-id qg-bootstrap-secret)

# CORS: Only your domain(s)
CORS_ORIGINS=https://app.yourbank.com

# Auto-deploy: Disable until ready
AUTO_DEPLOY_WALLET_ON_REGISTER=false

# Prover: Run as separate scaled service
PROVER_URL=http://prover-service.internal:8001
```

---

## SECURITY IMPLEMENTATION

### Key Encryption (AES-256-GCM)

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

def encrypt_private_key(private_key: bytes, master_key: bytes) -> tuple:
    """Encrypt private key with AES-256-GCM."""
    nonce = os.urandom(12)  # 96-bit for GCM
    cipher = AESGCM(master_key)
    ciphertext = cipher.encrypt(nonce, private_key, associated_data=None)
    # GCM appends 16-byte tag to ciphertext
    return ciphertext, nonce

def decrypt_private_key(ciphertext: bytes, nonce: bytes, master_key: bytes) -> bytes:
    """Decrypt private key."""
    cipher = AESGCM(master_key)
    plaintext = cipher.decrypt(nonce, ciphertext, associated_data=None)
    return plaintext
```

**Why AES-256-GCM?**

- 256-bit key space (quantum-resistant size)
- Authenticated encryption (detects tampering)
- Nonce prevents replay attacks
- Industry standard (NIST approved)

### Master Key Management

**Development** (current):

```python
def _get_master_key() -> bytes:
    """Derive master key from environment variable."""
    secret = os.environ.get('QUANTUMGUARD_MASTER_SECRET', 'dev-insecure')
    master_key = PBKDF2(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'quantumguard-salt',  # Static for env-based key
        iterations=100000,
    ).derive(secret.encode())
    return master_key
```

**Production** (recommended):

```python
def _get_master_key_from_hsm() -> bytes:
    """Fetch master key from HSM via AWS/Azure/Vault."""
    # Option 1: AWS CloudHSM
    import boto3
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId='qg-master-key')
    return bytes.fromhex(response['SecretString'])

    # Option 2: Azure Key Vault
    from azure.keyvault.secrets import SecretClient
    client = SecretClient(vault_url=vault_url, credential=credential)
    secret = client.get_secret('quantumguard-master-key')
    return bytes.fromhex(secret.value)

    # Option 3: HashiCorp Vault
    import hvac
    client = hvac.Client(url=vault_url, token=token)
    response = client.secrets.kv.read_secret_version(path='qg/master-key')
    return bytes.fromhex(response['data']['data']['key'])
```

### API Authentication

```python
async def _get_org_id(authorization: str = Header(...)) -> str:
    """Extract and validate organization ID from Bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid Authorization header")

    api_key = authorization[7:]

    # Lookup API key in database
    async with get_db() as conn:
        org = await conn.fetchrow(
            "SELECT org_id FROM organizations WHERE api_key = $1",
            api_key
        )

    if not org:
        raise HTTPException(401, "Invalid API key")

    return org['org_id']
```

**Best Practices**:

- Store API keys hashed (bcrypt, argon2) in database
- Rotate keys periodically
- Log all API calls (audit trail)
- Use HTTPS/TLS for transport

### Data Validation (Pydantic)

```python
from pydantic import BaseModel, Field, EmailStr, constr

class UserCreate(BaseModel):
    email: EmailStr  # Valid email format + length checks
    username: constr(min_length=1, max_length=255)  # String with length bounds

class TransferBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    to_address: str = Field(..., min_length=3)  # Address format checked
    amount_strk: float = Field(..., gt=0)  # Amount > 0
```

**Validation Layers**:

1. Pydantic schema validation (type + format)
2. Business logic validation (balance check, account deployed, etc.)
3. Database constraints (uniqueness, foreign keys)

---

## ERROR HANDLING

### Error Response Format

**Validation Error**:

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "amount_strk"],
      "msg": "ensure this value is greater than 0",
      "input": -5
    }
  ]
}
```

**Business Logic Error**:

```json
{
  "detail": "User not found"
}
```

**Internal Error**:

```json
{
  "detail": "Internal server error"
}
```

### Error Handling in Routes

```python
try:
    result = await _wallet_svc.register_user(...)
    return result
except ValueError as e:
    raise HTTPException(400, str(e))  # Bad request
except RuntimeError as e:
    logger.error(f"Runtime error: {e}")
    raise HTTPException(500, "Internal error")  # Server error
except Exception as e:
    logger.exception(f"Unexpected error: {e}")
    raise HTTPException(500, "Internal error")
```

### Frontend Error Handling

```javascript
// api/client.js
async function extractErrorMessage(err) {
  const detail = err.response?.data?.detail;

  if (!detail) {
    return err.message || "Unknown error";
  }

  // Pydantic validation error: detail is array
  if (Array.isArray(detail)) {
    return detail.map((e) => e.msg).join("; ");
  }

  // Simple error: detail is string
  if (typeof detail === "string") {
    return detail;
  }

  return JSON.stringify(detail);
}

// Usage in components
try {
  await api.transfer(userID, toAddress, amount);
} catch (err) {
  const message = extractErrorMessage(err);
  setError(message);
  // Display to user
}
```

---

## TESTING STRATEGY

### Test Categories

#### 1. Unit Tests

**KeyService**:

```python
@pytest.mark.asyncio
async def test_gen_keypair():
    key_svc = KeyService()
    result = await key_svc.gen_keypair(conn, user_id, org_id)

    assert 'public_key' in result
    assert 'encrypted_secret' in result
    assert 'seed_phrase' in result
    assert len(result['seed_phrase'].split()) == 24
```

**MerkleService**:

```python
def test_merkle_tree_construction():
    service = MerkleService()
    leaves = [hash(tx1), hash(tx2), hash(tx3), hash(tx4)]
    root = service.compute_root(leaves)

    # Verify root
    assert len(root) == 64  # SHA-256 hex string

    # Verify proof path
    proof = service.compute_proof_path(leaves, index=0)
    assert len(proof) == 2  # log2(4) = 2 siblings
```

#### 2. Integration Tests

**Full Transfer Flow**:

```python
@pytest.mark.asyncio
async def test_transfer_full_flow():
    # 1. Register user
    user = await register_user(conn, org_id, email, username)

    # 2. Deploy account
    await deploy_account(conn, user['account_id'])

    # 3. Fund wallet (via minter contract, faucet, etc.)
    await fund_account(user['contract_address'], 100 * 10**18)  # 100 STRK

    # 4. Execute transfer
    result = await _tx_svc.execute_transfer(
        conn, user_id, org_id, to_address, 50.0
    )

    assert result['status'] == 'batched'
    assert 'tx_id' in result

    # 5. Poll until confirmed
    for attempt in range(60):  # 5 min timeout
        tx = await _tx_svc.get_transaction(conn, result['tx_id'])
        if tx['status'] == 'confirmed':
            break
        await asyncio.sleep(5)

    assert tx['status'] == 'confirmed'
```

#### 3. Smoke Tests

**Transfer Flow Script** (`smoke_transfer_v2.sh`):

```bash
#!/bin/bash

# Setup
API_URL="http://localhost:8000"
API_KEY="qg_org_abc123"

# 1. Create org
ORG=$(curl -s -X POST $API_URL/api/v2/org/create \
  -d '{...}' | jq -r '.api_key')

# 2. Register user
USER=$(curl -s -X POST $API_URL/api/v2/users/register \
  -H "Authorization: Bearer $ORG" \
  -d '{...}' | jq -r '.user_id')

# 3. Check balance
BALANCE=$(curl -s -X GET $API_URL/api/v2/users/$USER/wallet \
  -H "Authorization: Bearer $ORG" | jq -r '.balance_strk')

echo "✓ User $USER registered with balance $BALANCE STRK"

# 4. Transfer
TX=$(curl -s -X POST $API_URL/api/v2/transactions/transfer \
  -H "Authorization: Bearer $ORG" \
  -d '{...}' | jq -r '.tx_id')

echo "✓ Transfer $TX submitted"

# 5. Poll until confirmed
for i in {1..60}; do
  STATUS=$(curl -s -X GET $API_URL/api/v2/transactions/$TX \
    -H "Authorization: Bearer $ORG" | jq -r '.status')
  if [ "$STATUS" = "confirmed" ]; then
    echo "✓ Transfer confirmed!"
    exit 0
  fi
  sleep 5
done

echo "✗ Transfer not confirmed in time"
exit 1
```

---

## DEPLOYMENT & SCALING

### Docker Deployment

**Dockerfile**:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libssl-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY pqc_backend ./pqc_backend
COPY .env.docker .env

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/v2/health || exit 1

# Run
CMD ["python", "-m", "uvicorn", \
     "pqc_backend.v2.app:app", \
     "--host", "0.0.0.0", \
     "--port", "8000"]
```

**docker-compose.yml**:

```yaml
version: "3.9"

services:
  quantum-guard-backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://quantumguard:secret@postgres:5432/quantumguard
      STARKNET_RPC: https://...
      PROVER_URL: http://prover:8001
    depends_on:
      - postgres
      - prover
    volumes:
      - .env:/app/.env

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: quantumguard
      POSTGRES_USER: quantumguard
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  prover:
    image: quantum-prover:latest
    ports:
      - "8001:8001"
    command: ["serve", "--port", "8001"]

volumes:
  postgres_data:
```

### Scaling Considerations

**Horizontal Scaling**:

```
Load Balancer (Nginx/HAProxy)
  ├─ API Instance 1 (port 8000)
  ├─ API Instance 2 (port 8000)
  ├─ API Instance 3 (port 8000)
  └─ ...
     ↓
Shared PostgreSQL (RDS, managed)
  ├─ Connection pool: 20-100 connections per instance
  └─ Read replicas for read-heavy queries
```

**Prover Scaling**:

```
Prover Load Balancer
  ├─ Prover 1 (port 8001)
  ├─ Prover 2 (port 8001)
  └─ ...

Backend calls: POST /<prover>/verify
  (round-robin via load balancer)
```

**Database Optimization**:

```sql
-- Sharding by user_id or org_id
-- Partition large tables (transactions, audit_logs) by time range
-- Use read replicas for /api/v2/health, balance queries

CREATE TABLE transactions_2024_q1 PARTITION OF transactions
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
```

---

## TROUBLESHOOTING

### Common Issues

#### 1. "liboqs not found"

```bash
# Error: ImportError: liboss.so.0: cannot open shared object file

# Solution: Build liboqs locally
cd ../liboqs/build
cmake -GNinja -DBUILD_SHARED_LIBS=ON ..
ninja

# Update LD_LIBRARY_PATH
export LD_LIBRARY_PATH=/...liboqs/build/lib:$LD_LIBRARY_PATH
```

#### 2. "Prover connection refused"

```bash
# Error: ConnectionRefusedError: [Errno 111] Connection refused to 127.0.0.1:8001

# Solution:
# 1. Check prover is running: ps aux | grep prover
# 2. Check port is open: netstat -tlnp | grep 8001
# 3. Check PROVER_URL env var is set correctly
# 4. Prover fallback will engage (slower)
```

#### 3. "Invalid API key"

```bash
# Error: HTTPException(401, "Invalid API key")

# Solution:
# 1. Check header: Authorization: Bearer <KEY>
# 2. Verify key exists in DB: SELECT * FROM organizations WHERE api_key = '...'
# 3. Bootstrap org if missing: POST /api/v2/org/create
```

#### 4. "Account not deployed"

```bash
# Error: ValueError: Account deployment status is 'counterfactual'

# Solution:
# 1. Deploy account: POST /api/v2/users/{user_id}/deployment/retry
# 2. Or enable auto-deploy: AUTO_DEPLOY_WALLET_ON_REGISTER=true
# 3. Check deployment status: GET /api/v2/users/{user_id}/deployment-status
```

#### 5. "Signature verification failed"

```bash
# Error: ValueError: Signature verification failed in prover

# Debugging:
# 1. Check message encoding (to_address, amount, nonce)
# 2. Verify private key decryption
# 3. Test Rust prover separately:
#    echo '{"public_key":"...", "signature":"...", "message":"..."}' | prover verify
```

#### 6. "Insufficient balance"

```bash
# Error: ValueError: Account balance < transfer amount

# Solution:
# 1. Fund account: Add STRK tokens to contract_address
# 2. Check balance: GET /api/v2/users/{user_id}/wallet (balance_strk field)
# 3. Use faucet: https://starknet-faucet.vercel.app/
```

---

**End of Module 1 Report**

_For Modules 2-4 detailed reports, see accompanying document._
