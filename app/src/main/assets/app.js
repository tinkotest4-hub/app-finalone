/* ========= EdgeApp – multi-page offline demo ========= */

/* ---------- Tiny utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmt = (n) => (n < 0 ? "-$" + Math.abs(n).toFixed(2) : "$" + n.toFixed(2));
const now = () => Date.now();
const minutes = (m) => m * 60 * 1000;

/* Centralized navigation helper (works in Android WebView & browser) */
function navigate(page) {
  try {
    window.location.href = page;
  } catch {
    // very defensive: still try fallback
    location.assign(page);
  }
}

function toast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const messageEl = toast.querySelector('.toast-message');
  if (!messageEl) return;
  messageEl.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* ---------- Storage Layer (sessionStorage) ---------- */
const KEYS = {
  users: "users",
  session: "isLoggedIn",
  userType: "userType",
  userEmail: "userEmail",
  balances: (uid) => `balances_${uid}`,
  trades: (uid) => `trades_${uid}`,
  deposits: (uid) => `deposits_${uid}`,
  withdrawals: (uid) => `withdrawals_${uid}`,
  counters: (uid) => `counters_${uid}`
};

const Store = {
  getUsers() { 
    return JSON.parse(sessionStorage.getItem(KEYS.users) || "[]"); 
  },
  
  setUsers(list) { 
    sessionStorage.setItem(KEYS.users, JSON.stringify(list)); 
  },
  
  login(email, password) {
    const users = this.getUsers();
    
    // Check demo accounts first
    if (email === "admin@primeedge.com" && password === "admin123") {
      this.setSession("admin", email);
      return { success: true, userType: "admin" };
    }
    
    if (email === "demo@primeedge.com" && password === "demo123") {
      this.setSession("user", email);
      return { success: true, userType: "user" };
    }
    
    // Check registered users
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      this.setSession("user", email);
      return { success: true, userType: "user" };
    }
    
    return { success: false, error: "Invalid email or password" };
  },
  
  register(userData) {
    const users = this.getUsers();
    
    // Check if email exists
    if (users.some(user => user.email === userData.email)) {
      return { success: false, error: "Email already registered" };
    }
    
    // Add new user
    users.push(userData);
    this.setUsers(users);
    
    // Auto login after registration
    this.setSession("user", userData.email);
    
    return { success: true };
  },
  
  setSession(userType, email) {
    sessionStorage.setItem(KEYS.session, "true");
    sessionStorage.setItem(KEYS.userType, userType);
    sessionStorage.setItem(KEYS.userEmail, email);
    localStorage.setItem(KEYS.session, JSON.stringify({ userType, email }));
  },
  
  clearSession() {
    sessionStorage.removeItem(KEYS.session);
    sessionStorage.removeItem(KEYS.userType);
    sessionStorage.removeItem(KEYS.userEmail);
    localStorage.removeItem(KEYS.session);
  },
  
  isLoggedIn() {
    return sessionStorage.getItem(KEYS.session) === "true" || localStorage.getItem(KEYS.session) !== null;
  },

  getSession() {
    const raw = localStorage.getItem(KEYS.session);
    return raw ? JSON.parse(raw) : null;
  },

  getBalances(uid) {
    const raw = localStorage.getItem(KEYS.balances(uid));
    return raw ? JSON.parse(raw) : { total: 0, deposit: 0, trading: 0, locked: 0 };
  },
  setBalances(uid, bal) {
    bal.total = Math.round((bal.deposit + bal.trading) * 100) / 100;
    localStorage.setItem(KEYS.balances(uid), JSON.stringify(bal));
  },

  getTrades(uid) { return JSON.parse(localStorage.getItem(KEYS.trades(uid)) || "[]"); },
  setTrades(uid, arr) { localStorage.setItem(KEYS.trades(uid), JSON.stringify(arr)); },

  getDeposits(uid) { return JSON.parse(localStorage.getItem(KEYS.deposits(uid)) || "[]"); },
  setDeposits(uid, list) { localStorage.setItem(KEYS.deposits(uid), JSON.stringify(list)); },

  getWithdrawals(uid) { return JSON.parse(localStorage.getItem(KEYS.withdrawals(uid)) || "[]"); },
  setWithdrawals(uid, list) { localStorage.setItem(KEYS.withdrawals(uid), JSON.stringify(list)); },

  getCounters(uid) { return JSON.parse(localStorage.getItem(KEYS.counters(uid)) || "{\"tradeCount\":0}"); },
  setCounters(uid, obj) { localStorage.setItem(KEYS.counters(uid), JSON.stringify(obj)); },

  // Deposit and Withdrawal functions
  deposit(uid, amount) {
    const balances = this.getBalances(uid);
    balances.deposit += parseFloat(amount);
    balances.total = balances.deposit + balances.trading;
    this.setBalances(uid, balances);

    const deposits = this.getDeposits(uid);
    deposits.push({
      id: sid(),
      amount: parseFloat(amount),
      status: 'completed',
      timestamp: Date.now()
    });
    this.setDeposits(uid, deposits);
    return { success: true };
  },

  withdraw(uid, amount) {
    const balances = this.getBalances(uid);
    amount = parseFloat(amount);
    
    if (balances.deposit < amount) {
      return { success: false, error: "Insufficient balance for withdrawal" };
    }

    balances.deposit -= amount;
    balances.total = balances.deposit + balances.trading;
    this.setBalances(uid, balances);

    const withdrawals = this.getWithdrawals(uid);
    withdrawals.push({
      id: sid(),
      amount: amount,
      status: 'completed',
      timestamp: Date.now()
    });
    this.setWithdrawals(uid, withdrawals);
    return { success: true };
  },

  transfer(uid, fromAccount, toAccount, amount) {
    const balances = this.getBalances(uid);
    amount = parseFloat(amount);

    if (fromAccount === 'deposit' && toAccount === 'trading') {
      if (balances.deposit < amount) {
        return { success: false, error: "Insufficient deposit balance" };
      }
      balances.deposit -= amount;
      balances.trading += amount;
    } else if (fromAccount === 'trading' && toAccount === 'deposit') {
      if (balances.trading < amount) {
        return { success: false, error: "Insufficient trading balance" };
      }
      balances.trading -= amount;
      balances.deposit += amount;
    } else {
      return { success: false, error: "Invalid account type" };
    }

    balances.total = balances.deposit + balances.trading;
    this.setBalances(uid, balances);
    return { success: true };
  }
};

/* ---------- Seed demo accounts (first run) ---------- */
(function seed() {
  let users = Store.getUsers();
  const ensure = (email, user) => {
    if (!users.find(u => u.email.toLowerCase() === email)) {
      users.push(user);
      Store.setUsers(users);
      Store.setBalances(user.id, { total: 20000, deposit: 10000, trading: 10000, locked: 0 });
      Store.setCounters(user.id, { tradeCount: 0 });
      users = Store.getUsers();
    }
  };
  ensure("demo@primeedge.com", {
    id: sid(), name: "Demo User", email: "demo@primeedge.com",
    password: "demo123", role: "user", createdAt: now()
  });
  ensure("admin@primeedge.com", {
    id: sid(), name: "Admin", email: "admin@primeedge.com",
    password: "admin123", role: "admin", createdAt: now()
  });
})();

function sid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4);
}

