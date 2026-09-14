import React, { useEffect, useMemo, useState } from "react";
import { createWorker } from "tesseract.js";
import { supabase } from "./supabase";
import "./App.css";

const money = (n) =>
  `GHS ${Number(n || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (v) => {
  if (!v) return "";
  try {
    return new Date(v).toLocaleString("en-GH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(v);
  }
};

const LEAGUES = [
  "EPL",
  "LA_LIGA",
  "BUNDESLIGA",
  "IT_SERIE_A",
  "FR_LIGUE_1",
  "UEFA_CHAMPIONS_LEAGUE",
  "UEFA_EUROPA_LEAGUE",
  "EREDIVISIE",
  "BR_SERIE_A",
  "MLS",
  "LIGA_MX",
];

const GAME_CATALOG = [
  { key: "casino", icon: "🎰", title: "CASINO", subtitle: "Instant casino games", description: "Choose a package and enter the Casino area.", tone: "pink" },
  { key: "bottle", icon: "🍾", title: "FLIP THE BOTTLE", subtitle: "Quick bottle rounds", description: "Fast Flip the Bottle rounds with simple game play.", tone: "orange" },
  { key: "football", icon: "⚽", title: "FOOTBALL", subtitle: "Virtual football", description: "Virtual football packages with named teams and match rounds.", tone: "blue" },
];

const PACKAGES = [
  { price: 300, predictions: 1, icon: "⚡" },
  { price: 400, predictions: 2, icon: "🔥" },
  { price: 500, predictions: 3, icon: "💎" },
];


function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [matches, setMatches] = useState([]);
  const [bets, setBets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [betSlip, setBetSlip] = useState([]);
  const [stake, setStake] = useState("");
  const [page, setPage] = useState("home");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sportsLoading, setSportsLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [predictionGame, setPredictionGame] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [predictionActivity, setPredictionActivity] = useState([]);

  const [authMode, setAuthMode] = useState("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [depositAmount, setDepositAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawProvider, setWithdrawProvider] = useState("MTN");
  const [withdrawName, setWithdrawName] = useState("");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [manualWithdrawals, setManualWithdrawals] = useState([]);
  const isAdmin = profile?.role === "admin" && profile?.is_active !== false;

  const combinedOdds = useMemo(
    () => betSlip.reduce((total, item) => total * Number(item.odd || 1), 1),
    [betSlip]
  );

  const potentialWin = Number(stake || 0) * combinedOdds;

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      if (!data.session) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);

      if (!nextSession) {
        setProfile(null);
        setWallet(null);
        setBets([]);
        setTransactions([]);
        setManualWithdrawals([]);
        setBetSlip([]);
        setPage("home");
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session]);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadProfile(),
        loadWallet(),
        loadMatches(),
        loadUserData(),
      ]);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Some account data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    const { data, error: e } = await supabase.rpc("get_my_profile");

    if (!e) {
      setProfile(Array.isArray(data) ? data[0] || null : data || null);
      return;
    }

    const { data: fallback, error: fe } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (fe) throw fe;
    setProfile(fallback);
  }

  async function loadWallet() {
    const { data, error: e } = await supabase.rpc("get_my_wallet");

    if (!e) {
      setWallet(Array.isArray(data) ? data[0] || null : data || null);
      return;
    }

    const { data: fallback, error: fe } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (fe) throw fe;
    setWallet(fallback);
  }

  async function loadMatches() {
    const { data: rows, error: e } = await supabase
      .from("matches")
      .select("*")
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    if (!e) {
      setMatches(await attachOdds(rows || []));
      return;
    }

    const fallback = await supabase
      .from("matches")
      .select("*")
      .order("start_time", { ascending: true });

    if (fallback.error) {
      console.error("Matches:", e);
      setMatches([]);
      return;
    }

    setMatches(await attachOdds(fallback.data || []));
  }

  async function attachOdds(rows) {
    if (!rows.length) return [];

    const ids = rows.map((m) => m.id);
    const { data: odds, error: oddsError } = await supabase
      .from("match_odds")
      .select("*")
      .in("match_id", ids)
      .eq("is_active", true)
      .order("market", { ascending: true });

    if (oddsError) throw oddsError;

    const map = {};
    for (const odd of odds || []) {
      if (!map[odd.match_id]) map[odd.match_id] = [];
      map[odd.match_id].push(odd);
    }

    return rows.map((m) => ({
      ...m,
      match_odds: map[m.id] || [],
    }));
  }

  async function loadUserData() {
    const [betsResult, txResult, withdrawalsResult] = await Promise.all([
      // Do NOT order by created_at here: the current bets table does not
      // contain that column.
      supabase
        .from("bets")
        .select("*")
        .eq("user_id", session.user.id),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_my_manual_withdrawals"),
    ]);

    if (betsResult.error) throw betsResult.error;
    if (txResult.error) throw txResult.error;
    if (withdrawalsResult.error) throw withdrawalsResult.error;

    setBets(betsResult.data || []);
    setTransactions(txResult.data || []);
    setManualWithdrawals(withdrawalsResult.data || []);
  }

  function flash(text) {
    setMessage(text);
    setTimeout(() => setMessage(""), 3500);
  }

  function clearError() {
    setError("");
  }

  function formatPhone(value) {
    let cleaned = value.replace(/[^\d+]/g, "");

    if (cleaned.startsWith("+233")) {
      return cleaned.slice(0, 13);
    }

    if (cleaned.startsWith("233")) {
      return `+${cleaned.slice(0, 12)}`;
    }

    return cleaned.replace(/\D/g, "").slice(0, 10);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setBusy(true);
    clearError();
    setMessage("");

    try {
      if (authMode === "signup") {
        if (!name.trim()) throw new Error("Enter your full name.");
        if (!phone.trim()) throw new Error("Enter your Ghana phone number.");
        if (password.length < 6)
          throw new Error("Password must be at least 6 characters.");

        const { data, error: e1 } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              phone: phone.trim(),
            },
          },
        });

        if (e1) throw e1;

        if (!data.session) {
          flash("Account created. Check your email to confirm your account.");
        } else {
          flash("Account created successfully.");
        }
      } else {
        const { error: e1 } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (e1) throw e1;
        flash("Welcome back.");
      }
    } catch (e1) {
      setError(e1.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  function openGame(game) {
    setSelectedGame(game);
    setPage("game");
  }

  async function logPredictionActivity(activityType, game = null, pkg = null) {
    if (!session?.user?.id) return;

    try {
      const { error: activityError } = await supabase
        .from("prediction_activity")
        .insert({
          user_id: session.user.id,
          activity_type: activityType,
          game: game?.title || game?.key || null,
          package_price: pkg?.price ? Number(pkg.price) : null,
          prediction_count: pkg?.predictions ? Number(pkg.predictions) : null,
        });

      if (activityError) console.error("Prediction activity log error:", activityError);
    } catch (activityError) {
      console.error("Prediction activity log error:", activityError);
    }
  }

  function choosePackage(price) {
    const pkg = PACKAGES.find((item) => item.price === price);
    setSelectedPackage(pkg || null);
    setDepositAmount(String(price));
    setPage("wallet");
    if (pkg) logPredictionActivity("package_selected", selectedGame, pkg);
    flash(`GHS ${price} package selected. The amount has been added to Deposit.`);
  }

  function openSurePrediction(game) {
    if (!selectedPackage) {
      setError("Choose a Sure Prediction package first.");
      return;
    }
    const balance = Number(wallet?.balance || 0);
    if (balance < Number(selectedPackage.price)) {
      setDepositAmount(String(selectedPackage.price));
      setPage("wallet");
      flash(`You need GHS ${selectedPackage.price} in your wallet before submitting this package.`);
      return;
    }
    setPredictionGame(game);
    logPredictionActivity("prediction_viewed", game, selectedPackage);
  }

  function confirmSurePrediction() {
    logPredictionActivity("prediction_submitted", predictionGame, selectedPackage);
    setPredictionGame(null);
    flash("Sure Prediction completed. Your package was charged and the prediction result was revealed.");
  }

  function addToSlip(match, odd) {
    const item = {
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      startTime: match.start_time,
      market: odd.market || "Market",
      selectionKey: odd.selection,
      selection: odd.selection,
      odd: Number(odd.odd),
    };

    if (!Number.isFinite(item.odd) || item.odd <= 0) {
      setError("This odd is not available.");
      return;
    }

    setBetSlip((old) => {
      const withoutSameMatchMarket = old.filter(
        (x) => !(x.matchId === item.matchId && x.market === item.market)
      );
      return [...withoutSameMatchMarket, item];
    });

    flash(`${match.home_team} vs ${match.away_team}: ${odd.selection} added`);
  }

  function removeFromSlip(matchId, market) {
    setBetSlip((old) =>
      old.filter((x) => !(x.matchId === matchId && x.market === market))
    );
  }

  async function placeBet() {
    clearError();

    const amount = Number(stake);

    if (!session) return setError("Please log in first.");
    if (!betSlip.length) return setError("Select at least one odd.");
    if (!Number.isFinite(amount) || amount <= 0)
      return setError("Enter a valid stake.");
    if (wallet && amount > Number(wallet.balance))
      return setError("Insufficient wallet balance.");

    setBusy(true);

    try {
      const selections = betSlip.map((x) => ({
        match_id: x.matchId,
        market: x.market,
        selection: x.selectionKey,
      }));

      const { error: e } = await supabase.rpc("place_bet", {
        p_stake: amount,
        p_selections: selections,
      });

      if (e) throw e;

      setStake("");
      setBetSlip([]);
      await Promise.all([loadWallet(), loadUserData()]);
      flash("Bet placed successfully.");
    } catch (e) {
      setError(
        e.message ||
          "Bet could not be placed. Make sure the secure place_bet function exists."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRealDeposit(e) {
    e.preventDefault();
    clearError();

    const amount = Number(depositAmount);
    const reference = depositReference.trim();

    if (!session?.user) return setError("Please log in before making a deposit.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter a valid deposit amount.");
    if (amount < 1) return setError("Minimum deposit is GHS 1.00.");
    if (!reference) return setError("Enter the MoMo transaction/reference number after payment.");

    setBusy(true);
    clearError();

    try {
      const { error: e1 } = await supabase.rpc("request_deposit", {
        p_amount: amount,
        p_payment_method: "MTN Mobile Money",
        p_payment_reference: reference,
      });

      if (e1) throw e1;

      setDepositAmount("");
      setDepositReference("");
      await loadUserData();
      flash("Deposit request submitted. Your wallet will be credited after the payment is verified.");
    } catch (e1) {
      console.error("Manual deposit error:", e1);
      setError(e1?.message || "Deposit request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function requestWithdrawal(e) {
    e.preventDefault();
    clearError();

    const amount = Number(withdrawAmount);
    const phoneValue = withdrawDestination.trim();
    const recipientName = withdrawName.trim();

    if (!amount || amount <= 0)
      return setError("Enter a valid withdrawal amount.");

    if (amount < 10)
      return setError("Minimum withdrawal is GHS 10.00.");

    if (!recipientName)
      return setError("Enter the name registered on the MoMo account.");

    if (!/^0\d{9}$/.test(phoneValue))
      return setError("Enter a valid Ghana mobile number, e.g. 0551234567.");

    if (Number(wallet?.balance || 0) < amount)
      return setError("Insufficient wallet balance.");

    setBusy(true);
    setMessage("Submitting your withdrawal request...");

    try {
      const { error: e1 } = await supabase.rpc(
        "request_manual_withdrawal",
        {
          p_amount: amount,
          p_provider: withdrawProvider,
          p_account_name: recipientName,
          p_phone: phoneValue,
        }
      );

      if (e1) throw e1;

      setWithdrawAmount("");
      setWithdrawDestination("");
      setWithdrawName("");

      await Promise.all([loadWallet(), loadUserData()]);

      setMessage(
        "Withdrawal request submitted. Your balance is held while the request is processed."
      );
    } catch (e1) {
      console.error("Manual withdrawal error:", e1);
      setError(e1?.message || "Withdrawal request failed.");
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSportsMatches() {
    setSportsLoading(true);
    try {
      await loadMatches();
      flash("Match list refreshed.");
    } catch (e) {
      setError(e?.message || "Unable to refresh matches.");
    } finally {
      setSportsLoading(false);
    }
  }

  const marketGroups = (odds) => {
    const groups = {};
    for (const o of odds || []) {
      const key = o.market || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    }
    return groups;
  };

  const featuredMatches = matches.slice(0, 3);
  const upcomingMatches = matches.slice(0, 8);

  if (!session) {
    return (
      <div className="csh-app auth-page">
        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand-mark">CS</div>
            <div>
              <div className="brand">CLASSIC SPORTY HACKS</div>
              <div className="brand-sub">Games • Predictions • Wallet</div>
            </div>
          </div>
        </header>

        <main className="auth-area">
          <div className="auth-decoration decor-one" />
          <div className="auth-decoration decor-two" />

          <section className="auth-card">
            <div className="auth-badge">
              {authMode === "login" ? "WELCOME BACK" : "JOIN CLASSIC SPORTY"}
            </div>

            <h1>
              {authMode === "login"
                ? "Your football hub."
                : "Create your account."}
            </h1>

            <p className="muted">
              {authMode === "login"
                ? "Log in to manage your wallet, bets and football selections."
                : "Sign up and get access to matches, odds, wallet and betting tools."}
            </p>

            {error && <div className="alert error">{error}</div>}
            {message && <div className="alert success">{message}</div>}

            <form onSubmit={handleAuth} className="auth-form">
              {authMode === "signup" && (
                <>
                  <label>Full name</label>
                  <input
                    className="field"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  <label>Ghana phone number</label>
                  <input
                    className="field"
                    type="tel"
                    placeholder="0551234567"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                  />
                </>
              )}

              <label>Email address</label>
              <input
                className="field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Password</label>
              <input
                className="field"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button className="btn btn-primary big-btn" disabled={busy}>
                {busy
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Login to account"
                  : "Create account"}
              </button>
            </form>

            <button
              className="switch-auth"
              onClick={() => {
                clearError();
                setAuthMode(authMode === "login" ? "signup" : "login");
              }}
            >
              {authMode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Login"}
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">CS</div>
        <strong>Loading Classic Sporty Hacks...</strong>
        <span>Preparing your football dashboard</span>
      </div>
    );
  }

  return (
    <div className="csh-app">
      <header className="topbar main-topbar">
        <div className="brand-wrap">
          <div className="brand-mark">CS</div>
          <div>
            <div className="brand">CLASSIC SPORTY HACKS</div>
            <div className="brand-sub">
              {profile?.full_name || session.user.email}
            </div>
          </div>
        </div>

        <div className="top-actions">
          <div className="top-balance">
            <span>Wallet</span>
            <strong>{money(wallet?.balance)}</strong>
          </div>
          <button className="top-deposit-btn" onClick={() => setPage("wallet")}>
            + Deposit
          </button>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="side-title">MENU</div>

          <NavButton
            active={page === "home"}
            icon="⌂"
            label="Home"
            onClick={() => setPage("home")}
          />
          <NavButton
            active={page === "game" && selectedGame?.key === "football"}
            icon="⚽"
            label="Football"
            onClick={() => openGame(GAME_CATALOG[2])}
          />
          <NavButton
            active={page === "game" && selectedGame?.key === "bottle"}
            icon="🍾"
            label="Flip the Bottle"
            onClick={() => openGame(GAME_CATALOG[1])}
          />
          <NavButton
            active={page === "bets"}
            icon="🎟️"
            label="My Bets"
            onClick={() => setPage("bets")}
          />
          <NavButton
            active={page === "wallet"}
            icon="💰"
            label="Wallet"
            onClick={() => setPage("wallet")}
          />
          <NavButton
            active={page === "transactions"}
            icon="🧾"
            label="Transactions"
            onClick={() => setPage("transactions")}
          />

          {isAdmin && (
            <>
              <div className="side-title admin-title">MANAGEMENT</div>
              <NavButton
                active={page === "admin"}
                icon="🛠️"
                label="Admin Dashboard"
                onClick={() => setPage("admin")}
              />
            </>
          )}

          <div className="sidebar-card">
            <div className="mini-icon">🎯</div>
            <strong>Sure Prediction</strong>
            <p>Choose a package, submit a clear match screenshot and wait for manual processing.</p>
          </div>
        </aside>

        <main className="main-content">
          {message && <div className="alert success">{message}</div>}
          {error && <div className="alert error">{error}</div>}

          {page === "home" && (
            <section className="page-section home-dashboard-page">
              <div className="hero-banner">
                <div className="hero-copy">
                  <span className="hero-kicker">CLASSIC SPORTY HACKS</span>
                  <h1>Pick your game.<br /><span>Build your prediction.</span></h1>
                  <p>Choose Football, Casino or Flip the Bottle. Open a game, select your package and continue through your wallet deposit area.</p>
                  <div className="hero-buttons">
                    <button className="btn btn-white" type="button" onClick={() => openGame(GAME_CATALOG[2])}>Open Football</button>
                    <button className="btn btn-yellow" type="button" onClick={() => setPage("wallet")}>+ Add Funds</button>
                  </div>
                </div>
                <div className="hero-art">
                  <div className="football">⚽</div>
                  <div className="hero-chip chip-one">SURE PREDICTION</div>
                  <div className="hero-chip chip-two">3 PACKAGES</div>
                  <div className="hero-score"><span>WALLET</span><strong>{money(wallet?.balance)}</strong></div>
                </div>
              </div>

              <div className="feature-grid">
                <button className="feature-card feature-blue" type="button" onClick={() => openGame(GAME_CATALOG[2])}>
                  <div className="feature-icon">⚽</div><div><strong>Football</strong><span>Named teams & Sure Prediction</span></div><b className="feature-arrow">›</b>
                </button>
                <button className="feature-card feature-orange" type="button" onClick={() => openGame(GAME_CATALOG[0])}>
                  <div className="feature-icon">🎰</div><div><strong>Casino</strong><span>Packages & Sure Prediction</span></div><b className="feature-arrow">›</b>
                </button>
                <button className="feature-card feature-green" type="button" onClick={() => openGame(GAME_CATALOG[1])}>
                  <div className="feature-icon">🍾</div><div><strong>Flip the Bottle</strong><span>Choose your stake and play</span></div><b className="feature-arrow">›</b>
                </button>
                <button className="feature-card feature-purple" type="button" onClick={() => setPage("wallet")}>
                  <div className="feature-icon">💰</div><div><strong>Wallet</strong><span>Deposit & manage your balance</span></div><b className="feature-arrow">›</b>
                </button>
              </div>

              <div className="section-heading">
                <div><span className="eyebrow">PLAY & PREDICT</span><h2>Choose your game</h2><p>Every game has GHS 300, GHS 400 and GHS 500 packages.</p></div>
              </div>

              <div className="home-game-grid home-game-grid-three">
                {GAME_CATALOG.map((game) => (
                  <GameChoiceCard key={game.key} game={game} onOpen={openGame} />
                ))}
              </div>

              <div className="home-wallet-banner">
                <div>
                  <span className="eyebrow">YOUR WALLET</span>
                  <h3>{money(wallet?.balance)}</h3>
                  <p>Select a package and the amount will be carried into the Deposit area.</p>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => setPage("wallet")}>Go to Deposit</button>
              </div>
            </section>
          )}

          {page === "game" && selectedGame && (
            <GameDetailPage
              game={selectedGame}
              wallet={wallet}
              onBack={() => setPage("home")}
              onPackage={choosePackage}
              onPrediction={() => openSurePrediction(selectedGame)}
              onRefresh={loadAll}
              onDeposit={(amount) => {
                setDepositAmount(String(amount));
                setPage("wallet");
              }}
            />
          )}

          {page === "bets" && (
            <section className="page-section">
              <PageTitle
                eyebrow="BET HISTORY"
                title="My Bets"
                text="Review your placed selections."
              />

              {bets.length === 0 ? (
                <div className="empty-card">
                  <div className="empty-icon">🎟️</div>
                  <h3>No bets yet</h3>
                  <p>Your football bet history will appear here when you place a bet.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setPage("home")}
                  >
                    Go to Games
                  </button>
                </div>
              ) : (
                <div className="bet-history-grid">
                  {bets.map((bet) => (
                    <div className="history-card" key={bet.id}>
                      <div className="history-top">
                        <div>
                          <span className="eyebrow">BET REFERENCE</span>
                          <strong>#{String(bet.id).slice(0, 8)}</strong>
                        </div>
                        <span className="status-pill">
                          {String(bet.status || "pending").toUpperCase()}
                        </span>
                      </div>

                      <div className="history-stats">
                        <Stat label="Stake" value={money(bet.stake)} />
                        <Stat
                          label="Combined odds"
                          value={Number(bet.combined_odds || 0).toFixed(2)}
                        />
                        <Stat
                          label="Potential win"
                          value={money(bet.potential_win)}
                        />
                      </div>

                      {bet.created_at && (
                        <div className="history-date">
                          {fmtDate(bet.created_at)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === "wallet" && (
            <section className="page-section">
              <PageTitle
                eyebrow="YOUR MONEY"
                title="Wallet"
                text="Deposit funds and request withdrawals."
              />

              {selectedPackage && (
                <div className="selected-package-banner">
                  <div><span className="eyebrow">SURE PREDICTION PACKAGE</span><strong>GHS {selectedPackage.price} · {selectedPackage.predictions} prediction{selectedPackage.predictions > 1 ? "s" : ""}</strong><p>The selected amount is already filled into Deposit.</p></div>
                  <button type="button" className="btn btn-secondary" onClick={() => setPage("game")}>Back to Game</button>
                </div>
              )}

              <div className="wallet-balance-card">
                <div>
                  <span>AVAILABLE BALANCE</span>
                  <strong>{money(wallet?.balance)}</strong>
                  <small>{wallet?.currency || "GHS"}</small>
                </div>
                <div className="wallet-symbol">₵</div>
              </div>

              <div className="wallet-grid">
                <form className="form-card deposit-manual-card" onSubmit={handleRealDeposit}>
                  <div className="form-icon green-icon">₵</div>
                  <span className="eyebrow">MANUAL MOBILE MONEY DEPOSIT</span>
                  <h3>Send money to Classic Sporty</h3>
                  <p>Send the real deposit from your MTN Mobile Money account, then submit the transaction reference below. Your in-app balance does not change until the payment is verified.</p>

                  <div className="momo-payment-box">
                    <div className="momo-brand-row">
                      <span className="momo-badge">MTN</span>
                      <div>
                        <strong>MTN Mobile Money</strong>
                        <small>Payment number</small>
                      </div>
                    </div>
                    <div className="momo-number">0597021610</div>
                    <button
                      type="button"
                      className="copy-number-btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText("0597021610");
                          flash("MTN payment number copied.");
                        } catch {
                          flash("Payment number: 0597021610");
                        }
                      }}
                    >
                      Copy number
                    </button>
                  </div>

                  <div className="deposit-steps">
                    <div><b>1</b><span>Send your chosen amount to <strong>0597021610</strong> on MTN MoMo.</span></div>
                    <div><b>2</b><span>Confirm the recipient name shown in your MoMo prompt before sending.</span></div>
                    <div><b>3</b><span>Enter the amount and your MoMo transaction/reference number below.</span></div>
                  </div>

                  <label>Amount (GHS)</label>
                  <input
                    className="field"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="100.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />

                  <label>MoMo transaction/reference number</label>
                  <input
                    className="field"
                    type="text"
                    placeholder="e.g. 123456789012"
                    value={depositReference}
                    onChange={(e) => setDepositReference(e.target.value)}
                  />

                  <button className="btn btn-primary big-btn" disabled={busy}>
                    {busy ? "Submitting..." : "Submit deposit for verification"}
                  </button>

                  <div className="helper">Your wallet is credited only after the payment is checked and approved.</div>
                </form>

                <form className="form-card" onSubmit={requestWithdrawal}>
                  <div className="form-icon orange-icon">↗</div>
                  <span className="eyebrow">CASH OUT</span>
                  <h3>Withdraw to Mobile Money</h3>
                  <p>
                    Your request is held for manual processing. An admin sends
                    the MoMo payment and marks it paid.
                  </p>

                  <label>Amount</label>
                  <input
                    className="field"
                    type="number"
                    min="10"
                    step="0.01"
                    placeholder="10.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />

                  <label>Network</label>
                  <select
                    className="field"
                    value={withdrawProvider}
                    onChange={(e) => setWithdrawProvider(e.target.value)}
                  >
                    <option value="MTN">MTN Mobile Money</option>
                    <option value="VOD">Telecel Cash</option>
                    <option value="ATL">AirtelTigo Money</option>
                  </select>

                  <label>MoMo account name</label>
                  <input
                    className="field"
                    placeholder="Account name"
                    value={withdrawName}
                    onChange={(e) => setWithdrawName(e.target.value)}
                  />

                  <label>MoMo number</label>
                  <input
                    className="field"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="0551234567"
                    value={withdrawDestination}
                    onChange={(e) =>
                      setWithdrawDestination(
                        e.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                  />

                  <button className="btn btn-orange big-btn" disabled={busy}>
                    {busy ? "Submitting..." : "Request withdrawal"}
                  </button>

                  <div className="helper">
                    Minimum withdrawal: <strong>GHS 10.00</strong>
                  </div>
                </form>
              </div>

              {manualWithdrawals.length > 0 && (
                <div className="panel-card">
                  <div className="section-heading compact">
                    <div>
                      <span className="eyebrow">REQUEST HISTORY</span>
                      <h2>Recent Withdrawals</h2>
                    </div>
                  </div>

                  <div className="withdrawal-list">
                    {manualWithdrawals.slice(0, 10).map((w) => (
                      <div className="withdrawal-row" key={w.id}>
                        <div className="withdrawal-icon">₵</div>
                        <div className="withdrawal-main">
                          <strong>{money(w.amount)}</strong>
                          <span>
                            {w.provider} • {w.phone}
                          </span>
                          <small>{fmtDate(w.created_at)}</small>
                        </div>
                        <span
                          className={`status-pill status-${String(
                            w.status || "pending"
                          ).toLowerCase()}`}
                        >
                          {String(w.status || "pending").toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {page === "transactions" && (
            <section className="page-section">
              <PageTitle
                eyebrow="ACCOUNT ACTIVITY"
                title="Transactions"
                text="See your wallet activity."
              />

              {transactions.length === 0 ? (
                <div className="empty-card">
                  <div className="empty-icon">🧾</div>
                  <h3>No transactions yet</h3>
                  <p>Your wallet transactions will appear here.</p>
                </div>
              ) : (
                <div className="transaction-list">
                  {transactions.map((tx) => (
                    <div className="transaction-row" key={tx.id}>
                      <div
                        className={`transaction-icon ${
                          String(tx.type).toLowerCase() === "deposit"
                            ? "tx-green"
                            : "tx-orange"
                        }`}
                      >
                        {String(tx.type).toLowerCase() === "deposit"
                          ? "↓"
                          : "↑"}
                      </div>

                      <div className="transaction-info">
                        <strong>{tx.description || tx.type || "Transaction"}</strong>
                        <span>{fmtDate(tx.created_at)}</span>
                        {tx.reference && <small>Ref: {tx.reference}</small>}
                      </div>

                      <div className="transaction-amount">
                        <strong>{money(tx.amount)}</strong>
                        <span>{String(tx.status || "").toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === "admin" && isAdmin && <AdminPanel onRefresh={loadAll} />}
          {predictionGame && (
            <PredictionModal
              game={predictionGame}
              pkg={selectedPackage}
              wallet={wallet}
              onClose={() => setPredictionGame(null)}
              onSubmit={confirmSurePrediction}
              onCharged={async () => {
                await Promise.all([loadWallet(), loadUserData()]);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }) {
  return (
    <button
      className={`side-nav ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>{icon}</span>
      <strong>{label}</strong>
      {active && <i />}
    </button>
  );
}

