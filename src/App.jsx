import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

/* =========================================================
   CLASSIC SPORTY HACKS
   Full App.jsx
   ========================================================= */

const money = (n) =>
  `GHS ${Number(n || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const virtualMoney = (n) =>
  `${Number(n || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} VC`;

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

/* =========================================================
   VIRTUAL GAMES
   ========================================================= */

const VIRTUAL_GAMES = [
  {
    id: "football",
    icon: "⚽",
    name: "Virtual Football",
    description: "Predict the result of a virtual football match.",
    color: "#08783f",
  },
  {
    id: "basketball",
    icon: "🏀",
    name: "Virtual Basketball",
    description: "Pick the winning virtual basketball team.",
    color: "#f97316",
  },
  {
    id: "horses",
    icon: "🐎",
    name: "Virtual Horse Racing",
    description: "Choose a virtual horse before the race starts.",
    color: "#8b5cf6",
  },
  {
    id: "roulette",
    icon: "🎰",
    name: "Virtual Roulette",
    description: "Choose red, black or green.",
    color: "#dc2626",
  },
  {
    id: "darts",
    icon: "🎯",
    name: "Virtual Darts",
    description: "Choose your virtual darts winner.",
    color: "#2563eb",
  },
  {
    id: "racing",
    icon: "🏎️",
    name: "Virtual Racing",
    description: "Pick the virtual racing car that will finish first.",
    color: "#0891b2",
  },
  {
    id: "boxing",
    icon: "🥊",
    name: "Virtual Boxing",
    description: "Choose the virtual boxer to win.",
    color: "#be123c",
  },
  {
    id: "bowling",
    icon: "🎳",
    name: "Virtual Bowling",
    description: "Pick the virtual bowler with the highest score.",
    color: "#7c3aed",
  },
  {
    id: "dice",
    icon: "🎲",
    name: "Virtual Dice",
    description: "Predict whether the dice result will be high or low.",
    color: "#475569",
  },
  {
    id: "spin",
    icon: "🎡",
    name: "Spin",
    description: "Spin the virtual wheel and see where it lands.",
    color: "#db2777",
  },
];

/* =========================================================
   APP
   ========================================================= */

function App() {
  /* ================= AUTH ================= */

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);

  /* ================= DATA ================= */

  const [matches, setMatches] = useState([]);
  const [bets, setBets] = useState([]);
  const [transactions, setTransactions] = useState([]);

  /* ================= BET SLIP ================= */

  const [betSlip, setBetSlip] = useState([]);
  const [stake, setStake] = useState("");

  /* ================= PAGE ================= */

  const [page, setPage] = useState("home");

  /* ================= GENERAL ================= */

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /* ================= AUTH FORM ================= */

  const [authMode, setAuthMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* ================= DEPOSIT ================= */

  const [depositAmount, setDepositAmount] = useState("");

  /* ================= WITHDRAWAL ================= */

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] =
    useState("Mobile Money");
  const [withdrawProvider, setWithdrawProvider] = useState("MTN");
  const [withdrawName, setWithdrawName] = useState("");
  const [withdrawDestination, setWithdrawDestination] =
    useState("");
  const [manualWithdrawals, setManualWithdrawals] = useState([]);

  /* ================= VIRTUAL GAMES ================= */

  const [virtualCredits, setVirtualCredits] = useState(() => {
    const saved = localStorage.getItem("csh_virtual_credits");
    return saved ? Number(saved) : 1000;
  });

  const [virtualHistory, setVirtualHistory] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("csh_virtual_history") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [selectedVirtualGame, setSelectedVirtualGame] =
    useState("football");

  const [virtualStake, setVirtualStake] = useState(20);

  const [virtualChoice, setVirtualChoice] = useState("");

  const [virtualResult, setVirtualResult] = useState(null);

  const [virtualPlaying, setVirtualPlaying] = useState(false);

  /* ================= ADMIN ================= */

  const isAdmin =
    profile?.role === "admin" &&
    profile?.is_active !== false;

  /* ================= ODDS ================= */

  const combinedOdds = useMemo(
    () =>
      betSlip.reduce(
        (total, item) => total * Number(item.odd || 1),
        1
      ),
    [betSlip]
  );

  const potentialWin =
    Number(stake || 0) * combinedOdds;

  /* =========================================================
     SAVE VIRTUAL DATA
     ========================================================= */

  useEffect(() => {
    localStorage.setItem(
      "csh_virtual_credits",
      String(virtualCredits)
    );
  }, [virtualCredits]);

  useEffect(() => {
    localStorage.setItem(
      "csh_virtual_history",
      JSON.stringify(virtualHistory)
    );
  }, [virtualHistory]);

  /* =========================================================
     AUTH SESSION
     ========================================================= */

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

  /* =========================================================
     LOAD ACCOUNT
     ========================================================= */

  useEffect(() => {
    if (session) {
      loadAll();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      verifyReturnedPayment();
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
      setError(e.message || "Unable to load account.");
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     PROFILE
     ========================================================= */

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

  /* =========================================================
     WALLET
     ========================================================= */

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

  /* =========================================================
     MATCHES
     ========================================================= */

  async function loadMatches() {
    const { data: matchRows, error: matchError } =
      await supabase
        .from("matches")
        .select("*")
        .eq("is_active", true)
        .order("start_time", {
          ascending: true,
        });

    if (matchError) {
      const fallback = await supabase
        .from("matches")
        .select("*")
        .order("start_time", {
          ascending: true,
        });

      if (fallback.error) {
        throw matchError;
      }

      setMatches(
        await attachOdds(fallback.data || [])
      );

      return;
    }

    setMatches(
      await attachOdds(matchRows || [])
    );
  }

  async function attachOdds(rows) {
    if (!rows.length) return [];

    const ids = rows.map((m) => m.id);

    const { data: odds, error: oddsError } =
      await supabase
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

  /* =========================================================
     USER DATA
     ========================================================= */

  async function loadUserData() {
    const [
      betsResult,
      txResult,
      withdrawalsResult,
    ] = await Promise.all([
      supabase
        .from("bets")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", {
          ascending: false,
        }),

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

  /* =========================================================
     MESSAGES
     ========================================================= */

  function flash(text) {
    setMessage(text);

    setTimeout(() => {
      setMessage("");
    }, 3500);
  }

  function clearError() {
    setError("");
  }

  /* =========================================================
     AUTH
     ========================================================= */

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

        const { data, error: e1 } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: name.trim(),
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
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

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

  /* =========================================================
     BET SLIP
     ========================================================= */

  function addToSlip(match, odd) {
    const item = {
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      startTime: match.start_time,
      market: odd.market,
      selectionKey: odd.selection,
      selection: odd.selection,
      odd: Number(odd.odd),
    };

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

  function removeFromSlip(matchId, market) {
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

    if (!Number.isFinite(amount) || amount <= 0) {
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
      const selections = betSlip.map(
        (x) => ({
          match_id: x.matchId,
          market: x.market,
          selection: x.selectionKey,
        })
      );

      const { data, error: e } =
        await supabase.rpc("place_bet", {
          p_stake: amount,
          p_selections: selections,
        });

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

      console.log(
        "place_bet result:",
        data
      );
    } catch (e) {
      setError(
        e.message ||
          "Bet could not be placed."
      );
    } finally {
      setBusy(false);
    }
  }

  /* =========================================================
     PAYSTACK DEPOSIT
     ========================================================= */

  async function handleRealDeposit(e) {
    if (e) e.preventDefault();

    clearError();

    const amount = Number(
      depositAmount
    );

    if (!session?.user) {
      setError(
        "Please log in before making a deposit."
      );
      return;
    }

    if (!amount || amount <= 0) {
      setError(
        "Enter a valid deposit amount."
      );
      return;
    }

    if (amount < 1) {
      setError(
        "Minimum deposit is GHS 1.00."
      );
      return;
    }

    const userEmail =
      session.user.email;

    if (!userEmail) {
      setError(
        "Your account does not have an email address."
      );
      return;
    }

    setBusy(true);
    setError("");
    setMessage(
      "Starting Mobile Money payment..."
    );

    try {
      const callbackUrl =
        `${window.location.origin}${window.location.pathname}?payment=success`;

      const { data, error: e1 } =
        await supabase.functions.invoke(
          "initialize-payment",
          {
            body: {
              amount,
              email: userEmail,
              callback_url: callbackUrl,
            },
          }
        );

      if (e1) throw e1;

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Unable to start payment."
        );
      }

      if (!data?.authorization_url) {
        throw new Error(
          "Paystack did not return a payment link."
        );
      }

      if (data.reference) {
        sessionStorage.setItem(
          "pending_paystack_reference",
          data.reference
        );
      }

      window.location.href =
        data.authorization_url;
    } catch (e1) {
      console.error(
        "Deposit error:",
        e1
      );

      setError(
        e1?.message ||
          "Unable to start the deposit."
      );

      setMessage("");
      setBusy(false);
    }
  }

  /* =========================================================
     PAYSTACK VERIFY
     ========================================================= */

  async function verifyReturnedPayment() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const payment =
      params.get("payment");

    if (payment !== "success") {
      return;
    }

    const reference =
      params.get("reference") ||
      params.get("trxref") ||
      sessionStorage.getItem(
        "pending_paystack_reference"
      );

    if (!reference) {
      setError(
        "Payment returned successfully, but no payment reference was found."
      );
      return;
    }

    setBusy(true);
    setError("");
    setMessage(
      "Verifying your payment..."
    );

    try {
      const { data, error: e1 } =
        await supabase.functions.invoke(
          "verify-payment",
          {
            body: {
              reference,
            },
          }
        );

      if (e1) throw e1;

      if (!data?.success) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Payment could not be verified yet."
        );
      }

      sessionStorage.removeItem(
        "pending_paystack_reference"
      );

      await loadWallet();
      await loadUserData();

      setDepositAmount("");
      setPage("wallet");

      setMessage(
        data.message ||
          "Payment verified and wallet credited."
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    } catch (e1) {
      console.error(
        "Payment verification error:",
        e1
      );

      setError(
        e1?.message ||
          "Payment verification failed."
      );

      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  /* =========================================================
     WITHDRAWAL
     ========================================================= */

  async function requestWithdrawal(e) {
    e.preventDefault();

    clearError();

    const amount =
      Number(withdrawAmount);

    const phone =
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

    if (
      withdrawMethod !==
      "Mobile Money"
    ) {
      return setError(
        "Please use Mobile Money."
      );
    }

    if (!recipientName) {
      return setError(
        "Enter the name registered on the MoMo account."
      );
    }

    if (!/^0\d{9}$/.test(phone)) {
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
      const { data, error: e1 } =
        await supabase.rpc(
          "request_manual_withdrawal",
          {
            p_amount: amount,
            p_provider:
              withdrawProvider,
            p_account_name:
              recipientName,
            p_phone: phone,
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
        "Withdrawal request submitted. Your wallet balance has been held while the request is processed."
      );

      console.log(
        "Withdrawal:",
        data
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

  /* =========================================================
     MARKET GROUPS
     ========================================================= */

  const marketGroups = (odds) => {
    const groups = {};

    for (const o of odds || []) {
      const key =
        o.market || "Other";

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(o);
    }

    return groups;
  };

  /* =========================================================
     VIRTUAL GAME HELPERS
     ========================================================= */

  function randomChoice(items) {
    return items[
      Math.floor(
        Math.random() * items.length
      )
    ];
  }

  function virtualGameConfig(game) {
    const configs = {
      football: {
        choices: [
          "Home Win",
          "Draw",
          "Away Win",
        ],
        odds: {
          "Home Win": 2.0,
          Draw: 3.2,
          "Away Win": 2.6,
        },
      },

      basketball: {
        choices: [
          "Home Team",
          "Away Team",
        ],
        odds: {
          "Home Team": 1.75,
          "Away Team": 2.1,
        },
      },

      horses: {
        choices: [
          "Horse 1",
          "Horse 2",
          "Horse 3",
          "Horse 4",
        ],
        odds: {
          "Horse 1": 3.5,
          "Horse 2": 4.0,
          "Horse 3": 2.8,
          "Horse 4": 5.0,
        },
      },

      roulette: {
        choices: [
          "Red",
          "Black",
          "Green",
        ],
        odds: {
          Red: 2,
          Black: 2,
          Green: 14,
        },
      },

      darts: {
        choices: [
          "Player A",
          "Player B",
        ],
        odds: {
          "Player A": 1.85,
          "Player B": 1.95,
        },
      },

      racing: {
        choices: [
          "Car 1",
          "Car 2",
          "Car 3",
          "Car 4",
        ],
        odds: {
          "Car 1": 3,
          "Car 2": 2.5,
          "Car 3": 4,
          "Car 4": 3.5,
        },
      },

      boxing: {
        choices: [
          "Boxer A",
          "Boxer B",
        ],
        odds: {
          "Boxer A": 1.9,
          "Boxer B": 1.9,
        },
      },

      bowling: {
        choices: [
          "Bowler A",
          "Bowler B",
          "Bowler C",
        ],
        odds: {
          "Bowler A": 2.4,
          "Bowler B": 2.7,
          "Bowler C": 2.3,
        },
      },

      dice: {
        choices: [
          "High 4-6",
          "Low 1-3",
        ],
        odds: {
          "High 4-6": 1.9,
          "Low 1-3": 1.9,
        },
      },

      spin: {
        choices: [
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
        ],
        odds: {
          "1": 7,
          "2": 7,
          "3": 7,
          "4": 7,
          "5": 7,
          "6": 7,
          "7": 7,
          "8": 7,
        },
      },
    };

    return (
      configs[game] ||
      configs.football
    );
  }

  function getVirtualOutcome(game) {
    const outcomes = {
      football: [
        "Home Win",
        "Draw",
        "Away Win",
      ],

      basketball: [
        "Home Team",
        "Away Team",
      ],

      horses: [
        "Horse 1",
        "Horse 2",
        "Horse 3",
        "Horse 4",
      ],

      roulette: [
        "Red",
        "Black",
        "Green",
      ],

      darts: [
        "Player A",
        "Player B",
      ],

      racing: [
        "Car 1",
        "Car 2",
        "Car 3",
        "Car 4",
      ],

      boxing: [
        "Boxer A",
        "Boxer B",
      ],

      bowling: [
        "Bowler A",
        "Bowler B",
        "Bowler C",
      ],

      dice: [
        "High 4-6",
        "Low 1-3",
      ],

      spin: [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
      ],
    };

    return randomChoice(
      outcomes[game] ||
        outcomes.football
    );
  }

  /* =========================================================
     PLAY VIRTUAL GAME
     ========================================================= */

  function playVirtualGame() {
    clearError();

    const amount =
      Number(virtualStake);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Enter a valid Virtual Credits stake."
      );
      return;
    }

    if (
      amount > virtualCredits
    ) {
      setError(
        "You do not have enough Virtual Credits."
      );
      return;
    }

    if (!virtualChoice) {
      setError(
        "Choose an option first."
      );
      return;
    }

    if (virtualPlaying) {
      return;
    }

    setVirtualPlaying(true);
    setVirtualResult(null);

    setVirtualCredits(
      (old) => old - amount
    );

    const game =
      selectedVirtualGame;

    setTimeout(() => {
      const outcome =
        getVirtualOutcome(game);

      const config =
        virtualGameConfig(game);

      const won =
        outcome === virtualChoice;

      const selectedOdd =
        Number(
          config.odds[
            virtualChoice
          ] || 1
        );

      const payout = won
        ? amount * selectedOdd
        : 0;

      if (won) {
        setVirtualCredits(
          (old) => old + payout
        );
      }

      const result = {
        id:
          Date.now() +
          Math.random(),

        game,

        gameName:
          VIRTUAL_GAMES.find(
            (g) => g.id === game
          )?.name || game,

        choice: virtualChoice,

        outcome,

        stake: amount,

        odds: selectedOdd,

        payout,

        won,

        created_at:
          new Date().toISOString(),
      };

      setVirtualResult(result);

      setVirtualHistory(
        (old) => [
          result,
          ...old,
        ].slice(0, 50)
      );

      setVirtualPlaying(false);

      if (won) {
        flash(
          `You won ${virtualMoney(
            payout
          )}!`
        );
      } else {
        flash(
          `Result: ${outcome}`
        );
      }
    }, 1800);
  }

  /* =========================================================
     RESET VIRTUAL CREDITS
     ========================================================= */

  function resetVirtualCredits() {
    setVirtualCredits(1000);
    flash(
      "Virtual Credits reset to 1,000 VC."
    );
  }

  /* =========================================================
     LOGGED OUT AUTH SCREEN
     ========================================================= */

  if (!session) {
    return (
      <div style={styles.page}>
        <style>{globalCss}</style>

        <header style={styles.authHeader}>
          <div>
            <div style={styles.brand}>
              CLASSIC SPORTY HACKS
            </div>

            <div style={styles.headerSmall}>
              Football • Games • Match Centre
            </div>
          </div>
        </header>

        <main style={styles.authWrap}>
          <div style={styles.authCard}>
            <div style={styles.logoCircle}>
              ⚽
            </div>

            <div style={styles.authBadge}>
              CLASSIC SPORTY HACKS
            </div>

            <h1 style={styles.authTitle}>
              {authMode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h1>

            <p style={styles.muted}>
              {authMode === "login"
                ? "Log in to access matches, your wallet and Virtual Games."
                : "Create your account and start using Classic Sporty Hacks."}
            </p>

            {error && (
              <div style={styles.error}>
                {error}
              </div>
            )}

            {message && (
              <div style={styles.success}>
                {message}
              </div>
            )}

            <form onSubmit={handleAuth}>
              {authMode ===
                "signup" && (
                <input
                  style={styles.input}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value
                    )
                  }
                />
              )}

              <input
                style={styles.input}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
              />

              <input
                style={styles.input}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
              />

              <button
                style={
                  styles.primary
                }
                disabled={busy}
              >
                {busy
                  ? "Please wait..."
                  : authMode ===
                    "login"
                  ? "Login"
                  : "Sign Up"}
              </button>
            </form>

            <button
              style={
                styles.linkButton
              }
              onClick={() => {
                clearError();

                setAuthMode(
                  authMode ===
                    "login"
                    ? "signup"
                    : "login"
                );
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

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div style={styles.loading}>
        <style>{globalCss}</style>

        <div style={styles.loadingBox}>
          <div style={styles.loadingBall}>
            ⚽
          </div>

          <h2>
            Classic Sporty Hacks
          </h2>

          <p>
            Loading your account...
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     MAIN DASHBOARD
     ========================================================= */

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      {/* HEADER */}

      <header style={styles.header}>
        <div style={styles.headerBrandWrap}>
          <div style={styles.headerLogo}>
            ⚽
          </div>

          <div>
            <div style={styles.brand}>
              CLASSIC SPORTY HACKS
            </div>

            <div style={styles.headerSmall}>
              {profile?.full_name ||
                session.user.email}
            </div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.headerBalance}>
            <span>
              Wallet
            </span>

            <strong>
              {money(
                wallet?.balance
              )}
            </strong>
          </div>

          <button
            style={styles.logout}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* NAVIGATION */}

      <nav style={styles.nav}>
        {[
          [
            "home",
            "⚽",
            "Matches",
          ],
          [
            "bets",
            "🎟️",
            "My Bets",
          ],
          [
            "virtual",
            "🎮",
            "Virtual Games",
          ],
          [
            "wallet",
            "💰",
            "Wallet",
          ],
          [
            "transactions",
            "📋",
            "Transactions",
          ],
          ...(isAdmin
            ? [
                [
                  "admin",
                  "🛠️",
                  "Admin",
                ],
              ]
            : []),
        ].map(
          ([key, icon, label]) => (
            <button
              key={key}
              onClick={() =>
                setPage(key)
              }
              style={
                page === key
                  ? styles.navActive
                  : styles.navBtn
              }
            >
              <span
                style={
                  styles.navIcon
                }
              >
                {icon}
              </span>

              {label}
            </button>
          )
        )}
      </nav>

      {/* MAIN */}

      <main style={styles.container}>
        {message && (
          <div style={styles.success}>
            {message}
          </div>
        )}

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {/* =================================================
            MATCHES
            ================================================= */}

        {page === "home" && (
          <>
            <section
              style={styles.hero}
            >
              <div>
                <div
                  style={
                    styles.heroTag
                  }
                >
                  LIVE MATCH CENTRE
                </div>

                <h1
                  style={
                    styles.heroTitle
                  }
                >
                  Football Matches
                </h1>

                <p
                  style={
                    styles.heroText
                  }
                >
                  Choose your selections
                  and add them to your
                  bet slip.
                </p>
              </div>

              <div
                style={
                  styles.balanceMini
                }
              >
                <span>
                  Available Balance
                </span>

                <strong>
                  {money(
                    wallet?.balance
                  )}
                </strong>
              </div>
            </section>

            <div
              style={styles.layout}
            >
              <section>
                {matches.length ===
                0 ? (
                  <div
                    style={
                      styles.card
                    }
                  >
                    <div
                      style={
                        styles.emptyIcon
                      }
                    >
                      ⚽
                    </div>

                    <h3>
                      No active matches
                    </h3>

                    <p
                      style={
                        styles.muted
                      }
                    >
                      No active matches
                      are available yet.
                    </p>
                  </div>
                ) : (
                  matches.map(
                    (match) => {
                      const groups =
                        marketGroups(
                          match.match_odds
                        );

                      return (
                        <div
                          style={
                            styles.matchCard
                          }
                          key={
                            match.id
                          }
                        >
                          <div
                            style={
                              styles.matchTop
                            }
                          >
                            <span>
                              {
                                fmtDate(
                                  match.start_time
                                )
                              }
                            </span>

                            <span
                              style={
                                styles.liveBadge
                              }
                            >
                              {match.status ||
                                "Scheduled"}
                            </span>
                          </div>

                          <div
                            style={
                              styles.teams
                            }
                          >
                            <div
                              style={
                                styles.team
                              }
                            >
                              <div
                                style={
                                  styles.teamBall
                                }
                              >
                                ⚽
                              </div>

                              <strong>
                                {
                                  match.home_team
                                }
                              </strong>
                            </div>

                            <div
                              style={
                                styles.vs
                              }
                            >
                              VS
                            </div>

                            <div
                              style={
                                styles.team
                              }
                            >
                              <div
                                style={
                                  styles.teamBall
                                }
                              >
                                ⚽
                              </div>

                              <strong>
                                {
                                  match.away_team
                                }
                              </strong>
                            </div>
                          </div>

                          {Object.keys(
                            groups
                          ).length ===
                          0 ? (
                            <div
                              style={
                                styles.noOdds
                              }
                            >
                              Odds not
                              available.
                            </div>
                          ) : (
                            Object.entries(
                              groups
                            ).map(
                              ([
                                market,
                                odds,
                              ]) => (
                                <div
                                  key={
                                    market
                                  }
                                  style={
                                    styles.market
                                  }
                                >
                                  <div
                                    style={
                                      styles.marketTitle
                                    }
                                  >
                                    {
                                      market
                                    }
                                  </div>

                                  <div
                                    style={
                                      styles.oddsGrid
                                    }
                                  >
                                    {odds.map(
                                      (
                                        odd
                                      ) => (
                                        <button
                                          key={
                                            odd.id
                                          }
                                          style={
                                            styles.oddBtn
                                          }
                                          onClick={() =>
                                            addToSlip(
                                              match,
                                              odd
                                            )
                                          }
                                        >
                                          <span>
                                            {
                                              odd.selection
                                            }
                                          </span>

                                          <b>
                                            {Number(
                                              odd.odd
                                            ).toFixed(
                                              2
                                            )}
                                          </b>
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              )
                            )
                          )}
                        </div>
                      );
                    }
                  )
                )}
              </section>

              {/* BET SLIP */}

              <aside
                style={styles.slip}
              >
                <div
                  style={
                    styles.slipHeader
                  }
                >
                  <div>
                    <strong>
                      Bet Slip
                    </strong>

                    <div
                      style={
                        styles.small
                      }
                    >
                      Your selections
                    </div>
                  </div>

                  <span
                    style={
                      styles.slipCount
                    }
                  >
                    {betSlip.length}
                  </span>
                </div>

                {betSlip.length ===
                0 ? (
                  <div
                    style={
                      styles.slipEmpty
                    }
                  >
                    <div
                      style={
                        styles.emptyIcon
                      }
                    >
                      🎟️
                    </div>

                    <p>
                      Select an odd from
                      the matches to add
                      it here.
                    </p>
                  </div>
                ) : (
                  <>
                    {betSlip.map(
                      (item) => (
                        <div
                          key={`${item.matchId}-${item.market}`}
                          style={
                            styles.slipItem
                          }
                        >
                          <div>
                            <strong>
                              {
                                item.homeTeam
                              }{" "}
                              vs{" "}
                              {
                                item.awayTeam
                              }
                            </strong>

                            <div
                              style={
                                styles.small
                              }
                            >
                              {
                                item.market
                              }{" "}
                              ·{" "}
                              {
                                item.selection
                              }{" "}
                              ·{" "}
                              {item.odd.toFixed(
                                2
                              )}
                            </div>
                          </div>

                          <button
                            style={
                              styles.remove
                            }
                            onClick={() =>
                              removeFromSlip(
                                item.matchId,
                                item.market
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}

                    <div
                      style={
                        styles.summary
                      }
                    >
                      <span>
                        Combined odds
                      </span>

                      <strong>
                        {combinedOdds.toFixed(
                          2
                        )}
                      </strong>
                    </div>

                    <div
                      style={
                        styles.summary
                      }
                    >
                      <span>
                        Potential win
                      </span>

                      <strong
                        style={
                          styles.greenText
                        }
                      >
                        {money(
                          potentialWin
                        )}
                      </strong>
                    </div>

                    <input
                      style={
                        styles.input
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Stake (GHS)"
                      value={stake}
                      onChange={(e) =>
                        setStake(
                          e.target.value
                        )
                      }
                    />

                    <button
                      style={
                        styles.primary
                      }
                      onClick={
                        placeBet
                      }
                      disabled={busy}
                    >
                      {busy
                        ? "Processing..."
                        : "Place Bet"}
                    </button>
                  </>
                )}
              </aside>
            </div>
          </>
        )}

        {/* =================================================
            MY BETS
            ================================================= */}

        {page === "bets" && (
          <section>
            <section
              style={styles.sectionHero}
            >
              <div>
                <div
                  style={
                    styles.heroTag
                  }
                >
                  ACCOUNT
                </div>

                <h1>
                  My Bets
                </h1>

                <p>
                  View your recent
                  betting activity.
                </p>
              </div>

              <div
                style={
                  styles.bigIcon
                }
              >
                🎟️
              </div>
            </section>

            {bets.length === 0 ? (
              <div
                style={styles.card}
              >
                <div
                  style={
                    styles.emptyIcon
                  }
                >
                  🎟️
                </div>

                <h3>
                  No bets yet
                </h3>

                <p
                  style={
                    styles.muted
                  }
                >
                  Your placed bets will
                  appear here.
                </p>
              </div>
            ) : (
              bets.map((bet) => (
                <div
                  style={
                    styles.card
                  }
                  key={bet.id}
                >
                  <div
                    style={
                      styles.row
                    }
                  >
                    <strong>
                      Bet #
                      {String(
                        bet.id
                      ).slice(
                        0,
                        8
                      )}
                    </strong>

                    <span
                      style={
                        styles.badge
                      }
                    >
                      {
                        bet.status ||
                        "pending"
                      }
                    </span>
                  </div>

                  <div
                    style={
                      styles.summary
                    }
                  >
                    <span>
                      Stake
                    </span>

                    <strong>
                      {money(
                        bet.stake
                      )}
                    </strong>
                  </div>

                  <div
                    style={
                      styles.summary
                    }
                  >
                    <span>
                      Combined odds
                    </span>

                    <strong>
                      {Number(
                        bet.combined_odds ||
                          0
                      ).toFixed(
                        2
                      )}
                    </strong>
                  </div>

                  <div
                    style={
                      styles.summary
                    }
                  >
                    <span>
                      Potential win
                    </span>

                    <strong>
                      {money(
                        bet.potential_win
                      )}
                    </strong>
                  </div>

                  <div
                    style={
                      styles.small
                    }
                  >
                    {fmtDate(
                      bet.created_at
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* =================================================
            VIRTUAL GAMES
            ================================================= */}

        {page === "virtual" && (
          <VirtualGames
            virtualCredits={
              virtualCredits
            }
            virtualHistory={
              virtualHistory
            }
            selectedVirtualGame={
              selectedVirtualGame
            }
            setSelectedVirtualGame={
              setSelectedVirtualGame
            }
            virtualStake={
              virtualStake
            }
            setVirtualStake={
              setVirtualStake
            }
            virtualChoice={
              virtualChoice
            }
            setVirtualChoice={
              setVirtualChoice
            }
            virtualResult={
              virtualResult
            }
            virtualPlaying={
              virtualPlaying
            }
            playVirtualGame={
              playVirtualGame
            }
            resetVirtualCredits={
              resetVirtualCredits
            }
          />
        )}

        {/* =================================================
            WALLET
            ================================================= */}

        {page === "wallet" && (
          <section>
            <div
              style={
                styles.walletHero
              }
            >
              <div
                style={
                  styles.walletIcon
                }
              >
                💰
              </div>

              <span>
                Available balance
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

            <div
              style={
                styles.twoCol
              }
            >
              <form
                style={styles.card}
                onSubmit={
                  handleRealDeposit
                }
              >
                <div
                  style={
                    styles.cardIcon
                  }
                >
                  📲
                </div>

                <h3>
                  Deposit via Mobile
                  Money
                </h3>

                <p
                  style={
                    styles.muted
                  }
                >
                  Enter the amount and
                  continue to secure
                  Paystack checkout.
                  Your wallet is
                  credited after the
                  payment is verified.
                </p>

                <input
                  style={
                    styles.input
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount (GHS)"
                  value={
                    depositAmount
                  }
                  onChange={(e) =>
                    setDepositAmount(
                      e.target.value
                    )
                  }
                />

                <button
                  style={
                    styles.primary
                  }
                  disabled={busy}
                >
                  {busy
                    ? "Processing..."
                    : "Deposit with Mobile Money"}
                </button>
              </form>

              <form
                style={styles.card}
                onSubmit={
                  requestWithdrawal
                }
              >
                <div
                  style={
                    styles.cardIcon
                  }
                >
                  💸
                </div>

                <h3>
                  Withdraw to Mobile
                  Money
                </h3>

                <p
                  style={
                    styles.muted
                  }
                >
                  Submit a withdrawal
                  request to your Ghana
                  MoMo number.
                </p>

                <input
                  style={
                    styles.input
                  }
                  type="number"
                  min="10"
                  step="0.01"
                  placeholder="Amount (GHS)"
                  value={
                    withdrawAmount
                  }
                  onChange={(e) =>
                    setWithdrawAmount(
                      e.target.value
                    )
                  }
                />

                <select
                  style={
                    styles.input
                  }
                  value={
                    withdrawMethod
                  }
                  onChange={(e) =>
                    setWithdrawMethod(
                      e.target.value
                    )
                  }
                >
                  <option>
                    Mobile Money
                  </option>
                </select>

                <select
                  style={
                    styles.input
                  }
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

                <input
                  style={
                    styles.input
                  }
                  placeholder="MoMo account name"
                  value={
                    withdrawName
                  }
                  onChange={(e) =>
                    setWithdrawName(
                      e.target.value
                    )
                  }
                />

                <input
                  style={
                    styles.input
                  }
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="MoMo number e.g. 0551234567"
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
                        .slice(
                          0,
                          10
                        )
                    )
                  }
                />

                <button
                  style={
                    styles.primary
                  }
                  disabled={busy}
                >
                  {busy
                    ? "Processing..."
                    : "Withdraw to Mobile Money"}
                </button>

                <div
                  style={
                    styles.small
                  }
                >
                  Minimum withdrawal:
                  GHS 10.00. Requests
                  are processed
                  manually.
                </div>

                {manualWithdrawals.length >
                  0 && (
                  <div
                    style={{
                      marginTop: 14,
                    }}
                  >
                    <strong>
                      Recent withdrawal
                      requests
                    </strong>

                    {manualWithdrawals
                      .slice(0, 5)
                      .map((w) => (
                        <div
                          key={w.id}
                          style={{
                            ...styles.card,
                            marginTop: 8,
                            padding: 12,
                          }}
                        >
                          <div
                            style={
                              styles.row
                            }
                          >
                            <span>
                              {money(
                                w.amount
                              )}
                            </span>

                            <strong>
                              {String(
                                w.status ||
                                  "pending"
                              ).toUpperCase()}
                            </strong>
                          </div>

                          <div
                            style={
                              styles.small
                            }
                          >
                            {
                              w.provider
                            }{" "}
                            •{" "}
                            {w.phone}
                          </div>

                          <div
                            style={
                              styles.small
                            }
                          >
                            {fmtDate(
                              w.created_at
                            )}
                          </div>

                          {w.admin_note && (
                            <div
                              style={
                                styles.small
                              }
                            >
                              {
                                w.admin_note
                              }
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </form>
            </div>
          </section>
        )}

        {/* =================================================
            TRANSACTIONS
            ================================================= */}

        {page ===
          "transactions" && (
          <section>
            <section
              style={
                styles.sectionHero
              }
            >
              <div>
                <div
                  style={
                    styles.heroTag
                  }
                >
                  WALLET ACTIVITY
                </div>

                <h1>
                  Transactions
                </h1>

                <p>
                  Review your wallet
                  transaction history.
                </p>
              </div>

              <div
                style={
                  styles.bigIcon
                }
              >
                📋
              </div>
            </section>

            {transactions.length ===
            0 ? (
              <div
                style={styles.card}
              >
                <div
                  style={
                    styles.emptyIcon
                  }
                >
                  📋
                </div>

                <h3>
                  No transactions yet
                </h3>

                <p
                  style={
                    styles.muted
                  }
                >
                  Your wallet activity
                  will appear here.
                </p>
              </div>
            ) : (
              transactions.map(
                (tx) => (
                  <div
                    style={
                      styles.card
                    }
                    key={tx.id}
                  >
                    <div
                      style={
                        styles.row
                      }
                    >
                      <strong>
                        {tx.type ||
                          "Transaction"}
                      </strong>

                      <strong
                        style={
                          styles.greenText
                        }
                      >
                        {money(
                          tx.amount
                        )}
                      </strong>
                    </div>

                    <div
                      style={
                        styles.small
                      }
                    >
                      {tx.description ||
                        ""}
                    </div>

                    <div
                      style={
                        styles.small
                      }
                    >
                      {fmtDate(
                        tx.created_at
                      )}
                    </div>
                  </div>
                )
              )
            )}
          </section>
        )}

        {/* =================================================
            ADMIN
            ================================================= */}

        {page === "admin" &&
          isAdmin && (
            <AdminPanel
              onRefresh={
                loadAll
              }
            />
          )}
      </main>
    </div>
  );
}

/* =========================================================
   VIRTUAL GAMES COMPONENT
   ========================================================= */

function VirtualGames({
  virtualCredits,
  virtualHistory,
  selectedVirtualGame,
  setSelectedVirtualGame,
  virtualStake,
  setVirtualStake,
  virtualChoice,
  setVirtualChoice,
  virtualResult,
  virtualPlaying,
  playVirtualGame,
  resetVirtualCredits,
}) {
  const game =
    VIRTUAL_GAMES.find(
      (g) =>
        g.id ===
        selectedVirtualGame
    ) ||
    VIRTUAL_GAMES[0];

  const config = {
    football: {
      choices: [
        "Home Win",
        "Draw",
        "Away Win",
      ],
      odds: {
        "Home Win": 2,
        Draw: 3.2,
        "Away Win": 2.6,
      },
    },

    basketball: {
      choices: [
        "Home Team",
        "Away Team",
      ],
      odds: {
        "Home Team": 1.75,
        "Away Team": 2.1,
      },
    },

    horses: {
      choices: [
        "Horse 1",
        "Horse 2",
        "Horse 3",
        "Horse 4",
      ],
      odds: {
        "Horse 1": 3.5,
        "Horse 2": 4,
        "Horse 3": 2.8,
        "Horse 4": 5,
      },
    },

    roulette: {
      choices: [
        "Red",
        "Black",
        "Green",
      ],
      odds: {
        Red: 2,
        Black: 2,
        Green: 14,
      },
    },

    darts: {
      choices: [
        "Player A",
        "Player B",
      ],
      odds: {
        "Player A": 1.85,
        "Player B": 1.95,
      },
    },

    racing: {
      choices: [
        "Car 1",
        "Car 2",
        "Car 3",
        "Car 4",
      ],
      odds: {
        "Car 1": 3,
        "Car 2": 2.5,
        "Car 3": 4,
        "Car 4": 3.5,
      },
    },

    boxing: {
      choices: [
        "Boxer A",
        "Boxer B",
      ],
      odds: {
        "Boxer A": 1.9,
        "Boxer B": 1.9,
      },
    },

    bowling: {
      choices: [
        "Bowler A",
        "Bowler B",
        "Bowler C",
      ],
      odds: {
        "Bowler A": 2.4,
        "Bowler B": 2.7,
        "Bowler C": 2.3,
      },
    },

    dice: {
      choices: [
        "High 4-6",
        "Low 1-3",
      ],
      odds: {
        "High 4-6": 1.9,
        "Low 1-3": 1.9,
      },
    },

    spin: {
      choices: [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
      ],
      odds: {
        "1": 7,
        "2": 7,
        "3": 7,
        "4": 7,
        "5": 7,
        "6": 7,
        "7": 7,
        "8": 7,
      },
    },
  }[selectedVirtualGame];

  return (
    <section>
      {/* VIRTUAL HERO */}

      <section
        style={
          styles.virtualHero
        }
      >
        <div>
          <div
            style={
              styles.heroTag
            }
          >
            🎮 VIRTUAL GAMES
          </div>

          <h1
            style={
              styles.virtualTitle
            }
          >
            Play Virtual Games
          </h1>

          <p
            style={
              styles.heroText
            }
          >
            Choose a game, select your
            option and play using
            Virtual Credits.
          </p>
        </div>

        <div
          style={
            styles.virtualBalance
          }
        >
          <span>
            Virtual Credits
          </span>

          <strong>
            {virtualMoney(
              virtualCredits
            )}
          </strong>

          <button
            style={
              styles.resetVirtual
            }
            onClick={
              resetVirtualCredits
            }
          >
            Reset Credits
          </button>
        </div>
      </section>

      {/* GAME SELECTOR */}

      <div
        style={
          styles.gameGrid
        }
      >
        {VIRTUAL_GAMES.map(
          (g) => (
            <button
              key={g.id}
              onClick={() => {
                setSelectedVirtualGame(
                  g.id
                );
                setVirtualResult(
                  null
                );
                setVirtualChoice(
                  ""
                );
              }}
              style={{
                ...styles.gameCard,
                ...(selectedVirtualGame ===
                g.id
                  ? {
                      borderColor:
                        g.color,
                      boxShadow: `0 8px 25px ${g.color}22`,
                      transform:
                        "translateY(-3px)",
                    }
                  : {}),
              }}
            >
              <div
                style={{
                  ...styles.gameIcon,
                  background: `${g.color}15`,
                }}
              >
                {g.icon}
              </div>

              <strong>
                {g.name}
              </strong>

              <span
                style={
                  styles.gameDescription
                }
              >
                {g.description}
              </span>
            </button>
          )
        )}
      </div>

      {/* SELECTED GAME */}

      <div
        style={
          styles.virtualLayout
        }
      >
        <div
          style={
            styles.virtualPlayCard
          }
        >
          <div
            style={
              styles.selectedGameHeader
            }
          >
            <div
              style={{
                ...styles.selectedGameIcon,
                background: `${game.color}15`,
              }}
            >
              {game.icon}
            </div>

            <div>
              <div
                style={
                  styles.heroTag
                }
              >
                VIRTUAL GAME
              </div>

              <h2
                style={{
                  margin:
                    "4px 0",
                }}
              >
                {game.name}
              </h2>

              <p
                style={
                  styles.muted
                }
              >
                {game.description}
              </p>
            </div>
          </div>

          {/* VIRTUAL MATCH VISUAL */}

          <div
            style={
              styles.virtualArena
            }
          >
            <div
              style={
                styles.arenaGlow
              }
            />

            <div
              style={
                styles.arenaIcon
              }
            >
              {game.icon}
            </div>

            <strong>
              {virtualPlaying
                ? "GAME IN PROGRESS..."
                : virtualResult
                ? "RESULT READY"
                : "READY TO PLAY"}
            </strong>

            <span
              style={
                styles.small
              }
            >
              Virtual Credits only
            </span>
          </div>

          {/* CHOICES */}

          <h3>
            Choose your selection
          </h3>

          <div
            style={
              styles.virtualChoices
            }
          >
            {config.choices.map(
              (choice) => {
                const odd =
                  config.odds[
                    choice
                  ];

                const selected =
                  virtualChoice ===
                  choice;

                return (
                  <button
                    key={
                      choice
                    }
                    onClick={() =>
                      setVirtualChoice(
                        choice
                      )
                    }
                    style={{
                      ...styles.virtualChoice,
                      ...(selected
                        ? styles.virtualChoiceActive
                        : {}),
                    }}
                  >
                    <span>
                      {choice}
                    </span>

                    <strong>
                      {Number(
                        odd
                      ).toFixed(
                        2
                      )}
                    </strong>
                  </button>
                );
              }
            )}
          </div>

          {/* STAKE */}

          <div
            style={
              styles.stakeBox
            }
          >
            <div>
              <label
                style={
                  styles.inputLabel
                }
              >
                Virtual Credits
                Stake
              </label>

              <input
                style={
                  styles.input
                }
                type="number"
                min="1"
                step="1"
                value={
                  virtualStake
                }
                onChange={(e) =>
                  setVirtualStake(
                    Number(
                      e.target
                        .value
                    )
                  )
                }
              />
            </div>

            <div
              style={
                styles.quickStakes
              }
            >
              {[10, 20, 50, 100].map(
                (amount) => (
                  <button
                    key={
                      amount
                    }
                    style={
                      styles.quickStake
                    }
                    onClick={() =>
                      setVirtualStake(
                        amount
                      )
                    }
                  >
                    {amount}
                  </button>
                )
              )}
            </div>
          </div>

          <button
            style={{
              ...styles.virtualPlayButton,
              opacity:
                virtualPlaying
                  ? 0.7
                  : 1,
            }}
            onClick={
              playVirtualGame
            }
            disabled={
              virtualPlaying
            }
          >
            {virtualPlaying
              ? "🎮 Playing..."
              : `${game.icon} Play ${game.name}`}
          </button>

          {/* RESULT */}

          {virtualResult && (
            <div
              style={{
                ...styles.resultBox,
                ...(virtualResult.won
                  ? styles.resultWin
                  : styles.resultLose),
              }}
            >
              <div
                style={
                  styles.resultIcon
                }
              >
                {virtualResult.won
                  ? "🏆"
                  : "🎮"}
              </div>

              <div>
                <strong>
                  {virtualResult.won
                    ? "YOU WON!"
                    : "RESULT"}
                </strong>

                <p>
                  Result:{" "}
                  <b>
                    {
                      virtualResult.outcome
                    }
                  </b>
                </p>

                <p>
                  Your selection:{" "}
                  <b>
                    {
                      virtualResult.choice
                    }
                  </b>
                </p>

                {virtualResult.won && (
                  <p>
                    Payout:{" "}
                    <b>
                      {virtualMoney(
                        virtualResult.payout
                      )}
                    </b>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* HISTORY */}

        <aside
          style={
            styles.virtualHistoryCard
          }
        >
          <div
            style={
              styles.historyHeader
            }
          >
            <div>
              <strong>
                Recent Games
              </strong>

              <div
                style={
                  styles.small
                }
              >
                Your Virtual Games
              </div>
            </div>

            <span
              style={
                styles.historyCount
              }
            >
              {virtualHistory.length}
            </span>
          </div>

          {virtualHistory.length ===
          0 ? (
            <div
              style={
                styles.historyEmpty
              }
            >
              <div
                style={
                  styles.emptyIcon
                }
              >
                🎮
              </div>

              <p>
                Your virtual game
                results will appear
                here.
              </p>
            </div>
          ) : (
            virtualHistory
              .slice(0, 12)
              .map((item) => (
                <div
                  key={item.id}
                  style={
                    styles.historyItem
                  }
                >
                  <div
                    style={
                      styles.historyGameIcon
                    }
                  >
                    {VIRTUAL_GAMES.find(
                      (g) =>
                        g.id ===
                        item.game
                    )?.icon ||
                      "🎮"}
                  </div>

                  <div
                    style={
                      styles.historyMiddle
                    }
                  >
                    <strong>
                      {
                        item.gameName
                      }
                    </strong>

                    <span>
                      {
                        item.choice
                      }{" "}
                      →{" "}
                      {
                        item.outcome
                      }
                    </span>
                  </div>

                  <strong
                    style={{
                      color:
                        item.won
                          ? "#08783f"
                          : "#c62828",
                    }}
                  >
                    {item.won
                      ? `+${virtualMoney(
                          item.payout
                        )}`
                      : `-${virtualMoney(
                          item.stake
                        )}`}
                  </strong>
                </div>
              ))
          )}
        </aside>
      </div>
    </section>
  );
}

/* =========================================================
   ADMIN PANEL
   ========================================================= */

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

    if (
      u.error ||
      b.error ||
      t.error ||
      w.error
    ) {
      setError(
        (
          u.error ||
          b.error ||
          t.error ||
          w.error
        )?.message ||
          "Admin data could not be loaded."
      );

      return;
    }

    setUsers(u.data || []);
    setAdminBets(
      b.data || []
    );
    setAdminTransactions(
      t.data || []
    );
    setManualWithdrawals(
      w.data || []
    );
  }

  async function adjustWallet(
    direction
  ) {
    const value =
      Number(amount);

    if (
      !userId ||
      !value ||
      value <= 0
    ) {
      setError(
        "Choose a user and enter a valid amount."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const fn =
        direction ===
        "credit"
          ? "admin_credit_wallet"
          : "admin_debit_wallet";

      const {
        error: e,
      } = await supabase.rpc(
        fn,
        {
          p_user_id:
            userId,
          p_amount:
            value,
          p_description:
            `Admin ${direction}`,
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
          p_result:
            result,
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
          p_request_id:
            id,
          p_action:
            action,
          p_note:
            withdrawalNote.trim() ||
            null,
        }
      );

      if (e) throw e;

      setWithdrawalNote("");

      setMsg(
        action ===
          "paid"
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
    <section>
      <section
        style={
          styles.sectionHero
        }
      >
        <div>
          <div
            style={
              styles.heroTag
            }
          >
            ADMINISTRATION
          </div>

          <h1>
            Admin Dashboard
          </h1>

          <p>
            Manage users, wallets,
            bets and withdrawals.
          </p>
        </div>

        <div
          style={
            styles.bigIcon
          }
        >
          🛠️
        </div>
      </section>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {msg && (
        <div
          style={
            styles.success
          }
        >
          {msg}
        </div>
      )}

      {/* WITHDRAWALS */}

      <div
        style={styles.card}
      >
        <div
          style={
            styles.cardHeading
          }
        >
          <div>
            <h3>
              Manual Withdrawal
              Requests
            </h3>

            <p
              style={
                styles.muted
              }
            >
              Send the MoMo payment
              manually, then mark
              the request as paid.
            </p>
          </div>

          <span
            style={
              styles.cardHeadingIcon
            }
          >
            💸
          </span>
        </div>

        <input
          style={
            styles.input
          }
          placeholder="Optional admin note"
          value={
            withdrawalNote
          }
          onChange={(e) =>
            setWithdrawalNote(
              e.target.value
            )
          }
        />

        {manualWithdrawals.length ===
        0 ? (
          <div
            style={
              styles.small
            }
          >
            No withdrawal requests.
          </div>
        ) : (
          manualWithdrawals.map(
            (w) => (
              <div
                key={w.id}
                style={{
                  ...styles.card,
                  marginTop: 10,
                }}
              >
                <div
                  style={
                    styles.row
                  }
                >
                  <strong>
                    {money(
                      w.amount
                    )}
                  </strong>

                  <strong>
                    {String(
                      w.status
                    ).toUpperCase()}
                  </strong>
                </div>

                <div
                  style={
                    styles.small
                  }
                >
                  {w.user_name ||
                    w.user_email ||
                    w.user_id}
                </div>

                <div
                  style={
                    styles.small
                  }
                >
                  {w.provider} •{" "}
                  {
                    w.account_name
                  }{" "}
                  • {w.phone}
                </div>

                <div
                  style={
                    styles.small
                  }
                >
                  {fmtDate(
                    w.created_at
                  )}
                </div>

                {w.status ===
                  "pending" && (
                  <div
                    style={
                      styles.buttonRow
                    }
                  >
                    <button
                      style={
                        styles.primary
                      }
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
                      style={
                        styles.secondary
                      }
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
                  </div>
                )}

                {w.admin_note && (
                  <div
                    style={
                      styles.small
                    }
                  >
                    Note:{" "}
                    {
                      w.admin_note
                    }
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>

      {/* ADMIN CONTROLS */}

      <div
        style={styles.twoCol}
      >
        <div
          style={styles.card}
        >
          <div
            style={
              styles.cardHeading
            }
          >
            <h3>
              Wallet Adjustment
            </h3>

            <span
              style={
                styles.cardHeadingIcon
              }
            >
              💰
            </span>
          </div>

          <select
            style={
              styles.input
            }
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
            style={
              styles.input
            }
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

          <div
            style={
              styles.buttonRow
            }
          >
            <button
              style={
                styles.primary
              }
              disabled={busy}
              onClick={() =>
                adjustWallet(
                  "credit"
                )
              }
            >
              Credit
            </button>

            <button
              style={
                styles.secondary
              }
              disabled={busy}
              onClick={() =>
                adjustWallet(
                  "debit"
                )
              }
            >
              Debit
            </button>
          </div>
        </div>

        <div
          style={styles.card}
        >
          <div
            style={
              styles.cardHeading
            }
          >
            <h3>
              Settle Bet
            </h3>

            <span
              style={
                styles.cardHeadingIcon
              }
            >
              🎟️
            </span>
          </div>

          <input
            style={
              styles.input
            }
            placeholder="Bet UUID"
            value={
              settleBetId
            }
            onChange={(e) =>
              setSettleBetId(
                e.target.value
              )
            }
          />

          <select
            style={
              styles.input
            }
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
            style={
              styles.primary
            }
            disabled={busy}
            onClick={settle}
          >
            Settle Bet
          </button>
        </div>
      </div>

      {/* USERS */}

      <div
        style={styles.card}
      >
        <div
          style={
            styles.cardHeading
          }
        >
          <h3>
            Users
          </h3>

          <span
            style={
              styles.statNumber
            }
          >
            {users.length}
          </span>
        </div>

        {users.length ===
        0 ? (
          <p
            style={
              styles.muted
            }
          >
            No users returned.
          </p>
        ) : (
          users.map((u) => (
            <div
              style={
                styles.row
              }
              key={u.id}
            >
              <span>
                <strong>
                  {u.full_name ||
                    "Unnamed"}
                </strong>

                <br />

                <span
                  style={
                    styles.small
                  }
                >
                  {u.email}
                </span>
              </span>

              <span
                style={
                  styles.badge
                }
              >
                {u.role}
              </span>
            </div>
          ))
        )}
      </div>

      {/* BETS */}

      <div
        style={styles.card}
      >
        <div
          style={
            styles.cardHeading
          }
        >
          <h3>
            Recent Bets
          </h3>

          <span
            style={
              styles.cardHeadingIcon
            }
          >
            🎟️
          </span>
        </div>

        {adminBets
          .slice(0, 20)
          .map((b) => (
            <div
              style={
                styles.row
              }
              key={b.id}
            >
              <span>
                #
                {String(
                  b.id
                ).slice(0, 8)}
              </span>

              <span>
                {b.status}
              </span>

              <strong>
                {money(
                  b.stake
                )}
              </strong>
            </div>
          ))}
      </div>

      {/* TRANSACTIONS */}

      <div
        style={styles.card}
      >
        <div
          style={
            styles.cardHeading
          }
        >
          <h3>
            Recent Transactions
          </h3>

          <span
            style={
              styles.cardHeadingIcon
            }
          >
            📋
          </span>
        </div>

        {adminTransactions
          .slice(0, 20)
          .map((t) => (
            <div
              style={
                styles.row
              }
              key={t.id}
            >
              <span>
                {t.type}
              </span>

              <strong>
                {money(
                  t.amount
                )}
              </strong>

              <span
                style={
                  styles.small
                }
              >
                {fmtDate(
                  t.created_at
                )}
              </span>
            </div>
          ))}
      </div>
    </section>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg,#f6fbf8 0%,#eef5f1 100%)",
    color: "#17221c",
    fontFamily:
      "Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  },

  header: {
    background:
      "linear-gradient(135deg,#08783f,#0aa95b)",
    color: "white",
    padding: "15px 5%",
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 15,
    boxShadow:
      "0 4px 18px rgba(8,120,63,.18)",
  },

  authHeader: {
    background:
      "linear-gradient(135deg,#08783f,#0aa95b)",
    color: "white",
    padding: "18px 5%",
    boxShadow:
      "0 4px 18px rgba(8,120,63,.18)",
  },

  headerBrandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 11,
  },

  headerLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background:
      "rgba(255,255,255,.16)",
    display: "grid",
    placeItems: "center",
    fontSize: 23,
  },

  brand: {
    fontWeight: 950,
    fontSize: 19,
    letterSpacing: 0.5,
  },

  headerSmall: {
    opacity: 0.88,
    fontSize: 12,
    marginTop: 3,
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  headerBalance: {
    background:
      "rgba(255,255,255,.13)",
    borderRadius: 11,
    padding: "7px 13px",
    display: "grid",
    gap: 1,
  },

  logout: {
    border:
      "1px solid rgba(255,255,255,.55)",
    background:
      "rgba(255,255,255,.08)",
    color: "white",
    borderRadius: 9,
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  nav: {
    background: "white",
    borderBottom:
      "1px solid #dfe9e3",
    display: "flex",
    gap: 6,
    padding: "9px 5%",
    overflowX: "auto",
    position: "sticky",
    top: 0,
    zIndex: 20,
    boxShadow:
      "0 2px 12px rgba(0,0,0,.04)",
  },

  navBtn: {
    border: 0,
    background: "transparent",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    whiteSpace: "nowrap",
    color: "#53635a",
    fontWeight: 700,
  },

  navActive: {
    border: 0,
    background:
      "linear-gradient(135deg,#e4f8ec,#d4f3e2)",
    color: "#08783f",
    fontWeight: 900,
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow:
      "0 3px 10px rgba(8,120,63,.09)",
  },

  navIcon: {
    marginRight: 5,
  },

  container: {
    width:
      "min(1240px,92%)",
    margin:
      "25px auto 70px",
  },

  hero: {
    background:
      "linear-gradient(135deg,#08783f,#0da85a)",
    color: "white",
    borderRadius: 20,
    padding: 26,
    display: "flex",
    justifyContent:
      "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 20,
    boxShadow:
      "0 12px 30px rgba(8,120,63,.15)",
  },

  heroTag: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.3,
    opacity: 0.82,
  },

  heroTitle: {
    margin:
      "7px 0 4px",
    fontSize: 30,
    fontWeight: 950,
  },

  heroText: {
    margin: 0,
    opacity: 0.88,
  },

  balanceMini: {
    background:
      "rgba(255,255,255,.15)",
    padding: "15px 18px",
    borderRadius: 13,
    minWidth: 160,
    display: "grid",
    gap: 5,
    backdropFilter:
      "blur(8px)",
  },

  layout: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0,1fr) 360px",
    gap: 20,
    alignItems: "start",
  },

  matchCard: {
    background: "white",
    border:
      "1px solid #e0eae4",
    borderRadius: 17,
    padding: 17,
    marginBottom: 15,
    boxShadow:
      "0 5px 20px rgba(22,65,42,.055)",
  },

  matchTop: {
    display: "flex",
    justifyContent:
      "space-between",
    color: "#718078",
    fontSize: 12,
  },

  liveBadge: {
    background: "#e8f8ee",
    color: "#08783f",
    borderRadius: 999,
    padding: "4px 8px",
    fontWeight: 800,
  },

  teams: {
    display: "grid",
    gridTemplateColumns:
      "1fr 60px 1fr",
    alignItems: "center",
    padding:
      "18px 5px",
    textAlign: "center",
  },

  team: {
    display: "grid",
    justifyItems: "center",
    gap: 6,
  },

  teamBall: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#eef8f2",
    display: "grid",
    placeItems: "center",
  },

  vs: {
    color: "#84928a",
    fontWeight: 900,
    fontSize: 12,
  },

  market: {
    marginTop: 10,
  },

  marketTitle: {
    fontWeight: 900,
    fontSize: 13,
    marginBottom: 7,
  },

  oddsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(105px,1fr))",
    gap: 8,
  },

  oddBtn: {
    border:
      "1px solid #d6e4dc",
    background:
      "linear-gradient(180deg,#fbfdfc,#f2f8f4)",
    borderRadius: 9,
    padding: "10px 8px",
    cursor: "pointer",
    display: "flex",
    justifyContent:
      "space-between",
    gap: 5,
    color: "#24332b",
    fontWeight: 700,
  },

  slip: {
    background: "white",
    borderRadius: 17,
    padding: 17,
    border:
      "1px solid #e0eae4",
    position: "sticky",
    top: 75,
    boxShadow:
      "0 8px 24px rgba(22,65,42,.06)",
  },

  slipHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    borderBottom:
      "1px solid #e7eeea",
    paddingBottom: 12,
    marginBottom: 10,
  },

  slipCount: {
    background: "#08783f",
    color: "white",
    width: 27,
    height: 27,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 900,
  },

  slipEmpty: {
    textAlign: "center",
    padding: "25px 10px",
    color: "#78857d",
  },

  slipItem: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: 8,
    padding: "11px 0",
    borderBottom:
      "1px solid #edf1ee",
    fontSize: 13,
  },

  remove: {
    border: 0,
    background: "#ffe9e9",
    color: "#b42318",
    width: 28,
    height: 28,
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 18,
  },

  summary: {
    display: "flex",
    justifyContent:
      "space-between",
    padding: "9px 0",
    fontSize: 14,
  },

  greenText: {
    color: "#08783f",
  },

  primary: {
    width: "100%",
    border: 0,
    background:
      "linear-gradient(135deg,#08783f,#0aa95b)",
    color: "white",
    padding: "12px 14px",
    borderRadius: 10,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow:
      "0 5px 15px rgba(8,120,63,.15)",
  },

  secondary: {
    width: "100%",
    border:
      "1px solid #cfdad4",
    background: "white",
    color: "#26352d",
    padding: "12px 14px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    border:
      "1px solid #cfdad4",
    borderRadius: 10,
    marginBottom: 10,
    background: "white",
    fontSize: 14,
    outline: "none",
  },

  inputLabel: {
    display: "block",
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 7,
  },

  card: {
    background: "white",
    border:
      "1px solid #e0eae4",
    borderRadius: 17,
    padding: 19,
    marginBottom: 15,
    boxShadow:
      "0 5px 20px rgba(22,65,42,.045)",
  },

  walletHero: {
    background:
      "linear-gradient(135deg,#08783f,#0aa95b)",
    color: "white",
    borderRadius: 20,
    padding: 28,
    display: "grid",
    gap: 5,
    marginBottom: 20,
    boxShadow:
      "0 12px 30px rgba(8,120,63,.14)",
  },

  walletIcon: {
    fontSize: 34,
    marginBottom: 5,
  },

  twoCol: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",
    gap: 15,
  },

  row: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: 12,
    alignItems: "center",
    padding: "10px 0",
    borderBottom:
      "1px solid #edf1ee",
  },

  buttonRow: {
    display: "grid",
    gridTemplateColumns:
      "1fr 1fr",
    gap: 8,
    marginTop: 10,
  },

  badge: {
    background: "#edf7f0",
    color: "#08783f",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },

  small: {
    color: "#748078",
    fontSize: 12,
    marginTop: 4,
  },

  muted: {
    color: "#6e7b74",
    lineHeight: 1.55,
  },

  noOdds: {
    color: "#87938d",
    fontSize: 13,
    padding: 10,
  },

  error: {
    background: "#fff0f0",
    color: "#a51d1d",
    border:
      "1px solid #f1c3c3",
    padding: "11px 13px",
    borderRadius: 10,
    marginBottom: 12,
  },

  success: {
    background: "#edf9f1",
    color: "#08783f",
    border:
      "1px solid #c9ead4",
    padding: "11px 13px",
    borderRadius: 10,
    marginBottom: 12,
  },

  authWrap: {
    minHeight:
      "calc(100vh - 80px)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "radial-gradient(circle at top,#e7f8ee,#f5f9f6 55%,#edf4f0)",
  },

  authCard: {
    width:
      "min(430px,100%)",
    background: "white",
    padding: 30,
    borderRadius: 22,
    boxShadow:
      "0 18px 50px rgba(22,65,42,.12)",
    border:
      "1px solid #e1ebe5",
  },

  authBadge: {
    display: "inline-block",
    background: "#e7f8ee",
    color: "#08783f",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
  },

  authTitle: {
    margin:
      "12px 0 5px",
    fontSize: 28,
  },

  logoCircle: {
    width: 58,
    height: 58,
    borderRadius: 17,
    background:
      "linear-gradient(135deg,#08783f,#0aa95b)",
    color: "white",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    fontWeight: 900,
    marginBottom: 14,
    boxShadow:
      "0 8px 20px rgba(8,120,63,.2)",
  },

  linkButton: {
    width: "100%",
    border: 0,
    background: "transparent",
    color: "#08783f",
    padding: 12,
    cursor: "pointer",
    fontWeight: 800,
  },

  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(135deg,#eaf8ef,#f7faf8)",
    fontFamily:
      "system-ui",
  },

  loadingBox: {
    textAlign: "center",
  },

  loadingBall: {
    fontSize: 55,
    animation:
      "cshSpin 1s linear infinite",
  },

  emptyIcon: {
    fontSize: 35,
    marginBottom: 7,
  },

  sectionHero: {
    background: "white",
    border:
      "1px solid #e0eae4",
    borderRadius: 18,
    padding: 24,
    marginBottom: 18,
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    boxShadow:
      "0 5px 20px rgba(22,65,42,.045)",
  },

  bigIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    background: "#e8f7ee",
    display: "grid",
    placeItems: "center",
    fontSize: 35,
  },

  /* =========================
     VIRTUAL GAMES
     ========================= */

  virtualHero: {
    background:
      "linear-gradient(135deg,#08783f 0%,#0aa95b 50%,#18b96b 100%)",
    color: "white",
    borderRadius: 22,
    padding: 27,
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 20,
    marginBottom: 20,
    boxShadow:
      "0 15px 35px rgba(8,120,63,.18)",
  },

  virtualTitle: {
    margin:
      "7px 0 5px",
    fontSize: 31,
    fontWeight: 950,
  },

  virtualBalance: {
    background:
      "rgba(255,255,255,.14)",
    borderRadius: 16,
    padding: "16px 19px",
    minWidth: 180,
    display: "grid",
    gap: 5,
    backdropFilter:
      "blur(10px)",
  },

  resetVirtual: {
    border:
      "1px solid rgba(255,255,255,.5)",
    background:
      "rgba(255,255,255,.08)",
    color: "white",
    borderRadius: 8,
    padding: "7px 9px",
    cursor: "pointer",
    marginTop: 5,
  },

  gameGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(5,minmax(0,1fr))",
    gap: 11,
    marginBottom: 20,
  },

  gameCard: {
    background: "white",
    border:
      "2px solid #e4ece7",
    borderRadius: 16,
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 6,
    minHeight: 145,
    transition:
      "all .18s ease",
  },

  gameIcon: {
    width: 47,
    height: 47,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontSize: 26,
    marginBottom: 4,
  },

  gameDescription: {
    fontSize: 11,
    color: "#748078",
    lineHeight: 1.4,
  },

  virtualLayout: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0,1fr) 350px",
    gap: 18,
    alignItems: "start",
  },

  virtualPlayCard: {
    background: "white",
    border:
      "1px solid #e0eae4",
    borderRadius: 19,
    padding: 21,
    boxShadow:
      "0 7px 25px rgba(22,65,42,.055)",
  },

  selectedGameHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },

  selectedGameIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    fontSize: 33,
    flexShrink: 0,
  },

  virtualArena: {
    minHeight: 170,
    borderRadius: 18,
    background:
      "linear-gradient(135deg,#eaf8ef,#f6fbf8)",
    border:
      "1px solid #d9ebe0",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 7,
    marginBottom: 20,
    position: "relative",
    overflow: "hidden",
  },

  arenaGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: "50%",
    background:
      "rgba(8,120,63,.08)",
    filter: "blur(20px)",
  },

  arenaIcon: {
    fontSize: 52,
    position: "relative",
  },

  virtualChoices: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(135px,1fr))",
    gap: 9,
    marginBottom: 17,
  },

  virtualChoice: {
    border:
      "1px solid #d5e2db",
    background: "#f8fbf9",
    borderRadius: 11,
    padding: "13px 12px",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    cursor: "pointer",
    fontWeight: 800,
  },

  virtualChoiceActive: {
    background:
      "linear-gradient(135deg,#08783f,#0aa95b)",
    color: "white",
    borderColor:
      "#08783f",
    boxShadow:
      "0 5px 15px rgba(8,120,63,.16)",
  },

  stakeBox: {
    display: "grid",
    gridTemplateColumns:
      "1fr 1fr",
    gap: 12,
    alignItems: "end",
  },

  quickStakes: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4,1fr)",
    gap: 5,
  },

  quickStake: {
    border:
      "1px solid #d5e2db",
    background: "#f5faf7",
    borderRadius: 8,
    padding: "9px 5px",
    cursor: "pointer",
    fontWeight: 800,
  },

  virtualPlayButton: {
    width: "100%",
    border: 0,
    marginTop: 5,
    padding: "15px",
    borderRadius: 12,
    background:
      "linear-gradient(135deg,#08783f,#0aa95b)",
    color: "white",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow:
      "0 7px 18px rgba(8,120,63,.18)",
  },

  resultBox: {
    marginTop: 16,
    borderRadius: 14,
    padding: 15,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  resultWin: {
    background: "#eaf9ef",
    color: "#08783f",
    border:
      "1px solid #c9ead4",
  },

  resultLose: {
    background: "#fff4f4",
    color: "#a51d1d",
    border:
      "1px solid #f0cccc",
  },

  resultIcon: {
    fontSize: 32,
  },

  virtualHistoryCard: {
    background: "white",
    border:
      "1px solid #e0eae4",
    borderRadius: 19,
    padding: 17,
    position: "sticky",
    top: 75,
    boxShadow:
      "0 7px 25px rgba(22,65,42,.05)",
  },

  historyHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottom:
      "1px solid #e8eeea",
    marginBottom: 4,
  },

  historyCount: {
    background: "#e8f7ee",
    color: "#08783f",
    width: 29,
    height: 29,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 12,
  },

  historyEmpty: {
    textAlign: "center",
    padding: "30px 10px",
    color: "#78857d",
  },

  historyItem: {
    display: "grid",
    gridTemplateColumns:
      "38px minmax(0,1fr) auto",
    gap: 9,
    alignItems: "center",
    padding:
      "11px 0",
    borderBottom:
      "1px solid #edf1ee",
    fontSize: 12,
  },

  historyGameIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "#f0f6f2",
    display: "grid",
    placeItems: "center",
    fontSize: 19,
  },

  historyMiddle: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },

  cardHeading: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  cardHeadingIcon: {
    fontSize: 25,
  },

  statNumber: {
    background: "#e8f7ee",
    color: "#08783f",
    borderRadius: 999,
    padding: "5px 10px",
    fontWeight: 900,
  },
};

/* =========================================================
   RESPONSIVE CSS
   ========================================================= */

const globalCss = `
  * {
    box-sizing: border-box;
  }

  button,
  input,
  select {
    font-family: inherit;
  }

  button:disabled {
    opacity: .65;
    cursor: not-allowed;
  }

  button:not(:disabled):hover {
    filter: brightness(.98);
  }

  input:focus,
  select:focus {
    border-color: #08783f !important;
    box-shadow: 0 0 0 3px rgba(8,120,63,.08);
  }

  @keyframes cshSpin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1000px) {
    .csh-no-class {}
  }

  @media (max-width: 850px) {
    body {
      margin: 0;
    }
  }
`;

/* =========================================================
   EXPORT
   ========================================================= */

export default App;