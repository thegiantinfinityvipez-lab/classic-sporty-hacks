import React, { useEffect, useMemo, useState } from "react";
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
  {
    key: "casino",
    icon: "🎰",
    title: "CASINO",
    subtitle: "Instant casino games",
    description: "Choose a package and enter the Casino area.",
    tone: "pink",
  },
  {
    key: "bottle",
    icon: "🍾",
    title: "FLIP THE BOTTLE",
    subtitle: "Quick bottle rounds",
    description:
      "Fast Flip the Bottle rounds with simple game play.",
    tone: "orange",
  },
  {
    key: "football",
    icon: "⚽",
    title: "FOOTBALL",
    subtitle: "Virtual football",
    description:
      "Virtual football packages with named teams and match rounds.",
    tone: "blue",
  },
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

  const isAdmin =
    profile?.role === "admin" && profile?.is_active !== false;

  const combinedOdds = useMemo(
    () =>
      betSlip.reduce(
        (total, item) => total * Number(item.odd || 1),
        1
      ),
    [betSlip]
  );

  const potentialWin = Number(stake || 0) * combinedOdds;

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);

      if (!data.session) {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
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
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadAll();
    }
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
      setError(
        e?.message ||
          "Some account data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    const { data, error: e } =
      await supabase.rpc("get_my_profile");

    if (!e) {
      setProfile(
        Array.isArray(data)
          ? data[0] || null
          : data || null
      );
      return;
    }

    const {
      data: fallback,
      error: fe,
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (fe) throw fe;

    setProfile(fallback);
  }

  async function loadWallet() {
    const { data, error: e } =
      await supabase.rpc("get_my_wallet");

    if (!e) {
      setWallet(
        Array.isArray(data)
          ? data[0] || null
          : data || null
      );
      return;
    }

    const {
      data: fallback,
      error: fe,
    } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (fe) throw fe;

    setWallet(fallback);
  }

  async function loadMatches() {
    const {
      data: rows,
      error: e,
    } = await supabase
      .from("matches")
      .select("*")
      .eq("is_active", true)
      .order("start_time", {
        ascending: true,
      });

    if (!e) {
      setMatches(await attachOdds(rows || []));
      return;
    }

    const fallback = await supabase
      .from("matches")
      .select("*")
      .order("start_time", {
        ascending: true,
      });

    if (fallback.error) {
      console.error("Matches:", e);
      setMatches([]);
      return;
    }

    setMatches(
      await attachOdds(fallback.data || [])
    );
  }

  async function attachOdds(rows) {
    if (!rows.length) return [];

    const ids = rows.map((m) => m.id);

    const {
      data: odds,
      error: oddsError,
    } = await supabase
      .from("match_odds")
      .select("*")
      .in("match_id", ids)
      .eq("is_active", true)
      .order("market", {
        ascending: true,
      });

    if (oddsError) throw oddsError;

    const map = {};

    for (const odd of odds || []) {
      if (!map[odd.match_id]) {
        map[odd.match_id] = [];
      }

      map[odd.match_id].push(odd);
    }

    return rows.map((m) => ({
      ...m,
      match_odds: map[m.id] || [],
    }));
  }

  async function loadUserData() {
    const [
      betsResult,
      txResult,
      withdrawalsResult,
    ] = await Promise.all([
      supabase
        .from("bets")
        .select("*")
        .eq("user_id", session.user.id),

      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", {
          ascending: false,
        }),

      supabase.rpc(
        "get_my_manual_withdrawals"
      ),
    ]);

    if (betsResult.error) {
      throw betsResult.error;
    }

    if (txResult.error) {
      throw txResult.error;
    }

    if (withdrawalsResult.error) {
      throw withdrawalsResult.error;
    }

    setBets(betsResult.data || []);
    setTransactions(txResult.data || []);
    setManualWithdrawals(
      withdrawalsResult.data || []
    );
  }

  function flash(text) {
    setMessage(text);

    setTimeout(() => {
      setMessage("");
    }, 3500);
  }

  function clearError() {
    setError("");
  }

  function formatPhone(value) {
    let cleaned = value.replace(
      /[^\d+]/g,
      ""
    );

    if (cleaned.startsWith("+233")) {
      return cleaned.slice(0, 13);
    }

    if (cleaned.startsWith("233")) {
      return `+${cleaned.slice(0, 12)}`;
    }

    return cleaned
      .replace(/\D/g, "")
      .slice(0, 10);
  }

  async function handleAuth(e) {
    e.preventDefault();

    setBusy(true);
    clearError();
    setMessage("");

    try {
      if (authMode === "signup") {
        if (!name.trim()) {
          throw new Error(
            "Enter your full name."
          );
        }

        if (!phone.trim()) {
          throw new Error(
            "Enter your Ghana phone number."
          );
        }

        if (password.length < 6) {
          throw new Error(
            "Password must be at least 6 characters."
          );
        }

        const {
          data,
          error: e1,
        } = await supabase.auth.signUp({
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
          flash(
            "Account created. Check your email to confirm your account."
          );
        } else {
          flash(
            "Account created successfully."
          );
        }
      } else {
        const { error: e1 } =
          await supabase.auth.signInWithPassword(
            {
              email: email.trim(),
              password,
            }
          );

        if (e1) throw e1;

        flash("Welcome back.");
      }
    } catch (e1) {
      setError(
        e1.message ||
          "Authentication failed."
      );
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

  function choosePackage(price) {
    const pkg = PACKAGES.find(
      (item) => item.price === price
    );

    setSelectedPackage(pkg || null);
    setDepositAmount(String(price));
    setPage("wallet");

    flash(
      `GHS ${price} package selected. The amount has been added to Deposit.`
    );
  }

  function openSurePrediction(game) {
    if (!selectedPackage) {
      setError(
        "Choose a Sure Prediction package first."
      );
      return;
    }

    const balance = Number(
      wallet?.balance || 0
    );

    if (
      balance <
      Number(selectedPackage.price)
    ) {
      setDepositAmount(
        String(selectedPackage.price)
      );

      setPage("wallet");

      flash(
        `You need GHS ${selectedPackage.price} in your wallet before submitting this package.`
      );

      return;
    }

    setPredictionGame(game);
  }

  function confirmSurePrediction() {
    setPredictionGame(null);

    flash(
      "Sure Prediction request submitted for manual processing."
    );
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

    if (
      !Number.isFinite(item.odd) ||
      item.odd <= 0
    ) {
      setError(
        "This odd is not available."
      );
      return;
    }

    setBetSlip((old) => {
      const withoutSameMatchMarket =
        old.filter(
          (x) =>
            !(
              x.matchId === item.matchId &&
              x.market === item.market
            )
        );

      return [
        ...withoutSameMatchMarket,
        item,
      ];
    });

    flash(
      `${match.home_team} vs ${match.away_team}: ${odd.selection} added`
    );
  }

  function removeFromSlip(
    matchId,
    market
  ) {
    setBetSlip((old) =>
      old.filter(
        (x) =>
          !(
            x.matchId === matchId &&
            x.market === market
          )
      )
    );
  }

  async function placeBet() {
    clearError();

    const amount = Number(stake);

    if (!session) {
      return setError(
        "Please log in first."
      );
    }

    if (!betSlip.length) {
      return setError(
        "Select at least one odd."
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return setError(
        "Enter a valid stake."
      );
    }

    if (
      wallet &&
      amount > Number(wallet.balance)
    ) {
      return setError(
        "Insufficient wallet balance."
      );
    }

    setBusy(true);

    try {
      const selections =
        betSlip.map((x) => ({
          match_id: x.matchId,
          market: x.market,
          selection: x.selectionKey,
        }));

      const {
        error: e,
      } = await supabase.rpc(
        "place_bet",
        {
          p_stake: amount,
          p_selections: selections,
        }
      );

      if (e) throw e;

      setStake("");
      setBetSlip([]);

      await Promise.all([
        loadWallet(),
        loadUserData(),
      ]);

      flash(
        "Bet placed successfully."
      );
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

    const amount = Number(
      depositAmount
    );

    const reference =
      depositReference.trim();

    if (!session?.user) {
      return setError(
        "Please log in before making a deposit."
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return setError(
        "Enter a valid deposit amount."
      );
    }

    if (amount < 1) {
      return setError(
        "Minimum deposit is GHS 1.00."
      );
    }

    if (!reference) {
      return setError(
        "Enter the MoMo transaction/reference number after payment."
      );
    }

    setBusy(true);
    clearError();

    try {
      const {
        error: e1,
      } = await supabase.rpc(
        "request_deposit",
        {
          p_amount: amount,
          p_payment_method:
            "MTN Mobile Money",
          p_payment_reference:
            reference,
        }
      );

      if (e1) throw e1;

      setDepositAmount("");
      setDepositReference("");

      await loadUserData();

      flash(
        "Deposit request submitted. Your wallet will be credited after the payment is verified."
      );
    } catch (e1) {
      console.error(
        "Manual deposit error:",
        e1
      );

      setError(
        e1?.message ||
          "Deposit request failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestWithdrawal(e) {
    e.preventDefault();

    clearError();

    const amount = Number(
      withdrawAmount
    );

    const phoneValue =
      withdrawDestination.trim();

    const recipientName =
      withdrawName.trim();

    if (!amount || amount <= 0) {
      return setError(
        "Enter a valid withdrawal amount."
      );
    }

    if (amount < 10) {
      return setError(
        "Minimum withdrawal is GHS 10.00."
      );
    }

    if (!recipientName) {
      return setError(
        "Enter the name registered on the MoMo account."
      );
    }

    if (
      !/^0\d{9}$/.test(phoneValue)
    ) {
      return setError(
        "Enter a valid Ghana mobile number, e.g. 0551234567."
      );
    }

    if (
      Number(wallet?.balance || 0) <
      amount
    ) {
      return setError(
        "Insufficient wallet balance."
      );
    }

    setBusy(true);
    setMessage(
      "Submitting your withdrawal request..."
    );

    try {
      const {
        error: e1,
      } = await supabase.rpc(
        "request_manual_withdrawal",
        {
          p_amount: amount,
          p_provider:
            withdrawProvider,
          p_account_name:
            recipientName,
          p_phone: phoneValue,
        }
      );

      if (e1) throw e1;

      setWithdrawAmount("");
      setWithdrawDestination("");
      setWithdrawName("");

      await Promise.all([
        loadWallet(),
        loadUserData(),
      ]);

      setMessage(
        "Withdrawal request submitted. Your balance is held while the request is processed."
      );
    } catch (e1) {
      console.error(
        "Manual withdrawal error:",
        e1
      );

      setError(
        e1?.message ||
          "Withdrawal request failed."
      );

      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSportsMatches() {
    setSportsLoading(true);

    try {
      await loadMatches();
      flash(
        "Match list refreshed."
      );
    } catch (e) {
      setError(
        e?.message ||
          "Unable to refresh matches."
      );
    } finally {
      setSportsLoading(false);
    }
  }

  const marketGroups = (odds) => {
    const groups = {};

    for (const o of odds || []) {
      const key = o.market || "Other";

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(o);
    }

    return groups;
  };

  const featuredMatches =
    matches.slice(0, 3);

  const upcomingMatches =
    matches.slice(0, 8);

  if (!session) {
    return (
      <div className="csh-app auth-page">
        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand-mark">
              CS
            </div>

            <div>
              <div className="brand">
                CLASSIC SPORTY HACKS
              </div>

              <div className="brand-sub">
                Games • Predictions • Wallet
              </div>
            </div>
          </div>
        </header>

        <main className="auth-area">
          <div className="auth-decoration decor-one" />
          <div className="auth-decoration decor-two" />

          <section className="auth-card">
            <div className="auth-badge">
              {authMode === "login"
                ? "WELCOME BACK"
                : "JOIN CLASSIC SPORTY"}
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

            {error && (
              <div className="alert error">
                {error}
              </div>
            )}

            {message && (
              <div className="alert success">
                {message}
              </div>
            )}

            <form
              onSubmit={handleAuth}
              className="auth-form"
            >
              {authMode ===
                "signup" && (
                <>
                  <label>
                    Full name
                  </label>

                  <input
                    className="field"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                      )
                    }
                  />

                  <label>
                    Ghana phone number
                  </label>

                  <input
                    className="field"
                    type="tel"
                    placeholder="0551234567"
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        formatPhone(
                          e.target.value
                        )
                      )
                    }
                  />
                </>
              )}

              <label>
                Email address
              </label>

              <input
                className="field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                required
              />

              <label>
                Password
              </label>

              <input
                className="field"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                required
              />

              <button
                className="btn btn-primary big-btn"
                disabled={busy}
              >
                {busy
                  ? "Please wait..."
                  : authMode ===
                    "login"
                  ? "Login to account"
                  : "Create account"}
              </button>
            </form>

            <button
              className="switch-auth"
              onClick={() => {
                clearError();

                setAuthMode(
                  authMode === "login"
                    ? "signup"
                    : "login"
                );
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
        <div className="loading-logo">
          CS
        </div>

        <strong>
          Loading Classic Sporty Hacks...
        </strong>

        <span>
          Preparing your football dashboard
        </span>
      </div>
    );
  }

  return (
    <div className="csh-app">
      <header className="topbar main-topbar">
        <div className="brand-wrap">
          <div className="brand-mark">
            CS
          </div>

          <div>
            <div className="brand">
              CLASSIC SPORTY HACKS
            </div>

            <div className="brand-sub">
              {profile?.full_name ||
                session.user.email}
            </div>
          </div>
        </div>

        <div className="top-actions">
          <div className="top-balance">
            <span>
              Wallet
            </span>

            <strong>
              {money(wallet?.balance)}
            </strong>
          </div>

          <button
            className="top-deposit-btn"
            onClick={() =>
              setPage("wallet")
            }
          >
            + Deposit
          </button>

          <button
            className="logout-btn"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="side-title">
            MENU
          </div>

          <NavButton
            active={page === "home"}
            icon="⌂"
            label="Home"
            onClick={() =>
              setPage("home")
            }
          />

          <NavButton
            active={
              page === "game" &&
              selectedGame?.key ===
                "football"
            }
            icon="⚽"
            label="Football"
            onClick={() =>
              openGame(
                GAME_CATALOG[2]
              )
            }
          />

          <NavButton
            active={page === "bets"}
            icon="🎟️"
            label="My Bets"
            onClick={() =>
              setPage("bets")
            }
          />

          <NavButton
            active={page === "wallet"}
            icon="💰"
            label="Wallet"
            onClick={() =>
              setPage("wallet")
            }
          />

          <NavButton
            active={
              page === "transactions"
            }
            icon="🧾"
            label="Transactions"
            onClick={() =>
              setPage(
                "transactions"
              )
            }
          />

          {isAdmin && (
            <>
              <div className="side-title admin-title">
                MANAGEMENT
              </div>

              <NavButton
                active={
                  page === "admin"
                }
                icon="🛠️"
                label="Admin Dashboard"
                onClick={() =>
                  setPage("admin")
                }
              />
            </>
          )}

          <div className="sidebar-card">
            <div className="mini-icon">
              🎯
            </div>

            <strong>
              Sure Prediction
            </strong>

            <p>
              Choose a package, submit
              a clear match screenshot
              and wait for manual
              processing.
            </p>
          </div>
        </aside>

        <main className="main-content">
          {message && (
            <div className="alert success">
              {message}
            </div>
          )}

          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          {page === "home" && (
            <section className="page-section home-dashboard-page">
              <div className="hero-banner">
                <div className="hero-copy">
                  <span className="hero-kicker">
                    CLASSIC SPORTY HACKS
                  </span>

                  <h1>
                    Pick your game.
                    <br />
                    <span>
                      Build your prediction.
                    </span>
                  </h1>

                  <p>
                    Choose Football,
                    Casino or Flip the
                    Bottle. Open a game,
                    select your package
                    and continue through
                    your wallet deposit
                    area.
                  </p>

                  <div className="hero-buttons">
                    <button
                      className="btn btn-white"
                      type="button"
                      onClick={() =>
                        openGame(
                          GAME_CATALOG[2]
                        )
                      }
                    >
                      Open Football
                    </button>

                    <button
                      className="btn btn-yellow"
                      type="button"
                      onClick={() =>
                        setPage("wallet")
                      }
                    >
                      + Add Funds
                    </button>
                  </div>
                </div>

                <div className="hero-art">
                  <div className="football">
                    ⚽
                  </div>

                  <div className="hero-chip chip-one">
                    SURE PREDICTION
                  </div>

                  <div className="hero-chip chip-two">
                    3 PACKAGES
                  </div>

                  <div className="hero-score">
                    <span>
                      WALLET
                    </span>

                    <strong>
                      {money(
                        wallet?.balance
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="feature-grid">
                <button
                  className="feature-card feature-blue"
                  type="button"
                  onClick={() =>
                    openGame(
                      GAME_CATALOG[2]
                    )
                  }
                >
                  <div className="feature-icon">
                    ⚽
                  </div>

                  <div>
                    <strong>
                      Football
                    </strong>

                    <span>
                      Named teams &
                      Sure Prediction
                    </span>
                  </div>

                  <b className="feature-arrow">
                    ›
                  </b>
                </button>

                <button
                  className="feature-card feature-orange"
                  type="button"
                  onClick={() =>
                    openGame(
                      GAME_CATALOG[0]
                    )
                  }
                >
                  <div className="feature-icon">
                    🎰
                  </div>

                  <div>
                    <strong>
                      Casino
                    </strong>

                    <span>
                      Packages &
                      Sure Prediction
                    </span>
                  </div>

                  <b className="feature-arrow">
                    ›
                  </b>
                </button>

                <button
                  className="feature-card feature-green"
                  type="button"
                  onClick={() =>
                    openGame(
                      GAME_CATALOG[1]
                    )
                  }
                >
                  <div className="feature-icon">
                    🍾
                  </div>

                  <div>
                    <strong>
                      Flip the Bottle
                    </strong>

                    <span>
                      Packages &
                      Sure Prediction
                    </span>
                  </div>

                  <b className="feature-arrow">
                    ›
                  </b>
                </button>

                <button
                  className="feature-card feature-purple"
                  type="button"
                  onClick={() =>
                    setPage("wallet")
                  }
                >
                  <div className="feature-icon">
                    💰
                  </div>

                  <div>
                    <strong>
                      Wallet
                    </strong>

                    <span>
                      Deposit & manage
                      your balance
                    </span>
                  </div>

                  <b className="feature-arrow">
                    ›
                  </b>
                </button>
              </div>

              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    PLAY & PREDICT
                  </span>

                  <h2>
                    Choose your game
                  </h2>

                  <p>
                    Every game has GHS
                    300, GHS 400 and GHS
                    500 packages.
                  </p>
                </div>
              </div>

              <div className="home-game-grid home-game-grid-three">
                {GAME_CATALOG.map(
                  (game) => (
                    <GameChoiceCard
                      key={game.key}
                      game={game}
                      onOpen={openGame}
                    />
                  )
                )}
              </div>

              <div className="home-wallet-banner">
                <div>
                  <span className="eyebrow">
                    YOUR WALLET
                  </span>

                  <h3>
                    {money(
                      wallet?.balance
                    )}
                  </h3>

                  <p>
                    Select a package
                    and the amount will
                    be carried into the
                    Deposit area.
                  </p>
                </div>

                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() =>
                    setPage("wallet")
                  }
                >
                  Go to Deposit
                </button>
              </div>
            </section>
          )}

          {page === "game" &&
            selectedGame && (
              <GameDetailPage
                game={selectedGame}
                wallet={wallet}
                onBack={() =>
                  setPage("home")
                }
                onPackage={
                  choosePackage
                }
                onPrediction={() =>
                  openSurePrediction(
                    selectedGame
                  )
                }
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
                  <div className="empty-icon">
                    🎟️
                  </div>

                  <h3>
                    No bets yet
                  </h3>

                  <p>
                    Your football bet
                    history will appear
                    here when you place a
                    bet.
                  </p>

                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      setPage("home")
                    }
                  >
                    Go to Games
                  </button>
                </div>
              ) : (
                <div className="bet-history-grid">
                  {bets.map((bet) => (
                    <div
                      className="history-card"
                      key={bet.id}
                    >
                      <div className="history-top">
                        <div>
                          <span className="eyebrow">
                            BET REFERENCE
                          </span>

                          <strong>
                            #
                            {String(
                              bet.id
                            ).slice(
                              0,
                              8
                            )}
                          </strong>
                        </div>

                        <span className="status-pill">
                          {String(
                            bet.status ||
                              "pending"
                          ).toUpperCase()}
                        </span>
                      </div>

                      <div className="history-stats">
                        <Stat
                          label="Stake"
                          value={money(
                            bet.stake
                          )}
                        />

                        <Stat
                          label="Combined odds"
                          value={Number(
                            bet.combined_odds ||
                              0
                          ).toFixed(2)}
                        />

                        <Stat
                          label="Potential win"
                          value={money(
                            bet.potential_win
                          )}
                        />
                      </div>

                      {bet.created_at && (
                        <div className="history-date">
                          {fmtDate(
                            bet.created_at
                          )}
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
                  <div>
                    <span className="eyebrow">
                      SURE PREDICTION
                      PACKAGE
                    </span>

                    <strong>
                      GHS{" "}
                      {
                        selectedPackage.price
                      }{" "}
                      ·{" "}
                      {
                        selectedPackage.predictions
                      }{" "}
                      prediction
                      {selectedPackage.predictions >
                      1
                        ? "s"
                        : ""}
                    </strong>

                    <p>
                      The selected amount
                      is already filled
                      into Deposit.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setPage("game")
                    }
                  >
                    Back to Game
                  </button>
                </div>
              )}

              <div className="wallet-balance-card">
                <div>
                  <span>
                    AVAILABLE BALANCE
                  </span>

                  <strong>
                    {money(
                      wallet?.balance
                    )}
                  </strong>

                  <small>
                    {wallet?.currency ||
                      "GHS"}
                  </small>
                </div>

                <div className="wallet-symbol">
                  ₵
                </div>
              </div>

              <div className="wallet-grid">
                <form
                  className="form-card deposit-manual-card"
                  onSubmit={
                    handleRealDeposit
                  }
                >
                  <div className="form-icon green-icon">
                    ₵
                  </div>

                  <span className="eyebrow">
                    MANUAL MOBILE
                    MONEY DEPOSIT
                  </span>

                  <h3>
                    Send money to Classic
                    Sporty
                  </h3>

                  <p>
                    Send the real deposit
                    from your MTN Mobile
                    Money account, then
                    submit the transaction
                    reference below. Your
                    in-app balance does
                    not change until the
                    payment is verified.
                  </p>

                  <div className="momo-payment-box">
                    <div className="momo-brand-row">
                      <span className="momo-badge">
                        MTN
                      </span>

                      <div>
                        <strong>
                          MTN Mobile Money
                        </strong>

                        <small>
                          Payment number
                        </small>
                      </div>
                    </div>

                    <div className="momo-number">
                      0597021610
                    </div>

                    <button
                      type="button"
                      className="copy-number-btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            "0597021610"
                          );

                          flash(
                            "MTN payment number copied."
                          );
                        } catch {
                          flash(
                            "Payment number: 0597021610"
                          );
                        }
                      }}
                    >
                      Copy number
                    </button>
                  </div>

                  <div className="deposit-steps">
                    <div>
                      <b>1</b>

                      <span>
                        Send your chosen
                        amount to{" "}
                        <strong>
                          0597021610
                        </strong>{" "}
                        on MTN MoMo.
                      </span>
                    </div>

                    <div>
                      <b>2</b>

                      <span>
                        Confirm the
                        recipient name shown
                        in your MoMo prompt
                        before sending.
                      </span>
                    </div>

                    <div>
                      <b>3</b>

                      <span>
                        Enter the amount and
                        your MoMo
                        transaction/reference
                        number below.
                      </span>
                    </div>
                  </div>

                  <label>
                    Amount (GHS)
                  </label>

                  <input
                    className="field"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="100.00"
                    value={depositAmount}
                    onChange={(e) =>
                      setDepositAmount(
                        e.target.value
                      )
                    }
                  />

                  <label>
                    MoMo
                    transaction/reference
                    number
                  </label>

                  <input
                    className="field"
                    type="text"
                    placeholder="e.g. 123456789012"
                    value={
                      depositReference
                    }
                    onChange={(e) =>
                      setDepositReference(
                        e.target.value
                      )
                    }
                  />

                  <button
                    className="btn btn-primary big-btn"
                    disabled={busy}
                  >
                    {busy
                      ? "Submitting..."
                      : "Submit deposit for verification"}
                  </button>

                  <div className="helper">
                    Your wallet is
                    credited only after
                    the payment is checked
                    and approved.
                  </div>
                </form>

                <form
                  className="form-card"
                  onSubmit={
                    requestWithdrawal
                  }
                >
                  <div className="form-icon orange-icon">
                    ↗
                  </div>

                  <span className="eyebrow">
                    CASH OUT
                  </span>

                  <h3>
                    Withdraw to Mobile
                    Money
                  </h3>

                  <p>
                    Your request is held
                    for manual processing.
                    An admin sends the
                    MoMo payment and marks
                    it paid.
                  </p>

                  <label>
                    Amount
                  </label>

                  <input
                    className="field"
                    type="number"
                    min="10"
                    step="0.01"
                    placeholder="10.00"
                    value={withdrawAmount}
                    onChange={(e) =>
                      setWithdrawAmount(
                        e.target.value
                      )
                    }
                  />

                  <label>
                    Network
                  </label>

                  <select
                    className="field"
                    value={
                      withdrawProvider
                    }
                    onChange={(e) =>
                      setWithdrawProvider(
                        e.target.value
                      )
                    }
                  >
                    <option value="MTN">
                      MTN Mobile Money
                    </option>

                    <option value="VOD">
                      Telecel Cash
                    </option>

                    <option value="AIRTELTIGO">
                      AirtelTigo Money
                    </option>
                  </select>

                  <label>
                    Account name
                  </label>

                  <input
                    className="field"
                    type="text"
                    placeholder="Name registered on MoMo"
                    value={withdrawName}
                    onChange={(e) =>
                      setWithdrawName(
                        e.target.value
                      )
                    }
                  />

                  <label>
                    Mobile number
                  </label>

                  <input
                    className="field"
                    type="tel"
                    placeholder="0551234567"
                    value={
                      withdrawDestination
                    }
                    onChange={(e) =>
                      setWithdrawDestination(
                        e.target.value
                      )
                    }
                  />

                  <button
                    className="btn btn-primary big-btn"
                    disabled={busy}
                  >
                    {busy
                      ? "Submitting..."
                      : "Request Withdrawal"}
                  </button>

                  <div className="helper">
                    Minimum withdrawal:
                    GHS 10.00.
                  </div>
                </form>
              </div>

              <div className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <span className="eyebrow">
                      WITHDRAWAL HISTORY
                    </span>

                    <h3>
                      Your Requests
                    </h3>
                  </div>
                </div>

                {manualWithdrawals.length ===
                0 ? (
                  <div className="admin-empty">
                    No withdrawal
                    requests yet.
                  </div>
                ) : (
                  <div className="admin-list">
                    {manualWithdrawals.map(
                      (w) => (
                        <div
                          className="admin-withdrawal"
                          key={w.id}
                        >
                          <div className="admin-withdrawal-main">
                            <div className="amount-big">
                              {money(
                                w.amount
                              )}
                            </div>

                            <strong>
                              {w.provider}
                            </strong>

                            <span>
                              {
                                w.account_name
                              }{" "}
                              •{" "}
                              {w.phone}
                            </span>

                            <small>
                              {fmtDate(
                                w.created_at
                              )}
                            </small>
                          </div>

                          <span
                            className={`status-pill status-${String(
                              w.status ||
                                "pending"
                            ).toLowerCase()}`}
                          >
                            {String(
                              w.status ||
                                "pending"
                            ).toUpperCase()}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {page ===
            "transactions" && (
            <section className="page-section">
              <PageTitle
                eyebrow="WALLET ACTIVITY"
                title="Transactions"
                text="Review deposits, withdrawals and wallet activity."
              />

              {transactions.length ===
              0 ? (
                <div className="empty-card">
                  <div className="empty-icon">
                    🧾
                  </div>

                  <h3>
                    No transactions
                  </h3>

                  <p>
                    Your wallet activity
                    will appear here.
                  </p>
                </div>
              ) : (
                <div className="transaction-list">
                  {transactions.map(
                    (tx) => (
                      <div
                        className="transaction-card"
                        key={tx.id}
                      >
                        <div>
                          <strong>
                            {tx.type ||
                              "Transaction"}
                          </strong>

                          <span>
                            {tx.description ||
                              ""}
                          </span>

                          <small>
                            {fmtDate(
                              tx.created_at
                            )}
                          </small>
                        </div>

                        <strong>
                          {money(
                            tx.amount
                          )}
                        </strong>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {page === "admin" &&
            isAdmin && (
              <AdminDashboard
                onRefresh={loadAll}
              />
            )}
        </main>
      </div>

      {predictionGame && (
        <PredictionModal
          game={predictionGame}
          pkg={selectedPackage}
          wallet={wallet}
          onClose={() =>
            setPredictionGame(null)
          }
          onSubmit={
            confirmSurePrediction
          }
        />
      )}

      {betSlip.length > 0 && (
        <BetSlip
          selections={betSlip}
          stake={stake}
          setStake={setStake}
          combinedOdds={combinedOdds}
          potentialWin={potentialWin}
          onRemove={
            removeFromSlip
          }
          onPlace={placeBet}
          busy={busy}
        />
      )}
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`nav-button ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      <span className="nav-icon">
        {icon}
      </span>

      <span>{label}</span>
    </button>
  );
}

function PageTitle({
  eyebrow,
  title,
  text,
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">
        {eyebrow}
      </span>

      <h1>{title}</h1>

      <p>{text}</p>
    </div>
  );
}

function Stat({
  label,
  value,
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GameChoiceCard({
  game,
  onOpen,
}) {
  return (
    <button
      className={`game-choice-card game-tone-${game.tone}`}
      type="button"
      onClick={() =>
        onOpen(game)
      }
    >
      <div className="game-choice-icon">
        {game.icon}
      </div>

      <div className="game-choice-content">
        <span>
          {game.subtitle}
        </span>

        <h3>{game.title}</h3>

        <p>
          {game.description}
        </p>

        <strong>
          Open Game →
        </strong>
      </div>
    </button>
  );
}

function GameDetailPage({
  game,
  wallet,
  onBack,
  onPackage,
  onPrediction,
}) {
  const footballMatches = [
    {
      home: "Real Madrid",
      away: "Barcelona",
    },
    {
      home: "Manchester City",
      away: "Liverpool",
    },
    {
      home: "Bayern Munich",
      away: "Borussia Dortmund",
    },
    {
      home: "Arsenal",
      away: "Chelsea",
    },
    {
      home: "Inter Milan",
      away: "AC Milan",
    },
  ];

  return (
    <section className="page-section">
      <button
        className="back-link"
        type="button"
        onClick={onBack}
      >
        ← Back to Games
      </button>

      <div
        className={`game-detail-hero game-tone-${game.tone}`}
      >
        <div>
          <div className="detail-game-icon">
            {game.icon}
          </div>

          <span className="eyebrow">
            {game.subtitle}
          </span>

          <h1>{game.title}</h1>

          <p>
            Choose your package and
            continue to Sure Prediction.
          </p>
        </div>

        <div className="detail-wallet">
          <span>
            WALLET
          </span>

          <strong>
            {money(wallet?.balance)}
          </strong>
        </div>
      </div>

      {game.key ===
        "football" && (
        <div className="football-fixtures-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                FOOTBALL
              </span>

              <h2>
                Match options
              </h2>

              <p>
                Upload a screenshot of
                any football match for
                automatic Sure Prediction
                analysis.
              </p>
            </div>
          </div>

          <div className="fixture-grid">
            {footballMatches.map(
              (match, index) => (
                <div
                  className="fixture-card"
                  key={index}
                >
                  <span>
                    MATCH {index + 1}
                  </span>

                  <strong>
                    {match.home}
                  </strong>

                  <b>VS</b>

                  <strong>
                    {match.away}
                  </strong>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="section-heading package-heading">
        <div>
          <span className="eyebrow">
            SURE PREDICTION PACKAGES
          </span>

          <h2>
            Choose your package
          </h2>

          <p>
            All packages have no expiry.
          </p>
        </div>
      </div>

      <div className="package-grid">
        {PACKAGES.map((pkg) => (
          <button
            key={pkg.price}
            className="package-card"
            type="button"
            onClick={() =>
              onPackage(pkg.price)
            }
          >
            <div className="package-icon">
              {pkg.icon}
            </div>

            <span className="package-label">
              PACKAGE
            </span>

            <strong>
              GHS {pkg.price}
            </strong>

            <b>
              {pkg.predictions} prediction
              {pkg.predictions >
              1
                ? "s"
                : ""}
            </b>

            <small>
              NO EXPIRY
            </small>

            <span className="package-action">
              Select Package →
            </span>
          </button>
        ))}
      </div>

      <div className="prediction-callout">
        <div>
          <span className="eyebrow">
            FOOTBALL SCREENSHOT
          </span>

          <h3>
            SURE PREDICTION
          </h3>

          <p>
            Upload a clear screenshot
            showing the match and odds.
            The prediction system will
            automatically read the teams
            and analyze the match.
          </p>
        </div>

        <button
          className="btn btn-primary"
          type="button"
          onClick={onPrediction}
        >
          Sure Prediction
        </button>
      </div>
    </section>
  );
}

function PredictionModal({
  game,
  pkg,
  wallet,
  onClose,
  onSubmit,
}) {
  const [file, setFile] =
    useState(null);

  const [preview, setPreview] =
    useState("");

  const [submitted, setSubmitted] =
    useState(false);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [prediction, setPrediction] =
    useState(null);

  const [analysisError, setAnalysisError] =
    useState("");

  const balance = Number(
    wallet?.balance || 0
  );

  const price = Number(
    pkg?.price || 0
  );

  function handleFile(e) {
    const next =
      e.target.files?.[0];

    if (!next) return;

    if (
      !next.type.startsWith(
        "image/"
      )
    ) {
      setAnalysisError(
        "Please upload an image screenshot."
      );
      return;
    }

    setFile(next);

    setPreview(
      URL.createObjectURL(next)
    );

    setSubmitted(false);
    setPrediction(null);
    setAnalysisError("");
  }

  async function analyzeScreenshot() {
    if (!file) {
      setAnalysisError(
        "Upload a match screenshot first."
      );
      return;
    }

    if (balance < price) {
      setAnalysisError(
        `Your wallet balance is below the GHS ${price} package price.`
      );
      return;
    }

    setAnalyzing(true);
    setAnalysisError("");
    setPrediction(null);

    try {
      const reader =
        new FileReader();

      const imageData =
        await new Promise(
          (resolve, reject) => {
            reader.onload = () =>
              resolve(
                reader.result
              );

            reader.onerror = () =>
              reject(
                new Error(
                  "Could not read the screenshot."
                )
              );

            reader.readAsDataURL(
              file
            );
          }
        );

      const response =
        await fetch(
          "/api/sure-prediction",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              image: imageData,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Prediction service is unavailable."
        );
      }

      if (!data?.prediction) {
        throw new Error(
          "No prediction was returned."
        );
      }

      setPrediction(
        data.prediction
      );
    } catch (err) {
      console.error(
        "Sure Prediction error:",
        err
      );

      setAnalysisError(
        err.message ||
          "Could not analyze this screenshot."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function submitRequest() {
    setSubmitted(true);
    onSubmit();
  }

  return (
    <div className="modal-backdrop">
      <div className="prediction-modal">
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
        >
          ×
        </button>

        <div className="prediction-modal-head">
          <div className="prediction-target">
            {game.icon}
          </div>

          <div>
            <span className="eyebrow">
              SURE PREDICTION
            </span>

            <h2>
              Upload Match Screenshot
            </h2>

            <p>
              The system will read the
              football screenshot and
              automatically analyze the
              match.
            </p>
          </div>
        </div>

        <div className="prediction-package-summary">
          <div>
            <span>
              PACKAGE
            </span>

            <strong>
              GHS {pkg?.price || 0}
            </strong>
          </div>

          <div>
            <span>
              WALLET
            </span>

            <strong>
              {money(
                wallet?.balance
              )}
            </strong>
          </div>

          <div>
            <span>
              PREDICTIONS
            </span>

            <strong>
              {pkg?.predictions || 0}
            </strong>
          </div>
        </div>

        {balance < price && (
          <div className="prediction-warning">
            Your wallet balance is below
            this package price. Please
            deposit at least{" "}
            <strong>
              GHS {price}
            </strong>{" "}
            before using the prediction.
          </div>
        )}

        <label className="upload-box">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
          />

          {!preview ? (
            <>
              <div className="upload-icon">
                📸
              </div>

              <strong>
                Upload Match Screenshot
              </strong>

              <span>
                PNG, JPG or screenshot
              </span>
            </>
          ) : (
            <img
              src={preview}
              alt="Uploaded match screenshot"
              className="prediction-preview"
            />
          )}
        </label>

        {file && (
          <div className="screenshot-received">
            <span>
              ✓ Screenshot selected
            </span>

            <small>
              {file.name}
            </small>
          </div>
        )}

        {analysisError && (
          <div className="alert error">
            {analysisError}
          </div>
        )}

        {!prediction &&
          !submitted && (
            <button
              className="btn btn-primary big-btn"
              type="button"
              disabled={
                analyzing ||
                !file ||
                balance < price
              }
              onClick={
                analyzeScreenshot
              }
            >
              {analyzing
                ? "Analyzing Screenshot..."
                : "Analyze Screenshot"}
            </button>
          )}

        {analyzing && (
          <div className="prediction-loading">
            <div className="prediction-spinner" />

            <strong>
              Reading your match...
            </strong>

            <span>
              Identifying teams, odds and
              available match information.
            </span>
          </div>
        )}

        {prediction && !submitted && (
          <div className="prediction-result">
            <div className="prediction-result-head">
              <span>
                SURE PREDICTION RESULT
              </span>

              <strong>
                ⚽
              </strong>
            </div>

            <div className="prediction-match">
              <span>
                {prediction.home_team ||
                  "Home Team"}
              </span>

              <b>
                VS
              </b>

              <span>
                {prediction.away_team ||
                  "Away Team"}
              </span>
            </div>

            <div className="winner-box">
              <span>
                PREDICTED WINNER
              </span>

              <strong>
                {prediction.predicted_winner ||
                  "Unable to determine"}
              </strong>
            </div>

            <div className="prediction-details">
              <div>
                <span>
                  MARKET
                </span>

                <strong>
                  {prediction.market ||
                    "1X2"}
                </strong>
              </div>

              <div>
                <span>
                  CONFIDENCE
                </span>

                <strong>
                  {prediction.confidence ||
                    "Low"}
                </strong>
              </div>

              <div>
                <span>
                  ODDS
                </span>

                <strong>
                  {prediction.odds ||
                    "Not available"}
                </strong>
              </div>
            </div>

            <div className="prediction-reason">
              <span>
                ANALYSIS
              </span>

              <p>
                {prediction.reason ||
                  "The screenshot did not provide enough information for a detailed explanation."}
              </p>
            </div>

            <div className="prediction-disclaimer">
              This is an automated analysis
              based on the information visible
              in the uploaded screenshot. It is
              a prediction, not a guarantee of
              the match result.
            </div>

            <button
              className="btn btn-primary big-btn"
              type="button"
              onClick={
                submitRequest
              }
            >
              Submit Prediction Request
            </button>
          </div>
        )}

        {submitted && (
          <div className="prediction-submitted">
            <div className="submitted-icon">
              ✓
            </div>

            <h3>
              Prediction Request Submitted
            </h3>

            <p>
              Your Sure Prediction request
              has been submitted for manual
              processing.
            </p>

            <small>
              The administrator will handle
              the package deduction and
              prediction credit manually.
            </small>

            <button
              className="btn btn-primary"
              type="button"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}

        <div className="prediction-modal-footer">
          <span>
            Package: GHS{" "}
            {pkg?.price || 0}
          </span>

          <span>
            No expiry
          </span>
        </div>
      </div>
    </div>
  );
}

function BetSlip({
  selections,
  stake,
  setStake,
  combinedOdds,
  potentialWin,
  onRemove,
  onPlace,
  busy,
}) {
  return (
    <div className="bet-slip">
      <div className="bet-slip-head">
        <div>
          <span className="eyebrow">
            BET SLIP
          </span>

          <h3>
            {selections.length} selection
            {selections.length > 1
              ? "s"
              : ""}
          </h3>
        </div>

        <span className="bet-slip-odds">
          {combinedOdds.toFixed(2)}
        </span>
      </div>

      <div className="bet-slip-items">
        {selections.map(
          (item) => (
            <div
              className="bet-slip-item"
              key={`${item.matchId}-${item.market}`}
            >
              <div>
                <strong>
                  {item.homeTeam}
                  {" vs "}
                  {item.awayTeam}
                </strong>

                <span>
                  {item.market} ·{" "}
                  {item.selection}
                </span>
              </div>

              <div>
                <strong>
                  {Number(
                    item.odd
                  ).toFixed(2)}
                </strong>

                <button
                  type="button"
                  onClick={() =>
                    onRemove(
                      item.matchId,
                      item.market
                    )
                  }
                >
                  ×
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <label>
        Stake
      </label>

      <input
        className="field"
        type="number"
        min="1"
        step="0.01"
        placeholder="Enter stake"
        value={stake}
        onChange={(e) =>
          setStake(e.target.value)
        }
      />

      <div className="bet-slip-summary">
        <span>
          Potential win
        </span>

        <strong>
          {money(potentialWin)}
        </strong>
      </div>

      <button
        className="btn btn-primary big-btn"
        disabled={busy}
        onClick={onPlace}
      >
        {busy
          ? "Placing..."
          : "Place Bet"}
      </button>
    </div>
  );
}

function AdminDashboard({
  onRefresh,
}) {
  const [users, setUsers] =
    useState([]);

  const [adminBets, setAdminBets] =
    useState([]);

  const [
    adminTransactions,
    setAdminTransactions,
  ] = useState([]);

  const [
    manualWithdrawals,
    setManualWithdrawals,
  ] = useState([]);

  const [userId, setUserId] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [settleBetId, setSettleBetId] =
    useState("");

  const [result, setResult] =
    useState("won");

  const [
    withdrawalNote,
    setWithdrawalNote,
  ] = useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [msg, setMsg] =
    useState("");

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setError("");

    try {
      const [
        usersResult,
        betsResult,
        transactionsResult,
        withdrawalsResult,
      ] = await Promise.all([
        supabase.rpc(
          "admin_get_users"
        ),
        supabase.rpc(
          "admin_get_bets"
        ),
        supabase.rpc(
          "admin_get_transactions"
        ),
        supabase.rpc(
          "admin_get_manual_withdrawals"
        ),
      ]);

      if (usersResult.error)
        throw usersResult.error;

      if (betsResult.error)
        throw betsResult.error;

      if (
        transactionsResult.error
      )
        throw transactionsResult.error;

      if (
        withdrawalsResult.error
      )
        throw withdrawalsResult.error;

      setUsers(
        usersResult.data || []
      );

      setAdminBets(
        betsResult.data || []
      );

      setAdminTransactions(
        transactionsResult.data ||
          []
      );

      setManualWithdrawals(
        withdrawalsResult.data ||
          []
      );
    } catch (e) {
      console.error(e);

      setError(
        e.message ||
          "Unable to load admin data."
      );
    }
  }

  async function adjustWallet(
    direction
  ) {
    const value = Number(amount);

    if (!userId) {
      setError(
        "Select a user first."
      );
      return;
    }

    if (!value || value <= 0) {
      setError(
        "Enter a valid amount."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const {
        error: e,
      } = await supabase.rpc(
        direction === "credit"
          ? "admin_credit_wallet"
          : "admin_debit_wallet",
        {
          p_user_id: userId,
          p_amount: value,
          p_description: `Admin ${direction}`,
        }
      );

      if (e) throw e;

      setAmount("");

      setMsg(
        `Wallet ${direction} successful.`
      );

      await loadAdmin();
      await onRefresh();
    } catch (e) {
      setError(
        e.message ||
          "Wallet adjustment failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    if (!settleBetId) {
      setError(
        "Enter the bet ID."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const {
        error: e,
      } = await supabase.rpc(
        "admin_settle_bet",
        {
          p_bet_id:
            settleBetId,
          p_result: result,
        }
      );

      if (e) throw e;

      setSettleBetId("");

      setMsg(
        "Bet settlement completed."
      );

      await loadAdmin();
      await onRefresh();
    } catch (e) {
      setError(
        e.message ||
          "Settlement failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function processManualWithdrawal(
    id,
    action
  ) {
    setBusy(true);
    setError("");

    try {
      const {
        error: e,
      } = await supabase.rpc(
        "admin_mark_manual_withdrawal",
        {
          p_request_id: id,
          p_action: action,
          p_note:
            withdrawalNote.trim() ||
            null,
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
      setError(
        e.message ||
          "Withdrawal update failed."
      );
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

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {msg && (
        <div className="alert success">
          {msg}
        </div>
      )}

      <div className="admin-stats">
        <div className="admin-stat blue-stat">
          <span>
            USERS
          </span>

          <strong>
            {users.length}
          </strong>
        </div>

        <div className="admin-stat green-stat">
          <span>
            BETS
          </span>

          <strong>
            {adminBets.length}
          </strong>
        </div>

        <div className="admin-stat orange-stat">
          <span>
            TRANSACTIONS
          </span>

          <strong>
            {adminTransactions.length}
          </strong>
        </div>

        <div className="admin-stat purple-stat">
          <span>
            WITHDRAWALS
          </span>

          <strong>
            {
              manualWithdrawals.filter(
                (w) =>
                  w.status ===
                  "pending"
              ).length
            }
          </strong>
        </div>
      </div>

      <div className="admin-grid">
        <div className="form-card">
          <span className="eyebrow">
            WALLET MANAGEMENT
          </span>

          <h3>
            Adjust user wallet
          </h3>

          <p>
            Credit or debit a selected
            user's wallet.
          </p>

          <select
            className="field"
            value={userId}
            onChange={(e) =>
              setUserId(
                e.target.value
              )
            }
          >
            <option value="">
              Select user
            </option>

            {users.map((u) => (
              <option
                key={u.id}
                value={u.id}
              >
                {u.full_name ||
                  u.email ||
                  u.id}
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
            onChange={(e) =>
              setAmount(
                e.target.value
              )
            }
          />

          <div className="admin-button-row">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                adjustWallet(
                  "credit"
                )
              }
            >
              Credit wallet
            </button>

            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() =>
                adjustWallet(
                  "debit"
                )
              }
            >
              Debit wallet
            </button>
          </div>
        </div>

        <div className="form-card">
          <span className="eyebrow">
            BET MANAGEMENT
          </span>

          <h3>
            Settle a bet
          </h3>

          <p>
            Use the bet UUID and choose
            the result.
          </p>

          <input
            className="field"
            placeholder="Bet UUID"
            value={settleBetId}
            onChange={(e) =>
              setSettleBetId(
                e.target.value
              )
            }
          />

          <select
            className="field"
            value={result}
            onChange={(e) =>
              setResult(
                e.target.value
              )
            }
          >
            <option value="won">
              Won
            </option>

            <option value="lost">
              Lost
            </option>

            <option value="void">
              Void
            </option>
          </select>

          <button
            className="btn btn-primary big-btn"
            disabled={busy}
            onClick={settle}
          >
            Settle bet
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">
              MANUAL PAYOUTS
            </span>

            <h3>
              Withdrawal Requests
            </h3>
          </div>

          <span className="count-badge">
            {
              manualWithdrawals.filter(
                (w) =>
                  w.status ===
                  "pending"
              ).length
            }{" "}
            pending
          </span>
        </div>

        <input
          className="field"
          placeholder="Optional admin note"
          value={withdrawalNote}
          onChange={(e) =>
            setWithdrawalNote(
              e.target.value
            )
          }
        />

        {manualWithdrawals.length ===
        0 ? (
          <div className="admin-empty">
            No withdrawal requests.
          </div>
        ) : (
          <div className="admin-list">
            {manualWithdrawals.map(
              (w) => (
                <div
                  className="admin-withdrawal"
                  key={w.id}
                >
                  <div className="admin-withdrawal-main">
                    <div className="amount-big">
                      {money(
                        w.amount
                      )}
                    </div>

                    <strong>
                      {w.user_name ||
                        w.user_email ||
                        w.user_id}
                    </strong>

                    <span>
                      {w.provider} •{" "}
                      {
                        w.account_name
                      }{" "}
                      • {w.phone}
                    </span>

                    <small>
                      {fmtDate(
                        w.created_at
                      )}
                    </small>

                    {w.admin_note && (
                      <small>
                        Note:{" "}
                        {w.admin_note}
                      </small>
                    )}
                  </div>

                  <div className="admin-withdrawal-actions">
                    <span
                      className={`status-pill status-${String(
                        w.status ||
                          "pending"
                      ).toLowerCase()}`}
                    >
                      {String(
                        w.status ||
                          "pending"
                      ).toUpperCase()}
                    </span>

                    {w.status ===
                      "pending" && (
                      <>
                        <button
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() =>
                            processManualWithdrawal(
                              w.id,
                              "paid"
                            )
                          }
                        >
                          Mark Paid
                        </button>

                        <button
                          className="btn btn-outline"
                          disabled={busy}
                          onClick={() =>
                            processManualWithdrawal(
                              w.id,
                              "rejected"
                            )
                          }
                        >
                          Reject &
                          Refund
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">
              USERS
            </span>

            <h3>
              Registered Users
            </h3>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="admin-empty">
            No users returned.
          </div>
        ) : (
          <div className="admin-table">
            {users.map((u) => (
              <div
                className="admin-table-row"
                key={u.id}
              >
                <div>
                  <strong>
                    {u.full_name ||
                      "Unnamed user"}
                  </strong>

                  <span>
                    {u.email ||
                      "No email"}
                  </span>
                </div>

                <span className="role-pill">
                  {u.role ||
                    "user"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">
              BET ACTIVITY
            </span>

            <h3>
              Recent Bets
            </h3>
          </div>
        </div>

        {adminBets.length === 0 ? (
          <div className="admin-empty">
            No bets returned.
          </div>
        ) : (
          <div className="admin-table">
            {adminBets
              .slice(0, 20)
              .map((b) => (
                <div
                  className="admin-table-row"
                  key={b.id}
                >
                  <div>
                    <strong>
                      #
                      {String(
                        b.id
                      ).slice(
                        0,
                        8
                      )}
                    </strong>

                    <span>
                      User:{" "}
                      {String(
                        b.user_id
                      ).slice(
                        0,
                        8
                      )}
                    </span>
                  </div>

                  <div className="admin-bet-right">
                    <span>
                      {String(
                        b.status ||
                          "pending"
                      ).toUpperCase()}
                    </span>

                    <strong>
                      {money(
                        b.stake
                      )}
                    </strong>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">
              WALLET ACTIVITY
            </span>

            <h3>
              Recent Transactions
            </h3>
          </div>
        </div>

        {adminTransactions.length ===
        0 ? (
          <div className="admin-empty">
            No transactions returned.
          </div>
        ) : (
          <div className="admin-table">
            {adminTransactions
              .slice(0, 20)
              .map((t) => (
                <div
                  className="admin-table-row"
                  key={t.id}
                >
                  <div>
                    <strong>
                      {t.type ||
                        "Transaction"}
                    </strong>

                    <span>
                      {t.description ||
                        ""}
                    </span>
                  </div>

                  <div className="admin-bet-right">
                    <strong>
                      {money(
                        t.amount
                      )}
                    </strong>

                    <span>
                      {fmtDate(
                        t.created_at
                      )}
                    </span>
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