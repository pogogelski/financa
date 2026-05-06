
import { initializeApp }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged,
         createUserWithEmailAndPassword,
         signInWithEmailAndPassword,
         sendPasswordResetEmail,
         updateProfile }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAZ7xBke6ZO6u8jSRM0ET-EW-auh0jyLkU",
  authDomain:        "financa-f20b7.firebaseapp.com",
  projectId:         "financa-f20b7",
  storageBucket:     "financa-f20b7.firebasestorage.app",
  messagingSenderId: "899997330411",
  appId:             "1:899997330411:web:d7a47e8a25b429f71007ae"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const loader = document.getElementById('page-loader');

onAuthStateChanged(auth, user => {
  if (user) {

    if (sessionStorage.getItem('signup_pending')) return;
    window.location.replace('index.html');
  } else {
    loader.classList.add('fade');
    setTimeout(() => loader.style.display = 'none', 350);
  }
});


window.switchTab = function(tab) {
  document.getElementById('tab-login').classList.toggle('active',  tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('form-login').style.display   = tab === 'login'  ? 'block' : 'none';
  document.getElementById('form-signup').style.display  = tab === 'signup' ? 'block' : 'none';
  document.getElementById('signup-success').style.display = 'none';
  hideGlobalError(); clearErrors();
};

function showGlobalError(msg) {
  const el = document.getElementById('global-error');
  document.getElementById('global-error-msg').textContent = msg;
  el.classList.add('show');
}
function hideGlobalError() { document.getElementById('global-error').classList.remove('show'); }

function fieldErr(id, show) {
  document.getElementById(id)?.classList.toggle('show', show);
  const inp = document.getElementById(id.replace('err-', ''));
  inp?.classList.toggle('error', show);
}
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('.field').forEach(e => e.classList.remove('error'));
}

function setLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

window.togglePw = function(id, btn) {
  const inp = document.getElementById(id);
  const isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.querySelector('svg').innerHTML = isText
    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>';
};

window.checkStrength = function(pw) {
  const wrap = document.getElementById('strength-wrap');
  const fill = document.getElementById('strength-fill');
  const lbl  = document.getElementById('strength-label');
  if (!pw) { wrap.classList.remove('show'); return; }
  wrap.classList.add('show');
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const lvls = [
    {w:'20%',c:'#ef4444',t:'Muito fraca'},
    {w:'40%',c:'#f97316',t:'Fraca'},
    {w:'60%',c:'#fbbf24',t:'Regular'},
    {w:'80%',c:'#22c56e',t:'Forte'},
    {w:'100%',c:'#16a357',t:'Muito forte'},
  ];
  const l = lvls[Math.min(s-1,4)] || lvls[0];
  fill.style.width = l.w; fill.style.background = l.c;
  lbl.textContent  = l.t; lbl.style.color = l.c;
};


