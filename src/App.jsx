import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const money = (n) =>
  `GHS ${Number(n || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;


const virtualGames = [
  { name: "Virtual Football", icon: "⚽", desc: "Fast football fixtures and match-style virtual action." },
  { name: "Virtual Horse Racing", icon: "🏇", desc: "Quick virtual horse races with multiple runners." },
  { name: "Virtual Basketball", icon: "🏀", desc: "High-tempo virtual basketball matchups." },
  { name: "Virtual Tennis", icon: "🎾", desc: "Rapid virtual tennis matches and sets." },
  { name: "Virtual Greyhounds", icon: "🐕", desc: "Short virtual greyhound races." },
  { name: "Virtual Racing", icon: "🏎️", desc: "Fast virtual motor racing events." },
  { name: "Virtual League", icon: "🏆", desc: "League-style virtual football rounds." },
  { name: "Virtual Penalty", icon: "🥅", desc: "Penalty shootout-style virtual action." },
  { name: "Virtual Speedway", icon: "🏁", desc: "Quick speedway-style virtual races." },
  { name: "Retro Bowl", icon: "🎮", desc: "Classic arcade-inspired virtual football experience." },
];
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

  const [authMode, setAuthMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("Mobile Money");
  const [depositReference, setDepositReference] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("Mobile Money");
  const [withdrawDestination, setWithdrawDestination] = useState("");

  const isAdmin = profile?.role === "admin" && profile?.is_active !== false;

  const combinedOdds = useMemo(
    () =>
      betSlip.reduce((total, item) => total * Number(item.odd || 1), 1),
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
    const { data: matchRows, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    if (matchError) {
      // Some schemas use status rather than is_active. Fall back safely.
      const fallback = await supabase
        .from("matches")
        .select("*")
        .order("start_time", { ascending: true });

      if (fallback.error) throw matchError;
      setMatches(await attachOdds(fallback.data || []));
      return;
    }

    setMatches(await attachOdds(matchRows || []));
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

    return rows.map((m) => ({ ...m, match_odds: map[m.id] || [] }));
  }

  async function loadUserData() {
    const [betsResult, txResult] = await Promise.all([
      supabase
        .from("bets")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (betsResult.error) throw betsResult.error;
    if (txResult.error) throw txResult.error;

    setBets(betsResult.data || []);
    setTransactions(txResult.data || []);
  }

  function flash(text) {
    setMessage(text);
    setTimeout(() => setMessage(""), 3500);
  }

  function clearError() {
    setError("");
  }

  async function handleAuth(e) {
    e.preventDefault();
    setBusy(true);
    clearError();
    setMessage("");

    try {
      if (authMode === "signup") {
        if (!name.trim()) throw new Error("Enter your full name.");
        const { data, error: e1 } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
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

  function addToSlip(match, odd) {
    const selectionKey = odd.selection;
    const item = {
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      startTime: match.start_time,
      market: odd.market,
      selectionKey,
      selection: odd.selection,
      odd: Number(odd.odd),
    };

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

      const { data, error: e } = await supabase.rpc("place_bet", {
        p_stake: amount,
        p_selections: selections,
      });

      if (e) throw e;

      setStake("");
      setBetSlip([]);
      await Promise.all([loadWallet(), loadUserData()]);
      flash("Bet placed successfully.");
      console.log("place_bet result:", data);
    } catch (e) {
      setError(
        e.message ||
          "Bet could not be placed. Make sure the secure place_bet function exists."
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestDeposit(e) {
    e.preventDefault();
    clearError();

    const amount = Number(depositAmount);
    if (!amount || amount <= 0) return setError("Enter a valid deposit amount.");
    if (!depositReference.trim())
      return setError("Enter the payment/reference number.");

    setBusy(true);
    try {
      const { error: e1 } = await supabase.rpc("request_deposit", {
        p_amount: amount,
        p_payment_method: depositMethod,
        p_payment_reference: depositReference.trim(),
      });
      if (e1) throw e1;

      setDepositAmount("");
      setDepositReference("");
      await loadUserData();
      flash("Deposit request submitted. Your balance changes after verification.");
    } catch (e1) {
      setError(e1.message || "Deposit request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function requestWithdrawal(e) {
    e.preventDefault();
    clearError();

    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0)
      return setError("Enter a valid withdrawal amount.");
    if (!withdrawDestination.trim())
      return setError("Enter your payment destination.");

    setBusy(true);
    try {
      const { error: e1 } = await supabase.rpc("request_withdrawal", {
        p_amount: amount,
        p_payment_method: withdrawMethod,
        p_destination: withdrawDestination.trim(),
      });
      if (e1) throw e1;

      setWithdrawAmount("");
      setWithdrawDestination("");
      await Promise.all([loadWallet(), loadUserData()]);
      flash("Withdrawal request submitted.");
    } catch (e1) {
      setError(e1.message || "Withdrawal request failed.");
    } finally {
      setBusy(false);
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

  const virtualGames = [
    { icon: "⚽", title: "Virtual Football", tag: "FOOTBALL", text: "Fast virtual football fixtures with instant results." },
    { icon: "🏇", title: "Virtual Horse Racing", tag: "RACING", text: "Pick your horse and follow the virtual race." },
    { icon: "🏀", title: "Virtual Basketball", tag: "BASKETBALL", text: "Quick basketball matchups and virtual action." },
    { icon: "🎾", title: "Virtual Tennis", tag: "TENNIS", text: "Serve, rally and choose your virtual winner." },
    { icon: "🐕", title: "Virtual Greyhounds", tag: "RACING", text: "High-speed virtual greyhound races." },
    { icon: "🏎️", title: "Virtual Racing", tag: "MOTOR", text: "Virtual motorsport with rapid race cycles." },
    { icon: "🏆", title: "Virtual League", tag: "LEAGUE", text: "Compete through a full virtual league." },
    { icon: "🥅", title: "Virtual Penalty", tag: "SKILL", text: "Choose your side in a virtual penalty battle." },
    { icon: "🏁", title: "Virtual Speedway", tag: "SPEED", text: "Fast virtual speedway races." },
    { icon: "🎮", title: "Retro Bowl", tag: "ARCADE", text: "Classic-style virtual football entertainment." },
  ];

  const navItems = [
    ["home", "⌂", "Home"],
    ["home", "⚽", "Matches"],
    ["virtuals", "🎮", "Virtuals"],
    ["bets", "🎟️", "My Bets"],
    ["wallet", "💰", "Wallet"],
    ["transactions", "↔", "Transactions"],
    ...(isAdmin ? [["admin", "👑", "Admin"]] : []),
  ];

  if (!session) {
    return (
      <div className="csh-app auth-page">
        <div className="auth-background-shape shape-one" />
        <div className="auth-background-shape shape-two" />
        <header className="topbar auth-topbar">
          <div className="brand-wrap">
            <div className="brand-mark">CS</div>
            <div><div className="brand-name">CLASSIC SPORTY HACKS</div><div className="brand-sub">Football • Sports • Match Centre</div></div>
          </div>
          <div className="secure-pill">🔒 Secure account access</div>
        </header>
        <main className="auth-shell">
          <section className="auth-showcase">
            <span className="eyebrow">YOUR FOOTBALL HOME</span>
            <h1>Play smarter.<br /><span>Follow the action.</span></h1>
            <p>Access matches, odds, your bet slip, wallet and virtual games from one clean dashboard.</p>
            <div className="showcase-stats">
              <div><b>⚽</b><strong>Live Matches</strong><small>Odds & markets</small></div>
              <div><b>🎮</b><strong>10 Virtuals</strong><small>Quick-play zone</small></div>
              <div><b>💰</b><strong>Wallet</strong><small>Track your funds</small></div>
            </div>
          </section>
          <section className="auth-card">
            <div className="auth-card-head"><div className="auth-logo">CS</div><span>Welcome to CSH</span></div>
            <h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>{authMode === "login" ? "Log in to continue to your dashboard." : "Sign up and start exploring Classic Sporty Hacks."}</p>
            <div className="auth-tabs"><button className={authMode === "login" ? "active" : ""} onClick={() => { clearError(); setAuthMode("login"); }}>Login</button><button className={authMode === "signup" ? "active" : ""} onClick={() => { clearError(); setAuthMode("signup"); }}>Sign Up</button></div>
            {error && <div className="alert error-alert">{error}</div>}
            {message && <div className="alert success-alert">{message}</div>}
            <form onSubmit={handleAuth} className="auth-form">
              {authMode === "signup" && <label>Full name<input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" /></label>}
              <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
              <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /></label>
              <button className="main-btn auth-submit" disabled={busy}>{busy ? "Please wait..." : authMode === "login" ? "Login to dashboard →" : "Create account →"}</button>
            </form>
            <div className="auth-note">By continuing, you agree to use the platform responsibly.</div>
          </section>
        </main>
      </div>
    );
  }

  if (loading) return <div className="loading-screen"><div className="loading-orb">CS</div><h2>Loading Classic Sporty Hacks</h2><p>Preparing your dashboard...</p></div>;

  return (
    <div className="csh-app">
      <header className="topbar">
        <div className="brand-wrap" onClick={() => setPage("home")} role="button" tabIndex={0}>
          <div className="brand-mark">CS</div>
          <div><div className="brand-name">CLASSIC SPORTY HACKS</div><div className="brand-sub">Football Match Centre</div></div>
        </div>
        <div className="top-actions">
          <button className="balance-chip" onClick={() => setPage("wallet")}><span>Wallet balance</span><b>{money(wallet?.balance)}</b></button>
          <button className="deposit-top" onClick={() => setPage("wallet")}>＋ Deposit</button>
          <button className="avatar-btn" title={profile?.full_name || session.user.email}>{(profile?.full_name || session.user.email || "U").charAt(0).toUpperCase()}</button>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </header>

      <nav className="main-nav">
        <div className="nav-inner">
          {navItems.map(([key, icon, label], i) => <button key={`${key}-${i}`} className={`nav-item ${page === key ? "active" : ""}`} onClick={() => setPage(key)}><span>{icon}</span>{label}</button>)}
        </div>
      </nav>

      <main className="dashboard-shell">
        {message && <div className="alert success-alert floating-alert">✓ {message}</div>}
        {error && <div className="alert error-alert floating-alert">! {error}</div>}

        {page === "home" && (
          <>
            <section className="dashboard-hero">
              <div className="hero-copy"><span className="eyebrow">TODAY'S FOOTBALL</span><h1>Pick your match.<br /><span>Build your bet.</span></h1><p>Browse today's fixtures, compare markets and add your selections to the bet slip.</p><div className="hero-actions"><button className="main-btn" onClick={() => document.getElementById("matches-section")?.scrollIntoView({ behavior: "smooth" })}>Explore matches →</button><button className="ghost-btn" onClick={() => setPage("virtuals")}>🎮 Virtual Games</button></div></div>
              <div className="hero-ball">⚽<div className="hero-ring" /></div>
              <div className="hero-balance"><small>AVAILABLE BALANCE</small><strong>{money(wallet?.balance)}</strong><button onClick={() => setPage("wallet")}>Manage wallet</button></div>
            </section>

            <section className="quick-grid">
              <button onClick={() => setPage("wallet")}><span className="quick-icon green">💰</span><div><b>Deposit Funds</b><small>Add money to your wallet</small></div><span>›</span></button>
              <button onClick={() => setPage("bets")}><span className="quick-icon purple">🎟️</span><div><b>My Bets</b><small>{bets.length} recorded bet{bets.length === 1 ? "" : "s"}</small></div><span>›</span></button>
              <button onClick={() => setPage("virtuals")}><span className="quick-icon orange">🎮</span><div><b>Virtual Games</b><small>10 games available</small></div><span>›</span></button>
              <button onClick={() => setPage("transactions")}><span className="quick-icon blue">↔</span><div><b>Transactions</b><small>View wallet activity</small></div><span>›</span></button>
            </section>

            <div className="content-heading" id="matches-section"><div><span className="eyebrow">MATCH CENTRE</span><h2>Today's matches</h2></div><button className="outline-btn">All markets</button></div>
            <div className="main-columns">
              <section className="matches-column">
                <div className="match-filter"><span className="filter-active">🔥 Popular</span><span>⚽ Football</span><span>🏆 Top leagues</span><span>⭐ Featured</span></div>
                {matches.length === 0 ? <div className="empty-card"><div>⚽</div><h3>No active matches yet</h3><p>Matches will appear here when they are available in your database.</p></div> : matches.map(match => {
                  const groups = marketGroups(match.match_odds);
                  return <article className="match-card" key={match.id}>
                    <div className="match-card-top"><span className="league-pill">⚽ Football</span><span>{fmtDate(match.start_time)}</span><span className="status-dot">● {match.status || "Scheduled"}</span></div>
                    <div className="match-teams"><div className="team"><div className="team-badge">{(match.home_team || "H").charAt(0)}</div><strong>{match.home_team}</strong></div><div className="versus"><small>START</small><b>VS</b><small>{new Date(match.start_time).toLocaleTimeString("en-GH", {hour:"2-digit", minute:"2-digit"})}</small></div><div className="team"><div className="team-badge away">{(match.away_team || "A").charAt(0)}</div><strong>{match.away_team}</strong></div></div>
                    <div className="market-area">{Object.keys(groups).length === 0 ? <div className="no-odds">Odds not available for this match.</div> : Object.entries(groups).map(([market, odds]) => <div className="market-block" key={market}><div className="market-heading"><b>{market}</b><span>Tap an odd to add</span></div><div className="odds-row">{odds.map(odd => <button className="odd-card" key={odd.id} onClick={() => addToSlip(match, odd)}><span>{odd.selection}</span><strong>{Number(odd.odd).toFixed(2)}</strong></button>)}</div></div>)}</div>
                  </article>;
                })}
              </section>
              <aside className="bet-slip">
                <div className="slip-head"><div><span className="eyebrow">YOUR SELECTIONS</span><h3>Bet Slip</h3></div><span className="slip-count">{betSlip.length}</span></div>
                {betSlip.length === 0 ? <div className="slip-empty"><div>🎟️</div><h4>Your slip is empty</h4><p>Select an odd from any match and it will appear here.</p><button className="outline-btn" onClick={() => document.getElementById("matches-section")?.scrollIntoView({behavior:"smooth"})}>Find a match</button></div> : <><div className="slip-list">{betSlip.map(item => <div className="slip-selection" key={`${item.matchId}-${item.market}`}><div><b>{item.homeTeam} <span>vs</span> {item.awayTeam}</b><small>{item.market} • {item.selection}</small><strong>Odds {item.odd.toFixed(2)}</strong></div><button onClick={() => removeFromSlip(item.matchId, item.market)}>×</button></div>)}</div><div className="slip-total"><span>Combined odds</span><b>{combinedOdds.toFixed(2)}</b></div><label className="stake-label">Stake amount<input type="number" min="0" step="0.01" value={stake} onChange={e => setStake(e.target.value)} placeholder="Enter stake (GHS)" /></label><div className="win-box"><span>Potential return</span><strong>{money(potentialWin)}</strong></div><button className="main-btn place-btn" onClick={placeBet} disabled={busy}>{busy ? "Processing..." : "Place Bet →"}</button></>}
              </aside>
            </div>
          </>
        )}

        {page === "virtuals" && <section className="virtual-page"><div className="virtual-hero"><div><span className="eyebrow">VIRTUAL ZONE</span><h1>10 ways to play. <span>One place.</span></h1><p>Explore our virtual-game collection with quick, colorful game cards.</p></div><div className="virtual-orbit">🎮</div></div><div className="section-title"><div><span className="eyebrow">GAME LOUNGE</span><h2>Virtual Games</h2></div><span className="game-count">10 GAMES</span></div><div className="virtual-grid">{virtualGames.map((game, i) => <article className="virtual-card" key={game.title}><div className={`virtual-icon v-${i % 5}`}>{game.icon}</div><span className="game-tag">{game.tag}</span><h3>{game.title}</h3><p>{game.text}</p><button onClick={() => flash(`${game.title} is a game interface placeholder. Connect a real virtual-games provider/API before taking real play.`)}>Play Now <span>→</span></button></article>)}</div><div className="provider-note"><span>ℹ️</span><div><b>Virtual games provider</b><p>These are interface cards only. A real virtual-games provider/API must be connected before these games can process real play.</p></div></div></section>}

        {page === "bets" && <section className="page-section"><div className="section-title"><div><span className="eyebrow">ACCOUNT</span><h2>My Bets</h2></div><span className="count-badge">{bets.length}</span></div>{bets.length === 0 ? <div className="empty-card"><div>🎟️</div><h3>No bets yet</h3><p>Your placed bets will appear here.</p></div> : <div className="data-list">{bets.map(bet => <article className="data-card" key={bet.id}><div className="data-head"><div><span className="mini-label">BET #{String(bet.id).slice(0,8)}</span><h3>{money(bet.stake)} stake</h3></div><span className={`status-badge ${String(bet.status || "pending").toLowerCase()}`}>{bet.status || "pending"}</span></div><div className="stat-grid"><div><small>Combined odds</small><b>{Number(bet.combined_odds || 0).toFixed(2)}</b></div><div><small>Potential win</small><b>{money(bet.potential_win)}</b></div><div><small>Placed</small><b>{fmtDate(bet.created_at)}</b></div></div></article>)}</div>}</section>}

        {page === "wallet" && <section className="page-section"><div className="wallet-banner"><div><span className="eyebrow">YOUR WALLET</span><p>Available balance</p><h1>{money(wallet?.balance)}</h1><small>{wallet?.currency || "GHS"} wallet</small></div><div className="wallet-symbol">💰</div></div><div className="section-title"><div><span className="eyebrow">MONEY MANAGEMENT</span><h2>Deposit & Withdraw</h2></div></div><div className="form-grid"><form className="form-card deposit-card" onSubmit={requestDeposit}><div className="form-icon">＋</div><h3>Deposit funds</h3><p>Submit your payment details. Your balance changes after verification.</p><label>Amount (GHS)<input type="number" min="0" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" /></label><label>Payment method<select value={depositMethod} onChange={e => setDepositMethod(e.target.value)}><option>Mobile Money</option><option>Bank Transfer</option></select></label><label>Payment/reference number<input value={depositReference} onChange={e => setDepositReference(e.target.value)} placeholder="Reference number" /></label><button className="main-btn" disabled={busy}>Submit deposit →</button></form><form className="form-card withdraw-card" onSubmit={requestWithdrawal}><div className="form-icon">↗</div><h3>Withdraw funds</h3><p>Request a withdrawal to an account or mobile-money destination you control.</p><label>Amount (GHS)<input type="number" min="0" step="0.01" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00" /></label><label>Payment method<select value={withdrawMethod} onChange={e => setWithdrawMethod(e.target.value)}><option>Mobile Money</option><option>Bank Transfer</option></select></label><label>Destination/account<input value={withdrawDestination} onChange={e => setWithdrawDestination(e.target.value)} placeholder="Mobile money or account" /></label><button className="main-btn" disabled={busy}>Request withdrawal →</button></form></div></section>}

        {page === "transactions" && <section className="page-section"><div className="section-title"><div><span className="eyebrow">WALLET HISTORY</span><h2>Transactions</h2></div><span className="count-badge">{transactions.length}</span></div>{transactions.length === 0 ? <div className="empty-card"><div>↔</div><h3>No transactions yet</h3><p>Your wallet activity will appear here.</p></div> : <div className="transaction-list">{transactions.map(tx => <article className="transaction-card" key={tx.id}><div className={`transaction-icon ${String(tx.type || "").toLowerCase().includes("deposit") ? "positive" : "neutral"}`}>{String(tx.type || "").toLowerCase().includes("deposit") ? "＋" : "↔"}</div><div className="transaction-info"><b>{tx.type || "Transaction"}</b><span>{tx.description || "Wallet transaction"}</span><small>{fmtDate(tx.created_at)}</small></div><strong>{money(tx.amount)}</strong></article>)}</div>}</section>}

        {page === "admin" && isAdmin && <AdminPanel onRefresh={loadAll} />}
      </main>
      <footer className="site-footer"><b>CLASSIC SPORTY HACKS</b><span>Football match centre • Use responsibly</span></footer>
    </div>
  );
}

function AdminPanel({ onRefresh }) {
  const [users, setUsers] = useState([]);
  const [adminBets, setAdminBets] = useState([]);
  const [adminTransactions, setAdminTransactions] = useState([]);
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

    const [u, b, t] = await Promise.all([
      supabase.rpc("admin_get_users"),
      supabase.rpc("admin_get_bets"),
      supabase.rpc("admin_get_transactions"),
    ]);

    if (u.error || b.error || t.error) {
      setError(
        (u.error || b.error || t.error)?.message ||
          "Admin data could not be loaded."
      );
      return;
    }

    setUsers(u.data || []);
    setAdminBets(b.data || []);
    setAdminTransactions(t.data || []);
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

  return (
    <section className="page-section admin-page">
      <div className="admin-hero"><div><span className="eyebrow">CONTROL CENTRE</span><h1>Admin Dashboard</h1><p>Manage users, wallets, bets and transactions from one place.</p></div><button className="outline-btn light" onClick={loadAdmin}>↻ Refresh</button></div>
      {error && <div className="alert error-alert">{error}</div>}{msg && <div className="alert success-alert">✓ {msg}</div>}
      <div className="admin-stat-grid"><div><span>👥</span><b>{users.length}</b><small>Users</small></div><div><span>🎟️</span><b>{adminBets.length}</b><small>Bets</small></div><div><span>💳</span><b>{adminTransactions.length}</b><small>Transactions</small></div><div><span>⚡</span><b>Live</b><small>Platform status</small></div></div>
      <div className="form-grid admin-tools">
        <div className="form-card"><div className="form-icon">💰</div><h3>Wallet adjustment</h3><p>Credit or debit a selected user's wallet.</p><select value={userId} onChange={e => setUserId(e.target.value)}><option value="">Select user</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>)}</select><input type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} /><div className="two-buttons"><button className="main-btn" disabled={busy} onClick={() => adjustWallet("credit")}>Credit</button><button className="outline-btn" disabled={busy} onClick={() => adjustWallet("debit")}>Debit</button></div></div>
        <div className="form-card"><div className="form-icon">🎯</div><h3>Settle bet</h3><p>Update the result of a bet using its UUID.</p><input placeholder="Bet UUID" value={settleBetId} onChange={e => setSettleBetId(e.target.value)} /><select value={result} onChange={e => setResult(e.target.value)}><option value="won">Won</option><option value="lost">Lost</option><option value="void">Void</option></select><button className="main-btn" disabled={busy} onClick={settle}>Settle bet →</button></div>
      </div>
      <div className="admin-tables"><div className="table-card"><div className="table-head"><h3>Users</h3><span>{users.length} total</span></div>{users.length === 0 ? <p className="muted">No users returned.</p> : users.map(u => <div className="table-row" key={u.id}><div className="user-row"><span className="user-avatar">{(u.full_name || u.email || "U").charAt(0).toUpperCase()}</span><div><b>{u.full_name || "Unnamed"}</b><small>{u.email}</small></div></div><span className="role-badge">{u.role}</span></div>)}</div><div className="table-card"><div className="table-head"><h3>Recent bets</h3><span>Latest 20</span></div>{adminBets.slice(0,20).map(b => <div className="table-row" key={b.id}><span>#{String(b.id).slice(0,8)}</span><span className={`status-badge ${String(b.status || "").toLowerCase()}`}>{b.status}</span><b>{money(b.stake)}</b></div>)}</div><div className="table-card"><div className="table-head"><h3>Recent transactions</h3><span>Latest 20</span></div>{adminTransactions.slice(0,20).map(t => <div className="table-row" key={t.id}><span>{t.type}</span><b>{money(t.amount)}</b><small>{fmtDate(t.created_at)}</small></div>)}</div></div>
    </section>
  );
}
