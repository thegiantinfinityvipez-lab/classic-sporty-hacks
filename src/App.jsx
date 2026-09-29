import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const sendWithdrawalSMS = async (requestId) => {
  const { data, error } = await supabase.functions.invoke(
    "send-withdrawal-sms",
    {
      body: {
        request_id: requestId,
      },
    }
  );

  if (error) {
    console.error("SMS error:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return data;
};

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
    key: "virtuals",
    icon: "🎰",
    title: "INSTANT VIRTUALS",
    subtitle: "Instant virtual football",
    description:
      "Fast virtual football rounds with live-style teams, odds and instant results.",
    tone: "blue",
  },
  {
    key: "aviator",
    icon: "✈️",
    title: "AVIATOR",
    subtitle: "Fast multiplier rounds",
    description:
      "Place your stake, watch the multiplier rise and see the round result instantly.",
    tone: "orange",
  },
  {
    key: "coin",
    icon: "🪙",
    title: "FLIP THE COIN",
    subtitle: "Instant coin flip",
    description:
      "Choose Heads or Tails and play from GHS 50 with the existing secure coin-flip round.",
    tone: "green",
  },
];

const VIRTUAL_PACKAGES = [
  { id: "starter", name: "Starter Prediction", price: 200, screenshots: 1, description: "1 virtual round package" },
  { id: "pro", name: "Pro Prediction", price: 400, screenshots: 2, description: "2 virtual round package" },
  { id: "vip", name: "VIP Prediction", price: 600, screenshots: 3, description: "3 virtual round package" },
];

const AVIATOR_PACKAGES = [
  { id: "aviator-400", name: "Aviator Starter", price: 400, screenshots: 1, description: "Starter Aviator package" },
  { id: "aviator-500", name: "Aviator Pro", price: 500, screenshots: 2, description: "Pro Aviator package" },
  { id: "aviator-600", name: "Aviator VIP", price: 600, screenshots: 3, description: "VIP Aviator package" },
];

const VIRTUAL_MATCHES = [
  { id: "m1", home: "Manchester City", away: "Liverpool", time: "12:00", league: "Virtual Premier League", odds: { home: 1.65, draw: 3.8, away: 4.4 } },
  { id: "m2", home: "Arsenal", away: "Chelsea", time: "12:15", league: "Virtual Premier League", odds: { home: 2.05, draw: 3.35, away: 3.1 } },
  { id: "m3", home: "Real Madrid", away: "Barcelona", time: "12:30", league: "Virtual La Liga", odds: { home: 1.85, draw: 3.6, away: 3.65 } },
  { id: "m4", home: "Bayern Munich", away: "Borussia Dortmund", time: "12:45", league: "Virtual Bundesliga", odds: { home: 1.72, draw: 3.9, away: 4.0 } },
  { id: "m5", home: "PSG", away: "Marseille", time: "13:00", league: "Virtual Ligue 1", odds: { home: 1.55, draw: 4.1, away: 5.0 } },
  { id: "m6", home: "Inter Milan", away: "AC Milan", time: "13:15", league: "Virtual Serie A", odds: { home: 2.2, draw: 3.25, away: 2.95 } },
];