function fbErr(code) {
  const map = {
    'auth/user-not-found':       'E-mail não cadastrado.',
    'auth/wrong-password':       'Senha incorreta.',
    'auth/invalid-credential':   'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password':        'A senha deve ter pelo menos 6 caracteres.',
    'auth/invalid-email':        'E-mail inválido.',
    'auth/too-many-requests':    'Muitas tentativas. Tente novamente em alguns minutos.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  };
  return map[code] || 'Ocorreu um erro. Tente novamente.';
}

function defaultCategorias() {
  return [
    {id:1, nome:'Alimentação',   cor:'#22c56e', icone:'🍽️', tipo:'Saída'},
    {id:2, nome:'Transporte',    cor:'#60a5fa', icone:'🚗', tipo:'Saída'},
    {id:3, nome:'Moradia',       cor:'#a78bfa', icone:'🏠', tipo:'Saída'},
    {id:4, nome:'Saúde',         cor:'#f87171', icone:'❤️', tipo:'Saída'},
    {id:5, nome:'Educação',      cor:'#fbbf24', icone:'📚', tipo:'Saída'},
    {id:6, nome:'Lazer',         cor:'#f472b6', icone:'🎉', tipo:'Saída'},
    {id:7, nome:'Vestuário',     cor:'#22d3ee', icone:'👗', tipo:'Saída'},
    {id:8, nome:'Assinaturas',   cor:'#818cf8', icone:'📱', tipo:'Saída'},
    {id:9, nome:'Investimentos', cor:'#34d399', icone:'📈', tipo:'Saída'},
    {id:10,nome:'Outros',        cor:'#9ca3af', icone:'📦', tipo:'Ambos'},
    {id:11,nome:'Salário',       cor:'#22c56e', icone:'💰', tipo:'Entrada'},
    {id:12,nome:'Freelance',      cor:'#34d399', icone:'💻', tipo:'Entrada'},
    {id:13,nome:'Rendimentos',    cor:'#fbbf24', icone:'📈', tipo:'Entrada'},
    {id:14,nome:'Presente',       cor:'#f472b6', icone:'🎁', tipo:'Entrada'},
  ];
}


window.handleLogin = async function() {
  clearErrors(); hideGlobalError();
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-pw').value;
  let ok = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldErr('err-login-email', true); ok = false; }
  if (!pw) { fieldErr('err-login-pw', true); ok = false; }
  if (!ok) return;

  setLoading('btn-login', true);
  try {
    await signInWithEmailAndPassword(auth, email, pw);

  } catch(e) {
    setLoading('btn-login', false);
    showGlobalError(fbErr(e.code));
  }
};


window.handleSignup = async function() {
  clearErrors(); hideGlobalError();
  const nome    = document.getElementById('su-nome').value.trim();
  const email   = document.getElementById('su-email').value.trim();
  const pw      = document.getElementById('su-pw').value;
  const pw2     = document.getElementById('su-pw2').value;
  const salario = parseFloat(document.getElementById('su-salario').value) || 0;
  let ok = true;
  if (!nome)                                               { fieldErr('err-su-nome',  true); ok = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ fieldErr('err-su-email', true); ok = false; }
  if (!pw || pw.length < 6)                               { fieldErr('err-su-pw',    true); ok = false; }
  if (pw !== pw2)                                          { fieldErr('err-su-pw2',   true); ok = false; }
  if (!ok) return;

  setLoading('btn-signup', true);
  try {

    sessionStorage.setItem('signup_pending', '1');
    const cred = await createUserWithEmailAndPassword(auth, email, pw);

    const uid = cred.user.uid;
    await Promise.all([
      updateProfile(cred.user, { displayName: nome }),
      setDoc(doc(db, 'users', uid, 'config', 'main'), {
        nome, salario, meta: 20, criadoEm: new Date().toISOString()
      }),
      setDoc(doc(db, 'users', uid, 'config', 'categorias'), {
        lista: defaultCategorias()
      })
    ]);


    sessionStorage.removeItem('signup_pending');
    await cred.user.reload();


    document.getElementById('form-signup').style.display    = 'none';
    document.getElementById('signup-success').style.display = 'block';
    requestAnimationFrame(() => {
      setTimeout(() => { document.getElementById('redirect-bar').style.width = '100%'; }, 50);
    });
    setTimeout(() => { window.location.replace('index.html'); }, 2700);

  } catch(e) {
    sessionStorage.removeItem('signup_pending');
    setLoading('btn-signup', false);
    showGlobalError(fbErr(e.code));
  }
};


window.handleForgot = async function() {
  const email = document.getElementById('login-email').value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErr('err-login-email', true);
    showGlobalError('Preencha o e-mail acima para recuperar a senha.');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showGlobalError(''); hideGlobalError();

    const el = document.getElementById('global-error');
    el.style.background = 'rgba(34,197,110,.08)';
    el.style.borderColor = 'rgba(34,197,110,.2)';
    el.style.color = '#22c56e';
    document.getElementById('global-error-msg').textContent = `E-mail de recuperação enviado para ${email}`;
    el.classList.add('show');
  } catch(e) {
    showGlobalError(fbErr(e.code));
  }
};

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const active = document.activeElement;
  if (active.closest('#form-login'))  window.handleLogin();
  if (active.closest('#form-signup')) window.handleSignup();
});
