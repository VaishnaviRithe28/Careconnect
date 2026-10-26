const TOTAL_ROOMS = 74, FEVER_THRESHOLD = 38, REQUIRED_FEVER_FREE_DAYS = 3;
const KEY = "ward74-html-state-v1";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2,10);
const todayStr = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const shiftDay = (date, delta) => { const [y,m,d]=date.split("-").map(Number); const dt=new Date(y,m-1,d+delta); return todayStr(dt); };
const isFever = t => t >= FEVER_THRESHOLD;
const hasReadingOn = (s,pid,date) => s.readings.some(r=>r.patientId===pid&&r.date===date);
const reviewedOn = (s,pid,date) => s.reviews.some(r=>r.patientId===pid&&r.date===date);
const occupiedRooms = s => new Set(s.patients.filter(p=>p.status==="admitted").map(p=>p.room));
const isRoomFree = (s,room) => Number.isInteger(room)&&room>=1&&room<=TOTAL_ROOMS&&!occupiedRooms(s).has(room);
const readingsFor = (s,pid) => s.readings.filter(r=>r.patientId===pid).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
function feverFreeStreak(s,pid,today){
  let day=hasReadingOn(s,pid,today)?today:shiftDay(today,-1), n=0;
  for(;;){const rs=s.readings.filter(r=>r.patientId===pid&&r.date===day);if(!rs.length||rs.some(r=>isFever(r.temp)))return n;n++;day=shiftDay(day,-1);}
}
const isEligible = (s,pid,today) => feverFreeStreak(s,pid,today)>=REQUIRED_FEVER_FREE_DAYS;
function seed(){
  const names=["Aarav Shah","Meera Iyer","Rohan Das","Priya Nair","Kabir Mehta","Ananya Rao","Vikram Singh","Isha Kapoor","Arjun Pillai","Sana Khan","Dev Patel","Neha Joshi","Rahul Verma","Kavya Menon","Farhan Ali","Diya Bose","Aditya Kulkarni","Riya Sen","Nikhil Gupta","Tara Reddy","Omar Sheikh","Pooja Malhotra","Yash Chawla","Zara Qureshi","Manav Jain","Lakshmi Krishnan","Siddharth Roy","Aisha Mirza","Karan Bhatt","Nisha Agarwal","Varun Desai","Simran Gill","Harsh Vora","Ira Banerjee","Kunal Shetty","Mira Dsouza","Tanvi Rane","Joseph Thomas"];
  const s={patients:[],readings:[],reviews:[]}, t=todayStr();
  names.forEach((name,i)=>{
    const id=uid(),closed=i>=30,status=!closed?"admitted":i===37?"deceased":i===36?"transferred":"recovered";
    s.patients.push({id,name,age:20+((i*7)%55),gender:i%2?"F":"M",room:closed?0:i*2+1,admittedOn:shiftDay(t,closed?-20:-6),status,dischargedOn:closed?shiftDay(t,-(i-28)):undefined});
    if(closed)return;
    const kind=i%4;
    for(let o=5;o>=1;o--){if(kind===2&&o===2)continue;let temp=36.6+((i+o)%4)*.2;if(kind===1)temp=37.8+((i+o)%4)*.3;if(kind===3&&o===1)temp=38.4;s.readings.push({id:uid(),patientId:id,date:shiftDay(t,-o),time:"08:30",temp:+temp.toFixed(1)});}
    if(i%3!==2)s.readings.push({id:uid(),patientId:id,date:t,time:"08:15",temp:kind===1?38.3:36.9});
    if(i%5===0&&i%3!==2)s.reviews.push({id:uid(),patientId:id,date:t,note:"Stable."});
  }); return s;
}
let state;
try{state=JSON.parse(localStorage.getItem(KEY))||seed();}catch{state=seed();}
function persist(){localStorage.setItem(KEY,JSON.stringify(state));}
function resetDemo(){if(confirm("Reset all Ward 74 data to the original sample data?")){state=seed();persist();selectedPatient=null;message=null;render();}}
function addReading(patientId,date,time,temp){
  if(hasReadingOn(state,patientId,date))return {ok:false,error:`Duplicate reading: this patient already has a temperature recorded on ${date}.`};
  state.readings.push({id:uid(),patientId,date,time,temp});persist();return {ok:true};
}
function addReview(patientId,note){const d=todayStr();if(!hasReadingOn(state,patientId,d))return {ok:false,error:"Record today's temperature before reviewing."};if(reviewedOn(state,patientId,d))return {ok:false,error:"This patient has already been reviewed today."};state.reviews.push({id:uid(),patientId,date:d,note});persist();return {ok:true};}
function registerPatient(name,age,gender,room){
  if(!name)return {ok:false,error:"Enter the patient's name."};
  if(!Number.isInteger(room)||!isRoomFree(state,room))return {ok:false,error:`Room ${room} is occupied or invalid. Choose a free room between 1 and 74.`};
  state.patients.push({id:uid(),name,age,gender,room,admittedOn:todayStr(),status:"admitted"});persist();return {ok:true};
}
function recordDischarge(id,outcome){
  if(outcome==="recovered"&&!isEligible(state,id,todayStr()))return {ok:false,error:"Patient is not yet eligible: 3 consecutive fever-free days are required."};
  state.patients=state.patients.map(p=>p.id===id?{...p,status:outcome,dischargedOn:todayStr()}:p);persist();return {ok:true};
}
function stats(date){
 const admitted=state.patients.filter(p=>p.status==="admitted"),occupied=occupiedRooms(state).size;
 const recovered=state.patients.filter(p=>p.status==="recovered").length,transferred=state.patients.filter(p=>p.status==="transferred").length,deaths=state.patients.filter(p=>p.status==="deceased").length,closed=recovered+transferred+deaths;
 return {admitted:admitted.length,occupied,available:TOTAL_ROOMS-occupied,pendingTemp:admitted.filter(p=>!hasReadingOn(state,p.id,date)).length,pendingReview:admitted.filter(p=>hasReadingOn(state,p.id,date)&&!reviewedOn(state,p.id,date)).length,eligible:admitted.filter(p=>isEligible(state,p.id,date)).length,recovered,discharged:recovered+transferred,deaths,recoveryRate:closed?Math.round(recovered/closed*1000)/10:0};
}
let role="admin",page="dashboard",selectedPatient=null,message=null,adminFilter="admitted",adminSearch="",pickerSearch="";
const navByRole={admin:[["dashboard","Dashboard"],["admin","Patients & rooms"]],nurse:[["dashboard","Dashboard"],["nurse","Temperature log"]],doctor:[["dashboard","Dashboard"],["doctor","Patient reviews"]]};
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function pill(text,tone="muted"){return `<span class="pill ${tone}">${text}</span>`;}
function pageHead(title,sub,extra=""){return `<div class="page-head"><div><h1>${title}</h1><p class="sub">${sub}</p></div>${extra}</div>`;}
function cardStat(label,value,tone="",hint=""){return `<div class="card"><div class="stat-label">${label}</div><div class="stat-value ${tone}">${value}</div>${hint?`<div class="hint">${hint}</div>`:""}</div>`;}
function patientStatus(st){return st==="admitted"?pill("Admitted","info"):st==="recovered"?pill("Recovered","ok"):st==="transferred"?pill("Transferred"):pill("Deceased","danger");}
function renderNav(){
 const nav=navByRole[role];$("#navigation").innerHTML=nav.map(([id,label])=>`<button data-page="${id}" class="${page===id?"active":""}">${label}</button>`).join("");
}
function renderDashboard(){
 const t=todayStr(),st=stats(t),admitted=state.patients.filter(p=>p.status==="admitted").sort((a,b)=>a.room-b.room),occ=occupiedRooms(state);
 return `${pageHead("Ward overview",`Today · ${t}`)}
 ${st.pendingTemp?`<div class="alert warn">${st.pendingTemp} patient(s) still need today's temperature reading. <button class="btn secondary" data-page="nurse">Go to nurse station</button></div>`:""}
 <div class="section-title">Current census</div><div class="grid stats-grid">
 ${cardStat("Admitted",st.admitted,"primary-text")}${cardStat("Occupied rooms",st.occupied,"",`of ${TOTAL_ROOMS}`)}${cardStat("Available rooms",st.available,"green-text")}${cardStat("Pending temp",st.pendingTemp,"amber-text")}${cardStat("Pending review",st.pendingReview,"amber-text")}${cardStat("Eligible discharge",st.eligible,"green-text")}
 </div><div class="section-title">Outcomes</div><div class="grid outcomes-grid">
 ${cardStat("Recovered",st.recovered,"green-text")}${cardStat("Discharged",st.discharged,"","Recovered + transferred")}${cardStat("Deaths",st.deaths,"red-text")}
 <div class="card"><div class="stat-label">Recovery success rate</div><div class="stat-value green-text">${st.recoveryRate}%</div><div class="progress"><div style="width:${st.recoveryRate}%"></div></div><div class="hint">Recovered ÷ all closed cases</div></div></div>
 <div class="two-col"><div class="card table-card"><div class="table-title">Admitted patients</div><div class="table-wrap"><table><thead><tr><th>Room</th><th>Patient</th><th>Today's temp</th><th>Review</th><th>Fever-free days</th><th>Discharge</th></tr></thead><tbody>
 ${admitted.map(p=>{const streak=feverFreeStreak(state,p.id,t);return `<tr><td>${p.room}</td><td><b>${esc(p.name)}</b></td><td>${hasReadingOn(state,p.id,t)?pill("Recorded","ok"):pill("Pending","warn")}</td><td>${reviewedOn(state,p.id,t)?pill("Done","ok"):pill("Pending")}</td><td>${Math.min(streak,3)}/3</td><td>${isEligible(state,p.id,t)?pill("Eligible","ok"):pill("Not yet")}</td></tr>`;}).join("")}</tbody></table></div></div>
 <div class="card"><div class="card-title">Room map <span class="muted">· ${st.occupied} occupied</span></div><div class="room-map">${Array.from({length:TOTAL_ROOMS},(_,i)=>`<div class="room ${occ.has(i+1)?"occupied":""}" title="Room ${i+1} · ${occ.has(i+1)?"occupied":"free"}">${i+1}</div>`).join("")}</div><p class="hint">Blue = occupied · Grey = available</p></div></div>`;
}
function renderAdmin(){
 const t=todayStr(),occ=occupiedRooms(state),free=Array.from({length:TOTAL_ROOMS},(_,i)=>i+1).filter(r=>!occ.has(r));
 let rows=state.patients.filter(p=>adminFilter==="all"||(adminFilter==="admitted"?p.status==="admitted":p.status!=="admitted")).filter(p=>!adminSearch.trim()||p.name.toLowerCase().includes(adminSearch.trim().toLowerCase())||String(p.room)===adminSearch.trim()).sort((a,b)=>a.room-b.room);
 return `${pageHead("Administration",`${occ.size} of ${TOTAL_ROOMS} rooms occupied · ${free.length} free`,`<button class="btn secondary" id="resetDemo">Reset sample data</button>`)}
 <div class="card" style="margin-bottom:18px"><div class="card-title">Register patient</div><form id="registerForm" class="form-grid">
 <label class="field">Full name<input class="input" name="name" required></label><label class="field">Age<input class="input" name="age" type="number" min="0" max="120" required></label>
 <label class="field">Gender<select class="input" name="gender"><option value="F">Female</option><option value="M">Male</option><option value="O">Other</option></select></label>
 <label class="field">Room (1–74)<input class="input" name="room" type="number" min="1" max="74" list="freeRooms" required><datalist id="freeRooms">${free.map(r=>`<option value="${r}"></option>`).join("")}</datalist></label><button class="btn">Register</button></form>
 ${message?`<div class="alert ${message.ok?"success":"error"}" style="margin:12px 0 0">${esc(message.text)}</div>`:""}</div>
 <div class="card table-card"><div class="toolbar"><input id="adminSearch" class="input search" placeholder="Search patients by name or room…" value="${esc(adminSearch)}"><div class="filters">${[["admitted","Admitted"],["closed","Discharged"],["all","All"]].map(([f,l])=>`<button data-filter="${f}" class="${adminFilter===f?"active":""}">${l}</button>`).join("")}</div></div><div class="table-wrap"><table><thead><tr><th>Room</th><th>Patient</th><th>Admitted</th><th>Status</th><th>Eligibility</th><th>Record discharge</th></tr></thead><tbody>
 ${rows.map(p=>{const admitted=p.status==="admitted",ok=admitted&&isEligible(state,p.id,t);return `<tr><td>${admitted?p.room:"—"}</td><td><b>${esc(p.name)}</b><div class="hint">${p.age} · ${esc(p.gender)}</div></td><td>${p.admittedOn}</td><td>${patientStatus(p.status)}${p.dischargedOn?`<div class="hint">${p.dischargedOn}</div>`:""}</td><td>${admitted?(ok?pill("Eligible","ok"):pill(`${Math.min(feverFreeStreak(state,p.id,t),3)}/3 days`)):"—"}</td><td>${admitted?`<div style="display:flex;gap:6px;min-width:230px"><select class="input outcome" data-id="${p.id}"><option value="recovered" ${ok?"":"disabled"}>Recovered${ok?"":" (not eligible)"}</option><option value="transferred">Transferred</option><option value="deceased">Deceased</option></select><button class="btn secondary save-outcome" data-id="${p.id}">Save</button></div>`:"—"}</td></tr>`;}).join("")||`<tr><td colspan="6" class="empty">No patients match.</td></tr>`}
 </tbody></table></div></div>`;
}
function patientPicker(list,selected,mode){
 const q=pickerSearch.toLowerCase().trim(),filtered=list.filter(p=>!q||p.name.toLowerCase().includes(q)||String(p.room)===q).sort((a,b)=>a.room-b.room);
 return `<div class="card picker"><div class="picker-search"><input class="input" id="pickerSearch" placeholder="Search by name or room…" value="${esc(pickerSearch)}"></div><div class="patient-list">${filtered.map(p=>{
 const badge=mode==="nurse"?(hasReadingOn(state,p.id,todayStr())?pill("Done","ok"):pill("Due","warn")):(reviewedOn(state,p.id,todayStr())?pill("Reviewed","ok"):hasReadingOn(state,p.id,todayStr())?pill("Ready","warn"):pill("No temp"));
 return `<button class="patient-choice ${selected===p.id?"active":""}" data-patient="${p.id}"><span><span class="patient-name">${esc(p.name)}</span><br><span class="muted">· Room ${p.room}</span></span>${badge}</button>`;
 }).join("")||`<div class="empty">No patients found.</div>`}</div></div>`;
}
function renderNurse(){
 const t=todayStr(),admitted=state.patients.filter(p=>p.status==="admitted"),p=admitted.find(x=>x.id===selectedPatient);
 return `${pageHead("Nurse station","Search a patient and record one temperature per day.")}<div class="work-grid">${patientPicker(admitted,selectedPatient,"nurse")}<div class="card">${!p?`<p class="muted">Select a patient to record a reading.</p>`:`<div class="patient-heading">${esc(p.name)}</div><p class="sub">Room ${p.room} · Age ${p.age}</p><form id="readingForm" class="space-top"><div class="fields-row"><label class="field">Temperature (°C)<input class="input" name="temp" type="number" min="30" max="45" step=".1" placeholder="36.8" required></label><label class="field">Date<input class="input" name="date" type="date" max="${t}" value="${t}" required></label><label class="field">Time<input class="input" name="time" type="time" value="${new Date().toTimeString().slice(0,5)}" required></label></div>${message?`<div class="alert ${message.ok?"success":"error"} space-top">${esc(message.text)}</div>`:""}<button class="btn space-top">Save reading</button></form>`}</div></div>`;
}
function renderDoctor(){
 const t=todayStr(),admitted=state.patients.filter(p=>p.status==="admitted"),p=admitted.find(x=>x.id===selectedPatient);
 if(!p)return `${pageHead("Doctor rounds","Reviews unlock once today's temperature is recorded.")}<div class="work-grid">${patientPicker(admitted,selectedPatient,"doctor")}<div class="card"><p class="muted">Select a patient to view history.</p></div></div>`;
 const history=readingsFor(state,p.id),reviews=state.reviews.filter(r=>r.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date)),allowed=hasReadingOn(state,p.id,t),reviewed=reviewedOn(state,p.id,t),streak=feverFreeStreak(state,p.id,t),max=Math.max(40,...history.map(h=>h.temp));
 return `${pageHead("Doctor rounds","Review patient temperature history and sign off daily reviews.")}<div class="work-grid">${patientPicker(admitted,selectedPatient,"doctor")}<div class="stack"><div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><div class="patient-heading">${esc(p.name)}</div><p class="sub">Room ${p.room} · Age ${p.age} · Admitted ${p.admittedOn}</p></div>${isEligible(state,p.id,t)?pill("Eligible for discharge","ok"):pill(`${Math.min(streak,3)}/3 fever-free days`)}</div>
 <div class="history-bars">${[...history].reverse().map(h=>`<div class="bar-wrap" title="${h.date} ${h.temp}°C"><span class="bar-label">${h.temp.toFixed(1)}</span><div class="bar ${isFever(h.temp)?"fever":""}" style="height:${Math.max(4,((h.temp-34)/(max-34))*80)}%"></div><span class="bar-label">${h.date.slice(5)}</span></div>`).join("")||`<span class="muted">No readings yet.</span>`}</div>
 <div class="table-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>Temp</th></tr></thead><tbody>${history.map(h=>`<tr><td>${h.date}</td><td>${h.time}</td><td style="${isFever(h.temp)?"color:var(--red);font-weight:700":""}">${h.temp.toFixed(1)} °C ${isFever(h.temp)?"· Fever":""}</td></tr>`).join("")||`<tr><td colspan="3" class="empty">No readings yet.</td></tr>`}</tbody></table></div></div>
 <div class="card"><div class="card-title">Today's review</div>${!allowed?`<div class="alert warn">Review locked — no temperature recorded for ${t}.</div>`:reviewed?`<div class="alert success">Reviewed today.</div>`:`<form id="reviewForm"><label class="field">Clinical notes<textarea class="input" name="note" rows="3" placeholder="Clinical notes…"></textarea></label>${message?`<div class="alert error space-top">${esc(message.text)}</div>`:""}<button class="btn space-top">Mark as reviewed</button></form>`}
 ${reviews.length?`<ul class="space-top">${reviews.map(r=>`<li style="margin:8px 0"><b>${r.date}</b> — ${esc(r.note||"No notes")}</li>`).join("")}</ul>`:""}</div></div></div>`;
}
function render(){
 renderNav();$("#roleSelect").value=role;$("#mobileRoleSelect").value=role;
 const app=$("#app");
 if(page==="dashboard")app.innerHTML=renderDashboard();
 else if(page==="admin")app.innerHTML=renderAdmin();
 else if(page==="nurse")app.innerHTML=renderNurse();
 else app.innerHTML=renderDoctor();
}
function goPage(p){page=p;message=null;pickerSearch="";render();}
document.addEventListener("click",e=>{
 const nav=e.target.closest("[data-page]");if(nav){goPage(nav.dataset.page);return;}
 const patient=e.target.closest("[data-patient]");if(patient){selectedPatient=patient.dataset.patient;message=null;render();return;}
 const filter=e.target.closest("[data-filter]");if(filter){adminFilter=filter.dataset.filter;render();return;}
 if(e.target.id==="resetDemo"){resetDemo();return;}
 const save=e.target.closest(".save-outcome");if(save){
  const id=save.dataset.id,select=$(`.outcome[data-id="${id}"]`),outcome=select.value,p=state.patients.find(x=>x.id===id);
  if(!confirm(`Record ${p.name} as ${outcome}?`))return;
  const r=recordDischarge(id,outcome);message=r.ok?{ok:true,text:`${p.name} recorded as ${outcome}. Room ${p.room} is now free.`}:{ok:false,text:r.error};render();return;
 }
});
document.addEventListener("input",e=>{
 if(e.target.id==="adminSearch"){const pos=e.target.selectionStart;adminSearch=e.target.value;render();const n=$("#adminSearch");n.focus();n.setSelectionRange(pos,pos);}
 if(e.target.id==="pickerSearch"){const pos=e.target.selectionStart;pickerSearch=e.target.value;const active=selectedPatient;render();const n=$("#pickerSearch");if(n){n.focus();n.setSelectionRange(pos,pos);}selectedPatient=active;}
});
document.addEventListener("submit",e=>{
 e.preventDefault();
 if(e.target.id==="registerForm"){
  const f=new FormData(e.target),name=String(f.get("name")).trim(),age=Number(f.get("age")),gender=String(f.get("gender")),room=Number(f.get("room"));
  const r=registerPatient(name,age,gender,room);message=r.ok?{ok:true,text:`${name} registered to room ${room}.`}:{ok:false,text:r.error};render();return;
 }
 if(e.target.id==="readingForm"){
  const f=new FormData(e.target),p=state.patients.find(x=>x.id===selectedPatient),temp=Number(f.get("temp"));
  if(!Number.isFinite(temp)||temp<30||temp>45){message={ok:false,text:"Enter a temperature between 30 and 45 °C."};render();return;}
  const r=addReading(p.id,String(f.get("date")),String(f.get("time")),Number(temp.toFixed(1)));
  message=r.ok?{ok:true,text:`Saved ${temp.toFixed(1)} °C for ${p.name}.`}:{ok:false,text:r.error};render();return;
 }
 if(e.target.id==="reviewForm"){
  const p=state.patients.find(x=>x.id===selectedPatient),f=new FormData(e.target),r=addReview(p.id,String(f.get("note")).trim());
  message=r.ok?null:{ok:false,text:r.error};render();
 }
});
function setRole(value){role=value;page=value==="admin"?"admin":value==="nurse"?"nurse":"doctor";selectedPatient=null;message=null;render();}
$("#roleSelect").addEventListener("change",e=>setRole(e.target.value));
$("#mobileRoleSelect").addEventListener("change",e=>setRole(e.target.value));
render();
