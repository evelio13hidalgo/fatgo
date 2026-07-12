/* Fatgo accounts + cloud sync (Supabase).
   Boot flow: the landing page ALWAYS shows first. A logged-in session gets a
   one-click "Continue" (hydrating from the cloud); local guest data gets a
   "Continue on this device" button; the app is only entered from the landing.
   Without Supabase keys in config.js everything still works in guest mode. */

const SYNC_KEYS = ["fatgo-profile", "fatgo-log", "fatgo-intake", "fatgo-units"];
const CFG = window.FATGO_CONFIG || {};
const cloudEnabled = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);

let sb = null;      // supabase client
let session = null;
let syncTimer = null;

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

function loadScript(src) {
  if (window.supabase) return Promise.resolve(); // already present (or test stub)
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error("Could not load Supabase — check your connection."));
    document.head.appendChild(s);
  });
}

/* ---------- cloud sync ---------- */

function collectLocal() {
  const data = {};
  SYNC_KEYS.forEach((k) => {
    const v = localStorage.getItem(k);
    if (v) data[k] = JSON.parse(v);
  });
  return data;
}

async function pushToCloud() {
  if (!session) return;
  const { error } = await sb.from("fatgo_data").upsert({
    user_id: session.user.id,
    data: collectLocal(),
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn("Fatgo sync failed:", error.message);
}

// app.js calls this after every localStorage write; debounced so rapid
// logging (e.g. adding several foods) becomes one upsert.
window.queueSync = () => {
  if (!session) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushToCloud, 1500);
};

async function hydrateFromCloud() {
  const { data: row, error } = await sb
    .from("fatgo_data").select("data").eq("user_id", session.user.id).maybeSingle();
  if (error) { console.warn("Fatgo load failed:", error.message); return; }
  if (row && row.data && row.data["fatgo-profile"]) {
    SYNC_KEYS.forEach((k) => {
      if (row.data[k] !== undefined) localStorage.setItem(k, JSON.stringify(row.data[k]));
      else localStorage.removeItem(k);
    });
  } else if (localStorage.getItem("fatgo-profile")) {
    await pushToCloud(); // first login on this device: adopt the guest data
  }
}

/* ---------- auth UI ---------- */

const $a = (id) => document.getElementById(id);
let authMode = "login";

function setAuthMode(mode) {
  authMode = mode;
  $a("tab-login").classList.toggle("active", mode === "login");
  $a("tab-signup").classList.toggle("active", mode === "signup");
  $a("auth-submit").textContent = mode === "login" ? "Log in" : "Create account";
  authMsg("");
}

function authMsg(text, isError = true) {
  const el = $a("auth-msg");
  el.textContent = text;
  el.classList.toggle("hidden", !text);
  el.classList.toggle("auth-ok", !isError);
}

function renderAccountBox() {
  const box = $a("account-box");
  if (!session && !cloudEnabled) { box.classList.add("hidden"); return; }
  if (session) {
    box.innerHTML = `<span class="account-email">${session.user.email}</span>
      <button id="logout-btn" class="ghost-btn" type="button">Log out</button>`;
  } else {
    box.innerHTML = `<button id="to-login-btn" class="ghost-btn" type="button">Sign up / Log in</button>`;
  }
  box.classList.remove("hidden");
}

function showLanding() {
  $a("landing").classList.remove("hidden");
  $a("setup").classList.add("hidden");
  $a("dashboard").classList.add("hidden");
  $a("account-box").classList.add("hidden");

  const hasLocalData = !!localStorage.getItem("fatgo-profile");

  if (session) {
    // logged in: no form, just a one-click way back in
    $a("auth-welcome").classList.remove("hidden");
    $a("welcome-line").textContent = `Welcome back — logged in as ${session.user.email}`;
    $a("auth-form").classList.add("hidden");
    $a("auth-tabs").classList.add("hidden");
    document.querySelector(".auth-divider").classList.add("hidden");
    $a("guest-btn").classList.add("hidden");
    $a("auth-note").textContent = "Your plan and progress sync to this account on every device.";
    return;
  }

  $a("auth-welcome").classList.add("hidden");
  if (!cloudEnabled) {
    // no login form -> the "or" divider has nothing to divide
    $a("auth-form").classList.add("hidden");
    $a("auth-tabs").classList.add("hidden");
    document.querySelector(".auth-divider").classList.add("hidden");
    $a("auth-note").textContent =
      "Accounts aren't switched on yet — jump in below and your data stays on this device.";
  }
  if (hasLocalData) {
    $a("guest-btn").textContent = "Continue — your data is saved on this device →";
  }
}

function enterAppFromAuth() {
  $a("landing").classList.add("hidden");
  renderAccountBox();
  window.enterApp(); // defined in app.js
}

/* ---------- events ---------- */

document.addEventListener("click", async (evt) => {
  if (evt.target.id === "tab-login") setAuthMode("login");
  if (evt.target.id === "tab-signup") setAuthMode("signup");

  if (evt.target.id === "guest-btn") {
    enterAppFromAuth();
  }

  // logged-in "Continue" on the landing page: pull cloud data, then enter
  if (evt.target.id === "continue-btn") {
    await hydrateFromCloud();
    enterAppFromAuth();
  }

  if (evt.target.id === "logout-btn" || evt.target.id === "welcome-logout") {
    if (sb) await sb.auth.signOut();
    SYNC_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("fatgo-guest"); // clean up the old skip-landing flag
    location.reload();
  }

  // guest → landing to sign in (local data is kept and adopted on first login)
  if (evt.target.id === "to-login-btn") {
    location.reload();
  }
});

document.addEventListener("submit", async (evt) => {
  if (evt.target.id !== "auth-form") return;
  evt.preventDefault();
  const email = $a("auth-email").value.trim();
  const password = $a("auth-pass").value;
  const btn = $a("auth-submit");
  btn.disabled = true;
  authMsg("");
  try {
    if (authMode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) return authMsg(error.message);
      if (!data.session)
        return authMsg("Almost there — check your email for a confirmation link, then log in.", false);
      session = data.session;
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return authMsg(error.message);
      session = data.session;
    }
    await hydrateFromCloud();
    enterAppFromAuth();
  } finally {
    btn.disabled = false;
  }
});

/* ---------- boot ---------- */

(async function initAuth() {
  if (cloudEnabled) {
    try {
      await loadScript(SUPABASE_CDN);
      sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
      const { data } = await sb.auth.getSession();
      session = data.session;
    } catch (e) {
      console.warn(e.message);
    }
  }

  // the home page always comes first — never straight into someone's data
  showLanding();
})();
