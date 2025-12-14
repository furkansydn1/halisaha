// HalıSaha PWA (v2) - mevki + 14 kişide otomatik takım
// HalıSaha PWA (v2)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";




// ✅ Firebase Console → Project settings → Your apps → Web app
const firebaseConfig = {
  apiKey: "AIzaSyC0X8wbvjuB-QPV3zYDPY2o01tIW22a4FI",
  authDomain: "halisaha-9adee.firebaseapp.com",
  projectId: "halisaha-9adee",
  storageBucket: "halisaha-9adee.firebasestorage.app",
  messagingSenderId: "963668632742",
  appId: "1:963668632742:web:934ce9bcdef4a7215e4067",
  measurementId: "G-263R6WLDRQ"
};

const hasConfig = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_HERE");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


const $ = (id) => document.getElementById(id);

function showMatchTab(){
  hide($("viewProfile"));
  $("tabMatch")?.classList.add("active");
  $("tabProfile")?.classList.remove("active");
}

function showProfileTab(){
  show($("viewProfile"));
  $("tabProfile")?.classList.add("active");
  $("tabMatch")?.classList.remove("active");
}

$("tabMatch")?.addEventListener("click", showMatchTab);
$("tabProfile")?.addEventListener("click", showProfileTab);



// views
const viewLogin = $("viewLogin");
const viewMatch = $("viewMatch");
const btnSignOut = $("btnSignOut");

onAuthStateChanged(auth, (user) => {
  if (user) {
    viewLogin?.classList.add("hidden");
    viewMatch?.classList.remove("hidden");
    showMatchTab?.();
  } else {
    viewMatch?.classList.add("hidden");
    viewLogin?.classList.remove("hidden");
  }
});


// login inputs
const email = $("email");
const password = $("password");
const nickname = $("nickname");
const pos1 = $("pos1");
const pos2 = $("pos2");
const loginMsg = $("loginMsg");

// match header
const matchTitle = $("matchTitle");
const matchWhen = $("matchWhen");
const matchWhere = $("matchWhere");
const helloUser = $("helloUser");

// buttons
const btnIn = $("btnIn");
const btnOut = $("btnOut");

// lists
const listIn = $("listIn");
const listOut = $("listOut");
const countIn = $("countIn");
const countOut = $("countOut");

// teams
const teamsCard = $("teamsCard");
const teamAEl = $("teamA");
const teamBEl = $("teamB");
const teamsMeta = $("teamsMeta");
const btnRegen = $("btnRegen");

// admin
const adminTitle = $("adminTitle");
const adminWhere = $("adminWhere");
const adminWhen = $("adminWhen");
const btnSaveMatch = $("btnSaveMatch");
const btnCopyLink = $("btnCopyLink");
const adminMsg = $("adminMsg");

// URL ?m=<matchId>
const url = new URL(location.href);
let matchId = url.searchParams.get("m") || null;

const CURRENT_DOC = doc(db, "meta", "current_match");

