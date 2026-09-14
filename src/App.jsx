import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

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

  if (!session) {
    return (
      <div style={styles.page}>
        <header style={styles.header}>
          <div style={styles.brand}>CLASSIC SPORTY HACKS</div>
          <div style={styles.headerSmall}>Football Tips & Match Centre</div>
        </header>

        <main style={styles.authWrap}>
          <div style={styles.authCard}>
            <div style={styles.logoCircle}>CS</div>
            <h1>{authMode === "login" ? "Welcome back" : "Create account"}</h1>
            <p style={styles.muted}>
              {authMode === "login"
                ? "Log in to access your wallet and bets."
                : "Create your account to start using the platform."}
            </p>

            {error && <div style={styles.error}>{error}</div>}
            {message && <div style={styles.success}>{message}</div>}

            <form onSubmit={handleAuth}>
              {authMode === "signup" && (
                <input
                  style={styles.input}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <input
                style={styles.input}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                style={styles.input}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button style={styles.primary} disabled={busy}>
                {busy
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Login"
                  : "Sign Up"}
              </button>
            </form>

            <button
              style={styles.linkButton}
              onClick={() => {
                clearError();
                setAuthMode(authMode === "login" ? "signup" : "login");
              }}
            >
              {authMode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Login"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return <div style={styles.loading}>Loading your account...</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>CLASSIC SPORTY HACKS</div>
          <div style={styles.headerSmall}>
            {profile?.full_name || session.user.email}
          </div>
        </div>
        <button style={styles.logout} onClick={logout}>
          Logout
        </button>
      </header>

      <nav style={styles.nav}>
        {[
          ["home", "Matches"],
          ["virtuals", "Virtual Games"],
          ["bets", "My Bets"],
          ["wallet", "Wallet"],
          ["transactions", "Transactions"],
          ...(isAdmin ? [["admin", "Admin"]] : []),
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPage(key)}
            style={page === key ? styles.navActive : styles.navBtn}
          >
            {label}
          </button>
        ))}
      </nav>

      <main style={styles.container}>
        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        {page === "home" && (
          <>
            <section style={styles.hero}>
              <div>
                <h1>Football Matches</h1>
                <p>Choose your selections and add them to your bet slip.</p>
              </div>
              <div style={styles.balanceMini}>
                Balance
                <strong>{money(wallet?.balance)}</strong>
              </div>
            </section>

            <div style={styles.layout}>
              <section>
                {matches.length === 0 ? (
                  <div style={styles.card}>No active matches available yet.</div>
                ) : (
                  matches.map((match) => {
                    const groups = marketGroups(match.match_odds);
                    return (
                      <div style={styles.matchCard} key={match.id}>
                        <div style={styles.matchTop}>
                          <span>{fmtDate(match.start_time)}</span>
                          <span>{match.status || "Scheduled"}</span>
                        </div>

                        <div style={styles.teams}>
                          <strong>{match.home_team}</strong>
                          <span>vs</span>
                          <strong>{match.away_team}</strong>
                        </div>

                        {Object.keys(groups).length === 0 ? (
                          <div style={styles.noOdds}>Odds not available.</div>
                        ) : (
                          Object.entries(groups).map(([market, odds]) => (
                            <div key={market} style={styles.market}>
                              <div style={styles.marketTitle}>{market}</div>
                              <div style={styles.oddsGrid}>
                                {odds.map((odd) => (
                                  <button
                                    key={odd.id}
                                    style={styles.oddBtn}
                                    onClick={() => addToSlip(match, odd)}
                                  >
                                    <span>{odd.selection}</span>
                                    <b>{Number(odd.odd).toFixed(2)}</b>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })
                )}
              </section>

              <aside style={styles.slip}>
                <div style={styles.slipTitle}>
                  <strong>Bet Slip</strong>
                  <span>{betSlip.length}</span>
                </div>

                {betSlip.length === 0 ? (
                  <p style={styles.muted}>
                    Select an odd from the matches to add it here.
                  </p>
                ) : (
                  <>
                    {betSlip.map((item) => (
                      <div
                        key={`${item.matchId}-${item.market}`}
                        style={styles.slipItem}
                      >
                        <div>
                          <strong>
                            {item.homeTeam} vs {item.awayTeam}
                          </strong>
                          <div style={styles.small}>
                            {item.market} · {item.selection} ·{" "}
                            {item.odd.toFixed(2)}
                          </div>
                        </div>
                        <button
                          style={styles.remove}
                          onClick={() =>
                            removeFromSlip(item.matchId, item.market)
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <div style={styles.summary}>
                      <span>Combined odds</span>
                      <strong>{combinedOdds.toFixed(2)}</strong>
                    </div>

                    <div style={styles.summary}>
                      <span>Potential win</span>
                      <strong>{money(potentialWin)}</strong>
                    </div>

                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Stake (GHS)"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                    />

                    <button
                      style={styles.primary}
                      onClick={placeBet}
                      disabled={busy}
                    >
                      {busy ? "Processing..." : "Place Bet"}
                    </button>
                  </>
                )}
              </aside>
            </div>
          </>
        )}

        {page === "virtuals" && (
          <section>
            <section style={styles.virtualHero}>
              <div>
                <div style={styles.virtualEyebrow}>VIRTUAL SPORTS</div>
                <h1 style={{ margin: "6px 0 8px" }}>10 Virtual Games</h1>
                <p style={{ margin: 0, opacity: 0.9 }}>
                  Choose a virtual game below. These cards restore your Virtual Games section in the interface.
                </p>
              </div>
              <div style={styles.virtualCount}>10</div>
            </section>

            <div style={styles.virtualGrid}>
              {virtualGames.map((game) => (
                <article key={game.name} style={styles.virtualCard}>
                  <div style={styles.virtualIcon}>{game.icon}</div>
                  <h3 style={{ margin: "4px 0 6px" }}>{game.name}</h3>
                  <p style={styles.muted}>{game.desc}</p>
                  <button
                    style={styles.virtualButton}
                    onClick={() =>
                      flash(`${game.name} opened. Connect your virtual-games provider here for real gameplay.`)
                    }
                  >
                    Play Now
                  </button>
                </article>
              ))}
            </div>

            <div style={styles.virtualNote}>
              <strong>Important:</strong> this restores the 10-game Virtual Games screen. Real playable virtual results still require the virtual-games provider/API that was not present in this saved App.jsx.
            </div>
          </section>
        )}

        {page === "bets" && (
          <section>
            <h2>My Bets</h2>
            {bets.length === 0 ? (
              <div style={styles.card}>You have no bets yet.</div>
            ) : (
              bets.map((bet) => (
                <div style={styles.card} key={bet.id}>
                  <div style={styles.row}>
                    <strong>Bet #{String(bet.id).slice(0, 8)}</strong>
                    <span style={styles.badge}>{bet.status || "pending"}</span>
                  </div>
                  <div style={styles.summary}>
                    <span>Stake</span>
                    <strong>{money(bet.stake)}</strong>
                  </div>
                  <div style={styles.summary}>
                    <span>Combined odds</span>
                    <strong>{Number(bet.combined_odds || 0).toFixed(2)}</strong>
                  </div>
                  <div style={styles.summary}>
                    <span>Potential win</span>
                    <strong>{money(bet.potential_win)}</strong>
                  </div>
                  <div style={styles.small}>{fmtDate(bet.created_at)}</div>
                </div>
              ))
            )}
          </section>
        )}

        {page === "wallet" && (
          <section>
            <div style={styles.walletHero}>
              <span>Available balance</span>
              <strong>{money(wallet?.balance)}</strong>
              <small>{wallet?.currency || "GHS"}</small>
            </div>

            <div style={styles.twoCol}>
              <form style={styles.card} onSubmit={requestDeposit}>
                <h3>Deposit request</h3>
                <p style={styles.muted}>
                  Submit your payment reference. The wallet is credited only
                  after payment verification.
                </p>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount (GHS)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <select
                  style={styles.input}
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                >
                  <option>Mobile Money</option>
                  <option>Bank Transfer</option>
                </select>
                <input
                  style={styles.input}
                  placeholder="Payment/reference number"
                  value={depositReference}
                  onChange={(e) => setDepositReference(e.target.value)}
                />
                <button style={styles.primary} disabled={busy}>
                  Submit deposit
                </button>
              </form>

              <form style={styles.card} onSubmit={requestWithdrawal}>
                <h3>Withdrawal request</h3>
                <p style={styles.muted}>
                  Use an account or mobile-money destination you are authorized
                  to receive funds at.
                </p>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount (GHS)"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <select
                  style={styles.input}
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                >
                  <option>Mobile Money</option>
                  <option>Bank Transfer</option>
                </select>
                <input
                  style={styles.input}
                  placeholder="Destination/account"
                  value={withdrawDestination}
                  onChange={(e) => setWithdrawDestination(e.target.value)}
                />
                <button style={styles.primary} disabled={busy}>
                  Submit withdrawal
                </button>
              </form>
            </div>
          </section>
        )}

        {page === "transactions" && (
          <section>
            <h2>Transactions</h2>
            {transactions.length === 0 ? (
              <div style={styles.card}>No transactions yet.</div>
            ) : (
              transactions.map((tx) => (
                <div style={styles.card} key={tx.id}>
                  <div style={styles.row}>
                    <strong>{tx.type || "Transaction"}</strong>
                    <strong>{money(tx.amount)}</strong>
                  </div>
                  <div style={styles.small}>
                    {tx.description || ""}
                  </div>
                  <div style={styles.small}>{fmtDate(tx.created_at)}</div>
                </div>
              ))
            )}
          </section>
        )}

        {page === "admin" && isAdmin && (
          <AdminPanel onRefresh={loadAll} />
        )}
      </main>
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
    <section>
      <h2>Admin Dashboard</h2>
      {error && <div style={styles.error}>{error}</div>}
      {msg && <div style={styles.success}>{msg}</div>}

      <div style={styles.twoCol}>
        <div style={styles.card}>
          <h3>Wallet adjustment</h3>
          <select
            style={styles.input}
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
            style={styles.input}
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div style={styles.buttonRow}>
            <button
              style={styles.primary}
              disabled={busy}
              onClick={() => adjustWallet("credit")}
            >
              Credit
            </button>
            <button
              style={styles.secondary}
              disabled={busy}
              onClick={() => adjustWallet("debit")}
            >
              Debit
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <h3>Settle bet</h3>
          <input
            style={styles.input}
            placeholder="Bet UUID"
            value={settleBetId}
            onChange={(e) => setSettleBetId(e.target.value)}
          />
          <select
            style={styles.input}
            value={result}
            onChange={(e) => setResult(e.target.value)}
          >
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="void">Void</option>
          </select>
          <button style={styles.primary} disabled={busy} onClick={settle}>
            Settle bet
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h3>Users</h3>
        {users.length === 0 ? (
          <p style={styles.muted}>No users returned.</p>
        ) : (
          users.map((u) => (
            <div style={styles.row} key={u.id}>
              <span>
                <strong>{u.full_name || "Unnamed"}</strong>
                <br />
                <span style={styles.small}>{u.email}</span>
              </span>
              <span>{u.role}</span>
            </div>
          ))
        )}
      </div>

      <div style={styles.card}>
        <h3>Recent bets</h3>
        {adminBets.slice(0, 20).map((b) => (
          <div style={styles.row} key={b.id}>
            <span>{String(b.id).slice(0, 8)}</span>
            <span>{b.status}</span>
            <span>{money(b.stake)}</span>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <h3>Recent transactions</h3>
        {adminTransactions.slice(0, 20).map((t) => (
          <div style={styles.row} key={t.id}>
            <span>{t.type}</span>
            <span>{money(t.amount)}</span>
            <span>{fmtDate(t.created_at)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7f5",
    color: "#17221c",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    background: "#08783f",
    color: "white",
    padding: "16px 5%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
  },
  brand: { fontWeight: 900, fontSize: 20, letterSpacing: 0.4 },
  headerSmall: { opacity: 0.85, fontSize: 12, marginTop: 3 },
  logout: {
    border: "1px solid rgba(255,255,255,.5)",
    background: "transparent",
    color: "white",
    borderRadius: 8,
    padding: "9px 14px",
    cursor: "pointer",
  },
  nav: {
    background: "white",
    borderBottom: "1px solid #dfe7e2",
    display: "flex",
    gap: 5,
    padding: "8px 5%",
    overflowX: "auto",
  },
  navBtn: {
    border: 0,
    background: "transparent",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  navActive: {
    border: 0,
    background: "#e4f6eb",
    color: "#08783f",
    fontWeight: 800,
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  container: { width: "min(1200px, 92%)", margin: "24px auto 60px" },
  hero: {
    background: "#08783f",
    color: "white",
    borderRadius: 14,
    padding: 22,
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 18,
  },
  balanceMini: {
    background: "rgba(255,255,255,.13)",
    padding: "12px 16px",
    borderRadius: 10,
    minWidth: 150,
    display: "grid",
    gap: 4,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: 18,
    alignItems: "start",
  },
  matchCard: {
    background: "white",
    border: "1px solid #e1e8e4",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    boxShadow: "0 3px 12px rgba(0,0,0,.04)",
  },
  matchTop: {
    display: "flex",
    justifyContent: "space-between",
    color: "#708078",
    fontSize: 12,
  },
  teams: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    alignItems: "center",
    padding: "16px 4px",
    fontSize: 16,
    textAlign: "center",
  },
  market: { marginTop: 10 },
  marketTitle: { fontWeight: 800, fontSize: 13, marginBottom: 7 },
  oddsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))",
    gap: 7,
  },
  oddBtn: {
    border: "1px solid #d7e3dc",
    background: "#f8fbf9",
    borderRadius: 7,
    padding: "9px 7px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    gap: 5,
  },
  slip: {
    background: "white",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #e1e8e4",
    position: "sticky",
    top: 15,
  },
  slipTitle: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #e7ece9",
    paddingBottom: 12,
    marginBottom: 10,
  },
  slipItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    padding: "11px 0",
    borderBottom: "1px solid #edf1ee",
    fontSize: 13,
  },
  remove: {
    border: 0,
    background: "#ffe9e9",
    color: "#b42318",
    width: 28,
    height: 28,
    borderRadius: 6,
    cursor: "pointer",
  },
  summary: {
    display: "flex",
    justifyContent: "space-between",
    padding: "9px 0",
    fontSize: 14,
  },
  primary: {
    width: "100%",
    border: 0,
    background: "#08783f",
    color: "white",
    padding: "12px 14px",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondary: {
    width: "100%",
    border: "1px solid #cfdad4",
    background: "white",
    padding: "12px 14px",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    border: "1px solid #cfdad4",
    borderRadius: 8,
    marginBottom: 10,
    background: "white",
    fontSize: 14,
  },
  card: {
    background: "white",
    border: "1px solid #e1e8e4",
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
  },
  walletHero: {
    background: "#08783f",
    color: "white",
    borderRadius: 14,
    padding: 25,
    display: "grid",
    gap: 5,
    marginBottom: 18,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 15,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #edf1ee",
  },
  buttonRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  badge: {
    background: "#edf7f0",
    color: "#08783f",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  small: { color: "#748078", fontSize: 12, marginTop: 4 },
  muted: { color: "#6e7b74", lineHeight: 1.5 },
  noOdds: { color: "#87938d", fontSize: 13 },
  error: {
    background: "#fff0f0",
    color: "#a51d1d",
    border: "1px solid #f1c3c3",
    padding: "11px 13px",
    borderRadius: 8,
    marginBottom: 12,
  },
  success: {
    background: "#edf9f1",
    color: "#08783f",
    border: "1px solid #c9ead4",
    padding: "11px 13px",
    borderRadius: 8,
    marginBottom: 12,
  },
  authWrap: {
    minHeight: "calc(100vh - 75px)",
    display: "grid",
    placeItems: "center",
    padding: 20,
  },
  authCard: {
    width: "min(420px, 100%)",
    background: "white",
    padding: 28,
    borderRadius: 16,
    boxShadow: "0 10px 35px rgba(0,0,0,.08)",
    border: "1px solid #e1e8e4",
  },
  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    background: "#08783f",
    color: "white",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    marginBottom: 14,
  },
  linkButton: {
    width: "100%",
    border: 0,
    background: "transparent",
    color: "#08783f",
    padding: 12,
    cursor: "pointer",
    fontWeight: 700,
  },
  virtualHero: {
    background: "linear-gradient(135deg, #0a8f4d, #19b86a)",
    color: "white",
    borderRadius: 18,
    padding: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
    boxShadow: "0 12px 30px rgba(8,120,63,.18)",
  },
  virtualEyebrow: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.4,
    opacity: 0.9,
  },
  virtualCount: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: "rgba(255,255,255,.18)",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    fontWeight: 900,
    flexShrink: 0,
  },
  virtualGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 14,
  },
  virtualCard: {
    background: "white",
    border: "1px solid #e1e8e4",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 7px 20px rgba(0,0,0,.05)",
  },
  virtualIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    background: "#e9fff2",
    marginBottom: 12,
  },
  virtualButton: {
    width: "100%",
    border: 0,
    background: "#08783f",
    color: "white",
    padding: "11px 12px",
    borderRadius: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  virtualNote: {
    marginTop: 16,
    background: "#fff8df",
    border: "1px solid #f2dda0",
    color: "#68510c",
    padding: 13,
    borderRadius: 10,
    lineHeight: 1.45,
    fontSize: 13,
  },
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "system-ui",
  },
};

export default App;