/* ---------- Markets (simulated) ---------- */
let PAIRS = [
  // Cryptocurrencies
  { sym: "BTC/USD", buy: 63520.12, sell: 63510.44, category: "crypto" },
  { sym: "ETH/USD", buy: 2790.45, sell: 2788.10, category: "crypto" },
  { sym: "BNB/USD", buy: 585.22, sell: 584.61, category: "crypto" },
  { sym: "SOL/USD", buy: 145.30, sell: 144.92, category: "crypto" },
  { sym: "XRP/USD", buy: 0.5922, sell: 0.5920, category: "crypto" },
  { sym: "ADA/USD", buy: 0.4855, sell: 0.4852, category: "crypto" },
  { sym: "DOT/USD", buy: 7.25, sell: 7.24, category: "crypto" },
  { sym: "DOGE/USD", buy: 0.1325, sell: 0.1324, category: "crypto" },
  // Forex
  { sym: "EUR/USD", buy: 1.0915, sell: 1.0913, category: "forex" },
  { sym: "GBP/USD", buy: 1.2812, sell: 1.2809, category: "forex" },
  { sym: "USD/JPY", buy: 148.23, sell: 148.21, category: "forex" },
  { sym: "AUD/USD", buy: 0.7425, sell: 0.7423, category: "forex" },
  { sym: "USD/CAD", buy: 1.3245, sell: 1.3243, category: "forex" },
  { sym: "USD/CHF", buy: 0.9155, sell: 0.9153, category: "forex" },
  // Commodities
  { sym: "XAU/USD", buy: 2432.80, sell: 2431.10, category: "commodity" },
  { sym: "XAG/USD", buy: 28.45, sell: 28.42, category: "commodity" },
  { sym: "OIL/USD", buy: 82.35, sell: 82.32, category: "commodity" },
  { sym: "GAS/USD", buy: 3.250, sell: 3.248, category: "commodity" },
  // Stocks
  { sym: "AAPL/USD", buy: 224.22, sell: 224.00, category: "stock" },
  { sym: "TSLA/USD", buy: 192.11, sell: 191.89, category: "stock" },
  { sym: "MSFT/USD", buy: 425.65, sell: 425.45, category: "stock" },
  { sym: "AMZN/USD", buy: 178.35, sell: 178.25, category: "stock" },
  { sym: "GOOGL/USD", buy: 155.80, sell: 155.70, category: "stock" },
  { sym: "META/USD", buy: 425.50, sell: 425.30, category: "stock" },
  { sym: "NVDA/USD", buy: 890.45, sell: 890.25, category: "stock" }
];

function nudgePrices() {
  PAIRS = PAIRS.map(p => {
    // Calculate volatility based on category and price range
    let volatility;
    switch (p.category) {
      case "crypto":
        volatility = p.buy > 1000 ? 2 : p.buy > 100 ? 0.5 : p.buy > 1 ? 0.01 : 0.0001;
        break;
      case "forex":
        volatility = 0.0002;
        break;
      case "commodity":
        volatility = p.buy > 1000 ? 0.5 : 0.02;
        break;
      case "stock":
        volatility = p.buy > 500 ? 0.3 : 0.1;
        break;
      default:
        volatility = 0.01;
    }

    // Add random drift with momentum
    const momentum = Math.random() > 0.5 ? 1 : -1;
    const drift = (Math.random() * volatility) * momentum;
    
    // Calculate new prices
    const buy = +(p.buy + drift).toFixed(4);
    const spread = p.buy > 1000 ? 0.5 : p.buy > 100 ? 0.2 : p.buy > 1 ? 0.002 : 0.0002;
    const sell = +(buy - spread).toFixed(4);
    
    // Add trend direction for UI
    const trend = drift > 0 ? 'up' : 'down';
    
    return { ...p, buy, sell, trend };
  });
}

/* ---------- Session helpers & guards ---------- */
function currentUser() {
  const session = Store.getSession();
  if (!session) return null;
  
  if (session.email === "demo@primeedge.com") {
    return {
      id: "demo",
      name: "Demo User",
      email: "demo@primeedge.com",
      role: "user"
    };
  }
  
  if (session.email === "admin@primeedge.com") {
    return {
      id: "admin",
      name: "Admin",
      email: "admin@primeedge.com",
      role: "admin"
    };
  }
  
  const users = Store.getUsers();
  return users.find(u => u.email === session.email) || null;
}

function requireAuth() {
  const session = Store.getSession();
  if (!Store.isLoggedIn() || !session) {
    Store.clearSession();
    navigate("login.html");
    return false;
  }
  return true;
}

function requireGuest() {
  if (Store.isLoggedIn()) {
    const userType = Store.getSession()?.userType || sessionStorage.getItem(KEYS.userType);
    navigate(userType === "admin" ? "admin.html" : "dashboard.html");
    return false;
  }
  return true;
}

function requireAdmin() {
  const session = Store.getSession();
  if (!Store.isLoggedIn() || !session) {
    Store.clearSession();
    navigate("login.html");
    return false;
  }
  
  if (session.userType !== "admin") {
    navigate("dashboard.html");
    return false;
  }
  
  return true;
}

/* ---------- Header setup (on protected pages) ---------- */
function setupAppBar() {
  const bar = $("#appBar");
  if (!bar) return;
  const me = currentUser();
  if (!me) return;

  // Setup bottom navigation
  if (!$(".bottom-nav")) {
    const bottomNav = document.createElement('nav');
    bottomNav.className = 'bottom-nav';
    bottomNav.innerHTML = `
      <a href="#" class="bottom-nav-item active">
        <i class="fas fa-home bottom-nav-icon"></i>
        <span>Home</span>
      </a>
      <a href="#" class="bottom-nav-item">
        <i class="fas fa-exchange-alt bottom-nav-icon"></i>
        <span>Trade</span>
      </a>
      <a href="#" class="bottom-nav-item">
        <i class="fas fa-wallet bottom-nav-icon"></i>
        <span>Wallet</span>
      </a>
      <a href="#" class="bottom-nav-item logout-btn">
        <i class="fas fa-sign-out-alt bottom-nav-icon"></i>
        <span>Logout</span>
      </a>
    `;
    document.body.appendChild(bottomNav);
    
    // Add logout functionality
    bottomNav.querySelector('.logout-btn').addEventListener('click', (e) => {
      e.preventDefault();
      Store.clearSession();
      navigate("welcome.html");
    });
  }

  // Add welcome message and live status to the header
  const headerContent = `
    <div class="header-content">
      <div class="welcome-section">
        <span class="welcome-text">Welcome, ${me.name}</span>
        <div class="live-indicator">
          <span class="live-dot"></span>
          <span class="live-text">LIVE</span>
        </div>
      </div>
      <div class="header-controls">
        <a href="login.html" class="header-icon-btn">
          <i class="fas fa-sign-in-alt"></i>
        </a>
        <a href="settings.html" class="header-icon-btn">
          <i class="fas fa-cog"></i>
        </a>
        ${me.role === "admin" ? '<a href="admin.html" id="adminLink">Admin</a>' : ''}
        <button id="logoutBtn" class="header-logout-btn">Logout</button>
      </div>
    </div>
  `;

  // Insert the header content
  bar.innerHTML = headerContent;

  // Add styles
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
      height: 60px;
      background: rgba(30, 41, 59, 0.95);
    }
    .welcome-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .welcome-text {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .live-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(34, 197, 94, 0.2);
      padding: 4px 12px;
      border-radius: 16px;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .live-dot {
      width: 6px;
      height: 6px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    .live-text {
      color: #22c55e;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-logout-btn {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 6px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .header-logout-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.3);
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(styleEl);

  // Add logout handler
  $("#logoutBtn")?.addEventListener("click", () => {
    Store.clearSession();
    navigate("welcome.html");
  });
}

/* ---------- Auth (login / signup) ---------- */
function onLoginPage() {
  if (!requireGuest()) return;
  const form = $("#loginForm");
  const email = $("#loginEmail");
  const pass = $("#loginPassword");
  const msg = $("#loginMsg");
  $("#demoHint") && ($("#demoHint").innerHTML = `Demo: <b>demo@edgeapp.com</b> / <b>Demo@123</b>`);
  $("#adminHint") && ($("#adminHint").innerHTML = `Admin: <b>admin@edgeapp.com</b> / <b>Admin@123</b>`);

  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const users = Store.getUsers();
    const found = users.find(u =>
      u.email.toLowerCase() === email.value.trim().toLowerCase() &&
      u.password === pass.value
    );
    if (!found) {
      msg.textContent = "Invalid email or password.";
      msg.className = "msg error"; return;
    }
    Store.setSession(found);
    msg.textContent = "Welcome back!";
    msg.className = "msg success";
    setTimeout(() => navigate("dashboard.html"), 300);
  });
}