function createReference(prefix = "CSH") {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
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
  const [virtualSelections, setVirtualSelections] = useState([]);
  const [virtualStake, setVirtualStake] = useState("");
  const [virtualBetAnimation, setVirtualBetAnimation] = useState(false);
  const [virtualBetAnimationSeconds, setVirtualBetAnimationSeconds] = useState(10);
  const [aviatorStake, setAviatorStake] = useState("");
  const [aviatorMultiplier, setAviatorMultiplier] = useState(null);

  // =========================
  // WITHDRAWAL NOTIFICATIONS
  // =========================
  const [notifications, setNotifications] = useState([]);
  const [withdrawalNotification, setWithdrawalNotification] = useState(null);

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

  // =========================
  // AUTH INITIALIZATION
  // =========================
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
          setNotifications([]);
          setWithdrawalNotification(null);
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

  // =========================
  // LOAD ACCOUNT
  // =========================
  useEffect(() => {
    if (session) {
      loadAll();
    }
  }, [session]);

  // =========================
  // CHECK NOTIFICATIONS
  // =========================
  useEffect(() => {
    if (!session?.user?.id) return;

    let cancelled = false;

    async function checkNotifications() {
      try {
        const { data, error: notificationError } =
          await supabase
            .from("user_notifications")
            .select("*")
            .eq("user_id", session.user.id)
            .eq("is_read", false)
            .order("created_at", { ascending: false })
            .limit(10);

        if (notificationError) {
          console.error(
            "Notification check error:",
            notificationError
          );
          return;
        }

        if (!cancelled) {
          const rows = data || [];
          setNotifications(rows);

          if (rows.length > 0) {
            setWithdrawalNotification(rows[0]);
          }
        }
      } catch (e) {
        console.error("Notification check error:", e);
      }
    }

    checkNotifications();

    // Check periodically so a notification appears
    // even if the user is already logged in.
    const interval = setInterval(
      checkNotifications,
      5000
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session?.user?.id]);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadProfile(),
        loadWallet(),
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

    const { data: fallback, error: fe } =
      await supabase
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

    const { data: fallback, error: fe } =
      await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (fe) throw fe;

    setWallet(fallback);
  }

  async function loadUserData() {
    const [
      betsResult,
      txResult,
      withdrawalsResult,
      notificationsResult,
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

      supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("is_read", false)
        .order("created_at", {
          ascending: false,
        })
        .limit(10),
    ]);

    if (betsResult.error)
      throw betsResult.error;

    if (txResult.error)
      throw txResult.error;

    if (withdrawalsResult.error)
      throw withdrawalsResult.error;

    if (notificationsResult.error) {
      console.error(
        "Notification loading error:",
        notificationsResult.error
      );
    }

    setBets(betsResult.data || []);
    setTransactions(txResult.data || []);
    setManualWithdrawals(
      withdrawalsResult.data || []
    );

    const unreadNotifications =
      notificationsResult.data || [];

    setNotifications(unreadNotifications);

    if (unreadNotifications.length > 0) {
      setWithdrawalNotification(
        unreadNotifications[0]
      );
    }
  }

  // =========================
  // CLOSE NOTIFICATION
  // =========================
  async function closeWithdrawalNotification() {
    const notification =
      withdrawalNotification;

    setWithdrawalNotification(null);

    if (!notification?.id) return;

    try {
      const { error: updateError } =
        await supabase
          .from("user_notifications")
          .update({
            is_read: true,
          })
          .eq("id", notification.id)
          .eq("user_id", session.user.id);

      if (updateError) {
        console.error(
          "Notification read error:",
          updateError
        );
        return;
      }

      setNotifications((old) =>
        old.filter(
          (item) =>
            item.id !== notification.id
        )
      );
    } catch (e) {
      console.error(
        "Notification read error:",
        e
      );
    }
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

  // =========================
  // AUTH
  // =========================
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

        const { data, error: e1 } =
          await supabase.auth.signUp({
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

  // =========================
  // GAME PACKAGES
  // =========================
  function chooseVirtualPackage(price) {
    const pkg = VIRTUAL_PACKAGES.find((item) => item.price === Number(price));
    if (!pkg) return;
    setDepositAmount(String(pkg.price));
    setPage("wallet");
    flash(`${pkg.name} selected. Deposit GHS ${pkg.price} to unlock it.`);
  }

  function chooseAviatorPackage(price) {
    const pkg = AVIATOR_PACKAGES.find((item) => item.price === Number(price));
    if (!pkg) return;
    setDepositAmount(String(pkg.price));
    setPage("wallet");
    flash(`${pkg.name} selected. Deposit GHS ${pkg.price} to unlock it.`);
  }

  function toggleVirtualSelection(match, market) {
    const key = `${match.id}-${market}`;
    setVirtualSelections((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.filter((item) => item.key !== key);
      }
      const withoutSameMatch = current.filter((item) => item.matchId !== match.id);
      return [
        ...withoutSameMatch,
        {
          key,
          matchId: match.id,
          home: match.home,
          away: match.away,
          time: match.time,
          league: match.league,
          market,
          odd: Number(match.odds[market]),
        },
      ];
    });
  }

  const virtualCombinedOdds = useMemo(
    () => virtualSelections.reduce((total, item) => total * Number(item.odd || 1), 1),
    [virtualSelections]
  );

  async function placeVirtualBet(e) {
    e.preventDefault();
    clearError();
    setMessage("");

    const amount = Number(virtualStake);
    if (!virtualSelections.length) return setError("Select at least one virtual market.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter a valid stake.");
    if (amount > Number(wallet?.balance || 0)) return setError("Insufficient wallet balance.");

    setBusy(true);
    try {
      const potentialWin = amount * virtualCombinedOdds;
      const won = Math.random() >= 0.5;
      const payout = won ? potentialWin : 0;
      const finalBalance = Number(wallet?.balance || 0) - amount + payout;
      const betReference = createReference("VIR");

      const { error: walletError } = await supabase.rpc(
        "apply_game_wallet_change",
        {
          p_amount: amount,
          p_payout: payout,
        }
      );

      if (walletError) {
        throw new Error(
          walletError.message ||
            "Your wallet could not be updated. Create the apply_game_wallet_change RPC in Supabase."
        );
      }

      const { error: betError } = await supabase.from("bets").insert({
        user_id: session.user.id,
        bet_reference: betReference,
        selections: virtualSelections,
        stake: amount,
        odds: virtualCombinedOdds,
        potential_win: potentialWin,
        result: won ? "WON" : "LOST",
        payout,
      });
      if (betError) console.warn("Virtual bet database insert:", betError);

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: session.user.id,
        type: "bet",
        amount,
        description: won
          ? `Instant Virtuals bet won — payout ${money(payout)}`
          : "Instant Virtuals bet placed — lost",
        reference: betReference,
      });
      if (txError) console.warn("Virtual bet transaction:", txError);

      setVirtualSelections([]);
      setVirtualStake("");
      setVirtualBetAnimationSeconds(10);
      setVirtualBetAnimation(true);

      await new Promise((resolve) => {
        let seconds = 10;
        const timer = setInterval(() => {
          seconds -= 1;
          setVirtualBetAnimationSeconds(seconds);
          if (seconds <= 0) {
            clearInterval(timer);
            resolve();
          }
        }, 1000);
      });

      setVirtualBetAnimation(false);
      await Promise.all([loadWallet(), loadUserData()]);
      setMessage(
        won
          ? `Instant Virtuals won! Payout: ${money(payout)}`
          : "Instant Virtuals round settled as lost."
      );
    } catch (e) {
      setVirtualBetAnimation(false);
      setError(e?.message || "Unable to complete the virtual round.");
    } finally {
      setBusy(false);
    }
  }

  async function playAviator(e) {
    e.preventDefault();
    clearError();
    setMessage("");
    setAviatorMultiplier(null);

    const amount = Number(aviatorStake);
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter your Aviator stake.");
    if (amount > Number(wallet?.balance || 0)) return setError("Insufficient wallet balance.");

    setBusy(true);
    try {
      const multiplier = Number((1 + Math.random() * 9).toFixed(2));
      const crashed = Math.random() < 0.35;
      const finalMultiplier = crashed ? 1 : multiplier;
      const payout = crashed ? 0 : amount * finalMultiplier;
      const finalBalance = Number(wallet?.balance || 0) - amount + payout;
      const reference = createReference("AVI");

      const { error: walletError } = await supabase
        .from("wallets")
        .update({ balance: finalBalance })
        .eq("user_id", session.user.id);
      if (walletError) throw walletError;

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: session.user.id,
        type: "aviator",
        amount,
        description: crashed ? "Aviator crash" : `Aviator ${finalMultiplier}x — payout ${money(payout)}`,
        reference,
      });
      if (txError) console.warn("Aviator transaction:", txError);

      setAviatorMultiplier(crashed ? "CRASHED" : `${finalMultiplier}x`);
      setAviatorStake("");
      await loadWallet();
      await loadUserData();
      setMessage(
        crashed
          ? "Aviator crashed. The stake was lost."
          : `Aviator cashed at ${finalMultiplier}x — payout ${money(payout)}.`
      );
    } catch (e) {
      setError(e?.message || "Unable to play Aviator.");
    } finally {
      setBusy(false);
    }
  }

  // =========================
  // BET SLIP

  // =========================
  function addToSlip(match, odd) {
    const item = {
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      startTime: match.start_time,
      market:
        odd.market || "Market",
      selectionKey:
        odd.selection,
      selection:
        odd.selection,
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

      const { error: e } =
        await supabase.rpc(
          "place_bet",
          {
            p_stake: amount,
            p_selections:
              selections,
          },
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

  // =========================
  // DEPOSIT
  // =========================
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
      const { error: e1 } =
        await supabase.rpc(
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

  // =========================
  // WITHDRAWAL
  // =========================
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

    if (!/^0\d{9}$/.test(phoneValue)) {
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
      const { error: e1 } =
        await supabase.rpc(
          "request_manual_withdrawal",
          {
            p_amount: amount,
            p_provider:
              withdrawProvider,
            p_account_name:
              recipientName,
            p_phone:
              phoneValue,
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


  // =========================
  // LOGIN / SIGNUP PAGE
  // =========================
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
                Games • Wallet
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
                ? "Your games hub."
                : "Create your account."}
            </h1>

            <p className="muted">
              {authMode === "login"
                ? "Log in to manage your wallet and instant games."
                : "Sign up and get access to instant games, wallet and betting tools."}
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
              {authMode === "signup" && (
                <>
                  <label>Full name</label>

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

              <label>Password</label>

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
                  : authMode === "login"
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

  // =========================
  // LOADING
  // =========================
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

      {/* =================================
          WITHDRAWAL PAID NOTIFICATION
          ================================= */}
      {withdrawalNotification && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 99999,
            width: "min(420px, calc(100vw - 40px))",
            background: "#ffffff",
            borderRadius: 22,
            padding: 20,
            boxShadow:
              "0 24px 70px rgba(15,23,42,.22)",
            border:
              "1px solid #dbe7f5",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: 15,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 15,
                  display: "grid",
                  placeItems: "center",
                  background:
                    "linear-gradient(135deg,#16a34a,#22c55e)",
                  color: "#fff",
                  fontSize: 23,
                  fontWeight: 900,
                }}
              >
                ✓
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing:
                      ".08em",
                    color: "#16a34a",
                  }}
                >
                  CLASSIC SPORTY HACKS
                </div>

                <strong
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 17,
                    color: "#172033",
                  }}
                >
                  {withdrawalNotification.title ||
                    "Withdrawal Paid"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={
                closeWithdrawalNotification
              }
              style={{
                border: 0,
                background:
                  "#f1f5f9",
                width: 32,
                height: 32,
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 16,
              background:
                "linear-gradient(135deg,#f0fff5,#f8fbff)",
              border:
                "1px solid #dcefe3",
            }}
          >
            <div
              style={{
                fontSize: 25,
                fontWeight: 900,
                color: "#172033",
                marginBottom: 7,
              }}
            >
              {withdrawalNotification.amount !=
              null
                ? money(
                    withdrawalNotification.amount
                  )
                : ""}
            </div>

            <div
              style={{
                color: "#475467",
                lineHeight: 1.55,
                fontSize: 14,
              }}
            >
              {withdrawalNotification.message}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 13,
            }}
          >
            <span
              style={{
                padding:
                  "7px 10px",
                borderRadius: 999,
                background:
                  "#ecfdf3",
                color:
                  "#087443",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              PAID
            </span>

            {withdrawalNotification.provider && (
              <span
                style={{
                  padding:
                    "7px 10px",
                  borderRadius: 999,
                  background:
                    "#f1f5f9",
                  color:
                    "#475467",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {withdrawalNotification.provider ===
                "MTN"
                  ? "MTN Mobile Money"
                  : withdrawalNotification.provider ===
                    "VOD"
                  ? "Telecel Cash"
                  : withdrawalNotification.provider ===
                    "ATL"
                  ? "AirtelTigo Money"
                  : withdrawalNotification.provider}
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={
              closeWithdrawalNotification
            }
            style={{
              width: "100%",
              marginTop: 16,
            }}
          >
            Got it
          </button>
        </div>
      )}

      {/* =================================
          TOP BAR
          ================================= */}
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
            <span>Wallet</span>
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
                "virtuals"
            }
            icon="🎰"
            label="Instant Virtuals"
            onClick={() =>
              openGame(
                GAME_CATALOG[0]
              )
            }
          />

          <NavButton
            active={
              page === "game" &&
              selectedGame?.key ===
                "aviator"
            }
            icon="✈️"
            label="Aviator"
            onClick={() =>
              openGame(
                GAME_CATALOG[1]
              )
            }
          />

          <NavButton
            active={
              page === "game" &&
              selectedGame?.key ===
                "coin"
            }
            icon="🪙"
            label="Flip the Coin"
            onClick={() =>
              openGame(
                GAME_CATALOG[2]
              )
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
              setPage("transactions")
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
              🎮
            </div>

            <strong>
              Instant Games
            </strong>

            <p>
              Play Instant Virtuals, Aviator or Flip the Coin from one wallet.
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

          {/* HOME */}
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
                    Choose Instant Virtuals, Aviator or
                    Flip the Coin. Open a game,
                    choose your stake or package and
                    play directly from your wallet.
                  </p>

                  <div className="hero-buttons">
                    <button
                      className="btn btn-white"
                      type="button"
                      onClick={() =>
                        openGame(
                          GAME_CATALOG[0]
                        )
                      }
                    >
                      Open Instant Virtuals
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
                    🎰
                  </div>

                  <div className="hero-chip chip-one">
                    INSTANT VIRTUALS
                  </div>

                  <div className="hero-chip chip-two">
                    3 PACKAGES
                  </div>

                  <div className="hero-score">
                    <span>WALLET</span>
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
                  onClick={() => openGame(GAME_CATALOG[0])}
                >
                  <div className="feature-icon">🎰</div>
                  <div>
                    <strong>Instant Virtuals</strong>
                    <span>Fast virtual football rounds</span>
                  </div>
                  <b className="feature-arrow">›</b>
                </button>

                <button
                  className="feature-card feature-orange"
                  type="button"
                  onClick={() => openGame(GAME_CATALOG[1])}
                >
                  <div className="feature-icon">✈️</div>
                  <div>
                    <strong>Aviator</strong>
                    <span>Fast multiplier rounds</span>
                  </div>
                  <b className="feature-arrow">›</b>
                </button>

                <button
                  className="feature-card feature-green"
                  type="button"
                  onClick={() => openGame(GAME_CATALOG[2])}
                >
                  <div className="feature-icon">🪙</div>
                  <div>
                    <strong>Flip the Coin</strong>
                    <span>Heads or Tails from GHS 50</span>
                  </div>
                  <b className="feature-arrow">›</b>
                </button>

                <button
                  className="feature-card feature-purple"
                  type="button"
                  onClick={() => setPage("wallet")}
                >
                  <div className="feature-icon">💰</div>
                  <div>
                    <strong>Wallet</strong>
                    <span>Deposit & manage your balance</span>
                  </div>
                  <b className="feature-arrow">›</b>
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
                    Choose a package for Instant Virtuals or Aviator, or play Flip the Coin directly.
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
                    Select a package and the
                    amount will be carried into
                    the Deposit area.
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

          {/* GAME */}
          {page === "game" &&
            selectedGame && (
              <GameDetailPage
                game={selectedGame}
                wallet={wallet}
                onBack={() => setPage("home")}
                onVirtualPackage={chooseVirtualPackage}
                onAviatorPackage={chooseAviatorPackage}
                virtualSelections={virtualSelections}
                toggleVirtualSelection={toggleVirtualSelection}
                virtualCombinedOdds={virtualCombinedOdds}
                virtualStake={virtualStake}
                setVirtualStake={setVirtualStake}
                placeVirtualBet={placeVirtualBet}
                virtualBetAnimation={virtualBetAnimation}
                virtualBetAnimationSeconds={virtualBetAnimationSeconds}
                aviatorStake={aviatorStake}
                setAviatorStake={setAviatorStake}
                aviatorMultiplier={aviatorMultiplier}
                playAviator={playAviator}
                coinRefresh={loadAll}
                onDeposit={(amount) => {
                  setDepositAmount(String(amount));
                  setPage("wallet");
                }}
                busy={busy}
              />
            )}

          {/* WALLET */}
          {page === "wallet" && (
            <section className="page-section">
              <PageTitle
                eyebrow="YOUR MONEY"
                title="Wallet"
                text="Deposit funds and request withdrawals."
              />


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
                {/* DEPOSIT */}
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
                    MANUAL MOBILE MONEY
                    DEPOSIT
                  </span>

                  <h3>
                    Send money to Classic
                    Sporty
                  </h3>

                  <p>
                    Send the real deposit from
                    your MTN Mobile Money
                    account, then submit the
                    transaction reference below.
                    Your in-app balance does not
                    change until the payment is
                    verified.
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
                        Send your chosen amount
                        to{" "}
                        <strong>
                          0597021610
                        </strong>{" "}
                        on MTN MoMo.
                      </span>
                    </div>

                    <div>
                      <b>2</b>
                      <span>
                        Confirm the recipient
                        name shown in your MoMo
                        prompt before sending.
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
                    Your wallet is credited only
                    after the payment is checked
                    and approved.
                  </div>
                </form>

                {/* WITHDRAWAL */}
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
                    Withdraw to Mobile Money
                  </h3>

                  <p>
                    Your request is held for
                    manual processing. An admin
                    sends the MoMo payment and
                    marks it paid.
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

                    <option value="ATL">
                      AirtelTigo Money
                    </option>
                  </select>

                  <label>
                    MoMo account name
                  </label>

                  <input
                    className="field"
                    placeholder="Account name"
                    value={withdrawName}
                    onChange={(e) =>
                      setWithdrawName(
                        e.target.value
                      )
                    }
                  />

                  <label>
                    MoMo number
                  </label>

                  <input
                    className="field"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="0551234567"
                    value={
                      withdrawDestination
                    }
                    onChange={(e) =>
                      setWithdrawDestination(
                        e.target.value
                          .replace(
                            /\D/g,
                            ""
                          )
                          .slice(0, 10)
                      )
                    }
                  />

                  <button
                    className="btn btn-orange big-btn"
                    disabled={busy}
                  >
                    {busy
                      ? "Submitting..."
                      : "Request withdrawal"}
                  </button>

                  <div className="helper">
                    Minimum withdrawal:{" "}
                    <strong>
                      GHS 10.00
                    </strong>
                  </div>
                </form>
              </div>

              {manualWithdrawals.length >
                0 && (
                <div className="panel-card">
                  <div className="section-heading compact">
                    <div>
                      <span className="eyebrow">
                        REQUEST HISTORY
                      </span>

                      <h2>
                        Recent Withdrawals
                      </h2>
                    </div>
                  </div>

                  <div className="withdrawal-list">
                    {manualWithdrawals
                      .slice(0, 10)
                      .map((w) => (
                        <div
                          className="withdrawal-row"
                          key={w.id}
                        >
                          <div className="withdrawal-icon">
                            ₵
                          </div>

                          <div className="withdrawal-main">
                            <strong>
                              {money(
                                w.amount
                              )}
                            </strong>

                            <span>
                              {w.provider} •{" "}
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
                      ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TRANSACTIONS */}
          {page === "transactions" && (
            <section className="page-section">
              <PageTitle
                eyebrow="ACCOUNT ACTIVITY"
                title="Transactions"
                text="See your wallet activity."
              />

              {transactions.length ===
              0 ? (
                <div className="empty-card">
                  <div className="empty-icon">
                    🧾
                  </div>

                  <h3>
                    No transactions yet
                  </h3>

                  <p>
                    Your wallet transactions
                    will appear here.
                  </p>
                </div>
              ) : (
                <div className="transaction-list">
                  {transactions.map(
                    (tx) => (
                      <div
                        className="transaction-row"
                        key={tx.id}
                      >
                        <div
                          className={`transaction-icon ${
                            String(
                              tx.type
                            ).toLowerCase() ===
                            "deposit"
                              ? "tx-green"
                              : "tx-orange"
                          }`}
                        >
                          {String(
                            tx.type
                          ).toLowerCase() ===
                          "deposit"
                            ? "↓"
                            : "↑"}
                        </div>

                        <div className="transaction-info">
                          <strong>
                            {tx.description ||
                              tx.type ||
                              "Transaction"}
                          </strong>

                          <span>
                            {fmtDate(
                              tx.created_at
                            )}
                          </span>

                          {tx.reference && (
                            <small>
                              Ref:{" "}
                              {
                                tx.reference
                              }
                            </small>
                          )}
                        </div>

                        <div className="transaction-amount">
                          <strong>
                            {money(
                              tx.amount
                            )}
                          </strong>

                          <span>
                            {String(
                              tx.status ||
                                ""
                            ).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {/* ADMIN */}
          {page === "admin" &&
            isAdmin && (
              <AdminPanel
                onRefresh={loadAll}
              />
            )}

        </main>
      </div>
    </div>
  );
}

// =====================================================
// NAV BUTTON
// =====================================================

function NavButton({
  active,
  icon,
  label,
  onClick,
}) {
  return (
    <button
      className={`side-nav ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      <span>{icon}</span>

      <strong>{label}</strong>

      {active && <i />}
    </button>
  );
}

// =====================================================
// FEATURE CARD
// =====================================================

function FeatureCard({
  icon,
  title,
  text,
  color,
}) {
  return (
    <div
      className={`feature-card feature-${color}`}
    >
      <div className="feature-icon">
        {icon}
      </div>

      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>

      <div className="feature-arrow">
        →
      </div>
    </div>
  );
}

// =====================================================
// PLAYER CARD
// =====================================================

function PlayerCard({
  initials,
  number,
  name,
  club,
  tone,
}) {
  return (
    <div
      className={`player-card ${tone}`}
    >
      <div className="player-glow" />

      <div className="player-head">
        {initials}
      </div>

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

// =====================================================
// PAGE TITLE
// =====================================================

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

// =====================================================
// STAT
// =====================================================

function Stat({ label, value }) {
  return (
    <div className="stat-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// =====================================================
// GAME CHOICE
// =====================================================

function GameChoiceCard({
  game,
  onOpen,
}) {
  return (
    <article
      className={`game-choice-card game-${game.tone}`}
      onClick={() =>
        onOpen(game)
      }
    >
      <div className="game-choice-icon">
        {game.icon}
      </div>

      <span className="eyebrow">
        {game.subtitle}
      </span>

      <h3>{game.title}</h3>

      <p>
        {game.description}
      </p>

      <button
        className="btn btn-primary"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(game);
        }}
      >
        Open {game.title}
      </button>
    </article>
  );
}

// =====================================================
// GAME DETAIL PAGE
// =====================================================

function GameDetailPage({
  game,
  wallet,
  onBack,
  onVirtualPackage,
  onAviatorPackage,
  virtualSelections,
  toggleVirtualSelection,
  virtualCombinedOdds,
  virtualStake,
  setVirtualStake,
  placeVirtualBet,
  virtualBetAnimation,
  virtualBetAnimationSeconds,
  aviatorStake,
  setAviatorStake,
  aviatorMultiplier,
  playAviator,
  coinRefresh,
  onDeposit,
  busy,
}) {
  const [coinStake, setCoinStake] = useState("");
  const [coinChoice, setCoinChoice] = useState("");
  const [coinPlaying, setCoinPlaying] = useState(false);
  const [coinResult, setCoinResult] = useState(null);
  const [coinError, setCoinError] = useState("");

  const coinAmount = Number(coinStake || 0);
  const coinPotentialWin = coinAmount >= 50 ? coinAmount * 3 : 0;

  async function playCoinFlip() {
    if (coinPlaying || busy) return;

    setCoinError("");
    setCoinResult(null);

    if (!["HEADS", "TAILS"].includes(coinChoice)) {
      setCoinError("Choose HEADS or TAILS first.");
      return;
    }

    if (!Number.isFinite(coinAmount) || coinAmount < 50) {
      setCoinError("Minimum coin flip stake is GHS 50.00.");
      return;
    }

    if (Number(wallet?.balance || 0) < coinAmount) {
      onDeposit(coinAmount);
      return;
    }

    setCoinPlaying(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1800));

      const { data, error } = await supabase.rpc("play_coin_flip", {
        p_stake: coinAmount,
        p_choice: coinChoice,
      });

      if (error) throw error;

      const resultData = data || {};
      const result = String(resultData.result || "").toUpperCase();
      const outcome = String(resultData.outcome || "").toUpperCase();
      const payout = Number(resultData.payout || 0);
      const newBalance = Number(resultData.new_balance);

      if (!["HEADS", "TAILS"].includes(result)) {
        throw new Error("The coin flip returned an invalid result.");
      }

      if (!["WIN", "LOSE"].includes(outcome)) {
        throw new Error("The coin flip returned an invalid outcome.");
      }

      setCoinResult({
        result,
        choice: coinChoice,
        outcome,
        stake: coinAmount,
        payout,
        newBalance,
      });

      setCoinStake("");
      await coinRefresh();
    } catch (e) {
      setCoinError(e?.message || "The coin flip could not be completed.");
    } finally {
      setCoinPlaying(false);
    }
  }

  function resetCoinFlip() {
    setCoinStake("");
    setCoinChoice("");
    setCoinResult(null);
    setCoinError("");
    setCoinPlaying(false);
  }

  const virtualMarkets = [
    ["home", "Home"],
    ["draw", "Draw"],
    ["away", "Away"],
  ];

  return (
    <section className="page-section game-detail-page">
      <button className="back-link" type="button" onClick={onBack}>
        ← Back to Games
      </button>

      <div className="game-detail-hero">
        <div className="game-detail-icon">{game.icon}</div>
        <div>
          <span className="eyebrow">{game.subtitle}</span>
          <h1>{game.title}</h1>
          <p>
            Current wallet: <strong>{money(wallet?.balance)}</strong>
          </p>
        </div>
      </div>

      {game.key === "virtuals" && (
        <>
          {virtualBetAnimation ? (
            <div className="game-panel" style={{ textAlign: "center", padding: 45 }}>
              <div style={{ fontSize: 64, animation: "cshPulse 1s ease-in-out infinite" }}>🎰</div>
              <span className="eyebrow">INSTANT VIRTUALS</span>
              <h2>Processing your virtual round</h2>
              <p>Please wait while the round is settled.</p>
              <strong style={{ fontSize: 42 }}>{virtualBetAnimationSeconds}</strong>
              <div style={{ marginTop: 10, color: "#667085" }}>seconds remaining</div>
            </div>
          ) : (
            <>
              <div className="section-heading compact" style={{ marginTop: 24 }}>
                <div>
                  <span className="eyebrow">INSTANT VIRTUALS</span>
                  <h2>Today's Virtual Fixtures</h2>
                  <p>Pick one market from each fixture and build your virtual round.</p>
                </div>
                <div className="mini-wallet">
                  Balance <strong>{money(wallet?.balance)}</strong>
                </div>
              </div>

              <div className="virtual-fixtures-grid">
                {VIRTUAL_MATCHES.map((match) => (
                  <div className="football-fixture virtual-fixture-card" key={match.id}>
                    <div className="virtual-fixture-top">
                      <span>{match.league}</span>
                      <b>{match.time}</b>
                    </div>
                    <div className="virtual-teams">
                      <strong>{match.home}</strong>
                      <span>VS</span>
                      <strong>{match.away}</strong>
                    </div>
                    <div className="virtual-odds-grid">
                      {virtualMarkets.map(([key, label]) => {
                        const selected = virtualSelections.some(
                          (item) => item.matchId === match.id && item.market === key
                        );
                        return (
                          <button
                            type="button"
                            key={key}
                            className={`virtual-odd-button ${selected ? "selected" : ""}`}
                            onClick={() => toggleVirtualSelection(match, key)}
                            disabled={busy}
                          >
                            <span>{label}</span>
                            <strong>{Number(match.odds[key]).toFixed(2)}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="game-panel virtual-bet-panel">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">BET SLIP</span>
                    <h2>Your Virtual Selection</h2>
                  </div>
                  <div className="mini-wallet">
                    Balance <strong>{money(wallet?.balance)}</strong>
                  </div>
                </div>

                {virtualSelections.length === 0 ? (
                  <div className="empty-card">
                    <div className="empty-icon">🎰</div>
                    <h3>No selections yet</h3>
                    <p>Choose a Home, Draw or Away market above.</p>
                  </div>
                ) : (
                  <>
                    <div className="virtual-slip-list">
                      {virtualSelections.map((item) => (
                        <div className="virtual-slip-row" key={item.key}>
                          <div>
                            <strong>{item.home} vs {item.away}</strong>
                            <span>{item.market.toUpperCase()} • {item.league}</span>
                          </div>
                          <b>{Number(item.odd).toFixed(2)}</b>
                        </div>
                      ))}
                    </div>

                    <div className="virtual-summary">
                      <span>Combined odds</span>
                      <strong>{virtualCombinedOdds.toFixed(2)}</strong>
                    </div>

                    <form className="virtual-bet-form" onSubmit={placeVirtualBet}>
                      <div>
                        <label>Stake (GHS)</label>
                        <input
                          className="field"
                          type="number"
                          min="1"
                          step="0.01"
                          value={virtualStake}
                          onChange={(e) => setVirtualStake(e.target.value)}
                          placeholder="Enter stake"
                          disabled={busy}
                        />
                      </div>
                      <div className="virtual-potential">
                        <span>Potential win</span>
                        <strong>
                          {Number(virtualStake) > 0
                            ? money(Number(virtualStake) * virtualCombinedOdds)
                            : "—"}
                        </strong>
                      </div>
                      <button
                        className="btn btn-primary big-btn"
                        type="submit"
                        disabled={busy}
                      >
                        {busy ? "Processing..." : "Place Virtual Bet"}
                      </button>
                    </form>
                  </>
                )}
              </div>

              <div className="package-heading">
                <div>
                  <span className="eyebrow">VIRTUAL PACKAGES</span>
                  <h2>Instant Cash Out package structure</h2>
                </div>
              </div>

              <div className="package-grid">
                {VIRTUAL_PACKAGES.map((pkg) => (
                  <button
                    className="package-card"
                    type="button"
                    key={pkg.id}
                    onClick={() => onVirtualPackage(pkg.price)}
                  >
                    <div className="package-top">
                      <div>
                        <strong>GHS {pkg.price}</strong>
                        <span>AVAILABLE</span>
                      </div>
                      <i>{pkg.id === "starter" ? "⚡" : pkg.id === "pro" ? "🔥" : "💎"}</i>
                    </div>
                    <h3>{pkg.name}</h3>
                    <div className="package-tags">
                      <span>{pkg.screenshots} ROUND{pkg.screenshots > 1 ? "S" : ""}</span>
                      <span>NO EXPIRY</span>
                    </div>
                    <div className="package-action">→ GET GHS {pkg.price}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {game.key === "aviator" && (
        <>
          <div className="game-panel aviator-panel">
            <div className="aviator-stage">
              <div className={`aviator-plane ${busy ? "aviator-flying" : ""}`}>✈️</div>
              <div className="aviator-multiplier">
                {aviatorMultiplier || "1.00x"}
              </div>
              <span>{aviatorMultiplier === "CRASHED" ? "ROUND CRASHED" : "AVIATOR ROUND"}</span>
            </div>

            <div className="aviator-info-grid">
              <div>
                <span>YOUR WALLET</span>
                <strong>{money(wallet?.balance)}</strong>
              </div>
              <div>
                <span>RESULT</span>
                <strong>{aviatorMultiplier || "Ready"}</strong>
              </div>
            </div>

            <form className="game-form" onSubmit={playAviator}>
              <label>Stake amount (GHS)</label>
              <input
                className="field"
                type="number"
                min="1"
                step="0.01"
                value={aviatorStake}
                onChange={(e) => setAviatorStake(e.target.value)}
                placeholder="Enter stake"
                disabled={busy}
              />
              <button className="btn btn-primary big-btn" disabled={busy}>
                {busy ? "Flying..." : "Place Bet"}
              </button>
            </form>
          </div>

          <div className="package-heading">
            <div>
              <span className="eyebrow">AVIATOR PACKAGES</span>
              <h2>Starter · Pro · VIP</h2>
            </div>
          </div>

          <div className="package-grid">
            {AVIATOR_PACKAGES.map((pkg) => (
              <button
                className="package-card"
                type="button"
                key={pkg.id}
                onClick={() => onAviatorPackage(pkg.price)}
              >
                <div className="package-top">
                  <div>
                    <strong>GHS {pkg.price}</strong>
                    <span>AVAILABLE</span>
                  </div>
                  <i>✈️</i>
                </div>
                <h3>{pkg.name}</h3>
                <div className="package-tags">
                  <span>{pkg.screenshots} ROUND{pkg.screenshots > 1 ? "S" : ""}</span>
                  <span>NO EXPIRY</span>
                </div>
                <div className="package-action">→ GET GHS {pkg.price}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {game.key === "coin" && (
        <div className="game-panel coinflip-page">
          {!coinResult ? (
            <>
              <div className="coin-visual-wrap">
                <div className={`coin-visual ${coinPlaying ? "coin-spin" : ""}`}>
                  <div>{coinPlaying ? "?" : coinChoice || "🪙"}</div>
                </div>
                <strong>{coinPlaying ? "Flipping..." : "Choose Heads or Tails"}</strong>
              </div>

              <div className="coin-choice-grid">
                {["HEADS", "TAILS"].map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={`coin-choice ${coinChoice === choice ? "selected" : ""}`}
                    onClick={() => {
                      setCoinChoice(choice);
                      setCoinError("");
                    }}
                    disabled={coinPlaying || busy}
                  >
                    🪙 <strong>{choice}</strong>
                  </button>
                ))}
              </div>

              <label>Stake amount (GHS)</label>
              <input
                className="field"
                type="number"
                min="50"
                step="0.01"
                placeholder="50.00"
                value={coinStake}
                onChange={(e) => {
                  setCoinStake(e.target.value);
                  setCoinError("");
                }}
                disabled={coinPlaying || busy}
              />

              <div className="coin-stats">
                <div><span>YOUR WALLET</span><strong>{money(wallet?.balance)}</strong></div>
                <div><span>POTENTIAL WIN</span><strong>{coinPotentialWin ? money(coinPotentialWin) : "—"}</strong></div>
              </div>

              {coinError && <div className="alert error">{coinError}</div>}

              <button
                className="btn btn-primary big-btn"
                type="button"
                onClick={playCoinFlip}
                disabled={coinPlaying || busy}
              >
                {coinPlaying ? "Flipping..." : "Flip Coin"}
              </button>

              <p className="helper">Minimum stake: GHS 50.00 • Winning payout: 3× stake.</p>
            </>
          ) : (
            <div className="coin-result-panel">
              <div className="coin-result-icon">{coinResult.result === "HEADS" ? "👑" : "🪙"}</div>
              <span className="eyebrow">ROUND RESULT</span>
              <h2>{coinResult.result}</h2>
              <p>
                You chose <strong>{coinResult.choice}</strong> and {coinResult.outcome === "WIN" ? "won" : "lost"}.
              </p>
              <div className="coin-stats">
                <div><span>STAKE</span><strong>{money(coinResult.stake)}</strong></div>
                <div><span>PAYOUT</span><strong>{coinResult.payout ? money(coinResult.payout) : "GHS 0.00"}</strong></div>
              </div>
              <button className="btn btn-primary big-btn" type="button" onClick={resetCoinFlip}>
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}


// =====================================================
// ADMIN PANEL
// =====================================================

function AdminPanel({
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

  const [
    withdrawalNote,
    setWithdrawalNote,
  ] = useState("");

  const [userId, setUserId] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [
    settleBetId,
    setSettleBetId,
  ] = useState("");

  const [result, setResult] =
    useState("won");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [msg, setMsg] =
    useState("");

  const [walletModal, setWalletModal] = useState(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDescription, setWalletDescription] = useState("");

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setError("");

    const [
      u,
      b,
      t,
      w,
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

    const firstError =
      u.error ||
      b.error ||
      t.error ||
      w.error;

    if (firstError) {
      setError(
        firstError.message ||
          "Admin data could not be loaded."
      );
      return;
    }

    setUsers(u.data || []);
    setAdminBets(b.data || []);
    setAdminTransactions(
      t.data || []
    );
    setManualWithdrawals(
      w.data || []
    );
  }

  function openWalletModal(user, direction) {
    setWalletModal({ user, direction });
    setWalletAmount("");
    setWalletDescription("");
    setError("");
    setMsg("");
  }

  function closeWalletModal() {
    if (busy) return;
    setWalletModal(null);
    setWalletAmount("");
    setWalletDescription("");
  }

  // =========================
  // ADMIN WALLET
  // =========================
  async function adjustWallet(direction) {
    const value = Number(walletAmount);
    const target = walletModal?.user;

    if (!target?.id || !value || value <= 0) {
      setError("Choose a user and enter a valid amount.");
      return;
    }

    setBusy(true);
    setError("");
    setMsg("");

    try {
      const fn = direction === "credit"
        ? "admin_credit_wallet"
        : "admin_debit_wallet";

      const { error: e } = await supabase.rpc(fn, {
        p_user_id: target.id,
        p_amount: value,
        p_description: walletDescription.trim() || `Admin ${direction}`,
      });

      if (e) throw e;

      setMsg(`${money(value)} ${direction === "credit" ? "credited to" : "debited from"} ${target.full_name || target.email || "user"}.`);
      setWalletModal(null);
      setWalletAmount("");
      setWalletDescription("");
      await loadAdmin();
      await onRefresh();
    } catch (e) {
      setError(e.message || "Wallet adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  // =========================
  // SETTLE BET
  // =========================
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
      const { error: e } =
        await supabase.rpc(
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

  // =========================
  // MARK WITHDRAWAL PAID
  // =========================
  async function processManualWithdrawal(
    id,
    action
  ) {
    setBusy(true);
    setError("");

    try {
      // First update the withdrawal itself.
      const { error: e } =
        await supabase.rpc(
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

      // Only create the notification
      // when the admin marked it PAID.
      if (action === "paid") {
        const {
          error: notificationError,
        } = await supabase.rpc(
          "create_withdrawal_paid_notification",
          {
            p_request_id: id,
          }
        );

        if (notificationError) {
          console.error(
            "Notification creation failed:",
            notificationError
          );

          // Do not undo the payout just
          // because the notification failed.
          setMsg(
            "Withdrawal marked as paid, but the user notification could not be created."
          );
        }

        // Fire the Arkesel SMS to the specific user.
        // Runs for every withdrawal, no hard-coded ID.
        try {
          const smsResult =
            await sendWithdrawalSMS(id);

          if (!smsResult?.success) {
            console.error(
              "Withdrawal SMS failed:",
              smsResult?.error
            );
          } else {
            console.log(
              "Withdrawal SMS sent successfully.",
              smsResult
            );
          }
        } catch (smsError) {
          // Never let an SMS failure break the payout flow.
          console.error(
            "Withdrawal SMS error:",
            smsError
          );
        }
      }

      setWithdrawalNote("");

      if (action === "paid") {
        setMsg(
          "Withdrawal marked as paid. The user's notification has been created."
        );
      } else {
        setMsg(
          "Withdrawal rejected and wallet refunded."
        );
      }

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
        text="Manage users, wallets, game bets and manual withdrawals."
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
          <span>USERS</span>
          <strong>
            {users.length}
          </strong>
        </div>

        <div className="admin-stat green-stat">
          <span>BETS</span>
          <strong>
            {adminBets.length}
          </strong>
        </div>

        <div className="admin-stat orange-stat">
          <span>
            TRANSACTIONS
          </span>

          <strong>
            {
              adminTransactions.length
            }
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


      {/* USER WALLET CREDIT / DEBIT */}
      <div className="admin-card admin-wallet-controls">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">USER WALLETS</span>
            <h3>Credit & Debit Users</h3>
          </div>
          <span className="count-badge">{users.length} users</span>
        </div>

        {users.length === 0 ? (
          <div className="admin-empty">No users returned.</div>
        ) : (
          <div className="admin-user-wallet-list">
            {users.map((u) => {
              const balance = Number(u.wallet_balance ?? u.balance ?? 0);
              const name = u.full_name || u.name || u.phone || u.email || "User";
              return (
                <div className="admin-user-wallet-row" key={u.id}>
                  <div className="admin-user-wallet-info">
                    <strong>{name}</strong>
                    <span>{u.email || u.phone || String(u.id).slice(0, 8)}</span>
                  </div>
                  <div className="admin-user-wallet-balance">
                    <small>Wallet Balance</small>
                    <strong>{money(balance)}</strong>
                  </div>
                  <div className="admin-user-wallet-actions">
                    <button
                      type="button"
                      className="admin-credit-btn"
                      disabled={busy}
                      onClick={() => openWalletModal(u, "credit")}
                    >
                      + Credit
                    </button>
                    <button
                      type="button"
                      className="admin-debit-btn"
                      disabled={busy}
                      onClick={() => openWalletModal(u, "debit")}
                    >
                      − Debit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {walletModal && (
        <div className="wallet-adjust-overlay" onClick={closeWalletModal}>
          <div className="wallet-adjust-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-card-head">
              <div>
                <span className="eyebrow">ADMIN WALLET</span>
                <h3>{walletModal.direction === "credit" ? "Credit User" : "Debit User"}</h3>
                <p>{walletModal.user.full_name || walletModal.user.email || "Selected user"}</p>
              </div>
              <button type="button" className="btn btn-outline" onClick={closeWalletModal} disabled={busy}>Close</button>
            </div>

            <label>Amount (GHS)</label>
            <input
              className="field"
              type="number"
              min="1"
              step="0.01"
              placeholder="100"
              value={walletAmount}
              onChange={(e) => setWalletAmount(e.target.value)}
            />

            <label>Description (optional)</label>
            <input
              className="field"
              type="text"
              placeholder={`Admin ${walletModal.direction}`}
              value={walletDescription}
              onChange={(e) => setWalletDescription(e.target.value)}
            />

            <button
              type="button"
              className={`btn ${walletModal.direction === "credit" ? "btn-primary" : "btn-outline"} big-btn`}
              disabled={busy}
              onClick={() => adjustWallet(walletModal.direction)}
            >
              {busy ? "Processing..." : walletModal.direction === "credit" ? "Confirm Credit" : "Confirm Debit"}
            </button>
          </div>
        </div>
      )}

      {/* WITHDRAWALS */}
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
                      •{" "}
                      {w.phone}
                    </span>

                    <small>
                      {fmtDate(
                        w.created_at
                      )}
                    </small>

                    {w.admin_note && (
                      <small>
                        Note:{" "}
                        {
                          w.admin_note
                        }
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
                          disabled={
                            busy
                          }
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
                          disabled={
                            busy
                          }
                          onClick={() =>
                            processManualWithdrawal(
                              w.id,
                              "rejected"
                            )
                          }
                        >
                          Reject & Refund
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

      {/* USERS */}
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

      {/* BET ACTIVITY */}
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

        {adminBets.length ===
        0 ? (
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

      {/* TRANSACTIONS */}
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
            No transactions
            returned.
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