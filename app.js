
import { initializeApp }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
                                from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore,
         doc, getDoc, setDoc, deleteDoc,
         collection, getDocs, addDoc, updateDoc,
         query, orderBy }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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


let currentUser = null;
let lancamentos = [];
let categorias  = [];
let config      = { nome: '', salario: 0, meta: 20 };


const uid     = ()     => currentUser.uid;
const cfgDoc  = (name) => doc(db, 'users', uid(), 'config', name);
const lancCol = ()     => collection(db, 'users', uid(), 'lancamentos');
const lancDoc = (id)   => doc(db, 'users', uid(), 'lancamentos', id);


const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmtBRL    = n   => 'R$ ' + Math.abs(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtData   = iso => { const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };
const mesDeData = iso => MESES[new Date(iso+'T12:00:00').getMonth()];
const anoDeData = iso => String(new Date(iso+'T12:00:00').getFullYear());
const getCat    = nome => nome === 'Poupança'
  ? { cor:'#a78bfa', icone:'🐷' }
  : (categorias.find(c=>c.nome===nome)||{cor:'#9ca3af',icone:'📦'});

function tagInfo(l) {
  if (l.tipo === 'Entrada') return { cls:'tag-entrada', label:'Entrada', sign:'+', color:'#22c56e' };
  if (l.tipo === 'Saída')   return { cls:'tag-saida',   label:'Saída',   sign:'−', color:'#f87171' };
  return { cls:'tag-poupanca', label:l.direcao||'Poupança', sign: l.direcao==='Resgate' ? '+' : '−', color:'#a78bfa' };
}

function calcPoupanca() {
  const totalDep = lancamentos.filter(l=>l.tipo==='Poupança'&&l.direcao==='Depósito').reduce((a,l)=>a+l.valor,0);
  const totalRes = lancamentos.filter(l=>l.tipo==='Poupança'&&l.direcao==='Resgate').reduce((a,l)=>a+l.valor,0);
  return { saldo: totalDep - totalRes, totalDep, totalRes };
}


let toastTimer = null;
function toast(msg, tipo='ok') {
  const el   = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  document.getElementById('toast-msg').textContent = msg;
  icon.style.color = tipo==='ok' ? '#22c56e' : '#f87171';
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function popup({ icon='⚠️', titulo, texto, btnOk='Confirmar', btnCancel='Cancelar',
                 danger=false, soAlert=false }) {
  return new Promise(resolve => {
    const el = document.getElementById('custom-popup');
    document.getElementById('popup-icon').textContent  = icon;
    document.getElementById('popup-titulo').textContent = titulo;
    document.getElementById('popup-texto').textContent  = texto || '';

    const btnC = document.getElementById('popup-cancel');
    const btnO = document.getElementById('popup-ok');

    btnO.textContent = btnOk;
    btnO.className   = danger
      ? 'popup-btn popup-btn-danger'
      : 'popup-btn popup-btn-ok';


    btnC.style.display = soAlert ? 'none' : '';
    btnC.textContent   = btnCancel;

    el.classList.add('show');

    function close(result) {
      el.classList.remove('show');
      resolve(result);
    }

    btnO.onclick = () => close(true);
    btnC.onclick = () => close(false);
  
    el.onclick = (e) => { if (e.target === el) close(false); };
  });
}


const confirm_ = (titulo, texto, opts={}) =>
  popup({ titulo, texto, btnOk:'Confirmar', btnCancel:'Cancelar', ...opts });

const alert_ = (icon, titulo, texto) =>
  popup({ icon, titulo, texto, btnOk:'OK', soAlert:true });


function showLoader(on) {
  document.getElementById('app-loader').style.display = on ? 'flex' : 'none';
}


async function carregarDados() {
  showLoader(true);
  try {
    const cfgSnap = await getDoc(cfgDoc('main'));
    if (cfgSnap.exists()) {
      config = cfgSnap.data();

      if (!config.nome && currentUser.displayName) {
        config.nome = currentUser.displayName;
        await setDoc(cfgDoc('main'), config);
      }

      if (config.nome && !currentUser.displayName) {
        const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        await updateProfile(currentUser, { displayName: config.nome });
      }
    } else {
      config = { nome: currentUser.displayName||'', salario:0, meta:20 };
      await setDoc(cfgDoc('main'), config);
    }

    const catSnap = await getDoc(cfgDoc('categorias'));
    if (catSnap.exists()) {
      categorias = catSnap.data().lista;

      let migrou = false;
      categorias = categorias.map(c => {
        if (!c.tipo) { migrou = true; return {...c, tipo: 'Ambos'}; }
        return c;
      });
      if (migrou) await setDoc(cfgDoc('categorias'), {lista: categorias});
    } else {
      categorias = defaultCategorias();
    }

    const q = query(lancCol(), orderBy('data','desc'));
    const snap = await getDocs(q);
    lancamentos = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
  } catch(e) {
    console.error(e);
    toast('Erro ao carregar dados. Recarregue a página.','err');
  }
  showLoader(false);
}

function defaultCategorias() {
  return [
    {id:1,  nome:'Alimentação',   cor:'#22c56e', icone:'🍽️', tipo:'Saída'},
    {id:2,  nome:'Transporte',    cor:'#60a5fa', icone:'🚗',  tipo:'Saída'},
    {id:3,  nome:'Moradia',       cor:'#a78bfa', icone:'🏠',  tipo:'Saída'},
    {id:4,  nome:'Saúde',         cor:'#f87171', icone:'❤️',  tipo:'Saída'},
    {id:5,  nome:'Educação',      cor:'#fbbf24', icone:'📚',  tipo:'Saída'},
    {id:6,  nome:'Lazer',         cor:'#f472b6', icone:'🎉',  tipo:'Saída'},
    {id:7,  nome:'Vestuário',     cor:'#22d3ee', icone:'👗',  tipo:'Saída'},
    {id:8,  nome:'Assinaturas',   cor:'#818cf8', icone:'📱',  tipo:'Saída'},
    {id:9,  nome:'Investimentos', cor:'#34d399', icone:'📈',  tipo:'Saída'},
    {id:10, nome:'Outros',        cor:'#9ca3af', icone:'📦',  tipo:'Ambos'},
    {id:11, nome:'Salário',       cor:'#22c56e', icone:'💰',  tipo:'Entrada'},
    {id:12, nome:'Freelance',      cor:'#34d399', icone:'💻',  tipo:'Entrada'},
    {id:13, nome:'Rendimentos',    cor:'#fbbf24', icone:'📈',  tipo:'Entrada'},
    {id:14, nome:'Presente',       cor:'#f472b6', icone:'🎁',  tipo:'Entrada'},
  ];
}


onAuthStateChanged(auth, async user => {
  if (!user) { window.location.replace('auth.html'); return; }
  currentUser = user;
  await carregarDados();
  initUserInfo();
  const agora = new Date();
  document.getElementById('filtro-mes').value = MESES[agora.getMonth()];
  document.getElementById('filtro-ano').value = String(agora.getFullYear());
  renderDashboard();
});


function initUserInfo() {
  const nome  = config.nome || currentUser.displayName || 'Usuário';
  const email = currentUser.email || '';
  const ini   = nome.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('user-initials').textContent = ini;
  document.getElementById('user-name').textContent     = nome;
  document.getElementById('user-email').textContent    = email;

  const iniM = document.getElementById('user-initials-m');
  if (iniM) iniM.textContent = ini;
  const nomeM = document.getElementById('user-name-m');
  if (nomeM) nomeM.textContent = nome;
  const emailM = document.getElementById('user-email-m');
  if (emailM) emailM.textContent = email;
}


window.toggleMobileProfile = function() {
  document.getElementById('mobile-profile-dropdown')?.classList.toggle('hidden');
};

document.addEventListener('click', e => {
  const dropdown = document.getElementById('mobile-profile-dropdown');
  const trigger  = document.getElementById('mobile-profile-btn');
  if (!dropdown || dropdown.classList.contains('hidden')) return;
  if (!dropdown.contains(e.target) && e.target !== trigger && !trigger?.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});


window.logout = async function() {
  const ok = await confirm_('Sair da conta', 'Tem certeza que deseja sair?', {
    icon:'👋', btnOk:'Sair', btnCancel:'Ficar'
  });
  if (!ok) return;
  await signOut(auth);
  window.location.replace('auth.html');
};


const PAGES = ['dashboard','lancamentos','categorias','poupanca','configuracoes'];

window.showPage = function(name) {
  PAGES.forEach(p => {
    document.getElementById('page-'+p).classList.add('hidden');
    document.getElementById('nav-'+p)?.classList.remove('active');
    document.getElementById('bnav-'+p)?.classList.remove('active');
  });
  document.getElementById('page-'+name).classList.remove('hidden');
  document.getElementById('nav-'+name)?.classList.add('active');
  document.getElementById('bnav-'+name)?.classList.add('active');
  if (name==='dashboard')     renderDashboard();
  if (name==='lancamentos')   renderLancamentos();
  if (name==='categorias')    renderCategorias();
  if (name==='poupanca')      renderPoupanca();
  if (name==='configuracoes') loadConfig();
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobile-profile-dropdown')?.classList.add('hidden');
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('open');

let lineChart=null, pieChart=null;

function saldoAcumuladoAnterior(mes, ano) {
  const idxMesSel = MESES.indexOf(mes);
  const anoNum    = parseInt(ano, 10);

  const corte = new Date(anoNum, idxMesSel, 1);

  const anteriores = lancamentos.filter(l => {
    const d = new Date(l.data + 'T12:00:00');
    return d < corte;
  });

  if (!anteriores.length) return 0;


  const mesesDistintos = new Set(
    anteriores.map(l => {
      const d = new Date(l.data + 'T12:00:00');
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  );

  const sal      = config.salario || 0;
  const totalE   = anteriores.filter(l=>l.tipo==='Entrada').reduce((a,l)=>a+l.valor, 0);
  const totalS   = anteriores.filter(l=>l.tipo==='Saída').reduce((a,l)=>a+l.valor, 0);
  const totalDep = anteriores.filter(l=>l.tipo==='Poupança'&&l.direcao==='Depósito').reduce((a,l)=>a+l.valor, 0);
  const totalRes = anteriores.filter(l=>l.tipo==='Poupança'&&l.direcao==='Resgate').reduce((a,l)=>a+l.valor, 0);


  return sal * mesesDistintos.size + totalE - totalS - totalDep + totalRes;
}

window.renderDashboard = function() {
  const mes   = document.getElementById('filtro-mes').value;
  const ano   = document.getElementById('filtro-ano').value;
  const doMes = lancamentos.filter(l => mesDeData(l.data)===mes && anoDeData(l.data)===ano);
  const sal   = config.salario || 0;

  const gastos        = doMes.filter(l=>l.tipo==='Saída').reduce((a,l)=>a+l.valor,0);
  const entradas      = doMes.filter(l=>l.tipo==='Entrada').reduce((a,l)=>a+l.valor,0);
  const depositosMes  = doMes.filter(l=>l.tipo==='Poupança'&&l.direcao==='Depósito').reduce((a,l)=>a+l.valor,0);
  const resgatesMes   = doMes.filter(l=>l.tipo==='Poupança'&&l.direcao==='Resgate').reduce((a,l)=>a+l.valor,0);
  const saldoAnterior = saldoAcumuladoAnterior(mes, ano);
  const saldo         = saldoAnterior + sal + entradas - gastos - depositosMes + resgatesMes;
  const perc          = sal>0 ? Math.min(gastos/sal,1) : 0;
  const gPct          = Math.round(perc*100);
  const ePct          = sal>0 ? Math.round(Math.min(entradas/sal,1)*100) : 0;

  document.getElementById('dash-subtitle').textContent = `${mes} de ${ano}`;
  document.getElementById('kpi-salario').textContent   = fmtBRL(sal);
  document.getElementById('kpi-gasto').textContent     = fmtBRL(gastos);
  document.getElementById('kpi-entradas').textContent  = fmtBRL(entradas);

  const saldoEl = document.getElementById('kpi-saldo');
  saldoEl.textContent = fmtBRL(saldo);
  saldoEl.style.color = saldo>=0 ? '#22c56e' : '#f87171';


  const saldoCard = saldoEl.closest('.kpi-card');
  if (saldoCard) {
    const carry = saldoCard.querySelector('.carry-label');
    if (saldoAnterior !== 0) {
      const carryTxt = (saldoAnterior >= 0 ? '+' : '') + fmtBRL(saldoAnterior) + ' de meses anteriores';
      if (carry) {
        carry.textContent = carryTxt;
        carry.style.display = '';
      } else {
        const span = document.createElement('div');
        span.className = 'carry-label';
        span.style.cssText = 'font-size:.65rem;margin-top:.3rem;color:' + (saldoAnterior>=0?'#22c56e':'#f87171');
        span.textContent = carryTxt;
        saldoEl.insertAdjacentElement('afterend', span);
      }
    } else if (carry) {
      carry.style.display = 'none';
    }
  }

  document.getElementById('kpi-gasto-bar').style.width      = gPct+'%';
  document.getElementById('kpi-ent-bar').style.width        = ePct+'%';
  document.getElementById('kpi-saldo-bar').style.width      = sal>0 ? Math.max(0,Math.round(saldo/sal*100))+'%':'0%';
  document.getElementById('kpi-saldo-bar').style.background = saldo>=0?'#22c56e':'#f87171';

  document.getElementById('uso-pct').textContent         = gPct+'%';
  document.getElementById('uso-label-gasto').textContent = 'Gasto: '+fmtBRL(gastos);
  document.getElementById('uso-label-livre').textContent = 'Livre: '+fmtBRL(Math.max(0,saldo));
  const usoBar = document.getElementById('uso-bar');
  usoBar.style.width      = gPct+'%';
  usoBar.style.background = perc>0.9?'#f87171':perc>0.7?'#fbbf24':'#22c56e';

  renderLineChart(doMes, saldoAnterior + sal);
  renderPieChart(doMes);
  renderCatBreakdown(doMes);
  renderRecentTable(doMes);
  renderPoupancaKpi();
};

function renderLineChart(doMes, sal) {
  const sorted=[...doMes].sort((a,b)=>a.data.localeCompare(b.data));
  let acc=sal; const labels=[],data=[];
  sorted.forEach(l=>{
    if (l.tipo==='Entrada') acc+=l.valor;
    else if (l.tipo==='Saída') acc-=l.valor;
    else if (l.tipo==='Poupança') acc += l.direcao==='Resgate' ? l.valor : -l.valor;
    const d=new Date(l.data+'T12:00:00');
    labels.push(`${d.getDate()}/${d.getMonth()+1}`);
    data.push(+acc.toFixed(2));
  });
  if (lineChart) lineChart.destroy();
  const ctx=document.getElementById('lineChart').getContext('2d');
  if (!data.length){ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);return;}
  lineChart=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Saldo',data,borderColor:'#22c56e',backgroundColor:'rgba(34,197,110,.07)',fill:true,tension:0.4,pointRadius:4,pointBackgroundColor:'#22c56e',pointBorderColor:'#111113',pointBorderWidth:2}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>'R$ '+v.toLocaleString('pt-BR'),font:{size:11},color:'#71717a'},grid:{color:'#1f1f23'}},x:{ticks:{font:{size:11},color:'#71717a'},grid:{display:false}}}}});
}

function renderPieChart(doMes) {
  const cats={}; doMes.filter(l=>l.tipo==='Saída').forEach(l=>{cats[l.categoria]=(cats[l.categoria]||0)+l.valor;});
  const labels=Object.keys(cats),data=Object.values(cats),colors=labels.map(c=>getCat(c).cor);
  if (pieChart) pieChart.destroy();
  const ctx=document.getElementById('pieChart').getContext('2d');
  if (!data.length){ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);return;}
  pieChart=new Chart(ctx,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:'#18181b'}]},options:{responsive:true,cutout:'62%',plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10,padding:8,color:'#71717a'}}}}});
}