function onSignupPage() {
  if (!requireGuest()) return;
  const form = $("#signupForm");
  const name = $("#signupName");
  const email = $("#signupEmail");
  const pass = $("#signupPassword");
  const msg = $("#signupMsg");

  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (pass.value.length < 6) {
      msg.textContent = "Password must be at least 6 characters.";
      msg.className = "msg error"; return;
    }
    let users = Store.getUsers();
    if (users.find(u => u.email.toLowerCase() === email.value.trim().toLowerCase())) {
      msg.textContent = "An account with this email already exists.";
      msg.className = "msg error"; return;
    }
    const user = {
      id: sid(),
      name: name.value.trim(),
      email: email.value.trim().toLowerCase(),
      password: pass.value,
      role: "user",
      createdAt: now()
    };
    users.push(user); Store.setUsers(users);
    Store.setBalances(user.id, { total: 0, deposit: 0, trading: 0, locked: 0 });
    Store.setCounters(user.id, { tradeCount: 0 });
    Store.setSession(user);
    msg.textContent = "Account created! Redirecting…";
    msg.className = "msg success";
    setTimeout(() => navigate("dashboard.html"), 350);
  });
}

/* ---------- Dashboard ---------- */
function updateBalancesUI() {
  const me = currentUser(); if (!me) return;
  const b = Store.getBalances(me.id);
  $("#balTotal") && ($("#balTotal").textContent = fmt(b.total));
  $("#balDeposit") && ($("#balDeposit").textContent = fmt(b.deposit));
  $("#balTrading") && ($("#balTrading").textContent = fmt(b.trading));
  $("#balLocked") && ($("#balLocked").textContent = fmt(b.locked || 0));
}

