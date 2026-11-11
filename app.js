/* ГИА — offline-first training app. Questions and source keys are from the university PDF. */
(() => {
'use strict';
const DATA=window.GIA_DATA || {questions:[],cases:[],metadata:{}};
const CONFIG=window.GIA_CLOUD || {};
const CASE_MEDIA=window.GIA_CASE_MEDIA || {};
let giaTurnstileWidget=null;
const Q=DATA.questions, CASES=DATA.cases, QM=new Map(Q.map(q=>[q.id,q]));
const $=(selector)=>document.querySelector(selector);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nl=s=>safe(s).replace(/\n/g,'<br>');
const icon=(name,cls='')=>`<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const KEY='gia_sibsmu_events_v1', TOKEN='gia_sibsmu_auth_v1', DRAFT='gia_sibsmu_drafts_v1', THEME='gia_sibsmu_theme_v1', PALETTE='gia_sibsmu_palette_v1', GUEST='gia_sibsmu_guest_v5', GENERATION='gia_sibsmu_generation_v6', DRAFT_TIMES='gia_sibsmu_draft_timestamps_v7';
const when=()=>new Date().toISOString();
const guid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)});
const read=(key,alt)=>{try{return JSON.parse(localStorage.getItem(key))??alt}catch{return alt}};
const set=(key,val)=>{try{localStorage.setItem(key,JSON.stringify(val))}catch(e){notify('Не удаётся сохранить данные в этом режиме. Открой приложение на HTTPS-сайте или освободи место.','error')}};
let auth=read(TOKEN,null),guestMode=read(GUEST,false),events=[],drafts={},draftTimes={};
function cloudReady(){return !!(CONFIG.url&&CONFIG.anonKey)}
function accountId(){return cloudReady()&&auth?.access_token&&auth?.user?.id?auth.user.id:null}
function usernameEmail(u){return 'giamed_'+String(u||'').trim().toLowerCase()+'@example.org';}
function accountName(){return auth?.user?.user_metadata?.nickname || auth?.user?.user_metadata?.username || 'Пользователь'}
function accountLogin(){return auth?.user?.user_metadata?.username || '—'}
function ownerKey(base){return accountId()?`${base}:user:${accountId()}`:base}
function loadOwnerData(){events=read(ownerKey(KEY),[]);drafts=read(ownerKey(DRAFT),{});draftTimes=read(ownerKey(DRAFT_TIMES),{});}
function saveEvents(){set(ownerKey(KEY),events)}
function saveDrafts(){set(ownerKey(DRAFT),drafts);set(ownerKey(DRAFT_TIMES),draftTimes)}
loadOwnerData();
let ui={resetOpen:false,newRecoveryCode:'',authMode:'login',authMessage:'',authBusy:false,recoveryPending:false,paletteOpen:false,tab:'home',sub:'blocks',search:'',caseSearch:'',caseId:null,sessionId:null,reportId:null,infoQuestion:null,sort:'all',modal:null,reviewText:'',cloudBusy:false,cloudMessage:'',cloudStatus:'idle',showCaseReference:false,explanation:false,figure:null};
// Панель доступна только после ответа сервера gia-admin (локальный флаг не даёт прав).
let adminUi={allowed:false,loading:false,checked:false,users:[],total:0,page:1,search:'',error:'',action:null,audit:[],busy:false,issued:null};
let leagueUi={category:'week',data:null,loading:false,error:'',loadedAt:0};
const LEAGUE_CATEGORIES=[['week','Неделя'],['alltime','За всё время'],['coverage','Охват'],['accuracy','Точность']];
function adminReset(){adminUi={allowed:false,loading:false,checked:false,users:[],total:0,page:1,search:'',error:'',action:null,audit:[],busy:false,issued:null};}
function leagueReset(){leagueUi={category:'week',data:null,loading:false,error:'',loadedAt:0};}
const todayKey=date=>new Date(date).toLocaleDateString('sv-SE');
let toastTimeout=null;
function notify(msg,type='ok') { const el=$('#toast'); if(!el)return;el.textContent=msg;el.className='toast visible '+type;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.className='toast',3900);}
function append(type,extra={},opts={}) {const e={id:guid(),type,at:when(),...extra};events.push(e);saveEvents(); if(!opts.silent)render();scheduleSync();return e;}
const evt=(type)=>events.filter(x=>x.type===type);
const byTime=(a,b)=>String(a.at).localeCompare(String(b.at))||(String(a.id).localeCompare(String(b.id)));
function indexes(){
 const attempts=evt('attempt').sort(byTime), byQ=new Map(),bySession=new Map();
 for(const e of attempts){if(!byQ.has(e.qid))byQ.set(e.qid,[]);byQ.get(e.qid).push(e);if(!bySession.has(e.sessionId))bySession.set(e.sessionId,[]);bySession.get(e.sessionId).push(e);}
 const starts=evt('session_start').sort(byTime), cursors=evt('session_cursor').sort(byTime), ends=evt('session_end').sort(byTime);
 const ended=new Set(ends.map(x=>x.sessionId));
 const active=starts.filter(x=>!ended.has(x.sessionId)).at(-1)||null;
 const bookmarks=new Map();for(const e of evt('star').sort(byTime))bookmarks.set(e.qid,!!e.active);
 const cases=new Map();for(const e of evt('case_review').sort(byTime))cases.set(e.caseId,e);
 return {attempts,byQ,bySession,starts,cursors,ends,active,bookmarks,cases};
}
const PALETTES=[
 {id:'sage',name:'Хвойный',desc:'Сдержанный зелёный · основной',swatches:['#f7f8fa','#ffffff','#276d59']},
 {id:'mint',name:'Мятный',desc:'Прохладный бирюзовый акцент',swatches:['#f7f8fa','#ffffff','#167b78']},
 {id:'sky',name:'Океан',desc:'Глубокий сине-голубой',swatches:['#f7f8fa','#ffffff','#326d91']},
 {id:'lavender',name:'Ирис',desc:'Спокойный индиго',swatches:['#f7f8fa','#ffffff','#665ab0']},
 {id:'sand',name:'Терракота',desc:'Тёплый древесный',swatches:['#f7f8fa','#ffffff','#976548']},
 {id:'original',name:'Оригинальная',desc:'Фиолетовый и розовый из первой версии',swatches:['#f7f7fc','#7956e9','#d64ca0']}
];
function paletteId(v){return PALETTES.some(p=>p.id===v)?v:'sage';}
function initTheme(){const mode=read(THEME,'light'),root=document.documentElement;root.dataset.theme=mode==='dark'?'dark':'light';root.dataset.palette=paletteId(read(PALETTE,'sage'));}
function paletteChoices(){
 const active=paletteId(document.documentElement.dataset.palette);
 return PALETTES.map(p=>`<button type="button" class="palette-choice ${p.id===active?'is-active':''}" data-palette-select="${p.id}" aria-pressed="${p.id===active}" aria-label="${p.name} — ${p.desc}"><span class="palette-sample" style="--swatch-a:${p.swatches[0]};--swatch-b:${p.swatches[1]};--swatch-c:${p.swatches[2]}"><i></i><i></i><i></i></span><span class="palette-text"><strong>${p.name}</strong><small>${p.desc}</small></span><span class="palette-check" aria-hidden="true">${icon('check')}</span></button>`).join('');
}
function questionStats(q,ix){const list=ix.byQ.get(q.id)||[];const last=list.at(-1);return {seen:list.length>0,mastered:last?.correct===true,wrong:list.some(x=>!x.correct),last,first:list[0]};}
function overall(ix){const valid=Q.filter(q=>q.a),unique=valid.filter(q=>ix.byQ.has(q.id));const mastered=valid.filter(q=>questionStats(q,ix).mastered);const wrong=valid.filter(q=>questionStats(q,ix).wrong);const errors=valid.filter(q=>{const z=questionStats(q,ix);return z.seen&&!z.mastered});const firstCorrect=unique.filter(q=>questionStats(q,ix).first.correct).length;
 return {valid:valid.length,unique:unique.length,mastered:mastered.length,wrong:wrong.length,unresolved:errors.length,attempts:ix.attempts.filter(e=>QM.get(e.qid)?.a).length,correctAttempts:ix.attempts.filter(e=>e.correct).length,firstCorrect,errors};}
function dueInfo(q,ix){const history=ix.byQ.get(q.id)||[];if(!history.length)return null;let streak=0;for(let i=history.length-1;i>=0;i--){if(history[i].correct)streak++;else break;}const days=streak===0?1:[1,3,7,14,30,60][Math.min(streak-1,5)];const since=Date.parse(history.at(-1).at);return {due:since+(days*86400000),streak};}
function streak(ix){let days=[...new Set(ix.attempts.map(e=>todayKey(e.at)))].sort().reverse(), n=0;if(!days.length)return 0;let d=new Date();let key=todayKey(d);if(!days.includes(key)){d.setDate(d.getDate()-1);key=todayKey(d)}while(days.includes(key)){n++;d.setDate(d.getDate()-1);key=todayKey(d)}return n;}
const pct=(a,b)=>b?Math.round(a/b*100):0;
function bar(p,kind='') {return `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><span class="bar-fill ${kind}" style="width:${Math.min(100,Math.max(0,p))}%"></span></div>`;}
function blockData(){return Array.from({length:Math.ceil(Q.length/50)},(_,i)=>({n:i+1,from:i*50+1,to:Math.min((i+1)*50,Q.length),qs:Q.slice(i*50,(i+1)*50)}));}
function themeClass(tab){return ui.tab===tab?'active':'';}
function navButton(tab,label,ico,number=''){return `<button class="nav-link ${themeClass(tab)}" data-tab="${tab}" aria-label="${label}">${icon(ico)}<span>${label}</span>${number?`<b class="nav-count">${number}</b>`:''}</button>`;}
function shell(inner,ix){
 const o=overall(ix),dark=document.documentElement.dataset.theme==='dark';
 const brand=`<span class="brand-symbol">${icon("book")}</span><span class="brand-copy"><b>ГИА<span class="brand-dot">.</span>мед</b><small>СибГМУ · Лечебное дело</small></span>`;
 const mobileBrand=`<span class="brand-symbol">${icon("book")}</span><b>ГИА<span class="brand-dot">.</span>мед</b>`;
 const themeButton=`<button type="button" class="theme-quick" data-theme-toggle="1" aria-label="${dark?'Включить светлую тему':'Включить тёмную тему'}" title="${dark?'Светлая тема':'Тёмная тема'}">${icon(dark?'sun':'moon')}<span>${dark?'Светлая':'Тёмная'}</span></button>`;
 const paletteButton=`<div class="palette-control"><button type="button" class="theme-quick palette-quick ${ui.paletteOpen?'is-open':''}" data-palette-picker="1" aria-label="Выбрать цветовую палитру" aria-expanded="${!!ui.paletteOpen}" aria-controls="palettePanel">${icon('palette')}<span>Цвета</span></button>${ui.paletteOpen?`<div class="palette-popover" id="palettePanel" role="group" aria-label="Выбор цветовой палитры"><div class="palette-popover-title"><span>${icon('palette')} Оформление</span><button type="button" class="palette-close" data-palette-picker="1" aria-label="Закрыть выбор оформления">${icon('x-circle')}</button></div><p>Выбери оттенки, которые комфортны для учёбы. Изменения сохранятся автоматически.</p><div class="palette-options">${paletteChoices()}</div><div class="palette-popover-footer">${icon('info')} Светлый и тёмный режимы переключаются отдельно.</div></div>`:''}</div>`;
 return `<div class="layout"><aside class="sidebar"><button type="button" class="brand brand-button" data-tab="home" aria-label="Перейти на главную">${brand}</button><div class="side-group">НАВИГАЦИЯ</div><nav class="sidenav" aria-label="Разделы">${navButton('home','Главная','home')}${navButton('tests','Тесты','grid')}${navButton('cases','Практика','clipboard')}${navButton('mistakes','Ошибки','alert',o.unresolved||'')}${navButton('stats','Статистика','chart')}${navButton('league','Лига','trophy')}${navButton('profile','Профиль','user')}${adminUi.allowed?navButton('admin','Администрирование','shield'):''}</nav><div class="sidebar-foot"><div class="side-progress-caption">ОХВАТ БАЗЫ <strong>${pct(o.unique,o.valid)}%</strong></div>${bar(pct(o.unique,o.valid))}<small>${o.unique} из ${o.valid} вопросов</small><p>Постоянная практика — основа уверенной сдачи ГОСов.</p></div></aside><div class="body"><header class="topbar"><button type="button" class="mobile-brand brand-button" data-tab="home" aria-label="Перейти на главную">${mobileBrand}</button><div class="topline">ПОДГОТОВКА К ГОСЭКЗАМЕНУ <span class="dotsep">·</span> ЛЕЧЕБНОЕ ДЕЛО</div><div class="top-right">${paletteButton}${themeButton}<span class="streak">${icon('flame')} ${streak(ix)} дн.</span><button type="button" class="avatar avatar-button" data-tab="profile" aria-label="Открыть профиль" title="Профиль">${safe(accountName().charAt(0).toUpperCase())}</button></div></header><main class="main" id="mainContent">${inner}</main></div><nav class="bottomnav" aria-label="Основные разделы">${navButton('home','Главная','home')}${navButton('tests','Тесты','grid')}${navButton('cases','Задачи','clipboard')}${navButton('mistakes','Ошибки','alert',o.unresolved||'')}${navButton('stats','Статистика','chart')}${navButton('league','Лига','trophy')}</nav></div>`;
}

function hero(ix){const o=overall(ix), p=pct(o.unique,o.valid);return `<section class="hero"><div class="hero-glow"></div><div class="eyebrow on-hero">ПРОГРАММА ГИА · СИБГМУ 2025</div><h1>Твой путь<br>к уверенной сдаче.</h1><p>Без лишнего стресса. В своём темпе.<br>Один вопрос — один шаг к цели.</p><div class="hero-progress"><div class="hero-progress-top"><strong>${p}%</strong><span>${o.unique} / ${o.valid} проверяемых вопросов</span><span class="hero-goal">ОХВАТ БАЗЫ</span></div>${bar(p,'light')}</div></section>`;}
function miniStats(ix){const o=overall(ix);return `<div class="stats-grid"><div class="metric"><span class="metric-icon violet">${icon('target')}</span><span>Освоено вопросов</span><b>${o.mastered}</b><small>Последний ответ правильный</small></div><div class="metric"><span class="metric-icon teal">${icon('check')}</span><span>Точность ответов</span><b>${pct(o.correctAttempts,o.attempts)}%</b><small>${o.correctAttempts} из ${o.attempts} попыток</small></div><div class="metric"><span class="metric-icon coral">${icon('repeat')}</span><span>Требуют внимания</span><b>${o.unresolved}</b><small>Ошибки ещё не исправлены</small></div></div>`;}

// ГИА.мед v10.2: calendar-day countdown to the start of the state-exam week.
// Count calendar dates, not elapsed 24-hour periods: daylight-saving changes
// and the time of day must never make the number jump unexpectedly.
const GIA_WEEK_START_UTC=Date.UTC(2027,5,23);
function giaLocalDateKey(date=new Date()){
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function giaDaysRemaining(date=new Date()){
 const today=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
 return Math.round((GIA_WEEK_START_UTC-today)/86400000);
}
function giaDayWord(number){
 const end=number%10,lastTwo=number%100;
 return lastTwo>=11&&lastTwo<=14?'дней':end===1?'день':end>=2&&end<=4?'дня':'дней';
}
function giaCountdownView(now=new Date()){
 const days=giaDaysRemaining(now),isToday=days===0,isFuture=days>0;
 const title=isFuture?'До начала экзаменационной недели':isToday?'ГИА начинается сегодня!':'Дата начала экзаменационной недели прошла';
 const message=isFuture?'Каждый решённый вопрос приближает к цели.':'Начало экзаменационной недели — 23 июня 2027 года.';
 const number=isFuture?String(days):isToday?'Сегодня':'23.06';
 const unit=isFuture?giaDayWord(days):isToday?'первый день':'2027 год';
 return `<section id="giaCountdown" class="gia-countdown" data-gia-day="${giaLocalDateKey(now)}" aria-label="${safe(title)}: ${isFuture?`${days} ${unit}`:'23 июня 2027 года'}">
  <div class="gia-countdown-copy">
   <div class="gia-countdown-kicker">${icon('clock')} <span>ГИА · 2027</span></div>
   <h2>${title}</h2>
   <p class="gia-countdown-date">23 июня 2027 <span aria-hidden="true">·</span> начало госэкзаменов</p>
   <p class="gia-countdown-note">${message}</p>
  </div>
  <div class="gia-countdown-value ${isFuture?'':'gia-countdown-finished'}" aria-hidden="true">
   <strong>${number}</strong><span>${unit}</span>
  </div>
 </section>`;
}
function refreshGiaCountdown(){
 const node=$('#giaCountdown');
 if(node&&node.dataset.giaDay!==giaLocalDateKey())node.outerHTML=giaCountdownView();
}

function homeView(ix){
 const o=overall(ix),allStarts=new Map(ix.starts.map(s=>[s.sessionId,s]));
 const ended=ix.ends.filter(e=>e.reason==='finished'&&allStarts.has(e.sessionId));
 const sessions=ended.slice(-10).map(e=>{
  const start=allStarts.get(e.sessionId), attempts=ix.bySession.get(e.sessionId)||[];
  const total=start.ids.filter(id=>QM.get(id)?.a).length;
  return {score:pct(attempts.filter(a=>a.correct).length,total),count:total,date:e.at,mode:start.mode};
 });
 const firstAccuracy=pct(o.firstCorrect,o.unique),accuracy=pct(o.correctAttempts,o.attempts);
 const recent=Array.from({length:14},(_,i)=>{
  const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(13-i));
  const key=todayKey(d),subset=ix.attempts.filter(a=>todayKey(a.at)===key);
  return {key,count:subset.length,correct:subset.filter(a=>a.correct).length,day:d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})};
 });
 const last7=recent.slice(7).reduce((n,d)=>n+d.count,0),prev7=recent.slice(0,7).reduce((n,d)=>n+d.count,0);
 const today=recent.at(-1).count,peak=Math.max(1,...recent.map(d=>d.count));
 const due=Q.filter(q=>q.a&&dueInfo(q,ix)?.due<=Date.now()).length;
 const reviewed=[...ix.cases.values()],goodCases=reviewed.filter(e=>e.verdict==='good').length;
 const avgMs=ix.attempts.map(a=>a.responseMs).filter(ms=>ms>0&&ms<3600000);
 const avgSecs=avgMs.length?Math.round(avgMs.reduce((sum,n)=>sum+n,0)/avgMs.length/1000):0;
 const remaining=Q.length-o.unique;
 const nextBlock=blockData().find(b=>b.qs.some(q=>!ix.byQ.has(q.id)))||blockData()[0];
 const caseP=pct(reviewed.length,CASES.length);
 const linePts=sessions.map((s,i)=>`${30+i*(440/Math.max(1,sessions.length-1))},${125-s.score*1.05}`).join(' ');
 const currentWeekText=last7===prev7?'Так же, как на прошлой неделе':`${last7>prev7?'+':''}${last7-prev7} к прошлой неделе`;
 return `${accountId()&&ui.cloudStatus==='error'?`<div class="auth-notice" role="status" style="margin:0 0 18px;border-color:#bd8a85">${icon('alert')} <span>${safe(ui.cloudMessage)}. Результаты сохранены на этом устройстве. Проверь сеть и раздел «Профиль».</span></div>`:''}<section class="home-heading"><div><div class="eyebrow">ТВОЯ ПОДГОТОВКА · СИБГМУ</div><h1>Главная</h1><p>Вся подготовка под контролем: результаты, динамика и следующий шаг.</p></div><span class="home-date">${safe(new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'}))}</span></section>
 ${giaCountdownView()}
 <section class="home-hero" aria-label="Главные показатели"><div class="home-hero-content"><div class="eyebrow on-hero">ПУТЬ К ГОСЭКЗАМЕНУ</div><h2>${o.unique?'Твой прогресс растёт.':'Начнём подготовку к ГОСам?'}</h2><p>${o.unique?`Уже разобрано ${o.unique} вопросов из ${o.valid}. Двигайся дальше в комфортном темпе.`:'База тестов и клинических задач готова. Реши первые 50 вопросов и следи за динамикой.'}</p><div class="home-hero-progress"><div><strong>${pct(o.unique,o.valid)}%</strong><span>охват тестовой базы · ${o.unique} / ${o.valid}</span></div>${bar(pct(o.unique,o.valid),'light')}</div></div><div class="hero-goal-card"><div>ГОСЭКЗАМЕН · I ЭТАП</div><strong>70%</strong><span>минимальный порог правильных ответов</span><small>Твоя точность первой попытки: <b>${o.unique?firstAccuracy+'%':'нет данных'}</b></small></div></section>
 <div class="dashboard-kpis">
 ${[
 ['Изучено',''+o.unique,`Осталось ${remaining} вопросов`,'book','violet'],
 ['Точность',accuracy+'%',`${o.correctAttempts} из ${o.attempts} ответов`,'target','teal'],
 ['С первого раза',o.unique?firstAccuracy+'%':'—',`${o.firstCorrect} верных первых попыток`,'sparkles','violet'],
 ['Освоено',''+o.mastered,'Последний ответ правильный','check-circle','teal'],
 ['Ошибки',''+o.unresolved,'Нужно исправить','alert','coral'],
 ['На повторение',''+due,'По интервальному графику','repeat','violet']
 ].map(([name,value,desc,ico,color])=>`<div class="dashboard-kpi"><span class="metric-icon ${color}">${icon(ico)}</span><span>${name}</span><b>${value}</b><small>${desc}</small></div>`).join('')}</div>
 <section class="section home-actions"><div class="section-head"><div><div class="eyebrow">ПРОДОЛЖИТЬ УЧЁБУ</div><h2>Что делать дальше</h2></div></div><div class="action-cards">${ix.active?`<button class="home-action primary-action" data-resume="1">${icon('play')}<span><b>Продолжить тест</b><small>${safe(modeName(ix.active.mode))}, вопрос ${cursorOf(ix.active,ix)+1} из ${ix.active.ids.length}</small></span>${icon('chevron-right')}</button>`:`<button class="home-action primary-action" data-start-block="${nextBlock.n}">${icon('play')}<span><b>Решить блок ${nextBlock.n}</b><small>Вопросы ${nextBlock.from}–${nextBlock.to} · ${nextBlock.qs.length} заданий</small></span>${icon('chevron-right')}</button>`}<button class="home-action" data-start-mistakes="1">${icon('alert')}<span><b>Разобрать ошибки</b><small>${o.unresolved} вопросов требуют внимания</small></span>${icon('chevron-right')}</button><button class="home-action" data-tab="cases">${icon('stethoscope')}<span><b>Клинические задачи</b><small>${reviewed.length} из ${CASES.length} оценено</small></span>${icon('chevron-right')}</button></div></section>
 <div class="dashboard-panels"><section class="surface dash-panel"><div class="dash-panel-title"><div><h2>Активность за 14 дней</h2><p>Сколько ответов ты дала каждый день</p></div><b>${last7}</b></div><div class="dash-bars">${recent.map((d,i)=>`<div class="dash-day" title="${safe(d.day)}: ${d.count} ответов"><span class="dash-bar-number">${d.count||''}</span><span class="dash-bar-track"><span class="dash-bar-fill ${d.count?'':'is-empty'}" style="height:${Math.max(4,d.count/peak*100)}%"></span></span><small>${i%2===0?safe(d.day.split(' ')[0]):'·'}</small></div>`).join('')}</div><div class="dash-panel-footer"><span>Сегодня: <b>${today}</b></span><span>${currentWeekText}</span></div></section><section class="surface dash-panel"><div class="dash-panel-title"><div><h2>Динамика результатов</h2><p>Точность последних завершённых тестов</p></div><b>${sessions.length} <small>тестов</small></b></div>${sessions.length?`<svg class="trend-chart" viewBox="0 0 500 155" role="img" aria-label="Точность последних ${sessions.length} завершённых тестов"><line x1="30" y1="20" x2="480" y2="20"/><line x1="30" y1="72.5" x2="480" y2="72.5"/><line x1="30" y1="125" x2="480" y2="125"/><line class="goal-line" x1="30" y1="51.5" x2="480" y2="51.5"/><text x="2" y="25">100%</text><text x="7" y="78">50%</text><text x="15" y="130">0%</text><polyline points="${linePts}"/>${sessions.map((s,i)=>`<circle cx="${30+i*(440/Math.max(1,sessions.length-1))}" cy="${125-s.score*1.05}" r="4.5"><title>${s.score}% · ${new Date(s.date).toLocaleDateString('ru-RU')}</title></circle>`).join('')}</svg><div class="dash-panel-footer"><span>Последний результат: <b>${sessions.at(-1).score}%</b></span><span>Порог · 70%</span></div>`:`<div class="chart-empty">${icon('chart')}<p>Пока нет завершённых тестов. Заверши первый блок, чтобы появилась динамика результатов.</p></div>`}</section></div>
 <div class="dashboard-panels"><section class="surface dash-panel compact"><div class="dash-panel-title"><div><h2>Практические задачи</h2><p>Самостоятельная оценка клинических случаев</p></div><b>${reviewed.length}<small> / ${CASES.length}</small></b></div>${bar(caseP)}<div class="case-pulse"><span><i class="pulse-dot good"></i> Верно <b>${goodCases}</b></span><span><i class="pulse-dot partial"></i> Частично <b>${reviewed.filter(e=>e.verdict==='partial').length}</b></span><span><i class="pulse-dot again"></i> Повторить <b>${reviewed.filter(e=>e.verdict==='again').length}</b></span></div><button class="dash-text-btn" data-tab="cases">Перейти к задачам ${icon('arrow-right')}</button></section><section class="surface dash-panel compact"><div class="dash-panel-title"><div><h2>Твоя регулярность</h2><p>Повторение и темп подготовки</p></div>${icon('flame')}</div><div class="habit-metrics"><div><b>${streak(ix)}</b><span>дней подряд</span></div><div><b>${ended.length}</b><span>тестов завершено</span></div><div><b>${avgSecs||'—'}</b><span>сек/ответ в среднем</span></div></div><button class="dash-text-btn" data-tab="stats">Открыть полную статистику ${icon('arrow-right')}</button></section></div>
 <section class="section surface home-blocks"><div class="section-head"><div><div class="eyebrow">БАНК ВОПРОСОВ</div><h2>Прогресс по блокам</h2></div><button class="ghost-btn" data-tab="tests">Все 21 блок ${icon('arrow-right')}</button></div><div class="home-block-grid">${blockData().slice(0,8).map(b=>{const answered=b.qs.filter(q=>ix.byQ.has(q.id)).length,mastered=b.qs.filter(q=>questionStats(q,ix).mastered).length;return `<button class="home-block" data-start-block="${b.n}"><span>Блок ${b.n}</span><b>${mastered}<small> / ${b.qs.length}</small></b>${bar(pct(answered,b.qs.length))}<small>${answered} разобрано</small></button>`}).join('')}</div></section>`;
}

function leagueDescription(kind){return ({week:'Правильные ответы на уникальные вопросы с понедельника (UTC). Один вопрос — максимум один зачёт за неделю.',alltime:'Число уникальных вопросов, отвеченных верно с первой попытки за всё время.',coverage:'Уникальные вопросы, на которые дан хотя бы один ответ — независимо от правильности.',accuracy:'Доля верных первых попыток. Участие в этой таблице начинается после 50 уникальных вопросов.'})[kind]||'';}
function leagueCard(full){
 const kind=leagueUi.category,items=Array.isArray(leagueUi.data?.top)?leagueUi.data.top:[];
 const tabs=LEAGUE_CATEGORIES.map(([value,label])=>`<button type="button" data-league-cat="${value}" class="${kind===value?'is-active':''}" aria-pressed="${kind===value}">${label}</button>`).join('');
 const percent=kind==='accuracy';
 const rows=items.map(u=>`<div class="league-row"><b class="league-rank">${u.rank<=3?['🥇','🥈','🥉'][u.rank-1]:u.rank}</b><span class="league-nick">${safe(u.nickname)}</span><strong>${Number(u.score).toLocaleString('ru-RU',{maximumFractionDigits:1})}${percent?'%':''}</strong></div>`).join('');
 const mine=leagueUi.data?.me;
 return `<section class="section surface league-card" aria-label="Рейтинг участников"><div class="section-head"><div><div class="eyebrow">СОРЕВНОВАТЕЛЬНАЯ ПОДГОТОВКА</div><h2>${icon('trophy')} Лига ГИА.мед</h2></div>${!full?`<button type="button" class="ghost-btn" data-tab="league">Весь рейтинг ${icon('arrow-right')}</button>`:''}</div><p class="league-intro">Все зарегистрированные пользователи автоматически участвуют. Видны только ники и результаты.</p><div class="league-tabs" role="group" aria-label="Категория рейтинга">${tabs}</div><p class="league-desc">${leagueDescription(kind)}</p>${!accountId()?`<div class="league-empty">Войди в аккаунт, чтобы увидеть результаты и своё место. Гостевые тренировки не участвуют в рейтинге.<button class="secondary-btn" data-open-auth="1">Войти</button></div>`:leagueUi.loading&&!leagueUi.data?`<div class="league-empty">Загружаем рейтинг…</div>`:leagueUi.error?`<div class="league-empty" role="status">Рейтинг временно недоступен: ${safe(leagueUi.error)}<button class="secondary-btn" data-league-refresh="1">Повторить</button></div>`:rows?`<div class="league-list">${rows}</div>`:`<div class="league-empty">Здесь пока нет результатов. Первые баллы появятся после синхронизации ответов.</div>`}${mine?`<div class="league-me"><span>Твоё место: <b>№${mine.rank}</b></span><strong>${Number(mine.score).toLocaleString('ru-RU',{maximumFractionDigits:1})}${percent?'%':''}</strong></div>`:''}${full?`<p class="league-note">Недельный зачёт обновляется каждый понедельник в 00:00 UTC. Рейтинг отражает серверные данные Supabase, не результаты, сохранённые только на устройстве. При полном сбросе статистики баллы обнуляются.</p>`:''}</section>`;
}
function leagueView(){return `<section class="page-header"><div class="eyebrow">СОВМЕСТНАЯ ПОДГОТОВКА</div><h1>Лига ГИА.мед</h1><p>Соревнуйся в знаниях, не в количестве повторных нажатий. Баллы начисляются на сервере по уникальным вопросам.</p></section>${leagueCard(true)}`;}
async function leagueLoad(force=false){
 if(!accountId()||leagueUi.loading||(!force&&leagueUi.data&&Date.now()-leagueUi.loadedAt<90000))return;
 const user=accountId(),category=leagueUi.category;leagueUi.loading=true;leagueUi.error='';
 try{const jwt=decodeJwt(auth.access_token);if(jwt.exp&&jwt.exp*1000<Date.now()+90000)await refreshAuth();const result=await cloudFetch('/rest/v1/rpc/gia_league_board',{method:'POST',body:JSON.stringify({p_category:category})});
  if(user===accountId()&&category===leagueUi.category){leagueUi.data=result.data;leagueUi.loadedAt=Date.now();}}
 catch(e){if(user===accountId()){leagueUi.error=e.message;leagueUi.data=null;leagueUi.loadedAt=Date.now();}}
 finally{leagueUi.loading=false;if(user===accountId()&&ui.tab==='league')render();}
}
function leagueMaybeLoad(){if(accountId()&&ui.tab==='league'&&!leagueUi.loading&&Date.now()-leagueUi.loadedAt>=90000)queueMicrotask(()=>leagueLoad(false));}

function caseFigures(caseId){
 const list=CASE_MEDIA[String(caseId)]||[];
 if(!list.length)return '';
 return `<section class="case-media"><div class="case-media-head"><h2>Материалы обследования</h2><p>Иллюстрации, ЭКГ и снимки из исходного PDF. Нажми, чтобы увеличить.</p></div><div class="case-figures">${list.map((m,i)=>`<button type="button" class="case-figure" data-figure="${caseId}:${i}" aria-label="Увеличить иллюстрацию ${i+1} к задаче ${caseId}"><img src="${safe(m.src)}" alt="${safe(m.alt)}" loading="lazy"><span>${icon('search')} Увеличить · PDF, стр. ${m.page}</span></button>`).join('')}</div></section>`;
}
function figureOverlay(){
 if(!ui.figure)return '';
 const entry=(CASE_MEDIA[String(ui.figure.caseId)]||[])[ui.figure.index];if(!entry)return '';
 return `<div class="figure-overlay" role="dialog" aria-modal="true" aria-label="Иллюстрация к задаче"><div class="figure-toolbar"><span>Задача № ${ui.figure.caseId} · PDF, стр. ${entry.page}</span><button type="button" data-figure-close="1">${icon('x-circle')} Закрыть</button></div><div class="figure-scroll"><img src="${safe(entry.src)}" alt="${safe(entry.alt)}"></div><p>Можно увеличить изображение жестом или прокрутить по горизонтали.</p></div>`;
}
function pdfLink(page,label){return `<button type="button" class="source-link" data-open-pdf="${page||1}">${icon('file')} ${safe(label||'Открыть исходный PDF')}${icon('arrow-up-right')}</button>`;}
function pdfURL(){
 if(window.GIA_LITE_HTML)return null;
 if(window.GIA_PDF_BASE64){
  if(!window.GIA_PDF_BLOB_URL){
   const base64=window.GIA_PDF_BASE64,blocks=[];
   for(let i=0;i<base64.length;i+=32768){const raw=atob(base64.slice(i,i+32768));const bytes=new Uint8Array(raw.length);for(let j=0;j<raw.length;j++)bytes[j]=raw.charCodeAt(j);blocks.push(bytes);}
   window.GIA_PDF_BLOB_URL=URL.createObjectURL(new Blob(blocks,{type:'application/pdf'}));
  }
  return window.GIA_PDF_BLOB_URL;
 }
 return new URL('./source.pdf',location.href).href;
}
function downloadSourcePDF(){
 try{const url=pdfURL();if(!url){notify('PDF отдельно: он есть в полном архиве и доступен отдельным файлом для скачивания.','error');return}const a=document.createElement('a');a.href=url;a.download='Программа_ГИА_СибГМУ_2025.pdf';document.body.appendChild(a);a.click();a.remove();}
 catch(err){notify('Не удалось скачать PDF: '+err.message,'error');}
}
function pdfDownloadButton(){return `<button type="button" class="source-link pdf-download" data-download-pdf="1">${icon('download')} Скачать PDF</button>`;}
function openSourcePDF(page){
 try{
  if(!pdfURL()){notify('PDF не включён в облегчённый HTML. Он есть в полном архиве и отдельным файлом.','error');return;}
  const url=pdfURL()+'#page='+Math.max(1,Math.min(288,Number(page)||1));
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
 }catch(err){notify('Не удалось открыть PDF: '+err.message,'error');}
}

function testsView(ix){const o=overall(ix);const selected=ui.sub;let content='';
 if(selected==='blocks'){content=`<div class="block-grid">${blockData().map(b=>{const done=b.qs.filter(q=>ix.byQ.has(q.id)).length,passed=b.qs.filter(q=>questionStats(q,ix).mastered).length;return `<button data-start-block="${b.n}" class="block-card"><div class="block-top"><span>БЛОК ${String(b.n).padStart(2,'0')}</span>${icon('arrow-up-right')}</div><div class="block-number">${b.from}—${b.to}</div><div class="block-sub"><strong>${done}/${b.qs.length}</strong> решено <span>${pct(done,b.qs.length)}%</span></div>${bar(pct(done,b.qs.length))}<small>${passed} освоено · ${b.qs.length} вопросов</small></button>`}).join('')}</div>`;}
 if(selected==='topics'){const topics=[...new Set(Q.map(q=>q.topic))];content=`<div class="topic-grid">${topics.flatMap(t=>{const qs=Q.filter(q=>q.topic===t);return Array.from({length:Math.ceil(qs.length/50)},(_,i)=>{const slice=qs.slice(i*50,(i+1)*50),a=slice.filter(q=>ix.byQ.has(q.id)).length;return `<button class="topic-card" data-topic="${safe(t)}" data-offset="${i*50}">${icon('book')}<div><b>${safe(t)} ${qs.length>50?`· ${i+1}/${Math.ceil(qs.length/50)}`:''}</b><small>${a} из ${slice.length} пройдено · ${slice.length} вопросов</small></div>${icon('chevron-right')}</button>`})}).join('')}</div><p class="notice">Группировка по разделам PDF и тематике заданий ориентировочная, границы дисциплин иногда пересекаются. Нумерация вопросов сохранена.</p>`;}
 if(selected==='search'){const term=ui.search.toLowerCase().trim();const matches=term.length>=2?Q.filter(q=>q.q.toLowerCase().includes(term)||String(q.id)===term||q.o.some(o=>o.t.toLowerCase().includes(term))):[];content=`<label class="searchline">${icon('search')}<input id="testSearch" type="search" placeholder="Номер, термин, диагноз…" value="${safe(ui.search)}" autocomplete="off"/></label><div id="searchResults" class="search-results">${searchResults(matches,term)}</div>`;}
 if(selected==='saved'){const qs=Q.filter(q=>ix.bookmarks.get(q.id));content=qs.length?`<div class="question-list">${qs.map(q=>listQuestion(q,ix)).join('')}</div>`:`<div class="empty">${icon('bookmark')}<h3>Пока нет избранных вопросов</h3><p>Нажми на звёздочку во время решения теста.</p></div>`;}
 return `${hero(ix)}${miniStats(ix)}${ix.active?`<button class="resume-card" data-resume="1"><span class="resume-icon">${icon('play')}</span><span><b>Продолжить с места остановки</b><small>${safe(modeName(ix.active.mode))} · вопрос ${cursorOf(ix.active,ix)+1} из ${ix.active.ids.length}</small></span>${icon('chevron-right')}</button>`:''}<section class="section"><div class="section-head"><div><div class="eyebrow">БАНК ВОПРОСОВ</div><h2>Выбери, что повторить</h2></div><button class="ghost-btn" data-start-review="1">${icon('sparkles')} Умное повторение</button></div><div class="switcher" role="tablist">${[['blocks','По 50'],['topics','По темам'],['search','Поиск'],['saved','Избранное']].map(([key,label])=>`<button data-sub="${key}" class="${selected===key?'selected':''}" role="tab" aria-selected="${selected===key}">${label}</button>`).join('')}</div>${content}</section>`;
}
function searchResults(matches,term){return !term?`<p class="muted">Введите минимум 2 символа для поиска по ${Q.length} вопросам.</p>`:matches.length?`<p class="result-caption">Найдено: ${matches.length}</p><div class="question-list">${matches.slice(0,80).map(q=>`<button class="question-row" data-single="${q.id}"><span class="qno">№ ${q.id}</span><span>${safe(q.q)}</span>${icon('arrow-up-right')}</button>`).join('')}</div>${matches.length>80?'<p class="muted">Показаны первые 80 результатов. Уточни запрос.</p>':''}`:`<p class="muted">Ничего не найдено.</p>`;}
function listQuestion(q,ix){let z=questionStats(q,ix);return `<button data-single="${q.id}" class="question-row"><span class="qno">№ ${q.id}</span><span>${safe(q.q)}</span><span class="q-dot ${z.mastered?'good':z.seen?'bad':''}"></span></button>`;}
function modeName(mode){return {'block':'Тестовый блок','topic':'Тематическая практика','mistakes':'Работа над ошибками','review':'Интервальное повторение','single':'Один вопрос','saved':'Избранное','all':'Случайный тест'}[mode]||'Тест';}
function cursorOf(start,ix){const seq=ix.cursors.filter(x=>x.sessionId===start.sessionId).at(-1);return Math.min(Math.max(0,seq?.cursor||0),start.ids.length-1);}
function sessionView(ix){const s=ix.starts.find(x=>x.sessionId===ui.sessionId)||ix.active;if(!s){ui.sessionId=null;return testsView(ix)}
 let cursor=cursorOf(s,ix),qid=s.ids[cursor],q=QM.get(qid);if(!q){return '<div class="empty">Вопрос не найден.</div>'}
 const previous=(ix.bySession.get(s.sessionId)||[]).filter(e=>e.qid===qid).at(-1);
 const complete=!!previous, scored=q.a!==null;
 const options=shuffleOptions(q,s.sessionId);
 return `<div class="quiz-container"><div class="quiz-top"><button class="back-link" data-quit="1">${icon('arrow-left')} К тестам</button><span class="quiz-label">${safe(modeName(s.mode))}${s.mode==='block'?' '+s.block:''}</span><button class="finish-link" data-finish="1">Завершить</button></div><div class="quiz-progress"><div><span>ВОПРОС ${cursor+1} ИЗ ${s.ids.length}</span><strong>${pct(cursor+1,s.ids.length)}%</strong></div>${bar(pct(cursor+1,s.ids.length))}</div><article class="question-panel"><div class="question-meta"><span class="q-pill">ВОПРОС № ${q.id}</span><button class="star-btn ${ix.bookmarks.get(q.id)?'is-star':''}" aria-label="${ix.bookmarks.get(q.id)?'Убрать из избранного':'В избранное'}" data-star="${q.id}">${icon('star')}</button></div><h1 class="question-text">${safe(q.q)}</h1><div class="answers">${options.map((opt,i)=>{const isCorrect=opt.k===q.a,selected=previous?.choice===opt.k;let status=complete&&scored?(isCorrect?'correct':selected?'incorrect':'dim'):'',letter=String.fromCharCode(65+i);return `<button class="answer ${status} ${selected?'was-selected':''}" data-answer="${safe(opt.k)}" ${complete||!scored?'disabled':''}><span class="answer-letter">${letter}</span><span>${safe(opt.t)}</span>${complete&&isCorrect?icon('check-circle'):complete&&selected?icon('x-circle'):''}</button>`}).join('')}</div>${!scored?`<div class="feedback ambiguous"><b>${icon('alert')} В исходном PDF обнаружено несоответствие ключа и вариантов.</b><p>Этот вопрос не оценивается автоматически. Он сохранён для ручной проверки.</p></div>`:''}${complete?`<div class="feedback ${previous.correct?'success':'failure'}"><b>${icon(previous.correct?'check-circle':'alert')} ${previous.correct?'Верно!':'Пока не получилось'}</b><p>${previous.correct?'Отличная работа — этот ответ засчитан.':`Правильный ответ: <strong>${safe((q.o.find(o=>o.k===q.a)||{}).t||'Ключ не найден')}</strong>`}</p></div><button class="next-btn" data-next="1">${cursor===s.ids.length-1?'Посмотреть результат':'Следующий вопрос'} ${icon('arrow-right')}</button>`:`<div class="quiz-help"><span>${icon('info')} После выбора сразу покажем правильный ответ.</span><button class="text-link" data-next="1">Пропустить ${icon('arrow-right')}</button></div>`}</article><div class="quiz-footer">${icon('shield')} Ответы — по программе СибГМУ 2025 года. При расхождениях с актуальными рекомендациями ориентируйся на действующие документы.</div></div>`;
}
function shuffleOptions(q,sid){let a=[...q.o];let h=0;const seed=`${sid}-${q.id}`;for(let i=0;i<seed.length;i++)h=(Math.imul(h,31)+seed.charCodeAt(i))|0;for(let i=a.length-1;i>0;i--){h^=h<<13;h^=h>>>17;h^=h<<5;let j=(h>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a;}
function reportView(ix){const start=ix.starts.find(s=>s.sessionId===ui.reportId);if(!start)return testsView(ix);const attempts=ix.bySession.get(start.sessionId)||[];const byId=new Map(attempts.map(x=>[x.qid,x]));const mistakes=start.ids.filter(id=>{const z=byId.get(id);return z&&!z.correct});const skipped=start.ids.filter(id=>!byId.has(id));const scored=start.ids.filter(id=>QM.get(id)?.a);const correct=start.ids.filter(id=>byId.get(id)?.correct);const p=pct(correct.length,scored.length);const ending=ix.ends.filter(e=>e.sessionId===start.sessionId).at(-1);const seconds=Math.round((ending?.elapsedMs||0)/1000);const duration=seconds>=60?`${Math.floor(seconds/60)} мин ${seconds%60} сек`:`${seconds} сек`;return `<div class="report"><div class="eyebrow">РЕЗУЛЬТАТ ТРЕНИРОВКИ</div><h1>Отличная работа!</h1><div class="score-circle" style="--score:${p}%"><div><b>${p}%</b><span>правильных</span></div></div><p class="score-detail">${correct.length} верно из ${scored.length} оцениваемых вопросов · ${duration}</p><span class="pass-chip ${p>=70?'pass':'fail'}">${p>=70?icon('check'):'◌'} ${p>=70?'Порог 70% достигнут':'До порога 70% ещё есть шаги'}</span><div class="report-metrics"><div><b>${correct.length}</b><span>Верно</span></div><div><b>${mistakes.length}</b><span>Ошибки</span></div><div><b>${skipped.length}</b><span>Пропущено</span></div></div>${mistakes.length?`<h2>Разбор ошибок</h2><div class="review-list">${mistakes.map(id=>{const q=QM.get(id),e=byId.get(id),selected=q.o.find(o=>o.k===e.choice),right=q.o.find(o=>o.k===q.a);return `<div class="error-item"><div class="error-head">ВОПРОС № ${id}</div><b>${safe(q.q)}</b><p class="wrong-value">Твой ответ: ${safe(selected?.t||'—')}</p><p class="right-value">Правильно: ${safe(right?.t||'—')}</p></div>`}).join('')}</div>`:`<div class="perfect">${icon('sparkles')} ${skipped.length?'Ошибок нет — остались пропущенные вопросы.':'Все отвеченные вопросы решены правильно!'}</div>`}<div class="report-actions"><button class="primary-btn" data-retry-ids="${mistakes.join(',')}">${icon('repeat')} ${mistakes.length?'Пройти ошибки ещё раз':'Ещё один блок'}</button><button class="secondary-btn" data-go-tests="1">На главную</button></div></div>`;}
function mistakesView(ix){let o=overall(ix),due=Q.filter(q=>q.a&&dueInfo(q,ix)?.due<=Date.now());let pool=ui.sort==='all'?o.errors:ui.sort==='history'?Q.filter(q=>q.a&&questionStats(q,ix).wrong):due;
 return `<section class="page-header"><div class="eyebrow">ЗАКРЕПЛЕНИЕ</div><h1>Работа над ошибками</h1><p>То, что не получилось с первого раза, можно превратить в сильную сторону.</p></section><div class="stats-grid two"><div class="metric"><span class="metric-icon coral">${icon('alert')}</span><span>Незакрытых ошибок</span><b>${o.unresolved}</b><small>Последний ответ неверный</small></div><div class="metric"><span class="metric-icon violet">${icon('repeat')}</span><span>Повторить сегодня</span><b>${due.length}</b><small>По интервалам 1, 3, 7, 14, 30 дней</small></div></div><div class="section"><div class="section-head"><h2>Твоя очередь повторения</h2><button class="ghost-btn" data-start-mistakes="1">${icon('play')} Начать</button></div><div class="switcher">${[['all','Актуальные ошибки'],['history','Все ошибки'],['due','По графику']].map(([s,l])=>`<button data-sort="${s}" class="${ui.sort===s?'selected':''}">${l}</button>`).join('')}</div>${pool.length?`<div class="question-list">${pool.slice(0,120).map(q=>listQuestion(q,ix)).join('')}</div>`:`<div class="empty">${icon('check-circle')}<h3>Список пуст</h3><p>Здесь появятся вопросы после прохождения тестов.</p></div>`}</div>`;}
function caseList(ix){const term=ui.caseSearch.trim().toLowerCase();const cases=CASES.filter(c=>!term||String(c.id)===term||c.case.toLowerCase().includes(term)||c.reference.toLowerCase().includes(term));let done=ix.cases.size;return `<section class="page-header"><div class="eyebrow">II ЭТАП ГИА</div><h1>Клинические задачи</h1><p>183 ситуационные задачи. Тренируй клиническое мышление и сравнивай диагноз с эталоном из PDF.</p></section><div class="case-intro"><span class="case-intro-icon">${icon('stethoscope')}</span><div><b>Практика с открытым ответом</b><p>Формулируй диагноз самостоятельно, затем открывай эталон. Автоматическая оценка показывает лишь сходство текста, финальное решение остаётся за тобой.</p></div></div><div class="section"><div class="section-head"><h2>Все задачи <span class="light-count">${done} / ${CASES.length}</span></h2></div><label class="searchline">${icon('search')}<input id="caseSearch" type="search" placeholder="Поиск по диагнозу или номеру" value="${safe(ui.caseSearch)}"/></label><div class="case-grid">${cases.slice(0,183).map(c=>`<button class="case-item" data-case="${c.id}"><span class="case-number">${String(c.id).padStart(3,'0')}</span><span class="case-description"><b>Клиническая задача № ${c.id}</b><small>${safe(c.case.slice(0,140))}${c.case.length>140?'…':''}</small></span>${ix.cases.get(c.id)?`<span class="solved-dot ${ix.cases.get(c.id).verdict==='good'?'good':''}">${icon('check')}</span>`:icon('chevron-right')}</button>`).join('')}</div></div>`;}
function normalize(str){return String(str||'').toLowerCase().replaceAll('ё','е').replace(/\bибс\b/g,'ишемическая болезнь сердца').replace(/\bхсн\b/g,'хроническая сердечная недостаточность').replace(/\bтэла\b/g,'тромбоэмболия легочной артерии').replace(/[.,;:!?()+\-/\\\n\r]/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim()}
const STOP=new Set('и в на по с со при из от для до или не что это форма стадии степени тип болезнь синдром острый хронический левой правой левого правого тяжести средняя средней легкой легкого легкая стадия ст осложнение заболевания больного года степени пациент'.split(' '));
function tokens(t){return normalize(t).split(' ').filter(x=>x.length>3&&!STOP.has(x)).map(x=>x.length>6?x.slice(0,-2):x)}
function similarity(a,b){let ac=new Set(tokens(a)),bc=new Set(tokens(b));if(!ac.size||!bc.size)return 0;let found=0;for(const token of ac){if([...bc].some(t=>t===token||t.startsWith(token.slice(0,Math.max(3,token.length-2)))||token.startsWith(t.slice(0,Math.max(3,t.length-2)))))found++}return found/Math.max(1,Math.min(ac.size,bc.size));}
function caseView(ix){const c=CASES.find(z=>z.id===ui.caseId);if(!c)return caseList(ix);const current=ix.cases.get(c.id),draft=drafts[c.id]||current?.input||'',result=ui.showCaseReference;const sim=result?similarity(draft,c.reference):0;let text=sim>=.68?'Формулировка похожа на эталон':sim>=.35?'Есть частичное текстовое совпадение':'Текстового сходства недостаточно для автоматического вывода';return `<div class="case-detail"><button class="back-link" data-back-cases="1">${icon('arrow-left')} Ко всем задачам</button><div class="eyebrow">ПРАКТИКА · ЗАДАЧА № ${c.id}</div><h1>Клиническая задача № ${c.id}</h1><div class="case-statement"><div class="statement-title">АНАМНЕЗ И ДАННЫЕ ОБСЛЕДОВАНИЯ</div><p>${safe(c.case)}</p><div class="pdf-actions">${c.page?pdfLink(c.page,`Открыть файл на странице ${c.page}`):''}${pdfDownloadButton()}</div></div>${caseFigures(c.id)}<div class="case-questions"><h2>Задания</h2><ol>${c.prompts.map(p=>`<li>${safe(p)}</li>`).join('')}</ol></div><div class="case-answer"><h2>Твой ответ</h2><label class="input-label" for="caseDraft">Предварительный диагноз и обоснование</label><textarea id="caseDraft" rows="7" placeholder="Запиши предполагаемый диагноз, а затем сверяй его с ответом…">${safe(draft)}</textarea><p class="muted tiny">Черновик сохраняется на этом устройстве автоматически. Для синхронизации результата нажми «Сверить с эталоном» и оцени ответ.</p><button class="primary-btn" data-check-case="1">${icon('check-circle')} Сверить с эталоном</button></div>${result?`<div class="reference-panel"><div class="eyebrow">ОТВЕТ ИЗ PDF · РАЗДЕЛ «СПИСОК ОТВЕТОВ»</div><h2>Эталон диагноза</h2><p>${safe(c.reference)}</p><div class="similarity-info">${icon('info')} ${text}. Совпадение слов не гарантирует медицинскую правильность; проверь диагноз по смыслу.</div><div class="notice">В исходном документе даны итоговые диагнозы, но не полные ответы на каждый подпункт. При необходимости сверяй разбор с преподавателем или актуальными клиническими рекомендациями.</div><h3>Оцени свой результат</h3><div class="verdicts"><button data-verdict="good" class="${current?.verdict==='good'?'picked':''}">${icon('check')} Верно</button><button data-verdict="partial" class="${current?.verdict==='partial'?'picked':''}">${icon('minus')} Частично</button><button data-verdict="again" class="${current?.verdict==='again'?'picked':''}">${icon('repeat')} Повторить</button></div></div>`:''}<div class="case-bottom"><button class="secondary-btn" data-case-prev="1" ${c.id===1?'disabled':''}>${icon('arrow-left')} Предыдущая</button><button class="secondary-btn" data-case-next="1" ${c.id===183?'disabled':''}>Следующая ${icon('arrow-right')}</button></div></div>`;}
function statsView(ix){const o=overall(ix),blocks=blockData();const studied=Q.filter(q=>q.a&&ix.byQ.has(q.id)), accuracy=pct(o.correctAttempts,o.attempts);const daily=new Map();for(const a of ix.attempts){const day=todayKey(a.at),rec=daily.get(day)||{n:0,correct:0};rec.n++;rec.correct+=a.correct?1:0;daily.set(day,rec)}const days=Array.from({length:7},(_,i)=>{let d=new Date();d.setDate(d.getDate()-6+i);return {date:todayKey(d),dow:d.toLocaleDateString('ru-RU',{weekday:'short'}),n:daily.get(todayKey(d))?.n||0}});const mx=Math.max(1,...days.map(d=>d.n));
 return `<section class="page-header"><div class="eyebrow">АНАЛИТИКА ПОДГОТОВКИ</div><h1>Твой прогресс</h1><p>Подробная статистика по вопросам, качеству ответов и ежедневной практике.</p></section><div class="stats-grid">${[['Охват базы',pct(o.unique,o.valid)+'%',`${o.unique} из ${o.valid} проверяемых вопросов`,'target'],['Точность всех ответов',accuracy+'%',`${o.correctAttempts} правильных из ${o.attempts} попыток`,'check'],['С первого раза',pct(o.firstCorrect,o.unique)+'%',`${o.firstCorrect} из ${o.unique} уникальных вопросов`,'sparkles']].map(([name,num,desc,ico])=>`<div class="metric"><span class="metric-icon violet">${icon(ico)}</span><span>${name}</span><b>${num}</b><small>${desc}</small></div>`).join('')}</div><div class="stats-grid two"><div class="metric"><span class="metric-icon teal">${icon('bookmark')}</span><span>Освоено</span><b>${o.mastered}</b><small>Последний ответ верный</small></div><div class="metric"><span class="metric-icon coral">${icon('alert')}</span><span>Незакрытых ошибок</span><b>${o.unresolved}</b><small>Требуют повторения</small></div></div><div class="activity-summary"><span>${icon('clipboard')} <strong>${ix.cases.size}</strong> из ${CASES.length} практических задач оценено</span><span>${icon('play')} <strong>${ix.ends.filter(e=>e.reason==='finished').length}</strong> завершённых тренировок</span><span>${icon('clock')} <strong>${ix.attempts.length?Math.round(ix.attempts.filter(e=>e.responseMs&&e.responseMs<3600000).reduce((a,e)=>a+e.responseMs,0)/Math.max(1,ix.attempts.filter(e=>e.responseMs&&e.responseMs<3600000).length)/1000):0}</strong> сек в среднем на ответ</span></div><section class="section surface"><div class="section-head"><h2>Активность за неделю</h2><span class="caption-sub">ответов в день</span></div><div class="activity-chart">${days.map(d=>`<div class="activity-col"><strong>${d.n||''}</strong><span style="height:${Math.max(d.n?12:5,d.n/mx*140)}px" class="${d.n?'':'is-empty'}"></span><small>${safe(d.dow)}</small></div>`).join('')}</div></section><section class="section surface"><div class="section-head"><h2>Освоение по блокам</h2><span class="caption-sub">правильный последний ответ</span></div><div class="block-rows">${blocks.map(b=>{let valid=b.qs.filter(q=>q.a),acc=valid.filter(q=>questionStats(q,ix).mastered).length;return `<div class="block-stat"><span>Блок ${b.n}</span><div>${bar(pct(acc,valid.length))}</div><strong>${acc}/${valid.length}</strong></div>`}).join('')}</div></section><section class="section surface"><h2>Как считаются показатели</h2><p class="notice">«Охват» — уникальные вопросы с ответом; «точность» — доля правильных среди всех попыток; «с первого раза» — успех в первой попытке; «освоено» — вопросы, на которые последний раз ответила верно. В вопросе №679 используется уточнённый ключ: E — «Пять групп». Он учитывается в статистике.</p></section>`;}
function profileView(ix){const o=overall(ix),active=!!accountId();return `<section class="page-header"><div class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</div><h1>Профиль и настройки</h1><p>У каждого аккаунта — свой прогресс, история тестов и статистика.</p></section><div class="settings-grid"><section class="surface panel"><div class="settings-heading">${icon('user')} <h2>Мой аккаунт</h2></div>${active?`<div class="account-summary"><span class="account-avatar">${safe(accountName().charAt(0).toUpperCase())}</span><div><b>${safe(accountName())}</b><small>Логин: ${safe(accountLogin())} · индивидуальная статистика</small></div></div><p>Тесты и черновики практики этого пользователя хранятся отдельно от других учётных записей.</p><button class="primary-btn" data-sync="1" ${ui.cloudBusy?'disabled':''}>${icon('refresh')} ${ui.cloudBusy?'Синхронизация…':'Синхронизировать прогресс'}</button>${adminUi.allowed?`<button class="secondary-btn" data-admin-open="1">${icon('shield')} Панель администратора</button>`:''}<button class="secondary-btn" data-logout="1">Выйти из аккаунта</button>${read(KEY,[]).length||Object.keys(read(DRAFT,{})).length?`<div class="import-guest-note"><p class="muted tiny">На этом устройстве есть гостевой прогресс. Перенос выполняется только по твоему подтверждению.</p><button type="button" class="secondary-btn" data-migrate-guest="1">${icon('upload')} Перенести мой гостевой прогресс</button></div>`:''}`:`<div class="sync-badge">${icon('hard-drive')} Гостевой режим</div><p>${cloudReady()?'Войди по логину, чтобы хранить прогресс в отдельном облачном аккаунте.':'Для регистрации и синхронизации понадобится подключить сервер авторизации. До этого можно пользоваться гостевым режимом.'}</p><button class="primary-btn" data-open-auth="1">${icon('user')} ${cloudReady()?'Войти или зарегистрироваться':'Экран авторизации'}</button>`}<p class="muted tiny">${safe(ui.cloudMessage||'')}</p></section><section class="surface panel"><div class="settings-heading">${icon('palette')} <h2>Оформление</h2></div><p class="muted tiny">Фоны и карточки нейтральны. Палитра влияет на акценты и навигацию.</p><div class="profile-palette-list" role="group" aria-label="Цветовые палитры">${paletteChoices()}</div><div class="settings-row"><span>Тёмная тема</span><button class="toggle" data-theme-toggle="1" role="switch" aria-checked="${document.documentElement.dataset.theme==='dark'}"><span></span></button></div></section><section class="surface panel"><div class="settings-heading">${icon('download')} <h2>Резервная копия</h2></div><p>Экспорт и импорт JSON работают только для текущего профиля. Перед сбросом статистики рекомендуем сохранить копию.</p><div class="action-row"><button class="secondary-btn" data-export="1">${icon('download')} Экспорт</button><label class="secondary-btn file-label" for="importFile">${icon('upload')} Импорт<input id="importFile" type="file" accept="application/json,.json" hidden></label></div></section><section class="surface panel settings-danger"><div class="settings-heading">${icon('alert')} <h2>Начать подготовку заново</h2></div><p>Полностью сбросить результаты тестов, ошибки, историю сессий, избранное, статистику практических задач и черновики ответов для <b>текущего профиля</b>. Сам аккаунт и оформление останутся.</p><p class="muted tiny">${active?'Если включена синхронизация, сброс распространится на другие устройства этого аккаунта. Для этого нужен интернет.':'В гостевом режиме удаляются только данные этого браузера.'}</p><button type="button" class="danger-button" data-reset-open="1">${icon('refresh')} Сбросить всю статистику</button>${ui.resetOpen?`<form id="resetProgressForm" class="reset-confirm-form"><div class="reset-warning">${icon('alert')} Восстановить удалённую статистику получится только из ранее сохранённой резервной копии.</div><label class="reset-label" for="resetText">Для подтверждения введи слово <strong>СБРОСИТЬ</strong></label><input id="resetText" name="confirmation" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="СБРОСИТЬ"><label class="reset-checkbox"><input name="acknowledge" type="checkbox" required> Я понимаю, что история моих тестов и практики будет удалена</label><div class="action-row"><button type="button" class="secondary-btn" data-reset-cancel="1">Отмена</button><button type="submit" class="danger-button danger-solid" ${ui.cloudBusy?'disabled':''}>${icon('alert')} Удалить статистику</button></div></form>`:''}</section><section class="surface panel"><div class="settings-heading">${icon('info')} <h2>Об источнике</h2></div><p>«Программа государственного экзамена», СибГМУ, Томск, 2025: ${Q.length} тестов и ${CASES.length} клинических задач.</p><p class="muted tiny">В исходнике возможны устаревшие формулировки. Эталоны задач содержат преимущественно диагнозы.</p><div class="pdf-actions">${pdfLink(1,'Открыть исходный PDF')}${pdfDownloadButton()}</div></section></div>`;}
function adminWhen(value){if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('ru-RU',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function adminView(){
 if(!adminUi.allowed)return `<section class="surface panel"><h2>Доступ запрещён</h2><p>Эта панель открывается только назначенным администраторам.</p><button class="secondary-btn" data-tab="home">На главную</button></section>`;
 const isLoading=adminUi.loading||adminUi.busy;
 const active=adminUi.users.filter(x=>!x.banned_until||Date.parse(x.banned_until)<=Date.now()).length;
 const seven=adminUi.users.filter(x=>x.last_activity_at&&Date.now()-Date.parse(x.last_activity_at)<7*86400000).length;
 const done=adminUi.users.reduce((n,u)=>n+(Number(u.answer_count)||0),0);
 const maxPage=Math.max(1,Math.ceil(adminUi.total/30));
 const rows=adminUi.users.map(u=>{
   const banned=u.banned_until&&Date.parse(u.banned_until)>Date.now();
   const uid=safe(u.user_id),login=safe(u.username),nick=safe(u.nickname);
   const tries=Number(u.answer_count)||0,correct=Number(u.correct_count)||0;
   return `<tr><td><b>${login}</b><small>${nick}</small></td>
    <td><span class="admin-status ${banned?'is-banned':'is-active'}">${banned?'Заблокирован':'Активен'}</span></td>
    <td><span>${adminWhen(u.registered_at)}</span></td>
    <td><span>${adminWhen(u.last_sign_in_at)}</span><small>Учёба: ${adminWhen(u.last_activity_at)}</small></td>
    <td><b>${tries}</b><small>Верных: ${correct}${tries?' · '+Math.round(correct/tries*100)+'%':''}<br>Практика: ${Number(u.practice_count)||0}</small></td>
    <td><div class="admin-row-actions"><button class="secondary-btn" data-admin-act="${banned?'unban':'ban'}" data-admin-id="${uid}" data-admin-login="${login}" ${isLoading?'disabled':''}>${banned?'Разблокировать':'Блокировать'}</button><button class="secondary-btn" data-admin-act="reset_password" data-admin-id="${uid}" data-admin-login="${login}" ${isLoading?'disabled':''}>Сбросить пароль</button><button class="admin-delete" data-admin-act="delete" data-admin-id="${uid}" data-admin-login="${login}" ${isLoading?'disabled':''}>Удалить</button></div></td></tr>`;
 }).join('');
 const actions={ban:'Блокировать на 30 дней',unban:'Снять блокировку',delete:'Безвозвратно удалить',reset_password:'Сбросить пароль'};
 const a=adminUi.action;
 const confirmBox=a?`<section class="admin-confirm" role="dialog" aria-modal="true" aria-label="Подтверждение действия"><div class="admin-confirm-card"><h2>${actions[a.kind]} аккаунт?</h2><p>Логин: <strong>${safe(a.login)}</strong>. ${a.kind==='delete'?'Удаление необратимо: аккаунт и его облачная статистика будут удалены.':a.kind==='reset_password'?'Убедись в личности пользователя вне сайта. Его старый пароль и резервный код станут недействительны. Временные данные будут показаны один раз.':'Изменение доступа затронет вход в аккаунт; уже выданные токены могут действовать до истечения срока.'}</p><form id="adminActionForm"><label>Введи точный логин для подтверждения<input name="confirmation" required autocomplete="off" spellcheck="false" placeholder="${safe(a.login)}"></label>${a.kind==='reset_password'?'<label>Твой пароль администратора для подтверждения<input type="password" name="admin_password" required minlength="8" autocomplete="current-password" placeholder="Пароль текущего администратора"></label>':''}<div class="admin-confirm-actions"><button class="secondary-btn" type="button" data-admin-cancel="1">Отмена</button><button type="submit" class="${a.kind==='delete'?'admin-delete':'primary-btn'}" ${adminUi.busy?'disabled':''}>${actions[a.kind]}</button></div></form></div></section>`:'';
 return `<section class="page-header"><div class="eyebrow">ТОЛЬКО ДЛЯ ВЛАДЕЛЬЦА</div><h1>Панель администратора</h1><p>Управление аккаунтами и агрегированной активностью. Медицинские ответы и коды восстановления здесь не отображаются.</p></section>
 <section class="admin-kpis"><div class="surface"><small>Найдено пользователей</small><b>${adminUi.total}</b></div><div class="surface"><small>Активных на странице</small><b>${active}</b></div><div class="surface"><small>Учились за 7 дней, на странице</small><b>${seven}</b></div><div class="surface"><small>Ответов, на странице</small><b>${done}</b></div></section>
 <section class="surface admin-panel"><div class="admin-heading"><div><h2>Пользователи</h2><p>Поиск по логину и нику · ${isLoading?'Загрузка…':'страница '+adminUi.page+' из '+maxPage}</p></div><button class="secondary-btn" data-admin-refresh="1" ${isLoading?'disabled':''}>${icon('refresh')} Обновить</button></div>
 <form id="adminSearchForm" class="admin-search"><input type="search" name="search" value="${safe(adminUi.search)}" maxlength="64" placeholder="Поиск по логину или нику" aria-label="Поиск по пользователям"><button class="primary-btn" type="submit">Найти</button></form>
 ${adminUi.error?`<div class="admin-error" role="alert">${safe(adminUi.error)}</div>`:''}
 <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Аккаунт</th><th>Статус</th><th>Регистрация</th><th>Последний вход и учёба</th><th>Тесты</th><th>Действия</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Ничего не найдено. Если страница пуста после удаления, вернись на предыдущую.</td></tr>'}</tbody></table></div>
 <div class="admin-pagination"><button class="secondary-btn" data-admin-page="${adminUi.page-1}" ${isLoading||adminUi.page<=1?'disabled':''}>Назад</button><span>${adminUi.page} / ${maxPage}</span><button class="secondary-btn" data-admin-page="${adminUi.page+1}" ${isLoading||adminUi.page>=maxPage?'disabled':''}>Вперёд</button></div></section>
 <section class="surface admin-panel"><h2>Журнал действий</h2><p>Последние 15 административных операций. В журнале нет паролей и кодов восстановления.</p><div class="admin-audit">${adminUi.audit.length?adminUi.audit.map(r=>`<div><span>${adminWhen(r.at)}</span><b>${r.action==='delete'?'Удалён':r.action==='ban'?'Заблокирован':r.action==='reset_password'?'Сброшен пароль':'Разблокирован'}: ${safe(r.target_login)}</b><small>Администратор: ${safe(r.actor_login)}</small></div>`).join(''):'Пока административных действий нет.'}</div></section>
 ${adminUi.issued?`<section class="admin-issued" role="dialog" aria-modal="true"><h2>Новые данные доступа для ${safe(adminUi.issued.login)}</h2><p>Отобразятся только сейчас. Передай их пользователю после проверки личности по защищённому каналу. Новый резервный код заменяет прежний. Рекомендуй пользователю немедленно поменять временный пароль.</p><label>Временный пароль<code>${safe(adminUi.issued.password)}</code></label><button class="secondary-btn" data-admin-copy="password">Скопировать пароль</button><label>Новый резервный код<code>${safe(adminUi.issued.recovery_code)}</code></label><button class="secondary-btn" data-admin-copy="recovery">Скопировать код</button><button class="primary-btn" data-admin-issued-close="1">Я сохранил данные, закрыть</button></section>`:''}
 ${confirmBox}`;
}
async function adminRequest(payload){
 if(!accountId())throw Error('Требуется вход в аккаунт');
 const token=decodeJwt(auth.access_token);
 if(token.exp&&token.exp*1000<Date.now()+90000){if(!await refreshAuth())throw Error('Сессия истекла. Войди заново.');}
 const reply=await cloudFetch('/functions/v1/gia-admin',{method:'POST',body:JSON.stringify(payload)});
 return reply.data;
}
async function adminCheck(){
 const user=accountId();if(!user){adminReset();return;}
 adminUi.checked=false;
 try{const result=await adminRequest({action:'status'});
  if(accountId()!==user)return;
  adminUi.allowed=result.is_admin===true;adminUi.checked=true;
 }catch(e){adminUi.allowed=false;adminUi.checked=false;}
 render();
}
async function adminLoad(){
 if(!adminUi.allowed||adminUi.loading)return;
 adminUi.loading=true;adminUi.error='';render();
 try{
  const result=await adminRequest({action:'list',page:adminUi.page,search:adminUi.search});
  adminUi.users=Array.isArray(result.users)?result.users:[];
  adminUi.total=Number(result.total)||0;
  const audit=await adminRequest({action:'audit'});
  adminUi.audit=Array.isArray(audit.records)?audit.records:[];
 }catch(e){adminUi.error='Не удалось загрузить пользователей: '+e.message;}
 finally{adminUi.loading=false;render();}
}
async function adminExecute(confirmation,admin_password=''){
 const a=adminUi.action;
 if(!adminUi.allowed||!a||adminUi.busy)return;
 adminUi.busy=true;render();
 try{
  const result=await adminRequest({action:a.kind,user_id:a.id,confirmation,...(a.kind==='reset_password'?{admin_password}:{})});
  if(!result.ok)throw Error('Сервер не подтвердил действие');
  adminUi.action=null;adminUi.issued=a.kind==='reset_password'?{login:a.login,password:result.temporary_password,recovery_code:result.recovery_code}:null;notify(result.warning||'Действие выполнено');
  adminUi.loading=false;await adminLoad();
 }catch(e){adminUi.error='Ошибка управления аккаунтом: '+e.message;notify(adminUi.error,'error');}
 finally{adminUi.busy=false;render();}
}
function authView(){
 const mode=ui.authMode,ready=cloudReady(),saved=mode==='code';
 const caption=mode==='signup'?'Создать учётную запись':mode==='reset'?'Восстановить пароль':saved?'Сохрани код восстановления':'С возвращением';
 const hint=mode==='signup'?'Придумай уникальный логин и выбери ник, который будут видеть в приложении.':mode==='reset'?'Введи логин и резервный код, полученный при регистрации.':saved?'Этот код показывается только один раз. Он нужен, если забудешь пароль.':'Войди по логину, чтобы продолжить подготовку на любом устройстве.';
 const loginField=`<label>Логин<input type="text" name="username" autocomplete="username" inputmode="text" autocapitalize="none" autocorrect="off" maxlength="24" pattern="[A-Za-z][A-Za-z0-9_]{3,23}" title="4–24 символа: латинские буквы, цифры, _; первый символ — буква" required placeholder="Например, ania_2026"></label>`;
 const passwordField=`<label>Пароль<input type="password" name="password" autocomplete="${mode==='signup'?'new-password':'current-password'}" minlength="${mode==='signup'?8:8}" required placeholder="Не менее 8 символов"></label>`;
 const fields=mode==='signup'?loginField+`<label>Ник в системе<input type="text" name="nickname" maxlength="32" minlength="2" autocomplete="nickname" required placeholder="Например, Аня · 6 курс"></label>`+passwordField+`<label>Подтверждение пароля<input type="password" name="confirm" autocomplete="new-password" minlength="8" required placeholder="Повтори пароль"></label>`:mode==='reset'?loginField+`<label>Резервный код восстановления<input type="text" name="recovery_code" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" required placeholder="Код, сохранённый при регистрации"></label><label>Новый пароль<input type="password" name="password" autocomplete="new-password" minlength="8" required placeholder="Не менее 8 символов"></label><label>Подтверждение пароля<input type="password" name="confirm" autocomplete="new-password" minlength="8" required placeholder="Повтори новый пароль"></label>`:loginField+passwordField;
 return `<div class="auth-screen"><header class="auth-top"><div class="auth-logo"><span class="brand-symbol">${icon('stethoscope')}</span><strong>ГИА<span class="brand-dot">.</span>мед</strong></div><div class="auth-display-controls"><button type="button" class="theme-quick" data-palette-picker="1" title="Палитра">${icon('palette')}</button><button type="button" class="theme-quick" data-theme-toggle="1" title="Сменить тему">${icon(document.documentElement.dataset.theme==='dark'?'sun':'moon')}</button></div></header><main class="auth-wrap"><section class="auth-intro"><span class="auth-label">СИБГМУ · ЛЕЧЕБНОЕ ДЕЛО</span><h1>Готовься уверенно.<br><em>В своём ритме.</em></h1><p>Тесты, клинические задачи и персональная аналитика в одном пространстве.</p><div class="auth-feature"><span>${icon('check-circle')} 1 049 тестов</span><span>${icon('clipboard')} 183 задачи</span><span>${icon('chart')} Личная статистика</span></div><div class="auth-benefits"><h2>Зачем регистрироваться?</h2><ul><li><strong>Один прогресс на всех устройствах.</strong> Продолжай с iPhone, iPad или ноутбука.</li><li><strong>Личный дашборд.</strong> Точность, охват, ошибки и повторение.</li><li><strong>Лига ГИА.мед.</strong> Автоматическое участие в недельном и общем рейтинге под твоим ником.</li><li><strong>Практика и восстановление.</strong> Сохраняй ответы на клинические задачи и восстанавливай пароль резервным кодом.</li></ul><p>В рейтинге видны только ник и учебные показатели. Логин и история ошибок не публикуются.</p></div></section><section class="auth-card"><div class="auth-card-top"><span class="auth-chip">${icon('shield')} Личный кабинет</span><h2>${caption}</h2><p>${hint}</p><div class="auth-benefit-teaser">Регистрация сохраняет прогресс на всех устройствах и автоматически включает тебя в рейтинг под ником.<details><summary>Все преимущества аккаунта</summary><ul><li>Общая статистика и история ошибок</li><li>Автосинхронизация тестов и практических задач</li><li>Рейтинги за неделю и всё время</li><li>Восстановление через резервный код</li></ul></details></div></div>${ui.paletteOpen?`<div class="auth-palette"><div class="palette-options">${paletteChoices()}</div></div>`:''}${!ready&&!saved?`<div class="auth-unconfigured">${icon('info')} <span>Сервер регистрации ещё не подключён. Сейчас доступен гостевой режим, а аккаунты начнут работать после настройки Supabase и защищённых серверных функций.</span></div>`:''}${mode==='signup'&&ready&&!CONFIG.turnstileSiteKey?'<p class="auth-notice">Публичная регистрация временно недоступна: администратор ещё не настроил защиту формы.</p>':''}${ui.authMessage?`<p class="auth-notice" role="status">${safe(ui.authMessage)}</p>`:''}${saved?`<section class="recovery-code-box"><p><strong>Сохрани секретный код в надёжном месте.</strong> Без него и без действующего пароля восстановить доступ автоматически нельзя.</p><code id="recoveryCode">${safe(ui.newRecoveryCode)}</code><button type="button" class="secondary-btn" data-copy-recovery="1">${icon('bookmark')} Скопировать код</button></section><button type="button" class="primary-btn auth-submit" data-auth-mode="login">Ко входу ${icon('arrow-right')}</button>`:`<form id="authGateForm" class="auth-form auth-gate-form" data-mode="${mode}">${fields}${mode==='signup'?'<p class="auth-privacy-note">При регистрации твой ник и учебные баллы автоматически участвуют в общем рейтинге. Не используй личные данные в нике.</p><div id="giaTurnstile" class="gia-turnstile" aria-label="Проверка безопасности"></div>':''}<button class="primary-btn auth-submit" type="submit" ${!ready||ui.authBusy||(mode==='signup'&&!CONFIG.turnstileSiteKey)?'disabled':''}>${ui.authBusy?'Выполняется…':mode==='signup'?'Зарегистрироваться':mode==='reset'?'Сменить пароль':'Войти'} ${icon('arrow-right')}</button></form>`}<div class="auth-links">${mode==='login'?`<button data-auth-mode="reset">Забыли пароль?</button><button data-auth-mode="signup">Создать аккаунт</button>`:mode==='signup'?`<span>Уже есть аккаунт?</span><button data-auth-mode="login">Войти</button>`:mode==='reset'?`<button data-auth-mode="login">Вернуться ко входу</button>`:''}</div>${!saved?`<div class="auth-divider"><span>или</span></div><button type="button" class="auth-guest" data-guest-enter="1">${icon('hard-drive')} Продолжить без аккаунта ${icon('arrow-right')}</button><p class="auth-guest-note">Гостевая статистика сохраняется только в этом браузере. Пароли и аккаунты локально не имитируются.</p>`:''}</section></main><footer class="auth-footer">ГИА.мед · Подготовка по программе государственного экзамена СибГМУ 2025</footer></div>`;
}

function mountSignupCaptcha(){
 const host=document.getElementById('giaTurnstile');
 if(!host||!cloudReady()||!CONFIG.turnstileSiteKey||!window.turnstile)return;
 try{
  giaTurnstileWidget=window.turnstile.render(host,{
   sitekey:CONFIG.turnstileSiteKey,
   action:'gia-signup',
   theme:document.documentElement.dataset.theme==='dark'?'dark':'light',
   'expired-callback':()=>{},
   'error-callback':()=>{}
  });
 }catch(err){host.textContent='Не удалось загрузить проверку безопасности. Обнови страницу.';}
}
window.addEventListener('gia-turnstile-ready',()=>mountSignupCaptcha());
function disposeSignupCaptcha(){
 if(giaTurnstileWidget!==null&&window.turnstile){try{window.turnstile.remove(giaTurnstileWidget)}catch{}}
 giaTurnstileWidget=null;
}
function render(){disposeSignupCaptcha();if(ui.authMode==='update'||(!accountId()&&!guestMode)){$('#app').innerHTML=authView();document.title='Вход · ГИА.мед';mountSignupCaptcha();return;}const ix=indexes();const inSession=!!ui.sessionId&&ui.tab==='tests';if(inSession&& !ix.starts.some(s=>s.sessionId===ui.sessionId))ui.sessionId=null;let main='';
 if(ui.tab==='home')main=homeView(ix);
 if(ui.tab==='league')main=leagueView();
  if(ui.tab==='tests')main=ui.reportId?reportView(ix):ui.sessionId?sessionView(ix):testsView(ix);
 if(ui.tab==='cases')main=ui.caseId?caseView(ix):caseList(ix);
 if(ui.tab==='mistakes')main=mistakesView(ix);
 if(ui.tab==='stats')main=statsView(ix);
 if(ui.tab==='profile')main=profileView(ix);
 if(ui.tab==='admin')main=adminView();
 $('#app').innerHTML=shell(main,ix)+figureOverlay();
 document.title=(ui.sessionId?'Решение теста · ':'')+'ГИА.мед — подготовка к госэкзамену';
 leagueMaybeLoad();
}
function startSession(ids,mode,block){let clean=[...new Set(ids)].filter(id=>QM.get(id));if(!clean.length){notify('Здесь пока нет вопросов для повторения.');return}
 const ix=indexes();if(ix.active)append('session_end',{sessionId:ix.active.sessionId,reason:'replaced'},{silent:true});
 const sessionId=guid();append('session_start',{sessionId,mode,block:block||null,ids:clean},{silent:true});ui.sessionId=sessionId;ui.reportId=null;ui.tab='tests';render();scrollTop();}
function scrollTop(){window.scrollTo({top:0,behavior:'instant'})}
function answer(k){const ix=indexes(),s=ix.starts.find(x=>x.sessionId===ui.sessionId);if(!s)return;const q=QM.get(s.ids[cursorOf(s,ix)]);if(!q?.a||!q.o.some(o=>o.k===k)||ix.bySession.get(s.sessionId)?.some(x=>x.qid===q.id))return;const lastCursor=ix.cursors.filter(x=>x.sessionId===s.sessionId).at(-1);const startAt=lastCursor?.at||s.at;const responseMs=Math.max(0,Date.now()-Date.parse(startAt));append('attempt',{sessionId:s.sessionId,qid:q.id,choice:k,correct:k===q.a,responseMs});}
function advance(){const ix=indexes(),s=ix.starts.find(x=>x.sessionId===ui.sessionId);if(!s)return;const cur=cursorOf(s,ix);if(cur>=s.ids.length-1){endSession('finished');return}append('session_cursor',{sessionId:s.sessionId,cursor:cur+1});scrollTop();}
function endSession(reason='finished'){const s=indexes().starts.find(x=>x.sessionId===ui.sessionId);if(!s)return;append('session_end',{sessionId:s.sessionId,reason,elapsedMs:Math.max(0,Date.now()-Date.parse(s.at))},{silent:true});ui.sessionId=null;ui.reportId=s.sessionId;render();scrollTop();}
function quitSession(){ui.sessionId=null;ui.reportId=null;render();scrollTop();}
function toTab(tab){if(tab==='admin'&&!adminUi.allowed)return;if(tab==='admin')setTimeout(()=>adminLoad(),0);if(tab==='league')setTimeout(()=>leagueLoad(false),0);ui.figure=null;ui.paletteOpen=false;ui.tab=tab;ui.sessionId=null;ui.reportId=null;ui.caseId=null;render();scrollTop();}
function switchCase(n){if(n<1||n>CASES.length)return;ui.caseId=n;ui.showCaseReference=false;render();scrollTop();}
function reviewNow(){const ix=indexes();const qs=Q.filter(q=>q.a&&dueInfo(q,ix)?.due<=Date.now()).map(q=>q.id);if(!qs.length){notify('Пока нет вопросов по графику. Начни с любого блока!');return}startSession(qs.slice(0,50),'review')}
function mistakesNow(){const ix=indexes();const ids=overall(ix).errors.map(q=>q.id);if(!ids.length){notify('Незакрытых ошибок нет. Отлично!');return}startSession(ids.slice(0,50),'mistakes')}
function saveDraft(){if(!ui.caseId)return;const el=$('#caseDraft');if(el&&drafts[ui.caseId]!==el.value){drafts[ui.caseId]=el.value;draftTimes[ui.caseId]=when();saveDrafts();scheduleSync()}}
let syncTimer=null,syncAgain=false;
function scheduleSync(){if(syncing){syncAgain=true;return;}if(resetInProgress||!auth?.access_token||!CONFIG.url||!CONFIG.anonKey)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(false),2300);}
function decodeJwt(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return {}}}
async function cloudFetch(path,options={}) {const base=String(CONFIG.url||'').replace(/\/$/,'');if(!/^https:\/\//.test(base))throw Error('Неверный адрес облака');let headers={'apikey':CONFIG.anonKey,'Content-Type':'application/json',...(options.headers||{})};if(auth?.access_token)headers.Authorization=`Bearer ${auth.access_token}`;const r=await fetch(base+path,{...options,headers});const body=await r.text();let data;try{data=JSON.parse(body)}catch{data=body}if(!r.ok)throw Error(data?.msg||data?.error_description||data?.message||`Ошибка сервера ${r.status}`);return {data,headers:r.headers};}
async function refreshAuth(){if(!auth?.refresh_token)return false;try{const r=await cloudFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:auth.refresh_token})});const a=r.data;auth={...a,user:a.user||auth.user};set(TOKEN,auth);return true}catch{return false}}
function enterUser(session){if(!session?.access_token||!session?.user?.id)throw Error('Не удалось подтвердить личный кабинет');leagueReset();auth=session;set(TOKEN,auth);guestMode=false;set(GUEST,false);loadOwnerData();ui.tab='home';ui.sessionId=null;ui.reportId=null;ui.caseId=null;ui.authMode='login';ui.authMessage='';ui.cloudStatus='syncing';ui.cloudMessage='Получаем прогресс из облака…';render();scrollTop();adminCheck();}
async function accountApi(action,payload){const res=await cloudFetch('/functions/v1/gia-accounts',{method:'POST',body:JSON.stringify({action,...payload})});return res.data}
async function authAction(username,password,method,nickname='',turnstile_token=''){
 if(!cloudReady())return;
 try{ui.authBusy=true;ui.authMessage='';render();
  if(method==='signup'){
    const result=await accountApi('signup',{username,nickname,password,turnstile_token});
    if(!result?.recovery_code)throw Error('Сервер не вернул резервный код');
    ui.newRecoveryCode=result.recovery_code;ui.authMode='code';ui.authMessage='Аккаунт создан. Перед первым входом сохрани свой код восстановления.';
  }else{
    const res=await cloudFetch('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:usernameEmail(username),password})});
    enterUser(res.data);const synchronized=await syncNow(false);notify(synchronized?'Добро пожаловать! Прогресс синхронизирован.':'Вход выполнен, но облако не подтвердило синхронизацию. Проверь статус на главной. ',synchronized?'ok':'error');
  }
 }catch(e){ui.authMessage='Не удалось выполнить действие: '+e.message}finally{ui.authBusy=false;render()}
}
async function recoverAccount(username,recovery_code,password){
 if(!cloudReady())return;
 try{ui.authBusy=true;ui.authMessage='';render();const result=await accountApi('recover',{username,recovery_code,password});
  if(!result?.recovery_code)throw Error('Сервер не вернул новый резервный код');
  ui.newRecoveryCode=result.recovery_code;ui.authMode='code';ui.authMessage='Пароль изменён. Обязательно сохрани новый резервный код, старый больше не действует.';
 }catch(e){ui.authMessage='Не удалось восстановить доступ: '+e.message}finally{ui.authBusy=false;render()}
}
async function signOut(){if(ui.cloudBusy)return;const prior=auth;auth=null;adminReset();leagueReset();localStorage.removeItem(TOKEN);guestMode=false;set(GUEST,false);loadOwnerData();ui.sessionId=null;ui.caseId=null;ui.tab='home';ui.authMode='login';ui.authMessage='Вы вышли из аккаунта. Его прогресс остался отдельно.';ui.cloudMessage='';ui.cloudStatus='idle';render();if(prior?.access_token&&cloudReady()){try{await fetch(String(CONFIG.url).replace(/\/$/, '')+'/auth/v1/logout',{method:'POST',headers:{'apikey':CONFIG.anonKey,'Authorization':'Bearer '+prior.access_token}})}catch{}}}
let syncing=false,resetInProgress=false,lastCloudRefreshAttempt=0;
async function syncNow(userInitiated=true){if(syncing){syncAgain=true;if(userInitiated)notify('Синхронизация уже идёт; повторю после неё.');return;}if(resetInProgress||!auth?.access_token||!CONFIG.url||!CONFIG.anonKey){if(userInitiated)notify('Сначала настрой облако и войди в аккаунт.');return}syncing=true;lastCloudRefreshAttempt=Date.now();ui.cloudBusy=true;ui.cloudStatus='syncing';if(userInitiated)render();try{
 const usr=accountId();if(!usr)throw Error('Не удалось определить аккаунт.');
 // Refresh before expiry, if necessary.
 const jwt=decodeJwt(auth.access_token);if(jwt.exp&&jwt.exp*1000<Date.now()+120000){const ok=await refreshAuth();if(!ok)throw Error('Сессия истекла. Войди снова.');}
 const epochReply=await cloudFetch('/rest/v1/rpc/gia_get_generation',{method:'POST',body:'{}'});
 const generation=epochReply.data;
 if(typeof generation!=='string'||!/^[0-9a-f-]{36}$/i.test(generation))throw Error('Не удалось получить версию облачного прогресса');
 const epochKey=ownerKey(GENERATION),storedGeneration=read(epochKey,null);
 if(storedGeneration&&storedGeneration!==generation){events=[];drafts={};draftTimes={};saveEvents();saveDrafts();ui.sessionId=null;ui.caseId=null;ui.reportId=null;}
 set(epochKey,generation);
 const incoming=[];let offset=0;for(;;){const r=await cloudFetch(`/rest/v1/progress_events?select=id,event,created_at&user_id=eq.${encodeURIComponent(usr)}&generation=eq.${generation}&order=created_at.asc&limit=1000&offset=${offset}`,{method:'GET'});const page=r.data;if(!Array.isArray(page))throw Error('Ошибка формата облака');incoming.push(...page.map(row=>row.event).filter(e=>e?.id&&e?.type));if(page.length<1000)break;offset+=1000;if(offset>100000)throw Error('Слишком много записей для синхронизации');}
 if(accountId()!==usr) return;let current=new Map(events.map(e=>[e.id,e]));for(const e of incoming)if(!current.has(e.id))current.set(e.id,e);
 let oldCloud=new Set(incoming.map(e=>e.id)),missing=events.filter(e=>!oldCloud.has(e.id));
 for(let i=0;i<missing.length;i+=100){let batch=missing.slice(i,i+100).map(e=>({id:e.id,user_id:usr,generation,event:e}));await cloudFetch('/rest/v1/progress_events?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(batch)});}
 if(accountId()!==usr)return;for(const e of events)if(e?.id&&!current.has(e.id))current.set(e.id,e);events=[...current.values()].sort(byTime);saveEvents();
 await syncCaseDrafts(usr,generation);
 if(accountId()!==usr)return false;ui.cloudStatus='ok';ui.cloudMessage=`Синхронизировано в ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · ${incoming.length} записей в облаке · добавлено с устройства ${missing.length}.`;
 if(ui.tab==='league')leagueLoad(false);
 if(userInitiated)notify('Прогресс синхронизирован');return true;
 }catch(e){ui.cloudStatus='error';ui.cloudMessage=`Ошибка синхронизации: ${e.message}`;if(userInitiated)notify(ui.cloudMessage,'error');return false;}finally{syncing=false;ui.cloudBusy=false;const again=syncAgain;syncAgain=false;if(userInitiated||!document.activeElement?.matches?.('input,textarea,[contenteditable=true]'))render();if(again)scheduleSync()}}
async function syncCaseDrafts(userId,generation){
 // RLS restricts drafts to current account + reset generation.
 const res=await cloudFetch(`/rest/v1/gia_case_drafts?select=case_id,body,updated_at&user_id=eq.${encodeURIComponent(userId)}&generation=eq.${generation}&limit=300`,{method:'GET'});
 if(!Array.isArray(res.data))throw Error('Не удалось получить черновики практики');
 const remote=new Map(res.data.map(x=>[String(x.case_id),x]));const updates=[];
 for(const [caseId,body] of Object.entries(drafts)){
  if(!/^\d+$/.test(caseId)||Number(caseId)<1||Number(caseId)>CASES.length)continue;
  const theirs=remote.get(caseId);const localAt=draftTimes[caseId]||when();
  if(theirs&&Date.parse(theirs.updated_at)>Date.parse(localAt)){
   drafts[caseId]=theirs.body;draftTimes[caseId]=theirs.updated_at;
  }else if(!theirs||Date.parse(localAt)>Date.parse(theirs.updated_at)){
   updates.push({user_id:userId,generation,case_id:Number(caseId),body:String(body).slice(0,12000),updated_at:localAt});
  }
  remote.delete(caseId);
 }
 for(const [caseId,entry] of remote){drafts[caseId]=entry.body;draftTimes[caseId]=entry.updated_at}
 if(updates.length){await cloudFetch('/rest/v1/gia_case_drafts?on_conflict=user_id,generation,case_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(updates)});}
 saveDrafts();
}
async function resetProgress(){
 if(resetInProgress||syncing||ui.cloudBusy){notify('Синхронизация ещё выполняется. Повтори сброс после её завершения.','error');return;}
 resetInProgress=true;clearTimeout(syncTimer);ui.cloudBusy=true;render();
 try{
  const userId=accountId();
  if(userId){
   const r=await cloudFetch('/rest/v1/rpc/gia_reset_progress',{method:'POST',body:'{}'});
   if(!r.data||typeof r.data!=='string')throw Error('Облако не подтвердило сброс');
   set(ownerKey(GENERATION),r.data);
  }
  events=[];drafts={};draftTimes={};saveEvents();saveDrafts();ui.resetOpen=false;ui.tab='home';ui.sessionId=null;ui.reportId=null;ui.caseId=null;ui.showCaseReference=false;ui.figure=null;
  ui.cloudMessage='История текущего профиля очищена. Можно пройти всё заново.';
  notify('Статистика тестов и задач сброшена');
 }catch(e){notify('Сброс не выполнен: '+e.message,'error')}
 finally{resetInProgress=false;ui.cloudBusy=false;render();}
}
function migrateGuestProgress(){
 if(!accountId()){notify('Сначала войди в личный кабинет','error');return;}
 const guestEvents=read(KEY,[]),guestDrafts=read(DRAFT,{});
 if(!guestEvents.length&&!Object.keys(guestDrafts).length){notify('Гостевого прогресса на этом устройстве нет');return;}
 if(!confirm('Перенести сохранённые гостевые ответы и черновики в этот аккаунт? Существующие результаты аккаунта сохранятся.'))return;
 const ids=new Set(events.map(e=>e.id));for(const e of guestEvents)if(e?.id&&!ids.has(e.id)){events.push(e);ids.add(e.id)}
 events.sort(byTime);saveEvents();for(const [caseId,body] of Object.entries(guestDrafts))if(!(caseId in drafts)||!drafts[caseId]){drafts[caseId]=body;draftTimes[caseId]=when()};saveDrafts();
 notify('Гостевой прогресс перенесён. Выполняется синхронизация');render();scheduleSync();
}
function downloadJSON(){const blob=new Blob([JSON.stringify({app:'gia-med',version:3,exported:when(),events,drafts,draftTimes,appearance:{palette:paletteId(document.documentElement.dataset.palette),theme:document.documentElement.dataset.theme}},null,2)],{type:'application/json'});const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='ГИА_прогресс_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),3000);}
async function importJSON(file){try{const text=await file.text(),obj=JSON.parse(text);if(obj.app!=='gia-med'||!Array.isArray(obj.events))throw Error('Неверный формат файла');let map=new Map(events.map(e=>[e.id,e]));for(const e of obj.events){if(e&&typeof e.id==='string'&&typeof e.type==='string')map.set(e.id,e)}events=[...map.values()].sort(byTime);drafts={...(obj.drafts||{}),...drafts};for(const id of Object.keys(obj.drafts||{}))if(!draftTimes[id])draftTimes[id]=obj.draftTimes?.[id]||when();saveEvents();saveDrafts();if(obj.appearance?.palette){const pal=paletteId(obj.appearance.palette);document.documentElement.dataset.palette=pal;set(PALETTE,pal)}if(obj.appearance?.theme==='light'||obj.appearance?.theme==='dark'){document.documentElement.dataset.theme=obj.appearance.theme;set(THEME,obj.appearance.theme)}notify('Прогресс и настройки из резервной копии импортированы');render();scheduleSync()}catch(e){notify('Не удалось импортировать: '+e.message,'error')}}
// Event delegation keeps the app responsive even when a view has been replaced.
document.addEventListener('click',e=>{const b=e.target.closest('button,[data-tab]');if(!b)return;
 const d=b.dataset;
 if(d.adminOpen){toTab('admin');return;}
 if(d.adminRefresh){adminLoad();return;}
 if(d.adminPage){const n=Number(d.adminPage);if(n>=1&&n<=Math.ceil(adminUi.total/30)){adminUi.page=n;adminLoad();}return;}
 if(d.adminAct){if(!adminUi.allowed)return;adminUi.action={kind:d.adminAct,id:d.adminId,login:d.adminLogin};adminUi.issued=null;render();return;}
 if(d.adminCancel){adminUi.action=null;adminUi.issued=null;render();return;}
 if(d.adminIssuedClose){adminUi.issued=null;render();return;}
 if(d.adminCopy){const val=d.adminCopy==='password'?adminUi.issued?.password:adminUi.issued?.recovery_code;if(val)navigator.clipboard?.writeText(val).then(()=>notify('Скопировано')).catch(()=>notify('Не удалось скопировать','error'));return;}
 if(d.leagueCat){if(LEAGUE_CATEGORIES.some(x=>x[0]===d.leagueCat)){leagueUi.category=d.leagueCat;leagueUi.data=null;leagueUi.loadedAt=0;render();leagueLoad(true);}return;}
 if(d.leagueRefresh){leagueUi.loadedAt=0;leagueLoad(true);return;}
 if(d.guestEnter){guestMode=true;set(GUEST,true);loadOwnerData();ui.authMessage='';ui.tab='home';render();scrollTop();return;}
 if(d.openAuth){guestMode=false;set(GUEST,false);ui.authMode='login';ui.authMessage='';render();return;}
 if(d.authMode){ui.authMode=d.authMode;ui.authMessage='';ui.newRecoveryCode='';render();return;}
 if(d.copyRecovery){const code=ui.newRecoveryCode; if(navigator.clipboard?.writeText)navigator.clipboard.writeText(code).then(()=>notify('Код скопирован')).catch(()=>notify('Скопируй код вручную','error'));else notify('Выдели код и скопируй вручную');return;}
 if(!accountId()&&!guestMode&&!(d.paletteSelect||d.palettePicker||d.themeToggle))return;
 if(d.tab){saveDraft();toTab(d.tab);return}
 if(d.sub){ui.sub=d.sub;render();return}
 if(d.startBlock){const n=Number(d.startBlock),q=blockData()[n-1];startSession(q.qs.map(v=>v.id),'block',n);return}
 if(d.topic){startSession(Q.filter(q=>q.topic===d.topic).map(q=>q.id).slice(Number(d.offset)||0,(Number(d.offset)||0)+50),'topic');return}
 if(d.single){startSession([Number(d.single)],'single');return}
 if(d.startReview){reviewNow();return}
 if(d.startMistakes){mistakesNow();return}
 if(d.resume){ui.sessionId=indexes().active?.sessionId||null;ui.tab='tests';ui.reportId=null;render();scrollTop();return}
 if(d.answer){answer(d.answer);return}
 if(d.next){advance();return}
 if(d.quit){quitSession();return}
 if(d.finish){endSession('finished');return}
 if(d.star){const id=Number(d.star),old=!!indexes().bookmarks.get(id);append('star',{qid:id,active:!old});return}
 if(d.goTests){toTab('home');return}
 if(d.retryIds!==undefined){let ids=d.retryIds.split(',').map(Number).filter(Boolean);if(!ids.length)ids=Q.filter(q=>q.a).sort(()=>Math.random()-.5).slice(0,50).map(q=>q.id);startSession(ids,'mistakes');return}
 if(d.sort){ui.sort=d.sort;render();return}
 if(d.case){switchCase(Number(d.case));return}
 if(d.backCases){saveDraft();ui.caseId=null;ui.showCaseReference=false;render();scrollTop();return}
 if(d.caseNext){saveDraft();switchCase(ui.caseId+1);return}
 if(d.casePrev){saveDraft();switchCase(ui.caseId-1);return}
 if(d.checkCase){saveDraft();ui.showCaseReference=true;render();return}
 if(d.verdict){saveDraft();append('case_review',{caseId:ui.caseId,verdict:d.verdict,input:(drafts[ui.caseId]||'').slice(0,6000)});notify('Результат практической задачи сохранён');return}
 if(d.openPdf){openSourcePDF(d.openPdf);return}
 if(d.downloadPdf){downloadSourcePDF();return}
 if(d.figure){const [caseId,index]=d.figure.split(':').map(Number);saveDraft();ui.figure={caseId,index};render();return}
 if(d.figureClose){ui.figure=null;render();return}
 if(d.palettePicker){ui.paletteOpen=!ui.paletteOpen;render();return}
 if(d.paletteSelect){const newPalette=paletteId(d.paletteSelect);document.documentElement.dataset.palette=newPalette;set(PALETTE,newPalette);ui.paletteOpen=false;render();notify('Палитра «'+PALETTES.find(p=>p.id===newPalette).name+'» выбрана');return}
 if(d.themeToggle){let val=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=val;set(THEME,val);render();return}
 if(d.resetOpen){ui.resetOpen=true;render();return;}
 if(d.resetCancel){ui.resetOpen=false;render();return;}
 if(d.export){downloadJSON();return}
 if(d.sync){syncNow();return}
 if(d.migrateGuest){migrateGuestProgress();return}
 if(d.logout){signOut();return}

 });
document.addEventListener('submit',e=>{
 if(e.target.id==='adminSearchForm'){
  e.preventDefault();if(!adminUi.allowed)return;
  adminUi.search=String(e.target.elements.search.value||'').trim().slice(0,64);
  adminUi.page=1;adminLoad();return;
 }
 if(e.target.id==='adminActionForm'){
  e.preventDefault();if(!adminUi.allowed||!adminUi.action)return;
  const value=String(e.target.elements.confirmation.value||'').trim().toLowerCase();
  if(value!==adminUi.action.login.toLowerCase()){notify('Для подтверждения введи точный логин пользователя','error');return;}
  adminExecute(value,adminUi.action.kind==='reset_password'?String(e.target.elements.admin_password?.value||''):'');return;
 }

 if(e.target.id==='resetProgressForm'){
  e.preventDefault();const f=e.target;
  if(String(f.elements.confirmation.value||'').trim()!=='СБРОСИТЬ'||!f.elements.acknowledge.checked){notify('Введи точно «СБРОСИТЬ» и отметь подтверждение','error');return;}
  resetProgress();return;
 }
 if(e.target.id==='authGateForm'){
  e.preventDefault();if(!cloudReady()||ui.authBusy)return;
  const f=e.target,mode=f.dataset.mode;
  const username=String(f.elements.username.value||'').trim().toLowerCase();
  if(!/^[a-z][a-z0-9_]{3,23}$/.test(username)){ui.authMessage='Логин: 4–24 латинских символа, цифры и _, начинать с буквы.';render();return;}
  const password=f.elements.password?.value||'';
  if(password.length<8){ui.authMessage='Пароль должен содержать минимум 8 символов.';render();return;}
  if((mode==='signup'||mode==='reset')&&password!==f.elements.confirm.value){ui.authMessage='Пароли не совпадают.';render();return;}
  if(mode==='reset'){recoverAccount(username,String(f.elements.recovery_code.value||'').trim(),password);return;}
  const nickname=String(f.elements.nickname?.value||'').trim();
  let turnstile_token='';
  if(mode==='signup'){
   turnstile_token=(window.turnstile&&giaTurnstileWidget!==null)?window.turnstile.getResponse(giaTurnstileWidget):'';
   if(!turnstile_token){ui.authMessage='Заверши проверку безопасности перед регистрацией.';render();return;}
  }
  if(mode==='signup'&&(nickname.length<2||nickname.length>32)){ui.authMessage='Ник должен содержать от 2 до 32 символов.';render();return;}
  authAction(username,password,mode,nickname,turnstile_token);
 }
});
document.addEventListener('input',e=>{if(e.target.id==='caseDraft'){saveDraft();return}if(e.target.id==='testSearch'){ui.search=e.target.value;let term=ui.search.toLowerCase().trim();$('#searchResults').innerHTML=searchResults(term.length>=2?Q.filter(q=>q.q.toLowerCase().includes(term)||String(q.id)===term||q.o.some(o=>o.t.toLowerCase().includes(term))):[],term);return}if(e.target.id==='caseSearch'){let start=e.target.selectionStart||0;ui.caseSearch=e.target.value;render();let input=$('#caseSearch');input?.focus();input?.setSelectionRange(start,start);return}});
document.addEventListener('change',e=>{if(e.target.id==='importFile'&&e.target.files?.[0])importJSON(e.target.files[0])});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.paletteOpen){ui.paletteOpen=false;render();return}if(e.key==='Escape'&&ui.figure){ui.figure=null;render();return}if(e.target.closest('input,textarea,select'))return;if(ui.tab==='tests'&&ui.sessionId){const ix=indexes(),s=ix.starts.find(x=>x.sessionId===ui.sessionId);if(!s)return;const q=QM.get(s.ids[cursorOf(s,ix)]),previous=(ix.bySession.get(s.sessionId)||[]).some(x=>x.qid===q.id);if(e.key==='Enter'){e.preventDefault();if(previous)advance();return}if(!previous&&/^[1-9]$/.test(e.key)){const opt=shuffleOptions(q,s.sessionId)[Number(e.key)-1];if(opt)answer(opt.k)}}});
// Sync from remote when this device is resumed (not just on first sign-in).
// Local answers continue to be queued via scheduleSync().
function pullCloudOnResume(){
 if(document.visibilityState==='hidden'||!navigator.onLine||!accountId()||!cloudReady()||syncing||resetInProgress)return;
 const now=Date.now();
 if(now-lastCloudRefreshAttempt<20000)return; // Avoid rapid duplicate requests.
 lastCloudRefreshAttempt=now;
 syncNow(false);
}
window.addEventListener('online',()=>{scheduleSync();pullCloudOnResume()});
window.addEventListener('focus',pullCloudOnResume);
window.addEventListener('pageshow',pullCloudOnResume);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullCloudOnResume()});
setInterval(pullCloudOnResume,45000);
// The countdown updates at the next calendar day even if the home screen stays open.
setInterval(refreshGiaCountdown,60000);
window.addEventListener('focus',refreshGiaCountdown);
window.addEventListener('pageshow',refreshGiaCountdown);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshGiaCountdown();});
document.addEventListener('click',e=>{if(ui.paletteOpen&&!e.target.closest('.palette-control')){ui.paletteOpen=false;render()}});
window.addEventListener('storage',e=>{if(e.key===ownerKey(KEY)||e.key===ownerKey(GENERATION)){events=read(ownerKey(KEY),[]);drafts=read(ownerKey(DRAFT),{});render()}else if(e.key===THEME||e.key===PALETTE){initTheme();render()}});
function registerSW(){if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
initTheme();render();registerSW();if(accountId()&&cloudReady()){setTimeout(()=>syncNow(false),1300);setTimeout(()=>adminCheck(),900);}
})();