function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }
function msg(el, text, ok=true){
  el.textContent = text;
  el.style.color = ok ? "var(--muted)" : "#ff9aa5";
}
function pulse(el, cls){
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
function formatWhen(d){
  if(!d) return "—";
  const dt = d instanceof Date ? d : d.toDate?.() || new Date(d);
  const pad = (n)=> String(n).padStart(2,"0");
  return `${pad(dt.getDate())}.${pad(dt.getMonth()+1)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

async function ensureMatchId(){
  if(matchId) return matchId;

  const snap = await getDoc(CURRENT_DOC);
  if(snap.exists() && snap.data().matchId){
    matchId = snap.data().matchId;
    return matchId;
  }

  const ref = await addDoc(collection(db, "matches"), {
    title: "Bu Haftaki Maç",
    where: "Saha",
    when: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid || "system",
  });
  await setDoc(CURRENT_DOC, { matchId: ref.id, updatedAt: serverTimestamp() }, { merge:true });
  matchId = ref.id;
  return matchId;
}

async function getUserProfile(uid){
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function normalizePos(p){
  const s = (p||"").toLowerCase();
  // super basit sınıflandırma
  if(s.includes("kaleci") || s.includes("gk")) return "GK";
  if(s.includes("stoper") || s.includes("def") || s.includes("bek") || s.includes("cb") || s.includes("rb") || s.includes("lb")) return "DEF";
  if(s.includes("orta") || s.includes("mid") || s.includes("cm") || s.includes("dm") || s.includes("am") || s.includes("10") || s.includes("8") || s.includes("6")) return "MID";
  if(s.includes("forvet") || s.includes("kanat") || s.includes("fw") || s.includes("st") || s.includes("wing") || s.includes("9") || s.includes("7") || s.includes("11")) return "FWD";
  return "MID"; // default
}

function pickPos(profile){
  const p1 = normalizePos(profile?.pos1);
  const p2 = normalizePos(profile?.pos2);
  // p1 boşsa p2
  return p1 || p2 || "MID";
}

function buildTeams(players){
  // players: [{uid,name,posKey,rawPos}]
  // Öncelik: GK -> DEF -> MID -> FWD (dengeli dağıt)
  const order = { "GK":0, "DEF":1, "MID":2, "FWD":3 };
  const sorted = [...players].sort((a,b)=> order[a.posKey]-order[b.posKey] || a.name.localeCompare(b.name,"tr"));
  const A=[], B=[];
  // basit denge: sırayla ata + takım sayısını dengede tut
  for(const p of sorted){
    const target = (A.length<=B.length) ? A : B;
    target.push(p);
  }
  // Eğer GK sayısı 2 ise her takıma bir GK düşmesini zorla (basit swap)
  const gks = players.filter(p=>p.posKey==="GK");
  if(gks.length>=2){
    // ensure first GK in A and second GK in B
    const firstGK = gks[0].uid;
    const secondGK = gks[1].uid;
    const inA = A.some(x=>x.uid===firstGK);
    const inB = B.some(x=>x.uid===secondGK);
    if(!inA){
      // swap from B to A
      const idxB = B.findIndex(x=>x.uid===firstGK);
      const idxA = A.findIndex(x=>x.uid!==secondGK) || 0;
      if(idxB>=0 && idxA>=0){
        const tmp = A[idxA]; A[idxA]=B[idxB]; B[idxB]=tmp;
      }
    }
    if(!inB){
      const idxA = A.findIndex(x=>x.uid===secondGK);
      const idxB = B.findIndex(x=>x.uid!==firstGK) || 0;
      if(idxA>=0 && idxB>=0){
        const tmp = B[idxB]; B[idxB]=A[idxA]; A[idxA]=tmp;
      }
    }
  }
  return { A, B };
}

function renderTeams(teams){
  if(!teams){ hide(teamsCard); return; }
  show(teamsCard);
  teamsMeta.textContent = teams.generatedAt ? "Hazır ✅" : "—";

  teamAEl.innerHTML = teams.A.map(p=>`<li>${escapeHtml(p.name)} <span class="pill">${escapeHtml(p.rawPos || p.posKey)}</span></li>`).join("");
  teamBEl.innerHTML = teams.B.map(p=>`<li>${escapeHtml(p.name)} <span class="pill">${escapeHtml(p.rawPos || p.posKey)}</span></li>`).join("");
}

function renderLists(items){
  const ins = items.filter(x=>x.status==="in");
  const outs = items.filter(x=>x.status==="out");

  countIn.textContent = String(ins.length);
  countOut.textContent = String(outs.length);

  listIn.innerHTML = ins.map(x=>`
    <li>
      <span>${escapeHtml(x.name || "İsimsiz")}</span>
      <span class="pill">${escapeHtml(x.pos1 || "Mevki?")}</span>
    </li>
  `).join("");

  listOut.innerHTML = outs.map(x=>`
    <li>
      <span>${escapeHtml(x.name || "İsimsiz")}</span>
      <span class="pill">${escapeHtml(x.pos1 || "—")}</span>
    </li>
  `).join("");
}

async function maybeGenerateTeams(matchRef, ins){
  // only when exactly 14 "in"
  if (ins.length !== 14) return;

  // read current teams
  const snap = await getDoc(matchRef);
  const existing = snap.data()?.teams;
  // if already generated and same 14 uids, do nothing
  const uids = ins.map(x=>x.uid).sort().join(",");
  const existingUids = (existing?.uids || []).slice().sort().join(",");
  if(existing && existingUids === uids) return;

  const players = ins.map(x=>({
    uid: x.uid,
    name: x.name || "Oyuncu",
    posKey: normalizePos(x.pos1),
    rawPos: x.pos1
  }));

  const t = buildTeams(players);
  const payload = {
    teams: {
      uids: ins.map(x=>x.uid),
      A: t.A,
      B: t.B,
      generatedAt: new Date().toISOString(),
    }
  };

  await updateDoc(matchRef, payload);

  if(window.confetti){
    window.confetti({ particleCount: 120, spread: 90, origin:{ y: .75 } });
  }
}

async function setStatus(status){
  const user = auth.currentUser;
  if(!user) return;

  const id = await ensureMatchId();

  // pull profile for mevki
  const profile = await getUserProfile(user.uid);

  const ref = doc(db, "matches", id, "responses", user.uid);
  await setDoc(ref, {
    uid: user.uid,
    name: user.displayName || "Oyuncu",
    status,
    pos1: profile?.pos1 || "",
    pos2: profile?.pos2 || "",
    updatedAt: serverTimestamp(),
  }, { merge:true });

  if(status==="in"){
    pulse(btnIn, "pop");
    if(window.confetti){
      window.confetti({ particleCount: 50, spread: 70, origin:{ y: .85 } });
    }
  } else {
    pulse(btnOut, "shake");
  }
}

async function loadMatchAndSubscribe(){
  const id = await ensureMatchId();

  const matchRef = doc(db, "matches", id);
  onSnapshot(matchRef, (snap)=>{
    if(!snap.exists()) return;
    const data = snap.data();
    matchTitle.textContent = data.title || "Bu Haftaki Maç";
    matchWhere.textContent = `📍 Saha: ${data.where || "—"}`;
    matchWhen.textContent = `⏱️ ${data.when ? formatWhen(data.when) : "Tarih yok"}`;

    // prefill admin
    adminTitle.value = data.title || "";
    adminWhere.value = data.where || "";
    if(data.when?.toDate){
      const dt = data.when.toDate();
      const iso = new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16);
      adminWhen.value = iso;
    }

    renderTeams(data.teams ? {A:data.teams.A||[], B:data.teams.B||[], generatedAt:data.teams.generatedAt} : null);
  });

  const responsesRef = collection(db, "matches", id, "responses");
  const q = query(responsesRef, orderBy("updatedAt","desc"));
  onSnapshot(q, async (snap)=>{
    const items = [];
    snap.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
    renderLists(items);

    const ins = items.filter(x=>x.status==="in");
    await maybeGenerateTeams(matchRef, ins);
  });
}

// auth
$("btnLogin").addEventListener("click", async ()=>{
  if(!hasConfig){ msg(loginMsg, "Önce app.js içindeki firebaseConfig alanını doldur.", false); return; }
  msg(loginMsg, "");
  try{ await signInWithEmailAndPassword(auth, email.value.trim(), password.value); }
  catch(e){ msg(loginMsg, humanError(e), false); }
});

$("btnSignup").addEventListener("click", async ()=>{
  if(!hasConfig){ msg(loginMsg, "Önce app.js içindeki firebaseConfig alanını doldur.", false); return; }
  msg(loginMsg, "");
  try{
    const name = nickname.value.trim();
    const p1 = pos1.value.trim();
    const p2 = pos2.value.trim();

    if(!name){ msg(loginMsg, "Takma ad yaz.", false); return; }
    if(!p1){ msg(loginMsg, "Mevki (1) yaz.", false); return; }

    const cred = await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
    await updateProfile(cred.user, { displayName: name });

    // store profile
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      name,
      pos1: p1,
      pos2: p2,
      createdAt: serverTimestamp(),
    }, { merge:true });

    msg(loginMsg, "Kayıt tamam ✅", true);
  }catch(e){
    msg(loginMsg, humanError(e), false);
  }
});

btnSignOut.addEventListener("click", ()=> signOut(auth));

btnIn.addEventListener("click", ()=> setStatus("in"));
btnOut.addEventListener("click", ()=> setStatus("out"));

btnRegen.addEventListener("click", async ()=>{
  // regen only if 14 in, and user is logged in
  const user = auth.currentUser;
  if(!user) return;
  const id = await ensureMatchId();
  const matchRef = doc(db, "matches", id);

  // read current responses
  const responsesRef = collection(db, "matches", id, "responses");
  const q = query(responsesRef, orderBy("updatedAt","desc"));
  // quick one-shot: use getDoc? Firestore doesn't offer getDocs in imports now; keep simple by toggling teams uids to force regen:
  // We'll just clear teams and it will regen on next snapshot tick if 14.
  await updateDoc(matchRef, { "teams": null });
  if(window.confetti){
    window.confetti({ particleCount: 80, spread: 90, origin:{ y: .8 } });
  }
  msg(adminMsg, "Takımlar yeniden karılacak (liste güncellenince).", true);
});

// Admin: new match
btnSaveMatch.addEventListener("click", async ()=>{
  const user = auth.currentUser;
  if(!user){ msg(adminMsg, "Önce giriş yap.", false); return; }

  const title = adminTitle.value.trim() || "Bu Haftaki Maç";
  const where = adminWhere.value.trim() || "Saha";
  const whenVal = adminWhen.value;
  const whenDate = whenVal ? new Date(whenVal) : null;

  const ref = await addDoc(collection(db, "matches"), {
    title, where,
    when: whenDate ? whenDate : serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  await setDoc(CURRENT_DOC, { matchId: ref.id, updatedAt: serverTimestamp() }, { merge:true });

  matchId = ref.id;
  const newUrl = new URL(location.href);
  newUrl.searchParams.set("m", ref.id);
  history.replaceState({}, "", newUrl.toString());

  msg(adminMsg, "Maç kaydedildi ✅ Linki kopyalayıp gruba at.", true);
});

btnCopyLink.addEventListener("click", async ()=>{
  const id = await ensureMatchId();
  const shareUrl = new URL(location.href);
  shareUrl.searchParams.set("m", id);
  try{
    await navigator.clipboard.writeText(shareUrl.toString());
    msg(adminMsg, "Link kopyalandı ✅", true);
  }catch{
    msg(adminMsg, "Kopyalanamadı. Linki adres çubuğundan kopyala.", false);
  }
});

onAuthStateChanged(auth, async (user)=>{
  if(user){
    hide(viewLogin);
    show(viewMatch);
    btnSignOut.classList.remove("hidden");
    helloUser.textContent = `Selam ${user.displayName || "Oyuncu"} 👋`;

    await loadMatchAndSubscribe();
  }else{
    show(viewLogin);
    hide(viewMatch);
    btnSignOut.classList.add("hidden");
  }
});

// SW
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

function humanError(e){
  const code = e?.code || "";
  if(code.includes("auth/invalid-credential")) return "E-posta veya şifre yanlış.";
  if(code.includes("auth/weak-password")) return "Şifre çok zayıf (en az 6 karakter).";
  if(code.includes("auth/email-already-in-use")) return "Bu e-posta zaten kayıtlı.";
  if(code.includes("auth/invalid-email")) return "E-posta formatı yanlış.";
  return e?.message || "Bir hata oldu.";
}