function renderPairsSelect() {
  const sel = $("#tradePair"); if (!sel) return;
  
  // Add quick trade form styling
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    
    .quick-trade-container {
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 16px;
      background: rgba(30, 41, 59, 0.7);
      border-radius: 12px;
      margin-bottom: 80px;
    }
    
    .trading-pair-wrapper {
      position: relative;
      margin-bottom: 20px;
    }
    
    #tradePair {
      width: 100%;
      padding: 14px;
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 8px;
      color: #fff;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1rem;
      font-weight: 500;
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
    }
    
    #tradePair option {
      padding: 10px;
      background: #2a2a2a;
      color: #fff;
      font-size: 0.95rem;
    }
    
    .trading-pair-wrapper:after {
      content: '';
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #fff;
      pointer-events: none;
    }
    
    @media (max-width: 768px) {
      .quick-trade-container {
        padding: 12px;
      }
      #tradePair {
        font-size: 0.9rem;
        padding: 12px;
      }
      #tradePair option {
        font-size: 0.85rem;
      }
    }
      justify-content: space-between;
      align-items: center;
    }
    .welcome-message {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .welcome-text {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .live-status {
      background: #22c55e;
      color: #f0fdf4;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .live-status::before {
      content: '';
      display: block;
      width: 6px;
      height: 6px;
      background: #f0fdf4;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    .logout-btn {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.3);
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    /* Enhanced Container Styles */
    .quick-trade-container {
      background: linear-gradient(to bottom, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
      border-radius: 16px;
      padding: max(16px, min(24px, 4vw));
      margin: 16px auto;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(148, 163, 184, 0.1);
      max-width: 1200px;
      width: 100%;
    }

    /* Enhanced Typography */
    .quick-trade-header {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: clamp(18px, 3vw, 24px);
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: clamp(16px, 3vw, 24px);
      letter-spacing: -0.02em;
    }

    /* Responsive Grid Layout */
    .trade-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: clamp(12px, 2vw, 20px);
      margin-bottom: 20px;
    }

    /* Bottom Navigation Enhancement */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(10px);
      border-top: 1px solid rgba(148, 163, 184, 0.1);
      padding: 12px 16px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      z-index: 1000;
    }

    .bottom-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: #94a3b8;
      text-decoration: none;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 500;
      padding: 8px 12px;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .bottom-nav-item:hover,
    .bottom-nav-item.active {
      color: #e2e8f0;
      background: rgba(51, 65, 85, 0.5);
    }

    .bottom-nav-item i {
      font-size: 20px;
    }
    .quick-trade-header {
      font-size: 22px;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 20px;
      letter-spacing: -0.02em;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .trade-form-row {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    .trade-input-group {
      flex: 1;
      position: relative;
    }
    .trade-input-label {
      display: block;
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 8px;
      font-weight: 500;
      letter-spacing: 0.01em;
    }
    .trade-input {
      width: 100%;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      padding: 12px 16px;
      color: #e2e8f0;
      font-size: 15px;
      font-family: 'Inter', system-ui, sans-serif;
      transition: all 0.2s ease;
    }
    .trade-input:hover {
      border-color: rgba(148, 163, 184, 0.3);
      background: rgba(30, 41, 59, 0.6);
    }
    .trade-input:focus {
      border-color: #3b82f6;
      outline: none;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      background: rgba(30, 41, 59, 0.7);
    }
    select.trade-input {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 12px center;
      background-repeat: no-repeat;
      background-size: 20px 20px;
      padding-right: 40px;
    }
    select.trade-input {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
    }
    select.trade-input option {
      background-color: rgb(30, 41, 59);
      color: #e2e8f0;
      padding: 16px;
      font-size: 15px;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }
    select.trade-input option:hover {
      background-color: rgba(51, 65, 85, 0.95);
    }
    select.trade-input optgroup {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 12px;
      background-color: rgba(15, 23, 42, 0.95);
    }
    .pair-price-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: 12px;
    }
    .bid-box, .ask-box {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
    }
    .bid-box {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .ask-box {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    .trading-pair-select {
      position: relative;
      margin-bottom: 16px;
    }
    .trading-pair-select .trade-input {
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 14px 16px;
      background-color: rgba(30, 41, 59, 0.8);
      font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
      font-size: 15px;
    }
    .trading-pair-select .trade-input:hover {
      background-color: rgba(30, 41, 59, 0.9);
    }
    .trading-pair-select .trade-input option {
      padding: 12px 16px;
      line-height: 1.5;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }
    .duration-input {
      position: relative;
      display: flex;
      align-items: center;
      margin: 0 0 16px;
    }
    .duration-input .trade-input {
      padding-right: 60px;
      text-align: center;
      font-weight: 600;
      letter-spacing: 0.01em;
      font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
      font-size: 15px;
    }
    .duration-input::after {
      content: 'min';
      position: absolute;
      right: 16px;
      color: #94a3b8;
      font-size: 14px;
      font-weight: 500;
      pointer-events: none;
      font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
    }
    .pair-option-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
    }
    .pair-option-price {
      display: flex;
      gap: 12px;
      font-size: 14px;
      font-weight: 500;
    }
    .price-up {
      color: #22c55e;
      animation: priceUp 0.5s ease;
    }
    .price-down {
      color: #ef4444;
      animation: priceDown 0.5s ease;
    }
    @keyframes priceUp {
      from { color: #e2e8f0; }
      to { color: #22c55e; }
    }
    @keyframes priceDown {
      from { color: #e2e8f0; }
      to { color: #ef4444; }
    }
    .trade-pair-category {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 500;
      margin-left: 8px;
    }
    .pair-option-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    .pair-option-price {
      color: #94a3b8;
      font-size: 13px;
      font-weight: 500;
    }
    .sl-tp-container {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    .trade-input-group.amount-input::before {
      content: '$';
      position: absolute;
      left: 16px;
      top: 38px;
      color: #94a3b8;
      font-size: 15px;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .trade-input-group.amount-input .trade-input {
      padding-left: 28px;
    }
    .trade-actions {
      display: flex;
      gap: 16px;
      margin-top: 24px;
    }
    .trade-btn {
      flex: 1;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      font-family: 'Inter', system-ui, sans-serif;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .trade-btn.buy {
      background: #22c55e;
      color: #f0fdf4;
      border: none;
    }
    .trade-btn.buy:hover {
      background: #16a34a;
    }
    .trade-btn.sell {
      background: #ef4444;
      color: #fef2f2;
      border: none;
    }
    .trade-btn.sell:hover {
      background: #dc2626;
    }
    @media (max-width: 768px) {
      .quick-trade-container {
        padding: 16px;
        margin-bottom: 16px;
      }
      .trade-form-row,
      .sl-tp-container {
        flex-direction: column;
        gap: 16px;
      }
      .trade-actions {
        flex-direction: column;
        gap: 12px;
      }
      .trade-btn {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(styleEl);
  
  // Update select options
  sel.innerHTML = "";
  
  // Group pairs by category
  const groupedPairs = PAIRS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  // Add grouped options with enhanced formatting
  const categories = ['crypto', 'forex', 'commodity', 'stock'];
  categories.forEach(category => {
    if (groupedPairs[category]?.length) {
      const group = document.createElement('optgroup');
      group.label = category.toUpperCase();
      
      groupedPairs[category].forEach(p => {
        const o = document.createElement("option");
        o.value = p.sym;
        o.innerHTML = `
          <div class="pair-option-content">
            <span class="pair-symbol">${p.sym}</span>
            <div class="pair-price-tag">
              <span class="bid-box">Bid: ${p.buy.toFixed(4)}</span>
              <span class="ask-box">Ask: ${p.sell.toFixed(4)}</span>
            </div>
          </div>`;
        group.appendChild(o);
      });
      
      sel.appendChild(group);
    }
  });
  
  // Create Stop Loss and Take Profit inputs if they don't exist
  const tradeForm = sel.closest('form');
  if (tradeForm) {
    const slTpContainer = document.createElement('div');
    slTpContainer.className = 'sl-tp-container';
    slTpContainer.innerHTML = `
      <div class="trade-input-group">
        <label class="trade-input-label" for="stopLoss">Stop Loss</label>
        <input type="number" id="stopLoss" class="trade-input" step="0.0001" placeholder="Stop Loss price">
      </div>
      <div class="trade-input-group">
        <label class="trade-input-label" for="takeProfit">Take Profit</label>
        <input type="number" id="takeProfit" class="trade-input" step="0.0001" placeholder="Take Profit price">
      </div>
    `;
    
    // Insert after the amount input
    const amountInput = tradeForm.querySelector('#tradeAmount');
    if (amountInput) {
      amountInput.parentNode.insertBefore(slTpContainer, amountInput.nextSibling);
    }
  }
}

function renderMarkets() {
  const root = $("#markets"); if (!root) return;
  
  // Group pairs by category
  const groupedPairs = PAIRS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});
  
  root.innerHTML = `
    <style>
      .markets-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 0.5rem;
        max-height: 600px;
        overflow-y: auto;
      }
      .market-category {
        padding: 12px;
        font-size: 14px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: rgba(30, 41, 59, 0.5);
        border-radius: 8px 8px 0 0;
      }
      .market-rows {
        background: rgba(15, 23, 42, 0.3);
        border-radius: 0 0 8px 8px;
        overflow: hidden;
      }
      .market-row {
        display: flex;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        cursor: pointer;
        transition: all 0.2s ease;
        background: rgba(30, 41, 59, 0.4);
      }
      .market-row:last-child {
        border-bottom: none;
      }
      .market-row:hover {
        background: rgba(51, 65, 85, 0.5);
      }
      .pair-info {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .pair-symbol {
        font-size: 15px;
        font-weight: 600;
        color: #e2e8f0;
        font-family: 'Inter', system-ui, sans-serif;
      }
      .pair-category {
        font-size: 12px;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .price-container {
        display: flex;
        gap: 24px;
        align-items: center;
      }
      .bid-price, .ask-price {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        min-width: 100px;
      }
      .price-label {
        font-size: 12px;
        color: #94a3b8;
        font-weight: 500;
      }
      .price-value {
        font-size: 15px;
        font-weight: 600;
        font-family: 'Inter', system-ui, sans-serif;
        color: #e2e8f0;
      }
      .tick-up .price-value { 
        color: #22c55e; 
        animation: tickUp 0.5s ease;
      }
      .tick-down .price-value { 
        color: #ef4444;
        animation: tickDown 0.5s ease;
      }
      
      @media (max-width: 768px) {
        .market-row {
          padding: 12px;
        }
        .price-container {
          gap: 16px;
        }
        .bid-price, .ask-price {
          min-width: 80px;
        }
        .pair-symbol {
          font-size: 14px;
        }
        .price-value {
          font-size: 14px;
        }
      }
      @keyframes tickUp {
        from { color: inherit; }
        to { color: #22c55e; }
      }
      @keyframes tickDown {
        from { color: inherit; }
        to { color: #ef4444; }
      }
    </style>
  `;
  
  ['crypto', 'forex', 'commodity', 'stock'].forEach(category => {
    if (!groupedPairs[category]?.length) return;
    
    const categorySection = document.createElement('div');
    categorySection.className = 'market-category-section';
    categorySection.innerHTML = `
      <div class="market-category">${category.toUpperCase()}</div>
      <div class="market-rows">
        ${groupedPairs[category].map(p => `
          <div class="market-row" data-pair="${p.sym}">
            <div class="pair-info">
              <span class="pair-symbol">${p.sym}</span>
              <span class="pair-category">${p.category}</span>
            </div>
            <div class="price-container">
              <div class="bid-price ${p.trend}">
                <span class="price-label">Bid</span>
                <span class="price-value ${p.trend === 'up' ? 'price-up' : p.trend === 'down' ? 'price-down' : ''}">${p.buy.toFixed(4)}</span>
              </div>
              <div class="ask-price ${p.trend}">
                <span class="price-label">Ask</span>
                <span class="price-value ${p.trend === 'up' ? 'price-up' : p.trend === 'down' ? 'price-down' : ''}">${p.sell.toFixed(4)}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    root.appendChild(categorySection);
  });

  root.addEventListener("click", (e) => {
    const row = e.target.closest(".market-row");
    if (!row) return;
    const pair = row.dataset.pair;
    const pairData = PAIRS.find(p => p.sym === pair);
    if (!pairData) return;

    // Update quick trade form
    const tradePairEl = $("#tradePair");
    if (tradePairEl) {
      tradePairEl.value = pair;
      
      // Set default stop loss and take profit
      const currentPrice = pairData.buy;
      const stopLossEl = $("#stopLoss");
      const takeProfitEl = $("#takeProfit");
      
      if (stopLossEl) {
        stopLossEl.value = (currentPrice * 0.98).toFixed(4); // 2% below
      }
      if (takeProfitEl) {
        takeProfitEl.value = (currentPrice * 1.02).toFixed(4); // 2% above
      }
      
      $("#tradeMsg").textContent = `Selected ${pair}`;
      
      // Smooth scroll to quick trade form
      const quickTradeForm = tradePairEl.closest('form');
      if (quickTradeForm) {
        quickTradeForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $("#tradeAmount")?.focus();
      }
    }
  });
}

function startMarketTicker() {
  const root = $("#markets");
  if (!root) return;
  
  // Add click handler for market rows
  root.addEventListener("click", (e) => {
    const row = e.target.closest(".market-row");
    if (!row) return;
    const pair = row.dataset.pair;
    const pairData = PAIRS.find(p => p.sym === pair);
    if (!pairData) return;
    
    // Update quick trade form
    const tradePairEl = $("#tradePair");
    if (tradePairEl) {
      tradePairEl.value = pair;
      $("#tradeMsg").textContent = `Selected ${pair}`;
      
      // Set default stop loss and take profit based on current price
      const currentPrice = pairData.buy;
      if ($("#stopLoss")) {
        $("#stopLoss").value = (currentPrice * 0.98).toFixed(4); // 2% below
      }
      if ($("#takeProfit")) {
        $("#takeProfit").value = (currentPrice * 1.02).toFixed(4); // 2% above
      }
      
      // Focus amount input for quick trading
      $("#tradeAmount")?.focus();
    }
  });

  setInterval(() => {
    const prev = Object.fromEntries(PAIRS.map(p => [p.sym, { buy: p.buy, sell: p.sell }]));
    nudgePrices();
    
    // Update UI with micro-animations
    $$(".market-row", root).forEach((row, i) => {
      const p = PAIRS[i], old = prev[p.sym];
      if (!old) return;
      
      const bidEl = row.querySelector(".bid-price .price-value");
      const askEl = row.querySelector(".ask-price .price-value");
      const bidPrice = row.querySelector(".bid-price");
      const askPrice = row.querySelector(".ask-price");
      
      if (bidEl && askEl) {
        const buyUp = p.buy > old.buy;
        const sellUp = p.sell > old.sell;
        
        bidEl.textContent = p.buy.toFixed(4);
        askEl.textContent = p.sell.toFixed(4);
        
        bidPrice.classList.remove("tick-up", "tick-down");
        askPrice.classList.remove("tick-up", "tick-down");
        
        bidPrice.classList.add(buyUp ? "tick-up" : "tick-down");
        askPrice.classList.add(sellUp ? "tick-up" : "tick-down");
        
        setTimeout(() => {
          bidPrice.classList.remove("tick-up", "tick-down");
          askPrice.classList.remove("tick-up", "tick-down");
        }, 400);
      }
    });
  }, 1500);
}

/* 1-in-4 win logic helper */
function nextIsWin(uid) {
  const c = Store.getCounters(uid);
  const n = (c.tradeCount || 0) + 1;
  c.tradeCount = n; Store.setCounters(uid, c);
  return n % 4 === 0; // every 4th trade wins
}

function scheduleTradeSettlement(uid) {
  // Tick open trades; settle on expiry
  setInterval(() => {
    const trades = Store.getTrades(uid);
    let changed = false;
    const bal = Store.getBalances(uid);
    trades.forEach(t => {
      if (t.status === "open") {
        const remaining = t.settleAt - now();
        if (remaining <= 0) {
          // Settle
          t.status = "closed";
          // Payout: win = +80% of amount, loss = -100% of amount
          const payout = t.result === "win" ? +(t.amount * 0.8).toFixed(2) : -t.amount;
          bal.trading = Math.max(0, +(bal.trading + payout).toFixed(2));
          changed = true;
        }
      }
    });
    if (changed) {
      Store.setTrades(uid, trades);
      Store.setBalances(uid, bal);
      updateBalancesUI();
      renderTrades(); // refresh list
    } else {
      // Still update countdown UI
      renderTradesCountdown();
    }
  }, 1000);
}

function placeTrade(side) {
  const me = currentUser(); if (!me) return;
  const pair = $("#tradePair").value;
  const amount = Number($("#tradeAmount").value);
  const durMin = Number($("#tradeTime").value);
  const stopLoss = Number($("#stopLoss").value);
  const takeProfit = Number($("#takeProfit").value);
  const msg = $("#tradeMsg");
  if (!amount || amount < 10) { msg.textContent = "Minimum trade is $10."; msg.className = "msg error"; return; }

  const bal = Store.getBalances(me.id);
  if (amount > bal.trading) { msg.textContent = "Not enough trading balance. Convert or deposit."; msg.className = "msg error"; return; }
  
  if (stopLoss && takeProfit && stopLoss >= takeProfit) { 
    msg.textContent = "Stop Loss must be lower than Take Profit"; 
    msg.className = "msg error"; 
    return; 
  }

  const willWin = nextIsWin(me.id);
  const t = {
    id: sid(), 
    ts: now(), 
    pair, 
    side, 
    amount,
    stopLoss: stopLoss || null,
    takeProfit: takeProfit || null,
    duration: durMin, 
    settleAt: now() + minutes(durMin),
    status: "open", 
    result: willWin ? "win" : "loss"
  };
  const trades = Store.getTrades(me.id);
  trades.unshift(t); Store.setTrades(me.id, trades);
  msg.textContent = `Placed ${side.toUpperCase()} ${pair} for ${fmt(amount)} — ${durMin}m`;
  msg.className = "msg success";
  renderTrades();
}

function renderTrades() {
  const me = currentUser(); if (!me) return;
  const list = $("#tradesList"); if (!list) return;
  const trades = Store.getTrades(me.id);
  list.innerHTML = "";
  trades.forEach(t => {
    const row = document.createElement("div");
    const remaining = Math.max(0, Math.floor((t.settleAt - now())/1000));
    const mm = String(Math.floor(remaining/60)).padStart(2,"0");
    const ss = String(remaining%60).padStart(2,"0");
    const badgeClass = t.status === "open" ? "badge-open" : (t.result === "win" ? "badge-win" : "badge-loss");
    const statusText = t.status === "open" ? `Open ${mm}:${ss}` : (t.result === "win" ? "Won" : "Lost");
    row.className = "trade-row";
    row.innerHTML = `
      <div><b>${t.pair}</b> • ${t.side.toUpperCase()}</div>
      <div>${fmt(t.amount)}</div>
      <div>
        ${t.stopLoss ? `SL: ${fmt(t.stopLoss)}` : ''} 
        ${t.takeProfit ? `TP: ${fmt(t.takeProfit)}` : ''}
      </div>
      <div>${t.duration}m • ${new Date(t.ts).toLocaleString()}</div>
      <div><span class="badge-pill ${badgeClass}">${statusText}</span></div>
      <div class="tiny">${t.status === "open" ? "Awaiting result" : "Settled"}</div>
    `;
    list.appendChild(row);
  });
}
function renderTradesCountdown() {
  // Only updates clock text without rebuilding list
  const me = currentUser(); if (!me) return;
  const trades = Store.getTrades(me.id); if (!trades.length) return;
  const rows = $$(".trade-row");
  trades.forEach((t, i) => {
    if (!rows[i]) return;
    const badge = rows[i].querySelector(".badge-pill");
    if (!badge) return;
    if (t.status === "open") {
      const remaining = Math.max(0, Math.floor((t.settleAt - now())/1000));
      const mm = String(Math.floor(remaining/60)).padStart(2,"0");
      const ss = String(remaining%60).padStart(2,"0");
      badge.textContent = `Open ${mm}:${ss}`;
    }
  });
}

/* Convert */
function setupConvert() {
  const form = $("#convertForm"); if (!form) return;
  const dirSel = $("#convertDirection");
  const amt = $("#convertAmount");
  const msg = $("#convertMsg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const me = currentUser(); if (!me) return;
    const amount = Number(amt.value);
    if (!amount || amount <= 0) { msg.textContent = "Enter a valid amount."; msg.className = "msg error"; return; }
    const b = Store.getBalances(me.id);
    if (dirSel.value === "dep-to-trade") {
      if (amount > b.deposit) { msg.textContent = "Insufficient deposit balance."; msg.className = "msg error"; return; }
      b.deposit -= amount; b.trading += amount;
    } else {
      if (amount > b.trading) { msg.textContent = "Insufficient trading balance."; msg.className = "msg error"; return; }
      b.trading -= amount; b.deposit += amount;
    }
    Store.setBalances(me.id, b); updateBalancesUI();
    msg.textContent = "Conversion successful."; msg.className = "msg success"; amt.value = "";
  });
}

/* Dashboard init */
function renderWelcomeHeader() {
  const me = currentUser();
  if (!me) return;
  
  const header = document.createElement('div');
  header.className = 'welcome-header';
  header.innerHTML = `
    <div class="welcome-message">
      <span class="welcome-text">Welcome, ${me.name}</span>
      <span class="live-status">LIVE</span>
    </div>
    <button class="logout-btn">Logout</button>
  `;
  
  // Insert before the first element in the main container
  const container = document.querySelector('.container');
  if (container && container.firstChild) {
    container.insertBefore(header, container.firstChild);
  }
  
  // Add logout handler
  header.querySelector('.logout-btn').addEventListener('click', () => {
    Store.clearSession();
    navigate("welcome.html");
  });
}

function onDashboardPage() {
  if (!requireAuth()) return;
  
  // Add required styles for dashboard
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    /* Bottom Navigation */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1a1a1a;
      padding: 12px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
    }
    .bottom-nav-item {
      color: #888;
      text-decoration: none;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 0.85rem;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .bottom-nav-item.active {
      color: #fff;
    }
    .bottom-nav-icon {
      font-size: 1.5rem;
      margin-bottom: 4px;
    }
    /* Quick Trade Styles */
    .quick-trade-section {
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 16px;
      margin-bottom: 70px;
    }
    .quick-trade-section h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .trading-pair-select {
      width: 100%;
      padding: 12px;
      background: #2a2a2a;
      border: 1px solid #333;
      border-radius: 8px;
      color: #fff;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    .trading-pair-option {
      padding: 8px;
      font-size: 0.9rem;
    }
    @media (max-width: 768px) {
      .trading-pair-select {
        font-size: 0.9rem;
      }
    }
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: rgba(30, 41, 59, 0.95);
      border-radius: 12px;
      margin: 20px 0;
    }
    
    .welcome-group {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .welcome-text {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: #e2e8f0;
    }
    
    .live-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(34, 197, 94, 0.15);
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    
    .live-dot {
      width: 6px;
      height: 6px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    .live-text {
      color: #22c55e;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    
    .header-logout {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    
    .header-logout:hover {
      background: rgba(239, 68, 68, 0.2);
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(styleEl);
  
  setupAppBar();
  
  // Create and insert the main dashboard structure
  const mainContent = document.querySelector('.container');
  if (mainContent) {
    // Insert welcome header first
    const welcomeHeader = document.createElement('div');
    welcomeHeader.className = 'dashboard-header';
    welcomeHeader.innerHTML = `
      <div class="welcome-group">
        <span class="welcome-text">Welcome, ${currentUser()?.name || 'Trader'}</span>
        <div class="live-badge">
          <span class="live-dot"></span>
          <span class="live-text">LIVE</span>
        </div>
      </div>
      <button class="header-logout" id="headerLogout">Logout</button>
    `;
    mainContent.insertBefore(welcomeHeader, mainContent.firstChild);
    
    // Add logout handler
    document.getElementById('headerLogout')?.addEventListener('click', () => {
      Store.clearSession();
      navigate("welcome.html");
    });
    
    // Then continue with the main content
    mainContent.innerHTML += `
      <div class="welcome-header">
        <div class="welcome-message">
          <span class="welcome-text">Welcome, ${currentUser()?.name || 'Trader'}</span>
          <span class="live-status">LIVE</span>
        </div>
        <button class="logout-btn">Logout</button>
      </div>

      <div class="balance-cards">
        <!-- Balance cards will be updated by updateBalancesUI() -->
      </div>

      <div class="quick-trade-container">
        <h2 class="quick-trade-header">Quick Trade</h2>
        <form id="quickTradeForm">
          <div class="trade-form-row">
            <div class="trade-input-group trading-pair-select">
              <label class="trade-input-label">Trading Pair</label>
              <select id="tradePair" class="trade-input"></select>
            </div>
          </div>
          
          <div class="trade-form-row">
            <div class="trade-input-group amount-input">
              <label class="trade-input-label">Amount</label>
              <input type="number" id="tradeAmount" class="trade-input" step="1" min="10" placeholder="Enter amount">
            </div>
            <div class="trade-input-group duration-input">
              <label class="trade-input-label">Duration</label>
              <input type="number" id="tradeTime" class="trade-input" value="1" min="1" max="60">
            </div>
          </div>

          <div class="sl-tp-container">
            <div class="trade-input-group">
              <label class="trade-input-label">Stop Loss</label>
              <input type="number" id="stopLoss" class="trade-input" step="0.0001" placeholder="Stop Loss price">
            </div>
            <div class="trade-input-group">
              <label class="trade-input-label">Take Profit</label>
              <input type="number" id="takeProfit" class="trade-input" step="0.0001" placeholder="Take Profit price">
            </div>
          </div>

          <div class="trade-actions">
            <button type="button" id="buyBtn" class="trade-btn buy">Buy</button>
            <button type="button" id="sellBtn" class="trade-btn sell">Sell</button>
          </div>
        </form>
      </div>

      <div class="markets-container">
        <div id="markets">
          <!-- Markets will be populated by renderMarkets() -->
        </div>
      </div>
    `;
  }

  // Initialize all components
  updateBalancesUI();
  renderPairsSelect();
  renderMarkets();
  startMarketTicker();

  // Add logout handler
  document.querySelector('.logout-btn')?.addEventListener('click', () => {
    Store.clearSession();
    navigate("welcome.html");
  });
  renderTrades();
  setupConvert();
  $("#buyBtn")?.addEventListener("click", () => placeTrade("buy"));
  $("#sellBtn")?.addEventListener("click", () => placeTrade("sell"));
  // start settlement ticker
  scheduleTradeSettlement(currentUser().id);
}

/* ---------- Deposit ---------- */
function fakeAddress(asset) {
  const base = { "BTC":"bc1q", "ETH":"0x", "USDT-TRC20":"T", "USDC-TRC20":"T" }[asset] || "0x";
  return base + Math.random().toString(36).slice(2,12) + Math.random().toString(36).slice(2,10);
}
function renderMyDeposits() {
  const me = currentUser(); if (!me) return;
  const root = $("#myDeposits"); if (!root) return;
  const list = Store.getDeposits(me.id);
  root.innerHTML = list.length ? "" : `<p class="tiny">No deposits yet.</p>`;
  list.slice().reverse().forEach(d => {
    const row = document.createElement("div");
    const statusBadge = d.status === "approved" ? "badge-win" : (d.status === "rejected" ? "badge-loss" : "badge-open");
    row.className = "trade-row"; // reuse nice grid
    const remaining = Math.max(0, Math.floor((d.expiresAt - now())/1000));
    const mm = String(Math.floor(remaining/60)).padStart(2,"0");
    const ss = String(remaining%60).padStart(2,"0");
    row.innerHTML = `
      <div><b>${d.asset}</b> • ${fmt(d.amount)}</div>
      <div>${new Date(d.createdAt).toLocaleString()}</div>
      <div>${d.status === "pending" ? `Expires ${mm}:${ss}` : "—"}</div>
      <div class="address tiny">${d.address}</div>
      <div><span class="badge-pill ${statusBadge}">${d.status}</span></div>
      <div class="tiny">${d.txId || "—"}</div>
    `;
    root.appendChild(row);
  });
}
function onDepositPage() {
  if (!requireAuth()) return;
  setupAppBar(); updateBalancesUI(); renderMyDeposits();
  const me = currentUser();
  const form = $("#depositForm");
  const asset = $("#depositAsset"); const amt = $("#depositAmount"); const msg = $("#depositMsg");
  const genBox = $("#depositGenerated"); const addrEl = $("#depAddress"); const ctEl = $("#depCountdown");

  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number(amt.value); if (!amount || amount < 10) { msg.textContent = "Min 10 USD"; msg.className = "msg error"; return; }
    const address = fakeAddress(asset.value);
    const dep = { id: sid(), uid: me.id, asset: asset.value, amount, address, createdAt: now(), expiresAt: now() + minutes(10), status: "pending" };
    const list = Store.getDeposits(me.id); list.push(dep); Store.setDeposits(me.id, list);
    msg.textContent = "Deposit request created."; msg.className = "msg success";
    addrEl.textContent = address; genBox.classList.remove("hidden");
    amt.value = "";
    renderMyDeposits();
  });

  // Copy address
  $("#copyAddrBtn")?.addEventListener("click", async () => {
    const t = addrEl.textContent || "";
    try { await navigator.clipboard.writeText(t); toast("Address copied"); } catch {}
  });

  // Countdown tick
  setInterval(() => {
    const list = Store.getDeposits(me.id);
    // Update last generated timer on the instruction box
    const last = list[list.length - 1];
    if (last && last.status === "pending") {
      const secs = Math.max(0, Math.floor((last.expiresAt - now())/1000));
      const mm = String(Math.floor(secs/60)).padStart(2,"0");
      const ss = String(secs%60).padStart(2,"0");
      ctEl && (ctEl.textContent = `${mm}:${ss}`);
    }
    renderMyDeposits(); // refresh timers in list
  }, 1000);
}

/* ---------- Withdraw ---------- */
function renderMyWithdrawals() {
  const me = currentUser(); if (!me) return;
  const root = $("#myWithdrawals"); if (!root) return;
  const list = Store.getWithdrawals(me.id);
  root.innerHTML = list.length ? "" : `<p class="tiny">No withdrawals yet.</p>`;
  list.slice().reverse().forEach(w => {
    const statusBadge = w.status === "approved" ? "badge-win" : (w.status === "rejected" ? "badge-loss" : "badge-open");
    const row = document.createElement("div");
    row.className = "trade-row";
    row.innerHTML = `
      <div><b>${w.asset}</b> • ${fmt(w.amount)}</div>
      <div>${new Date(w.createdAt).toLocaleString()}</div>
      <div>${w.wallet.slice(0,10)}…</div>
      <div class="tiny">—</div>
      <div><span class="badge-pill ${statusBadge}">${w.status}</span></div>
      <div class="tiny">${w.txId || "—"}</div>
    `;
    root.appendChild(row);
  });
}
function onWithdrawPage() {
  if (!requireAuth()) return;
  setupAppBar(); updateBalancesUI(); renderMyWithdrawals();
  const me = currentUser();
  const form = $("#withdrawForm");
  const asset = $("#withdrawAsset"); const wallet = $("#withdrawWallet"); const amt = $("#withdrawAmount"); const msg = $("#withdrawMsg");

  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number(amt.value); if (!amount || amount < 10) { msg.textContent = "Min 10 USD"; msg.className = "msg error"; return; }
    const b = Store.getBalances(me.id);
    if (amount > b.deposit) { msg.textContent = "Insufficient deposit balance."; msg.className = "msg error"; return; }
    // Lock funds on request
    b.deposit -= amount; b.locked = +(b.locked || 0) + amount; Store.setBalances(me.id, b); updateBalancesUI();
    const w = { id: sid(), uid: me.id, asset: asset.value, wallet: wallet.value.trim(), amount, createdAt: now(), status: "pending" };
    const list = Store.getWithdrawals(me.id); list.push(w); Store.setWithdrawals(me.id, list);
    amt.value = ""; wallet.value = ""; msg.textContent = "Withdrawal request submitted."; msg.className = "msg success";
    renderMyWithdrawals();
  });
}

/* ---------- Admin ---------- */
function renderAdminTabs() {
  const btns = $$(".seg[data-admin-tab]");
  const panes = $$(".admin-pane");
  btns.forEach(b => b.addEventListener("click", () => {
    btns.forEach(x => x.classList.remove("active")); b.classList.add("active");
    panes.forEach(p => p.classList.add("hidden"));
    $(`#admin-${b.dataset.adminTab}`).classList.remove("hidden");
  }));
}
function renderAdminUsers() {
  const root = $("#admin-users"); if (!root) return;
  const users = Store.getUsers();
  let html = `
    <div class="form inline" style="margin-bottom:10px">
      <div class="label">Users: ${users.length}</div>
    </div>
    <div class="card" style="padding:0">
      <table class="table">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Role</th><th>Balances</th><th>Actions</th>
        </tr></thead><tbody>`;
  users.forEach(u => {
    const b = Store.getBalances(u.id);
    html += `<tr>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${u.role}</td>
      <td>T:${fmt(b.total)} • D:${fmt(b.deposit)} • Tr:${fmt(b.trading)} • L:${fmt(b.locked||0)}</td>
      <td>
        <button class="btn ghost" data-reset="${u.id}">Set Demo Balances</button>
        <button class="btn ghost" data-credit="${u.id}">Credit/Debit</button>
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  root.innerHTML = html;

  root.addEventListener("click", (e) => {
    const rs = e.target.closest("[data-reset]");
    if (rs) {
      const uid = rs.getAttribute("data-reset");
      Store.setBalances(uid, { total: 20000, deposit: 10000, trading: 10000, locked: 0 });
      toast("Demo balances set"); renderAdminUsers(); return;
    }
    const cr = e.target.closest("[data-credit]");
    if (cr) {
      const uid = cr.getAttribute("data-credit");
      const type = prompt("Type 'deposit' or 'trading' to adjust:");
      if (!type || !/^(deposit|trading)$/i.test(type)) return;
      const amt = Number(prompt("Enter amount: positive to credit, negative to debit:"));
      if (!amt) return;
      const b = Store.getBalances(uid);
      if (/^deposit$/i.test(type)) b.deposit = Math.max(0, +(b.deposit + amt).toFixed(2));
      else b.trading = Math.max(0, +(b.trading + amt).toFixed(2));
      Store.setBalances(uid, b); toast("Balance updated"); renderAdminUsers();
    }
  });
}

function listAllDeposits() {
  const users = Store.getUsers(); const rows = [];
  users.forEach(u => Store.getDeposits(u.id).forEach(d => rows.push({ ...d, user: u })));
  return rows.sort((a,b)=>a.createdAt-b.createdAt);
}
function listAllWithdrawals() {
  const users = Store.getUsers(); const rows = [];
  users.forEach(u => Store.getWithdrawals(u.id).forEach(w => rows.push({ ...w, user: u })));
  return rows.sort((a,b)=>a.createdAt-b.createdAt);
}

function renderAdminDeposits() {
  const root = $("#admin-deposits"); if (!root) return;
  const rows = listAllDeposits();
  let html = `<div class="card" style="padding:0"><table class="table">
    <thead><tr><th>User</th><th>Asset</th><th>Amount</th><th>Address</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
  rows.forEach(r => {
    html += `<tr>
      <td>${r.user.email}</td>
      <td>${r.asset}</td>
      <td>${fmt(r.amount)}</td>
      <td class="tiny">${r.address}</td>
      <td>${new Date(r.createdAt).toLocaleString()}</td>
      <td>${r.status}</td>
      <td>
        ${r.status==="pending"?`<button class="btn buy" data-approve-dep="${r.uid}|${r.id}">Approve</button>
        <button class="btn sell" data-reject-dep="${r.uid}|${r.id}">Reject</button>`:"—"}
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  root.innerHTML = html;

  root.addEventListener("click", (e) => {
    const a = e.target.closest("[data-approve-dep]");
    if (a) {
      const [uid,id] = a.getAttribute("data-approve-dep").split("|");
      const list = Store.getDeposits(uid);
      const d = list.find(x=>x.id===id); if (!d) return;
      d.status = "approved"; Store.setDeposits(uid, list);
      const b = Store.getBalances(uid); b.deposit += d.amount; Store.setBalances(uid, b);
      toast("Deposit approved"); renderAdminDeposits();
      return;
    }
    const r = e.target.closest("[data-reject-dep]");
    if (r) {
      const [uid,id] = r.getAttribute("data-reject-dep").split("|");
      const list = Store.getDeposits(uid);
      const d = list.find(x=>x.id===id); if (!d) return;
      d.status = "rejected"; Store.setDeposits(uid, list);
      toast("Deposit rejected"); renderAdminDeposits();
      return;
    }
  });
}

function renderAdminWithdrawals() {
  const root = $("#admin-withdrawals"); if (!root) return;
  const rows = listAllWithdrawals();
  let html = `<div class="card" style="padding:0"><table class="table">
    <thead><tr><th>User</th><th>Asset</th><th>Amount</th><th>Wallet</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
  rows.forEach(r => {
    html += `<tr>
      <td>${r.user.email}</td>
      <td>${r.asset}</td>
      <td>${fmt(r.amount)}</td>
      <td class="tiny">${r.wallet}</td>
      <td>${new Date(r.createdAt).toLocaleString()}</td>
      <td>${r.status}</td>
      <td>
        ${r.status==="pending"?`<button class="btn buy" data-approve-wdr="${r.uid}|${r.id}">Approve</button>
        <button class="btn sell" data-reject-wdr="${r.uid}|${r.id}">Reject</button>`:"—"}
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  root.innerHTML = html;

  root.addEventListener("click", (e) => {
    const a = e.target.closest("[data-approve-wdr]");
    if (a) {
      const [uid,id] = a.getAttribute("data-approve-wdr").split("|");
      const list = Store.getWithdrawals(uid);
      const w = list.find(x=>x.id===id); if (!w) return;
      w.status = "approved"; Store.setWithdrawals(uid, list);
      const b = Store.getBalances(uid);
      b.locked = Math.max(0, +(b.locked - w.amount).toFixed(2));
      Store.setBalances(uid, b);
      toast("Withdrawal approved"); renderAdminWithdrawals();
      return;
    }
    const r = e.target.closest("[data-reject-wdr]");
    if (r) {
      const [uid,id] = r.getAttribute("data-reject-wdr").split("|");
      const list = Store.getWithdrawals(uid);
      const w = list.find(x=>x.id===id); if (!w) return;
      w.status = "rejected"; Store.setWithdrawals(uid, list);
      const b = Store.getBalances(uid);
      // refund locked back to deposit
      b.locked = Math.max(0, +(b.locked - w.amount).toFixed(2));
      b.deposit = +(b.deposit + w.amount).toFixed(2);
      Store.setBalances(uid, b);
      toast("Withdrawal rejected & refunded"); renderAdminWithdrawals();
      return;
    }
  });
}

function onAdminPage() {
  if (!requireAdmin()) return;
  setupAppBar();
  renderAdminTabs();
  renderAdminUsers();
  renderAdminDeposits();
  renderAdminWithdrawals();
}

/* ---------- Settings ---------- */
function onSettingsPage() {
  if (!requireAuth()) return;
  setupAppBar();
  const me = currentUser();
  $("#profileName") && ($("#profileName").textContent = me.name);
  $("#profileEmail") && ($("#profileEmail").textContent = me.email);
}

/* ---------- Welcome ---------- */
function onWelcomePage() {
  const btn = $("#getStartedBtn");
  btn?.addEventListener("click", () => navigate("login.html"));
}

/* ---------- Boot per page ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page || "";

  // common: wire nav buttons that have data-link to anchor navigation
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-link]");
    if (link) {
      e.preventDefault();
      const href = link.getAttribute("data-link");
      if (href) navigate(href);
    }
  });

  if ($("#appBar")) setupAppBar();

  switch (page) {
    case "welcome": onWelcomePage(); break;
    case "login": onLoginPage(); break;
    case "signup": onSignupPage(); break;
    case "dashboard": onDashboardPage(); break;
    case "deposit": onDepositPage(); break;
    case "withdraw": onWithdrawPage(); break;
    case "settings": onSettingsPage(); break;
    case "admin": onAdminPage(); break;
  }
});