function FeatureCard({ icon, title, text, color }) {
  return (
    <div className={`feature-card feature-${color}`}>
      <div className="feature-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <div className="feature-arrow">→</div>
    </div>
  );
}

function PlayerCard({ initials, number, name, club, tone }) {
  return (
    <div className={`player-card ${tone}`}>
      <div className="player-glow" />
      <div className="player-head">{initials}</div>
      <div className="player-shirt">
        <span>{number}</span>
      </div>
      <div className="player-details">
        <strong>{name}</strong>
        <span>{club}</span>
      </div>
    </div>
  );
}

function PageTitle({ eyebrow, title, text }) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GameChoiceCard({ game, onOpen }) {
  return (
    <article className={`game-choice-card game-${game.tone}`} onClick={() => onOpen(game)}>
      <div className="game-choice-icon">{game.icon}</div>
      <span className="eyebrow">{game.subtitle}</span>
      <h3>{game.title}</h3>
      <p>{game.description}</p>
      <button className="btn btn-primary" type="button" onClick={(e) => { e.stopPropagation(); onOpen(game); }}>
        Open {game.title}
      </button>
    </article>
  );
}

function GameDetailPage({ game, wallet, onBack, onPackage, onPrediction, onRefresh, onDeposit }) {
  const footballMatches = [
    ["Real Madrid", "Barcelona"],
    ["Manchester City", "Liverpool"],
    ["Bayern Munich", "Borussia Dortmund"],
    ["Arsenal", "Chelsea"],
    ["Inter Milan", "AC Milan"],
  ];

  const bottleStakes = [
    { amount: 300, win: 600 },
    { amount: 400, win: 800 },
    { amount: 500, win: 1000 },
  ];

  const [selectedStake, setSelectedStake] = useState(null);
  const [bottlePlaying, setBottlePlaying] = useState(false);
  const [bottleResult, setBottleResult] = useState(null);
  const [bottleError, setBottleError] = useState("");

  async function playBottle() {
    if (!selectedStake || bottlePlaying) return;
    setBottleError("");
    setBottleResult(null);

    const amount = Number(selectedStake.amount);
    const balance = Number(wallet?.balance || 0);

    if (balance < amount) {
      onDeposit(amount);
      return;
    }

    setBottlePlaying(true);

    try {
      // The wallet is charged only when the round completes on the secure RPC.
      await new Promise((resolve) => setTimeout(resolve, 1800));

      const { data, error: rpcError } = await supabase.rpc("play_flip_bottle", {
        p_stake: amount,
      });

      if (rpcError) throw rpcError;

      const resultData = data || {};
      const outcome = String(
        resultData.result || resultData.outcome || ""
      ).toUpperCase();
      const payout = Number(
        resultData.payout ?? resultData.win_amount ?? 0
      );
      const returnedBalance = Number(
        resultData.new_balance ?? resultData.balance ?? NaN
      );

      if (outcome !== "WIN" && outcome !== "LOSE" && outcome !== "LOSS") {
        throw new Error("The bottle round returned an invalid result.");
      }

      setBottleResult({
        outcome: outcome === "LOSS" ? "LOSE" : outcome,
        stake: amount,
        payout,
        balance: returnedBalance,
      });

      await onRefresh();
    } catch (e) {
      setBottleError(e?.message || "The bottle round could not be completed.");
    } finally {
      setBottlePlaying(false);
    }
  }

  return (
    <section className="page-section game-detail-page">
      <button className="back-link" type="button" onClick={onBack}>← Back to Games</button>

      <div className="game-detail-hero">
        <div className="game-detail-icon">{game.icon}</div>
        <div>
          <span className="eyebrow">{game.subtitle}</span>
          <h1>{game.title}</h1>
          <p>Current wallet: <strong>{money(wallet?.balance)}</strong></p>
        </div>
      </div>

      {game.key === "bottle" ? (
        <>
          <div className="package-heading">
            <div>
              <span className="eyebrow">FLIP THE BOTTLE</span>
              <h2>CHOOSE YOUR STAKES</h2>
              <p>Choose your stake. If you win, the round pays 2× your stake.</p>
            </div>
          </div>

          <div className="package-grid">
            {bottleStakes.map((item) => {
              const active = selectedStake?.amount === item.amount;
              return (
                <button
                  key={item.amount}
                  type="button"
                  className={`package-card ${active ? "selected-stake-card" : ""}`}
                  onClick={() => {
                    setSelectedStake(item);
                    setBottleResult(null);
                    setBottleError("");
                  }}
                >
                  <div className="package-top">
                    <div>
                      <strong>GHS {item.amount}</strong>
                      <span>{active ? "SELECTED" : "STAKE"}</span>
                    </div>
                    <i>🍾</i>
                  </div>
                  <h3>Potential win: GHS {item.win}</h3>
                  <div className="package-tags">
                    <span>2× PAYOUT</span>
                    <span>INSTANT RESULT</span>
                  </div>
                  <div className="package-action">{active ? "✓ SELECTED" : "SELECT STAKE"}</div>
                </button>
              );
            })}
          </div>

          {bottleError && <div className="alert error">{bottleError}</div>}

          <div className="bottle-play-card" style={{marginTop:20,padding:24,borderRadius:24,background:"linear-gradient(135deg,#fff8ef,#fff)",border:"1px solid #f3dfc7",textAlign:"center"}}>
            <div style={{fontSize:64,marginBottom:10,display:"inline-block",animation:bottlePlaying?"bottleSpin 0.65s linear infinite":"none"}}>🍾</div>
            <h3 style={{margin:"8px 0 6px",fontSize:24}}>
              {bottlePlaying ? "FLIPPING..." : bottleResult ? (bottleResult.outcome === "WIN" ? "YOU WON! 🎉" : "YOU LOST") : "Ready for the round?"}
            </h3>
            <p style={{margin:"0 auto 18px",maxWidth:520,color:"#667085"}}>
              {bottlePlaying
                ? "Your round is being completed securely."
                : bottleResult
                ? bottleResult.outcome === "WIN"
                  ? `GHS ${bottleResult.stake} was staked and GHS ${bottleResult.payout} was paid back.`
                  : `GHS ${bottleResult.stake} was staked. No payout was made this round.`
                : selectedStake
                ? `Selected stake: GHS ${selectedStake.amount}. Potential win: GHS ${selectedStake.win}.`
                : "Select one of the three stakes above to play."}
            </p>
            {selectedStake && !bottleResult && (
              <button className="btn btn-primary big-btn" type="button" disabled={bottlePlaying} onClick={playBottle}>
                {bottlePlaying ? "Flipping Bottle..." : `Play GHS ${selectedStake.amount}`}
              </button>
            )}
            {bottleResult && (
              <button className="btn btn-primary big-btn" type="button" onClick={() => { setBottleResult(null); setSelectedStake(null); }}>
                Play Another Round
              </button>
            )}
          </div>

          <style>{`@keyframes bottleSpin {0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.12)}100%{transform:rotate(360deg) scale(1)}}`}</style>
        </>
      ) : (
        <>
          {game.key === "football" && (
            <div className="football-fixtures">
              <div className="section-heading compact">
                <div><span className="eyebrow">VIRTUAL FOOTBALL</span><h2>Today's Featured Teams</h2></div>
              </div>
              {footballMatches.map(([home, away]) => (
                <div className="football-fixture" key={`${home}-${away}`}>
                  <div><span>HOME</span><strong>{home}</strong></div>
                  <b>VS</b>
                  <div className="away"><span>AWAY</span><strong>{away}</strong></div>
                </div>
              ))}
            </div>
          )}

          <div className="package-heading">
            <div>
              <span className="eyebrow">CHOOSE YOUR PACKAGE</span>
              <h2>Choose a package · No expiry · Manual processing</h2>
            </div>
          </div>

          <div className="package-grid">
            {PACKAGES.map((pkg) => (
              <button key={pkg.price} className="package-card" type="button" onClick={() => onPackage(pkg.price)}>
                <div className="package-top">
                  <div><strong>GHS {pkg.price}</strong><span>AVAILABLE</span></div>
                  <i>{pkg.icon}</i>
                </div>
                <h3>{pkg.predictions} prediction{pkg.predictions > 1 ? "s" : ""} per screenshot</h3>
                <div className="package-tags"><span>{pkg.predictions} PREDICTION{pkg.predictions > 1 ? "S" : ""}</span><span>NO EXPIRY</span></div>
                <div className="package-action">→ GET GHS {pkg.price}</div>
              </button>
            ))}
          </div>

          <div className="ai-prediction-card">
            <div className="ai-icon">🎯</div>
            <div>
              <span className="eyebrow">SURE PREDICTION</span>
              <h3>Send a screenshot for match analysis</h3>
              <p>Upload a clear screenshot of the particular match. Your selected package is charged only after successful analysis.</p>
            </div>
            <button className="btn btn-primary" type="button" onClick={onPrediction}>Sure Prediction</button>
          </div>
        </>
      )}
    </section>
  );
}