function renderCatBreakdown(doMes) {
  const cats={}; doMes.filter(l=>l.tipo==='Saída').forEach(l=>{cats[l.categoria]=(cats[l.categoria]||0)+l.valor;});
  const total=Object.values(cats).reduce((a,v)=>a+v,0);
  const el=document.getElementById('cat-breakdown');
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  if (!sorted.length){el.innerHTML='<p style="color:#52525b;font-size:.85rem;padding:.5rem 0">Sem gastos este mês.</p>';return;}
  el.innerHTML=sorted.map(([nome,val])=>{
    const pct=total>0?Math.round(val/total*100):0, cat=getCat(nome);
    return `<div style="display:flex;align-items:center;gap:.75rem">
      <span style="font-size:1.1rem;width:22px;flex-shrink:0;text-align:center">${cat.icone}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;font-weight:500;color:#a1a1aa;margin-bottom:4px">
          <span>${nome}</span><span>${fmtBRL(val)} · ${pct}%</span>
        </div>
        <div style="height:5px;border-radius:99px;background:#27272a;overflow:hidden">
          <div style="height:100%;border-radius:99px;width:${pct}%;background:${cat.cor};transition:width .6s ease"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderRecentTable(doMes) {
  const recent=[...doMes].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,8);
  const tbody=document.getElementById('painel-table');
  const empty=document.getElementById('painel-empty');
  if (!recent.length){tbody.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  tbody.innerHTML=recent.map((l,i)=>{
    const cat=getCat(l.categoria); const tag=tagInfo(l);
    const parcelaBadge = l.parcelaTotal
      ? `<span style="margin-left:4px;font-size:.6rem;font-weight:600;padding:.1rem .4rem;border-radius:99px;background:rgba(251,191,36,.1);color:#fbbf24">${l.parcelaNum}/${l.parcelaTotal}</span>`
      : '';
    return `<tr class="row-anim" style="animation-delay:${i*.03}s">
      <td class="px-4 py-3 font-mono text-xs whitespace-nowrap" style="color:#71717a">${fmtData(l.data)}</td>
      <td class="px-4 py-3 text-sm font-medium text-zinc-200">${l.descricao}${parcelaBadge}</td>
      <td class="px-4 py-3 hidden md:table-cell"><span class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style="background:${cat.cor}18;color:${cat.cor}">${cat.icone} ${l.categoria}</span></td>
      <td class="px-4 py-3 hidden sm:table-cell"><span class="${tag.cls}">${tag.label}</span></td>
      <td class="px-4 py-3 text-right font-mono font-medium text-sm" style="color:${tag.color}">${tag.sign} ${fmtBRL(l.valor)}</td>
    </tr>`;
  }).join('');
}

function renderPoupancaKpi() {
  const el = document.getElementById('kpi-poupanca');
  if (!el) return;
  el.textContent = fmtBRL(calcPoupanca().saldo);
}


window.renderLancamentos = function() {
  const busca=(document.getElementById('busca')?.value||'').toLowerCase();
  const tipo=document.getElementById('filtro-tipo')?.value||'';
  const cat=document.getElementById('filtro-cat-lanc')?.value||'';
  const mes=document.getElementById('filtro-mes-lanc')?.value||'';

  let lista=[...lancamentos].sort((a,b)=>b.data.localeCompare(a.data));
  if (busca) lista=lista.filter(l=>l.descricao.toLowerCase().includes(busca)||l.categoria.toLowerCase().includes(busca));
  if (tipo)  lista=lista.filter(l=>l.tipo===tipo);
  if (cat)   lista=lista.filter(l=>l.categoria===cat);
  if (mes)   lista=lista.filter(l=>mesDeData(l.data)===mes);

  const tbody=document.getElementById('lanc-table-body');
  const empty=document.getElementById('lanc-empty');
  if (!lista.length){tbody.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');

  tbody.innerHTML=lista.map((l,i)=>{
    const cat=getCat(l.categoria); const tag=tagInfo(l); const isPoup=l.tipo==='Poupança';
    const parcelaBadge = l.parcelaTotal
      ? `<span style="margin-left:4px;font-size:.6rem;font-weight:600;padding:.12rem .45rem;border-radius:99px;background:rgba(251,191,36,.1);color:#fbbf24;vertical-align:middle">${l.parcelaNum}/${l.parcelaTotal}</span>`
      : '';
    const btnExcluir = l.parcelaGrupo
      ? `<button onclick="excluirLancamento('${l.firestoreId}','${l.descricao.replace(/'/g,"&#39;")}','${l.parcelaGrupo}')" class="act-btn danger" title="Excluir">
           <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
         </button>`
      : `<button onclick="excluirLancamento('${l.firestoreId}','${l.descricao.replace(/'/g,"&#39;")}')" class="act-btn danger" title="Excluir">
           <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
         </button>`;
    const btnEditar = isPoup ? '' : `<button onclick="openModal('${l.firestoreId}')" class="act-btn" title="Editar">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          </button>`;
    return `<tr class="row-anim" style="animation-delay:${i*.025}s">
      <td class="px-4 py-3 font-mono text-xs whitespace-nowrap" style="color:#71717a">${fmtData(l.data)}</td>
      <td class="px-4 py-3">
        <div class="text-sm font-medium text-zinc-200">${l.descricao}${parcelaBadge}</div>
        ${l.obs?`<div class="text-xs mt-0.5" style="color:#52525b">${l.obs}</div>`:''}
      </td>
      <td class="px-4 py-3 hidden md:table-cell"><span class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style="background:${cat.cor}18;color:${cat.cor}">${cat.icone} ${l.categoria}</span></td>
      <td class="px-4 py-3 hidden sm:table-cell"><span class="${tag.cls}">${tag.label}</span></td>
      <td class="px-4 py-3 text-right font-mono font-medium text-sm" style="color:${tag.color}">${tag.sign} ${fmtBRL(l.valor)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-1 justify-end">
          ${btnEditar}
          ${btnExcluir}
        </div>
      </td>
    </tr>`;
  }).join('');

  const sel=document.getElementById('filtro-cat-lanc');
  const cur=sel.value;
  sel.innerHTML='<option value="">Todas categorias</option>'+categorias.map(c=>`<option value="${c.nome}">${c.icone} ${c.nome}</option>`).join('');
  sel.value=cur;
};


function catsFiltradas(tipo) {
  return categorias.filter(c => {
    const t = c.tipo || 'Ambos';
    if (tipo === 'Entrada') return t === 'Entrada' || t === 'Ambos';
    if (tipo === 'Saída')   return t === 'Saída'   || t === 'Ambos';
    return true;
  });
}

window.atualizarCatsPorTipo = function() {
  const tipo  = document.getElementById('m-tipo').value;
  const sel   = document.getElementById('m-cat');
  const cur   = sel.value;
  const lista = catsFiltradas(tipo);
  sel.innerHTML = lista.map(c=>`<option value="${c.nome}">${c.icone} ${c.nome}</option>`).join('');
  if (lista.find(c => c.nome === cur)) sel.value = cur;


  const sec = document.getElementById('parcela-section');
  if (sec) {
    const isEdit = !!document.getElementById('m-id').value;
    sec.style.display = (!isEdit && tipo === 'Saída') ? '' : 'none';
    if (tipo !== 'Saída') setParcelamento('avista');
  }
};

window.openModal = function(firestoreId) {
  document.getElementById('modal').classList.remove('hidden');

  _parcelamentoMode = 'avista';
  _numParcelas      = 2;

  if (firestoreId) {
    const l=lancamentos.find(x=>x.firestoreId===firestoreId);
    document.getElementById('modal-title').textContent='Editar lançamento';
    document.getElementById('m-id').value    = l.firestoreId;
    document.getElementById('m-data').value  = l.data;
    document.getElementById('m-tipo').value  = l.tipo;
    window.atualizarCatsPorTipo();
    document.getElementById('m-cat').value   = l.categoria;
    document.getElementById('m-desc').value  = l.descricao;
    document.getElementById('m-valor').value = l.valor;
    document.getElementById('m-obs').value   = l.obs||'';

    document.getElementById('parcela-section').style.display = 'none';
  } else {
    document.getElementById('modal-title').textContent='Novo lançamento';
    document.getElementById('m-id').value    = '';
    document.getElementById('m-data').value  = new Date().toISOString().split('T')[0];
    document.getElementById('m-tipo').value  = 'Saída';
    window.atualizarCatsPorTipo();
    document.getElementById('m-desc').value  = '';
    document.getElementById('m-valor').value = '';
    document.getElementById('m-obs').value   = '';
    document.getElementById('parcela-section').style.display = '';
    setParcelamento('avista');
    setTimeout(()=>document.getElementById('m-desc').focus(),80);
  }
};

window.closeModal = () => {
  document.getElementById('modal').classList.add('hidden');
  setParcelamento('avista');
};


let _parcelamentoMode = 'avista';
let _numParcelas      = 2;

window.setParcelamento = function(mode) {
  _parcelamentoMode = mode;
  const btnA = document.getElementById('btn-avista');
  const btnP = document.getElementById('btn-parcelado');
  const opts  = document.getElementById('parcela-opts');
  const sec   = document.getElementById('parcela-section');

  if (mode === 'avista') {
    btnA.style.background   = 'rgba(34,197,110,.15)';
    btnA.style.borderColor  = '#22c56e';
    btnA.style.color        = '#22c56e';
    btnP.style.background   = 'transparent';
    btnP.style.borderColor  = '#27272a';
    btnP.style.color        = '#71717a';
    opts.style.display      = 'none';
  } else {
    btnP.style.background   = 'rgba(34,197,110,.15)';
    btnP.style.borderColor  = '#22c56e';
    btnP.style.color        = '#22c56e';
    btnA.style.background   = 'transparent';
    btnA.style.borderColor  = '#27272a';
    btnA.style.color        = '#71717a';
    opts.style.display      = 'block';
    renderParcelaGrid();
  }
  updateParcelaPreview();

 
  const tipo = document.getElementById('m-tipo').value;
  sec.style.display = tipo === 'Saída' ? '' : 'none';
};

function renderParcelaGrid() {
  const grid = document.getElementById('parcela-grid');
  grid.innerHTML = [2,3,4,5,6,7,8,9,10,11,12].map(n =>
    `<button type="button" onclick="selectParcela(${n})"
      class="parcela-num-btn"
      style="width:38px;height:34px;border-radius:9px;font-size:.8rem;font-weight:600;border:1px solid ${n===_numParcelas?'#22c56e':'#27272a'};background:${n===_numParcelas?'rgba(34,197,110,.15)':'#1c1c1f'};color:${n===_numParcelas?'#22c56e':'#71717a'};cursor:pointer;transition:all .15s">${n}x</button>`
  ).join('');
}

window.selectParcela = function(n) {
  _numParcelas = n;
  renderParcelaGrid();
  updateParcelaPreview();
};

function updateParcelaPreview() {
  const prev  = document.getElementById('parcela-preview');
  const valor = parseFloat(document.getElementById('m-valor').value) || 0;
  if (_parcelamentoMode !== 'parcelado' || !valor) { prev.textContent = ''; return; }
  const parcVal = valor / _numParcelas;
  prev.innerHTML = `<span style="color:#22c56e;font-weight:600">${fmtBRL(parcVal)}/mês</span> · ${_numParcelas} parcelas · Total ${fmtBRL(valor)}`;
}


document.addEventListener('input', e => {
  if (e.target.id === 'm-valor') updateParcelaPreview();
});

window.salvarLancamento = async function() {
  const fid   = document.getElementById('m-id').value;
  const data  = document.getElementById('m-data').value;
  const tipo  = document.getElementById('m-tipo').value;
  const desc  = document.getElementById('m-desc').value.trim();
  const cat   = document.getElementById('m-cat').value;
  const valor = parseFloat(document.getElementById('m-valor').value);
  const obs   = document.getElementById('m-obs').value.trim();

  if (!data||!desc||!valor||valor<=0) {
    await alert_('⚠️','Campos obrigatórios','Preencha data, descrição e valor antes de salvar.');
    return;
  }


  if (!fid && _parcelamentoMode === 'parcelado' && tipo === 'Saída') {
    const parcVal   = Math.round((valor / _numParcelas) * 100) / 100;
    const [y, m, d] = data.split('-').map(Number);
    const criadoEm  = new Date().toISOString();
    const parcGrupo = `parc_${Date.now()}`;

    const payloads = Array.from({ length: _numParcelas }, (_, i) => {
      const dt = new Date(y, m - 1 + i, d);
      const dataISO = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      return {
        data: dataISO,
        tipo,
        descricao: `${desc} (${i+1}/${_numParcelas})`,
        categoria: cat,
        valor: parcVal,
        obs: obs || '',
        parcelaGrupo: parcGrupo,
        parcelaNum: i + 1,
        parcelaTotal: _numParcelas,
        valorTotal: valor,
        updatedAt: criadoEm,
        criadoEm
      };
    });

    try {
      showLoader(true);
      const refs = await Promise.all(payloads.map(p => addDoc(lancCol(), p)));
      refs.forEach((ref, i) => lancamentos.unshift({ firestoreId: ref.id, ...payloads[i] }));
      window.closeModal();
      renderLancamentos();
      renderDashboard();
      toast(`${_numParcelas} parcelas de ${fmtBRL(parcVal)} lançadas!`);
    } catch(e) {
      console.error(e);
      await alert_('❌','Erro ao salvar','Não foi possível salvar as parcelas. Tente novamente.');
    }
    showLoader(false);
    return;
  }

 
  const payload = { data, tipo, descricao:desc, categoria:cat, valor, obs, updatedAt:new Date().toISOString() };
  try {
    if (fid) {
      await updateDoc(lancDoc(fid), payload);
      const idx=lancamentos.findIndex(l=>l.firestoreId===fid);
      lancamentos[idx]={...lancamentos[idx],...payload};
      toast('Lançamento atualizado!');
    } else {
      payload.criadoEm=new Date().toISOString();
      const ref=await addDoc(lancCol(), payload);
      lancamentos.unshift({firestoreId:ref.id,...payload});
      toast('Lançamento adicionado!');
    }
    window.closeModal();
    renderLancamentos();
    renderDashboard();
  } catch(e) {
    console.error(e);
    await alert_('❌','Erro ao salvar','Não foi possível salvar o lançamento. Tente novamente.');
  }
};

window.excluirLancamento = async function(fid, nome, parcelaGrupo) {
  let excluirTodas = false;

  if (parcelaGrupo) {
    const total = lancamentos.filter(l => l.parcelaGrupo === parcelaGrupo).length;
    const ok = await popup({
      icon: '🗑️',
      titulo: 'Excluir parcela',
      texto: `Deseja excluir apenas esta parcela ou todas as ${total} parcelas deste lançamento?`,
      btnOk: `Todas as ${total} parcelas`,
      btnCancel: 'Só esta parcela',
      danger: true
    });
    if (ok === null) return;
    excluirTodas = ok === true;

    if (!excluirTodas) {
      const confirmar = await confirm_('Excluir parcela', `Apenas a parcela "${nome}" será removida.`, {
        icon:'🗑️', btnOk:'Excluir', danger:true
      });
      if (!confirmar) return;
    }
  } else {
    const ok = await confirm_('Excluir lançamento', `"${nome}" será removido permanentemente.`, {
      icon:'🗑️', btnOk:'Excluir', danger:true
    });
    if (!ok) return;
  }

  try {
    if (excluirTodas && parcelaGrupo) {
      const alvo = lancamentos.filter(l => l.parcelaGrupo === parcelaGrupo);
      await Promise.all(alvo.map(l => deleteDoc(lancDoc(l.firestoreId))));
      lancamentos = lancamentos.filter(l => l.parcelaGrupo !== parcelaGrupo);
      toast(`${alvo.length} parcelas excluídas`);
    } else {
      await deleteDoc(lancDoc(fid));
      lancamentos = lancamentos.filter(l => l.firestoreId !== fid);
      toast('Lançamento excluído');
    }
    renderLancamentos(); renderDashboard(); renderPoupanca();
  } catch(e) {
    await alert_('❌','Erro','Não foi possível excluir. Tente novamente.');
  }
};


window.renderPoupanca = function() {
  const tbody = document.getElementById('poup-table-body');
  if (!tbody) return;

  const { saldo, totalDep, totalRes } = calcPoupanca();
  document.getElementById('poup-saldo').textContent     = fmtBRL(saldo);
  document.getElementById('poup-total-dep').textContent  = fmtBRL(totalDep);
  document.getElementById('poup-total-res').textContent  = fmtBRL(totalRes);

  const movs  = lancamentos.filter(l=>l.tipo==='Poupança').sort((a,b)=>b.data.localeCompare(a.data));
  const empty = document.getElementById('poup-empty');
  if (!movs.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  tbody.innerHTML = movs.map((l,i)=>{
    const tag = tagInfo(l);
    return `<tr class="row-anim" style="animation-delay:${i*.025}s">
      <td class="px-4 py-3 font-mono text-xs whitespace-nowrap" style="color:#71717a">${fmtData(l.data)}</td>
      <td class="px-4 py-3">
        <div class="text-sm font-medium text-zinc-200">${l.descricao}</div>
        ${l.obs?`<div class="text-xs mt-0.5" style="color:#52525b">${l.obs}</div>`:''}
      </td>
      <td class="px-4 py-3 hidden sm:table-cell"><span class="${tag.cls}">${tag.label}</span></td>
      <td class="px-4 py-3 text-right font-mono font-medium text-sm" style="color:${tag.color}">${tag.sign} ${fmtBRL(l.valor)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-1 justify-end">
          <button onclick="excluirLancamento('${l.firestoreId}','${l.descricao.replace(/'/g,"&#39;")}')" class="act-btn danger" title="Excluir">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

window.openPoupancaModal = function(direcao) {
  document.getElementById('poupanca-modal').classList.remove('hidden');
  document.getElementById('poup-direcao').value      = direcao;
  document.getElementById('poup-modal-title').textContent = direcao==='Depósito' ? 'Novo depósito' : 'Resgatar da poupança';
  document.getElementById('poup-save-btn').textContent    = direcao==='Depósito' ? 'Depositar' : 'Resgatar';
  document.getElementById('poup-data').value  = new Date().toISOString().split('T')[0];
  document.getElementById('poup-valor').value = '';
  document.getElementById('poup-obs').value   = '';
  setTimeout(()=>document.getElementById('poup-valor').focus(),80);
};

window.closePoupancaModal = () => document.getElementById('poupanca-modal').classList.add('hidden');

window.salvarPoupanca = async function() {
  const direcao = document.getElementById('poup-direcao').value;
  const data    = document.getElementById('poup-data').value;
  const valor   = parseFloat(document.getElementById('poup-valor').value);
  const obs     = document.getElementById('poup-obs').value.trim();

  if (!data || !valor || valor <= 0) {
    await alert_('⚠️','Campos obrigatórios','Preencha a data e um valor válido.');
    return;
  }

  if (direcao === 'Resgate') {
    const { saldo } = calcPoupanca();
    if (valor > saldo + 0.001) {
      await alert_('⚠️','Saldo insuficiente', `Você só tem ${fmtBRL(saldo)} guardados na poupança.`);
      return;
    }
  }

  const agora = new Date().toISOString();
  const payload = {
    data, tipo:'Poupança', direcao,
    categoria: 'Poupança',
    descricao: direcao==='Depósito' ? 'Depósito na poupança' : 'Resgate da poupança',
    valor, obs,
    criadoEm: agora, updatedAt: agora
  };

  try {
    const ref = await addDoc(lancCol(), payload);
    lancamentos.unshift({ firestoreId: ref.id, ...payload });
    window.closePoupancaModal();
    renderPoupanca();
    renderDashboard();
    toast(direcao==='Depósito' ? 'Depósito realizado!' : 'Resgate realizado!');
  } catch(e) {
    console.error(e);
    await alert_('❌','Erro ao salvar','Não foi possível salvar. Tente novamente.');
  }
};

const PALETTE=['#22c56e','#60a5fa','#a78bfa','#f87171','#fbbf24','#f472b6','#22d3ee','#818cf8','#34d399','#fb923c','#9ca3af','#a3e635','#e879f9','#38bdf8','#c4b5fd'];
const ICONS=['🍽️','🚗','🏠','❤️','📚','🎉','👗','📱','📈','📦','🐾','💊','✈️','⚽','🎮','🎵','💄','🔧','💼','🛒','☕','🎁','🏋️','🐶','💡','🏥','🎓','🍺','🧘','🎬'];
let selColor=PALETTE[0], selIcon=ICONS[0];

window.renderCategorias = function() {
  const grid=document.getElementById('cat-grid');
  grid.innerHTML=categorias.map(c=>{
    const t=c.tipo||'Ambos';
    const badgeColor=t==='Entrada'?'rgba(34,197,110,.12)':t==='Saída'?'rgba(248,113,113,.12)':'rgba(161,161,170,.1)';
    const badgeText=t==='Entrada'?'#22c56e':t==='Saída'?'#f87171':'#a1a1aa';
    return `
    <div class="card flex items-center justify-between gap-3 animate-slide-up">
      <div class="flex items-center gap-3">
        <div style="width:40px;height:40px;border-radius:12px;background:${c.cor}18;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${c.icone}</div>
        <div>
          <span class="font-medium text-sm text-zinc-200">${c.nome}</span>
          <div style="margin-top:2px"><span style="font-size:.65rem;font-weight:600;padding:.15rem .5rem;border-radius:99px;background:${badgeColor};color:${badgeText}">${t}</span></div>
        </div>
      </div>
      <div class="flex gap-1 flex-shrink-0">
        <button onclick="openCatModal(${c.id})" class="act-btn" title="Editar">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
        <button onclick="excluirCategoria(${c.id},'${c.nome}')" class="act-btn danger" title="Excluir">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
};
window.openCatModal = function(id) {
  document.getElementById('cat-modal').classList.remove('hidden');
  selColor=PALETTE[0]; selIcon=ICONS[0];
  document.getElementById('color-picker').innerHTML=PALETTE.map(c=>`<div class="color-dot${c===selColor?' selected':''}" style="background:${c}" onclick="selectColor('${c}')"></div>`).join('');
  document.getElementById('icon-picker').innerHTML=ICONS.map(ic=>`<button class="icon-btn${ic===selIcon?' selected':''}" onclick="selectIcon('${ic}')">${ic}</button>`).join('');
  if (id) {
    const c=categorias.find(x=>x.id===id);
    document.getElementById('cat-modal-title').textContent='Editar categoria';
    document.getElementById('cat-edit-id').value=c.id;
    document.getElementById('cat-nome').value=c.nome;
    document.getElementById('cat-tipo').value=c.tipo||'Ambos';
    selectColor(c.cor); selectIcon(c.icone);
  } else {
    document.getElementById('cat-modal-title').textContent='Nova categoria';
    document.getElementById('cat-edit-id').value='';
    document.getElementById('cat-nome').value='';
    document.getElementById('cat-tipo').value='Saída';
    setTimeout(()=>document.getElementById('cat-nome').focus(),80);
  }
};

window.closeCatModal = () => document.getElementById('cat-modal').classList.add('hidden');

window.selectColor = function(c) {
  selColor=c;
  document.querySelectorAll('.color-dot').forEach(d=>{
    const bg=d.style.background;
    d.classList.toggle('selected', bg===c||bg===hexToRgb(c));
  });
};
window.selectIcon = function(ic) {
  selIcon=ic;
  document.querySelectorAll('.icon-btn').forEach(b=>b.classList.toggle('selected',b.textContent.trim()===ic));
};
function hexToRgb(h){const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return `rgb(${r}, ${g}, ${b})`;}

async function saveCategorias() { await setDoc(cfgDoc('categorias'),{lista:categorias}); }

window.salvarCategoria = async function() {
  const id  =document.getElementById('cat-edit-id').value;
  const nome=document.getElementById('cat-nome').value.trim();
  const tipo=document.getElementById('cat-tipo').value;
  if (!nome) {
    await alert_('⚠️','Campo obrigatório','Informe um nome para a categoria.');
    return;
  }
  if (id) {
    const idx=categorias.findIndex(c=>c.id==id);
    categorias[idx]={...categorias[idx],nome,cor:selColor,icone:selIcon,tipo};
    toast('Categoria atualizada!');
  } else {
    categorias.push({id:Date.now(),nome,cor:selColor,icone:selIcon,tipo});
    toast('Categoria criada!');
  }
  await saveCategorias();
  window.closeCatModal(); window.renderCategorias();
};

window.excluirCategoria = async function(id, nome) {
  const cat=categorias.find(c=>c.id===id);
  if (lancamentos.some(l=>l.categoria===cat?.nome)) {
    await alert_('🔒','Categoria em uso',`"${nome}" está sendo usada em lançamentos e não pode ser excluída.`);
    return;
  }
  const ok = await confirm_('Excluir categoria', `"${nome}" será removida permanentemente.`, {
    icon:'🗑️', btnOk:'Excluir', danger:true
  });
  if (!ok) return;
  categorias=categorias.filter(c=>c.id!==id);
  await saveCategorias();
  window.renderCategorias();
  toast('Categoria excluída');
};

window.loadConfig = function() {
  document.getElementById('cfg-nome').value    = config.nome || currentUser.displayName || '';
  document.getElementById('cfg-salario').value = config.salario ||'';
  document.getElementById('cfg-meta').value    = config.meta    ||20;
  const agora=new Date();
  document.getElementById('pdf-mes').value=MESES[agora.getMonth()];
  document.getElementById('pdf-ano').value=String(agora.getFullYear());
};

window.saveConfig = async function() {
  config.nome    = document.getElementById('cfg-nome').value.trim() || currentUser.displayName || '';
  config.salario = parseFloat(document.getElementById('cfg-salario').value)||0;
  config.meta    = parseFloat(document.getElementById('cfg-meta').value)||20;
  await setDoc(cfgDoc('main'), config);
  initUserInfo();
  toast('Configurações salvas!');
};

window.limparDados = async function() {
  const ok = await confirm_(
    'Apagar todos os lançamentos',
    'Esta ação é irreversível. Todos os seus lançamentos serão deletados permanentemente.',
    { icon:'⚠️', btnOk:'Apagar tudo', danger:true }
  );
  if (!ok) return;
  showLoader(true);
  try {
    const snap=await getDocs(lancCol());
    await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
    lancamentos=[];
    renderDashboard();
    toast('Todos os dados foram apagados');
  } catch(e) {
    await alert_('❌','Erro','Não foi possível apagar os dados. Tente novamente.');
  }
  showLoader(false);
};


window.gerarPDF = function() {
  const mes=document.getElementById('pdf-mes').value;
  const ano=document.getElementById('pdf-ano').value;
  const nome=config.nome||currentUser.displayName||'Usuário';
  const sal=config.salario||0;
  const doMes=[...lancamentos].filter(l=>mesDeData(l.data)===mes&&anoDeData(l.data)===ano).sort((a,b)=>a.data.localeCompare(b.data));
  const totalE=doMes.filter(l=>l.tipo==='Entrada').reduce((a,l)=>a+l.valor,0);
  const totalS=doMes.filter(l=>l.tipo==='Saída').reduce((a,l)=>a+l.valor,0);
  const totalDep=doMes.filter(l=>l.tipo==='Poupança'&&l.direcao==='Depósito').reduce((a,l)=>a+l.valor,0);
  const totalRes=doMes.filter(l=>l.tipo==='Poupança'&&l.direcao==='Resgate').reduce((a,l)=>a+l.valor,0);
  const saldoAnt=saldoAcumuladoAnterior(mes, ano);
  const saldo=saldoAnt+sal+totalE-totalS-totalDep+totalRes;
  let acc=saldoAnt+sal;
  const linhas=doMes.map(l=>{
    if (l.tipo==='Entrada') acc+=l.valor;
    else if (l.tipo==='Saída') acc-=l.valor;
    else if (l.tipo==='Poupança') acc += l.direcao==='Resgate' ? l.valor : -l.valor;
    return {...l,acc};
  });
  const geradoEm=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Extrato ${mes} ${ano}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#fff;color:#18181b;font-size:13px}
.page{max-width:750px;margin:0 auto;padding:40px 32px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #18181b}
.brand{font-size:22px;font-weight:700;letter-spacing:-.02em}.brand span{color:#16a357}
.h-right{text-align:right}.h-right .ttl{font-size:15px;font-weight:600}.h-right .sub{font-size:11px;color:#71717a;margin-top:2px}
.slabel{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#71717a;margin-bottom:8px}
.tbox{background:#f4f4f5;border-radius:10px;padding:14px 18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
.tbox .name{font-size:15px;font-weight:600}.tbox .per{font-size:13px;color:#71717a}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
.sc{background:#f4f4f5;border-radius:10px;padding:14px 16px}
.sc .l{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#71717a;margin-bottom:6px}
.sc .v{font-family:'DM Mono',monospace;font-size:14px;font-weight:500}
.vb{color:#1d4ed8}.vg{color:#16a357}.vr{color:#dc2626}
table{width:100%;border-collapse:collapse}thead tr{border-bottom:1.5px solid #18181b}
th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#71717a;padding:0 8px 8px;text-align:left}
th.r{text-align:right}tbody tr{border-bottom:1px solid #e4e4e7}tbody tr:last-child{border-bottom:none}
tr.er{background:#f0fdf4}tr.pr{background:#faf5ff}td{padding:9px 8px;font-size:12px;vertical-align:middle}
td.mono{font-family:'DM Mono',monospace;font-size:11px}td.r{text-align:right}
td.g{color:#16a357;font-weight:600}td.rd{color:#dc2626;font-weight:600}td.mt{color:#71717a}
.pill{display:inline-block;font-size:10px;font-weight:500;padding:2px 8px;border-radius:99px;background:#e4e4e7;color:#3f3f46}
.tot td{font-weight:700;border-top:1.5px solid #18181b;padding-top:10px}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e4e4e7;display:flex;justify-content:space-between}
.footer span{font-size:10px;color:#a1a1aa}.empty{text-align:center;padding:40px;color:#a1a1aa}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{padding:20px}}</style>
</head><body><div class="page">
<div class="header"><div><div class="brand">fin<span>ança</span></div><div style="font-size:11px;color:#71717a;margin-top:4px">controle financeiro pessoal</div></div>
<div class="h-right"><div class="ttl">Extrato Mensal</div><div class="sub">${mes} de ${ano}</div><div class="sub" style="margin-top:4px">Gerado em ${geradoEm}</div></div></div>
<div class="slabel">Titular</div><div class="tbox"><div class="name">${nome}</div><div class="per">${mes} / ${ano}</div></div>
<div class="slabel">Resumo do mês</div>
<div class="grid">
<div class="sc"><div class="l">Salário</div><div class="v vb">${fmtBRL(sal)}</div></div>
<div class="sc"><div class="l">Entradas</div><div class="v vg">${fmtBRL(totalE)}</div></div>
<div class="sc"><div class="l">Saídas</div><div class="v vr">${fmtBRL(totalS)}</div></div>
<div class="sc"><div class="l">Depositado na poupança</div><div class="v" style="color:#7c3aed">${fmtBRL(totalDep)}</div></div>
<div class="sc"><div class="l">Resgatado da poupança</div><div class="v" style="color:#7c3aed">${fmtBRL(totalRes)}</div></div>
<div class="sc"><div class="l">Saldo anterior</div><div class="v ${saldoAnt>=0?'vg':'vr'}">${fmtBRL(saldoAnt)}</div></div>
<div class="sc"><div class="l">Saldo final</div><div class="v ${saldo>=0?'vg':'vr'}">${fmtBRL(saldo)}</div></div>
</div>
<div class="slabel">Movimentações · ${linhas.length} ${linhas.length===1?'lançamento':'lançamentos'}</div>
${!linhas.length?'<div class="empty">Nenhum lançamento neste período</div>':`
<table><thead><tr><th style="width:80px">Data</th><th>Descrição</th><th style="width:110px">Categoria</th><th class="r" style="width:90px">Valor</th><th class="r" style="width:100px">Saldo</th></tr></thead>
<tbody>${linhas.map(l=>{const isE=l.tipo==='Entrada';const isPoup=l.tipo==='Poupança';const isRes=isPoup&&l.direcao==='Resgate';const positivo=isE||isRes;const rowCls=isE?'er':(isPoup?'pr':'');const cat=getCat(l.categoria);return`<tr class="${rowCls}"><td class="mono mt">${fmtData(l.data)}</td><td><div style="font-weight:500">${l.descricao}</div>${l.obs?`<div style="font-size:10px;color:#71717a">${l.obs}</div>`:''}</td><td><span class="pill">${cat.icone} ${l.categoria}</span></td><td class="mono r ${positivo?'g':'rd'}">${positivo?'+':'−'} ${fmtBRL(l.valor)}</td><td class="mono r ${l.acc>=0?'g':'rd'}">${fmtBRL(l.acc)}</td></tr>`;}).join('')}
<tr class="tot"><td colspan="3" style="font-size:11px;color:#71717a">Total do período</td><td class="r mono ${(totalE-totalS)>=0?'g':'rd'}">${(totalE-totalS)>=0?'+':'−'} ${fmtBRL(Math.abs(totalE-totalS))}</td><td class="r mono ${saldo>=0?'g':'rd'}">${fmtBRL(saldo)}</td></tr>
</tbody></table>`}
<div class="footer"><span>finança — controle financeiro pessoal</span><span>Documento gerado automaticamente · ${geradoEm}</span></div>
</div><script>window.onload=()=>window.print();<\/script></body></html>`;

  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const iframe=document.createElement('iframe');
  iframe.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
  document.body.appendChild(iframe);
  iframe.onload=()=>{setTimeout(()=>{iframe.contentWindow.focus();iframe.contentWindow.print();setTimeout(()=>{document.body.removeChild(iframe);URL.revokeObjectURL(url);},2000);},600);};
  iframe.src=url;
  toast(`Extrato de ${mes}/${ano} pronto!`);
};


document.getElementById('modal').addEventListener('click', e=>{if(e.target===document.getElementById('modal'))window.closeModal();});
document.getElementById('cat-modal').addEventListener('click', e=>{if(e.target===document.getElementById('cat-modal'))window.closeCatModal();});
document.getElementById('poupanca-modal')?.addEventListener('click', e=>{if(e.target===document.getElementById('poupanca-modal'))window.closePoupancaModal();});
document.addEventListener('keydown', e=>{if(e.key==='Escape'){window.closeModal();window.closeCatModal();window.closePoupancaModal();closeNovidades();document.getElementById('mobile-profile-dropdown')?.classList.add('hidden');}});

const CHANGELOG = [

  {
    versao: '1.4.0',
    data: '2026-06-26',
    emoji: '🐷',
    titulo: ' Poupança & Barra de navegação',
    itens: [
      'Nova seção de Poupança para depósitos e resgates',
      'Cálculo automático do saldo da poupança e exibição no dashboard',
      'Nova barra de navegação superior na versão mobile para acesso rápido às seções',
    ]
  },

  {
    versao: '1.3.0',
    data: '2026-05-10',
    emoji: '🎉',
    titulo: 'Novidades & Sugestões',
    itens: [
      'Novo painel de atualizações para acompanhar o que mudou no app',
      'Formulário de sugestão de features enviado direto ao Firestore',
      'Badge verde na sidebar indica quando há novidades não lidas',
    ]
  },
  {
    versao: '1.2.0',
    data: '2026-05-4',
    emoji: '💳',
    titulo: 'Lançamentos parcelados',
    itens: [
      'Suporte a compras parceladas: distribui automaticamente por mês',
      'Visualização de parcela (ex: 2/6) na lista de lançamentos',
      'Edição e exclusão individual ou em lote das parcelas',
    ]
  },
  {
    versao: '1.1.0',
    data: '2026-04-20',
    emoji: '📄',
    titulo: 'Extrato em PDF',
    itens: [
      'Geração de extrato bancário mensal em PDF com saldo acumulado',
      'Layout profissional com resumo e tabela de movimentações',
      'Exportação direta pelo painel ou pela página de lançamentos',
    ]
  },
  {
    versao: '1.0.0',
    data: '2026-03-15',
    emoji: '🚀',
    titulo: 'Lançamento do finança',
    itens: [
      'Dashboard com KPIs: salário, gastos, saldo e entradas',
      'Gráfico de linha com evolução do saldo e pizza por categoria',
      'Categorias personalizáveis com cor e ícone',
      'Autenticação real com Firebase e dados na nuvem',
    ]
  },
];

const ULTIMA_VERSAO_KEY = 'financa_ultima_versao_vista';

function checkNovidadesBadge() {
  const visto = localStorage.getItem(ULTIMA_VERSAO_KEY);
  const atual = CHANGELOG[0]?.versao;
  const badge  = document.getElementById('novidades-badge');
  const bbadge = document.getElementById('bnav-novidades-badge');
  if (badge)  badge.classList.toggle('hidden', visto === atual);
  if (bbadge) bbadge.classList.toggle('hidden', visto === atual);
}

window.openNovidades = function() {
  renderChangelog();
  document.getElementById('novidades-modal').classList.remove('hidden');

  localStorage.setItem(ULTIMA_VERSAO_KEY, CHANGELOG[0]?.versao || '');
  checkNovidadesBadge();
};

window.closeNovidades = function() {
  document.getElementById('novidades-modal').classList.add('hidden');
};

window.switchNovidadesTab = function(tab) {
  const tabs   = ['changelog', 'sugestao'];
  const ativo  = { borderColor: '#22c56e', color: '#22c56e', background: 'rgba(34,197,110,.06)' };
  const inativo= { borderColor: 'transparent', color: '#71717a', background: 'transparent' };
  tabs.forEach(t => {
    const btn   = document.getElementById(`ntab-${t}`);
    const panel = document.getElementById(`npanel-${t}`);
    const isActive = t === tab;
    Object.assign(btn.style,   isActive ? ativo : inativo);
    panel.style.display = isActive ? 'block' : 'none';
  });
};

function renderChangelog() {
  const container = document.getElementById('changelog-list');
  if (!container) return;

  const fmtDataPt = iso => {
    const [y,m,d] = iso.split('-');
    const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    return `${d} de ${meses[parseInt(m)-1]}. de ${y}`;
  };

  container.innerHTML = CHANGELOG.map((entry, i) => `
    <div class="animate-slide-up" style="animation-delay:${i*0.05}s">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base" style="background:#1c1c1f;border:1px solid #27272a">${entry.emoji}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-semibold text-white">${entry.titulo}</span>
            <span class="text-xs px-1.5 py-0.5 rounded font-mono" style="background:#1c1c1f;color:#52525b;border:1px solid #27272a">v${entry.versao}</span>
            ${i === 0 ? '<span class="text-xs px-1.5 py-0.5 rounded font-semibold" style="background:rgba(34,197,110,.12);color:#22c56e">Novo</span>' : ''}
          </div>
          <div class="text-xs mt-0.5 mb-2" style="color:#52525b">${fmtDataPt(entry.data)}</div>
          <ul class="space-y-1">
            ${entry.itens.map(item => `
              <li class="flex items-start gap-2 text-sm" style="color:#a1a1aa">
                <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style="color:#22c56e" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                ${item}
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
      ${i < CHANGELOG.length - 1 ? '<div class="mt-4 border-t" style="border-color:#1f1f23"></div>' : ''}
    </div>
  `).join('');
}

window.enviarSugestao = async function() {
  const titulo = document.getElementById('sug-titulo').value.trim();
  const desc   = document.getElementById('sug-desc').value.trim();
  const cat    = document.getElementById('sug-cat').value;

  if (!titulo) {
    document.getElementById('sug-titulo').focus();
    toast('Preencha o título da sugestão.', 'err');
    return;
  }
  if (!desc || desc.length < 10) {
    document.getElementById('sug-desc').focus();
    toast('Descreva melhor sua ideia (mín. 10 caracteres).', 'err');
    return;
  }

  const btn = document.getElementById('btn-enviar-sug');
  btn.disabled = true;
  btn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Enviando…`;

  try {
    const sugestoesCol = collection(db, 'sugestoes');
    await addDoc(sugestoesCol, {
      titulo,
      descricao: desc,
      categoria: cat,
      usuario: currentUser?.email || 'anônimo',
      uid: currentUser?.uid || null,
      enviadoEm: new Date().toISOString(),
      status: 'pendente',
    });

    document.getElementById('sug-titulo').value = '';
    document.getElementById('sug-desc').value   = '';
    document.getElementById('sug-cat').value    = 'nova-funcao';

    closeNovidades();
    toast('Sugestão enviada! Obrigado pela contribuição 🙌');
  } catch(e) {
    console.error(e);
    toast('Erro ao enviar. Tente novamente.', 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg> Enviar sugestão`;
  }
};


document.getElementById('novidades-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('novidades-modal')) closeNovidades();
});


checkNovidadesBadge();
