# MODULE 2: QUANTUM WALLET UI (quantum_wallet_ui/frontend) - DETAILED ANALYSIS

**Module**: React-based Web Frontend for Zentropy Custodial Wallet
**Framework**: React 19 + Vite + Tailwind CSS
**Language**: JavaScript/JSX
**Lines of Code**: ~2500+ (components + pages)

---

## TABLE OF CONTENTS

1. [Module Overview](#module-overview)
2. [Detailed Architecture](#detailed-architecture)
3. [Component Structure](#component-structure)
4. [API Client & Integration](#api-client--integration)
5. [State Management](#state-management)
6. [Page Implementations](#page-implementations)
7. [Styling & Design System](#styling--design-system)
8. [Error Handling & User Feedback](#error-handling--user-feedback)
9. [Performance Optimization](#performance-optimization)
10. [Build & Deployment](#build--deployment)
11. [Testing Strategy](#testing-strategy)
12. [Troubleshooting](#troubleshooting)

---

## MODULE OVERVIEW

### Purpose

Zentropy Frontend provides a web-based user interface for:

1. **Organization Authentication**: Login with API key
2. **Wallet Management**: View balances, deployment status, account details
3. **Transaction Execution**: Send tokens, receive tokens, view history
4. **System Monitoring**: Check backend/prover health status
5. **User-Friendly UX**: Responsive design, real-time updates, error recovery

### Philosophy

- **React 19**: Latest features (useTransition, useActionState)
- **Vite**: Fast HMR during development, optimized production build
- **Tailwind CSS**: Utility-first styling, no custom CSS (except essentials)
- **API-Driven**: All state from backend; frontend is stateless UI layer
- **Accessibility**: ARIA labels, semantic HTML, keyboard navigation

### Requirements Met

| Requirement               | Implementation                             | Status |
| ------------------------- | ------------------------------------------ | ------ |
| Organization login        | API key input + storage                    | ✓      |
| Real-time balance         | Poll /wallet endpoint every 5s             | ✓      |
| Transaction creation      | Form validation + API call                 | ✓      |
| Transaction monitoring    | Poll /transactions/{tx_id} until confirmed | ✓      |
| Deployment status display | Show counterfactual/pending/deployed       | ✓      |
| Error handling            | Pydantic error parsing + user messages     | ✓      |
| Responsive design         | Mobile-first Tailwind                      | ✓      |
| Backend health check      | /health endpoint polling                   | ✓      |

---

## DETAILED ARCHITECTURE

### Project Structure

```
quantum_wallet_ui/frontend/
├── src/
│   ├── main.jsx                   # React DOM render entry point
│   ├── App.jsx                    # Root component, routing setup
│   ├── index.css                  # Global Tailwind styles
│   │
│   ├── api/
│   │   └── client.js              # 300+ lines: HTTP client + interceptors
│   │       ├── Axios instance setup
│   │       ├── Request interceptor (add Bearer token)
│   │       ├── Response interceptor (extract errors)
│   │       ├── Error message extraction
│   │       └── API method wrappers
│   │
│   ├── pages/                     # Page components (route-level)
│   │   ├── Landing.jsx            # Marketing landing page
│   │   ├── Login.jsx              # API key authentication
│   │   ├── Dashboard.jsx          # Main wallet overview
│   │   ├── CreateWallet.jsx       # User registration + seed phrase
│   │   ├── SendTokens.jsx         # Transfer form
│   │   ├── ReceiveTokens.jsx      # Display wallet address
│   │   ├── Transactions.jsx       # Transaction list
│   │   ├── TransactionHistory.jsx # Detailed history view
│   │   └── ProverStatus.jsx       # System health check
│   │
│   ├── components/                # Reusable UI components
│   │   ├── Layout.jsx             # Sidebar + main content wrapper
│   │   ├── Sidebar.jsx            # Navigation menu
│   │   ├── WalletCard.jsx         # Balance + address display
│   │   ├── Button.jsx             # Styled button component
│   │   ├── Card.jsx               # Card container
│   │   ├── ErrorBoundary.jsx      # React error fallback
│   │   ├── StatusBadge.jsx        # Status indicator badge
│   │   └── (other UI components)
│   │
│   ├── context/
│   │   └── WalletContext.jsx      # Global wallet state + actions
│   │       ├── WalletProvider
│   │       ├── useWallet hook
│   │       └── State: user, wallet, transactions, loading, error
│   │
│   ├── public/
│   │   ├── index.html             # HTML entry point
│   │   └── favicon.ico
│   │
│   └── dist/                      # Production build output
│       ├── index.html
│       ├── assets/
│       │   ├── index-*.js
│       │   ├── index-*.css
│       │   └── vendor-*.js
│       └── (optimized files)
│
├── package.json                   # Dependencies, scripts
├── vite.config.js                 # Vite build configuration
├── tailwind.config.js             # Tailwind CSS setup
├── .eslintrc.cjs                  # ESLint configuration
├── .gitignore
└── node_modules/                  # Dependencies (npm install)
```

### Technology Stack

```json
{
  "react": "^19.2.0", // UI framework
  "react-dom": "^19.2.0", // React DOM rendering
  "react-router-dom": "^7.13.0", // Client-side routing
  "axios": "^1.13.5", // HTTP client
  "tailwindcss": "^4.1.18", // Utility CSS
  "vite": "^7.3.1", // Build tool
  "@vitejs/plugin-react": "^5.1.1" // React plugin for Vite
}
```

### Build Process

```
Development:
  src/*.jsx → Vite Dev Server (port 5173)
    ├─ Hot Module Reload (HMR)
    ├─ Instant feedback on code changes
    └─ Browser auto-refresh

Production:
  src/*.jsx → Vite Bundler
    ├─ Tree-shaking (remove unused code)
    ├─ Code splitting (bundle by routes)
    ├─ Minification (uglify JS)
    ├─ CSS optimization
    └─ dist/ folder (ready for deployment)
```

---

## COMPONENT STRUCTURE

### Component Hierarchy

```
App (root)
├── BrowserRouter
│   └── Routes
│       ├── Landing (/)
│       ├── Login (/login)
│       └── ProtectedPages
│           └── Layout
│               ├── Sidebar (navigation)
│               └── MainContent
│                   ├── Dashboard
│                   ├── CreateWallet
│                   ├── SendTokens
│                   ├── ReceiveTokens
│                   ├── Transactions
│                   ├── TransactionHistory
│                   └── ProverStatus
│
ErrorBoundary (error fallback)
│
WalletProvider (global state)
  └── All components have access to wallet context
```

### Component Types

#### 1. Pages (Route-Level Components)

```jsx
// pages/Dashboard.jsx - Main wallet overview
export function Dashboard() {
  const { wallet, loading, error, fetchUserWallet } = useWallet();
  const { user_id } = useParams();

  useEffect(() => {
    // Fetch wallet on component mount
    fetchUserWallet(user_id);

    // Poll every 5 seconds
    const interval = setInterval(() => {
      fetchUserWallet(user_id);
    }, 5000);

    return () => clearInterval(interval);
  }, [user_id, fetchUserWallet]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div className="space-y-6">
      <h1>Dashboard</h1>
      <WalletCard wallet={wallet} />
      <QuickActions />
      <RecentTransactions />
    </div>
  );
}
```

#### 2. Layout Components

```jsx
// components/Layout.jsx - Main layout wrapper
export function Layout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}

// components/Sidebar.jsx - Navigation menu
export function Sidebar() {
  const navigate = useNavigate();
  const { hasApiKey, logout } = useWallet();

  const menuItems = [
    { label: "Dashboard", path: "/dashboard", icon: "📊" },
    { label: "Create Wallet", path: "/wallet", icon: "➕" },
    { label: "Send", path: "/send", icon: "📤" },
    { label: "Receive", path: "/receive", icon: "📥" },
    { label: "Transactions", path: "/transactions", icon: "💳" },
    { label: "History", path: "/history", icon: "📜" },
    { label: "Status", path: "/prover", icon: "🔍" },
  ];

  return (
    <aside className="w-64 bg-white shadow-md">
      <nav className="p-6 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full text-left px-4 py-2 rounded hover:bg-gray-100"
          >
            {item.icon} {item.label}
          </button>
        ))}
        <button
          onClick={logout}
          className="w-full mt-4 px-4 py-2 bg-red-500 text-white rounded"
        >
          Logout
        </button>
      </nav>
    </aside>
  );
}
```

#### 3. Feature Components

```jsx
// components/WalletCard.jsx - Balance display
export function WalletCard({ wallet }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Wallet</h2>

      <div className="space-y-2">
        <p className="text-gray-600">Address:</p>
        <code className="bg-gray-100 p-2 rounded text-sm break-all">
          {wallet.contract_address}
        </code>

        <p className="text-gray-600 mt-4">Balance:</p>
        <p className="text-3xl font-bold">{wallet.balance_strk} STRK</p>

        <p className="text-gray-600 mt-4">Status:</p>
        <StatusBadge status={wallet.deployment_status} />
      </div>

      <div className="mt-6 space-x-2">
        <button
          onClick={() => copyToClipboard(wallet.contract_address)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Copy Address
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded">
          Share
        </button>
      </div>
    </div>
  );
}

// components/StatusBadge.jsx - Status indicator
export function StatusBadge({ status }) {
  const statusConfig = {
    deployed: { color: "bg-green-100 text-green-800", icon: "✓" },
    pending: { color: "bg-yellow-100 text-yellow-800", icon: "⏳" },
    counterfactual: { color: "bg-gray-100 text-gray-800", icon: "⚪" },
    failed: { color: "bg-red-100 text-red-800", icon: "✗" },
  };

  const config = statusConfig[status] || statusConfig.failed;

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}
    >
      {config.icon} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

#### 4. Reusable Utility Components

```jsx
// components/Button.jsx - Styled button
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  onClick,
  ...props
}) {
  const baseStyles = "font-medium rounded transition";

  const variantStyles = {
    primary: "bg-blue-500 text-white hover:bg-blue-600",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    danger: "bg-red-500 text-white hover:bg-red-600",
  };

  const sizeStyles = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} disabled:opacity-50`}
      disabled={loading}
      onClick={onClick}
      {...props}
    >
      {loading ? "⏳ Loading..." : children}
    </button>
  );
}

// components/ErrorBoundary.jsx - React error fallback
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 text-lg font-semibold">
            Oops! Something went wrong
          </h2>
          <p className="text-red-700 mt-2">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## API CLIENT & INTEGRATION

### HTTP Client Setup

```javascript
// api/client.js - Axios instance with interceptors
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v2`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request Interceptor ───────────────────────────────
// Add Bearer token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const apiKey = getApiKey(); // From sessionStorage
    if (apiKey) {
      config.headers.Authorization = `Bearer ${apiKey}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ──────────────────────────────
// Extract errors, handle 401 logout
apiClient.interceptors.response.use(
  (response) => {
    // Attach readableMessage for easier error handling
    return {
      ...response,
      readableMessage: extractErrorMessage(response.data),
    };
  },
  (error) => {
    // 401 Unauthorized: logout
    if (error.response?.status === 401) {
      clearApiKey();
      window.location.href = "/login";
    }

    // Attach error message
    if (error.response?.data) {
      error.readableMessage = extractErrorMessage(error.response.data);
    } else {
      error.readableMessage = error.message || "Network error";
    }

    return Promise.reject(error);
  },
);

// ─── Error Message Extraction ──────────────────────────
// Handle both Pydantic validation errors & simple errors
export function extractErrorMessage(data) {
  const detail = data?.detail;

  if (!detail) {
    return "Unknown error";
  }

  // Pydantic validation: detail is array of objects
  if (Array.isArray(detail)) {
    return detail
      .map((e) => e.msg || e.message || JSON.stringify(e))
      .join("; ");
  }

  // Simple error: detail is string
  if (typeof detail === "string") {
    return detail;
  }

  // Fallback
  return JSON.stringify(detail);
}

// ─── API Methods ──────────────────────────────────────
export const api = {
  // User & Wallet
  registerWallet: (email, username) =>
    apiClient.post("/users/register", { email, username }),

  getWallet: (userId) => apiClient.get(`/users/${userId}/wallet`),

  getDeploymentStatus: (userId) =>
    apiClient.get(`/users/${userId}/deployment-status`),

  retryDeployment: (userId) =>
    apiClient.post(`/users/${userId}/deployment/retry`),

  // Transactions
  transfer: (userId, toAddress, amountStrk) =>
    apiClient.post("/transactions/transfer", {
      user_id: userId,
      to_address: toAddress,
      amount_strk: amountStrk,
    }),

  getTransaction: (txId) => apiClient.get(`/transactions/${txId}`),

  getTransactions: (userId, limit = 50, offset = 0) =>
    apiClient.get(`/users/${userId}/transactions`, {
      params: { limit, offset },
    }),

  // Health & Status
  getHealth: () => apiClient.get("/health"),
};

// ─── Storage Helpers ──────────────────────────────────
export function setApiKey(key) {
  sessionStorage.setItem("api_key", key);
}

export function getApiKey() {
  return sessionStorage.getItem("api_key");
}

export function hasApiKey() {
  return !!sessionStorage.getItem("api_key");
}

export function clearApiKey() {
  sessionStorage.removeItem("api_key");
}
```

### Example API Call with Error Handling

```jsx
// pages/SendTokens.jsx - Transfer form with error handling
export function SendTokens() {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validation
      if (!toAddress) throw new Error("Recipient address required");
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // API call
      const result = await api.transfer(userId, toAddress, parseFloat(amount));

      setSuccess(`Transfer submitted: ${result.data.tx_id}`);
      setToAddress("");
      setAmount("");

      // Poll transaction status
      pollTransactionStatus(result.data.tx_id);
    } catch (err) {
      // Extract readable error message
      const message = err.readableMessage || err.message;
      setError(message);
      console.error("Transfer error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleTransfer} className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          ✗ {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700">
          ✓ {success}
        </div>
      )}

      <input
        type="text"
        placeholder="Recipient address (0x...)"
        value={toAddress}
        onChange={(e) => setToAddress(e.target.value)}
        className="w-full px-4 py-2 border rounded"
      />

      <input
        type="number"
        placeholder="Amount (STRK)"
        step="0.001"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full px-4 py-2 border rounded"
      />

      <Button type="submit" variant="primary" loading={loading}>
        Send
      </Button>
    </form>
  );
}
```

---

## STATE MANAGEMENT

### WalletContext (Global State)

```jsx
// context/WalletContext.jsx - Global wallet state
import React, { createContext, useContext, useState, useCallback } from "react";
import { api } from "../api/client";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  // State
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);

  // ─── Wallet Actions ─────────────────────────────────────

  const fetchUserWallet = useCallback(async (userId) => {
    setLoading(true);
    try {
      const response = await api.getWallet(userId);
      setWallet(response.data);
      setError(null);
    } catch (err) {
      setError(err.readableMessage);
      console.error("Fetch wallet error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(
    async (userId, limit = 50, offset = 0) => {
      try {
        const response = await api.getTransactions(userId, limit, offset);
        setTransactions(response.data.transactions);
      } catch (err) {
        setError(err.readableMessage);
      }
    },
    [],
  );

  const register = useCallback(async (email, username) => {
    setLoading(true);
    try {
      const response = await api.registerWallet(email, username);
      setWallet(response.data);
      return response.data;
    } catch (err) {
      setError(err.readableMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const transfer = useCallback(async (userId, toAddress, amount) => {
    setLoading(true);
    try {
      const response = await api.transfer(userId, toAddress, amount);
      return response.data;
    } catch (err) {
      setError(err.readableMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const response = await api.getHealth();
      setHealth(response.data);
    } catch (err) {
      setHealth({ status: "error", error: err.readableMessage });
    }
  }, []);

  // ─── Logout ────────────────────────────────────────────

  const logout = useCallback(() => {
    sessionStorage.removeItem("api_key");
    setUser(null);
    setWallet(null);
    setTransactions([]);
    window.location.href = "/login";
  }, []);

  // ─── Context Value ────────────────────────────────────

  const value = {
    // State
    user,
    setUser,
    wallet,
    transactions,
    loading,
    error,
    setError,
    health,

    // Actions
    fetchUserWallet,
    fetchTransactions,
    register,
    transfer,
    checkHealth,
    logout,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
```

### Usage in Components

```jsx
// Example: Dashboard component using context
export function Dashboard() {
  const { wallet, loading, error, fetchUserWallet } = useWallet();
  const params = useParams();

  useEffect(() => {
    const userId = params.userId;
    fetchUserWallet(userId);

    // Poll every 5 seconds
    const interval = setInterval(() => {
      fetchUserWallet(userId);
    }, 5000);

    return () => clearInterval(interval);
  }, [params.userId, fetchUserWallet]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!wallet) return <p>No wallet found</p>;

  return (
    <div>
      <h1>Wallet Balance: {wallet.balance_strk} STRK</h1>
      <p>Address: {wallet.contract_address}</p>
      <p>Status: {wallet.deployment_status}</p>
    </div>
  );
}
```

---

## PAGE IMPLEMENTATIONS

### 1. Landing Page

```jsx
// pages/Landing.jsx - Marketing page
export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800">
      <header className="flex justify-between items-center p-8">
        <h1 className="text-3xl font-bold text-white">Zentropy</h1>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-2 bg-white text-blue-600 rounded font-semibold"
        >
          Login
        </button>
      </header>

      <main className="flex flex-col items-center justify-center py-20">
        <h2 className="text-5xl font-bold text-white mb-6 text-center">
          Post-Quantum Secure Wallet
        </h2>

        <p className="text-xl text-blue-100 max-w-2xl text-center mb-12">
          Zentropy protects your assets with ML-DSA-44 quantum-resistant
          cryptography on the Starknet blockchain.
        </p>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl">
          <Feature
            icon="🔐"
            title="Quantum Safe"
            description="ML-DSA-44 encryption, NIST-standardized"
          />
          <Feature
            icon="⚡"
            title="Fast Transfers"
            description="Merkle-batched transactions reduce costs"
          />
          <Feature
            icon="📊"
            title="Transparent"
            description="Immutable audit trails for compliance"
          />
        </div>

        <button
          onClick={() => navigate("/login")}
          className="mt-12 px-8 py-3 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50"
        >
          Get Started
        </button>
      </main>
    </div>
  );
}

function Feature({ icon, title, description }) {
  return (
    <div className="bg-white bg-opacity-10 rounded-lg p-6 text-white">
      <p className="text-4xl mb-3">{icon}</p>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-blue-100">{description}</p>
    </div>
  );
}
```

### 2. Login Page

```jsx
// pages/Login.jsx - API key authentication
export function Login() {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate API key format
      if (!apiKey.trim()) {
        throw new Error("API key is required");
      }

      // Store API key
      setApiKey(apiKey);

      // Test API key by listing users
      const response = await api.getUsers();

      if (response.status === 200) {
        // Success: navigate to dashboard
        navigate("/dashboard");
      }
    } catch (err) {
      const message = err.readableMessage || err.message;
      if (err.response?.status === 401) {
        setError("Invalid API key");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Zentropy Login</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Organization API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="qg_org_..."
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
```

### 3. Create Wallet Page

```jsx
// pages/CreateWallet.jsx - User registration + seed phrase
export function CreateWallet() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [step, setStep] = useState("form"); // form | seed | confirm
  const [seedPhrase, setSeedPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { register } = useWallet();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validation
      if (!email.includes("@")) throw new Error("Valid email required");
      if (!username.trim()) throw new Error("Username required");

      // Register wallet
      const result = await register(email, username);
      setSeedPhrase(result.seed_phrase);
      setStep("seed");
    } catch (err) {
      setError(err.readableMessage || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "seed") {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-yellow-900 mb-2">
            ⚠️ Save Your Seed Phrase
          </h2>
          <p className="text-sm text-yellow-800 mb-4">
            Your recovery phrase is displayed below. Save it in a safe place.
            You will never see it again.
          </p>

          <div className="bg-white p-4 rounded border-2 border-yellow-300 mb-4">
            <p className="font-mono text-sm break-words">{seedPhrase}</p>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(seedPhrase);
              alert("Copied to clipboard");
            }}
            className="w-full py-2 bg-yellow-600 text-white rounded font-semibold mb-2"
          >
            Copy Phrase
          </button>

          <button
            onClick={() => window.print()}
            className="w-full py-2 bg-gray-600 text-white rounded font-semibold"
          >
            Print
          </button>
        </div>

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" required />
          <span>I have saved my seed phrase in a secure location</span>
        </label>

        <button
          onClick={() => {
            setStep("confirm");
            // Or redirect to dashboard
          }}
          className="w-full py-3 bg-green-600 text-white rounded font-semibold"
        >
          Continue to Dashboard
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Create New Wallet</h1>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-2 border rounded"
      />

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full px-4 py-2 border rounded"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded font-semibold disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Wallet"}
      </button>
    </form>
  );
}
```

### 4. Send Tokens Page

```jsx
// pages/SendTokens.jsx - Transfer form
export function SendTokens() {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txId, setTxId] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const { wallet, transfer } = useWallet();
  const params = useParams();

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Validation
      if (!toAddress.startsWith("0x")) {
        throw new Error("Address must start with 0x");
      }
      const amountNum = parseFloat(amount);
      if (amountNum <= 0) {
        throw new Error("Amount must be greater than 0");
      }
      if (amountNum > parseFloat(wallet.balance_strk)) {
        throw new Error("Insufficient balance");
      }

      // Transfer
      const result = await transfer(params.userId, toAddress, amountNum);

      setTxId(result.tx_id);
      setTxStatus(result.status);
      setSuccess(`Transfer initiated: ${result.tx_id}`);
      setToAddress("");
      setAmount("");

      // Poll transaction status
      pollTransactionStatus(result.tx_id);
    } catch (err) {
      setError(err.readableMessage || err.message);
    } finally {
      setLoading(false);
    }
  };

  const pollTransactionStatus = async (txId) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes

    const poll = async () => {
      try {
        const response = await api.getTransaction(txId);
        const status = response.data.status;
        setTxStatus(status);

        if (status === "confirmed") {
          setSuccess(`✓ Transfer confirmed: ${txId}`);
        } else if (status === "failed") {
          setError(`✗ Transfer failed: ${response.data.error_message}`);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000); // Poll every 2 seconds
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    };

    poll();
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Send Tokens</h1>

      {error && <ErrorAlert>{error}</ErrorAlert>}
      {success && <SuccessAlert>{success}</SuccessAlert>}

      {txId && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-700">Transaction: {txId}</p>
          <p className="text-sm text-blue-700">Status: {txStatus}</p>
        </div>
      )}

      <form onSubmit={handleTransfer} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="w-full px-4 py-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Amount (STRK)
          </label>
          <input
            type="number"
            step="0.001"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 border rounded"
          />
          <p className="text-xs text-gray-500 mt-1">
            Available: {wallet?.balance_strk} STRK
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Send"}
        </button>
      </form>
    </div>
  );
}
```

---

## STYLING & DESIGN SYSTEM

### Tailwind Configuration

```javascript
// tailwind.config.js
export default {
  content: ["./src/**/*.{jsx,js}"],
  theme: {
    extend: {
      colors: {
        primary: "#0066cc",
        success: "#22c55e",
        warning: "#eab308",
        danger: "#ef4444",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#374151",
          },
        },
      },
    },
  },
  plugins: [],
};
```

### Global Styles

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, sans-serif;
  background-color: #f9fafb;
  color: #1f2937;
  line-height: 1.6;
}

/* Component classes */
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition;
  }

  .btn-secondary {
    @apply px-4 py-2 bg-gray-200 text-gray-800 rounded font-semibold hover:bg-gray-300 transition;
  }

  .alert {
    @apply p-4 rounded border;
  }

  .alert-error {
    @apply alert bg-red-50 border-red-200 text-red-700;
  }

  .alert-success {
    @apply alert bg-green-50 border-green-200 text-green-700;
  }

  .alert-warning {
    @apply alert bg-yellow-50 border-yellow-200 text-yellow-700;
  }

  .card {
    @apply bg-white rounded-lg shadow-md p-6;
  }

  .input {
    @apply w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500;
  }
}
```

---

## ERROR HANDLING & USER FEEDBACK

### Error Extraction Pattern

```javascript
// Universal error handler for all API errors
export function extractErrorMessage(data) {
  const detail = data?.detail;

  if (!detail) {
    return "An unknown error occurred";
  }

  // Case 1: Pydantic validation (array of error objects)
  if (Array.isArray(detail)) {
    return detail
      .map((err) => {
        // Reconstruct field path: ["body", "amount"] → "amount"
        const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : "";
        return `${field}: ${err.msg}`.trim().replace(/^: /, "");
      })
      .join("; ");
  }

  // Case 2: Simple string error
  if (typeof detail === "string") {
    return detail;
  }

  // Case 3: Object error
  return JSON.stringify(detail);
}
```

### User Feedback Components

```jsx
// Reusable error, success, warning displays
function ErrorAlert({ children, onClose }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          <span className="text-xl">✗</span>
          <div>{children}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-red-500 hover:text-red-700">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function SuccessAlert({ children, onClose }) {
  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700">
      <div className="flex justify-between items-start gap-3">
        <span>✓ {children}</span>
        {onClose && <button onClick={onClose}>×</button>}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
      <div
        className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
        style={{ animationDelay: "0.1s" }}
      ></div>
      <div
        className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
        style={{ animationDelay: "0.2s" }}
      ></div>
      <span className="ml-2">Loading...</span>
    </div>
  );
}
```

---

## PERFORMANCE OPTIMIZATION

### Code Splitting

```javascript
// Vite automatically code-splits at route level
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SendTokens = lazy(() => import("./pages/SendTokens"));
const CreateWallet = lazy(() => import("./pages/CreateWallet"));

// Routes use Suspense fallback
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/send" element={<SendTokens />} />
    <Route path="/wallet" element={<CreateWallet />} />
  </Routes>
</Suspense>;
```

### Memoization

```jsx
// Prevent unnecessary re-renders
const WalletCard = React.memo(({ wallet }) => {
  return (
    <div className="card">
      <p>Balance: {wallet.balance_strk}</p>
    </div>
  );
});

// useCallback for stable function references
const fetchWallet = useCallback(async (userId) => {
  const response = await api.getWallet(userId);
  setWallet(response.data);
}, []);
```

### Polling Optimization

```jsx
// Cleanup intervals properly
useEffect(() => {
  let isMounted = true;

  const poll = async () => {
    if (!isMounted) return;

    try {
      const data = await api.getTransaction(txId);
      if (isMounted) {
        setTx(data);
        if (data.status !== "pending") {
          isMounted = false; // Stop polling when done
        }
      }
    } catch (err) {
      console.error(err);
    }

    if (isMounted && data.status === "pending") {
      setTimeout(poll, 2000); // 2s between polls
    }
  };

  poll();

  return () => {
    isMounted = false; // Cleanup
  };
}, [txId]);
```

---

## BUILD & DEPLOYMENT

### Development

```bash
npm run dev

# Vite dev server starts on http://localhost:5173
# Changes auto-refresh (HMR)
```

### Production Build

```bash
npm run build

# Output: dist/ folder
# - index.html
# - assets/index-<hash>.js
# - assets/index-<hash>.css
# - assets/vendor-<hash>.js
```

### Deployment Options

#### 1. **Vercel** (Recommended for React)

```bash
npm install -g vercel
vercel
# Automatically detects Vite, builds and deploys
```

#### 2. **Netlify**

```bash
npm run build
netlify deploy --prod --dir=dist
```

#### 3. **Docker**

```dockerfile
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 4. **AWS S3 + CloudFront**

```bash
npm run build
aws s3 sync dist/ s3://my-bucket/app
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### Environment Variables

```.env.local
VITE_API_URL=http://localhost:8000
VITE_API_KEY=qg_org_abc123  # For local testing only
```

Production:

```bash
VITE_API_URL=https://api.mybank.com
# API_KEY is NOT set; users login with their own key
```

---

## TESTING STRATEGY

### Unit Tests (Components)

```javascript
// __tests__/Button.test.jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../components/Button";

describe("Button", () => {
  it("renders button text", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: /click me/i }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
```

### Integration Tests (Pages)

```javascript
// __tests__/SendTokens.integration.test.jsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendTokens } from "../pages/SendTokens";

// Mock API
jest.mock("../api/client", () => ({
  api: {
    transfer: jest.fn(),
    getTransaction: jest.fn(),
  },
}));

describe("SendTokens", () => {
  it("submits transfer form", async () => {
    render(<SendTokens />);

    await userEvent.type(screen.getByPlaceholderText(/recipient/i), "0x789...");
    await userEvent.type(screen.getByPlaceholderText(/amount/i), "10");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(api.transfer).toHaveBeenCalledWith(
        expect.any(String),
        "0x789...",
        10,
      );
    });
  });
});
```

### E2E Tests (Cypress)

```javascript
// cypress/e2e/transfer.cy.js
describe("Transfer Flow", () => {
  beforeEach(() => {
    cy.visit("http://localhost:5173");
    cy.login("qg_org_abc123"); // Custom command
  });

  it("should complete a transfer", () => {
    cy.visit("/send");
    cy.get('[placeholder*="Recipient"]').type("0x789...");
    cy.get('[placeholder*="Amount"]').type("5");
    cy.contains("button", "Send").click();

    cy.contains(/transfer submitted/i).should("be.visible");

    // Poll for confirmation
    cy.contains(/confirmed/i, { timeout: 30000 }).should("be.visible");
  });
});
```

### Smoke Tests

```bash
npm run test:smoke

# Runs: npm run lint && npm run build
# Ensures code quality + build success
```

---

## TROUBLESHOOTING

### 1. "Cannot find module 'react'"

```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### 2. "Port 5173 already in use"

```bash
# Solution: Use different port
npm run dev -- --port 5174
```

### 3. "API calls returning 401"

```javascript
// Debug: Check API key is stored
console.log(sessionStorage.getItem("api_key"));

// Check Authorization header is sent
// Network tab → Headers: Authorization: Bearer ...
```

### 4. "Pydantic error detail is array, not string"

```javascript
// Solution: Use extractErrorMessage() utility
import { extractErrorMessage } from "./api/client";

const message = extractErrorMessage(err.response.data);
// Handles both string and array formats
```

### 5. "Wallet balance not updating"

```jsx
// Solution: Polling interval too infrequent
// Increase polling frequency or add manual refresh button

useEffect(() => {
  const interval = setInterval(() => {
    fetchWallet(userId); // Poll every 5s
  }, 5000); // Not 30000+

  return () => clearInterval(interval);
}, [userId, fetchWallet]);
```

### 6. "CSS not applying (Tailwind not working)"

```bash
# Ensure tailwind is configured
npx tailwindcss init -p

# Check content paths in tailwind.config.js
content: ['./src/**/*.{jsx,js}']

# Rebuild if needed
npm run build
```

---

## QUICK REFERENCE

### Common Patterns

**Fetch + Render Pattern**:

```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.getData();
      setData(res.data);
    } catch (err) {
      setError(err.readableMessage);
    } finally {
      setLoading(false);
    }
  };
  fetch();
}, []);

return loading ? <Spinner /> : <Component data={data} />;
```

**Form Submission Pattern**:

```jsx
const [value, setValue] = useState("");
const [loading, setLoading] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    await api.submit(value);
    setValue(""); // Reset
  } catch (err) {
    setError(err.readableMessage);
  } finally {
    setLoading(false);
  }
};
```

**Error Handling Pattern**:

```jsx
try {
  // API call
} catch (err) {
  // err.readableMessage is set by response interceptor
  setError(err.readableMessage);
  return <ErrorAlert>{error}</ErrorAlert>;
}
```

---

**End of Module 2 Report**