function PredictionModal({ game, pkg, wallet, onClose, onSubmit, onCharged }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [ocrText, setOcrText] = useState("");
  const balance = Number(wallet?.balance || 0);
  const price = Number(pkg?.price || 0);

  function handleFile(e) {
    const next = e.target.files?.[0];
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setSubmitted(false);
    setPrediction(null);
    setAnalysisError("");
    setOcrText("");
  }

  async function analyzeScreenshot() {
    if (!file || balance < price) return;
    setAnalyzing(true);
    setAnalysisError("");
    setPrediction(null);
    setOcrText("");
    let worker;
    try {
      worker = await createWorker("eng");
      const result = await worker.recognize(file);
      const text = result?.data?.text || "";
      if (!text.trim()) throw new Error("No readable text was found. Please upload a clearer betting screenshot.");
      setOcrText(text);
      const response = await fetch("/api/sure-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Prediction service is unavailable.");
      if (!data?.prediction?.predicted_winner || data.prediction.predicted_winner === "Unable to determine") {
        throw new Error("The screenshot was readable, but the teams or 1X2 odds could not be determined. Please upload a clearer match screenshot.");
      }

      // Charge immediately after successful analysis and before revealing the result.
      const { error: chargeError } = await supabase.rpc("consume_prediction_package", {
        p_amount: price,
        p_game: game?.title || game?.key || "Game",
        p_prediction_count: Number(pkg?.predictions || 1),
      });

      if (chargeError) throw chargeError;

      if (onCharged) await onCharged();
      setPrediction(data.prediction);
    } catch (err) {
      setAnalysisError(err.message || "Could not analyze this screenshot.");
    } finally {
      if (worker) await worker.terminate();
      setAnalyzing(false);
    }
  }

  const resultStyle = { marginTop: 18, padding: 18, borderRadius: 20, background: "linear-gradient(135deg,#f0fff7,#eef6ff)", border: "1px solid #d8e8df" };
  const statStyle = { padding: 13, borderRadius: 14, background: "#fff", border: "1px solid #e5e7eb" };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="prediction-modal">
        <button className="modal-close" type="button" onClick={onClose}>×</button>
        <div className="ai-icon large">🎯</div>
        <span className="eyebrow">{game.title} · SURE PREDICTION</span>
        <h2>Submit your match screenshot</h2>
        <p>Package: <strong>GHS {price}</strong> · <strong>{pkg?.predictions} prediction{pkg?.predictions > 1 ? "s" : ""}</strong></p>
        <div className="prediction-wallet-check">
          <div><span>WALLET</span><strong>{money(balance)}</strong></div>
          <div><span>PACKAGE</span><strong>GHS {price}</strong></div>
          <div><span>PREDICTIONS</span><strong>{pkg?.predictions}</strong></div>
        </div>
        {balance < price && <div className="alert error">Insufficient wallet balance. You need GHS {price} before you can submit.</div>}
        <label className="upload-box">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} />
          {preview ? <img src={preview} alt="Selected match screenshot" /> : <><strong>Choose screenshot</strong><span>PNG, JPG or WEBP</span></>}
        </label>
        {!prediction && <button className="btn btn-primary big-btn" type="button" disabled={!file || balance < price || analyzing} onClick={analyzeScreenshot}>{analyzing ? "Reading screenshot..." : "Analyze Screenshot"}</button>}
        {analysisError && <div className="alert error">{analysisError}</div>}
        {prediction && (
          <div style={resultStyle}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:14}}>
              <span className="eyebrow">SURE PREDICTION RESULT</span>
              <strong style={{padding:"7px 11px",borderRadius:999,background:"#fff"}}>{prediction.confidence || "Medium"}</strong>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,fontWeight:800,fontSize:17,marginBottom:15}}>
              <span>{prediction.home_team}</span><span style={{opacity:.55}}>VS</span><span>{prediction.away_team}</span>
            </div>
            <div style={{padding:16,borderRadius:16,background:"#fff",marginBottom:12}}><span>🏆 WINNER</span><br/><strong style={{fontSize:24}}>{prediction.predicted_winner}</strong></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
              <div style={statStyle}><span>⚽ GOAL PREDICTION</span><br/><strong>{prediction.goal_prediction || "Unavailable"}</strong></div>
              <div style={statStyle}><span>📊 OVER/UNDER</span><br/><strong>{prediction.over_under || "Unavailable"}</strong></div>
              <div style={statStyle}><span>🤝 BOTH TEAMS TO SCORE</span><br/><strong>{prediction.btts || "Unavailable"}</strong></div>
              <div style={statStyle}><span>🎯 POSSIBLE SCORE</span><br/><strong>{prediction.possible_score || "Unavailable"}</strong></div>
            </div>
            {prediction.odds && <div style={{marginTop:12,fontSize:13,fontWeight:700}}>Displayed odds: {prediction.odds}</div>}
            <div style={{marginTop:12,lineHeight:1.5}}>{prediction.reason}</div>
            <div style={{marginTop:12,fontSize:12,opacity:.72}}>These are automated market-based predictions, not guaranteed match results. Goal and BTTS fields are estimates when those markets are not visible.</div>
            {!submitted && <button className="btn btn-primary big-btn" type="button" style={{marginTop:16}} onClick={() => { setSubmitted(true); onSubmit(); }}>Submit Prediction Request</button>}
          </div>
        )}
        {submitted && <div className="prediction-status">Prediction result revealed and package charged successfully. The activity has been recorded.</div>}
        {ocrText && <details className="ocr-details"><summary>Show detected screenshot text</summary><pre>{ocrText}</pre></details>}
      </div>
    </div>
  );
}

