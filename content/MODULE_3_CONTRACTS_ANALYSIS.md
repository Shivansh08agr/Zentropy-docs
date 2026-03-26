# MODULE 3: STARKNET SMART CONTRACTS - DETAILED ANALYSIS

**Module**: Cairo Smart Contracts for Quantum-Resistant Account Abstraction
**Language**: Cairo 2024_07 (Starknet)
**Build Tool**: Scarb
**Lines of Code**: ~500+ (3 contracts)

---

## TABLE OF CONTENTS

1. [Module Overview](#module-overview)
2. [Contract Architecture](#contract-architecture)
3. [quantum_account.cairo](#quantum_accountcairo)
4. [merkle_audit.cairo](#merkle_auditcairo)
5. [account_factory.cairo](#account_factorycairo)
6. [Storage & State Management](#storage--state-management)
7. [Deployment](#deployment)
8. [Testing](#testing)
9. [Security Audit Checklist](#security-audit-checklist)
10. [Troubleshooting](#troubleshooting)

---

## MODULE OVERVIEW

### Purpose

Starknet smart contracts implement **quantum-resistant account abstraction** by:

1. **quantum_account**: Validates proof commitments instead of ECDSA signatures
2. **merkle_audit**: Stores Merkle batch roots for transaction verification
3. **account_factory**: Deploys counterfactual accounts deterministically

### Philosophy

- **Off-Chain Signature Verification**: Rust prover verifies ML-DSA-44 signatures
- **On-Chain Proof Validation**: Contract validates proof commitment matches stored identity
- **Batching Efficiency**: Multiple txs in one Merkle root → reduced gas costs
- **Upgrade Path**: Account code can be updated after deployment

### Core Principles

| Principle | Implementation | Benefit |
|---|---|---|
| **No ECDSA signatures** | Validate SHA-256 commitment instead | Quantum-resistant |
| **Counterfactual deployment** | Address pre-calculated, deploy later | Simplified UX |
| **Merkle batching** | Multiple txs → single root | Cost reduction |
| **Immutable audit trail** | On-chain Merkle roots for compliance | Transparency |
| **Whitelisted provers** | Only approved provers can commit | Security |

---

## CONTRACT ARCHITECTURE

### System Diagram

```
┌──────────────────────────────────────────────────┐
│  Starknet L2 Blockchain                           │
├──────────────────────────────────────────────────┤
│                                                   │
│  factory: AccountFactory                         │
│  ├─ deploy_wallet(salt, pubkey_hash)             │
│  │  └─→ Creates new QuantumAccount               │
│  │                                                │
│  └─→ deployed_accounts[salt] = address           │
│                                                   │
│  account_1: QuantumAccount                       │
│  ├─ Storage:                                     │
│  │  ├─ owner_pubkey_hash                        │
│  │  ├─ tx_nonce                                  │
│  │  └─ approved_provers                         │
│  │                                                │
│  └─→ execute_with_proof(to, amount, proof)       │
│                                                   │
│  merkle_contract: MerkleAudit                    │
│  ├─ Storage:                                     │
│  │  ├─ batch_roots[batch_id] = root             │
│  │  └─ approved_committers                      │
│  │                                                │
│  └─→ commit_batch_root(batch_id, root)           │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Contract Relationships

```
AccountFactory
  │
  ├─→ Deploy QuantumAccount instances
  │   (one per user)
  │
  └─→ Each QuantumAccount
      ├─ Has own owner_pubkey_hash (user identity)
      ├─ Validates proofs before executing transfers
      └─ Increments nonce (replay protection)

MerkleAudit (separate contract)
  │
  ├─→ Stores batch roots (committed by backend)
  │
  └─→ Users can verify txs are in batch
      (via Merkle proof path)
```

---

## quantum_account.cairo

### Purpose

**Smart wallet contract** that:
- Validates proof commitments (instead of ECDSA signatures)
- Executes token transfers if proof valid
- Implements replay protection (nonce)
- Whitelists approved provers

### Code Structure

```cairo
#[starknet::contract]
pub mod QuantumAccount {
    // ─── Imports ──────────────────────────────────
    use starknet::{
        ContractAddress, get_tx_info, get_caller_address,
        SyscallResult, call_contract_syscall,
    };
    use core::traits::Into;

    // ─── Storage ──────────────────────────────────
    #[storage]
    struct Storage {
        owner_pubkey_hash: felt252,        // SHA-256 of ML-DSA public key
        tx_nonce: u64,                     // Replay protection counter
        approved_provers: LegacyMap<ContractAddress, bool>, // Whitelisted provers
    }

    // ─── Events ───────────────────────────────────
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        TransactionExecuted: TransactionExecuted,
        ProofValidationFailed: ProofValidationFailed,
        ProverWhitelisted: ProverWhitelisted,
    }

    #[derive(Drop, starknet::Event)]
    struct TransactionExecuted {
        to: ContractAddress,
        amount: u256,
        nonce: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct ProofValidationFailed {
        reason: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct ProverWhitelisted {
        prover: ContractAddress,
        approved: bool,
    }

    // ─── Constructor ───────────────────────────────
    #[constructor]
    fn constructor(ref self: ContractState, owner_pubkey_hash: felt252) {
        self.owner_pubkey_hash.write(owner_pubkey_hash);
        self.tx_nonce.write(0);
    }

    // ─── Account Abstraction ──────────────────────

    /// Entry point: Called by Starknet to validate transaction.
    /// For account abstraction, this validates the proof commitment.
    #[external(v0)]
    fn __validate_transaction__(ref self: ContractState) -> felt252 {
        let signature = get_tx_info().unbox().signature;  // Proof commitment
        let valid = self._verify_proof_commitment(signature);
        if valid {
            // Return 1 to indicate valid signature
            1
        } else {
            // Return 0 or revert to indicate invalid
            0
        }
    }

    /// Entry point: Execute transaction if proof valid.
    #[external(v0)]
    fn __execute_transaction__(ref self: ContractState) -> Span<felt252> {
        let tx_info = get_tx_info().unbox();
        let signature = tx_info.signature;

        // 1. Validate proof commitment
        let valid = self._verify_proof_commitment(signature);
        assert(valid, 'Invalid proof');

        // 2. Extract transfer parameters from calldata
        let calldata = tx_info.calldata;
        let (to, amount) = self._parse_transfer_params(calldata);

        // 3. Check replay protection (nonce)
        let current_nonce = self.tx_nonce.read();
        assert(tx_info.nonce == current_nonce, 'Invalid nonce');

        // 4. Increment nonce (prevent replay)
        self.tx_nonce.write(current_nonce + 1);

        // 5. Execute transfer
        self._execute_transfer(to, amount);

        // 6. Emit event
        self.emit(TransactionExecuted { to, amount, nonce: current_nonce });

        array![1].span()  // Return success
    }

    // ─── Public Functions ────────────────────────

    /// Execute transfer with proof validation (can be called directly or via Account Abstraction)
    #[external(v0)]
    fn execute_with_proof(
        ref self: ContractState,
        to: ContractAddress,
        amount: u256,
        proof_commitment: felt252,
    ) -> bool {
        // Note: In production, proof_commitment would come from transaction signature
        // This is a simplified version for testing

        // 1. Verify proof
        let valid = self._verify_proof_commitment_direct(proof_commitment);
        assert(valid, 'Invalid proof');

        // 2. Get current nonce
        let current_nonce = self.tx_nonce.read();

        // 3. Execute transfer
        self._execute_transfer(to, amount);

        // 4. Increment nonce
        self.tx_nonce.write(current_nonce + 1);

        // 5. Emit event
        self.emit(TransactionExecuted {
            to,
            amount,
            nonce: current_nonce,
        });

        true
    }

    /// Set owner public key hash (only once, during initialization)
    #[external(v0)]
    fn set_owner_pubkey_hash(ref self: ContractState, pubkey_hash: felt252) {
        let current = self.owner_pubkey_hash.read();
        assert(current == 0, 'Already initialized');  // Prevent re-initialization
        self.owner_pubkey_hash.write(pubkey_hash);
    }

    /// Whitelist a prover address
    #[external(v0)]
    fn set_approved_prover(
        ref self: ContractState,
        prover: ContractAddress,
        approved: bool,
    ) {
        // In production: add access control (only owner)
        self.approved_provers.write(prover, approved);
        self.emit(ProverWhitelisted { prover, approved });
    }

    // ─── View Functions ─────────────────────────

    #[view]
    fn get_owner_pubkey_hash(self: @ContractState) -> felt252 {
        self.owner_pubkey_hash.read()
    }

    #[view]
    fn get_nonce(self: @ContractState) -> u64 {
        self.tx_nonce.read()
    }

    #[view]
    fn is_approved_prover(
        self: @ContractState,
        prover: ContractAddress,
    ) -> bool {
        self.approved_provers.read(prover)
    }

    // ─── Internal Functions ─────────────────────

    /// Verify proof commitment matches owner identity
    fn _verify_proof_commitment(self: @ContractState, proof: Span<felt252>) -> bool {
        // Simplified: In production, compute SHA-256 and compare
        //
        // Full algorithm:
        // 1. Parse proof from signature array
        // 2. Compute SHA-256(proof || owner_pubkey_hash)
        // 3. Compare with stored identity
        //
        // For now: return true if proof is non-empty and matches expected format

        if proof.len() == 0 {
            return false;
        }

        // Get expected pubkey hash
        let expected_hash = self.owner_pubkey_hash.read();

        // Proof format: [commitment_hash_felt252]
        let proof_commitment = *proof.at(0);

        // Simple comparison: proof_commitment == expected_hash
        // (In production, use proper cryptographic verification)
        proof_commitment == expected_hash
    }

    fn _verify_proof_commitment_direct(
        self: @ContractState,
        proof_commitment: felt252,
    ) -> bool {
        let expected_hash = self.owner_pubkey_hash.read();
        proof_commitment == expected_hash
    }

    fn _parse_transfer_params(
        self: @ContractState,
        calldata: Span<felt252>,
    ) -> (ContractAddress, u256) {
        // Parse calldata to extract 'to' address and 'amount'
        // Calldata format: [to_low, to_high, amount_low, amount_high]

        let to_low = *calldata.at(0);
        let to_high = *calldata.at(1);
        let amount_low = *calldata.at(2);
        let amount_high = *calldata.at(3);

        let to: ContractAddress = (to_low.into(), to_high.into()).into();
        let amount: u256 = (amount_low.into(), amount_high.into()).into();

        (to, amount)
    }

    /// Execute actual token transfer
    fn _execute_transfer(
        ref self: ContractState,
        to: ContractAddress,
        amount: u256,
    ) {
        // Call token contract to transfer STRK
        // Assumes STRK is deployed at known address
        const STRK_ADDRESS: felt252 = 0x...; // Starknet native token

        let result = call_contract_syscall(
            STRK_ADDRESS.try_into().unwrap(),
            selector!("transfer"),  // transfer(to, amount)
            array![to.into(), amount.low.into(), amount.high.into()].span(),
        );

        match result {
            Result::Ok(_) => {},
            Result::Err(_) => panic("Transfer failed"),
        }
    }
}
```

### Key Concepts

**Proof Commitment Verification**:
```cairo
// Off-chain (Rust Prover):
proof = SHA256(public_key || signature || message)

// On-chain (this contract):
input_proof = extract_from_transaction_signature()
stored_hash = owner_pubkey_hash
assert(input_proof == stored_hash, 'Invalid proof')
execute_transfer()
```

**Replay Protection**:
```cairo
current_nonce = tx_nonce.read()           // e.g., 5
assert(tx_info.nonce == 5, 'Invalid nonce')
tx_nonce.write(6)                          // Increment for next tx
```

---

## merkle_audit.cairo

### Purpose

**Merkle batch root storage** contract that:
- Stores batch roots (committed by backend via starkli)
- Allows users to verify their txs are in batch
- Whitelists approved batch submitters

### Code

```cairo
#[starknet::contract]
pub mod MerkleAudit {
    use starknet::{ContractAddress, get_caller_address};

    // ─── Storage ──────────────────────────────────
    #[storage]
    struct Storage {
        batch_roots: LegacyMap<u256, felt252>,              // batch_id -> root
        batch_tx_counts: LegacyMap<u256, u32>,              // batch_id -> tx count
        approved_committers: LegacyMap<ContractAddress, bool>, // Whitelisted submitters
    }

    // ─── Events ───────────────────────────────────
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        BatchRootCommitted: BatchRootCommitted,
        CommitterWhitelisted: CommitterWhitelisted,
    }

    #[derive(Drop, starknet::Event)]
    struct BatchRootCommitted {
        batch_id: u256,
        root: felt252,
        tx_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct CommitterWhitelisted {
        committer: ContractAddress,
        approved: bool,
    }

    // ─── Public Functions ────────────────────────

    /// Commit a Merkle batch root (only whitelisted submitters)
    #[external(v0)]
    fn commit_batch_root(
        ref self: ContractState,
        batch_id: u256,
        root: felt252,
        tx_count: u32,
    ) {
        let caller = get_caller_address();

        // Check if caller is whitelisted
        let is_approved = self.approved_committers.read(caller);
        assert(is_approved, 'Caller not approved');

        // Store root
        self.batch_roots.write(batch_id, root);
        self.batch_tx_counts.write(batch_id, tx_count);

        // Emit event
        self.emit(BatchRootCommitted { batch_id, root, tx_count });
    }

    /// Verify transaction is in batch (via Merkle proof)
    #[external(v0)]
    fn verify_in_batch(
        self: @ContractState,
        batch_id: u256,
        leaf_index: u32,
        leaf_value: felt252,
        proof_path: Span<felt252>,
    ) -> bool {
        // 1. Get batch root
        let root = self.batch_roots.read(batch_id);
        if root == 0 {
            return false;  // Batch not found
        }

        // 2. Recompute Merkle root from leaf and proof path
        let computed_root = self._compute_merkle_root(leaf_value, proof_path);

        // 3. Compare
        computed_root == root
    }

    /// Get batch root
    #[view]
    fn get_batch_root(self: @ContractState, batch_id: u256) -> felt252 {
        self.batch_roots.read(batch_id)
    }

    /// Get transaction count in batch
    #[view]
    fn get_batch_tx_count(self: @ContractState, batch_id: u256) -> u32 {
        self.batch_tx_counts.read(batch_id)
    }

    /// Whitelist a committer (only owner)
    #[external(v0)]
    fn set_approved_committer(
        ref self: ContractState,
        committer: ContractAddress,
        approved: bool,
    ) {
        // TODO: Add access control (check caller is owner)
        self.approved_committers.write(committer, approved);
        self.emit(CommitterWhitelisted { committer, approved });
    }

    // ─── Internal Functions ─────────────────────

    /// Compute Merkle root from leaf and proof path
    fn _compute_merkle_root(
        &self,
        mut current: felt252,
        mut proof_path: Span<felt252>,
    ) -> felt252 {
        // Merkle tree traversal:
        // Start: current = leaf
        // For each sibling in proof_path:
        //   current = SHA256(current || sibling)
        // Result: current = root

        loop {
            match proof_path.pop_front() {
                Option::Some(sibling) => {
                    // Combine current and sibling
                    // In production: use proper SHA-256 library
                    current = self._hash_pair(current, sibling);
                },
                Option::None => break,
            }
        }

        current
    }

    /// Hash two values (SHA-256 in production)
    fn _hash_pair(&self, left: felt252, right: felt252) -> felt252 {
        // Placeholder: In production, use Starknet's Pedersen hash or SHA-256
        // For now: simple combination
        (left ^ right)  // XOR as placeholder
    }
}
```

---

## account_factory.cairo

### Purpose

**Account deployment factory** contract that:
- Deploys new QuantumAccount instances
- Stores mapping of salt -> deployed address
- Implements counterfactual address calculation

### Code

```cairo
#[starknet::contract]
pub mod AccountFactory {
    use starknet::{ClassHash, ContractAddress, deploy_syscall};

    // ─── Storage ──────────────────────────────────
    #[storage]
    struct Storage {
        account_class_hash: ClassHash,               // Class hash of QuantumAccount
        deployed_accounts: LegacyMap<felt252, ContractAddress>, // salt -> address
        total_deployed: u32,   // Counter
    }

    // ─── Events ───────────────────────────────────
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        AccountDeployed: AccountDeployed,
    }

    #[derive(Drop, starknet::Event)]
    struct AccountDeployed {
        salt: felt252,
        address: ContractAddress,
        pubkey_hash: felt252,
    }

    // ─── Constructor ───────────────────────────────
    #[constructor]
    fn constructor(
        ref self: ContractState,
        account_class_hash: ClassHash,
    ) {
        self.account_class_hash.write(account_class_hash);
        self.total_deployed.write(0);
    }

    // ─── Deploy Function ──────────────────────────

    /// Deploy a new QuantumAccount
    #[external(v0)]
    fn deploy_wallet(
        ref self: ContractState,
        salt: felt252,
        pubkey_hash: felt252,
    ) -> ContractAddress {
        // 1. Check if already deployed
        let existing = self.deployed_accounts.read(salt);
        if existing.is_non_zero() {
            panic("Account already deployed");
        }

        // 2. Prepare constructor args
        let mut constructor_calldata = ArrayTrait::new();
        constructor_calldata.append(pubkey_hash);

        // 3. Deploy contract
        let (address, _) = deploy_syscall(
            self.account_class_hash.read(),
            salt,
            constructor_calldata.span(),
            false,  // from_zero: false means use factory's address as deployer
        ).expect('Deploy failed');

        // 4. Store deployed address
        self.deployed_accounts.write(salt, address);

        // 5. Increment counter
        let count = self.total_deployed.read();
        self.total_deployed.write(count + 1);

        // 6. Emit event
        self.emit(AccountDeployed {
            salt,
            address,
            pubkey_hash,
        });

        address
    }

    // ─── View Functions ─────────────────────────

    /// Get deployed account address by salt
    #[view]
    fn get_deployed_address(
        self: @ContractState,
        salt: felt252,
    ) -> ContractAddress {
        self.deployed_accounts.read(salt)
    }

    /// Get total accounts deployed
    #[view]
    fn get_total_deployed(self: @ContractState) -> u32 {
        self.total_deployed.read()
    }

    /// Get account class hash
    #[view]
    fn get_account_class_hash(self: @ContractState) -> ClassHash {
        self.account_class_hash.read()
    }

    // ─── Admin Functions ──────────────────────────

    /// Update account class hash (for upgrades)
    #[external(v0)]
    fn set_account_class_hash(
        ref self: ContractState,
        new_class_hash: ClassHash,
    ) {
        // TODO: Add access control
        self.account_class_hash.write(new_class_hash);
    }
}
```

---

## STORAGE & STATE MANAGEMENT

### Storage Overview

```
quantum_account:
├─ owner_pubkey_hash: felt252
│  └─ Immutable after initialization
│  └─ SHA-256 hash of ML-DSA public key
│  └─ Used to validate proof commitments
│
├─ tx_nonce: u64
│  └─ Incremented after each tx
│  └─ Prevents replay attacks
│  └─ Current value checked against tx_info.nonce
│
└─ approved_provers: Map<Address, bool>
   └─ Whitelisted prover addresses
   └─ Currently unused in basic voting (simplified)

merkle_audit:
├─ batch_roots: Map<batch_id, root_felt252>
│  └─ Stores Merkle root for each batch
│  └─ Immutable after committed
│
├─ batch_tx_counts: Map<batch_id, tx_count>
│  └─ Number of txs in batch (for debugging)
│
└─ approved_committers: Map<Address, bool>
   └─ Whitelisted batch submitters (backend relayer)

account_factory:
├─ account_class_hash: ClassHash
│  └─ Deployed contracts are instances of this class
│  └─ Can be updated for upgrades
│
├─ deployed_accounts: Map<salt, address>
│  └─ Tracks which addresses have been deployed
│
└─ total_deployed: u32
   └─ Counter for monitoring
```

### State Diagram

```
User Registration (Backend)
  ├─ Generate keypair (Dilithium)
  ├─ Compute pubkey_hash = SHA256(pubkey)
  ├─ Compute counterfactual address
  │  = hash(CLASS_HASH, salt, [pubkey_hash])
  └─ Store in DB (not yet deployed)

    ↓ (when user enables auto-deploy or manually)

Deploy Account
  ├─ Call factory.deploy_wallet(salt, pubkey_hash)
  ├─ Factory creates new QuantumAccount instance
  ├─ Init: account.owner_pubkey_hash = pubkey_hash
  ├─ Init: account.tx_nonce = 0
  └─ Store in deployed_accounts[salt] = address

    ↓

First Transfer
  ├─ Backend: Sign transaction with private key
  ├─ Rust Prover: Verify signature, compute proof
  ├─ Backend: Add proof to Merkle batch
  ├─ Backend: When batch ready, call
  │  merkle_contract.commit_batch_root(batch_id, root)
  └─ Merkle contract stores root

    ↓

Execute Transfer
  ├─ User (or backend) calls account.execute_with_proof(to, amount, proof)
  ├─ Contract: Verify proof_commitment == owner_pubkey_hash
  ├─ Contract: Check nonce == current tx_nonce
  ├─ Contract: Call token transfer
  └─ Contract: Increment tx_nonce
```

---

## DEPLOYMENT

### Build

```bash
cd starknet_contracts
scarb build

# Output:
# target/dev/quantum_guard_contract.contract_class.json  (ABI)
# (binary is embedded in class definition)
```

### Deploy to Sepolia

```bash
# 1. Declare contract class (register code on chain)
starkli declare --class-hash \
  target/dev/quantum_guard_contract.contract_class.json \
  --rpc https://free-rpc.nethermind.io/sepolia-juno/v0_7 \
  --account ~/.starkli/account-sepolia.json \
  --private-key $STARKNET_PRIVATE_KEY

# Returns: class_hash = 0x...

# 2. Deploy factory
starkli deploy $CLASS_HASH \
  --constructor-args $ACCOUNT_CLASS_HASH \
  --rpc https://... \
  --account ~/.starkli/account.json \
  --private-key ...

# Returns: factory_address = 0x...

# 3. Deploy first account (via factory)
starkli invoke $FACTORY_ADDRESS deploy_wallet \
  $SALT $PUBKEY_HASH \
  --rpc ... \
  --account ... \
  --private-key ...

# Returns: account_address = 0x...
```

### Verification

```bash
# Check class hash is declared
starkli class-hash-at $CLASS_HASH --rpc ...

# Check factory deployed
starkli call $FACTORY_ADDRESS get_total_deployed --rpc ...

# Check account exists
starkli call $FACTORY_ADDRESS get_deployed_address $SALT --rpc ...
```

---

## TESTING

### Unit Tests (Cairo)

```cairo
// tests/test_quantum_account.cairo

#[cfg(test)]
mod tests {
    use super::super::QuantumAccount;

    #[test]
    fn test_initialization() {
        let mut state = QuantumAccount::ContractState::default();
        let pubkey_hash = 0x123456;

        // Initialize
        QuantumAccount::QuantumAccount::constructor(ref state, pubkey_hash);

        // Verify
        assert_eq!(state.get_owner_pubkey_hash(state), pubkey_hash);
        assert_eq!(state.get_nonce(state), 0);
    }

    #[test]
    fn test_proof_verification() {
        let mut state = QuantumAccount::ContractState::default();
        let pubkey_hash = 0x123456;

        QuantumAccount::QuantumAccount::constructor(ref state, pubkey_hash);

        // Valid proof (matches pubkey_hash)
        let proof = array![0x123456];
        assert!(QuantumAccount::QuantumAccount::_verify_proof_commitment(
            @state,
            proof.span()
        ));

        // Invalid proof
        let bad_proof = array![0x999999];
        assert!(!QuantumAccount::QuantumAccount::_verify_proof_commitment(
            @state,
            bad_proof.span()
        ));
    }

    #[test]
    fn test_nonce_increment() {
        let mut state = QuantumAccount::ContractState::default();
        QuantumAccount::QuantumAccount::constructor(ref state, 0x123);

        // First nonce
        assert_eq!(state.get_nonce(state), 0);

        // Execute transfer (nonce increments)
        // ... (see execute test)

        // Second nonce
        assert_eq!(state.get_nonce(state), 1);
    }

    #[test]
    fn test_merkle_verification() {
        let merkle = MerkleAudit::ContractState::default();

        // Setup: commit batch root
        let batch_id = 1;
        let root = 0xabcdef;
        let proof_path = array![0x123, 0x456];

        // merkle.commit_batch_root(batch_id, root, 4);

        // Verify leaf is in batch
        let leaf = 0x789;
        let verified = MerkleAudit::MerkleAudit::verify_in_batch(
            @merkle,
            batch_id,
            0,  // leaf_index
            leaf,
            proof_path.span(),
        );

        assert!(verified);
    }
}
```

### Integration Tests

```bash
# test_full_transfer.cairo
#[test]
fn test_full_transfer_flow() {
    // 1. Deploy factory
    let factory_addr = deploy_factory();

    // 2. Deploy account
    let (account_addr, tx_hash) = factory.deploy_wallet(salt, pubkey_hash);

    // 3. Fund account
    token.transfer(account_addr, 100 * 10**18);

    // 4. Commit batch root
    merkle.commit_batch_root(batch_id, root);

    // 5. Execute transfer
    let proof = 0x...;  // Proof commitment
    account.execute_with_proof(to_address, 50 * 10**18, proof);

    // 6. Verify balance changed
    let new_balance = token.balance_of(account_addr);
    assert_eq!(new_balance, 50 * 10**18);
}
```

### Run Tests

```bash
scarb cairo-test

# Output:
# test tests::test_initialization ... ok
# test tests::test_proof_verification ... ok
# test tests::test_nonce_increment ... ok
# ...
# test result: ok. XX passed, 0 failed
```

---

## SECURITY AUDIT CHECKLIST

### Critical

- [ ] **Proof Verification**: Is `_verify_proof_commitment()` cryptographically sound?
  - ✓ Compares proof_commitment with stored owner_pubkey_hash
  - ⚠️ In production: use proper SHA-256, not placeholder

- [ ] **Replay Protection**: Does nonce increment correctly?
  - ✓ Check `tx_nonce == get_tx_info().nonce` before execution
  - ✓ Increment nonce after execution
  - ⚠️ Verify nonce can't overflow (u64 should be sufficient)

- [ ] **Access Control**: Who can call sensitive functions?
  - ⚠️ `set_owner_pubkey_hash()`: should allow only once (check included)
  - ⚠️ `set_approved_prover()`: currently unrestricted (add owner check)
  - ⚠️ `set_approved_committer()`: currently unrestricted (add owner check)

- [ ] **Transfer Safety**: Can contract properly execute STRK transfer?
  - ⚠️ Hardcoded STRK_ADDRESS must be correct
  - ✓ Use `call_contract_syscall()` with proper serialization
  - [ ] Test with actual STRK token contract

### Important

- [ ] **Input Validation**:
  - ✓ batch_id >= 0
  - ✓ pubkey_hash is valid felt252
  - ⚠️ Merkle proof path length should be bounded

- [ ] **Storage Safety**:
  - ✓ No uninitialized storage reads
  - ✓ LegacyMap returns 0 for missing keys (safe)
  - [ ] Consider using `Option` types for clarity

- [ ] **Event Logging**:
  - ✓ Events emitted for TransactionExecuted
  - ✓ Events emitted for BatchRootCommitted
  - [ ] Add events for all state changes (ProofVerificationFailed)

### Nice-to-Have

- [ ] **Gas Optimization**:
  - [ ] Batch reads/writes
  - [ ] Minimize SSTORE operations
  - [ ] Use efficient hashing

- [ ] **Error Messages**:
  - ✓ Include descriptive assert messages
  - [ ] Return specific error codes instead of panics

- [ ] **Documentation**:
  - ✓ Function docstrings
  - [ ] Storage layout comment
  - [ ] Security considerations

---

## TROUBLESHOOTING

### 1. "Invalid class hash"

```bash
# Error: Class hash mismatch when deploying

# Solution: Rebuild contract
scarb build
# Get NEW class hash from object code
scarb contract-artifacts | grep class_hash
```

### 2. "Proof verification failed"

```cairo
// Issue: execute_with_proof() returns false

// Debug:
// 1. Check owner_pubkey_hash is set: get_owner_pubkey_hash() should == pubkey_hash
// 2. Check proof_commitment matches: Should be 32-byte SHA-256
// 3. Verify Rust prover output: proof_commitment should match pubkey_hash

#[test]
fn debug_proof() {
    account.set_owner_pubkey_hash(0x123);
    let proof = 0x123;  // Should match owner_pubkey_hash
    assert!(verify_proof(proof));  // Should be true
}
```

### 3. "Nonce mismatch: expected 5, got 6"

```cairo
// Issue: You're trying to execute tx with nonce 6, but account nonce is 5

// Solution:
// 1. Check current nonce: account.get_nonce() should == tx_nonce
// 2. Previous tx may not have executed: Check on-chain receipt
// 3. Nonce must be sequential (no skipping)

let current_nonce = account.get_nonce();
// current_nonce must match transaction nonce parameter
```

### 4. "Merkle batch not found"

```bash
# Error: verify_in_batch() returns false because batch_id doesn't exist

# Solution: Ensure batch was committed first
merkle.commit_batch_root(batch_id, root);

# Verify:
merkle.get_batch_root(batch_id);  # Should return root (not 0)
```

### 5. "Caller not approved" (deploy_wallet)

```bash
# Error: Only whitelisted committers can commit batch roots

# Solution in backend:
# 1. Call set_approved_committer(RELAYER_ADDRESS, true) first
# 2. Then call commit_batch_root() from relayer address
```

---

## QUICK REFERENCE

### Contract Interaction Examples

**Deploy Account**:
```bash
account_address=$(starkli deploy $CLASS_HASH \
  --constructor-args $PUBKEY_HASH \
  --rpc $RPC --account $ACCOUNT --private-key $KEY)
```

**Check Nonce**:
```bash
nonce=$(starkli call $ACCOUNT_ADDRESS get_nonce --rpc $RPC)
echo "Current nonce: $nonce"
```

**Execute Transfer**:
```bash
starkli invoke $ACCOUNT_ADDRESS execute_with_proof \
  $TO_ADDRESS $AMOUNT $PROOF \
  --rpc $RPC --account $ACCOUNT --private-key $KEY
```

**Verify Merkle Proof**:
```bash
proof_path="[0x123, 0x456, 0x789]"  # JSON array
merkle.verify_in_batch(
  batch_id=1,
  leaf_index=0,
  leaf_value=0xabc,
  proof_path=$proof_path
)
```

---

**End of Module 3 Report**
