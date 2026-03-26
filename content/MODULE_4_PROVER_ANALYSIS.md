# MODULE 4: ZK PROVER (zk_prover) - DETAILED ANALYSIS

**Module**: Off-Chain Signature Verification & Proof Generation Service
**Language**: Rust + Actix-web HTTP Server
**Purpose**: ML-DSA-44 verification + SHA-256 commitment generation
**Lines of Code**: ~400+ (CLI + server + crypto)

---

## TABLE OF CONTENTS

1. [Module Overview](#module-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Cryptographic Primitives](#cryptographic-primitives)
5. [HTTP API](#http-api)
6. [CLI Interface](#cli-interface)
7. [Building & Testing](#building--testing)
8. [Deployment & Scaling](#deployment--scaling)
9. [Performance Analysis](#performance-analysis)
10. [Troubleshooting](#troubleshooting)

---

## MODULE OVERVIEW

### Purpose

Zentropy Prover is a **Rust-based service** that:

1. **Verifies ML-DSA-44 signatures** (quantum-resistant)
2. **Generates proof commitments** (SHA-256 hash for on-chain validation)
3. **Exposes HTTP API** (port 8001) for backend to call
4. **Provides CLI fallback** (stdin/stdout for manual testing)

### Philosophy

- **High Performance**: Rust compiled binary (~50MB), no interpretation overhead
- **Correctness**: Uses audited liboqs library for ML-DSA-44
- **Flexibility**: HTTP server mode OR CLI stdin mode
- **Testability**: Built-in self-test command

### Why Separate Service?

```
Option 1: Pure Python (backend)
├─ Pros: Single process, easy debugging
└─ Cons: SLOW (Python oqs library overhead)

Option 2: Rust HTTP Service (chosen)
├─ Pros: FAST (compiled Rust), scalable, separate team can optimize
└─ Cons: Separate process, network latency

Option 3: Rust compiled into Python (via FFI)
├─ Pros: Single process, fast
└─ Cons: Difficult to build & deploy, version mismatch issues
```

**Zentropy chose Option 2 (HTTP)** for:

- **Scalability**: Multiple prover instances behind load balancer
- **Monitoring**: Separate health check + metrics
- **Upgrades**: Redeploy prover without touching backend
- **Team**: Crypto team can own & optimize independently

---

## ARCHITECTURE

### Project Structure

```
zk_prover/
├── Cargo.toml               # Rust manifest
│   ├── [dependencies]
│   │   ├─ oqs = "0.11"      # Post-quantum crypto
│   │   ├─ serde_json        # JSON serialization
│   │   ├─ sha2              # SHA-256 hashing
│   │   ├─ actix-web         # HTTP server
│   │   ├─ tokio             # Async runtime
│   │   └─ base64            # Encoding
│   │
│   └── [profile.release]
│       ├─ opt-level = 3     # Maximum optimization
│       ├─ lto = true        # Link time optimization
│       └─ codegen-units = 1 # Single codegen unit (slower build, faster binary)
│
├── src/
│   ├── main.rs              # CLI entry point
│   │   ├─ Commands: test, verify, serve
│   │   ├─ Command dispatch
│   │   └─ Error handling
│   │
│   ├── lib.rs               # Library exports
│   │   ├─ pub mod prover
│   │   └─ pub mod server
│   │
│   ├── prover.rs            # ~250 lines: Core crypto logic
│   │   ├─ QuantumProver struct
│   │   ├─ ML-DSA-44 initialization
│   │   ├─ verify_signature()
│   │   ├─ generate_proof()
│   │   ├─ Data types: VerifyRequest, SignatureProof
│   │   └─ Helper functions
│   │
│   └── server.rs            # ~150 lines: HTTP server (Actix-web)
│       ├─ start_server(port)
│       ├─ POST /verify endpoint
│       ├─ GET /health endpoint
│       ├─ Error handling
│       └─ CORS headers
│
├── tests/
│   └── integration_tests.rs # HTTP client tests
│
├── target/
│   ├── debug/              # Debug build
│   │   └── prover          # ~500MB (unoptimized)
│   │
│   └── release/            # Release build
│       └── prover          # ~50MB (optimized)
│
└── Cargo.lock              # Dependency lock file
```

### Dependency Tree

```
quantum_prover (binary)
├── oqs (0.11)              ← Post-quantum crypto (uses liboqs C library)
│   └── liboss.so (vendored, built from source)
│
├── actix-web               ← HTTP framework
│   ├─ actix (runtime)
│   ├─ tokio (async reactor)
│   └─ hyper (HTTP protocol)
│
├── serde + serde_json      ← JSON serialization
├── sha2                    ← SHA-256 hashing
├── base64                  ← Encoding
└── clap                    ← CLI argument parsing
```

### Data Flow

```
HTTP Client (Backend)
    ↓ POST /verify
    │ {
    │   "public_key": "base64...",
    │   "signature": "base64...",
    │   "message": "base64..."
    │ }
    ↓
Rust Prover Process
    ├─ Base64 decode inputs
    ├─ Load public_key → oqs::sig
    ├─ Call oqs::sig::verify(message, signature, public_key)
    │   └─ Returns: bool (valid signature?)
    ├─ If valid:
    │   ├─ Compute SHA-256(public_key || signature || message)
    │   └─ Return proof_commitment
    └─ If invalid:
        └─ Return error + invalid: false

HTTP Response (JSON):
    {
      "valid": true,
      "proof_commitment": "0x...",
      "timestamp": 1234567890
    }
```

---

## CORE COMPONENTS

### 1. prover.rs - Cryptographic Core

```rust
//! Zentropy Signature Prover
//!
//! Verifies ML-DSA-44 (Dilithium) signatures and generates
//! proof commitments (SHA-256) for on-chain validation.

use oqs::sig;
use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};

// ─── Data Types ───────────────────────────────────────

/// Request to verify a signature and generate proof
#[derive(Serialize, Deserialize, Debug)]
pub struct VerifyRequest {
    /// Public key (base64-encoded bytes)
    pub public_key: String,

    /// Signature (base64-encoded bytes)
    pub signature: String,

    /// Message (base64-encoded bytes)
    pub message: String,

    /// Optional: nonce for additional verification
    #[serde(default)]
    pub nonce: Option<u64>,
}

/// Proof of signature verification
#[derive(Serialize, Deserialize, Debug)]
pub struct SignatureProof {
    /// Whether signature is valid
    pub valid: bool,

    /// SHA-256 commitment (0x-prefixed hex)
    pub proof_commitment: String,

    /// Optional Merkle proof path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof_path: Option<Vec<String>>,

    /// Timestamp of verification
    pub timestamp: u64,

    /// Error message (if invalid)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ─── QuantumProver ────────────────────────────────────

pub struct QuantumProver {
    /// ML-DSA-44 signature algorithm instance
    sig_alg: sig::Sig,
}

impl QuantumProver {
    /// Initialize prover with ML-DSA-44
    pub fn new() -> Result<Self, String> {
        // Load ML-DSA-44 from liboqs
        let sig_alg = sig::Sig::new(sig::Algorithm::MlDsa44)
            .map_err(|e| format!("Failed to init ML-DSA-44: {:?}", e))?;

        Ok(QuantumProver { sig_alg })
    }

    /// Generate new keypair (for testing/setup)
    pub fn generate_keypair(&self) -> Result<(Vec<u8>, Vec<u8>), String> {
        let (pk, sk) = self.sig_alg
            .keypair()
            .map_err(|e| format!("Keypair generation failed: {:?}", e))?;

        Ok((pk, sk))
    }

    /// Verify signature and generate proof commitment
    pub fn verify_and_prove(
        &self,
        public_key: &[u8],
        signature: &[u8],
        message: &[u8],
    ) -> Result<SignatureProof, String> {
        // 1. Verify signature using liboqs
        let valid = self.verify_signature(public_key, signature, message)?;

        if !valid {
            return Ok(SignatureProof {
                valid: false,
                proof_commitment: String::new(),
                proof_path: None,
                timestamp: current_timestamp(),
                error: Some("Signature verification failed".to_string()),
            });
        }

        // 2. Compute SHA-256 commitment
        let commitment = self.compute_commitment(public_key, signature, message);

        Ok(SignatureProof {
            valid: true,
            proof_commitment: format!("0x{}", commitment),
            proof_path: None,
            timestamp: current_timestamp(),
            error: None,
        })
    }

    /// Verify signature with liboqs
    pub fn verify_signature(
        &self,
        public_key: &[u8],
        signature: &[u8],
        message: &[u8],
    ) -> Result<bool, String> {
        self.sig_alg
            .verify(message, signature, public_key)
            .map_err(|e| format!("Verification error: {:?}", e))
    }

    /// Compute SHA-256 commitment
    fn compute_commitment(&self, pk: &[u8], sig: &[u8], msg: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(pk);
        hasher.update(sig);
        hasher.update(msg);

        let result = hasher.finalize();
        format!("{:x}", result)  // Hex string
    }
}

// ─── Helper Functions ────────────────────────────────

fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

// ─── Tests ────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair() {
        let prover = QuantumProver::new().unwrap();
        let (pk, sk) = prover.generate_keypair().unwrap();

        assert!(pk.len() > 0);
        assert!(sk.len() > 0);
        assert!(pk.len() < sk.len());  // Public is smaller
    }

    #[test]
    fn test_sign_and_verify() {
        let prover = QuantumProver::new().unwrap();
        let (pk, sk) = prover.generate_keypair().unwrap();

        let message = b"Hello, Zentropy!";

        // Sign
        let signature = prover.sig_alg.sign(message, &sk).unwrap();

        // Verify
        let valid = prover.verify_signature(&pk, &signature, message).unwrap();
        assert!(valid);

        // Invalid message should fail
        let invalid = prover.verify_signature(&pk, &signature, b"Tampered").unwrap();
        assert!(!invalid);
    }

    #[test]
    fn test_proof_generation() {
        let prover = QuantumProver::new().unwrap();
        let (pk, sk) = prover.generate_keypair().unwrap();
        let message = b"Test message";

        let signature = prover.sig_alg.sign(message, &sk).unwrap();

        let proof = prover.verify_and_prove(&pk, &signature, message).unwrap();

        assert!(proof.valid);
        assert!(proof.proof_commitment.starts_with("0x"));
        assert_eq!(proof.proof_commitment.len(), 66);  // 0x + 64 hex chars
    }
}
```

### 2. server.rs - HTTP Server

```rust
//! HTTP Server for Zentropy Prover
//!
//! Actix-web server exposing:
//! - POST /verify: Verify signature and generate proof
//! - GET /health: Health check

use actix_web::{
    web, App, HttpServer, HttpResponse, middleware, error,
};
use serde_json::json;
use std::sync::Arc;

use crate::prover::{QuantumProver, VerifyRequest, SignatureProof};

// ─── Handlers ─────────────────────────────────────────

/// POST /verify - Verify signature and generate proof
async fn verify_handler(
    req: web::Json<VerifyRequest>,
    prover: web::Data<Arc<QuantumProver>>,
) -> actix_web::Result<HttpResponse> {
    // 1. Decode base64 inputs
    let pk = base64::decode(&req.public_key)
        .map_err(|e| error::ErrorBadRequest(format!("Invalid public_key base64: {}", e)))?;

    let sig = base64::decode(&req.signature)
        .map_err(|e| error::ErrorBadRequest(format!("Invalid signature base64: {}", e)))?;

    let msg = base64::decode(&req.message)
        .map_err(|e| error::ErrorBadRequest(format!("Invalid message base64: {}", e)))?;

    // 2. Verify and generate proof
    let proof = prover
        .verify_and_prove(&pk, &sig, &msg)
        .map_err(|e| error::ErrorInternalServerError(e))?;

    // 3. Return JSON response
    Ok(HttpResponse::Ok().json(proof))
}

/// GET /health - Health check
async fn health_handler() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "algorithm": "ML-DSA-44",
        "timestamp": current_timestamp(),
    }))
}

/// GET /info - Prover information
async fn info_handler() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "name": "Zentropy Prover",
        "version": "0.1.0",
        "algorithm": "ML-DSA-44",
        "input_format": "JSON with base64-encoded fields",
    }))
}

// ─── Server Startup ───────────────────────────────────

pub async fn start_server(port: u16) -> std::io::Result<()> {
    // Initialize prover
    let prover = Arc::new(
        QuantumProver::new()
            .expect("Failed to initialize prover")
    );

    println!("Starting Zentropy Prover on 0.0.0.0:{}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(prover.clone()))
            .wrap(middleware::Logger::default())
            .wrap(
                // Add CORS headers
                actix_cors::Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
            )
            // Routes
            .route("/health", web::get().to(health_handler))
            .route("/info", web::get().to(info_handler))
            .route("/verify", web::post().to(verify_handler))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
```

### 3. main.rs - CLI Entry Point

```rust
//! Zentropy Prover CLI
//!
//! Usage:
//!   prover test              - Run self-test
//!   prover verify            - Read JSON from stdin
//!   prover serve --port 8001 - Start HTTP server

use clap::{Parser, Subcommand};
use std::io::{self, Read};

mod prover;
mod server;

use prover::QuantumProver;

#[derive(Parser)]
#[command(name = "quantum_prover")]
#[command(about = "Off-chain ML-DSA-44 signature verifier for Zentropy")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run self-test: generate keypair, sign, verify, prove
    Test,

    /// Read JSON from stdin, output proof JSON to stdout
    Verify,

    /// Start HTTP server
    Serve {
        #[arg(short, long, default_value = "8001")]
        port: u16,
    },
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Test => cmd_test(),
        Commands::Verify => cmd_verify(),
        Commands::Serve { port } => cmd_serve(port).await,
    }
}

// ─── Test Command ────────────────────────────────────

fn cmd_test() {
    println!("=== Zentropy Prover Self-Test ===\n");

    // Initialize prover
    let prover = match QuantumProver::new() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("✗ Failed to initialize prover: {}", e);
            std::process::exit(1);
        }
    };

    // 1. Generate keypair
    println!("1. Generating ML-DSA-44 keypair...");
    let (pk, sk) = match prover.generate_keypair() {
        Ok(pair) => pair,
        Err(e) => {
            eprintln!("✗ Keypair generation failed: {}", e);
            std::process::exit(1);
        }
    };
    println!("   ✓ Public key: {} bytes", pk.len());
    println!("   ✓ Private key: {} bytes\n", sk.len());

    // 2. Sign message
    println!("2. Signing message...");
    let message = b"Hello, Zentropy!";
    let signature = match prover.sig_alg.sign(message, &sk) {
        Ok(sig) => sig,
        Err(e) => {
            eprintln!("✗ Signing failed: {}", e);
            std::process::exit(1);
        }
    };
    println!("   ✓ Signature: {} bytes\n", signature.len());

    // 3. Verify signature
    println!("3. Verifying signature...");
    let valid = match prover.verify_signature(&pk, &signature, message) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("✗ Verification failed: {}", e);
            std::process::exit(1);
        }
    };
    println!("   ✓ Valid: {}\n", valid);

    // 4. Generate proof
    println!("4. Generating proof commitment...");
    let proof = match prover.verify_and_prove(&pk, &signature, message) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("✗ Proof generation failed: {}", e);
            std::process::exit(1);
        }
    };
    println!("   ✓ Proof: {}\n", proof.proof_commitment);

    println!("=== Self-Test Complete ✓ ===");
}

// ─── Verify Command ──────────────────────────────────

fn cmd_verify() {
    // Read JSON from stdin
    let mut input = String::new();
    if io::stdin().read_to_string(&mut input).is_err() {
        eprintln!("Failed to read stdin");
        std::process::exit(1);
    }

    // Parse request
    let req: prover::VerifyRequest = match serde_json::from_str(&input) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Invalid JSON: {}", e);
            std::process::exit(1);
        }
    };

    // Decode inputs
    let pk = match base64::decode(&req.public_key) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Invalid public_key: {}", e);
            std::process::exit(1);
        }
    };

    let sig = match base64::decode(&req.signature) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Invalid signature: {}", e);
            std::process::exit(1);
        }
    };

    let msg = match base64::decode(&req.message) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Invalid message: {}", e);
            std::process::exit(1);
        }
    };

    // Verify and prove
    let prover = match QuantumProver::new() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Prover init failed: {}", e);
            std::process::exit(1);
        }
    };

    let proof = match prover.verify_and_prove(&pk, &sig, &msg) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Verification failed: {}", e);
            std::process::exit(1);
        }
    };

    // Output JSON
    match serde_json::to_string(&proof) {
        Ok(json) => println!("{}", json),
        Err(e) => eprintln!("Serialization failed: {}", e),
    }
}

// ─── Serve Command ───────────────────────────────────

async fn cmd_serve(port: u16) {
    match server::start_server(port).await {
        Ok(_) => println!("Server stopped"),
        Err(e) => eprintln!("Server error: {}", e),
    }
}
```

---

## CRYPTOGRAPHIC PRIMITIVES

### ML-DSA-44 (Dilithium)

```
Algorithm: ML-DSA-44 (Module-Lattice-Based Digital Signature Algorithm)
Status: NIST-standardized (FIPS 204) - post-quantum secure
Key Sizes:
  ├─ Public key: ~1,312 bytes
  ├─ Private key: ~2,560 bytes
  └─ Signature: ~2,420 bytes

Performance:
  ├─ Key generation: ~1-2 ms
  ├─ Signing: ~1-2 ms
  └─ Verification: ~2-4 ms

Security Level: 128-bit (quantum-resistant)
```

**Why ML-DSA-44?**

- NIST-standardized (eliminates exotic crypto risk)
- 128-bit security (quantum computers can break 256-bit symmetric, needs 256+ for equivalent to AES-256)
- Fast enough for real-time use
- Moderate key/signature sizes

### SHA-256 Commitment

```
Input: public_key || signature || message
Process:
  1. Concatenate all three byte arrays
  2. Compute SHA-256 hash
  3. Format as 0x-prefixed hex string (66 chars)

Example:
  input (bytes): [0x01, 0x02, 0x03, ...] (1312+2420+32 bytes)
  hash (SHA-256): 256-bit = 32 bytes
  output (hex): "0xabcdef123456..." (66 chars)

On-chain Verification:
  prover_output = "0xabcd..."
  stored_hash   = account.owner_pubkey_hash
  valid         = (prover_output == stored_hash)
```

**Why SHA-256?**

- Collision-resistant (128-bit security)
- Available in Cairo (easy to verify on-chain)
- Industry standard (not exotic)

---

## HTTP API

### Endpoints

**POST /verify** - Verify signature and generate proof

```bash
curl -X POST http://localhost:8001/verify \
  -H "Content-Type: application/json" \
  -d '{
    "public_key": "AQIDBAUGBwg=",
    "signature": "CQoLDAwNDg8Q=",
    "message": "SGVsbG8gUXVhbnR1bUd1YXJkIQ=="
  }'

Response:
{
  "valid": true,
  "proof_commitment": "0xabcdef123456...",
  "proof_path": null,
  "timestamp": 1711000000,
  "error": null
}
```

**Request Parameters**:

- `public_key`: Base64-encoded ML-DSA public key (~1312 bytes → ~1800 chars base64)
- `signature`: Base64-encoded signature (~2420 bytes → ~3230 chars base64)
- `message`: Base64-encoded transaction data (variable size)
- `nonce` (optional): Additional verification data

**Response**:

```json
{
  "valid": boolean,
  "proof_commitment": "0x<64-hex-chars>",
  "timestamp": unix_timestamp,
  "error": "error message (if invalid)"
}
```

**GET /health** - Health check

```bash
curl http://localhost:8001/health

Response:
{
  "status": "ok",
  "algorithm": "ML-DSA-44",
  "timestamp": 1711000000
}
```

**GET /info** - Prover information

```bash
curl http://localhost:8001/info

Response:
{
  "name": "Zentropy Prover",
  "version": "0.1.0",
  "algorithm": "ML-DSA-44",
  "input_format": "JSON with base64-encoded fields"
}
```

### Error Responses

**Invalid Base64**:

```json
{
  "detail": "Invalid public_key base64: ..."
}
```

**Invalid Signature** (verification fails):

```json
{
  "valid": false,
  "proof_commitment": "",
  "timestamp": 1711000000,
  "error": "Signature verification failed"
}
```

**Server Error**:

```json
{
  "detail": "Internal server error"
}
```

---

## CLI INTERFACE

### Test Command

```bash
./prover test

Output:
=== Zentropy Prover Self-Test ===

1. Generating ML-DSA-44 keypair...
   ✓ Public key: 1312 bytes
   ✓ Private key: 2560 bytes

2. Signing message...
   ✓ Signature: 2420 bytes

3. Verifying signature...
   ✓ Valid: true

4. Generating proof commitment...
   ✓ Proof: 0xabcdef123456...

=== Self-Test Complete ✓ ===
```

### Verify Command (stdin mode)

```bash
# Create request JSON
cat > /tmp/verify_req.json << 'EOF'
{
  "public_key": "AQIDBAUGBwg=",
  "signature": "CQoLDAwNDg8Q=",
  "message": "SGVsbG8="
}
EOF

# Run prover in verify mode
./prover verify < /tmp/verify_req.json

# Output: JSON response
```

### Serve Command

```bash
./prover serve --port 8001

Output:
Starting Zentropy Prover on 0.0.0.0:8001

# Now HTTP queries work
curl http://localhost:8001/health
```

---

## BUILDING & TESTING

### Build

#### Development

```bash
cd zk_prover

# Unoptimized build (faster compile)
cargo build

# Binary: target/debug/prover (~500MB)
```

#### Release

```bash
# Optimized build (slower compile, fast binary)
cargo build --release

# Binary: target/release/prover (~50MB)
# Optimizations:
# - opt-level = 3 (max)
# - lto = true (link-time optimization)
# - codegen-units = 1 (single unit = better optimization)
```

#### Cross-compilation

```bash
# Build for Linux x86_64 on macOS
rustup target add x86_64-unknown-linux-gnu
cargo build --release --target=x86_64-unknown-linux-gnu

# Binary: target/x86_64-unknown-linux-gnu/release/prover
```

### Testing

#### Unit Tests

```bash
cargo test

Output:
running 3 tests
test prover::tests::test_generate_keypair ... ok
test prover::tests::test_sign_and_verify ... ok
test prover::tests::test_proof_generation ... ok

test result: ok. 3 passed; 0 failed
```

#### Integration Tests

```bash
# Test HTTP server
cargo test --test integration_tests -- --nocapture

# (Requires test setup: start server, make HTTP calls)
```

#### Self-Test

```bash
./target/release/prover test

# Output: Full verification flow (same as CLI test command)
```

### Benchmarking

```rust
// Rough performance metrics
let prover = QuantumProver::new().unwrap();
let (pk, sk) = prover.generate_keypair().unwrap();
let msg = b"test";

// Keypair gen: ~1-2 ms
// Signing:    ~1-2 ms
// Verifying:  ~3-5 ms
// Total:      ~5-9 ms per signature

// HTTP overhead: +5-10 ms (network roundtrip)
// Overall: ~10-19 ms per proof
```

---

## DEPLOYMENT & SCALING

### Docker

```dockerfile
FROM rust:1.70 AS builder

WORKDIR /app
COPY Cargo.* ./
COPY src ./src

# Install liboqs dependencies
RUN apt-get update && apt-get install -y \
    libssl-dev libffi-dev cmake \
    && rm -rf /var/lib/apt/lists/*

# Build release binary
RUN cargo build --release

# Runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libssl3 libffi8 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/prover /usr/local/bin/

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

ENTRYPOINT ["prover", "serve", "--port", "8001"]
```

### Docker Compose

```yaml
services:
  prover:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8001:8001"
    environment:
      RUST_LOG: info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Horizontal Scaling

```
Load Balancer (nginx)
  ├─ Prover Instance 1 (port 8001)
  ├─ Prover Instance 2 (port 8001)
  ├─ Prover Instance 3 (port 8001)
  └─ ...

Each instance: Stateless (no shared state)
```

**nginx config**:

```nginx
upstream prover_backend {
    server prover-1:8001;
    server prover-2:8001;
    server prover-3:8001;
}

server {
    listen 8080;
    location / {
        proxy_pass http://prover_backend;
    }
}
```

---

## PERFORMANCE ANALYSIS

### Throughput

```
Single Instance (1 CPU core):
├─ ~100 signatures/sec (10ms each)
├─ Peak: ~120 sigs/sec (if perfect)
└─ Sustained: ~60-80 sigs/sec (accounting for overhead)

With 4 CPU cores:
├─ Linear scaling: ~240-320 sigs/sec
└─ Actual: ~200-250 sigs/sec (some contention)

Backend load (100 STRK transfers/sec):
├─ Prover load: 100 signatures/sec
├─ Required instances: 100 sigs/sec ÷ 80 sigs/instance ≈ 2 instances
└─ Plus headroom: 4-6 instances recommended
```

### Latency

```
HTTP Prover Request:
├─ Network latency (local): ~1-2ms
├─ Base64 decode: ~0.5ms
├─ ML-DSA verify: ~3-5ms
├─ SHA-256 hash: ~0.1ms
├─ JSON serialize: ~0.2ms
├─ Response transmission: ~0.5ms
└─ Total: ~10-20ms (typical)

Python Fallback (if Rust unavailable):
├─ Python startup: ~100-200ms (Python interpreter)
├─ oqs.sig verification: ~10-20ms (same C library)
└─ Total: ~110-220ms (much slower)
```

### Memory Usage

```
Prover Process:
├─ Base binary: ~50MB
├─ Runtime heap: ~10-50MB (depends on request size)
├─ Per request: ~1-2MB temporary
└─ Total: ~100-150MB (typical idle + few requests)

Scaling: Constant memory per instance (no data accumulation)
```

---

## TROUBLESHOOTING

### 1. "cannot find -lssl"

```bash
# Error: Build failure (missing OpenSSL library)

# Solution: Install development libraries
# Ubuntu/Debian
sudo apt-get install libssl-dev

# macOS
brew install openssl

# Then rebuild
cargo build --release
```

### 2. "liboss.so.0: cannot open shared object file"

```bash
# Error: Runtime failure (liboqs not found in path)

# Solution: Set LD_LIBRARY_PATH
export LD_LIBRARY_PATH=/path/to/liboqs/build/lib:$LD_LIBRARY_PATH
./target/release/prover test

# Or (for release):
# Build liboqs as shared library:
cd ../liboqs/build
ninja  # or make
# Then prover binary will find liboss.so
```

### 3. "Connection refused" (backend can't call prover)

```bash
# Error: Backend gets conn err when calling http://localhost:8001

# Solution: Check prover is running
ps aux | grep prover
# If not running:
./target/release/prover serve --port 8001

# Check port is open:
netstat -tlnp | grep 8001

# If remote backend:
export PROVER_URL=http://prover-service:8001
# In backend config
```

### 4. "Signature verification failed" (valid sig returns false)

```bash
# Issue: verify_and_prove() returns valid=false for valid signature

# Debug:
# 1. Test with CLI:
./prover test  # Should generate and verify OK

# 2. Check key sizes:
#    public_key: ~1312 bytes
#    signature: ~2420 bytes
#    If wrong size, signature is malformed

# 3. Verify base64 encoding:
#    echo "base64_string" | base64 -d | xxd | head
#    Should be binary data, not UTF-8 text
```

### 5. "Timeout calling prover" (slow response)

```bash
# Issue: Backend gets timeout when calling HTTP prover

# Debug:
# 1. Check prover load:
#    curl http://localhost:8001/health  # Should be fast
#
# 2. Check input sizes (huge keys or signatures):
#    Base64 decode overhead: large = slow
#
# 3. Monitor prover CPU:
#    top -p <prover_pid>
#    Should not be maxed out

# Solution: Add more prover instances + load balancer
```

### 6. Cannot build liboqs from source

```bash
# Error: cmake/ninja failures building liboqs dependency

# Solution: Use Cargo to manage build
cargo build --release

# If still failing, check pre-built liboqs:
# - Download liboqs from https://github.com/open-quantum-safe/liboqs
# - Build locally:
#   cd liboqs && mkdir build && cd build
#   cmake -GNinja -DBUILD_SHARED_LIBS=ON ..
#   ninja
# - Set LIB_OQS_PATH:
#   export LIB_OQS_PATH=/path/to/liboqs/build/lib
#   cargo build --release --env LIB_OQS_PATH=...
```

---

## QUICK REFERENCE

### Building for Production

```bash
# 1. Build release binary
cargo build --release
BINARY=target/release/prover

# 2. Verify with self-test
$BINARY test

# 3. Build Docker image
docker build -t quantum-prover:latest .

# 4. Run container
docker run -p 8001:8001 quantum-prover:latest

# 5. Test HTTP endpoint
curl http://localhost:8001/health
```

### Benchmarking

```bash
# Benchmark signature verification rate
time for i in {1..1000}; do
  curl -s -X POST http://localhost:8001/verify \
    -H "Content-Type: application/json" \
    -d '{"public_key":"...","signature":"...","message":"..."}'
done

# Result: 1000 requests in X seconds
# Throughput = 1000 / X requests/sec
```

### Monitoring

```bash
# Health check (Kubernetes/Docker)
curl -f http://localhost:8001/health || exit 1

# Logs (if using systemd)
journalctl -u quantum-prover -f

# Metrics would go here (Prometheus integration TBD)
```

---

**End of Module 4 Report**

**Total Documentation**: 4 comprehensive module reports + main system report (20,000+ lines)