function AdminPanel({ onRefresh }) {
  const [users, setUsers] = useState([]);
  const [adminBets, setAdminBets] = useState([]);
  const [adminTransactions, setAdminTransactions] = useState([]);
  const [manualWithdrawals, setManualWithdrawals] = useState([]);
  const [predictionActivity, setPredictionActivity] = useState([]);
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [settleBetId, setSettleBetId] = useState("");
  const [result, setResult] = useState("won");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setError("");

    const [u, b, t, w, a] = await Promise.all([
      supabase.rpc("admin_get_users"),
      supabase.rpc("admin_get_bets"),
      supabase.rpc("admin_get_transactions"),
      supabase.rpc("admin_get_manual_withdrawals"),
      supabase.from("prediction_activity").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    const firstError = u.error || b.error || t.error || w.error || a.error;

    if (firstError) {
      setError(firstError.message || "Admin data could not be loaded.");
      return;
    }

    setUsers(u.data || []);
    setAdminBets(b.data || []);
    setAdminTransactions(t.data || []);
    setManualWithdrawals(w.data || []);
    setPredictionActivity(a.data || []);
  }

  async function adjustWallet(direction) {
    const value = Number(amount);

    if (!userId || !value || value <= 0) {
      setError("Choose a user and enter a valid amount.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const fn =
        direction === "credit"
          ? "admin_credit_wallet"
          : "admin_debit_wallet";

      const { error: e } = await supabase.rpc(fn, {
        p_user_id: userId,
        p_amount: value,
        p_description: `Admin ${direction}`,
      });

      if (e) throw e;

      setAmount("");
      setMsg(`Wallet ${direction} successful.`);
      await loadAdmin();
      await onRefresh();
    } catch (e) {
      setError(e.message || "Wallet adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    if (!settleBetId) {
      setError("Enter the bet ID.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { error: e } = await supabase.rpc("admin_settle_bet", {
        p_bet_id: settleBetId,
        p_result: result,
      });

      if (e) throw e;

      setSettleBetId("");
      setMsg("Bet settlement completed.");
      await loadAdmin();
      await onRefresh();
    } catch (e) {
      setError(e.message || "Settlement failed.");
    } finally {
      setBusy(false);
    }
  }

  async function processManualWithdrawal(id, action) {
    setBusy(true);
    setError("");

    try {
      const { error: e } = await supabase.rpc(
        "admin_mark_manual_withdrawal",
        {
          p_request_id: id,
          p_action: action,
          p_note: withdrawalNote.trim() || null,
        }
      );

      if (e) throw e;

      setWithdrawalNote("");
      setMsg(
        action === "paid"
          ? "Withdrawal marked as paid."
          : "Withdrawal rejected and wallet refunded."
      );

      await loadAdmin();
      await onRefresh();
    } catch (e) {
      setError(e.message || "Withdrawal update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <PageTitle
        eyebrow="CONTROL CENTRE"
        title="Admin Dashboard"
        text="Manage users, wallets, bets and manual withdrawals."
      />

      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert success">{msg}</div>}

      <div className="admin-stats">
        <div className="admin-stat blue-stat">
          <span>USERS</span>
          <strong>{users.length}</strong>
        </div>
        <div className="admin-stat green-stat">
          <span>BETS</span>
          <strong>{adminBets.length}</strong>
        </div>
        <div className="admin-stat orange-stat">
          <span>TRANSACTIONS</span>
          <strong>{adminTransactions.length}</strong>
        </div>
        <div className="admin-stat purple-stat">
          <span>WITHDRAWALS</span>
          <strong>
            {manualWithdrawals.filter((w) => w.status === "pending").length}
          </strong>
        </div>
        <div className="admin-stat blue-stat">
          <span>SURE PREDICTION ACTIVITY</span>
          <strong>{predictionActivity.length}</strong>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">LIVE ACTIVITY</span>
            <h3>Sure Prediction Notifications</h3>
          </div>
          <span className="count-badge">{predictionActivity.length} recent</span>
        </div>

        {predictionActivity.length === 0 ? (
          <div className="admin-empty">No Sure Prediction activity yet.</div>
        ) : (
          <div className="admin-table">
            {predictionActivity.slice(0, 20).map((activity) => (
              <div className="admin-table-row" key={activity.id}>
                <div>
                  <strong>
                    {activity.activity_type === "prediction_viewed"
                      ? "👁️ Prediction viewed"
                      : activity.activity_type === "prediction_submitted"
                      ? "📸 Screenshot submitted"
                      : activity.activity_type === "package_selected"
                      ? "💰 Package selected"
                      : String(activity.activity_type || "Activity")}
                  </strong>
                  <span>
                    {activity.game || "Unknown game"} • User {String(activity.user_id || "").slice(0, 8)}
                    {activity.package_price ? ` • GHS ${Number(activity.package_price).toLocaleString("en-GH")}` : ""}
                  </span>
                </div>
                <div className="admin-bet-right">
                  <span>{activity.prediction_count ? `${activity.prediction_count} prediction${activity.prediction_count > 1 ? "s" : ""}` : ""}</span>
                  <span>{fmtDate(activity.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-grid">
        <div className="form-card">
          <span className="eyebrow">WALLET MANAGEMENT</span>
          <h3>Adjust user wallet</h3>
          <p>Credit or debit a selected user's wallet.</p>

          <select
            className="field"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email || u.id}
              </option>
            ))}
          </select>

          <input
            className="field"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="admin-button-row">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => adjustWallet("credit")}
            >
              Credit wallet
            </button>
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() => adjustWallet("debit")}
            >
              Debit wallet
            </button>
          </div>
        </div>

        <div className="form-card">
          <span className="eyebrow">BET MANAGEMENT</span>
          <h3>Settle a bet</h3>
          <p>Use the bet UUID and choose the result.</p>

          <input
            className="field"
            placeholder="Bet UUID"
            value={settleBetId}
            onChange={(e) => setSettleBetId(e.target.value)}
          />

          <select
            className="field"
            value={result}
            onChange={(e) => setResult(e.target.value)}
          >
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="void">Void</option>
          </select>

          <button className="btn btn-primary big-btn" disabled={busy} onClick={settle}>
            Settle bet
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">MANUAL PAYOUTS</span>
            <h3>Withdrawal Requests</h3>
          </div>
          <span className="count-badge">
            {manualWithdrawals.filter((w) => w.status === "pending").length} pending
          </span>
        </div>

        <input
          className="field"
          placeholder="Optional admin note"
          value={withdrawalNote}
          onChange={(e) => setWithdrawalNote(e.target.value)}
        />

        {manualWithdrawals.length === 0 ? (
          <div className="admin-empty">No withdrawal requests.</div>
        ) : (
          <div className="admin-list">
            {manualWithdrawals.map((w) => (
              <div className="admin-withdrawal" key={w.id}>
                <div className="admin-withdrawal-main">
                  <div className="amount-big">{money(w.amount)}</div>
                  <strong>{w.user_name || w.user_email || w.user_id}</strong>
                  <span>
                    {w.provider} • {w.account_name} • {w.phone}
                  </span>
                  <small>{fmtDate(w.created_at)}</small>
                  {w.admin_note && <small>Note: {w.admin_note}</small>}
                </div>

                <div className="admin-withdrawal-actions">
                  <span
                    className={`status-pill status-${String(
                      w.status || "pending"
                    ).toLowerCase()}`}
                  >
                    {String(w.status || "pending").toUpperCase()}
                  </span>

                  {w.status === "pending" && (
                    <>
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() =>
                          processManualWithdrawal(w.id, "paid")
                        }
                      >
                        Mark Paid
                      </button>
                      <button
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() =>
                          processManualWithdrawal(w.id, "rejected")
                        }
                      >
                        Reject & Refund
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">USERS</span>
            <h3>Registered Users</h3>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="admin-empty">No users returned.</div>
        ) : (
          <div className="admin-table">
            {users.map((u) => (
              <div className="admin-table-row" key={u.id}>
                <div>
                  <strong>{u.full_name || "Unnamed user"}</strong>
                  <span>{u.email || "No email"}</span>
                </div>
                <span className="role-pill">{u.role || "user"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">BET ACTIVITY</span>
            <h3>Recent Bets</h3>
          </div>
        </div>

        {adminBets.length === 0 ? (
          <div className="admin-empty">No bets returned.</div>
        ) : (
          <div className="admin-table">
            {adminBets.slice(0, 20).map((b) => (
              <div className="admin-table-row" key={b.id}>
                <div>
                  <strong>#{String(b.id).slice(0, 8)}</strong>
                  <span>User: {String(b.user_id).slice(0, 8)}</span>
                </div>
                <div className="admin-bet-right">
                  <span>{String(b.status || "pending").toUpperCase()}</span>
                  <strong>{money(b.stake)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">WALLET ACTIVITY</span>
            <h3>Recent Transactions</h3>
          </div>
        </div>

        {adminTransactions.length === 0 ? (
          <div className="admin-empty">No transactions returned.</div>
        ) : (
          <div className="admin-table">
            {adminTransactions.slice(0, 20).map((t) => (
              <div className="admin-table-row" key={t.id}>
                <div>
                  <strong>{t.type || "Transaction"}</strong>
                  <span>{t.description || ""}</span>
                </div>
                <div className="admin-bet-right">
                  <strong>{money(t.amount)}</strong>
                  <span>{fmtDate(t.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default App;
