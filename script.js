/* ============================================================
   PROJETO EDUCACIONAL 7.0 — CONSOLIDADO
   ============================================================ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const STORAGE_KEY = "projetoEducacional7";
const SESSION_KEY = "projetoEducacional7Session";
const MASTER_KEY = "MDplano32026";

const state = {
  role:null,
  professor:null,
  student:null,
  currentClass:null,
  currentContext:null,
  currentActivity:null,
  activeSeconds:0,
  timerHandle:null,
  heartbeatHandle:null,
  reportRows:[],
  pendingImport:null,
  studentContextSlug:null,
  materialBoard:null,
  classObservationDraft:null,
  scratchHistoryTimer:null,
  scratchSaveDebounced:null
};

const screens = [
  "screenLanding",
  "screenProfessorAuth",
  "screenStudentAuth",
  "screenProfessorHome",
  "screenWorkspace",
  "screenProfessorProfile",
  "screenStudentDashboard",
  "screenStudentActivity",
  "screenMaterialLab"
];

/*
  NOMES EXATOS DAS IMAGENS NA RAIZ DO GITHUB:
  adicao.jpg
  subtracao.jpg
  multiplicacao.jpg
  divisao.jpg
  educacao-financeira.jpg
  linguagens.jpg
  ciencias-humanas.jpg
  ciencias-natureza.jpg
  temas-transversais.jpg
  educacao-digital.jpg
  projeto-de-vida.jpg
*/
const STREAMING_ROWS = [
  {
    title:"Matemática",
    items:[
      {title:"Adição",image:"adicao.jpg",subtitle:"Laboratório de Adição",area:"Matemática",module:"Adição",slug:"adicao"},
      {title:"Subtração",image:"subtracao.jpg",subtitle:"Laboratório de Subtração",area:"Matemática",module:"Subtração",slug:"subtracao"},
      {title:"Multiplicação",image:"multiplicacao.jpg",subtitle:"Laboratório de Multiplicação",area:"Matemática",module:"Multiplicação",slug:"multiplicacao"},
      {title:"Divisão",image:"divisao.jpg",subtitle:"Laboratório da Divisão",area:"Matemática",module:"Divisão",slug:"divisao"},
      {title:"Educação Financeira",image:"educacao-financeira.jpg",subtitle:"Situações financeiras e porcentagem",area:"Matemática",module:"Educação Financeira",slug:"educacao-financeira"}
    ]
  },
  {
    title:"Áreas do Conhecimento",
    items:[
      {title:"Linguagens",image:"linguagens.jpg",subtitle:"Português, Literatura, Arte e Inglês",area:"Linguagens",slug:"linguagens"},
      {title:"Ciências Humanas",image:"ciencias-humanas.jpg",subtitle:"Filosofia, História, Geografia e Sociologia",area:"Ciências Humanas",slug:"ciencias-humanas"},
      {title:"Ciências da Natureza",image:"ciencias-natureza.jpg",subtitle:"Biologia, Física e Química",area:"Ciências da Natureza",slug:"ciencias-natureza"},
      {title:"Temas Transversais",image:"temas-transversais.jpg",subtitle:"Integrações entre áreas e componentes",area:"Temas Transversais",slug:"temas-transversais"}
    ]
  },
  {
    title:"Educação, Tecnologia e Projeto Pessoal",
    items:[
      {title:"Educação Digital / Computação",image:"educacao-digital.jpg",subtitle:"Pensamento computacional, lógica e programação",area:"Educação Digital / Computação",slug:"educacao-digital"},
      {title:"Projeto de Vida",image:"projeto-de-vida.jpg",subtitle:"Autoconhecimento, planejamento e mundo do trabalho",area:"Projeto de Vida",slug:"projeto-de-vida"}
    ]
  }
];

/* ============================================================
   DADOS LOCAIS
   ============================================================ */
function defaultData(){
  return {
    professors:[],
    classes:[],
    students:[],
    activities:[],
    assignments:[],
    submissions:[]
  };
}

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? {...defaultData(),...JSON.parse(raw)} : defaultData();
  }catch{
    return defaultData();
  }
}

function saveData(data){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
}

function getSession(){
  try{
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  }catch{
    return null;
  }
}

function setSession(value){
  if(value){
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));
  }else{
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function uid(prefix="id"){
  if(window.crypto?.randomUUID){
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
}

async function hashText(value){
  if(window.crypto?.subtle){
    const bytes = new TextEncoder().encode(String(value));
    const hash = await crypto.subtle.digest("SHA-256",bytes);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join("");
  }
  return btoa(unescape(encodeURIComponent(String(value))));
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
function showScreen(id){
  screens.forEach(screenId => {
    const el = document.getElementById(screenId);
    if(el) el.classList.toggle("active",screenId === id);
  });
  window.scrollTo({top:0,behavior:"smooth"});
}

function setTopbar(show,role=null){
  $("#topbar").classList.toggle("hidden",!show);
  $("#professorNav").classList.toggle("hidden",role !== "professor");
  $("#studentNav").classList.toggle("hidden",role !== "student");
}

function toast(message,type="info",timeout=4200){
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"),timeout);
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normalizeClassCode(value){
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g,"-")
    .replace(/[^A-Z0-9_-]/g,"");
}

function parseStudentName(value){
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2})\s*\.\s*(.+)$/u);

  if(!match){
    return {
      valid:false,
      message:"O nome do aluno deve começar com dois algarismos, ponto e nome. Ex.: 03. André Paulo."
    };
  }

  const roster = Number(match[1]);
  const plainName = match[2].replace(/\s+/g," ").trim();

  if(!plainName || plainName.length < 2){
    return {valid:false,message:"Informe o nome do aluno após o número da chamada."};
  }

  return {
    valid:true,
    roster,
    rosterText:String(roster).padStart(2,"0"),
    plainName,
    fullName:`${String(roster).padStart(2,"0")}. ${plainName}`
  };
}

function makeRandomClassCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "T-";
  for(let i=0;i<6;i++){
    result += chars[Math.floor(Math.random()*chars.length)];
  }
  return result;
}

function formatDateTime(value){
  if(!value) return "—";
  try{
    return new Intl.DateTimeFormat("pt-BR",{
      dateStyle:"short",
      timeStyle:"short"
    }).format(new Date(value));
  }catch{
    return "—";
  }
}

function formatDuration(totalSeconds){
  const seconds = Math.max(0,Math.floor(Number(totalSeconds)||0));
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;

  if(h>0){
    return `${h}h ${String(m).padStart(2,"0")}min ${String(s).padStart(2,"0")}s`;
  }
  return `${m}min ${String(s).padStart(2,"0")}s`;
}

function timerText(totalSeconds){
  const seconds = Math.max(0,Math.floor(Number(totalSeconds)||0));
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;

  if(h>0){
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function debounce(fn,delay){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args),delay);
  };
}

function initialsFromName(name){
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if(!parts.length) return "PE";
  if(parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
}

function setTopbarIdentity(name,roleLabel){
  $("#topbarUserName").textContent = name || "";
  $("#topbarAvatar").textContent = initialsFromName(name);
  $("#topbarRole").textContent = roleLabel || "";
}

function setActiveTopNav(nav){
  $$("[data-nav]").forEach(button => {
    button.classList.toggle("active",button.dataset.nav === nav);
  });

  $$("[data-student-nav]").forEach(button => {
    button.classList.toggle("active",nav === "student-dashboard");
  });
}

function metricCard(label,value,detail="",tone="blue"){
  return `
    <article class="metric-card metric-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

function professorOwnedData(){
  const data = loadData();
  const classes = data.classes.filter(c => c.professorId === state.professor?.id);
  const classIds = new Set(classes.map(c => c.id));
  const activities = data.activities.filter(a => a.professorId === state.professor?.id);
  const activityIds = new Set(activities.map(a => a.id));
  const students = data.students.filter(s => classIds.has(s.classId));
  const submissions = data.submissions.filter(s =>
    classIds.has(s.classId) && activityIds.has(s.activityId)
  );

  return {data,classes,activities,students,submissions,classIds,activityIds};
}

function renderProfessorHeroStats(){
  const host = $("#professorHeroStats");
  if(!host || !state.professor) return;

  const {classes,activities,students,submissions} = professorOwnedData();
  const activeStudents = new Set(submissions.map(s => s.studentId)).size;

  host.innerHTML = [
    metricCard("Turmas",String(classes.length),"organizadas","blue"),
    metricCard("Alunos",String(students.length),"cadastrados","green"),
    metricCard("Atividades",String(activities.length),"no banco","gold"),
    metricCard("Participaram",String(activeStudents),"com acesso registrado","violet")
  ].join("");
}

function renderOverviewMetrics(){
  const host = $("#overviewMetrics");
  if(!host || !state.professor || !state.currentContext) return;

  const {data,classes,students} = professorOwnedData();

  const contextActivities = data.activities.filter(a =>
    a.professorId === state.professor.id &&
    a.contextSlug === state.currentContext.slug
  );

  const contextActivityIds = new Set(contextActivities.map(a => a.id));

  const assignments = data.assignments.filter(a =>
    contextActivityIds.has(a.activityId)
  );

  const submissions = data.submissions.filter(s =>
    contextActivityIds.has(s.activityId)
  );

  const participatingStudents = new Set(submissions.map(s => s.studentId)).size;

  host.innerHTML = [
    metricCard("Turmas",String(classes.length),"disponíveis para esta área","blue"),
    metricCard("Atividades",String(contextActivities.length),state.currentContext.title,"gold"),
    metricCard("Liberações",String(assignments.length),"atividades atribuídas","violet"),
    metricCard("Participação",String(participatingStudents),`de ${students.length} alunos cadastrados`,"green")
  ].join("");
}

function emptyState(icon,title,text,actionLabel="",actionAttr=""){
  return `
    <div class="empty-state">
      <div class="empty-icon" aria-hidden="true">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${actionLabel ? `<button class="btn btn-primary" type="button" ${actionAttr}>${escapeHtml(actionLabel)}</button>` : ""}
    </div>
  `;
}

function normalizeActivityRow(row){
  const normalized = {};

  Object.entries(row).forEach(([key,value]) => {
    normalized[
      String(key)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/\s+/g,"_")
    ] = value;
  });

  return {
    title:String(normalized.titulo || normalized.title || "").trim(),
    statement:String(normalized.enunciado || normalized.statement || "").trim(),
    question:String(normalized.pergunta || normalized.question || "").trim(),
    answer:String(normalized.resposta || normalized.answer || "").trim(),
    level:String(normalized.nivel || normalized.level || "").trim(),
    type:String(normalized.tipo || normalized.type || "problem_situation").trim(),
    operandA:normalized.operando_a ?? normalized.dividendo ?? "",
    operandB:normalized.operando_b ?? normalized.divisor ?? "",
    unit:String(normalized.unidade || normalized.unit || "").trim()
  };
}


/* ============================================================
   MOSTRAR / OCULTAR SENHAS
   ============================================================ */
function setupPasswordToggles(){
  $$("[data-password-toggle]").forEach(button => {
    button.addEventListener("click",() => {
      const field = button.closest(".password-field");
      const input = field?.querySelector("input");
      if(!input) return;

      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "Mostrar" : "Ocultar";
      button.setAttribute("aria-label",visible ? "Mostrar senha" : "Ocultar senha");
    });
  });
}

/* ============================================================
   AUTENTICAÇÃO LOCAL
   ============================================================ */
async function professorRegister(event){
  event.preventDefault();

  const name = $("#profRegisterName").value.trim();
  const username = $("#profRegisterUsername").value.trim();
  const password = $("#profRegisterPassword").value;
  const password2 = $("#profRegisterPassword2").value;
  const masterKey = $("#profRegisterMasterKey").value;

  if(name.length < 2) return toast("Informe o nome do professor.","error");
  if(username.length < 2) return toast("Informe um usuário válido.","error");
  if(password.length < 8) return toast("A senha deve ter pelo menos 8 caracteres.","error");
  if(password !== password2) return toast("As senhas não coincidem.","error");
  if(masterKey !== MASTER_KEY) return toast("Chave geral inválida.","error");

  const data = loadData();

  if(data.professors.some(p => p.username.toLowerCase() === username.toLowerCase())){
    return toast("Este usuário já está cadastrado.","error");
  }

  const professor = {
    id:uid("prof"),
    name,
    username,
    passwordHash:await hashText(password),
    accessKeyHash:await hashText(MASTER_KEY),
    requireAdminKey:false,
    createdAt:new Date().toISOString()
  };

  data.professors.push(professor);
  saveData(data);

  state.role = "professor";
  state.professor = professor;
  setSession({role:"professor",userId:professor.id});

  event.target.reset();
  toast("Perfil do professor criado com sucesso.","success");
  await enterProfessorArea();
}

async function professorLogin(event){
  event.preventDefault();

  const username = $("#profLoginUsername").value.trim();
  const passwordHash = await hashText($("#profLoginPassword").value);
  const data = loadData();

  const professor = data.professors.find(p =>
    p.username.toLowerCase() === username.toLowerCase() &&
    p.passwordHash === passwordHash
  );

  if(!professor){
    return toast("Usuário ou senha inválidos.","error");
  }

  state.role = "professor";
  state.professor = professor;
  setSession({role:"professor",userId:professor.id});

  await enterProfessorArea();
}

async function studentRegister(event){
  event.preventDefault();

  const classCode = normalizeClassCode($("#studentRegisterClassCode").value);
  const parsed = parseStudentName($("#studentRegisterName").value);
  const password = $("#studentRegisterPassword").value;
  const password2 = $("#studentRegisterPassword2").value;

  if(!parsed.valid) return toast(parsed.message,"error");
  if(password.length < 8) return toast("A senha deve ter pelo menos 8 caracteres.","error");
  if(password !== password2) return toast("As senhas não coincidem.","error");

  const data = loadData();
  const classItem = data.classes.find(c => c.code === classCode);

  if(!classItem) return toast("Código de turma não encontrado.","error");

  const duplicate = data.students.some(s =>
    s.classId === classItem.id &&
    s.roster === parsed.roster
  );

  if(duplicate){
    return toast(`O número ${parsed.rosterText} já está cadastrado nesta turma.`,"error");
  }

  const student = {
    id:uid("student"),
    classId:classItem.id,
    name:parsed.fullName,
    plainName:parsed.plainName,
    roster:parsed.roster,
    rosterText:parsed.rosterText,
    passwordHash:await hashText(password),
    status:"Ativo",
    createdAt:new Date().toISOString(),
    firstAccess:new Date().toISOString(),
    lastAccess:new Date().toISOString()
  };

  data.students.push(student);
  saveData(data);

  state.role = "student";
  state.student = student;
  state.currentClass = classItem;
  setSession({role:"student",userId:student.id});

  event.target.reset();
  toast("Acesso do aluno criado com sucesso.","success");
  showStudentDashboard();
}

async function studentLogin(event){
  event.preventDefault();

  const classCode = normalizeClassCode($("#studentLoginClassCode").value);
  const rosterText = String($("#studentLoginRoster").value).replace(/\D/g,"").padStart(2,"0");
  const roster = Number(rosterText);
  const passwordHash = await hashText($("#studentLoginPassword").value);

  const data = loadData();
  const classItem = data.classes.find(c => c.code === classCode);

  if(!classItem) return toast("Código de turma não encontrado.","error");

  const student = data.students.find(s =>
    s.classId === classItem.id &&
    s.roster === roster &&
    s.passwordHash === passwordHash
  );

  if(!student) return toast("Número da chamada ou senha inválidos.","error");

  student.lastAccess = new Date().toISOString();
  saveData(data);

  state.role = "student";
  state.student = student;
  state.currentClass = classItem;
  setSession({role:"student",userId:student.id});

  showStudentDashboard();
}

async function restoreSession(){
  const session = getSession();
  if(!session) return;

  const data = loadData();

  if(session.role === "professor"){
    const professor = data.professors.find(p => p.id === session.userId);
    if(!professor) return;
    state.role = "professor";
    state.professor = professor;
    await enterProfessorArea();
    return;
  }

  if(session.role === "student"){
    const student = data.students.find(s => s.id === session.userId);
    if(!student) return;
    state.role = "student";
    state.student = student;
    state.currentClass = data.classes.find(c => c.id === student.classId) || null;
    showStudentDashboard();
  }
}

function logout(){
  stopActivityTimer(true);
  setSession(null);

  state.role = null;
  state.professor = null;
  state.student = null;
  state.currentClass = null;
  state.currentContext = null;
  state.currentActivity = null;

  setTopbar(false);
  showScreen("screenLanding");
}

async function enterProfessorArea(){
  const data = loadData();
  const fresh = data.professors.find(p => p.id === state.professor.id);
  if(fresh) state.professor = fresh;

  setTopbarIdentity(state.professor.name,"Professor");
  setTopbar(true,"professor");

  if(state.professor.requireAdminKey){
    $("#adminGateKey").value = "";
    $("#adminGateModal").classList.remove("hidden");
    return;
  }

  showProfessorHome();
}

async function submitAdminGate(event){
  event.preventDefault();

  const typedHash = await hashText($("#adminGateKey").value);
  const data = loadData();
  const professor = data.professors.find(p => p.id === state.professor.id);

  if(!professor || professor.accessKeyHash !== typedHash){
    return toast("Chave pessoal inválida.","error");
  }

  $("#adminGateModal").classList.add("hidden");
  showProfessorHome();
}

/* ============================================================
   STREAMING
   ============================================================ */
function showProfessorHome(){
  $("#professorWelcome").textContent = `Olá, ${state.professor.name}.`;
  setTopbarIdentity(state.professor.name,"Professor");
  setActiveTopNav("home");
  renderProfessorHeroStats();
  renderStreamingRows();
  setTopbar(true,"professor");
  showScreen("screenProfessorHome");
}

function renderStreamingRows(){
  const container = $("#streamingRows");
  container.innerHTML = "";

  STREAMING_ROWS.forEach(row => {
    const section = document.createElement("section");
    section.className = "stream-row";

    section.innerHTML = `
      <div class="stream-row-heading">
        <h2>${escapeHtml(row.title)}</h2>
      </div>
      <div class="cover-grid"></div>
    `;

    const grid = $(".cover-grid",section);

    row.items.forEach(item => {
      const wrapper = document.createElement("article");
      wrapper.className = "cover-item";

      wrapper.innerHTML = `
        <button class="cover-card" type="button" aria-label="Abrir ${escapeHtml(item.title)}">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">
          <div class="cover-fallback hidden" aria-hidden="true">
            <span>${escapeHtml(item.title)}</span>
          </div>
        </button>

        <div class="cover-info">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.subtitle || "")}</small>
          </div>
          <span class="cover-action">Abrir área →</span>
        </div>
      `;

      const button = $(".cover-card",wrapper);
      const img = $("img",wrapper);
      const fallback = $(".cover-fallback",wrapper);

      img.addEventListener("load",() => fallback.classList.add("hidden"));
      img.addEventListener("error",() => {
        img.classList.add("hidden");
        fallback.classList.remove("hidden");
      });

      button.addEventListener("click",() => openWorkspace(item));
      grid.appendChild(wrapper);
    });

    container.appendChild(section);
  });
}

function openWorkspace(context){
  state.currentContext = {...context};

  $("#workspaceTitle").textContent = context.title;
  $("#workspaceSubtitle").textContent = context.subtitle || "";

  $("#activityContextSummary").innerHTML = `
    <strong>${escapeHtml(context.title)}</strong>
    <span>${escapeHtml(context.subtitle || "")}</span>
  `;

  populateClassSelects();
  renderClassList();
  renderActivityList();
  renderOverviewMetrics();

  setWorkspaceTab("overview");
  showScreen("screenWorkspace");
}

function setWorkspaceTab(tab){
  $$(".workspace-tab").forEach(button => {
    button.classList.toggle("active",button.dataset.workTab === tab);
  });

  $$(".workspace-panel").forEach(panel => panel.classList.remove("active"));

  const map = {
    overview:"#workOverview",
    classes:"#workClasses",
    activities:"#workActivities",
    upload:"#workUpload",
    reports:"#workReports"
  };

  $(map[tab])?.classList.add("active");

  if(tab === "overview"){
    setActiveTopNav("home");
    renderOverviewMetrics();
  }

  if(tab === "classes"){
    setActiveTopNav("classes");
    renderClassList();
  }

  if(tab === "activities"){
    setActiveTopNav("activities");
    renderActivityList();
  }

  if(tab === "upload"){
    setActiveTopNav("activities");
    populateClassSelects();
  }

  if(tab === "reports"){
    setActiveTopNav("reports");
    prepareReports();
  }
}

function emptyClassObservationData(){
  return {
    studentCount:0,
    profile:"",
    strategies:"",
    resources:""
  };
}

function normalizeClassObservationData(value){
  return {
    studentCount:Math.max(0,Number(value?.studentCount || 0)),
    profile:String(value?.profile || ""),
    strategies:String(value?.strategies || ""),
    resources:String(value?.resources || "")
  };
}

function classObservationHasContent(value){
  const data = normalizeClassObservationData(value);
  return data.studentCount > 0 || Boolean(data.profile.trim() || data.strategies.trim() || data.resources.trim());
}

function setClassObservationSummary(value){
  const host = $("#classObservationSummary");
  if(!host) return;

  const data = normalizeClassObservationData(value);
  if(!classObservationHasContent(data)){
    host.innerHTML = `Nenhuma observação pedagógica detalhada registrada.`;
    return;
  }

  host.innerHTML = `
    <strong>${data.studentCount}</strong> aluno(s) sinalizado(s) para adaptações
    <span>•</span>
    <span>Informações pedagógicas registradas</span>
  `;
}

function openClassObservations(classId=null){
  const data = loadData();
  let observations = state.classObservationDraft || emptyClassObservationData();
  let title = "Nova turma";

  if(classId){
    const item = data.classes.find(c => c.id === classId && c.professorId === state.professor.id);
    if(!item) return;
    observations = normalizeClassObservationData(item.supportObservations);
    title = item.name || "Turma";
    $("#classObservationsTargetId").value = classId;
  }else{
    const editId = $("#classEditId")?.value || "";
    if(editId && !state.classObservationDraft){
      const item = data.classes.find(c => c.id === editId && c.professorId === state.professor.id);
      if(item){
        observations = normalizeClassObservationData(item.supportObservations);
        title = item.name || "Turma";
      }
    }else{
      title = $("#className")?.value.trim() || "Nova turma";
    }
    $("#classObservationsTargetId").value = "";
  }

  $("#classObservationsTitle").textContent = `Observações da turma — ${title}`;
  $("#classSupportStudentCount").value = observations.studentCount || 0;
  $("#classSupportProfile").value = observations.profile || "";
  $("#classSupportStrategies").value = observations.strategies || "";
  $("#classSupportResources").value = observations.resources || "";
  $("#classObservationsModal").classList.remove("hidden");
}

function closeClassObservations(){
  $("#classObservationsModal").classList.add("hidden");
}

function getClassObservationsFromModal(){
  return normalizeClassObservationData({
    studentCount:$("#classSupportStudentCount").value,
    profile:$("#classSupportProfile").value.trim(),
    strategies:$("#classSupportStrategies").value.trim(),
    resources:$("#classSupportResources").value.trim()
  });
}

function saveClassObservations(){
  const observations = getClassObservationsFromModal();
  const targetId = $("#classObservationsTargetId").value;

  if(targetId){
    const data = loadData();
    const item = data.classes.find(c => c.id === targetId && c.professorId === state.professor.id);
    if(!item) return;
    item.supportObservations = observations;
    saveData(data);
    renderClassList();
    toast("Observações da turma salvas.","success");
  }else{
    state.classObservationDraft = observations;
    setClassObservationSummary(observations);
    toast("Observações registradas para esta turma.","success");
  }

  closeClassObservations();
}

function clearClassObservationsFields(){
  $("#classSupportStudentCount").value = 0;
  $("#classSupportProfile").value = "";
  $("#classSupportStrategies").value = "";
  $("#classSupportResources").value = "";
}

/* ============================================================
   TURMAS
   ============================================================ */
function currentProfessorClasses(){
  const data = loadData();
  return data.classes.filter(c => c.professorId === state.professor.id);
}

function populateClassSelects(){
  const classes = currentProfessorClasses();

  [
    ["#uploadAssignClass","Somente banco do professor"],
    ["#reportClassSelect","Selecione uma turma"]
  ].forEach(([selector,placeholder]) => {
    const select = $(selector);
    if(!select) return;

    const previous = select.value;

    select.innerHTML = `<option value="">${placeholder}</option>` +
      classes.map(item =>
        `<option value="${item.id}">${escapeHtml(item.name)}</option>`
      ).join("");

    if(classes.some(item => item.id === previous)){
      select.value = previous;
    }
  });
}

function saveClass(event){
  event.preventDefault();

  const data = loadData();
  const editId = $("#classEditId").value;

  const payload = {
    name:$("#className").value.trim(),
    grade:$("#classGrade").value.trim(),
    schoolYear:Number($("#classYear").value) || null,
    code:normalizeClassCode($("#classCode").value),
    supportObservations:normalizeClassObservationData(state.classObservationDraft),
    levels:$$('input[name="classLevel"]:checked').map(input => input.value)
  };

  if(!payload.name) return toast("Informe o nome da turma.","error");
  if(!payload.code) return toast("Informe um código de acesso.","error");
  if(!payload.levels.length) return toast("Selecione pelo menos um nível.","error");

  const duplicateCode = data.classes.some(item =>
    item.code === payload.code &&
    item.id !== editId
  );

  if(duplicateCode) return toast("Este código de turma já está em uso.","error");

  if(editId){
    const item = data.classes.find(c =>
      c.id === editId &&
      c.professorId === state.professor.id
    );

    if(!item) return;
    Object.assign(item,payload);
  }else{
    data.classes.push({
      id:uid("class"),
      professorId:state.professor.id,
      createdAt:new Date().toISOString(),
      ...payload
    });
  }

  saveData(data);
  resetClassForm();
  populateClassSelects();
  renderClassList();
  renderProfessorHeroStats();
  renderOverviewMetrics();
  toast(editId ? "Turma atualizada." : "Turma cadastrada.","success");
}

function renderClassList(){
  const list = $("#classList");
  const classes = currentProfessorClasses();

  if(!classes.length){
    list.innerHTML = emptyState(
      "⌂",
      "Nenhuma turma cadastrada",
      "Cadastre a primeira turma para organizar alunos, atividades e relatórios."
    );
    return;
  }

  list.innerHTML = classes.map(item => `
    <article class="list-card">
      <div class="list-card-top">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.grade || "Etapa não informada")} • ${escapeHtml(item.schoolYear || "—")}</p>
        </div>
        <span class="badge">${escapeHtml(item.code)}</span>
      </div>

      <div class="badge-row">
        <span class="badge">Níveis: ${escapeHtml((item.levels || []).join(", ") || "nenhum")}</span>
      </div>

      ${classObservationHasContent(item.supportObservations) ? `
        <div class="class-support-status">
          <strong>${Number(item.supportObservations?.studentCount || 0)}</strong> aluno(s) com observações pedagógicas para adaptação
        </div>
      ` : ""}

      <div class="card-actions">
        <button class="btn btn-small btn-outline" type="button" data-edit-class="${item.id}">
          EDITAR TURMA
        </button>
        <button class="btn btn-small btn-gold" type="button" data-class-observations="${item.id}">
          OBSERVAÇÕES DA TURMA
        </button>
      </div>
    </article>
  `).join("");

  $$("[data-edit-class]",list).forEach(button => {
    button.addEventListener("click",() => editClass(button.dataset.editClass));
  });

  $$("[data-class-observations]",list).forEach(button => {
    button.addEventListener("click",() => openClassObservations(button.dataset.classObservations));
  });
}

function editClass(classId){
  const item = currentProfessorClasses().find(c => c.id === classId);
  if(!item) return;

  $("#classEditId").value = item.id;
  $("#className").value = item.name || "";
  $("#classGrade").value = item.grade || "";
  $("#classYear").value = item.schoolYear || "";
  $("#classCode").value = item.code || "";
  state.classObservationDraft = normalizeClassObservationData(item.supportObservations);
  setClassObservationSummary(state.classObservationDraft);

  $$('input[name="classLevel"]').forEach(input => {
    input.checked = (item.levels || []).includes(input.value);
  });

  $("#classFormTitle").textContent = "Editar turma";
  $("#cancelClassEditBtn").classList.remove("hidden");
  setWorkspaceTab("classes");
}

function resetClassForm(){
  $("#classForm").reset();
  $("#classEditId").value = "";
  $("#classFormTitle").textContent = "Cadastrar turma";
  $("#cancelClassEditBtn").classList.add("hidden");
  $("#classYear").value = new Date().getFullYear();
  $("#classCode").value = makeRandomClassCode();
  state.classObservationDraft = emptyClassObservationData();
  setClassObservationSummary(state.classObservationDraft);
}

/* ============================================================
   BANCO DE ATIVIDADES
   ============================================================ */
function contextMatchesActivity(activity){
  if(!state.currentContext) return true;
  return activity.contextSlug === state.currentContext.slug;
}

function getActivityAssignedClasses(activityId,data,classes){
  const assignedIds = new Set(
    data.assignments
      .filter(item => item.activityId === activityId)
      .map(item => item.classId)
  );

  return classes.filter(item => assignedIds.has(item.id));
}

function renderAssignmentStatus(activityId,data,classes){
  const assigned = getActivityAssignedClasses(activityId,data,classes);

  if(!assigned.length){
    return `<div class="assignment-status assignment-status-empty">Ainda não liberada para nenhuma turma.</div>`;
  }

  return `
    <div class="assignment-status">
      <strong>Liberada para:</strong>
      <div class="assignment-class-badges">
        ${assigned.map(item => `<span>${escapeHtml(item.name)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderActivityList(){
  const list = $("#activityList");
  const data = loadData();

  const search = String($("#activitySearch")?.value || "").trim().toLowerCase();
  const level = $("#activityLevelFilter")?.value || "";
  const sort = $("#activitySort")?.value || "newest";

  let items = data.activities.filter(activity =>
    activity.professorId === state.professor.id &&
    contextMatchesActivity(activity)
  );

  if(search){
    items = items.filter(item =>
      [item.title,item.statement,item.question,item.module,item.area]
        .some(value => String(value || "").toLowerCase().includes(search))
    );
  }

  if(level){
    items = items.filter(item => item.level === level);
  }

  if(sort === "title"){
    items.sort((a,b) => String(a.title).localeCompare(String(b.title),"pt-BR"));
  }else{
    items.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  const count = $("#activityResultCount");
  if(count){
    count.textContent = `${items.length} ${items.length === 1 ? "atividade" : "atividades"}`;
  }

  if(!items.length){
    const hasFilters = Boolean(search || level);

    list.innerHTML = emptyState(
      hasFilters ? "⌕" : "＋",
      hasFilters ? "Nenhuma atividade encontrada" : "Seu banco ainda está vazio",
      hasFilters
        ? "Tente ajustar a pesquisa ou os filtros selecionados."
        : "Importe um arquivo para começar a montar seu banco de atividades.",
      hasFilters ? "" : "IMPORTAR ATIVIDADES",
      hasFilters ? "" : 'data-empty-open-upload'
    );

    $("[data-empty-open-upload]",list)?.addEventListener("click",() => {
      setWorkspaceTab("upload");
    });

    return;
  }

  const classes = currentProfessorClasses();

  list.innerHTML = items.map(item => `
    <article class="activity-card premium-activity-card">
      <div class="activity-card-top">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.statement)}</p>
        </div>
        <span class="badge">${escapeHtml(item.level || "Sem nível")}</span>
      </div>

      <div class="badge-row">
        <span class="badge">${escapeHtml(item.area)}</span>
        <span class="badge">${escapeHtml(item.module)}</span>
        <span class="badge">${escapeHtml(item.type || "atividade")}</span>
      </div>

      <div class="assignment-release-panel">
        <div class="assignment-release-heading">
          <div>
            <strong>Liberar atividade para</strong>
            <small>Selecione uma turma, várias turmas ou todas.</small>
          </div>
        </div>

        ${classes.length ? `
          <div class="assignment-release-controls">
            <details class="class-multiselect" data-class-picker="${item.id}">
              <summary>
                <span data-selection-summary="${item.id}">Escolha as turmas</span>
                <span class="class-picker-arrow">⌄</span>
              </summary>

              <div class="class-multiselect-menu">
                <label class="class-option class-option-all">
                  <input type="checkbox" data-assign-all="${item.id}">
                  <span>Todas as turmas</span>
                </label>

                <div class="class-option-list">
                  ${classes.map(c => `
                    <label class="class-option">
                      <input type="checkbox" value="${c.id}" data-assign-class="${item.id}">
                      <span>${escapeHtml(c.name)}</span>
                    </label>
                  `).join("")}
                </div>
              </div>
            </details>

            <button class="btn btn-primary assignment-release-button" type="button" data-assign-activity="${item.id}">
              LIBERAR ATIVIDADE
            </button>
          </div>
        ` : `
          <div class="assignment-no-classes">
            Cadastre uma turma para poder liberar esta atividade.
          </div>
        `}

        ${renderAssignmentStatus(item.id,data,classes)}
      </div>
    </article>
  `).join("");

  items.forEach(item => setupActivityClassPicker(item.id,classes,list));

  $$('[data-assign-activity]',list).forEach(button => {
    button.addEventListener('click',() => {
      const activityId = button.dataset.assignActivity;
      const selected = $$(`[data-assign-class="${activityId}"]:checked`,list)
        .map(input => input.value);

      if(!selected.length){
        return toast('Escolha pelo menos uma turma.','error');
      }

      assignActivityToClasses(activityId,selected);
    });
  });
}

function setupActivityClassPicker(activityId,classes,root){
  const allInput = $(`[data-assign-all="${activityId}"]`,root);
  const classInputs = $$(`[data-assign-class="${activityId}"]`,root);
  const summary = $(`[data-selection-summary="${activityId}"]`,root);

  if(!allInput || !summary) return;

  const updateSummary = () => {
    const selected = classInputs.filter(input => input.checked);
    const allSelected = classInputs.length > 0 && selected.length === classInputs.length;

    allInput.checked = allSelected;
    allInput.indeterminate = selected.length > 0 && !allSelected;

    if(allSelected){
      summary.textContent = 'Todas as turmas';
    }else if(selected.length === 1){
      const selectedClass = classes.find(item => item.id === selected[0].value);
      summary.textContent = selectedClass?.name || '1 turma selecionada';
    }else if(selected.length > 1){
      summary.textContent = `${selected.length} turmas selecionadas`;
    }else{
      summary.textContent = 'Escolha as turmas';
    }
  };

  allInput.addEventListener('change',() => {
    classInputs.forEach(input => {
      input.checked = allInput.checked;
    });
    updateSummary();
  });

  classInputs.forEach(input => input.addEventListener('change',updateSummary));
  updateSummary();
}

function assignActivityToClasses(activityId,classIds){
  const data = loadData();
  const uniqueClassIds = [...new Set(classIds)];
  let added = 0;

  uniqueClassIds.forEach(classId => {
    const exists = data.assignments.some(item =>
      item.activityId === activityId &&
      item.classId === classId
    );

    if(!exists){
      data.assignments.push({
        id:uid("assign"),
        activityId,
        classId,
        createdAt:new Date().toISOString()
      });
      added += 1;
    }
  });

  saveData(data);
  renderOverviewMetrics();
  renderActivityList();

  if(added === 0){
    toast('A atividade já estava liberada para as turmas selecionadas.','info');
  }else if(uniqueClassIds.length === 1){
    toast('Atividade liberada para a turma selecionada.','success');
  }else{
    toast(`Atividade liberada para ${uniqueClassIds.length} turmas.`,`success`);
  }
}

function assignActivity(activityId,classId){
  assignActivityToClasses(activityId,[classId]);
}

/* ============================================================
   UPLOAD CSV
   ============================================================ */
async function processActivityFile(fileOverride=null){
  const file = fileOverride || $("#activityFile").files?.[0];

  if(!file){
    return toast("Selecione um arquivo CSV, XLS, XLSX ou DOCX.","error");
  }

  const extension = file.name.split(".").pop().toLowerCase();

  if(!["csv","xls","xlsx","docx"].includes(extension)){
    return toast("Formato não aceito. Use CSV, XLS, XLSX ou DOCX.","error");
  }

  $("#activityFileDropTitle").textContent = file.name;
  $("#activityFileDropMeta").textContent =
    `${extension.toUpperCase()} • ${formatFileSize(file.size)} • analisando...`;

  let rows = [];

  try{
    rows = await parseActivityImportFile(file);
  }catch(error){
    $("#activityFileDropMeta").textContent =
      `${extension.toUpperCase()} • não foi possível ler o arquivo`;
    return toast(error.message || "Não foi possível ler o arquivo.","error",6500);
  }

  if(!rows.length){
    $("#activityFileDropMeta").textContent =
      `${extension.toUpperCase()} • nenhuma atividade encontrada`;
    return toast("Nenhuma atividade identificada no arquivo.","error");
  }

  const normalizedRows = rows.map(normalizeActivityRow);

  const valid = normalizedRows.filter(row => row.title && row.statement);
  const invalid = normalizedRows.filter(row => !row.title || !row.statement);

  state.pendingImport = {
    fileName:file.name,
    extension,
    total:normalizedRows.length,
    valid,
    invalid
  };

  $("#activityFileDropMeta").textContent =
    `${extension.toUpperCase()} • ${formatFileSize(file.size)} • ${valid.length} atividade(s) válida(s)`;

  renderUploadPreview();
}

function renderUploadPreview(){
  const pending = state.pendingImport;
  const preview = $("#uploadPreview");

  if(!pending){
    preview.classList.add("hidden");
    $("#uploadConfirmActions").classList.add("hidden");
    return;
  }

  preview.classList.remove("hidden");
  preview.innerHTML = `
    <div class="upload-preview-head">
      <div>
        <span class="eyebrow">ARQUIVO PRONTO</span>
        <h3>${escapeHtml(pending.fileName)}</h3>
      </div>

      <span class="review-status ${pending.invalid.length ? "review-warning" : "review-ok"}">
        ${pending.invalid.length ? "Há linhas para revisar" : "Pronto para importar"}
      </span>
    </div>

    <div class="upload-kpis">
      ${metricCard("Encontradas",String(pending.total),"linhas ou registros","blue")}
      ${metricCard("Válidas",String(pending.valid.length),"serão importadas","green")}
      ${metricCard("Ignoradas",String(pending.invalid.length),"sem título ou enunciado","gold")}
    </div>

    ${pending.valid.length ? `
      <div class="preview-sample">
        <strong>Prévia</strong>
        ${pending.valid.slice(0,6).map((row,index) => `
          <div class="preview-row">
            <span>${String(index+1).padStart(2,"0")}</span>
            <div>
              <strong>${escapeHtml(row.title)}</strong>
              <small>${escapeHtml(row.statement.slice(0,120))}${row.statement.length > 120 ? "…" : ""}</small>
            </div>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;

  $("#uploadConfirmActions").classList.toggle(
    "hidden",
    pending.valid.length === 0
  );
}

function confirmActivityImport(){
  const pending = state.pendingImport;

  if(!pending?.valid?.length){
    return toast("Selecione e analise um arquivo antes de importar.","error");
  }

  const data = loadData();
  const classId = $("#uploadAssignClass").value || null;
  let created = 0;

  pending.valid.forEach(row => {
    const activity = {
      id:uid("activity"),
      professorId:state.professor.id,
      contextSlug:state.currentContext?.slug || "geral",
      area:state.currentContext?.area || "Geral",
      module:state.currentContext?.module || state.currentContext?.title || "Atividade",
      title:row.title,
      statement:row.statement,
      question:row.question,
      answer:row.answer,
      level:row.level,
      type:row.type,
      operandA:row.operandA,
      operandB:row.operandB,
      unit:row.unit,
      createdAt:new Date().toISOString()
    };

    data.activities.push(activity);

    if(classId){
      data.assignments.push({
        id:uid("assign"),
        activityId:activity.id,
        classId,
        createdAt:new Date().toISOString()
      });
    }

    created += 1;
  });

  saveData(data);

  $("#uploadResult").innerHTML = `
    <div class="success-panel">
      <strong>Importação concluída</strong>
      <p>${created} ${created === 1 ? "atividade foi adicionada" : "atividades foram adicionadas"} ao banco.</p>
    </div>
  `;

  resetActivityImport();
  renderActivityList();
  renderOverviewMetrics();
  renderProfessorHeroStats();

  toast(`${created} atividade(s) importada(s).`,"success");
}

function resetActivityImport(){
  $("#activityFile").value = "";
  $("#uploadPreview").classList.add("hidden");
  $("#uploadConfirmActions").classList.add("hidden");
  $("#activityFileDropTitle").textContent = "Clique ou arraste o arquivo aqui";
  $("#activityFileDropMeta").textContent = "CSV • XLS • XLSX • DOCX";
  state.pendingImport = null;
}

function formatFileSize(bytes){
  const value = Number(bytes || 0);

  if(value < 1024) return `${value} B`;
  if(value < 1024*1024) return `${(value/1024).toFixed(1)} KB`;
  return `${(value/(1024*1024)).toFixed(1)} MB`;
}

async function parseActivityImportFile(file){
  const extension = file.name.split(".").pop().toLowerCase();

  if(extension === "csv"){
    return parseCsvFile(file);
  }

  if(extension === "xls" || extension === "xlsx"){
    return parseSpreadsheetFile(file);
  }

  if(extension === "docx"){
    return parseDocxFile(file);
  }

  throw new Error("Formato não suportado.");
}

async function parseCsvFile(file){
  const text = await file.text();

  if(window.XLSX){
    const workbook = XLSX.read(text,{type:"string"});
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    return XLSX.utils.sheet_to_json(firstSheet,{
      defval:"",
      raw:false
    });
  }

  return parseDelimitedText(text);
}

async function parseSpreadsheetFile(file){
  if(!window.XLSX){
    throw new Error(
      "O leitor de planilhas não carregou. Verifique a conexão com a internet e tente novamente."
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer,{type:"array"});

  if(!workbook.SheetNames.length){
    return [];
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet,{
    defval:"",
    raw:false
  });
}

async function parseDocxFile(file){
  if(!window.mammoth){
    throw new Error(
      "O leitor de DOCX não carregou. Verifique a conexão com a internet e tente novamente."
    );
  }

  const buffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({arrayBuffer:buffer});
  const parser = new DOMParser();
  const doc = parser.parseFromString(result.value,"text/html");

  const firstTable = doc.querySelector("table");

  if(firstTable){
    const tableRows = [...firstTable.querySelectorAll("tr")].map(row =>
      [...row.querySelectorAll("th,td")].map(cell => cell.textContent.trim())
    );

    if(tableRows.length >= 2){
      const headers = tableRows[0].map(value => value.trim());

      return tableRows.slice(1)
        .filter(row => row.some(value => String(value).trim()))
        .map(row =>
          Object.fromEntries(
            headers.map((header,index) => [header,row[index] ?? ""])
          )
        );
    }
  }

  const raw = await mammoth.extractRawText({arrayBuffer:buffer});
  return parseLabeledDocxText(raw.value);
}

function parseLabeledDocxText(text){
  const allowed = [
    "titulo",
    "enunciado",
    "pergunta",
    "resposta",
    "nivel",
    "tipo",
    "unidade",
    "operando_a",
    "operando_b"
  ];

  const normalizedLines = String(text || "")
    .replace(/\r/g,"")
    .split("\n")
    .map(line => line.trim());

  const result = [];
  let current = {};

  function pushCurrent(){
    if(Object.keys(current).length){
      result.push(current);
      current = {};
    }
  }

  normalizedLines.forEach(line => {
    if(!line){
      if(current.titulo && current.enunciado){
        pushCurrent();
      }
      return;
    }

    const match = line.match(/^([^:]+)\s*:\s*(.*)$/);

    if(!match){
      return;
    }

    const key = match[1]
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g,"_");

    if(!allowed.includes(key)){
      return;
    }

    if(key === "titulo" && current.titulo){
      pushCurrent();
    }

    current[key] = match[2].trim();
  });

  pushCurrent();
  return result;
}

function parseDelimitedText(text){
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter(line => line.trim() !== "");

  if(!lines.length) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const matrix = lines.map(line => splitDelimitedLine(line,separator));
  const headers = matrix.shift().map(value => value.trim());

  return matrix.map(columns =>
    Object.fromEntries(
      headers.map((header,index) => [header,(columns[index] ?? "").trim()])
    )
  );
}

function splitDelimitedLine(line,separator){
  const result = [];
  let current = "";
  let quoted = false;

  for(let i=0;i<line.length;i++){
    const char = line[i];

    if(char === '"'){
      if(quoted && line[i+1] === '"'){
        current += '"';
        i += 1;
      }else{
        quoted = !quoted;
      }
      continue;
    }

    if(char === separator && !quoted){
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

/* ============================================================
   PERFIL / SEGURANÇA
   ============================================================ */
function showProfessorProfile(){
  const data = loadData();
  const professor = data.professors.find(p => p.id === state.professor.id);
  if(!professor) return;

  state.professor = professor;

  $("#profileInfo").innerHTML = `
    <div class="profile-row">
      <small>Nome</small>
      <strong>${escapeHtml(professor.name)}</strong>
    </div>

    <div class="profile-row">
      <small>Usuário</small>
      <strong>${escapeHtml(professor.username)}</strong>
    </div>

    <div class="profile-row">
      <small>Perfil</small>
      <strong>Professor</strong>
    </div>
  `;

  $("#requireAdminKeyToggle").checked = Boolean(professor.requireAdminKey);
  setActiveTopNav("profile");
  showScreen("screenProfessorProfile");
}

async function changeMyAccessKey(event){
  event.preventDefault();

  const newKey = $("#newAccessKey").value;
  const confirmKey = $("#confirmAccessKey").value;

  if(newKey.length < 8){
    return toast("A nova chave deve ter pelo menos 8 caracteres.","error");
  }

  if(newKey !== confirmKey){
    return toast("As chaves não coincidem.","error");
  }

  const data = loadData();
  const professor = data.professors.find(p => p.id === state.professor.id);
  if(!professor) return;

  professor.accessKeyHash = await hashText(newKey);
  saveData(data);
  state.professor = professor;

  event.target.reset();
  toast("Chave pessoal alterada.","success");
}

function setAdminKeyRequired(){
  const data = loadData();
  const professor = data.professors.find(p => p.id === state.professor.id);
  if(!professor) return;

  professor.requireAdminKey = $("#requireAdminKeyToggle").checked;
  saveData(data);
  state.professor = professor;

  toast(
    professor.requireAdminKey
      ? "A chave pessoal será exigida ao abrir a área administrativa."
      : "A chave pessoal não será exigida ao abrir a área administrativa.",
    "success"
  );
}

/* ============================================================
   ALUNO
   ============================================================ */
function showStudentDashboard(){
  stopActivityTimer(true);

  const data = loadData();
  const student = data.students.find(s => s.id === state.student.id);

  if(!student){
    logout();
    return;
  }

  state.student = student;
  state.currentClass = data.classes.find(c => c.id === student.classId) || null;

  setTopbarIdentity(student.name,"Aluno");
  setActiveTopNav("student-dashboard");
  setTopbar(true,"student");

  $("#studentWelcome").textContent = `Olá, ${student.plainName}.`;
  $("#studentClassInfo").textContent = state.currentClass
    ? `${state.currentClass.name} • Código ${state.currentClass.code}`
    : "";

  const assignedIds = data.assignments
    .filter(item => item.classId === student.classId)
    .map(item => item.activityId);

  const items = data.activities.filter(item => assignedIds.includes(item.id));

  renderStudentProgressSummary(items,data);
  renderStudentCatalog(items,data);
  renderStudentActivities(items,data,state.studentContextSlug);

  showScreen("screenStudentDashboard");
}

function renderStudentProgressSummary(items,data){
  const host = $("#studentProgressSummary");
  if(!host) return;

  const submissions = data.submissions.filter(s =>
    s.studentId === state.student.id &&
    items.some(item => item.id === s.activityId)
  );

  const resolved = submissions.filter(s => s.resolved).length;
  const inProgress = submissions.filter(s => !s.resolved).length;
  const notStarted = Math.max(0,items.length - submissions.length);
  const progress = items.length ? Math.round((resolved/items.length)*100) : 0;

  host.innerHTML = `
    <div class="student-progress-card">
      <div class="progress-copy">
        <span class="eyebrow">SEU PROGRESSO</span>
        <strong>${progress}% concluído</strong>
        <small>${resolved} de ${items.length} atividades concluídas</small>
      </div>

      <div class="progress-bar" aria-label="${progress}% concluído">
        <span style="width:${progress}%"></span>
      </div>

      <div class="student-status-grid">
        <div><strong>${notStarted}</strong><span>Não iniciadas</span></div>
        <div><strong>${inProgress}</strong><span>Em andamento</span></div>
        <div><strong>${resolved}</strong><span>Concluídas</span></div>
      </div>
    </div>
  `;
}

function getStudentContextBySlug(slug){
  for(const row of STREAMING_ROWS){
    const item = row.items.find(entry => entry.slug === slug);
    if(item) return item;
  }
  return null;
}

function renderStudentCatalog(items,data){
  const container = $("#studentCatalogRows");
  if(!container) return;

  container.innerHTML = "";

  STREAMING_ROWS.forEach(row => {
    const section = document.createElement("section");
    section.className = "student-stream-row";

    section.innerHTML = `
      <div class="student-stream-row-heading">
        <h3>${escapeHtml(row.title)}</h3>
      </div>
      <div class="student-cover-grid"></div>
    `;

    const grid = $(".student-cover-grid",section);

    row.items.forEach(context => {
      const contextItems = items.filter(activity => activity.contextSlug === context.slug);
      const resolvedCount = contextItems.filter(activity => {
        const submission = data.submissions.find(s =>
          s.studentId === state.student.id &&
          s.activityId === activity.id
        );
        return submission?.resolved;
      }).length;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "student-cover-item";
      button.dataset.studentContext = context.slug;

      if(state.studentContextSlug === context.slug){
        button.classList.add("active");
      }

      const activityLabel = contextItems.length === 1
        ? "1 atividade liberada"
        : `${contextItems.length} atividades liberadas`;

      button.innerHTML = `
        <span class="student-cover-image">
          <img src="${escapeHtml(context.image)}" alt="${escapeHtml(context.title)}" loading="lazy">
          <span class="student-cover-fallback hidden">${escapeHtml(context.title)}</span>

          <span class="student-cover-count ${contextItems.length ? "has-activities" : ""}">
            ${contextItems.length}
          </span>
        </span>

        <span class="student-cover-copy">
          <strong>${escapeHtml(context.title)}</strong>
          <small>${escapeHtml(context.subtitle || "")}</small>

          <span class="student-cover-meta">
            <span>${escapeHtml(activityLabel)}</span>
            ${contextItems.length ? `<span>${resolvedCount}/${contextItems.length} concluídas</span>` : ""}
          </span>
        </span>
      `;

      const img = $("img",button);
      const fallback = $(".student-cover-fallback",button);

      img.addEventListener("load",() => {
        fallback.classList.add("hidden");
      });

      img.addEventListener("error",() => {
        img.classList.add("hidden");
        fallback.classList.remove("hidden");
      });

      button.addEventListener("click",() => {
        state.studentContextSlug = context.slug;

        $$(".student-cover-item").forEach(card => {
          card.classList.toggle(
            "active",
            card.dataset.studentContext === context.slug
          );
        });

        renderStudentActivities(items,data,context.slug);

        $("#studentComponentSection")?.scrollIntoView({
          behavior:"smooth",
          block:"start"
        });
      });

      grid.appendChild(button);
    });

    container.appendChild(section);
  });
}

function renderStudentActivities(items,data,contextSlug=null){
  const container = $("#studentActivityGroups");
  const titleEl = $("#studentComponentTitle");
  const subtitleEl = $("#studentComponentSubtitle");
  const clearButton = $("#clearStudentComponentFilter");

  let visibleItems = [...items];

  if(contextSlug){
    visibleItems = visibleItems.filter(item => item.contextSlug === contextSlug);
    const context = getStudentContextBySlug(contextSlug);

    titleEl.textContent = context?.title || "Atividades";
    subtitleEl.textContent = context
      ? `Atividades liberadas em ${context.title} para sua turma.`
      : "Atividades liberadas pelo professor para sua turma.";

    clearButton.classList.remove("hidden");
  }else{
    titleEl.textContent = "Todas as atividades";
    subtitleEl.textContent = "Atividades liberadas pelo professor para sua turma.";
    clearButton.classList.toggle("hidden",items.length === 0);
  }

  if(!visibleItems.length){
    const context = contextSlug ? getStudentContextBySlug(contextSlug) : null;

    container.innerHTML = emptyState(
      contextSlug ? "○" : "✓",
      contextSlug
        ? `Nenhuma atividade liberada em ${context?.title || "esta área"}`
        : "Nenhuma atividade liberada ainda",
      contextSlug
        ? "A capa está disponível para navegação, mas o professor ainda não liberou atividades deste componente para sua turma."
        : "As áreas e componentes estão disponíveis acima. Quando o professor liberar uma atividade, ela aparecerá aqui."
    );

    return;
  }

  const grouped = new Map();

  visibleItems.forEach(item => {
    const context = getStudentContextBySlug(item.contextSlug);
    const key = context?.title || item.module || item.area || "Atividades";

    if(!grouped.has(key)) grouped.set(key,[]);
    grouped.get(key).push(item);
  });

  container.innerHTML = [...grouped.entries()].map(([groupTitle,groupItems]) => `
    <section class="student-group">
      ${contextSlug ? "" : `<h3 class="student-activity-group-title">${escapeHtml(groupTitle)}</h3>`}

      <div class="student-activity-grid">
        ${groupItems.map(item => {
          const submission = data.submissions.find(s =>
            s.studentId === state.student.id &&
            s.activityId === item.id
          );

          const status = submission?.resolved
            ? "Concluída"
            : submission
              ? "Em andamento"
              : "Não iniciada";

          const statusClass = submission?.resolved
            ? "is-complete"
            : submission
              ? "is-progress"
              : "is-new";

          return `
            <button class="student-activity-card ${statusClass}" type="button" data-student-activity="${item.id}">
              <div class="student-card-top">
                <span class="eyebrow">${escapeHtml(item.level || item.area || "")}</span>
                <span class="student-status">${status}</span>
              </div>

              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.statement)}</p>

              <div class="badge-row">
                <span class="badge">${escapeHtml(item.module || item.area || "Atividade")}</span>
                <span class="badge">Tentativas: ${submission?.attempts || 0}</span>
              </div>

              <span class="student-open-action">Abrir atividade →</span>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");

  $$("[data-student-activity]",container).forEach(button => {
    button.addEventListener("click",() => {
      const item = visibleItems.find(
        activity => activity.id === button.dataset.studentActivity
      );

      if(item) openStudentActivity(item);
    });
  });
}

function openStudentActivity(item){
  const data = loadData();

  let submission = data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === item.id
  );

  if(!submission){
    submission = {
      id:uid("submission"),
      studentId:state.student.id,
      classId:state.student.classId,
      activityId:item.id,
      accessedAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      resolved:false,
      attempts:0,
      activeSeconds:0,
      scratch:"",
      finalAnswer:""
    };

    data.submissions.push(submission);
    saveData(data);
  }

  state.currentActivity = item;
  state.materialBoard = null;
  state.activeSeconds = Number(submission.activeSeconds || 0);

  $("#studentActivityMeta").textContent = [item.area,item.module,item.level].filter(Boolean).join(" • ");
  $("#studentActivityTitle").textContent = item.title;
  $("#studentActivityStatement").textContent = item.statement || "";
  $("#studentActivityQuestion").textContent = item.question || "";
  $("#studentScratch").value = submission.scratch || "";

  renderStudentAnswerArea(submission);
  renderInteractiveArea(item);

  showScreen("screenStudentActivity");
  startActivityTimer();

  setupProtectedScratchField();
  captureScratchHistorySnapshot("abertura da atividade",false);

  state.scratchSaveDebounced = debounce(saveCurrentProgress,600);

  $("#studentScratch").oninput = () => {
    state.scratchSaveDebounced?.();
    scheduleScratchHistoryCapture();
  };

  $("#studentScratch").onblur = () => {
    captureScratchHistorySnapshot("pausa na escrita",true);
    saveCurrentProgress();
  };
}

function renderStudentAnswerArea(submission){
  const area = $("#studentAnswerArea");

  area.innerHTML = `
    <div class="answer-actions">
      <label>
        Resposta final
        <input id="studentFinalAnswer" type="text" placeholder="Digite sua resposta">
      </label>

      <button id="submitStudentAnswerBtn" class="btn btn-primary" type="button">
        ENVIAR RESPOSTA
      </button>
    </div>
  `;

  $("#studentFinalAnswer").value = submission.finalAnswer || "";
  $("#submitStudentAnswerBtn").addEventListener("click",submitStudentAnswer);
}


function getCurrentSubmission(data=loadData()){
  if(!state.student || !state.currentActivity) return null;

  return data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  ) || null;
}

function ensureScratchHistory(submission){
  if(!submission) return [];

  if(!Array.isArray(submission.scratchHistory)){
    submission.scratchHistory = [];

    const existing = String(submission.scratch || "");
    if(existing.trim()){
      submission.scratchHistory.push({
        at:submission.updatedAt || submission.accessedAt || new Date().toISOString(),
        text:existing,
        reason:"rascunho anterior"
      });
    }
  }

  return submission.scratchHistory;
}

function captureScratchHistorySnapshot(reason="digitação",force=false){
  if(!state.student || !state.currentActivity) return;

  const field = $("#studentScratch");
  if(!field) return;

  const data = loadData();
  const submission = getCurrentSubmission(data);
  if(!submission) return;

  const history = ensureScratchHistory(submission);
  const text = field.value || "";
  const last = history.at(-1);

  if(last?.text === text) return;

  // Evita registrar um histórico vazio logo na abertura.
  if(!text.trim() && !history.length) return;

  const now = new Date();
  const lastTime = last?.at ? new Date(last.at).getTime() : 0;
  const elapsed = Date.now() - lastTime;
  const delta = Math.abs(text.length - String(last?.text || "").length);

  // Capturas automáticas: após pausas de escrita, evitando excesso de versões.
  // Capturas forçadas ocorrem ao sair do campo, enviar resposta ou sair da atividade.
  if(!force && last && elapsed < 5000 && delta < 12) return;

  history.push({
    at:now.toISOString(),
    text,
    reason
  });

  // Limite local para impedir crescimento indefinido do navegador.
  if(history.length > 150){
    submission.scratchHistory = history.slice(-150);
  }

  submission.scratch = text;
  submission.updatedAt = now.toISOString();
  saveData(data);
}

function scheduleScratchHistoryCapture(){
  if(state.scratchHistoryTimer){
    clearTimeout(state.scratchHistoryTimer);
  }

  state.scratchHistoryTimer = setTimeout(() => {
    captureScratchHistorySnapshot("digitação",false);
    state.scratchHistoryTimer = null;
  },2500);
}

function blockScratchAction(event,message="Ação bloqueada no rascunho. Digite o conteúdo manualmente."){
  event.preventDefault();
  event.stopPropagation();
  toast(message,"info");
}

function setupProtectedScratchField(){
  const field = $("#studentScratch");
  if(!field) return;

  // Evita empilhar listeners toda vez que uma nova atividade é aberta.
  if(field.dataset.protectionBound === "1") return;
  field.dataset.protectionBound = "1";

  field.addEventListener("keydown",event => {
    const key = String(event.key || "").toLowerCase();

    if((event.ctrlKey || event.metaKey) && ["c","v","x"].includes(key)){
      blockScratchAction(event);
    }
  });

  ["copy","paste","cut","contextmenu","drop","dragstart"].forEach(eventName => {
    field.addEventListener(eventName,event => {
      blockScratchAction(event);
    });
  });

  field.addEventListener("dragover",event => {
    // Bloqueia arrastar texto para dentro do campo.
    event.preventDefault();
    event.dataTransfer && (event.dataTransfer.dropEffect = "none");
  });

  field.addEventListener("beforeinput",event => {
    const blockedTypes = [
      "insertFromPaste",
      "insertFromDrop",
      "deleteByCut"
    ];

    if(blockedTypes.includes(event.inputType)){
      blockScratchAction(event);
    }
  });
}

function formatScratchReason(reason){
  const map = {
    "abertura da atividade":"Abertura",
    "digitação":"Registro durante a escrita",
    "pausa na escrita":"Pausa na escrita",
    "envio da resposta":"Envio da resposta",
    "saída da atividade":"Saída da atividade",
    "rascunho anterior":"Registro anterior"
  };

  return map[reason] || reason || "Registro";
}

function startActivityTimer(){
  stopActivityTimer(false);

  let lastTick = Date.now();
  $("#activityTimerDisplay").textContent = timerText(state.activeSeconds);

  state.timerHandle = setInterval(() => {
    const now = Date.now();

    if(!document.hidden){
      const delta = Math.max(0,Math.min(2,Math.round((now-lastTick)/1000)));
      state.activeSeconds += delta;
      $("#activityTimerDisplay").textContent = timerText(state.activeSeconds);
    }

    lastTick = now;
  },1000);

  state.heartbeatHandle = setInterval(() => {
    if(!document.hidden) saveCurrentProgress();
  },10000);
}

function stopActivityTimer(save=true){
  if(state.timerHandle){
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  if(state.heartbeatHandle){
    clearInterval(state.heartbeatHandle);
    state.heartbeatHandle = null;
  }

  if(save && state.currentActivity){
    captureScratchHistorySnapshot("saída da atividade",true);
    saveCurrentProgress();
  }

  if(state.scratchHistoryTimer){
    clearTimeout(state.scratchHistoryTimer);
    state.scratchHistoryTimer = null;
  }
}

function saveCurrentProgress(){
  if(!state.student || !state.currentActivity) return;

  const data = loadData();
  const submission = data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  );

  if(!submission) return;

  submission.activeSeconds = state.activeSeconds;
  submission.scratch = $("#studentScratch")?.value || submission.scratch || "";
  submission.finalAnswer = $("#studentFinalAnswer")?.value || submission.finalAnswer || "";
  submission.updatedAt = new Date().toISOString();

  const student = data.students.find(s => s.id === state.student.id);
  if(student) student.lastAccess = new Date().toISOString();

  saveData(data);
}

function submitStudentAnswer(){
  const data = loadData();
  const submission = data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  );

  if(!submission) return;

  const answer = $("#studentFinalAnswer").value.trim();
  const expected = String(state.currentActivity.answer || "").trim();

  captureScratchHistorySnapshot("envio da resposta",true);

  // Recarrega os dados para incluir a versão de rascunho recém-salva.
  const refreshedData = loadData();
  const refreshedSubmission = refreshedData.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  );

  if(refreshedSubmission){
    Object.assign(submission,refreshedSubmission);
  }

  submission.attempts += 1;
  submission.finalAnswer = answer;
  submission.scratch = $("#studentScratch").value;
  submission.activeSeconds = state.activeSeconds;
  submission.updatedAt = new Date().toISOString();

  const feedback = $("#studentAnswerFeedback");
  feedback.classList.remove("hidden","correct","incorrect");

  if(!expected){
    submission.resolved = false;
    feedback.classList.add("correct");
    feedback.textContent = "Resposta registrada.";
  }else{
    const correct =
      answer.replace(",",".").trim().toLowerCase() ===
      expected.replace(",",".").trim().toLowerCase();

    submission.resolved = correct;

    if(correct){
      feedback.classList.add("correct");
      feedback.textContent = "Sua resposta está correta. Parabéns!";
    }else{
      feedback.classList.add("incorrect");
      feedback.textContent = "Resposta incorreta. Revise sua estratégia e tente novamente.";
    }
  }

  if(state.materialBoard){
    submission.materialProgress = {
      board:serializeMaterialBoard(state.materialBoard),
      savedAt:new Date().toISOString(),
      reason:submission.resolved ? "resposta enviada corretamente" : "resposta enviada"
    };
  }

  saveData(data);

  const assignedIds = data.assignments
    .filter(item => item.classId === state.student.classId)
    .map(item => item.activityId);

  const assignedItems = data.activities.filter(item => assignedIds.includes(item.id));
  renderStudentProgressSummary(assignedItems,data);
}

/* ============================================================
   MATERIAL DOURADO — DIVISÃO
   ============================================================ */
function parseMaterialNumberToken(token){
  const raw = String(token || "").trim();

  if(!raw) return NaN;

  // Formatos brasileiros: 2.970, 144, 12, 4,5
  const normalized = raw
    .replace(/\.(?=\d{3}(?:\D|$))/g,"")
    .replace(",",".")
    .replace(/[^\d.-]/g,"");

  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

function inferMaterialOperands(item){
  let dividend = Number(item?.operandA);
  let divisor = Number(item?.operandB);

  const explicitDividendValid = Number.isFinite(dividend) && dividend > 0;
  const explicitDivisorValid = Number.isFinite(divisor) && divisor > 0;

  if(explicitDividendValid && explicitDivisorValid){
    return {
      dividend:Math.round(dividend),
      divisor:Math.max(1,Math.round(divisor)),
      inferred:false
    };
  }

  const source = `${item?.statement || ""} ${item?.question || ""}`;
  const tokens = source.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) || [];

  const values = tokens
    .map(parseMaterialNumberToken)
    .filter(value => Number.isFinite(value) && value > 0);

  if(!explicitDividendValid){
    dividend = values[0] ?? 1;
  }

  if(!explicitDivisorValid){
    const next = values.find((value,index) =>
      index > 0 && value !== dividend
    );
    divisor = next ?? values[1] ?? 1;
  }

  // O laboratório trabalha visualmente com quantidades inteiras.
  // Não bloqueia o acesso: apenas usa uma aproximação inteira quando necessário.
  dividend = Math.max(1,Math.round(dividend));
  divisor = Math.max(1,Math.round(divisor));

  return {
    dividend,
    divisor,
    inferred:true
  };
}

function renderInteractiveArea(item){
  const area = $("#interactiveArea");

  if(item.contextSlug !== "divisao"){
    area.innerHTML = "";
    return;
  }

  const {dividend,divisor,inferred} = inferMaterialOperands(item);

  area.innerHTML = `
    <div class="material-access-card">
      <div class="material-access-icon" aria-hidden="true">
        <span class="mini-hundred"></span>
        <span class="mini-ten"></span>
        <span class="mini-unit"></span>
      </div>

      <div class="material-access-copy">
        <span class="eyebrow">RECURSO DE APOIO</span>
        <h2>Resolver com Material Dourado</h2>
        <p>
          Represente <strong>${dividend}</strong>, faça as trocas necessárias
          e distribua as peças igualmente entre <strong>${divisor}</strong> grupos.
        </p>
        ${inferred ? `
          <small class="material-inference-note">
            Os valores foram identificados automaticamente a partir da atividade.
          </small>
        ` : ""}
      </div>

      <button id="openMaterialLabBtn" class="btn btn-material-open" type="button">
        ABRIR MATERIAL DOURADO
      </button>
    </div>
  `;

  $("#openMaterialLabBtn")?.addEventListener("click",openMaterialLab);
}

function openMaterialLab(){
  const item = state.currentActivity;
  if(!item) return;

  saveCurrentProgress();

  const {dividend,divisor} = inferMaterialOperands(item);

  state.materialBoard = createMaterialBoard(dividend,divisor);

  $("#materialLabTitle").textContent = item.title || "Divisão com Material Dourado";
  $("#materialLabStatement").textContent = item.statement || "";
  $("#materialLabOperation").textContent = `${dividend} ÷ ${divisor}`;
  $("#materialLabQuestion").textContent = item.question || "";

  renderMaterialLab();
  showScreen("screenMaterialLab");
}

function closeMaterialLab(){
  showScreen("screenStudentActivity");
  $("#activityTimerDisplay").textContent = timerText(state.activeSeconds);
}

function createMaterialBoard(dividend,divisor){
  return {
    dividend,
    divisor,
    confirmed:false,
    phase:1,
    selectedType:null,
    available:{M:0,C:0,D:0,U:0},
    groups:Array.from({length:divisor},() => ({M:0,C:0,D:0,U:0})),
    solved:false
  };
}

function materialCountsValue(counts){
  const values = {M:1000,C:100,D:10,U:1};

  return Object.entries(counts || {}).reduce(
    (sum,[key,count]) => sum + (values[key] || 0) * Number(count || 0),
    0
  );
}

function materialTotalValue(board){
  const poolValue = materialCountsValue(board.available);
  const groupValue = board.groups.reduce(
    (sum,group) => sum + materialCountsValue(group),
    0
  );

  return poolValue + groupValue;
}

function pieceLabel(key){
  return {
    M:"Milhar",
    C:"Centena",
    D:"Dezena",
    U:"Unidade"
  }[key];
}

function renderPieceVisuals(counts,location="pool",groupIndex=null){
  const keys = ["M","C","D","U"];
  const totalPieces = keys.reduce((sum,key) => sum + Number(counts[key] || 0),0);

  if(!totalPieces){
    return `<div class="md-empty-pieces">Nenhuma peça</div>`;
  }

  return keys.map(key => {
    const count = Number(counts[key] || 0);
    if(!count) return "";

    const visible = Math.min(count,24);
    const pieces = Array.from({length:visible},(_,index) => {
      const draggable = location === "pool" ? 'draggable="true"' : "";
      const attrs = location === "pool"
        ? `data-drag-piece="${key}"`
        : `data-return-piece="${key}" data-return-group="${groupIndex}"`;

      return `
        <button
          type="button"
          class="md-piece md-piece-${key}"
          title="${location === "pool" ? "Arraste para um grupo" : "Clique para devolver"}"
          ${draggable}
          ${attrs}
          aria-label="${pieceLabel(key)} ${index+1}"
        ></button>
      `;
    }).join("");

    const remainder = count > visible
      ? `<span class="md-more-pieces">+${count-visible}</span>`
      : "";

    return `
      <div class="md-piece-cluster">
        <div class="md-piece-cluster-label">
          <strong>${pieceLabel(key)}</strong>
          <span>${count}</span>
        </div>
        <div class="md-pieces-row">${pieces}${remainder}</div>
      </div>
    `;
  }).join("");
}

function renderMaterialLab(){
  const board = state.materialBoard;
  const root = $("#materialLabRoot");

  if(!board || !root) return;

  const representedValue = materialCountsValue(board.available);
  const quotient = board.dividend / board.divisor;
  const integerQuotient = Number.isInteger(quotient);

  root.innerHTML = `
    <div class="material-lab-steps">
      ${[
        ["1","Representar"],
        ["2","Trocar"],
        ["3","Distribuir"],
        ["4","Conferir"]
      ].map(([number,label],index) => {
        const step = index + 1;
        const status = board.solved
          ? "done"
          : step < board.phase
            ? "done"
            : step === board.phase
              ? "active"
              : "";

        return `
          <div class="material-lab-step ${status}">
            <span>${number}</span>
            <strong>${label}</strong>
          </div>
        `;
      }).join("")}
    </div>

    <section class="material-stage">
      <div class="material-stage-heading">
        <div>
          <span class="stage-number">1</span>
          <div>
            <h2>Represente o dividendo</h2>
            <p>Monte o número ${board.dividend} usando milhar, centena, dezena e unidade.</p>
          </div>
        </div>

        <div class="representation-summary ${representedValue === board.dividend ? "is-correct" : ""}">
          <span>Representado</span>
          <strong>${representedValue}</strong>
          <small>de ${board.dividend}</small>
        </div>
      </div>

      <div class="material-white-grid">
        ${[
          ["M","MILHAR","1000"],
          ["C","CENTENA","100"],
          ["D","DEZENA","10"],
          ["U","UNIDADE","1"]
        ].map(([key,label,value]) => `
          <article class="material-white-box">
            <header>
              <div>
                <strong>${label}</strong>
                <span>vale ${value}</span>
              </div>
              <span class="material-piece-count">${board.available[key]}</span>
            </header>

            <div class="material-piece-preview material-preview-${key}">
              <span></span>
            </div>

            <div class="material-count-controls">
              <button type="button" data-md-minus="${key}" aria-label="Retirar ${label.toLowerCase()}">−</button>
              <strong>${board.available[key]}</strong>
              <button type="button" data-md-plus="${key}" aria-label="Adicionar ${label.toLowerCase()}">+</button>
            </div>
          </article>
        `).join("")}
      </div>

      <div class="material-stage-actions">
        <button id="confirmMaterialRepresentationBtn" class="btn btn-primary" type="button">
          ✓ CONFIRMAR REPRESENTAÇÃO
        </button>

        <button id="resetMaterialRepresentationBtn" class="btn btn-outline" type="button">
          Refazer representação
        </button>
      </div>

      <div class="material-message ${
        representedValue === board.dividend ? "material-message-ready" : ""
      }">
        Valor representado: <strong>${representedValue}</strong>
        <span>•</span>
        Valor necessário: <strong>${board.dividend}</strong>
      </div>
    </section>

    ${board.confirmed ? `
      <section class="material-workspace-grid">
        <aside class="material-stage material-exchange-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">2</span>
              <div>
                <h2>Trocas</h2>
                <p>Faça trocas sem alterar o valor representado.</p>
              </div>
            </div>
          </div>

          <div class="exchange-pairs">
            <div class="exchange-pair">
              <button type="button" data-md-exchange="M-C">
                <strong>1 milhar</strong><span>→</span><small>10 centenas</small>
              </button>
              <button type="button" data-md-exchange="C-M">
                <strong>10 centenas</strong><span>→</span><small>1 milhar</small>
              </button>
            </div>

            <div class="exchange-pair">
              <button type="button" data-md-exchange="C-D">
                <strong>1 centena</strong><span>→</span><small>10 dezenas</small>
              </button>
              <button type="button" data-md-exchange="D-C">
                <strong>10 dezenas</strong><span>→</span><small>1 centena</small>
              </button>
            </div>

            <div class="exchange-pair emphasized">
              <button type="button" data-md-exchange="D-U">
                <strong>1 dezena</strong><span>→</span><small>10 unidades</small>
              </button>
              <button type="button" data-md-exchange="U-D">
                <strong>10 unidades</strong><span>→</span><small>1 dezena</small>
              </button>
            </div>
          </div>

          <div class="material-pool-card">
            <div class="material-pool-heading">
              <div>
                <strong>Peças disponíveis</strong>
                <small>Arraste uma peça ou use os botões nos grupos.</small>
              </div>
              <span>${materialCountsValue(board.available)}</span>
            </div>

            <div id="materialPiecePool" class="material-pool-pieces">
              ${renderPieceVisuals(board.available,"pool")}
            </div>
          </div>
        </aside>

        <section class="material-stage material-distribution-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">3</span>
              <div>
                <h2>Distribua entre ${board.divisor} grupos</h2>
                <p>Os grupos devem terminar com o mesmo valor.</p>
              </div>
            </div>

            <div class="divisor-chip">
              <span>DIVISOR</span>
              <strong>${board.divisor}</strong>
            </div>
          </div>

          <div class="material-groups-grid">
            ${board.groups.map((group,index) => `
              <article class="material-group-white" data-material-group="${index}">
                <header>
                  <div>
                    <strong>Grupo ${index+1}</strong>
                    <span>Valor: ${materialCountsValue(group)}</span>
                  </div>
                  <small>
                    M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}
                  </small>
                </header>

                <div class="material-group-pieces">
                  ${renderPieceVisuals(group,"group",index)}
                </div>

                <div class="material-group-actions">
                  ${["M","C","D","U"].map(key => `
                    <button
                      type="button"
                      data-md-send="${key}"
                      data-md-group="${index}"
                      ${board.available[key] <= 0 ? "disabled" : ""}
                    >
                      + ${key}
                    </button>
                  `).join("")}
                </div>
              </article>
            `).join("")}
          </div>

          <div class="material-stage-actions">
            <button id="checkMaterialDistributionBtn" class="btn btn-primary" type="button">
              ✓ CONFERIR O RESULTADO
            </button>

            <button id="collectMaterialPiecesBtn" class="btn btn-outline" type="button">
              ↺ Recolher todas as peças
            </button>

            <button id="restartMaterialLabBtn" class="btn btn-outline" type="button">
              Refazer tudo
            </button>
          </div>

          <div id="materialDistributionFeedback" class="material-message">
            ${
              board.solved
                ? `<strong>Parabéns!</strong> Cada grupo representa ${quotient}.`
                : integerQuotient
                  ? `Distribua todas as peças igualmente. Resultado esperado por grupo: <strong>?</strong>`
                  : `Esta divisão não tem quociente inteiro e não é adequada para esta versão do laboratório.`
            }
          </div>

          ${board.solved ? `
            <div class="material-solved-panel">
              <div>
                <span>RESULTADO</span>
                <strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong>
              </div>

              <button id="useMaterialResultBtn" class="btn btn-success" type="button">
                USAR RESULTADO NO EXERCÍCIO
              </button>
            </div>
          ` : ""}
        </section>
      </section>
    ` : ""}
  `;

  bindMaterialLabEvents();
}

function bindMaterialLabEvents(){
  const board = state.materialBoard;
  if(!board) return;

  $$("[data-md-plus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.mdPlus;
      board.available[key] += 1;
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      renderMaterialLab();
    });
  });

  $$("[data-md-minus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.mdMinus;
      board.available[key] = Math.max(0,board.available[key]-1);
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      renderMaterialLab();
    });
  });

  $("#confirmMaterialRepresentationBtn")?.addEventListener("click",() => {
    const value = materialCountsValue(board.available);

    if(value !== board.dividend){
      return toast(
        `A representação vale ${value}. Monte exatamente ${board.dividend}.`,
        "error"
      );
    }

    board.confirmed = true;
    board.phase = 2;
    renderMaterialLab();
    toast("Representação correta. Agora faça as trocas e distribua as peças.","success");
  });

  $("#resetMaterialRepresentationBtn")?.addEventListener("click",() => {
    state.materialBoard = createMaterialBoard(board.dividend,board.divisor);
    renderMaterialLab();
  });

  $$("[data-md-exchange]").forEach(button => {
    button.addEventListener("click",() => {
      applyMaterialExchange(button.dataset.mdExchange);
    });
  });

  $$("[data-md-send]").forEach(button => {
    button.addEventListener("click",() => {
      moveMaterialPieceToGroup(
        button.dataset.mdSend,
        Number(button.dataset.mdGroup)
      );
    });
  });

  $$("[data-return-piece]").forEach(button => {
    button.addEventListener("click",() => {
      returnMaterialPieceToPool(
        button.dataset.returnPiece,
        Number(button.dataset.returnGroup)
      );
    });
  });

  $$("[data-drag-piece]").forEach(piece => {
    piece.addEventListener("dragstart",event => {
      event.dataTransfer.setData("text/material-piece",piece.dataset.dragPiece);
      event.dataTransfer.effectAllowed = "move";
    });
  });

  $$("[data-material-group]").forEach(group => {
    group.addEventListener("dragover",event => {
      event.preventDefault();
      group.classList.add("is-dragover");
    });

    group.addEventListener("dragleave",() => {
      group.classList.remove("is-dragover");
    });

    group.addEventListener("drop",event => {
      event.preventDefault();
      group.classList.remove("is-dragover");

      const key = event.dataTransfer.getData("text/material-piece");
      const index = Number(group.dataset.materialGroup);

      if(key){
        moveMaterialPieceToGroup(key,index);
      }
    });
  });

  $("#collectMaterialPiecesBtn")?.addEventListener("click",() => {
    board.groups.forEach(group => {
      ["M","C","D","U"].forEach(key => {
        board.available[key] += group[key];
        group[key] = 0;
      });
    });

    board.phase = 2;
    board.solved = false;
    renderMaterialLab();
  });

  $("#restartMaterialLabBtn")?.addEventListener("click",() => {
    state.materialBoard = createMaterialBoard(board.dividend,board.divisor);
    renderMaterialLab();
  });

  $("#checkMaterialDistributionBtn")?.addEventListener("click",checkMaterialDistribution);

  $("#useMaterialResultBtn")?.addEventListener("click",() => {
    const quotient = board.dividend / board.divisor;

    closeMaterialLab();

    const answerInput = $("#studentFinalAnswer");
    if(answerInput){
      answerInput.value = String(quotient);
      answerInput.focus();
    }

    toast("Resultado transferido para a resposta final. Revise e envie.","success");
  });
}

function applyMaterialExchange(action){
  const board = state.materialBoard;
  if(!board) return;

  const pool = board.available;
  let valid = true;

  if(action === "M-C" && pool.M >= 1){
    pool.M -= 1;
    pool.C += 10;
  }else if(action === "C-M" && pool.C >= 10){
    pool.C -= 10;
    pool.M += 1;
  }else if(action === "C-D" && pool.C >= 1){
    pool.C -= 1;
    pool.D += 10;
  }else if(action === "D-C" && pool.D >= 10){
    pool.D -= 10;
    pool.C += 1;
  }else if(action === "D-U" && pool.D >= 1){
    pool.D -= 1;
    pool.U += 10;
  }else if(action === "U-D" && pool.U >= 10){
    pool.U -= 10;
    pool.D += 1;
  }else{
    valid = false;
  }

  if(!valid){
    return toast("Não há peças suficientes para realizar essa troca.","error");
  }

  board.phase = Math.max(board.phase,2);
  board.solved = false;
  renderMaterialLab();
}

function moveMaterialPieceToGroup(key,index){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if(!["M","C","D","U"].includes(key)) return;
  if(!board.groups[index]) return;

  if(board.available[key] <= 0){
    return toast(`Não há ${pieceLabel(key).toLowerCase()} disponível.`,"error");
  }

  board.available[key] -= 1;
  board.groups[index][key] += 1;
  board.phase = Math.max(board.phase,3);
  board.solved = false;
  renderMaterialLab();
}

function returnMaterialPieceToPool(key,index){
  const board = state.materialBoard;
  if(!board || !board.groups[index]) return;
  if(board.groups[index][key] <= 0) return;

  board.groups[index][key] -= 1;
  board.available[key] += 1;
  board.solved = false;
  renderMaterialLab();
}

function checkMaterialDistribution(){
  const board = state.materialBoard;
  if(!board) return;

  const quotient = board.dividend / board.divisor;

  if(!Number.isInteger(quotient)){
    return toast(
      "Esta versão do Material Dourado trabalha com quociente inteiro.",
      "error"
    );
  }

  const poolValue = materialCountsValue(board.available);
  const values = board.groups.map(materialCountsValue);
  const allEqual = values.every(value => value === quotient);
  const correctTotal = materialTotalValue(board) === board.dividend;

  if(poolValue === 0 && allEqual && correctTotal){
    board.phase = 4;
    board.solved = true;
    renderMaterialLab();
    toast("Distribuição correta. Parabéns!","success");
    return;
  }

  const feedback = $("#materialDistributionFeedback");

  if(feedback){
    if(poolValue > 0){
      feedback.innerHTML =
        `Ainda existem peças disponíveis fora dos grupos. Valor restante: <strong>${poolValue}</strong>.`;
    }else{
      feedback.innerHTML =
        "Os grupos ainda não têm o mesmo valor. Revise a distribuição ou faça novas trocas.";
    }
  }

  toast("A distribuição ainda precisa ser ajustada.","error");
}

/* ============================================================
   RELATÓRIOS
   ============================================================ */
function prepareReports(){
  populateClassSelects();

  const select = $("#reportClassSelect");

  if(!select.value){
    const classes = currentProfessorClasses();
    if(classes.length) select.value = classes[0].id;
  }

  renderReport();
}

function buildReportRows(){
  const classId = $("#reportClassSelect").value;
  const data = loadData();
  const students = data.students.filter(student => student.classId === classId);

  state.reportRows = students.map(student => {
    const submissions = data.submissions.filter(s =>
      s.studentId === student.id &&
      s.classId === classId
    );

    return {
      student,
      roster:student.roster,
      rosterText:student.rosterText,
      situation:student.status || "Ativo",
      plainName:student.plainName,
      firstAccess:student.firstAccess || submissions.map(s => s.accessedAt).filter(Boolean).sort()[0] || null,
      lastAccess:student.lastAccess || submissions.map(s => s.updatedAt).filter(Boolean).sort().at(-1) || null,
      duration:submissions.reduce((sum,s) => sum + Number(s.activeSeconds || 0),0),
      accessed:submissions.length,
      resolved:submissions.filter(s => s.resolved).length,
      submissions
    };
  });
}

function sortedReportRows(){
  buildReportRows();

  const rows = [...state.reportRows];
  const sort = $("#reportSort").value;

  if(sort === "recent"){
    rows.sort((a,b) => new Date(b.lastAccess || 0) - new Date(a.lastAccess || 0));
  }else if(sort === "oldest"){
    rows.sort((a,b) =>
      new Date(a.firstAccess || "9999-12-31") -
      new Date(b.firstAccess || "9999-12-31")
    );
  }else if(sort === "duration"){
    rows.sort((a,b) => b.duration - a.duration || a.roster - b.roster);
  }else{
    rows.sort((a,b) => a.roster - b.roster);
  }

  return rows;
}

function renderReport(){
  const classId = $("#reportClassSelect").value;
  const wrap = $("#reportTableWrap");

  if(!classId){
    $("#reportMetrics").innerHTML = "";
    wrap.innerHTML = emptyState(
      "◎",
      "Selecione uma turma",
      "Escolha uma turma acima para visualizar participação, tempo e conclusões."
    );
    return;
  }

  const rows = sortedReportRows();

  const studentsCount = rows.length;
  const accessedCount = rows.filter(row => row.accessed > 0).length;
  const completedStudents = rows.filter(row => row.resolved > 0).length;
  const averageSeconds = studentsCount
    ? Math.round(rows.reduce((sum,row) => sum + row.duration,0) / studentsCount)
    : 0;

  $("#reportMetrics").innerHTML = [
    metricCard("Alunos",String(studentsCount),"cadastrados","blue"),
    metricCard("Acessaram",String(accessedCount),"com participação registrada","green"),
    metricCard("Concluíram",String(completedStudents),"ao menos uma atividade","gold"),
    metricCard("Tempo médio",formatDuration(averageSeconds),"por aluno","violet")
  ].join("");

  if(!rows.length){
    wrap.innerHTML = emptyState(
      "○",
      "Nenhum aluno cadastrado",
      "Cadastre alunos nesta turma para começar a acompanhar a participação."
    );
    return;
  }

  wrap.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Nº</th>
          <th>Situação</th>
          <th>Aluno</th>
          <th>Primeiro acesso</th>
          <th>Último acesso</th>
          <th>Tempo nos exercícios</th>
          <th>Acessadas</th>
          <th>Resolvidas</th>
          <th></th>
        </tr>
      </thead>

      <tbody>
        ${rows.map(row => `
          <tr>
            <td class="roster-cell">${escapeHtml(row.rosterText)}</td>
            <td>
              <select class="student-situation-select"
                      data-student-situation="${row.student.id}"
                      aria-label="Situação de ${escapeHtml(row.plainName)}">
                ${["Ativo","Remanejando","Desistente"].map(option => `
                  <option value="${option}" ${row.situation === option ? "selected" : ""}>${option}</option>
                `).join("")}
              </select>
            </td>
            <td><strong>${escapeHtml(row.plainName)}</strong></td>
            <td>${escapeHtml(formatDateTime(row.firstAccess))}</td>
            <td>${escapeHtml(formatDateTime(row.lastAccess))}</td>
            <td>${escapeHtml(formatDuration(row.duration))}</td>
            <td>${row.accessed}</td>
            <td><span class="${row.resolved ? "status-ok" : "status-warn"}">${row.resolved}</span></td>
            <td>
              <button class="btn btn-small btn-outline" type="button" data-student-detail="${row.student.id}">
                DETALHES
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  $$("[data-student-situation]",wrap).forEach(select => {
    select.addEventListener("change",() => {
      updateStudentSituation(select.dataset.studentSituation,select.value);
    });
  });

  $$("[data-student-detail]",wrap).forEach(button => {
    button.addEventListener("click",() => openStudentDetails(button.dataset.studentDetail));
  });
}


function updateStudentSituation(studentId,status){
  const allowed = ["Ativo","Remanejando","Desistente"];
  if(!allowed.includes(status)) return;

  const data = loadData();
  const student = data.students.find(item => item.id === studentId);
  if(!student) return;

  student.status = status;
  saveData(data);
  toast(`Situação atualizada para ${status}.`,"success");
  buildReportRows();
}

function openStudentDetails(studentId){
  buildReportRows();

  const row = state.reportRows.find(item => item.student.id === studentId);
  if(!row) return;

  const data = loadData();

  $("#studentDetailsTitle").textContent = `${row.rosterText}. ${row.plainName}`;

  $("#studentDetailsBody").innerHTML = row.submissions.length
    ? row.submissions.map(submission => {
        const activity = data.activities.find(a => a.id === submission.activityId);

        const history = Array.isArray(submission.scratchHistory)
          ? submission.scratchHistory
          : (submission.scratch ? [{
              at:submission.updatedAt || submission.accessedAt,
              text:submission.scratch,
              reason:"rascunho anterior"
            }] : []);

        return `
          <article class="detail-activity">
            <h4>${escapeHtml(activity?.title || "Atividade")}</h4>
            <p><strong>Acesso:</strong> ${escapeHtml(formatDateTime(submission.accessedAt))}</p>
            <p><strong>Tempo ativo:</strong> ${escapeHtml(formatDuration(submission.activeSeconds))}</p>
            <p><strong>Tentativas:</strong> ${submission.attempts || 0} • <strong>Status:</strong> ${submission.resolved ? "Resolvida" : "Em andamento"}</p>

            <div class="scratch-current-box">
              <span>RASCUNHO ATUAL</span>
              <p>${submission.scratch ? escapeHtml(submission.scratch) : "Nenhum rascunho registrado."}</p>
            </div>

            <details class="scratch-history-details">
              <summary>HISTÓRICO DO RASCUNHO (${history.length})</summary>

              <div class="scratch-history-list">
                ${history.length ? history.map((snapshot,index) => `
                  <article class="scratch-history-item">
                    <div class="scratch-history-head">
                      <strong>Versão ${index + 1}</strong>
                      <span>${escapeHtml(formatDateTime(snapshot.at))}</span>
                    </div>
                    <small>${escapeHtml(formatScratchReason(snapshot.reason))}</small>
                    <pre>${escapeHtml(snapshot.text || "")}</pre>
                  </article>
                `).join("") : `
                  <p class="scratch-history-empty">Nenhuma versão do rascunho registrada.</p>
                `}
              </div>
            </details>
          </article>
        `;
      }).join("")
    : "<p>Nenhuma atividade acessada.</p>";

  $("#studentDetailsModal").classList.remove("hidden");
}

function safeSheetName(name){
  return String(name || "Relatorio")
    .replace(/[\\/?*\[\]:]/g," ")
    .trim()
    .slice(0,31) || "Relatorio";
}

function downloadReportXlsx(){
  const classId = $("#reportClassSelect").value;
  const classItem = currentProfessorClasses().find(c => c.id === classId);

  if(!classItem) return toast("Selecione uma turma.","error");

  if(typeof XLSX === "undefined"){
    return toast(
      "Não foi possível carregar o gerador de planilhas. Verifique a conexão e tente novamente.",
      "error"
    );
  }

  const rows = sortedReportRows();
  const data = loadData();

  const participationRows = [
    [
      "Nº",
      "Situação",
      "Aluno",
      "Primeiro acesso",
      "Último acesso",
      "Tempo nos exercícios",
      "Tempo total (segundos)",
      "Atividades acessadas",
      "Atividades resolvidas"
    ],
    ...rows.map(row => [
      row.rosterText,
      row.situation || "Ativo",
      row.plainName,
      formatDateTime(row.firstAccess),
      formatDateTime(row.lastAccess),
      formatDuration(row.duration),
      row.duration,
      row.accessed,
      row.resolved
    ])
  ];

  const activityRows = [[
    "Nº",
    "Situação",
    "Aluno",
    "Atividade",
    "Acesso",
    "Última atualização",
    "Tempo ativo",
    "Tentativas",
    "Status",
    "Resposta final",
    "Rascunho atual",
    "Versões do rascunho"
  ]];

  const historyRows = [[
    "Nº",
    "Aluno",
    "Atividade",
    "Versão",
    "Data/hora",
    "Momento",
    "Conteúdo do rascunho"
  ]];

  rows.forEach(row => {
    row.submissions.forEach(submission => {
      const activity = data.activities.find(item => item.id === submission.activityId);
      const history = Array.isArray(submission.scratchHistory)
        ? submission.scratchHistory
        : (submission.scratch ? [{
            at:submission.updatedAt || submission.accessedAt,
            text:submission.scratch,
            reason:"rascunho anterior"
          }] : []);

      activityRows.push([
        row.rosterText,
        row.situation || "Ativo",
        row.plainName,
        activity?.title || "Atividade",
        formatDateTime(submission.accessedAt),
        formatDateTime(submission.updatedAt),
        formatDuration(submission.activeSeconds),
        Number(submission.attempts || 0),
        submission.resolved ? "Resolvida" : "Em andamento",
        submission.finalAnswer || "",
        submission.scratch || "",
        history.length
      ]);

      history.forEach((snapshot,index) => {
        historyRows.push([
          row.rosterText,
          row.plainName,
          activity?.title || "Atividade",
          index + 1,
          formatDateTime(snapshot.at),
          formatScratchReason(snapshot.reason),
          snapshot.text || ""
        ]);
      });
    });
  });

  const workbook = XLSX.utils.book_new();

  const participationSheet = XLSX.utils.aoa_to_sheet(participationRows);
  const activitySheet = XLSX.utils.aoa_to_sheet(activityRows);
  const historySheet = XLSX.utils.aoa_to_sheet(historyRows);

  participationSheet["!cols"] = [
    {wch:8},{wch:16},{wch:30},{wch:20},{wch:20},
    {wch:22},{wch:20},{wch:20},{wch:20}
  ];

  activitySheet["!cols"] = [
    {wch:8},{wch:16},{wch:28},{wch:34},{wch:20},{wch:20},
    {wch:18},{wch:12},{wch:16},{wch:24},{wch:45},{wch:20}
  ];

  historySheet["!cols"] = [
    {wch:8},{wch:28},{wch:34},{wch:10},{wch:20},{wch:24},{wch:70}
  ];

  XLSX.utils.book_append_sheet(workbook,participationSheet,"Participação");
  XLSX.utils.book_append_sheet(workbook,activitySheet,"Atividades");
  XLSX.utils.book_append_sheet(workbook,historySheet,"Histórico Rascunho");

  const filename = `Relatorio_Participacao_${normalizeClassCode(classItem.name)}_${classItem.year || new Date().getFullYear()}.xlsx`;

  XLSX.writeFile(workbook,filename);
  toast("Planilha de participação gerada com sucesso.","success");
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
function openAuthTab(role,tab){
  if(role === "professor"){
    $$("[data-prof-tab]").forEach(button =>
      button.classList.toggle("active",button.dataset.profTab === tab)
    );

    $("#professorLoginForm").classList.toggle("hidden",tab !== "login");
    $("#professorRegisterForm").classList.toggle("hidden",tab !== "register");
    return;
  }

  $$("[data-student-tab]").forEach(button =>
    button.classList.toggle("active",button.dataset.studentTab === tab)
  );

  $("#studentLoginForm").classList.toggle("hidden",tab !== "login");
  $("#studentRegisterForm").classList.toggle("hidden",tab !== "register");
}

function openProfessorGlobalWorkspace(tab){
  const config = {
    classes:{
      title:"Minhas Turmas",
      subtitle:"Cadastre, edite e organize todas as turmas do professor."
    },
    activities:{
      title:"Atividades",
      subtitle:"Consulte o banco completo de atividades e libere conteúdos para suas turmas."
    },
    reports:{
      title:"Relatórios",
      subtitle:"Acompanhe participação, acessos, conclusões e tempo registrado por turma."
    }
  };

  const selected = config[tab];
  if(!selected) return;

  // O menu superior é global. Por isso ele não depende de uma capa/área selecionada.
  state.currentContext = null;

  $("#workspaceTitle").textContent = selected.title;
  $("#workspaceSubtitle").textContent = selected.subtitle;

  const summary = $("#activityContextSummary");
  if(summary){
    summary.innerHTML = `
      <strong>Banco geral do professor</strong>
      <span>Para importar diretamente em uma área específica, abra primeiro a respectiva capa na tela Início.</span>
    `;
  }

  populateClassSelects();
  renderClassList();
  renderActivityList();

  showScreen("screenWorkspace");
  setWorkspaceTab(tab);
}

function bindEvents(){
  $("#openProfessorAccessBtn").addEventListener("click",() => showScreen("screenProfessorAuth"));
  $("#openStudentAccessBtn").addEventListener("click",() => showScreen("screenStudentAuth"));

  $$("[data-back-landing]").forEach(button => {
    button.addEventListener("click",() => showScreen("screenLanding"));
  });

  $$("[data-prof-tab]").forEach(button => {
    button.addEventListener("click",() => openAuthTab("professor",button.dataset.profTab));
  });

  $$("[data-student-tab]").forEach(button => {
    button.addEventListener("click",() => openAuthTab("student",button.dataset.studentTab));
  });

  $("#professorLoginForm").addEventListener("submit",professorLogin);
  $("#professorRegisterForm").addEventListener("submit",professorRegister);
  $("#studentLoginForm").addEventListener("submit",studentLogin);
  $("#studentRegisterForm").addEventListener("submit",studentRegister);

  $("#logoutBtn").addEventListener("click",logout);
  $("#adminGateForm").addEventListener("submit",submitAdminGate);
  $("#adminGateLogoutBtn").addEventListener("click",logout);

  $("#goHomeBtn").addEventListener("click",() => {
    if(state.role === "professor") showProfessorHome();
    if(state.role === "student") showStudentDashboard();
  });

  $$("[data-nav]").forEach(button => {
    button.addEventListener("click",() => {
      const nav = button.dataset.nav;

      if(nav === "home"){
        showProfessorHome();
        return;
      }

      if(nav === "profile"){
        showProfessorProfile();
        return;
      }

      if(nav === "classes" || nav === "activities" || nav === "reports"){
        openProfessorGlobalWorkspace(nav);
      }
    });
  });

  $$("[data-student-nav]").forEach(button => {
    button.addEventListener("click",showStudentDashboard);
  });

  $("#workspaceBackBtn").addEventListener("click",showProfessorHome);

  $$(".workspace-tab").forEach(button => {
    button.addEventListener("click",() => setWorkspaceTab(button.dataset.workTab));
  });

  $$("[data-open-work]").forEach(button => {
    button.addEventListener("click",() => setWorkspaceTab(button.dataset.openWork));
  });

  $("#classForm").addEventListener("submit",saveClass);

  $("#generateClassCodeBtn").addEventListener("click",() => {
    $("#classCode").value = makeRandomClassCode();
  });

  $("#cancelClassEditBtn").addEventListener("click",resetClassForm);
  $("#openClassObservationsBtn")?.addEventListener("click",() => openClassObservations());
  $("#closeClassObservationsBtn").addEventListener("click",closeClassObservations);
  $("#saveClassObservationsBtn").addEventListener("click",saveClassObservations);
  $("#clearClassObservationsBtn").addEventListener("click",clearClassObservationsFields);

  $("#activityFile").addEventListener("change",event => {
    const file = event.target.files?.[0];
    if(file) processActivityFile(file);
  });

  $("#processActivityFileBtn").addEventListener("click",() => processActivityFile());
  $("#confirmActivityImportBtn").addEventListener("click",confirmActivityImport);
  $("#deleteActivityImportBtn").addEventListener("click",() => {
    resetActivityImport();
    $("#uploadResult").innerHTML = "";
    toast("Importação excluída. Nenhuma atividade foi adicionada.","info");
  });

  const fileDrop = $("#activityFileDrop");

  ["dragenter","dragover"].forEach(eventName => {
    fileDrop.addEventListener(eventName,event => {
      event.preventDefault();
      fileDrop.classList.add("is-dragover");
    });
  });

  ["dragleave","drop"].forEach(eventName => {
    fileDrop.addEventListener(eventName,event => {
      event.preventDefault();
      fileDrop.classList.remove("is-dragover");
    });
  });

  fileDrop.addEventListener("drop",event => {
    const file = event.dataTransfer?.files?.[0];

    if(file){
      processActivityFile(file);
    }
  });

  $("#activitySearch")?.addEventListener("input",debounce(renderActivityList,180));
  $("#activityLevelFilter")?.addEventListener("change",renderActivityList);
  $("#activitySort")?.addEventListener("change",renderActivityList);

  $("#reportClassSelect").addEventListener("change",renderReport);
  $("#reportSort").addEventListener("change",renderReport);
  $("#downloadReportBtn").addEventListener("click",downloadReportXlsx);

  $("#profileBackBtn").addEventListener("click",showProfessorHome);
  $("#changeKeyForm").addEventListener("submit",changeMyAccessKey);
  $("#requireAdminKeyToggle").addEventListener("change",setAdminKeyRequired);

  $("#backToStudentDashboardBtn").addEventListener("click",showStudentDashboard);
  $("#backFromMaterialBtn").addEventListener("click",closeMaterialLab);

  $("#clearStudentComponentFilter").addEventListener("click",() => {
    state.studentContextSlug = null;

    $$(".student-cover-item").forEach(card => {
      card.classList.remove("active");
    });

    const data = loadData();

    const assignedIds = data.assignments
      .filter(item => item.classId === state.student.classId)
      .map(item => item.activityId);

    const items = data.activities.filter(item => assignedIds.includes(item.id));

    renderStudentActivities(items,data,null);
  });

  $("#classObservationsModal").addEventListener("click",event => {
    if(event.target.id === "classObservationsModal") closeClassObservations();
  });

  $("#closeStudentDetailsBtn").addEventListener("click",() => {
    $("#studentDetailsModal").classList.add("hidden");
  });

  window.addEventListener("beforeunload",() => {
    if(state.currentActivity) saveCurrentProgress();
  });
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
async function init(){
  bindEvents();
  setupPasswordToggles();

  $("#classYear").value = new Date().getFullYear();
  $("#classCode").value = makeRandomClassCode();
  state.classObservationDraft = emptyClassObservationData();
  setClassObservationSummary(state.classObservationDraft);

  await restoreSession();
}

document.addEventListener("DOMContentLoaded",init);

/* ============================================================
   ATUALIZAÇÃO PEDAGÓGICA — MATERIAL DOURADO
   ============================================================ */
function createMaterialBoard(dividend,divisor){
  return {
    dividend,
    divisor,
    confirmed:false,
    phase:1,
    available:{M:0,C:0,D:0,U:0},
    groups:Array.from({length:divisor},() => ({M:0,C:0,D:0,U:0})),
    solved:false,
    batchQuantity:{M:1,C:1,D:1,U:1}
  };
}

function materialGroupLayout(groupCount){
  if(groupCount <= 4){
    return {rows:1,columns:groupCount};
  }
  if(groupCount < 12){
    return {rows:2,columns:Math.ceil(groupCount / 2)};
  }
  return {rows:3,columns:Math.ceil(groupCount / 3)};
}

function ensureMaterialContextMenu(){
  let menu = document.getElementById("materialContextMenu");

  if(!menu){
    menu = document.createElement("div");
    menu.id = "materialContextMenu";
    menu.className = "material-context-menu hidden";
    document.body.appendChild(menu);

    document.addEventListener("click",event => {
      if(!menu.contains(event.target)){
        menu.classList.add("hidden");
      }
    });

    window.addEventListener("resize",() => menu.classList.add("hidden"));
    window.addEventListener("scroll",() => menu.classList.add("hidden"),true);
  }

  return menu;
}

function renderPieceVisuals(counts,location="pool",groupIndex=null){
  const board = state.materialBoard;
  const keys = ["M","C","D","U"];
  const totalPieces = keys.reduce((sum,key) => sum + Number(counts[key] || 0),0);

  if(!totalPieces){
    return `<div class="md-empty-pieces">Nenhuma peça</div>`;
  }

  return keys.map(key => {
    const count = Number(counts[key] || 0);
    if(!count) return "";

    const visible = Math.min(count,24);
    const pieces = Array.from({length:visible},(_,index) => {
      const draggable = location === "pool" ? 'draggable="true"' : "";
      const attrs = location === "pool"
        ? `data-drag-piece="${key}" data-piece-context="${key}"`
        : `data-return-piece="${key}" data-return-group="${groupIndex}"`;

      return `
        <button
          type="button"
          class="md-piece md-piece-${key}"
          title="${location === "pool" ? "Arraste para um grupo ou clique com o botão direito para enviar" : "Clique para devolver"}"
          ${draggable}
          ${attrs}
          aria-label="${pieceLabel(key)} ${index+1}"
        ></button>
      `;
    }).join("");

    const remainder = count > visible
      ? `<span class="md-more-pieces">+${count-visible}</span>`
      : "";

    const batchQty = location === "pool"
      ? Math.max(1,Math.min((board?.batchQuantity?.[key] || 1),count))
      : 1;

    const controls = location === "pool"
      ? `
        <div class="md-batch-controls">
          <div class="batch-label">Quantidade para envio rápido com botão direito</div>
          <button type="button" data-md-batch-minus="${key}" aria-label="Diminuir quantidade">−</button>
          <strong>${batchQty}</strong>
          <button type="button" data-md-batch-plus="${key}" aria-label="Aumentar quantidade">+</button>
        </div>
      `
      : "";

    return `
      <div class="md-piece-cluster ${location === "pool" ? "md-piece-cluster-pool" : ""}" ${location === "pool" ? `data-md-pool-cluster="${key}"` : ""}>
        <div class="md-piece-cluster-label">
          <strong>${pieceLabel(key)}</strong>
          <span>${count}</span>
        </div>
        <div class="md-pieces-row">${pieces}${remainder}</div>
        ${controls}
      </div>
    `;
  }).join("");
}

function renderMaterialLab(){
  const board = state.materialBoard;
  const root = $("#materialLabRoot");
  if(!board || !root) return;

  const quotient = board.dividend / board.divisor;
  const integerQuotient = Number.isInteger(quotient);
  const layout = materialGroupLayout(board.groups.length);

  root.innerHTML = `
    <div class="material-lab-steps">
      ${[["1","Representar"],["2","Trocar"],["3","Distribuir"],["4","Conferir"]].map(([number,label],index) => {
        const step = index + 1;
        const status = board.solved ? "done" : step < board.phase ? "done" : step === board.phase ? "active" : "";
        return `
          <div class="material-lab-step ${status}">
            <span>${number}</span>
            <strong>${label}</strong>
          </div>
        `;
      }).join("")}
    </div>

    <section class="material-stage">
      <div class="material-stage-heading">
        <div>
          <span class="stage-number">1</span>
          <div>
            <h2>Represente o dividendo</h2>
            <p>Monte o número ${board.dividend} usando milhar, centena, dezena e unidade.</p>
          </div>
        </div>
      </div>

      <div class="material-white-grid">
        ${[["M","MILHAR","1000"],["C","CENTENA","100"],["D","DEZENA","10"],["U","UNIDADE","1"]].map(([key,label,value]) => `
          <article class="material-white-box">
            <header>
              <div>
                <strong>${label}</strong>
                <span>vale ${value}</span>
              </div>
              <span class="material-piece-count">${board.available[key]}</span>
            </header>

            <div class="material-piece-preview material-preview-${key}">
              <span></span>
            </div>

            <div class="material-count-controls">
              <button type="button" data-md-minus="${key}" aria-label="Retirar ${label.toLowerCase()}">−</button>
              <strong>${board.available[key]}</strong>
              <button type="button" data-md-plus="${key}" aria-label="Adicionar ${label.toLowerCase()}">+</button>
            </div>
          </article>
        `).join("")}
      </div>

      <div class="material-stage-actions">
        <button id="confirmMaterialRepresentationBtn" class="btn btn-primary" type="button">✓ CONFIRMAR REPRESENTAÇÃO ?</button>
        <button id="resetMaterialRepresentationBtn" class="btn btn-outline" type="button">Refazer representação</button>
      </div>
    </section>

    ${board.confirmed ? `
      <section class="material-workspace-grid">
        <aside class="material-stage material-exchange-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">2</span>
              <div>
                <h2>Trocas</h2>
                <p>Faça trocas sem alterar o valor representado.</p>
              </div>
            </div>
          </div>

          <div class="exchange-lines">
            <button type="button" class="exchange-line" data-md-exchange="M-C">
              <strong>1 milhar → 10 centenas</strong>
              <small>Transforme uma peça de milhar em centenas.</small>
            </button>
            <button type="button" class="exchange-line" data-md-exchange="C-D">
              <strong>1 centena → 10 dezenas</strong>
              <small>Transforme uma peça de centena em dezenas.</small>
            </button>
            <button type="button" class="exchange-line" data-md-exchange="D-U">
              <strong>1 dezena → 10 unidades</strong>
              <small>Transforme uma peça de dezena em unidades.</small>
            </button>
            <button type="button" class="exchange-line" data-md-exchange="U-D">
              <strong>10 unidades → 1 dezena</strong>
              <small>Reagrupe dez unidades em uma dezena.</small>
            </button>
          </div>

          <div class="material-pool-card">
            <div class="material-pool-heading">
              <div>
                <strong>Peças disponíveis</strong>
                <small>Arraste uma peça até um grupo ou clique com o botão direito em uma peça para escolher para qual grupo enviar a quantidade selecionada.</small>
              </div>
              <span>${materialCountsValue(board.available)}</span>
            </div>

            <div id="materialPiecePool" class="material-pool-pieces">
              ${renderPieceVisuals(board.available,"pool")}
            </div>
          </div>
        </aside>

        <section class="material-stage material-distribution-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">3</span>
              <div>
                <h2>Distribua entre ${board.divisor} grupos</h2>
                <p>Organize os grupos em partes iguais. Quando houver muitos grupos, use a rolagem para manter a leitura confortável.</p>
              </div>
            </div>
            <div class="divisor-chip">
              <span>DIVISOR</span>
              <strong>${board.divisor}</strong>
            </div>
          </div>

          <div class="material-groups-scroll">
            <div
              class="material-groups-grid"
              style="--md-group-columns:${layout.columns}; min-width:${layout.columns * 286 + Math.max(0,layout.columns - 1) * 14}px;"
            >
              ${board.groups.map((group,index) => `
                <article class="material-group-white" data-material-group="${index}">
                  <header>
                    <div>
                      <strong>Grupo ${index+1}</strong>
                      <span>Valor: ${materialCountsValue(group)}</span>
                    </div>
                    <small>M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}</small>
                  </header>

                  <div class="material-group-pieces">
                    ${renderPieceVisuals(group,"group",index)}
                  </div>

                  <div class="material-group-drop-note">Arraste peças até aqui. Para devolver, clique em uma peça dentro do grupo.</div>
                </article>
              `).join("")}
            </div>
          </div>

          <div class="material-stage-actions">
            <button id="checkMaterialDistributionBtn" class="btn btn-primary" type="button">✓ CONFERIR O RESULTADO</button>
            <button id="collectMaterialPiecesBtn" class="btn btn-outline" type="button">↺ Recolher todas as peças</button>
            <button id="restartMaterialLabBtn" class="btn btn-outline" type="button">Refazer tudo</button>
          </div>

          <div id="materialDistributionFeedback" class="material-message">
            ${board.solved
              ? `<strong>Parabéns!</strong> Você distribuiu as peças igualmente.`
              : `Distribua as peças entre os grupos e use a conferência para revisar sua estratégia.`}
          </div>

          ${board.solved ? `
            <div class="material-solved-panel">
              <div>
                <span>RESULTADO</span>
                <strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong>
              </div>
              <button id="useMaterialResultBtn" class="btn btn-success" type="button">USAR RESULTADO NO EXERCÍCIO</button>
            </div>
          ` : ""}
        </section>
      </section>
    ` : ""}
  `;

  bindMaterialLabEvents();
}

function openMaterialContextMenu(key,x,y){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if((board.available[key] || 0) <= 0) return;

  const menu = ensureMaterialContextMenu();
  const qty = Math.max(1,Math.min(board.batchQuantity[key] || 1, board.available[key] || 1));

  menu.innerHTML = `
    <div class="material-context-title">Enviar <strong>${qty}</strong> peça(s) de ${pieceLabel(key).toLowerCase()} para:</div>
    <div class="material-context-options">
      ${board.groups.map((group,index) => `<button type="button" data-context-send="${key}" data-context-group="${index}" data-context-qty="${qty}">Grupo ${index+1}</button>`).join("")}
    </div>
  `;

  menu.style.left = `${Math.min(x,window.innerWidth - 340)}px`;
  menu.style.top = `${Math.min(y,window.innerHeight - 260)}px`;
  menu.classList.remove("hidden");

  $$('[data-context-send]',menu).forEach(button => {
    button.addEventListener('click',event => {
      event.stopPropagation();
      moveMaterialPieceToGroup(button.dataset.contextSend,Number(button.dataset.contextGroup),Number(button.dataset.contextQty));
      menu.classList.add('hidden');
    });
  });
}

function bindMaterialLabEvents(){
  const board = state.materialBoard;
  if(!board) return;

  $("#confirmMaterialRepresentationBtn")?.addEventListener("click",() => {
    const value = materialCountsValue(board.available);
    if(value !== board.dividend){
      return toast(`A representação vale ${value}. Monte exatamente ${board.dividend}.`,`error`);
    }
    board.confirmed = true;
    board.phase = 2;
    renderMaterialLab();
    toast("Representação correta. Agora faça trocas e distribua as peças.","success");
  });

  $("#resetMaterialRepresentationBtn")?.addEventListener("click",() => {
    state.materialBoard = createMaterialBoard(board.dividend,board.divisor);
    renderMaterialLab();
  });

  $$('[data-md-plus]').forEach(button => {
    button.addEventListener('click',() => {
      const key = button.dataset.mdPlus;
      board.available[key] += 1;
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      renderMaterialLab();
    });
  });

  $$('[data-md-minus]').forEach(button => {
    button.addEventListener('click',() => {
      const key = button.dataset.mdMinus;
      board.available[key] = Math.max(0,board.available[key] - 1);
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      renderMaterialLab();
    });
  });

  $$('[data-md-batch-plus]').forEach(button => {
    button.addEventListener('click',() => {
      const key = button.dataset.mdBatchPlus;
      const max = Math.max(1,board.available[key] || 1);
      board.batchQuantity[key] = Math.min(max,(board.batchQuantity[key] || 1) + 1);
      renderMaterialLab();
    });
  });

  $$('[data-md-batch-minus]').forEach(button => {
    button.addEventListener('click',() => {
      const key = button.dataset.mdBatchMinus;
      board.batchQuantity[key] = Math.max(1,(board.batchQuantity[key] || 1) - 1);
      renderMaterialLab();
    });
  });

  $$('[data-md-exchange]').forEach(button => {
    button.addEventListener('click',() => applyMaterialExchange(button.dataset.mdExchange));
  });

  $$('[data-return-piece]').forEach(button => {
    button.addEventListener('click',() => {
      returnMaterialPieceToPool(button.dataset.returnPiece,Number(button.dataset.returnGroup));
    });
  });

  $$('[data-drag-piece]').forEach(piece => {
    piece.addEventListener('dragstart',event => {
      const key = piece.dataset.dragPiece;
      const quantity = Math.max(
        1,
        Math.min(
          Number(board.batchQuantity?.[key] || 1),
          Number(board.available?.[key] || 1)
        )
      );

      event.dataTransfer.setData('text/material-piece',key);
      event.dataTransfer.setData('text/material-count',String(quantity));
      event.dataTransfer.effectAllowed = 'move';
    });

    piece.addEventListener('contextmenu',event => {
      event.preventDefault();
      openMaterialContextMenu(piece.dataset.pieceContext,event.clientX,event.clientY);
    });
  });

  $$('[data-md-pool-cluster]').forEach(cluster => {
    cluster.addEventListener('contextmenu',event => {
      event.preventDefault();
      openMaterialContextMenu(cluster.dataset.mdPoolCluster,event.clientX,event.clientY);
    });
  });

  $$('[data-material-group]').forEach(group => {
    group.addEventListener('dragover',event => {
      event.preventDefault();
      group.classList.add('is-dragover');
    });

    group.addEventListener('dragleave',() => group.classList.remove('is-dragover'));

    group.addEventListener('drop',event => {
      event.preventDefault();
      group.classList.remove('is-dragover');
      const key = event.dataTransfer.getData('text/material-piece');
      const count = Number(event.dataTransfer.getData('text/material-count') || 1);
      const index = Number(group.dataset.materialGroup);

      if(key){
        moveMaterialPieceToGroup(key,index,count);
      }
    });
  });

  $("#collectMaterialPiecesBtn")?.addEventListener('click',() => {
    board.groups.forEach(group => {
      ['M','C','D','U'].forEach(key => {
        board.available[key] += group[key];
        group[key] = 0;
      });
    });
    board.phase = 2;
    board.solved = false;
    renderMaterialLab();
  });

  $("#restartMaterialLabBtn")?.addEventListener('click',() => {
    state.materialBoard = createMaterialBoard(board.dividend,board.divisor);
    renderMaterialLab();
  });

  $("#checkMaterialDistributionBtn")?.addEventListener('click',checkMaterialDistribution);

  $("#useMaterialResultBtn")?.addEventListener('click',() => {
    const quotient = board.dividend / board.divisor;
    closeMaterialLab();
    const answerInput = $("#studentFinalAnswer");
    if(answerInput){
      answerInput.value = String(quotient);
      answerInput.focus();
    }
    toast('Resultado transferido para a resposta final. Revise e envie.','success');
  });
}

function applyMaterialExchange(action){
  const board = state.materialBoard;
  if(!board) return;
  const pool = board.available;
  let valid = true;

  if(action === 'M-C' && pool.M >= 1){
    pool.M -= 1;
    pool.C += 10;
  }else if(action === 'C-D' && pool.C >= 1){
    pool.C -= 1;
    pool.D += 10;
  }else if(action === 'D-U' && pool.D >= 1){
    pool.D -= 1;
    pool.U += 10;
  }else if(action === 'U-D' && pool.U >= 10){
    pool.U -= 10;
    pool.D += 1;
  }else{
    valid = false;
  }

  if(!valid){
    return toast('Não há peças suficientes para realizar essa troca.','error');
  }

  board.phase = Math.max(board.phase,2);
  board.solved = false;
  renderMaterialLab();
}

function moveMaterialPieceToGroup(key,index,count=1){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if(!['M','C','D','U'].includes(key)) return;
  if(!board.groups[index]) return;

  const amount = Math.max(1,Math.min(Number(count) || 1, board.available[key] || 0));
  if(amount <= 0){
    return toast(`Não há ${pieceLabel(key).toLowerCase()} disponível.`, 'error');
  }

  board.available[key] -= amount;
  board.groups[index][key] += amount;
  board.phase = Math.max(board.phase,3);
  board.solved = false;
  renderMaterialLab();
}

function returnMaterialPieceToPool(key,index){
  const board = state.materialBoard;
  if(!board || !board.groups[index]) return;
  if(board.groups[index][key] <= 0) return;
  board.groups[index][key] -= 1;
  board.available[key] += 1;
  board.solved = false;
  renderMaterialLab();
}

function checkMaterialDistribution(){
  const board = state.materialBoard;
  if(!board) return;

  const quotient = board.dividend / board.divisor;
  const poolValue = materialCountsValue(board.available);
  const values = board.groups.map(materialCountsValue);
  const allEqual = values.every(value => value === quotient);
  const correctTotal = materialTotalValue(board) === board.dividend;

  if(Number.isInteger(quotient) && poolValue === 0 && allEqual && correctTotal){
    board.phase = 4;
    board.solved = true;
    renderMaterialLab();
    toast('Distribuição correta. Parabéns!','success');
    return;
  }

  if(!Number.isInteger(quotient)){
    const feedback = $("#materialDistributionFeedback");
    if(feedback){
      feedback.innerHTML =
        "Continue usando as peças para representar sua estratégia. Esta atividade poderá ser revisada posteriormente pelo professor.";
    }
    toast("Revise a distribuição com a orientação do professor.","info");
    return;
  }

  const feedback = $("#materialDistributionFeedback");
  if(feedback){
    if(poolValue > 0){
      feedback.innerHTML = `Ainda existem peças fora dos grupos. Continue distribuindo até usar todas elas.`;
    }else{
      feedback.innerHTML = `Os grupos ainda não têm o mesmo valor. Revise a distribuição ou faça novas trocas.`;
    }
  }

  toast('A distribuição ainda precisa ser ajustada.','error');
}


/* ============================================================
   PROJETO EDUCACIONAL 7.0 — MATERIAL DOURADO TELA CHEIA
   Atualização consolidada 14/10/2026
   ============================================================ */

function deepCloneMaterial(value){
  return JSON.parse(JSON.stringify(value));
}

function createMaterialBoard(dividend,divisor){
  return {
    dividend:Number(dividend),
    divisor:Number(divisor),
    confirmed:false,
    phase:1,
    available:{M:0,C:0,D:0,U:0},
    groups:Array.from({length:Number(divisor)},() => ({M:0,C:0,D:0,U:0})),
    solved:false,
    batchQuantity:{M:1,C:1,D:1,U:1},
    history:[]
  };
}

function normalizeMaterialBoard(board,dividend,divisor){
  if(!board || Number(board.dividend) !== Number(dividend) || Number(board.divisor) !== Number(divisor)){
    return createMaterialBoard(dividend,divisor);
  }

  const normalized = createMaterialBoard(dividend,divisor);
  normalized.confirmed = Boolean(board.confirmed);
  normalized.phase = Math.max(1,Number(board.phase || 1));
  normalized.solved = Boolean(board.solved);

  ["M","C","D","U"].forEach(key => {
    normalized.available[key] = Math.max(0,Number(board.available?.[key] || 0));
    normalized.batchQuantity[key] = Math.max(1,Number(board.batchQuantity?.[key] || 1));
  });

  if(Array.isArray(board.groups)){
    normalized.groups = Array.from({length:Number(divisor)},(_,index) => {
      const source = board.groups[index] || {};
      return {
        M:Math.max(0,Number(source.M || 0)),
        C:Math.max(0,Number(source.C || 0)),
        D:Math.max(0,Number(source.D || 0)),
        U:Math.max(0,Number(source.U || 0))
      };
    });
  }

  normalized.history = Array.isArray(board.history)
    ? board.history.slice(-250)
    : [];

  return normalized;
}

function serializeMaterialBoard(board=state.materialBoard){
  if(!board) return null;

  return {
    dividend:Number(board.dividend),
    divisor:Number(board.divisor),
    confirmed:Boolean(board.confirmed),
    phase:Number(board.phase || 1),
    solved:Boolean(board.solved),
    available:{
      M:Number(board.available?.M || 0),
      C:Number(board.available?.C || 0),
      D:Number(board.available?.D || 0),
      U:Number(board.available?.U || 0)
    },
    groups:(board.groups || []).map(group => ({
      M:Number(group.M || 0),
      C:Number(group.C || 0),
      D:Number(group.D || 0),
      U:Number(group.U || 0)
    })),
    batchQuantity:{
      M:Number(board.batchQuantity?.M || 1),
      C:Number(board.batchQuantity?.C || 1),
      D:Number(board.batchQuantity?.D || 1),
      U:Number(board.batchQuantity?.U || 1)
    },
    history:Array.isArray(board.history) ? board.history.slice(-250) : []
  };
}

function getSavedMaterialBoard(dividend,divisor){
  const data = loadData();
  const submission = getCurrentSubmission(data);
  const raw = submission?.materialProgress?.board || submission?.materialProgress || null;

  if(!raw) return null;
  return normalizeMaterialBoard(raw,dividend,divisor);
}

function compactMaterialSnapshot(board=state.materialBoard){
  if(!board) return null;

  return {
    pool:{...board.available},
    groupValues:board.groups.map(group => materialCountsValue(group)),
    phase:board.phase,
    solved:Boolean(board.solved)
  };
}

function recordMaterialMovement(action,details={}){
  const board = state.materialBoard;
  if(!board) return;

  if(!Array.isArray(board.history)) board.history = [];

  board.history.push({
    at:new Date().toISOString(),
    action,
    details,
    state:compactMaterialSnapshot(board)
  });

  if(board.history.length > 250){
    board.history = board.history.slice(-250);
  }

  // Na tela normal, as movimentações são protegidas automaticamente.
  // Nos ambientes full-screen, o aluno escolhe ao sair se deseja salvar.
  if(!state.materialFullscreenMode){
    saveMaterialProgress(action);
  }
}

function saveMaterialProgress(reason="progresso"){
  if(!state.student || !state.currentActivity || !state.materialBoard) return;

  const data = loadData();
  const submission = getCurrentSubmission(data);
  if(!submission) return;

  submission.materialProgress = {
    board:serializeMaterialBoard(state.materialBoard),
    savedAt:new Date().toISOString(),
    reason
  };
  submission.updatedAt = new Date().toISOString();

  saveData(data);
}

function setMaterialFullscreenSnapshot(mode){
  state.materialFullscreenMode = mode;
  state.materialFullscreenSnapshot = deepCloneMaterial(serializeMaterialBoard(state.materialBoard));
}

function clearMaterialFullscreenState(){
  state.materialFullscreenMode = null;
  state.materialFullscreenSnapshot = null;
  state.materialExitSource = null;
}

function hideMaterialFullscreenOverlays(){
  $("#materialRepresentationFullscreen")?.classList.add("hidden");
  $("#materialWorkspaceFullscreen")?.classList.add("hidden");
  $("#materialExitModal")?.classList.add("hidden");
  document.body.classList.remove("material-overlay-open");
}

function openMaterialLab(){
  const item = state.currentActivity;
  if(!item) return;

  saveCurrentProgress();

  const {dividend,divisor} = inferMaterialOperands(item);
  state.materialBoard =
    getSavedMaterialBoard(dividend,divisor) ||
    createMaterialBoard(dividend,divisor);

  $("#materialLabTitle").textContent = item.title || "Divisão com Material Dourado";
  $("#materialLabStatement").textContent = item.statement || "";
  $("#materialLabOperation").textContent = `${dividend} ÷ ${divisor}`;
  $("#materialLabQuestion").textContent = item.question || "";

  renderMaterialLab();
  showScreen("screenMaterialLab");
}

function closeMaterialLab(){
  saveMaterialProgress("voltar ao exercício");
  hideMaterialFullscreenOverlays();
  clearMaterialFullscreenState();
  showScreen("screenStudentActivity");
  $("#activityTimerDisplay").textContent = timerText(state.activeSeconds);
  autoGrowScratchField();
}

function premiumPieceMarkup(key,count){
  const safeCount = Math.max(0,Number(count || 0));
  const maxVisible = key === "D" ? 10 : key === "U" ? 12 : 4;
  const visible = Math.min(safeCount,maxVisible);

  if(!safeCount){
    return `<div class="gold3d gold3d-${key} gold3d-ghost" aria-hidden="true"></div>`;
  }

  const pieces = Array.from({length:visible},() =>
    `<div class="gold3d gold3d-${key}" aria-hidden="true"></div>`
  ).join("");

  const extra = safeCount > visible
    ? `<span class="md-more-pieces">+${safeCount-visible}</span>`
    : "";

  return `${pieces}${extra}`;
}

function renderRepresentationFullscreen(){
  const board = state.materialBoard;
  const root = $("#materialRepresentationFullscreenRoot");
  if(!board || !root) return;

  const representedValue = materialCountsValue(board.available);
  const correct = representedValue === board.dividend;

  root.innerHTML = `
    <div class="material-fs-shell">
      <header class="material-fs-header">
        <div class="material-fs-title">
          <span class="kicker">DIVISÃO COM MATERIAL DOURADO</span>
          <h1>Represente o dividendo</h1>
          <p>Monte ${board.dividend} usando milhar, centena, dezena e unidade.</p>
        </div>

        <div class="material-fs-header-actions">
          <div class="material-fs-chip">
            <span>DIVISOR</span>
            <strong>${board.divisor}</strong>
          </div>
          <button id="repBackExerciseBtn" class="material-fs-button" type="button">VOLTAR AO EXERCÍCIO</button>
          <button id="repExitBtn" class="material-fs-button danger" type="button">SAIR</button>
        </div>
      </header>

      <section class="material-fs-section">
        <div class="material-fs-section-heading">
          <div>
            <h2>Peças disponíveis para representar</h2>
            <p>Use os botões + e −. As peças foram ampliadas para facilitar a leitura e a manipulação.</p>
          </div>

          <div class="material-fs-target">
            <span>Número a representar</span>
            <strong>${board.dividend}</strong>
          </div>
        </div>

        <div class="premium-representation-grid">
          ${[
            ["M","MILHAR","1000"],
            ["C","CENTENA","100"],
            ["D","DEZENA","10"],
            ["U","UNIDADE","1"]
          ].map(([key,label,value]) => `
            <article class="premium-piece-card">
              <header>
                <strong>${label}</strong>
                <span>vale ${value}</span>
              </header>

              <div class="premium-art-stage">
                <div class="premium-art-items">
                  ${premiumPieceMarkup(key,board.available[key])}
                </div>
              </div>

              <div class="premium-count-controls">
                <button type="button" data-fs-rep-minus="${key}" aria-label="Retirar ${label.toLowerCase()}">−</button>
                <strong>${board.available[key]} peça(s)</strong>
                <button type="button" data-fs-rep-plus="${key}" aria-label="Adicionar ${label.toLowerCase()}">+</button>
              </div>
            </article>
          `).join("")}
        </div>

        <div class="material-fs-status ${correct ? "" : "is-pending"}">
          <span>${correct ? "Representação pronta para confirmação." : "Monte o número e confirme quando terminar."}</span>
        </div>

        <div class="material-fs-footer-actions">
          <button id="repResetBtn" class="material-fs-button" type="button">REFAZER REPRESENTAÇÃO</button>
          <button id="repConfirmBtn" class="material-fs-button primary" type="button">✓ CONFIRMAR REPRESENTAÇÃO ?</button>
          <button id="repBackExerciseBottomBtn" class="material-fs-button" type="button">VOLTAR AO EXERCÍCIO</button>
          <button id="repExitBottomBtn" class="material-fs-button danger" type="button">SAIR</button>
        </div>
      </section>
    </div>
  `;

  bindRepresentationFullscreenEvents(root);
}

function openRepresentationFullscreen(){
  if(!state.materialBoard) return;

  setMaterialFullscreenSnapshot("representation");
  $("#materialRepresentationFullscreen")?.classList.remove("hidden");
  document.body.classList.add("material-overlay-open");
  renderRepresentationFullscreen();
}

function bindRepresentationFullscreenEvents(root){
  const board = state.materialBoard;
  if(!board) return;

  root.querySelectorAll("[data-fs-rep-plus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.fsRepPlus;
      board.available[key] += 1;
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      recordMaterialMovement("adicionar peça na representação",{piece:key});
      renderRepresentationFullscreen();
    });
  });

  root.querySelectorAll("[data-fs-rep-minus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.fsRepMinus;
      board.available[key] = Math.max(0,board.available[key] - 1);
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      recordMaterialMovement("retirar peça da representação",{piece:key});
      renderRepresentationFullscreen();
    });
  });

  $("#repResetBtn")?.addEventListener("click",() => {
    board.available = {M:0,C:0,D:0,U:0};
    board.confirmed = false;
    board.phase = 1;
    board.solved = false;
    recordMaterialMovement("refazer representação");
    renderRepresentationFullscreen();
  });

  $("#repConfirmBtn")?.addEventListener("click",() => {
    const represented = materialCountsValue(board.available);

    if(represented !== board.dividend){
      return toast(`A representação vale ${represented}. Monte exatamente ${board.dividend}.`,"error");
    }

    board.confirmed = true;
    board.phase = Math.max(2,board.phase);
    board.solved = false;
    recordMaterialMovement("confirmar representação",{value:represented});
    saveMaterialProgress("representação confirmada");

    $("#materialRepresentationFullscreen")?.classList.add("hidden");
    clearMaterialFullscreenState();
    document.body.classList.remove("material-overlay-open");
    renderMaterialLab();
    toast("Representação correta. Agora faça trocas e distribua as peças.","success");
  });

  const backToExercise = () => {
    saveMaterialProgress("voltar ao exercício pela representação");
    hideMaterialFullscreenOverlays();
    clearMaterialFullscreenState();
    showScreen("screenStudentActivity");
    autoGrowScratchField();
  };

  $("#repBackExerciseBtn")?.addEventListener("click",backToExercise);
  $("#repBackExerciseBottomBtn")?.addEventListener("click",backToExercise);

  $("#repExitBtn")?.addEventListener("click",() => openMaterialExitDialog("representation"));
  $("#repExitBottomBtn")?.addEventListener("click",() => openMaterialExitDialog("representation"));
}

function renderMaterialLab(){
  const board = state.materialBoard;
  const root = $("#materialLabRoot");
  if(!board || !root) return;

  const quotient = board.dividend / board.divisor;
  const layout = materialGroupLayout(board.groups.length);

  root.innerHTML = `
    <div class="material-lab-steps">
      <button id="openRepresentationStepBtn"
              class="material-lab-step material-lab-step-button ${board.confirmed ? "done" : "active"}"
              type="button">
        <span>1</span>
        <strong>Representar</strong>
      </button>

      ${[
        ["2","Trocar"],
        ["3","Distribuir"],
        ["4","Conferir"]
      ].map(([number,label],index) => {
        const step = index + 2;
        const status = board.solved ? "done" : step < board.phase ? "done" : step === board.phase ? "active" : "";
        return `
          <div class="material-lab-step ${status}">
            <span>${number}</span>
            <strong>${label}</strong>
          </div>
        `;
      }).join("")}
    </div>

    <section class="material-stage material-launch-stage">
      <div class="material-launch-copy">
        <div class="material-stage-heading compact">
          <div>
            <span class="stage-number">1</span>
            <div>
              <h2>Representação do dividendo</h2>
              <p>Abra a representação em tela cheia para montar ${board.dividend} com Material Dourado.</p>
            </div>
          </div>
        </div>

        <div class="material-launch-summary">
          <span>Dividendo: ${board.dividend}</span>
          <span>Divisor: ${board.divisor}</span>
          <span>${board.confirmed ? "Representação confirmada" : "Representação pendente"}</span>
        </div>
      </div>

      <button id="openRepresentationFullscreenBtn" class="btn btn-primary" type="button">
        ${board.confirmed ? "REVISAR REPRESENTAÇÃO EM TELA CHEIA" : "REPRESENTAR EM TELA CHEIA"}
      </button>
    </section>

    ${board.confirmed ? `
      <div class="material-fullscreen-launch">
        <button id="openMaterialWorkspaceFullscreenBtn" class="btn btn-primary" type="button">
          REALIZAR TROCAS E DISTRIBUIÇÃO NOS GRUPOS EM TELA CHEIA
        </button>
      </div>

      <section class="material-workspace-grid">
        <aside class="material-stage material-exchange-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">2</span>
              <div>
                <h2>Trocas</h2>
                <p>Faça trocas sem alterar o valor representado.</p>
              </div>
            </div>
          </div>

          <div class="exchange-lines">
            <button type="button" class="exchange-line" data-md-exchange="M-C">
              <strong>1 milhar → 10 centenas</strong>
              <small>Transforme uma peça de milhar em centenas.</small>
            </button>

            <button type="button" class="exchange-line" data-md-exchange="C-D">
              <strong>1 centena → 10 dezenas</strong>
              <small>Transforme uma peça de centena em dezenas.</small>
            </button>

            <button type="button" class="exchange-line" data-md-exchange="D-U">
              <strong>1 dezena → 10 unidades</strong>
              <small>Transforme uma peça de dezena em unidades.</small>
            </button>

            <button type="button" class="exchange-line" data-md-exchange="U-D">
              <strong>10 unidades → 1 dezena</strong>
              <small>Reagrupe dez unidades em uma dezena.</small>
            </button>
          </div>

          <div class="material-pool-card">
            <div class="material-pool-heading">
              <div>
                <strong>Peças disponíveis</strong>
                <small>
                  Arraste uma peça até um grupo ou clique com o botão direito
                  em uma peça para escolher o grupo de destino.
                </small>
              </div>
              <span>${materialCountsValue(board.available)}</span>
            </div>

            <div class="material-pool-pieces">
              ${renderPieceVisuals(board.available,"pool")}
            </div>
          </div>
        </aside>

        <section class="material-stage material-distribution-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">3</span>
              <div>
                <h2>Distribua entre ${board.divisor} grupos</h2>
                <p>Organize os grupos em partes iguais. A área usa toda a largura disponível.</p>
              </div>
            </div>

            <div class="divisor-chip">
              <span>DIVISOR</span>
              <strong>${board.divisor}</strong>
            </div>
          </div>

          <div class="material-groups-scroll">
            <div class="material-groups-grid"
                 style="--md-group-columns:${layout.columns}; min-width:${layout.columns * 286 + Math.max(0,layout.columns - 1) * 14}px;">
              ${board.groups.map((group,index) => `
                <article class="material-group-white" data-material-group="${index}">
                  <header>
                    <div>
                      <strong>Grupo ${index+1}</strong>
                      <span>Valor: ${materialCountsValue(group)}</span>
                    </div>
                    <small>M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}</small>
                  </header>

                  <div class="material-group-pieces">
                    ${renderPieceVisuals(group,"group",index)}
                  </div>

                  <div class="material-group-drop-note">
                    Arraste peças até aqui. Para devolver, clique em uma peça dentro do grupo.
                  </div>
                </article>
              `).join("")}
            </div>
          </div>

          <div class="material-stage-actions material-bottom-actions">
            <button id="checkMaterialDistributionBtn" class="btn btn-primary" type="button">✓ CONFERIR O RESULTADO</button>
            <button id="collectMaterialPiecesBtn" class="btn btn-outline" type="button">↺ Recolher todas as peças</button>
            <button id="restartMaterialLabBtn" class="btn btn-outline" type="button">Refazer tudo</button>
            <button id="backToExerciseFromGroupsBtn" class="btn btn-outline" type="button">VOLTAR AO EXERCÍCIO</button>
          </div>

          <div id="materialDistributionFeedback" class="material-message">
            ${board.solved
              ? `<strong>Parabéns!</strong> Você distribuiu as peças igualmente.`
              : `Distribua as peças entre os grupos e use a conferência para revisar sua estratégia.`}
          </div>

          ${board.solved ? `
            <div class="material-solved-panel">
              <div>
                <span>RESULTADO</span>
                <strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong>
              </div>
              <button id="useMaterialResultBtn" class="btn btn-success" type="button">USAR RESULTADO NO EXERCÍCIO</button>
            </div>
          ` : ""}
        </section>
      </section>
    ` : ""}
  `;

  bindMaterialControls(root,"normal");
}

function renderMaterialWorkspaceFullscreen(){
  const board = state.materialBoard;
  const root = $("#materialWorkspaceFullscreenRoot");
  if(!board || !root) return;

  const layout = materialGroupLayout(board.groups.length);
  const quotient = board.dividend / board.divisor;

  root.innerHTML = `
    <div class="material-fs-shell">
      <header class="material-fs-header">
        <div class="material-fs-title">
          <span class="kicker">MATERIAL DOURADO — TELA AMPLIADA</span>
          <h1>Trocas e distribuição nos grupos</h1>
          <p>Faça as trocas, escolha a quantidade e distribua as peças com mais espaço visual.</p>
        </div>

        <div class="material-fs-header-actions">
          <div class="material-fs-chip">
            <span>DIVIDENDO</span>
            <strong>${board.dividend}</strong>
          </div>
          <div class="material-fs-chip">
            <span>DIVISOR</span>
            <strong>${board.divisor}</strong>
          </div>
          <button id="workspaceBackNormalBtn" class="material-fs-button" type="button">VOLTAR À TELA NORMAL</button>
          <button id="workspaceBackExerciseTopBtn" class="material-fs-button" type="button">VOLTAR AO EXERCÍCIO</button>
          <button id="workspaceExitBtn" class="material-fs-button danger" type="button">SAIR</button>
        </div>
      </header>

      <div class="material-fs-workspace">
        <aside class="material-fs-exchanges">
          <div class="material-fs-panel-title">
            <div>
              <h2>2. Trocas</h2>
              <p>Faça trocas sem alterar o valor representado.</p>
            </div>
          </div>

          <div class="premium-exchange-list">
            ${[
              ["M-C","1 milhar","10 centenas","Transforme uma peça de milhar em centenas."],
              ["C-D","1 centena","10 dezenas","Transforme uma peça de centena em dezenas."],
              ["D-U","1 dezena","10 unidades","Transforme uma peça de dezena em unidades."],
              ["U-D","10 unidades","1 dezena","Reagrupe dez unidades em uma dezena."]
            ].map(([action,from,to,desc]) => `
              <button type="button" class="premium-exchange-button" data-md-exchange="${action}">
                <div>
                  <strong>${from}</strong>
                  <small>${desc}</small>
                </div>
                <span class="arrow">→</span>
                <strong>${to}</strong>
              </button>
            `).join("")}
          </div>

          <div class="material-fs-pool">
            <div class="material-pool-heading">
              <div>
                <strong>Peças disponíveis</strong>
                <small>
                  Selecione a quantidade para envio rápido. Arraste as peças
                  ou use o botão direito para escolher o grupo.
                </small>
              </div>
              <span>${materialCountsValue(board.available)}</span>
            </div>

            <div class="material-pool-pieces">
              ${renderPieceVisuals(board.available,"pool")}
            </div>
          </div>
        </aside>

        <section class="material-fs-groups-panel">
          <div class="material-fs-panel-title">
            <div>
              <h2>3. Distribua entre ${board.divisor} grupos</h2>
              <p>Os cartões se ajustam ao número de grupos e preservam a legibilidade.</p>
            </div>
          </div>

          <div class="material-fs-groups-scroll">
            <div class="material-fs-groups-grid"
                 style="--md-group-columns:${layout.columns}; min-width:${layout.columns * 257 + Math.max(0,layout.columns - 1) * 12}px;">
              ${board.groups.map((group,index) => `
                <article class="material-group-white" data-material-group="${index}">
                  <header>
                    <div>
                      <strong>Grupo ${index+1}</strong>
                      <span>Valor: ${materialCountsValue(group)}</span>
                    </div>
                    <small>M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}</small>
                  </header>

                  <div class="material-group-pieces">
                    ${renderPieceVisuals(group,"group",index)}
                  </div>

                  <div class="material-group-drop-note">
                    Arraste as peças até aqui. Clique em uma peça do grupo para devolvê-la.
                  </div>
                </article>
              `).join("")}
            </div>
          </div>

          <div class="material-fs-controls">
            <button id="fsCheckMaterialDistributionBtn" class="material-fs-button primary" type="button">✓ CONFERIR O RESULTADO</button>
            <button id="fsCollectMaterialPiecesBtn" class="material-fs-button" type="button">↺ RECOLHER TODAS AS PEÇAS</button>
            <button id="fsRestartMaterialLabBtn" class="material-fs-button" type="button">REFAZER TUDO</button>
            <button id="workspaceBackExerciseBottomBtn" class="material-fs-button gold" type="button">VOLTAR AO EXERCÍCIO</button>
          </div>

          <div id="fsMaterialDistributionFeedback" class="material-fs-feedback">
            ${board.solved
              ? `<strong>Parabéns!</strong> A distribuição foi conferida.`
              : `Distribua as peças entre os grupos e use a conferência para revisar sua estratégia.`}
          </div>

          ${board.solved ? `
            <div class="material-fs-result">
              <div>
                <span>RESULTADO</span>
                <strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong>
              </div>
              <button id="fsUseMaterialResultBtn" class="material-fs-button primary" type="button">USAR RESULTADO NO EXERCÍCIO</button>
            </div>
          ` : ""}
        </section>
      </div>
    </div>
  `;

  bindMaterialControls(root,"fullscreen");
}

function openMaterialWorkspaceFullscreen(){
  const board = state.materialBoard;
  if(!board?.confirmed) return;

  setMaterialFullscreenSnapshot("workspace");
  $("#materialWorkspaceFullscreen")?.classList.remove("hidden");
  document.body.classList.add("material-overlay-open");
  renderMaterialWorkspaceFullscreen();
}

function refreshMaterialViews(){
  renderMaterialLab();

  if(state.materialFullscreenMode === "representation"){
    renderRepresentationFullscreen();
  }else if(state.materialFullscreenMode === "workspace"){
    renderMaterialWorkspaceFullscreen();
  }
}

function bindMaterialControls(root,mode="normal"){
  const board = state.materialBoard;
  if(!board || !root) return;

  root.querySelector("#openRepresentationStepBtn")?.addEventListener("click",openRepresentationFullscreen);
  root.querySelector("#openRepresentationFullscreenBtn")?.addEventListener("click",openRepresentationFullscreen);
  root.querySelector("#openMaterialWorkspaceFullscreenBtn")?.addEventListener("click",openMaterialWorkspaceFullscreen);

  root.querySelectorAll("[data-md-batch-plus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.mdBatchPlus;
      const max = Math.max(1,board.available[key] || 1);
      board.batchQuantity[key] = Math.min(max,(board.batchQuantity[key] || 1) + 1);
      recordMaterialMovement("alterar quantidade de envio",{piece:key,quantity:board.batchQuantity[key]});
      refreshMaterialViews();
    });
  });

  root.querySelectorAll("[data-md-batch-minus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.mdBatchMinus;
      board.batchQuantity[key] = Math.max(1,(board.batchQuantity[key] || 1) - 1);
      recordMaterialMovement("alterar quantidade de envio",{piece:key,quantity:board.batchQuantity[key]});
      refreshMaterialViews();
    });
  });

  root.querySelectorAll("[data-md-exchange]").forEach(button => {
    button.addEventListener("click",() => applyMaterialExchange(button.dataset.mdExchange));
  });

  root.querySelectorAll("[data-return-piece]").forEach(button => {
    button.addEventListener("click",() => {
      returnMaterialPieceToPool(button.dataset.returnPiece,Number(button.dataset.returnGroup));
    });
  });

  root.querySelectorAll("[data-drag-piece]").forEach(piece => {
    piece.addEventListener("dragstart",event => {
      const key = piece.dataset.dragPiece;
      const quantity = Math.max(
        1,
        Math.min(
          Number(board.batchQuantity?.[key] || 1),
          Number(board.available?.[key] || 1)
        )
      );

      event.dataTransfer.setData("text/material-piece",key);
      event.dataTransfer.setData("text/material-count",String(quantity));
      event.dataTransfer.effectAllowed = "move";
    });

    piece.addEventListener("contextmenu",event => {
      event.preventDefault();
      state.materialContextSourceMode = mode;
      openMaterialContextMenu(piece.dataset.pieceContext,event.clientX,event.clientY);
    });
  });

  root.querySelectorAll("[data-md-pool-cluster]").forEach(cluster => {
    cluster.addEventListener("contextmenu",event => {
      event.preventDefault();
      state.materialContextSourceMode = mode;
      openMaterialContextMenu(cluster.dataset.mdPoolCluster,event.clientX,event.clientY);
    });
  });

  root.querySelectorAll("[data-material-group]").forEach(group => {
    group.addEventListener("dragover",event => {
      event.preventDefault();
      group.classList.add("is-dragover");
    });

    group.addEventListener("dragleave",() => group.classList.remove("is-dragover"));

    group.addEventListener("drop",event => {
      event.preventDefault();
      group.classList.remove("is-dragover");

      const key = event.dataTransfer.getData("text/material-piece");
      const count = Number(event.dataTransfer.getData("text/material-count") || 1);
      const index = Number(group.dataset.materialGroup);

      if(key){
        moveMaterialPieceToGroup(key,index,count);
      }
    });
  });

  root.querySelector("#collectMaterialPiecesBtn")?.addEventListener("click",collectAllMaterialPieces);
  root.querySelector("#fsCollectMaterialPiecesBtn")?.addEventListener("click",collectAllMaterialPieces);

  root.querySelector("#restartMaterialLabBtn")?.addEventListener("click",restartMaterialBoard);
  root.querySelector("#fsRestartMaterialLabBtn")?.addEventListener("click",restartMaterialBoard);

  root.querySelector("#checkMaterialDistributionBtn")?.addEventListener("click",checkMaterialDistribution);
  root.querySelector("#fsCheckMaterialDistributionBtn")?.addEventListener("click",checkMaterialDistribution);

  const backExercise = () => {
    saveMaterialProgress("voltar ao exercício após distribuição");
    hideMaterialFullscreenOverlays();
    clearMaterialFullscreenState();
    showScreen("screenStudentActivity");
    autoGrowScratchField();
  };

  root.querySelector("#backToExerciseFromGroupsBtn")?.addEventListener("click",backExercise);
  root.querySelector("#workspaceBackExerciseTopBtn")?.addEventListener("click",backExercise);
  root.querySelector("#workspaceBackExerciseBottomBtn")?.addEventListener("click",backExercise);

  root.querySelector("#workspaceBackNormalBtn")?.addEventListener("click",() => {
    saveMaterialProgress("retorno à visualização normal");
    $("#materialWorkspaceFullscreen")?.classList.add("hidden");
    clearMaterialFullscreenState();
    document.body.classList.remove("material-overlay-open");
    renderMaterialLab();
  });

  root.querySelector("#workspaceExitBtn")?.addEventListener("click",() => openMaterialExitDialog("workspace"));

  root.querySelector("#useMaterialResultBtn")?.addEventListener("click",useMaterialResultInExercise);
  root.querySelector("#fsUseMaterialResultBtn")?.addEventListener("click",useMaterialResultInExercise);
}

function applyMaterialExchange(action){
  const board = state.materialBoard;
  if(!board) return;

  const pool = board.available;
  let valid = true;
  let description = action;

  if(action === "M-C" && pool.M >= 1){
    pool.M -= 1;
    pool.C += 10;
    description = "1 milhar → 10 centenas";
  }else if(action === "C-D" && pool.C >= 1){
    pool.C -= 1;
    pool.D += 10;
    description = "1 centena → 10 dezenas";
  }else if(action === "D-U" && pool.D >= 1){
    pool.D -= 1;
    pool.U += 10;
    description = "1 dezena → 10 unidades";
  }else if(action === "U-D" && pool.U >= 10){
    pool.U -= 10;
    pool.D += 1;
    description = "10 unidades → 1 dezena";
  }else{
    valid = false;
  }

  if(!valid){
    return toast("Não há peças suficientes para realizar essa troca.","error");
  }

  board.phase = Math.max(board.phase,2);
  board.solved = false;
  recordMaterialMovement("troca",{exchange:description});
  refreshMaterialViews();
}

function moveMaterialPieceToGroup(key,index,count=1){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if(!["M","C","D","U"].includes(key)) return;
  if(!board.groups[index]) return;

  const amount = Math.max(1,Math.min(Number(count) || 1,board.available[key] || 0));

  if(amount <= 0){
    return toast(`Não há ${pieceLabel(key).toLowerCase()} disponível.`,"error");
  }

  board.available[key] -= amount;
  board.groups[index][key] += amount;
  board.phase = Math.max(board.phase,3);
  board.solved = false;

  recordMaterialMovement("enviar peça ao grupo",{
    piece:key,
    quantity:amount,
    group:index+1
  });

  refreshMaterialViews();
}

function returnMaterialPieceToPool(key,index){
  const board = state.materialBoard;
  if(!board || !board.groups[index]) return;
  if(board.groups[index][key] <= 0) return;

  board.groups[index][key] -= 1;
  board.available[key] += 1;
  board.solved = false;

  recordMaterialMovement("devolver peça ao conjunto disponível",{
    piece:key,
    quantity:1,
    group:index+1
  });

  refreshMaterialViews();
}

function collectAllMaterialPieces(){
  const board = state.materialBoard;
  if(!board) return;

  board.groups.forEach(group => {
    ["M","C","D","U"].forEach(key => {
      board.available[key] += group[key];
      group[key] = 0;
    });
  });

  board.phase = 2;
  board.solved = false;
  recordMaterialMovement("recolher todas as peças");
  refreshMaterialViews();
}

function restartMaterialBoard(){
  const board = state.materialBoard;
  if(!board) return;

  const history = Array.isArray(board.history) ? board.history.slice(-249) : [];
  const fresh = createMaterialBoard(board.dividend,board.divisor);
  fresh.history = history;
  state.materialBoard = fresh;

  recordMaterialMovement("refazer tudo");
  refreshMaterialViews();
}

function checkMaterialDistribution(){
  const board = state.materialBoard;
  if(!board) return;

  const quotient = board.dividend / board.divisor;
  const poolValue = materialCountsValue(board.available);
  const values = board.groups.map(materialCountsValue);
  const allEqual = values.every(value => value === quotient);
  const correctTotal = materialTotalValue(board) === board.dividend;

  if(Number.isInteger(quotient) && poolValue === 0 && allEqual && correctTotal){
    board.phase = 4;
    board.solved = true;
    recordMaterialMovement("conferir distribuição",{result:"correta"});
    saveMaterialProgress("distribuição correta");
    refreshMaterialViews();
    toast("Distribuição correta. Parabéns!","success");
    return;
  }

  board.solved = false;
  recordMaterialMovement("conferir distribuição",{
    result:"revisar",
    remainingPool:poolValue
  });

  const normalFeedback = $("#materialDistributionFeedback");
  const fsFeedback = $("#fsMaterialDistributionFeedback");

  let message = "A distribuição ainda precisa ser ajustada.";

  if(!Number.isInteger(quotient)){
    message = "Continue usando as peças para representar sua estratégia. Esta atividade poderá ser revisada posteriormente pelo professor.";
  }else if(poolValue > 0){
    message = "Ainda existem peças fora dos grupos. Continue distribuindo até usar todas elas.";
  }else{
    message = "Os grupos ainda não têm o mesmo valor. Revise a distribuição ou faça novas trocas.";
  }

  if(normalFeedback) normalFeedback.textContent = message;
  if(fsFeedback) fsFeedback.textContent = message;

  if(!state.materialFullscreenMode){
    saveMaterialProgress("conferência da distribuição");
  }

  toast("Revise a distribuição.","info");
}

function useMaterialResultInExercise(){
  const board = state.materialBoard;
  if(!board) return;

  const quotient = board.dividend / board.divisor;
  saveMaterialProgress("resultado levado ao exercício");

  hideMaterialFullscreenOverlays();
  clearMaterialFullscreenState();
  showScreen("screenStudentActivity");

  const answerInput = $("#studentFinalAnswer");
  if(answerInput){
    answerInput.value = String(quotient);
    answerInput.focus();
  }

  autoGrowScratchField();
  toast("Resultado transferido para a resposta final. Revise e envie.","success");
}

function openMaterialExitDialog(source){
  state.materialExitSource = source || state.materialFullscreenMode || "workspace";
  $("#materialExitModal")?.classList.remove("hidden");
}

function materialExitWithoutSave(){
  const snapshot = state.materialFullscreenSnapshot;

  if(snapshot){
    state.materialBoard = normalizeMaterialBoard(
      snapshot,
      snapshot.dividend,
      snapshot.divisor
    );
  }

  hideMaterialFullscreenOverlays();
  clearMaterialFullscreenState();
  renderMaterialLab();
  showScreen("screenStudentActivity");
  autoGrowScratchField();
  toast("As alterações desta tela não foram salvas.","info");
}

function materialExitWithSave(){
  saveMaterialProgress("saída com progresso salvo");
  hideMaterialFullscreenOverlays();
  clearMaterialFullscreenState();
  renderMaterialLab();
  showScreen("screenStudentActivity");
  autoGrowScratchField();
  toast("Progresso do Material Dourado salvo.","success");
}

/* Atualiza o menu de contexto para respeitar o modo atual. */
function openMaterialContextMenu(key,x,y){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if((board.available[key] || 0) <= 0) return;

  const menu = ensureMaterialContextMenu();
  const qty = Math.max(1,Math.min(board.batchQuantity[key] || 1,board.available[key] || 1));
  const contextCols = Math.max(1,Math.ceil(board.groups.length / 2));

  menu.innerHTML = `
    <div class="material-context-title">
      Enviar <strong>${qty}</strong> peça(s) de ${pieceLabel(key).toLowerCase()} para:
    </div>

    <div class="material-context-options" style="--context-cols:${contextCols}">
      ${board.groups.map((group,index) => `
        <button type="button"
                data-context-send="${key}"
                data-context-group="${index}"
                data-context-qty="${qty}">
          Grupo ${index+1}
        </button>
      `).join("")}
    </div>
  `;

  menu.style.left = `${Math.max(8,Math.min(x,window.innerWidth - Math.min(920,window.innerWidth * .92)))}px`;
  menu.style.top = `${Math.max(8,Math.min(y,window.innerHeight - 330))}px`;
  menu.classList.remove("hidden");

  menu.querySelectorAll("[data-context-send]").forEach(button => {
    button.addEventListener("click",event => {
      event.stopPropagation();
      moveMaterialPieceToGroup(
        button.dataset.contextSend,
        Number(button.dataset.contextGroup),
        Number(button.dataset.contextQty)
      );
      menu.classList.add("hidden");
    });
  });
}

/* ============================================================
   RASCUNHO — crescimento automático
   ============================================================ */
function autoGrowScratchField(){
  const field = $("#studentScratch");
  if(!field) return;

  field.style.height = "auto";
  field.style.height = `${Math.max(190,field.scrollHeight + 4)}px`;
}

function setupProtectedScratchField(){
  const field = $("#studentScratch");
  if(!field) return;

  if(field.dataset.protectionBound !== "1"){
    field.dataset.protectionBound = "1";

    field.addEventListener("keydown",event => {
      const key = String(event.key || "").toLowerCase();

      if((event.ctrlKey || event.metaKey) && ["c","v","x"].includes(key)){
        blockScratchAction(event);
      }
    });

    ["copy","paste","cut","contextmenu","drop","dragstart"].forEach(eventName => {
      field.addEventListener(eventName,event => blockScratchAction(event));
    });

    field.addEventListener("dragover",event => {
      event.preventDefault();
      if(event.dataTransfer) event.dataTransfer.dropEffect = "none";
    });

    field.addEventListener("beforeinput",event => {
      if(["insertFromPaste","insertFromDrop","deleteByCut"].includes(event.inputType)){
        blockScratchAction(event);
      }
    });

    field.addEventListener("input",autoGrowScratchField);
  }

  autoGrowScratchField();
}

function renderStudentAnswerArea(submission){
  const area = $("#studentAnswerArea");

  area.innerHTML = `
    <div class="answer-actions">
      <label>
        Resposta final
        <input id="studentFinalAnswer" type="text" placeholder="Digite sua resposta">
      </label>

      <button id="submitStudentAnswerBtn" class="btn btn-primary" type="button">
        ENVIAR RESPOSTA
      </button>
    </div>
  `;

  $("#studentFinalAnswer").value = submission.finalAnswer || "";
  $("#submitStudentAnswerBtn").addEventListener("click",submitStudentAnswer);
  autoGrowScratchField();
}

/* Salva também o estado do Material Dourado ao salvar o exercício. */
function saveCurrentProgress(){
  if(!state.student || !state.currentActivity) return;

  const data = loadData();
  const submission = data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  );

  if(!submission) return;

  submission.activeSeconds = state.activeSeconds;
  submission.scratch = $("#studentScratch")?.value || submission.scratch || "";
  submission.finalAnswer = $("#studentFinalAnswer")?.value || submission.finalAnswer || "";
  submission.updatedAt = new Date().toISOString();

  if(state.materialBoard){
    submission.materialProgress = {
      board:serializeMaterialBoard(state.materialBoard),
      savedAt:new Date().toISOString(),
      reason:"salvamento do exercício"
    };
  }

  const student = data.students.find(s => s.id === state.student.id);
  if(student) student.lastAccess = new Date().toISOString();

  saveData(data);
}

/* Ligações dos novos controles globais. */
document.addEventListener("DOMContentLoaded",() => {
  $("#materialExitWithoutSaveBtn")?.addEventListener("click",materialExitWithoutSave);
  $("#materialExitSaveBtn")?.addEventListener("click",materialExitWithSave);
  $("#materialExitCancelBtn")?.addEventListener("click",() => {
    $("#materialExitModal")?.classList.add("hidden");
  });

  // O botão Voltar ao exercício do cabeçalho do laboratório também salva.
  const backButton = $("#backFromMaterialBtn");
  if(backButton){
    backButton.replaceWith(backButton.cloneNode(true));
    $("#backFromMaterialBtn")?.addEventListener("click",closeMaterialLab);
  }
});


/* ============================================================
   BANCO DE ATIVIDADES OTIMIZADO — COLEÇÕES / DOCX / LIBERAÇÃO
   ============================================================ */
function activityBaseName(filename){
  return String(filename || "Atividades")
    .replace(/\.(csv|xls|xlsx|docx)$/i,"")
    .replace(/[_-]+/g," ")
    .replace(/\s+/g," ")
    .trim() || "Atividades";
}

function activityOrigin(item){
  if(item.origin === "upload" || item.sourceFileName || item.collectionType === "upload") return "upload";
  return "system";
}

function legacySystemCollectionId(item){
  return `system:${item.contextSlug || "geral"}:${item.level || "sem-nivel"}`;
}

function activityCollectionId(item){
  if(item.collectionId) return item.collectionId;
  if(activityOrigin(item) === "upload"){
    return `upload:${item.sourceFileName || item.createdAt?.slice(0,19) || item.id}`;
  }
  return legacySystemCollectionId(item);
}

function activityCollectionTitle(item){
  if(item.collectionTitle) return item.collectionTitle;
  if(activityOrigin(item) === "upload") return activityBaseName(item.sourceFileName || item.title);

  const module = item.module || item.area || "Banco do sistema";
  const level = item.level ? ` • ${item.level}` : "";
  return `${module}${level}`;
}

function getActivityCollections(){
  const data = loadData();
  const items = data.activities.filter(item =>
    item.professorId === state.professor?.id && contextMatchesActivity(item)
  );

  const map = new Map();

  items.forEach(item => {
    const id = activityCollectionId(item);
    const origin = activityOrigin(item);

    if(!map.has(id)){
      map.set(id,{
        id,
        origin,
        title:activityCollectionTitle(item),
        sourceFileName:item.sourceFileName || "",
        createdAt:item.createdAt || "",
        contextSlug:item.contextSlug || "geral",
        level:item.level || "",
        questions:[]
      });
    }

    map.get(id).questions.push(item);
  });

  return [...map.values()]
    .map(collection => ({
      ...collection,
      questions:collection.questions.sort((a,b) => String(a.title).localeCompare(String(b.title),"pt-BR",{numeric:true}))
    }))
    .sort((a,b) => String(a.title).localeCompare(String(b.title),"pt-BR",{numeric:true}));
}

function collectionSelectOptions(collections,emptyLabel){
  if(!collections.length) return `<option value="">${escapeHtml(emptyLabel)}</option>`;

  return collections.map(collection =>
    `<option value="${escapeHtml(collection.id)}">${escapeHtml(collection.title)} (${collection.questions.length})</option>`
  ).join("");
}

function collectionById(id){
  return getActivityCollections().find(item => item.id === id) || null;
}

function renderCollectionMeta(targetId,collection){
  const target = document.getElementById(targetId);
  if(!target) return;

  if(!collection){
    target.innerHTML = `Nenhum conjunto disponível nesta categoria.`;
    return;
  }

  target.innerHTML = `
    <strong>${escapeHtml(collection.title)}</strong>
    ${collection.questions.length} ${collection.questions.length === 1 ? "questão" : "questões"}
    ${collection.sourceFileName ? ` • Arquivo: ${escapeHtml(collection.sourceFileName)}` : ""}
  `;
}

function renderActivityLibrarySelectors(){
  const collections = getActivityCollections();
  const system = collections.filter(item => item.origin === "system");
  const uploads = collections.filter(item => item.origin === "upload");

  const systemSelect = $("#systemActivityCollectionSelect");
  const uploadSelect = $("#uploadActivityCollectionSelect");
  const releaseSelect = $("#releaseActivityCollectionSelect");

  if(systemSelect){
    const current = systemSelect.value;
    systemSelect.innerHTML = collectionSelectOptions(system,"Nenhuma atividade no banco do sistema");
    if(system.some(item => item.id === current)) systemSelect.value = current;
  }

  if(uploadSelect){
    const current = uploadSelect.value;
    uploadSelect.innerHTML = collectionSelectOptions(uploads,"Nenhum upload de atividades encontrado");
    if(uploads.some(item => item.id === current)) uploadSelect.value = current;
  }

  if(releaseSelect){
    const current = releaseSelect.value;
    releaseSelect.innerHTML = collections.length
      ? collections.map(collection => `
          <option value="${escapeHtml(collection.id)}">
            ${collection.origin === "upload" ? "Upload" : "Sistema"} — ${escapeHtml(collection.title)} (${collection.questions.length})
          </option>
        `).join("")
      : `<option value="">Nenhuma atividade disponível</option>`;

    if(collections.some(item => item.id === current)) releaseSelect.value = current;
  }

  renderCollectionMeta("systemActivityCollectionMeta",collectionById(systemSelect?.value));
  renderCollectionMeta("uploadActivityCollectionMeta",collectionById(uploadSelect?.value));
}

function renderReleaseClassPicker(){
  const root = $("#releaseClassOptions");
  if(!root) return;

  const classes = currentProfessorClasses();

  if(!classes.length){
    root.innerHTML = `<div class="release-empty-state">Cadastre uma turma antes de liberar atividades.</div>`;
    return;
  }

  root.innerHTML = `
    <label class="class-option class-option-all">
      <input id="releaseAllClasses" type="checkbox">
      <span>Todas as turmas</span>
    </label>

    <div class="class-option-list">
      ${classes.map(item => `
        <label class="class-option">
          <input type="checkbox" value="${item.id}" data-release-class>
          <span>${escapeHtml(item.name)}</span>
        </label>
      `).join("")}
    </div>
  `;

  const all = $("#releaseAllClasses",root);
  const inputs = $$('[data-release-class]',root);
  const summary = $("#releaseClassSummary");

  const update = () => {
    const selected = inputs.filter(input => input.checked);
    const allSelected = inputs.length > 0 && selected.length === inputs.length;
    all.checked = allSelected;
    all.indeterminate = selected.length > 0 && !allSelected;

    if(allSelected) summary.textContent = "Todas as turmas";
    else if(selected.length === 1){
      const item = classes.find(c => c.id === selected[0].value);
      summary.textContent = item?.name || "1 turma selecionada";
    }else if(selected.length > 1) summary.textContent = `${selected.length} turmas selecionadas`;
    else summary.textContent = "Escolha uma, várias ou todas as turmas";

    renderReleaseQuestionList();
  };

  all.addEventListener("change",() => {
    inputs.forEach(input => input.checked = all.checked);
    update();
  });

  inputs.forEach(input => input.addEventListener("change",update));
  update();
}

function selectedReleaseClassIds(){
  return $$('[data-release-class]:checked',$("#releaseClassOptions")).map(input => input.value);
}

function assignmentSummaryForQuestion(activityId,classIds,data){
  if(!classIds.length){
    const total = data.assignments.filter(item => item.activityId === activityId).length;
    return total ? `Liberada em ${total} turma(s)` : "Bloqueada";
  }

  const released = classIds.filter(classId => data.assignments.some(item =>
    item.activityId === activityId && item.classId === classId
  )).length;

  if(released === classIds.length) return `Liberada ${released}/${classIds.length}`;
  if(released > 0) return `Parcial ${released}/${classIds.length}`;
  return "Bloqueada";
}

function renderReleaseQuestionList(){
  const list = $("#releaseQuestionList");
  const status = $("#releaseActivityStatus");
  const selectAll = $("#selectAllReleaseQuestions");
  if(!list || !status || !selectAll) return;

  const collection = collectionById($("#releaseActivityCollectionSelect")?.value);
  const classIds = selectedReleaseClassIds();
  const data = loadData();

  if(!collection){
    list.innerHTML = `<div class="release-empty-state">Escolha uma atividade para visualizar as questões.</div>`;
    status.textContent = "Nenhuma atividade selecionada.";
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }

  list.innerHTML = collection.questions.map((item,index) => {
    const summary = assignmentSummaryForQuestion(item.id,classIds,data);
    const released = summary.startsWith("Liberada");

    return `
      <label class="release-question-row">
        <input type="checkbox" value="${item.id}" data-release-question>
        <span class="release-question-copy">
          <strong>${String(index+1).padStart(2,"0")} — ${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.statement || item.question || "")}</small>
        </span>
        <span class="question-release-badge ${released ? "is-released" : "is-blocked"}">${escapeHtml(summary)}</span>
      </label>
    `;
  }).join("");

  const inputs = $$('[data-release-question]',list);

  const syncAll = () => {
    const selected = inputs.filter(input => input.checked);
    selectAll.checked = inputs.length > 0 && selected.length === inputs.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < inputs.length;
  };

  inputs.forEach(input => input.addEventListener("change",syncAll));
  syncAll();

  const releasedCount = collection.questions.filter(question =>
    classIds.length
      ? classIds.some(classId => data.assignments.some(a => a.activityId === question.id && a.classId === classId))
      : data.assignments.some(a => a.activityId === question.id)
  ).length;

  status.innerHTML = `
    <strong>${escapeHtml(collection.title)}</strong> • ${collection.questions.length} questão(ões).
    ${classIds.length
      ? ` ${releasedCount} questão(ões) possuem liberação em pelo menos uma das ${classIds.length} turma(s) selecionada(s).`
      : " Selecione ao menos uma turma para liberar ou bloquear."}
  `;
}

function renderActivityManager(){
  renderActivityLibrarySelectors();
  renderReleaseClassPicker();
  renderReleaseQuestionList();

  const systemSelect = $("#systemActivityCollectionSelect");
  const uploadSelect = $("#uploadActivityCollectionSelect");
  const releaseSelect = $("#releaseActivityCollectionSelect");

  if(systemSelect && systemSelect.dataset.bound !== "1"){
    systemSelect.dataset.bound = "1";
    systemSelect.addEventListener("change",() => renderCollectionMeta("systemActivityCollectionMeta",collectionById(systemSelect.value)));
  }

  if(uploadSelect && uploadSelect.dataset.bound !== "1"){
    uploadSelect.dataset.bound = "1";
    uploadSelect.addEventListener("change",() => renderCollectionMeta("uploadActivityCollectionMeta",collectionById(uploadSelect.value)));
  }

  if(releaseSelect && releaseSelect.dataset.bound !== "1"){
    releaseSelect.dataset.bound = "1";
    releaseSelect.addEventListener("change",renderReleaseQuestionList);
  }

  const selectAll = $("#selectAllReleaseQuestions");
  if(selectAll && selectAll.dataset.bound !== "1"){
    selectAll.dataset.bound = "1";
    selectAll.addEventListener("change",() => {
      $$('[data-release-question]',$("#releaseQuestionList")).forEach(input => input.checked = selectAll.checked);
      selectAll.indeterminate = false;
    });
  }

  const viewSystem = $("#viewSystemActivityDocxBtn");
  if(viewSystem && viewSystem.dataset.bound !== "1"){
    viewSystem.dataset.bound = "1";
    viewSystem.addEventListener("click",() => downloadActivityCollectionDocx(systemSelect?.value));
  }

  const viewUpload = $("#viewUploadActivityDocxBtn");
  if(viewUpload && viewUpload.dataset.bound !== "1"){
    viewUpload.dataset.bound = "1";
    viewUpload.addEventListener("click",() => downloadActivityCollectionDocx(uploadSelect?.value));
  }

  const releaseBtn = $("#releaseSelectedQuestionsBtn");
  if(releaseBtn && releaseBtn.dataset.bound !== "1"){
    releaseBtn.dataset.bound = "1";
    releaseBtn.addEventListener("click",() => changeSelectedQuestionRelease(true));
  }

  const blockBtn = $("#blockSelectedQuestionsBtn");
  if(blockBtn && blockBtn.dataset.bound !== "1"){
    blockBtn.dataset.bound = "1";
    blockBtn.addEventListener("click",() => changeSelectedQuestionRelease(false));
  }
}

function renderActivityList(){
  renderActivityManager();
}

function changeSelectedQuestionRelease(shouldRelease){
  const classIds = selectedReleaseClassIds();
  const questionIds = $$('[data-release-question]:checked',$("#releaseQuestionList")).map(input => input.value);

  if(!classIds.length) return toast("Escolha pelo menos uma turma.","error");
  if(!questionIds.length) return toast("Selecione pelo menos uma questão.","error");

  const data = loadData();
  let changed = 0;

  if(shouldRelease){
    classIds.forEach(classId => {
      questionIds.forEach(activityId => {
        const exists = data.assignments.some(item => item.classId === classId && item.activityId === activityId);
        if(!exists){
          data.assignments.push({
            id:uid("assign"),
            activityId,
            classId,
            createdAt:new Date().toISOString()
          });
          changed += 1;
        }
      });
    });
  }else{
    const before = data.assignments.length;
    data.assignments = data.assignments.filter(item =>
      !(classIds.includes(item.classId) && questionIds.includes(item.activityId))
    );
    changed = before - data.assignments.length;
  }

  saveData(data);
  renderOverviewMetrics();
  renderReleaseQuestionList();

  if(shouldRelease){
    toast(changed ? `${questionIds.length} questão(ões) liberada(s) para ${classIds.length} turma(s).` : "As questões já estavam liberadas para as turmas selecionadas.",changed ? "success" : "info");
  }else{
    toast(changed ? "Liberação removida das questões selecionadas." : "As questões selecionadas já estavam bloqueadas.",changed ? "success" : "info");
  }
}

function xmlEscape(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&apos;");
}

function wordParagraph(text,{bold=false,size=24,after=120}={}){
  return `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr><w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

async function downloadActivityCollectionDocx(collectionId){
  const collection = collectionById(collectionId);
  if(!collection) return toast("Escolha uma atividade para gerar o documento.","error");
  if(typeof JSZip === "undefined") return toast("O gerador de DOCX ainda não foi carregado. Verifique a conexão e tente novamente.","error");

  const body = [
    wordParagraph(collection.title,{bold:true,size:34,after:220}),
    wordParagraph(`${collection.questions.length} questão(ões) • ${collection.origin === "upload" ? "Upload do professor" : "Banco de atividades do sistema"}`,{size:22,after:260}),
    ...collection.questions.flatMap((item,index) => [
      wordParagraph(`${String(index+1).padStart(2,"0")}. ${item.title}`,{bold:true,size:26,after:80}),
      item.statement ? wordParagraph(item.statement,{size:23,after:80}) : "",
      item.question ? wordParagraph(item.question,{bold:true,size:23,after:80}) : "",
      wordParagraph(`Nível: ${item.level || "—"}   |   Área: ${item.area || "—"}   |   Componente: ${item.module || "—"}`,{size:19,after:220})
    ])
  ].join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml",contentTypes);
  zip.folder("_rels").file(".rels",rels);
  zip.folder("word").file("document.xml",documentXml);

  const blob = await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${normalizeClassCode(collection.title) || "Atividades"}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url),1200);
  toast("Documento DOCX gerado com sucesso.","success");
}

/* Importações novas passam a registrar arquivo e coleção. */
function confirmActivityImport(){
  const pending = state.pendingImport;

  if(!pending?.valid?.length){
    return toast("Selecione e analise um arquivo antes de importar.","error");
  }

  const data = loadData();
  const classId = $("#uploadAssignClass").value || null;
  const collectionId = uid("collection");
  const collectionTitle = activityBaseName(pending.fileName);
  let created = 0;

  pending.valid.forEach(row => {
    const activity = {
      id:uid("activity"),
      professorId:state.professor.id,
      contextSlug:state.currentContext?.slug || "geral",
      area:state.currentContext?.area || "Geral",
      module:state.currentContext?.module || state.currentContext?.title || "Atividade",
      title:row.title,
      statement:row.statement,
      question:row.question,
      answer:row.answer,
      level:row.level,
      type:row.type,
      operandA:row.operandA,
      operandB:row.operandB,
      unit:row.unit,
      origin:"upload",
      collectionType:"upload",
      collectionId,
      collectionTitle,
      sourceFileName:pending.fileName,
      createdAt:new Date().toISOString()
    };

    data.activities.push(activity);

    if(classId){
      data.assignments.push({
        id:uid("assign"),
        activityId:activity.id,
        classId,
        createdAt:new Date().toISOString()
      });
    }

    created += 1;
  });

  saveData(data);

  $("#uploadResult").innerHTML = `
    <div class="success-panel">
      <strong>Importação concluída</strong>
      <p>${created} ${created === 1 ? "atividade foi adicionada" : "atividades foram adicionadas"} ao conjunto <strong>${escapeHtml(collectionTitle)}</strong>.</p>
    </div>
  `;

  resetActivityImport();
  renderActivityList();
  renderOverviewMetrics();
  renderProfessorHeroStats();
  toast(`${created} atividade(s) importada(s).`,"success");
}

/* ============================================================
   MATERIAL DOURADO — NOVO WORKSPACE DE TELA CHEIA
   ============================================================ */
function renderMaterialWorkspaceFullscreen(){
  const board = state.materialBoard;
  const root = $("#materialWorkspaceFullscreenRoot");
  if(!board || !root) return;

  const layout = materialGroupLayout(board.groups.length);
  const quotient = board.dividend / board.divisor;

  root.innerHTML = `
    <div class="material-fs-shell material-fs-shell-workspace">
      <header class="material-fs-header">
        <div class="material-fs-title">
          <span class="kicker">MATERIAL DOURADO — TELA AMPLIADA</span>
          <h1>Trocas e distribuição nos grupos</h1>
          <p>Faça as trocas, escolha a quantidade e distribua as peças com mais espaço visual.</p>
        </div>

        <div class="material-fs-header-actions">
          <div class="material-fs-chip"><span>DIVIDENDO</span><strong>${board.dividend}</strong></div>
          <div class="material-fs-chip"><span>DIVISOR</span><strong>${board.divisor}</strong></div>
          <button id="workspaceBackNormalBtn" class="material-fs-button" type="button">VOLTAR À TELA NORMAL</button>
          <button id="workspaceBackExerciseTopBtn" class="material-fs-button" type="button">VOLTAR AO EXERCÍCIO</button>
          <button id="workspaceExitBtn" class="material-fs-button danger" type="button">SAIR</button>
        </div>
      </header>

      <section class="material-fs-exchange-strip">
        <div class="material-fs-exchange-strip-title">
          <div>
            <h2>2. Trocas</h2>
            <p>Referência rápida — clique em uma troca quando ela for necessária.</p>
          </div>
        </div>

        <div class="premium-exchange-row">
          ${[
            ["M-C","1 milhar","10 centenas","Transforme uma peça de milhar em centenas."],
            ["C-D","1 centena","10 dezenas","Transforme uma peça de centena em dezenas."],
            ["D-U","1 dezena","10 unidades","Transforme uma peça de dezena em unidades."],
            ["U-D","10 unidades","1 dezena","Reagrupe dez unidades em uma dezena."]
          ].map(([action,from,to,desc]) => `
            <button type="button" class="premium-exchange-button" data-md-exchange="${action}">
              <div><strong>${from}</strong><small>${desc}</small></div>
              <span class="arrow">→</span>
              <strong>${to}</strong>
            </button>
          `).join("")}
        </div>
      </section>

      <div class="material-fs-workspace-main">
        <aside class="material-fs-pool-panel">
          <div class="material-pool-heading">
            <div>
              <strong>Peças disponíveis</strong>
              <small>Selecione a quantidade para envio rápido. Arraste as peças ou use o botão direito para escolher o grupo.</small>
            </div>
            <span>${materialCountsValue(board.available)}</span>
          </div>

          <div class="material-pool-pieces">
            ${renderPieceVisuals(board.available,"pool")}
          </div>
        </aside>

        <section class="material-fs-groups-panel">
          <div class="material-fs-panel-title">
            <div>
              <h2>3. Distribua entre ${board.divisor} grupos</h2>
              <p>As caixas permanecem brancas, com contorno azul neon, sobre o fundo preto.</p>
            </div>
          </div>

          <div class="material-fs-groups-scroll">
            <div class="material-fs-groups-grid"
                 style="--md-group-columns:${layout.columns}; min-width:${layout.columns * 257 + Math.max(0,layout.columns - 1) * 12}px;">
              ${board.groups.map((group,index) => `
                <article class="material-group-white" data-material-group="${index}">
                  <header>
                    <div>
                      <strong>Grupo ${index+1}</strong>
                      <span>Valor: ${materialCountsValue(group)}</span>
                    </div>
                    <small>M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}</small>
                  </header>

                  <div class="material-group-pieces">
                    ${renderPieceVisuals(group,"group",index)}
                  </div>

                  <div class="material-group-drop-note">Arraste as peças até aqui. Clique em uma peça do grupo para devolvê-la.</div>
                </article>
              `).join("")}
            </div>
          </div>

          <div class="material-fs-controls">
            <button id="fsCheckMaterialDistributionBtn" class="material-fs-button primary" type="button">✓ CONFERIR O RESULTADO</button>
            <button id="fsCollectMaterialPiecesBtn" class="material-fs-button" type="button">↺ RECOLHER TODAS AS PEÇAS</button>
            <button id="fsRestartMaterialLabBtn" class="material-fs-button" type="button">REFAZER TUDO</button>
            <button id="workspaceBackExerciseBottomBtn" class="material-fs-button gold" type="button">VOLTAR AO EXERCÍCIO</button>
          </div>

          <div id="fsMaterialDistributionFeedback" class="material-fs-feedback">
            ${board.solved ? `<strong>Parabéns!</strong> A distribuição foi conferida.` : `Distribua as peças entre os grupos e use a conferência para revisar sua estratégia.`}
          </div>

          ${board.solved ? `
            <div class="material-fs-result">
              <div><span>RESULTADO</span><strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong></div>
              <button id="fsUseMaterialResultBtn" class="material-fs-button primary" type="button">USAR RESULTADO NO EXERCÍCIO</button>
            </div>
          ` : ""}
        </section>
      </div>
    </div>
  `;

  bindMaterialControls(root,"fullscreen");
}


/* ============================================================
   BANCO DE ATIVIDADES DO SISTEMA — DIVISÃO N1 / N2
   Fonte: arquivos fornecidos pelo professor em 14/10/2026.
   ============================================================ */
const SYSTEM_DIVISION_BANK_N1_N2 = {
  "N1": {
    "collectionId": "system_divisao_n1_6e7",
    "collectionTitle": "Divisão — 6º e 7º ano — Nível 1",
    "gradeBand": "6º e 7º ano",
    "rows": [
      {
        "numero": 1,
        "title": "D01 - Lápis na escola",
        "statement": "Uma professora tem 36 lápis para distribuir igualmente entre 4 grupos.",
        "question": "Quantos lápis cada grupo receberá?",
        "answer": "9",
        "level": "N1",
        "type": "Básico",
        "unit": "lápis",
        "operandA": 36,
        "operandB": 4
      },
      {
        "numero": 2,
        "title": "D02 - Ração para gatos",
        "statement": "Um abrigo separou 56 sachês de ração para distribuir igualmente entre 7 gatos.",
        "question": "Quantos sachês serão destinados a cada gato?",
        "answer": "8",
        "level": "N1",
        "type": "Básico",
        "unit": "sachês",
        "operandA": 56,
        "operandB": 7
      },
      {
        "numero": 3,
        "title": "D03 - Ovos nas embalagens",
        "statement": "Uma granja precisa colocar 75 ovos em 5 embalagens iguais.",
        "question": "Quantos ovos ficarão em cada embalagem?",
        "answer": "15",
        "level": "N1",
        "type": "Básico",
        "unit": "ovos",
        "operandA": 75,
        "operandB": 5
      },
      {
        "numero": 4,
        "title": "D04 - Figurinhas entre amigos",
        "statement": "Pedro tem 96 figurinhas para dividir igualmente entre 6 amigos.",
        "question": "Quantas figurinhas cada amigo receberá?",
        "answer": "16",
        "level": "N1",
        "type": "Básico",
        "unit": "figurinhas",
        "operandA": 96,
        "operandB": 6
      },
      {
        "numero": 5,
        "title": "D05 - Livros na biblioteca",
        "statement": "Uma biblioteca recebeu 144 livros e vai distribuí-los igualmente em 6 prateleiras.",
        "question": "Quantos livros ficarão em cada prateleira?",
        "answer": "24",
        "level": "N1",
        "type": "Intermediário",
        "unit": "livros",
        "operandA": 144,
        "operandB": 6
      },
      {
        "numero": 6,
        "title": "D06 - Mudas na horta",
        "statement": "Uma escola possui 256 mudas de alface para plantar igualmente em 8 canteiros.",
        "question": "Quantas mudas ficarão em cada canteiro?",
        "answer": "32",
        "level": "N1",
        "type": "Intermediário",
        "unit": "mudas",
        "operandA": 256,
        "operandB": 8
      },
      {
        "numero": 7,
        "title": "D07 - Produção de ovos",
        "statement": "Uma granja produziu 525 ovos em 7 dias, mantendo a mesma produção diária.",
        "question": "Quantos ovos foram produzidos por dia?",
        "answer": "75",
        "level": "N1",
        "type": "Intermediário",
        "unit": "ovos por dia",
        "operandA": 525,
        "operandB": 7
      },
      {
        "numero": 8,
        "title": "D08 - Cadernos para as turmas",
        "statement": "Uma escola recebeu 936 cadernos para distribuir igualmente entre 12 turmas.",
        "question": "Quantos cadernos cada turma receberá?",
        "answer": "78",
        "level": "N1",
        "type": "Intermediário",
        "unit": "cadernos",
        "operandA": 936,
        "operandB": 12
      },
      {
        "numero": 9,
        "title": "D09 - Compra de celular",
        "statement": "Um celular custa R$ 2.248,00 e será pago em 8 parcelas iguais, sem juros.",
        "question": "Qual será o valor, em reais, de cada parcela?",
        "answer": "281",
        "level": "N1",
        "type": "Avançado",
        "unit": "reais",
        "operandA": 2248,
        "operandB": 8
      },
      {
        "numero": 10,
        "title": "D10 - Hortaliças na comunidade",
        "statement": "Uma cooperativa colheu 1.680 pés de alface e vai distribuí-los igualmente entre 12 pontos de venda.",
        "question": "Quantos pés de alface cada ponto receberá?",
        "answer": "140",
        "level": "N1",
        "type": "Avançado",
        "unit": "pés de alface",
        "operandA": 1680,
        "operandB": 12
      }
    ]
  },
  "N2": {
    "collectionId": "system_divisao_n2_8e9",
    "collectionTitle": "Divisão — 8º e 9º ano — Nível 2",
    "gradeBand": "8º e 9º ano",
    "rows": [
      {
        "numero": 1,
        "title": "B01 - Lápis na escola",
        "statement": "Uma professora tem 36 lápis para distribuir igualmente entre 4 grupos de alunos.",
        "question": "Quantos lápis cada grupo receberá?",
        "answer": "9",
        "level": "N2",
        "type": "Básico",
        "unit": "lápis",
        "operandA": 36,
        "operandB": 4
      },
      {
        "numero": 2,
        "title": "B02 - Consumo mensal de ração dos gatos",
        "statement": "Um abrigo possui 14 gatos adultos. Durante um mês, os animais consumiram juntos 42 kg de ração. Considere que todos consumiram a mesma quantidade nesse período.",
        "question": "Quantos quilogramas de ração cada gato consumiu no mês?",
        "answer": "3",
        "level": "N2",
        "type": "Básico",
        "unit": "quilogramas",
        "operandA": 42,
        "operandB": 14
      },
      {
        "numero": 3,
        "title": "B03 - Ovos nas embalagens",
        "statement": "Uma granja separou 72 ovos para colocar igualmente em 6 embalagens.",
        "question": "Quantos ovos ficarão em cada embalagem?",
        "answer": "12",
        "level": "N2",
        "type": "Básico",
        "unit": "ovos",
        "operandA": 72,
        "operandB": 6
      },
      {
        "numero": 4,
        "title": "B04 - Figurinhas entre amigos",
        "statement": "Pedro tem 96 figurinhas para dividir igualmente entre 6 amigos.",
        "question": "Quantas figurinhas cada amigo receberá?",
        "answer": "16",
        "level": "N2",
        "type": "Básico",
        "unit": "figurinhas",
        "operandA": 96,
        "operandB": 6
      },
      {
        "numero": 5,
        "title": "I01 - Livros na biblioteca",
        "statement": "Uma biblioteca recebeu 864 livros e vai distribuí-los igualmente em 8 estantes.",
        "question": "Quantos livros ficarão em cada estante?",
        "answer": "108",
        "level": "N2",
        "type": "Intermediário",
        "unit": "livros",
        "operandA": 864,
        "operandB": 8
      },
      {
        "numero": 6,
        "title": "I02 - Preço por caderno",
        "statement": "Uma escola pagou R$ 186,00 por 6 cadernos iguais para uma oficina.",
        "question": "Qual foi o preço de cada caderno, em reais?",
        "answer": "31",
        "level": "N2",
        "type": "Intermediário",
        "unit": "reais",
        "operandA": 186,
        "operandB": 6
      },
      {
        "numero": 7,
        "title": "I03 - Água nos recipientes",
        "statement": "Um reservatório contém 144 litros de água. Todo o volume será dividido igualmente em 12 recipientes.",
        "question": "Quantos litros de água haverá em cada recipiente?",
        "answer": "12",
        "level": "N2",
        "type": "Intermediário",
        "unit": "litros",
        "operandA": 144,
        "operandB": 12
      },
      {
        "numero": 8,
        "title": "I04 - Passageiros nos ônibus",
        "statement": "Para transportar um grupo em uma excursão escolar, 840 passageiros foram distribuídos igualmente em 14 ônibus.",
        "question": "Quantos passageiros foram colocados em cada ônibus?",
        "answer": "60",
        "level": "N2",
        "type": "Intermediário",
        "unit": "passageiros",
        "operandA": 840,
        "operandB": 14
      },
      {
        "numero": 9,
        "title": "I05 - Produção mensal de ovos",
        "statement": "Uma pequena propriedade rural possui 14 galinhas poedeiras. Durante um mês, elas produziram, juntas, 364 ovos. Para calcular a produtividade, o produtor considera uma produção igual por galinha.",
        "question": "Qual foi a média de ovos produzidos por galinha nesse mês?",
        "answer": "26",
        "level": "N2",
        "type": "Intermediário",
        "unit": "ovos",
        "operandA": 364,
        "operandB": 14
      },
      {
        "numero": 10,
        "title": "I06 - Materiais para as turmas da escola",
        "statement": "Uma escola recebeu 936 folhas impressas para atividades de aprendizagem. A coordenação decidiu distribuir todas as folhas igualmente entre 12 turmas.",
        "question": "Quantas folhas cada turma receberá?",
        "answer": "78",
        "level": "N2",
        "type": "Intermediário",
        "unit": "folhas",
        "operandA": 936,
        "operandB": 12
      },
      {
        "numero": 11,
        "title": "I07 - Hortaliças na horta comunitária",
        "statement": "Uma horta comunitária recebeu 672 mudas de hortaliças para o plantio. Os voluntários vão distribuí-las igualmente por 8 canteiros.",
        "question": "Quantas mudas serão plantadas em cada canteiro?",
        "answer": "84",
        "level": "N2",
        "type": "Intermediário",
        "unit": "mudas",
        "operandA": 672,
        "operandB": 8
      },
      {
        "numero": 12,
        "title": "A01 - Caixas de blocos",
        "statement": "Uma escola possui 1.728 blocos de montagem e quer guardá-los igualmente em 12 caixas.",
        "question": "Quantos blocos serão colocados em cada caixa?",
        "answer": "144",
        "level": "N2",
        "type": "Avançado",
        "unit": "blocos",
        "operandA": 1728,
        "operandB": 12
      },
      {
        "numero": 13,
        "title": "A02 - Celular em oito parcelas",
        "statement": "Um celular custa R$ 2.792,00 à vista. A loja oferece a opção de pagar o mesmo valor em 8 parcelas mensais iguais, sem entrada e sem juros.",
        "question": "Qual será o valor de cada parcela, em reais?",
        "answer": "349",
        "level": "N2",
        "type": "Avançado",
        "unit": "reais",
        "operandA": 2792,
        "operandB": 8
      },
      {
        "numero": 14,
        "title": "A03 - Amostras na feira de ciências",
        "statement": "Para uma feira de ciências, um laboratório organizou 2.925 amostras de pesquisa. Elas serão distribuídas igualmente entre 15 equipes, que deverão analisar a mesma quantidade de amostras.",
        "question": "Quantas amostras serão destinadas a cada equipe?",
        "answer": "195",
        "level": "N2",
        "type": "Avançado",
        "unit": "amostras",
        "operandA": 2925,
        "operandB": 15
      },
      {
        "numero": 15,
        "title": "A04 - Hortaliças na horta comunitária",
        "statement": "Uma horta comunitária recebeu 1.680 mudas de hortaliças para o plantio. Os voluntários vão distribuí-las igualmente por 14 canteiros preparados, sem deixar mudas de fora.",
        "question": "Quantas mudas serão plantadas em cada canteiro?",
        "answer": "120",
        "level": "N2",
        "type": "Avançado",
        "unit": "mudas",
        "operandA": 1680,
        "operandB": 14
      }
    ]
  }
};

function ensureSystemDivisionBank(){
  if(!state.professor?.id) return;

  const data = loadData();
  let changed = false;

  Object.entries(SYSTEM_DIVISION_BANK_N1_N2).forEach(([level,collection]) => {
    collection.rows.forEach(row => {
      const bankKey = `${collection.collectionId}_${String(row.numero).padStart(2,"0")}`;

      let item = data.activities.find(activity =>
        activity.professorId === state.professor.id &&
        activity.systemBankKey === bankKey
      );

      const payload = {
        professorId:state.professor.id,
        contextSlug:"divisao",
        area:"Matemática",
        module:"Divisão",
        title:row.title,
        statement:row.statement,
        question:row.question,
        answer:String(row.answer),
        level,
        type:row.type,
        unit:row.unit,
        operandA:row.operandA,
        operandB:row.operandB,
        origin:"system",
        collectionType:"system",
        collectionId:collection.collectionId,
        collectionTitle:collection.collectionTitle,
        gradeBand:collection.gradeBand,
        systemBankKey:bankKey
      };

      if(!item){
        item = {
          id:`sys_${state.professor.id}_${bankKey}`,
          ...payload,
          createdAt:new Date().toISOString()
        };
        data.activities.push(item);
        changed = true;
      }else{
        let itemChanged = false;

        Object.entries(payload).forEach(([key,value]) => {
          if(item[key] !== value){
            item[key] = value;
            itemChanged = true;
          }
        });

        if(itemChanged) changed = true;
      }
    });
  });

  if(changed) saveData(data);
}

function groupedSystemCollectionOptions(collections){
  if(!collections.length){
    return `<option value="">Nenhuma atividade no banco do sistema</option>`;
  }

  const levels = ["N1","N2"];

  return levels.map(level => {
    const group = collections.filter(collection =>
      collection.level === level ||
      collection.questions.some(question => question.level === level)
    );

    if(!group.length) return "";

    const label = level === "N1"
      ? "NÍVEL 1 — 6º e 7º ano"
      : "NÍVEL 2 — 8º e 9º ano";

    return `
      <optgroup label="${label}">
        ${group.map(collection => `
          <option value="${escapeHtml(collection.id)}">
            ${escapeHtml(collection.title)} (${collection.questions.length})
          </option>
        `).join("")}
      </optgroup>
    `;
  }).join("");
}

function groupedReleaseCollectionOptions(collections){
  if(!collections.length){
    return `<option value="">Nenhuma atividade disponível</option>`;
  }

  const system = collections.filter(item => item.origin === "system");
  const uploads = collections.filter(item => item.origin === "upload");

  const groups = [];

  ["N1","N2"].forEach(level => {
    const levelItems = system.filter(collection =>
      collection.level === level ||
      collection.questions.some(question => question.level === level)
    );

    if(levelItems.length){
      const label = level === "N1"
        ? "BANCO DO SISTEMA — NÍVEL 1"
        : "BANCO DO SISTEMA — NÍVEL 2";

      groups.push(`
        <optgroup label="${label}">
          ${levelItems.map(collection => `
            <option value="${escapeHtml(collection.id)}">
              ${escapeHtml(collection.title)} (${collection.questions.length})
            </option>
          `).join("")}
        </optgroup>
      `);
    }
  });

  if(uploads.length){
    groups.push(`
      <optgroup label="UPLOADS DO PROFESSOR">
        ${uploads.map(collection => `
          <option value="${escapeHtml(collection.id)}">
            ${escapeHtml(collection.title)} (${collection.questions.length})
          </option>
        `).join("")}
      </optgroup>
    `);
  }

  return groups.join("");
}

/* Sobrescreve somente a montagem dos seletores para incluir a separação N1/N2. */
function renderActivityLibrarySelectors(){
  ensureSystemDivisionBank();

  const collections = getActivityCollections();
  const system = collections.filter(item => item.origin === "system");
  const uploads = collections.filter(item => item.origin === "upload");

  const systemSelect = $("#systemActivityCollectionSelect");
  const uploadSelect = $("#uploadActivityCollectionSelect");
  const releaseSelect = $("#releaseActivityCollectionSelect");

  if(systemSelect){
    const current = systemSelect.value;
    systemSelect.innerHTML = groupedSystemCollectionOptions(system);

    if(system.some(item => item.id === current)){
      systemSelect.value = current;
    }
  }

  if(uploadSelect){
    const current = uploadSelect.value;
    uploadSelect.innerHTML = collectionSelectOptions(
      uploads,
      "Nenhum upload de atividades encontrado"
    );

    if(uploads.some(item => item.id === current)){
      uploadSelect.value = current;
    }
  }

  if(releaseSelect){
    const current = releaseSelect.value;
    releaseSelect.innerHTML = groupedReleaseCollectionOptions(collections);

    if(collections.some(item => item.id === current)){
      releaseSelect.value = current;
    }
  }

  renderCollectionMeta(
    "systemActivityCollectionMeta",
    collectionById(systemSelect?.value)
  );

  renderCollectionMeta(
    "uploadActivityCollectionMeta",
    collectionById(uploadSelect?.value)
  );

  const systemMeta = $("#systemActivityCollectionMeta");

  if(systemMeta){
    const countN1 = system
      .filter(collection => collection.questions.some(question => question.level === "N1"))
      .reduce((sum,collection) => sum + collection.questions.length,0);

    const countN2 = system
      .filter(collection => collection.questions.some(question => question.level === "N2"))
      .reduce((sum,collection) => sum + collection.questions.length,0);

    systemMeta.insertAdjacentHTML(
      "beforeend",
      `
        <div class="activity-level-summary">
          <span data-level="N1">N1 • ${countN1} questões</span>
          <span data-level="N2">N2 • ${countN2} questões</span>
        </div>
      `
    );
  }
}


/* ============================================================
   ATUALIZAÇÃO — ÁREA DO ALUNO POR NÍVEIS E PARTICIPAÇÃO
   ============================================================ */
state.studentDifficultyView = null;

const DIFFICULTY_META = {
  basic:{ key:"basic", label:"Atividades de Nível Básico", short:"Básico", colorClass:"is-basic", sideColor:"verde" },
  intermediate:{ key:"intermediate", label:"Atividades de Nível Intermediário", short:"Intermediário", colorClass:"is-intermediate", sideColor:"amarelo" },
  advanced:{ key:"advanced", label:"Atividades de Nível Avançado", short:"Avançado", colorClass:"is-advanced", sideColor:"vermelho" }
};

const STATUS_META = {
  "not-accessed":{ key:"not-accessed", label:"Atividades não acessadas", short:"Não acessadas", colorClass:"is-not-accessed" },
  "in-progress":{ key:"in-progress", label:"Atividades em andamento", short:"Em andamento", colorClass:"is-in-progress" },
  "completed":{ key:"completed", label:"Atividades concluídas", short:"Concluídas", colorClass:"is-completed" }
};

function normalizeDifficultyKey(value){
  const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(text.includes("inter")) return "intermediate";
  if(text.includes("avanc")) return "advanced";
  return "basic";
}

function getDifficultyMeta(value){
  return DIFFICULTY_META[normalizeDifficultyKey(value)] || DIFFICULTY_META.basic;
}

function getSubmissionForStudentActivity(data,studentId,classId,activityId){
  return data.submissions.find(s =>
    s.studentId === studentId &&
    s.classId === classId &&
    s.activityId === activityId
  ) || null;
}

function getActivityStatus(activity,data,studentId,classId){
  const submission = getSubmissionForStudentActivity(data,studentId,classId,activity.id);
  if(!submission) return { key:"not-accessed", label:"Não acessada", submission:null };
  if(submission.resolved) return { key:"completed", label:"Concluída", submission };
  return { key:"in-progress", label:"Em andamento", submission };
}

function buildStudentDifficultyBuckets(items,data,studentId,classId){
  const buckets = { basic:[], intermediate:[], advanced:[] };
  items.forEach(item => {
    const key = normalizeDifficultyKey(item.type);
    const statusInfo = getActivityStatus(item,data,studentId,classId);
    buckets[key].push({ activity:item, statusInfo, submission:statusInfo.submission });
  });
  return buckets;
}

function buildStatusBuckets(entries){
  const groups = { "not-accessed":[], "in-progress":[], completed:[] };
  entries.forEach(entry => groups[entry.statusInfo.key].push(entry));
  return groups;
}

function renderStudentLevelCards(levelBuckets){
  return Object.values(DIFFICULTY_META).map(meta => {
    const count = levelBuckets[meta.key]?.length || 0;
    const inProgress = (levelBuckets[meta.key] || []).filter(item => item.statusInfo.key === "in-progress").length;
    const completed = (levelBuckets[meta.key] || []).filter(item => item.statusInfo.key === "completed").length;
    return `
      <article class="student-difficulty-card ${meta.colorClass} ${state.studentDifficultyView === meta.key ? "active" : ""}">
        <div>
          <div class="difficulty-kicker">
            <span class="difficulty-pill">${escapeHtml(meta.short)}</span>
            <span class="difficulty-count">${count} atividade(s)</span>
          </div>
          <h3>${escapeHtml(meta.label)}</h3>
          <p>Acessar Atividades.</p>
        </div>
        <div class="difficulty-actions">
          <div class="difficulty-status-copy">
            ${completed} concluídas • ${inProgress} em andamento
          </div>
          <button class="btn btn-primary" type="button" data-student-difficulty-open="${meta.key}" ${count ? "" : "disabled"}>
            Acessar atividades
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderStudentDifficultyBoard(levelKey,entries){
  const meta = DIFFICULTY_META[levelKey];
  if(!meta || !entries?.length) return "";
  const statusBuckets = buildStatusBuckets(entries);
  return `
    <section class="student-level-board">
      <div class="student-level-board-header">
        <div>
          <span class="eyebrow">ORGANIZAÇÃO POR SITUAÇÃO</span>
          <h3>${escapeHtml(meta.label)}</h3>
          <p>As atividades foram separadas em três colunas: não acessadas, em andamento e concluídas.</p>
        </div>
        <div class="student-level-board-status">
          <span>${entries.length} atividade(s) neste nível</span>
        </div>
      </div>

      <div class="student-status-columns">
        ${Object.values(STATUS_META).map(status => {
          const list = statusBuckets[status.key] || [];
          return `
            <section class="student-status-column" data-status="${status.key}">
              <div class="student-status-column-header">
                <h4>${escapeHtml(status.label)}</h4>
                <span>${list.length}</span>
              </div>
              ${list.length ? `
                <div class="student-status-column-cards">
                  ${list.map(entry => `
                    <button class="student-status-activity-card" type="button" data-student-activity="${entry.activity.id}">
                      <span class="student-status-chip ${status.colorClass}">${escapeHtml(status.short)}</span>
                      <h5>${escapeHtml(entry.activity.title)}</h5>
                      <p>${escapeHtml(entry.activity.statement)}</p>
                      <div class="badge-row">
                        <span class="badge">${escapeHtml(entry.activity.module || entry.activity.area || "Atividade")}</span>
                        <span class="badge">Tentativas: ${entry.submission?.attempts || 0}</span>
                      </div>
                      <span class="student-open-action">Abrir atividade →</span>
                    </button>
                  `).join("")}
                </div>
              ` : `<p class="student-status-column-empty">Nenhuma atividade nesta situação.</p>`}
            </section>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderStudentActivities(items,data,contextSlug=null){
  const container = $("#studentActivityGroups");
  const titleEl = $("#studentComponentTitle");
  const subtitleEl = $("#studentComponentSubtitle");
  const clearButton = $("#clearStudentComponentFilter");

  let visibleItems = [...items];

  if(contextSlug){
    visibleItems = visibleItems.filter(item => item.contextSlug === contextSlug);
    const context = getStudentContextBySlug(contextSlug);
    titleEl.textContent = context?.title || "Atividades";
    subtitleEl.textContent = context
      ? `Atividades liberadas em ${context.title} para sua turma.`
      : "Atividades liberadas pelo professor para sua turma.";
    clearButton.classList.remove("hidden");
  }else{
    titleEl.textContent = "Todas as atividades";
    subtitleEl.textContent = "Atividades liberadas pelo professor para sua turma.";
    clearButton.classList.toggle("hidden",items.length === 0);
  }

  if(!visibleItems.length){
    const context = contextSlug ? getStudentContextBySlug(contextSlug) : null;
    container.innerHTML = emptyState(
      contextSlug ? "○" : "✓",
      contextSlug
        ? `Nenhuma atividade liberada em ${context?.title || "esta área"}`
        : "Nenhuma atividade liberada ainda",
      contextSlug
        ? "A capa está disponível para navegação, mas o professor ainda não liberou atividades deste componente para sua turma."
        : "As áreas e componentes estão disponíveis acima. Quando o professor liberar uma atividade, ela aparecerá aqui."
    );
    return;
  }

  const levelBuckets = buildStudentDifficultyBuckets(
    visibleItems,
    data,
    state.student.id,
    state.student.classId
  );

  if(state.studentDifficultyView && !(levelBuckets[state.studentDifficultyView] || []).length){
    state.studentDifficultyView = null;
  }

  container.innerHTML = `
    <div class="student-difficulty-grid">
      ${renderStudentLevelCards(levelBuckets)}
    </div>
    ${state.studentDifficultyView ? renderStudentDifficultyBoard(state.studentDifficultyView,levelBuckets[state.studentDifficultyView]) : ""}
  `;

  $$('[data-student-difficulty-open]',container).forEach(button => {
    button.addEventListener('click',() => {
      state.studentDifficultyView = button.dataset.studentDifficultyOpen;
      renderStudentActivities(items,data,contextSlug);
      container.scrollIntoView({behavior:'smooth',block:'start'});
    });
  });

  $$('[data-student-activity]',container).forEach(button => {
    button.addEventListener('click',() => {
      const item = visibleItems.find(activity => activity.id === button.dataset.studentActivity);
      if(item) openStudentActivity(item);
    });
  });
}

function getReportDifficultyFilter(){
  return $("#reportDifficultyFilter")?.value || "";
}

function getReportActivityStatusFilter(){
  return $("#reportActivityStatusFilter")?.value || "";
}

function getClassAssignedActivities(classId,data){
  const assignedIds = data.assignments.filter(item => item.classId === classId).map(item => item.activityId);
  return data.activities.filter(activity => assignedIds.includes(activity.id));
}

function getStudentActivityBucketsForReport(studentId,classId,data,difficultyFilter=""){
  const activities = getClassAssignedActivities(classId,data)
    .filter(activity => !difficultyFilter || normalizeDifficultyKey(activity.type) === difficultyFilter)
    .map(activity => {
      const statusInfo = getActivityStatus(activity,data,studentId,classId);
      return { activity, submission:statusInfo.submission, statusKey:statusInfo.key };
    });

  const buckets = {
    all:activities,
    "not-accessed":activities.filter(item => item.statusKey === "not-accessed"),
    "in-progress":activities.filter(item => item.statusKey === "in-progress"),
    completed:activities.filter(item => item.statusKey === "completed")
  };

  return buckets;
}

function renderReport(){
  const classId = $("#reportClassSelect").value;
  const wrap = $("#reportTableWrap");

  if(!classId){
    $("#reportMetrics").innerHTML = "";
    wrap.innerHTML = emptyState(
      "◎",
      "Selecione uma turma",
      "Escolha uma turma acima para visualizar participação, tempo e conclusões."
    );
    return;
  }

  const difficultyFilter = getReportDifficultyFilter();
  const statusFilter = getReportActivityStatusFilter();
  const data = loadData();

  let rows = sortedReportRows().map(row => ({
    ...row,
    activityBuckets:getStudentActivityBucketsForReport(row.student.id,classId,data,difficultyFilter)
  }));

  if(statusFilter){
    rows = rows.filter(row => row.activityBuckets[statusFilter].length > 0);
  }

  const studentsCount = rows.length;
  const notAccessedCount = rows.reduce((sum,row) => sum + row.activityBuckets['not-accessed'].length,0);
  const inProgressCount = rows.reduce((sum,row) => sum + row.activityBuckets['in-progress'].length,0);
  const completedCount = rows.reduce((sum,row) => sum + row.activityBuckets.completed.length,0);

  $("#reportMetrics").innerHTML = [
    metricCard("Alunos exibidos",String(studentsCount),"de acordo com os filtros","blue"),
    metricCard("Não acessadas",String(notAccessedCount),"atividades ainda não iniciadas","violet"),
    metricCard("Em andamento",String(inProgressCount),"atividades com progresso","gold"),
    metricCard("Concluídas",String(completedCount),"atividades finalizadas","green")
  ].join("");

  const difficultyLabel = difficultyFilter ? DIFFICULTY_META[difficultyFilter]?.short : "Todos os níveis";
  const statusLabel = statusFilter ? STATUS_META[statusFilter]?.short : "Todas";

  if(!rows.length){
    wrap.innerHTML = `
      <div class="report-filter-note"><strong>Filtros ativos:</strong> ${escapeHtml(difficultyLabel)} • ${escapeHtml(statusLabel)}</div>
      ${emptyState("○","Nenhum registro encontrado","Altere os filtros de nível e situação para visualizar outras participações.")}
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="report-filter-note"><strong>Filtros ativos:</strong> ${escapeHtml(difficultyLabel)} • ${escapeHtml(statusLabel)}</div>
    <table class="report-table">
      <thead>
        <tr>
          <th>Nº</th>
          <th>Situação</th>
          <th>Aluno</th>
          <th>Primeiro acesso</th>
          <th>Último acesso</th>
          <th>Tempo nos exercícios</th>
          <th>Não acessadas</th>
          <th>Em andamento</th>
          <th>Concluídas</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td class="roster-cell">${escapeHtml(row.rosterText)}</td>
            <td>
              <select class="student-situation-select"
                      data-student-situation="${row.student.id}"
                      aria-label="Situação de ${escapeHtml(row.plainName)}">
                ${["Ativo","Remanejando","Desistente"].map(option => `
                  <option value="${option}" ${row.situation === option ? "selected" : ""}>${option}</option>
                `).join("")}
              </select>
            </td>
            <td>
              <strong>${escapeHtml(row.plainName)}</strong>
              <small class="student-filtered-level">${escapeHtml(difficultyLabel)}</small>
            </td>
            <td>${escapeHtml(formatDateTime(row.firstAccess))}</td>
            <td>${escapeHtml(formatDateTime(row.lastAccess))}</td>
            <td>${escapeHtml(formatDuration(row.duration))}</td>
            <td><span class="report-count-pill is-not-accessed">${row.activityBuckets['not-accessed'].length}</span></td>
            <td><span class="report-count-pill is-in-progress">${row.activityBuckets['in-progress'].length}</span></td>
            <td><span class="report-count-pill is-completed">${row.activityBuckets.completed.length}</span></td>
            <td>
              <button class="btn btn-small btn-outline" type="button" data-student-detail="${row.student.id}">
                DETALHES
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  $$('[data-student-situation]',wrap).forEach(select => {
    select.addEventListener('change',() => {
      updateStudentSituation(select.dataset.studentSituation,select.value);
    });
  });

  $$('[data-student-detail]',wrap).forEach(button => {
    button.addEventListener('click',() => openStudentDetails(button.dataset.studentDetail));
  });
}

function renderStudentDetailBucket(title,statusKey,items){
  return `
    <section class="detail-status-column" data-status="${statusKey}">
      <h4>${escapeHtml(title)} (${items.length})</h4>
      ${items.length ? `
        <div class="detail-status-list">
          ${items.map(item => {
            if(statusKey === 'not-accessed'){
              return `
                <article class="detail-activity light">
                  <span class="student-status-chip is-not-accessed detail-activity-status">Não acessada</span>
                  <h5>${escapeHtml(item.activity.title)}</h5>
                  <p>${escapeHtml(item.activity.statement)}</p>
                </article>
              `;
            }

            const submission = item.submission;
            const history = Array.isArray(submission?.scratchHistory)
              ? submission.scratchHistory
              : (submission?.scratch ? [{ at:submission.updatedAt || submission.accessedAt, text:submission.scratch, reason:'rascunho anterior' }] : []);

            return `
              <article class="detail-activity">
                <span class="student-status-chip ${statusKey === 'completed' ? 'is-completed' : 'is-in-progress'} detail-activity-status">${statusKey === 'completed' ? 'Concluída' : 'Em andamento'}</span>
                <h4>${escapeHtml(item.activity.title)}</h4>
                <p><strong>Acesso:</strong> ${escapeHtml(formatDateTime(submission?.accessedAt))}</p>
                <p><strong>Tempo ativo:</strong> ${escapeHtml(formatDuration(submission?.activeSeconds || 0))}</p>
                <p><strong>Tentativas:</strong> ${submission?.attempts || 0}</p>
                <div class="scratch-current-box">
                  <span>RASCUNHO ATUAL</span>
                  <p>${submission?.scratch ? escapeHtml(submission.scratch) : 'Nenhum rascunho registrado.'}</p>
                </div>
                <details class="scratch-history-details">
                  <summary>HISTÓRICO DO RASCUNHO (${history.length})</summary>
                  <div class="scratch-history-list">
                    ${history.length ? history.map((snapshot,index) => `
                      <article class="scratch-history-item">
                        <div class="scratch-history-head">
                          <strong>Versão ${index + 1}</strong>
                          <span>${escapeHtml(formatDateTime(snapshot.at))}</span>
                        </div>
                        <small>${escapeHtml(formatScratchReason(snapshot.reason))}</small>
                        <pre>${escapeHtml(snapshot.text || '')}</pre>
                      </article>
                    `).join('') : `<p class="scratch-history-empty">Nenhuma versão do rascunho registrada.</p>`}
                  </div>
                </details>
              </article>
            `;
          }).join('')}
        </div>
      ` : `<p>Nenhuma atividade nesta situação.</p>`}
    </section>
  `;
}

function openStudentDetails(studentId){
  buildReportRows();
  const row = state.reportRows.find(item => item.student.id === studentId);
  if(!row) return;

  const classId = $("#reportClassSelect").value;
  const data = loadData();
  const difficultyFilter = getReportDifficultyFilter();
  const statusFilter = getReportActivityStatusFilter();
  const buckets = getStudentActivityBucketsForReport(studentId,classId,data,difficultyFilter);

  $("#studentDetailsTitle").textContent = `${row.rosterText}. ${row.plainName}`;

  const sections = [
    { key:'not-accessed', title:'Atividades não acessadas' },
    { key:'in-progress', title:'Atividades em andamento' },
    { key:'completed', title:'Atividades concluídas' }
  ].filter(section => !statusFilter || section.key === statusFilter);

  $("#studentDetailsBody").innerHTML = `
    <div class="report-filter-note"><strong>Filtro aplicado:</strong> ${escapeHtml(difficultyFilter ? DIFFICULTY_META[difficultyFilter].short : 'Todos os níveis')} • ${escapeHtml(statusFilter ? STATUS_META[statusFilter].short : 'Todas')}</div>
    <div class="detail-status-columns">
      ${sections.map(section => renderStudentDetailBucket(section.title,section.key,buckets[section.key])).join('')}
    </div>
  `;

  $("#studentDetailsModal").classList.remove('hidden');
}

(function initUpdatedReportFilters(){
  $("#reportDifficultyFilter")?.addEventListener('change',renderReport);
  $("#reportActivityStatusFilter")?.addEventListener('change',renderReport);
})();

/* ============================================================
   FASE 2 — VERSÃO 1.0
   GAMIFICAÇÃO DAS ATIVIDADES DE DIVISÃO
   ============================================================ */

if(!screens.includes("screenStudentGameMap")) screens.push("screenStudentGameMap");

const PHASE2_LEVELS = {
  basic:{
    key:"basic", label:"Básico", theme:"Natureza", icon:"🌿", prefix:"B",
    images:["B15natureza.jpg","B610natureza.jpg","B1115natureza.jpg"]
  },
  intermediate:{
    key:"intermediate", label:"Intermediário", theme:"Antártica", icon:"❄️", prefix:"I",
    images:["I15antartica.jpg","I610antartica.jpg","I1115antartica.jpg"]
  },
  advanced:{
    key:"advanced", label:"Avançado", theme:"Vulcão", icon:"🌋", prefix:"A",
    images:["A15vulcao.jpg","A610vulcao.jpg","A1115vulcao.jpg"]
  }
};

state.phase2CurrentLevel = state.phase2CurrentLevel || null;
state.phase2CurrentBlock = Number.isInteger(state.phase2CurrentBlock) ? state.phase2CurrentBlock : 0;
state.phase2GuestActivities = state.phase2GuestActivities || null;
state.phase2ReturnToMap = false;

/* ---------- Autenticação do aluno: inclui acesso direto ---------- */
function openAuthTab(role,tab){
  if(role === "professor"){
    $$('[data-prof-tab]').forEach(button =>
      button.classList.toggle('active',button.dataset.profTab === tab)
    );
    $("#professorLoginForm")?.classList.toggle("hidden",tab !== "login");
    $("#professorRegisterForm")?.classList.toggle("hidden",tab !== "register");
    return;
  }

  $$('[data-student-tab]').forEach(button =>
    button.classList.toggle('active',button.dataset.studentTab === tab)
  );

  $("#studentLoginForm")?.classList.toggle("hidden",tab !== "login");
  $("#studentRegisterForm")?.classList.toggle("hidden",tab !== "register");
  $("#studentDirectAccessPanel")?.classList.toggle("hidden",tab !== "direct");
}

function phase2CreateGuestActivities(){
  if(Array.isArray(state.phase2GuestActivities)) return state.phase2GuestActivities;

  const source = SYSTEM_DIVISION_BANK_N1_N2?.N2?.rows || [];
  state.phase2GuestActivities = source.map((row,index) => ({
    id:`phase2_guest_${index + 1}`,
    professorId:"phase2_guest",
    contextSlug:"divisao",
    area:"Matemática",
    module:"Divisão",
    title:row.title,
    statement:row.statement,
    question:row.question,
    answer:String(row.answer ?? ""),
    level:row.level || "N2",
    type:row.type || "Básico",
    unit:row.unit || "",
    operandA:row.operandA,
    operandB:row.operandB,
    origin:"system",
    collectionType:"system",
    collectionId:"phase2_guest_divisao",
    createdAt:new Date().toISOString()
  }));

  return state.phase2GuestActivities;
}

function phase2DirectAccess(){
  stopActivityTimer(false);
  setSession(null);

  state.role = "student";
  state.professor = null;
  state.student = {
    id:`guest_${Date.now()}`,
    classId:"phase2_guest",
    name:"Visitante",
    plainName:"Visitante",
    roster:0,
    directAccess:true,
    firstAccess:new Date().toISOString(),
    lastAccess:new Date().toISOString()
  };
  state.phase2GuestActivities = null;
  state.phase2CurrentLevel = null;
  state.phase2CurrentBlock = 0;

  setTopbar(true,"student");
  setTopbarIdentity("Visitante","Aluno • acesso direto");
  showStudentDashboard();
  toast("Acesso direto iniciado. O progresso desta sessão não está vinculado a uma turma.","success");
}

/* ---------- Fonte de dados FASE 1 / FASE 2 ---------- */
function phase2IsDivision(activity){
  const slug = String(activity?.contextSlug || "").toLowerCase();
  const module = String(activity?.module || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return slug === "divisao" || module.includes("divisao");
}

function phase2StudentActivities(data=loadData()){
  if(state.student?.directAccess){
    return phase2CreateGuestActivities();
  }

  const assignedIds = new Set(
    data.assignments
      .filter(item => item.classId === state.student?.classId)
      .map(item => item.activityId)
  );

  return data.activities.filter(item => assignedIds.has(item.id) && phase2IsDivision(item));
}

function phase2ActivityMissionNumber(activity,levelKey){
  const meta = PHASE2_LEVELS[levelKey];
  const title = String(activity?.title || "").trim();
  const preferred = title.match(new RegExp(`^${meta.prefix}\\s*0?(\\d{1,2})\\b`,`i`));
  if(preferred){
    const n = Number(preferred[1]);
    if(n >= 1 && n <= 15) return n;
  }

  const generic = title.match(/(?:^|\s)(\d{1,2})(?:\s|[-–—.:]|$)/);
  if(generic){
    const n = Number(generic[1]);
    if(n >= 1 && n <= 15) return n;
  }

  return null;
}

function phase2SubmissionFor(activity,data=loadData()){
  if(!activity || !state.student) return null;
  return data.submissions.find(item =>
    item.studentId === state.student.id &&
    item.activityId === activity.id
  ) || null;
}

function phase2LevelSlots(levelKey,data=loadData()){
  const items = phase2StudentActivities(data)
    .filter(item => normalizeDifficultyKey(item.type) === levelKey)
    .slice();

  const slots = Array.from({length:15},(_,index) => ({
    number:index + 1,
    activity:null,
    status:"locked",
    submission:null
  }));

  const used = new Set();
  const pending = [];

  items.forEach(activity => {
    const number = phase2ActivityMissionNumber(activity,levelKey);
    if(number && !used.has(number)){
      slots[number - 1].activity = activity;
      used.add(number);
    }else{
      pending.push(activity);
    }
  });

  pending.forEach(activity => {
    const target = slots.find(slot => !slot.activity);
    if(target) target.activity = activity;
  });

  // Status pedagógico: concluída/em andamento sempre prevalecem.
  slots.forEach(slot => {
    if(!slot.activity){
      slot.status = "locked";
      return;
    }
    const submission = phase2SubmissionFor(slot.activity,data);
    slot.submission = submission;
    if(submission?.resolved){
      slot.status = "completed";
    }else if(submission){
      slot.status = "in-progress";
    }else{
      slot.status = "pending";
    }
  });

  // Liberação sequencial. Uma missão pode ser iniciada quando a anterior existente foi concluída.
  let priorExistingCompleted = true;
  slots.forEach(slot => {
    if(!slot.activity) return;
    if(slot.status === "completed"){
      priorExistingCompleted = priorExistingCompleted && true;
      return;
    }
    if(slot.status === "in-progress"){
      priorExistingCompleted = false;
      return;
    }
    slot.status = priorExistingCompleted ? "available" : "locked";
    priorExistingCompleted = false;
  });

  return slots;
}

function phase2BlockEntries(levelKey,blockIndex,data=loadData()){
  const start = blockIndex * 5;
  return phase2LevelSlots(levelKey,data).slice(start,start + 5);
}

function phase2BlockUnlocked(levelKey,blockIndex,data=loadData()){
  if(blockIndex === 0) return true;
  const previous = phase2BlockEntries(levelKey,blockIndex - 1,data).filter(entry => entry.activity);
  if(!previous.length) return false;
  return previous.every(entry => entry.status === "completed");
}

function phase2RecommendedBlock(levelKey,data=loadData()){
  for(let block=0; block<3; block++){
    const entries = phase2BlockEntries(levelKey,block,data);
    if(entries.some(entry => entry.activity && entry.status !== "completed")){
      return phase2BlockUnlocked(levelKey,block,data) ? block : Math.max(0,block - 1);
    }
  }
  return 2;
}

function phase2LevelStats(levelKey,data=loadData()){
  const slots = phase2LevelSlots(levelKey,data);
  const assigned = slots.filter(slot => slot.activity).length;
  const completed = slots.filter(slot => slot.status === "completed").length;
  const progress = slots.filter(slot => slot.status === "in-progress").length;
  return {slots,assigned,completed,progress,percent:assigned ? Math.round((completed / assigned) * 100) : 0};
}

/* ---------- Dashboard do aluno ---------- */
function phase2RenderLevelCards(){
  const data = loadData();
  const configs = [
    ["basic","phase2BasicProgress","phase2BasicSummary"],
    ["intermediate","phase2IntermediateProgress","phase2IntermediateSummary"],
    ["advanced","phase2AdvancedProgress","phase2AdvancedSummary"]
  ];

  configs.forEach(([key,barId,summaryId]) => {
    const stats = phase2LevelStats(key,data);
    const bar = document.getElementById(barId);
    const summary = document.getElementById(summaryId);
    if(bar) bar.style.width = `${stats.percent}%`;
    if(summary){
      summary.textContent = `${stats.completed} concluída(s) • ${stats.progress} em andamento • ${stats.assigned} liberada(s)`;
    }
  });
}

function showStudentDashboard(){
  stopActivityTimer(false);
  state.currentActivity = null;
  state.materialBoard = null;
  state.phase2ReturnToMap = false;

  setTopbar(true,"student");
  setActiveTopNav("student-dashboard");

  const name = state.student?.plainName || state.student?.name || "Estudante";
  setTopbarIdentity(name,state.student?.directAccess ? "Aluno • acesso direto" : "Aluno");

  const welcome = $("#studentWelcome");
  const info = $("#studentClassInfo");
  if(welcome) welcome.textContent = `${name}, escolha seu nível de desafio`;

  if(info){
    if(state.student?.directAccess){
      info.textContent = "Acesso direto: explore o jogo sem criar perfil. Seu histórico não será vinculado a uma turma.";
    }else{
      const data = loadData();
      const classItem = data.classes.find(item => item.id === state.student?.classId);
      info.textContent = classItem
        ? `${classItem.name} • Divisão em três percursos: Básico, Intermediário e Avançado.`
        : "Divisão em três percursos: Básico, Intermediário e Avançado.";
    }
  }

  showScreen("screenStudentDashboard");
  phase2RenderLevelCards();
}

/* ---------- Mapa de missões ---------- */
function phase2StatusLabel(status){
  return ({
    completed:"Concluída",
    "in-progress":"Em andamento",
    available:"Disponível",
    locked:"Bloqueada"
  })[status] || "Bloqueada";
}

function phase2StatusIcon(status,number){
  if(status === "completed") return "✓";
  if(status === "in-progress") return "▶";
  if(status === "locked") return "🔒";
  return String(number).padStart(2,"0");
}

function phase2ImageFor(levelKey,blockIndex){
  return PHASE2_LEVELS[levelKey]?.images?.[blockIndex] || "";
}

function phase2ClearSceneAtmosphere(){
  const scene = $("#phase2Scene");
  const atmosphere = $("#phase2Atmosphere");
  const clouds = $("#phase2CloudsLayer");
  const birds = $("#phase2BirdsLayer");
  const water = $("#phase2WaterLayer");

  scene?.classList.remove("scene-b15natureza");
  atmosphere?.classList.add("hidden");

  if(clouds) clouds.innerHTML = "";
  if(birds) birds.innerHTML = "";
  if(water) water.innerHTML = "";
}

function phase2IsAnimatedNatureScene(filename){
  return /(^|\/)B15natureza\.(jpg|jpeg|png|webp)$/i.test(String(filename || "").trim());
}

function phase2RenderSceneAtmosphere(filename){
  const scene = $("#phase2Scene");
  const atmosphere = $("#phase2Atmosphere");
  const clouds = $("#phase2CloudsLayer");
  const birds = $("#phase2BirdsLayer");
  const water = $("#phase2WaterLayer");

  if(!scene || !atmosphere || !clouds || !birds || !water) return;

  // Regra da FASE 2: somente B15natureza recebe atmosfera em movimento.
  if(!phase2IsAnimatedNatureScene(filename)){
    phase2ClearSceneAtmosphere();
    return;
  }

  scene.classList.add("scene-b15natureza");
  atmosphere.classList.remove("hidden");

  clouds.innerHTML = `
    <span class="phase2-cloud phase2-cloud-a"></span>
    <span class="phase2-cloud phase2-cloud-b"></span>
    <span class="phase2-cloud phase2-cloud-c"></span>
  `;

  birds.innerHTML = `
    <span class="phase2-bird phase2-bird-far" aria-hidden="true"></span>
    <span class="phase2-bird phase2-bird-mid" aria-hidden="true"></span>
    <span class="phase2-bird phase2-bird-near" aria-hidden="true"></span>
  `;

  // A correnteza é animada por pseudo-elementos CSS no próprio layer.
  water.innerHTML = "";
}

function phase2ApplySceneImage(levelKey,blockIndex){
  const scene = $("#phase2Scene");
  const fallback = $("#phase2SceneFallback");
  if(!scene) return;

  const filename = phase2ImageFor(levelKey,blockIndex);
  scene.classList.add("is-transitioning");
  phase2ClearSceneAtmosphere();

  const probe = new Image();
  probe.onload = () => {
    scene.style.backgroundImage = `url("${filename}")`;
    fallback?.classList.add("hidden");

    // Água, nuvens e pássaros são adicionados apenas a B15natureza.
    phase2RenderSceneAtmosphere(filename);

    requestAnimationFrame(() => {
      setTimeout(() => scene.classList.remove("is-transitioning"),120);
    });
  };

  probe.onerror = () => {
    scene.style.backgroundImage = "linear-gradient(145deg,#0c1b2d,#132943 55%,#07111e)";
    fallback?.classList.remove("hidden");
    phase2ClearSceneAtmosphere();
    scene.classList.remove("is-transitioning");
  };

  probe.src = filename;
}

function phase2RenderMissionLayer(levelKey,blockIndex){
  const layer = $("#phase2MissionLayer");
  if(!layer) return;

  const data = loadData();
  const entries = phase2BlockEntries(levelKey,blockIndex,data);
  const positions = [10,30,50,70,90];

  layer.innerHTML = entries.map((entry,index) => {
    const status = entry.activity ? entry.status : "locked";
    const activityTitle = entry.activity?.title || `Missão ${String(entry.number).padStart(2,"0")}`;
    const cleanTitle = activityTitle.replace(/^[BIA]\s*\d+\s*[-–—.:]\s*/i,"");
    const disabled = !entry.activity || status === "locked";
    return `
      <button class="phase2-mission-node ${status}"
              type="button"
              style="--x:${positions[index]}%;--y:9%"
              data-phase2-mission="${entry.number}"
              ${disabled ? "disabled" : ""}>
        <span class="mission-orb">${phase2StatusIcon(status,entry.number)}</span>
        <span class="mission-label">
          <strong>${String(entry.number).padStart(2,"0")} • ${escapeHtml(cleanTitle || "Desafio")}</strong>
          <small>${phase2StatusLabel(status)}</small>
        </span>
      </button>
    `;
  }).join("");

  $$('[data-phase2-mission]',layer).forEach(button => {
    button.addEventListener("click",() => {
      const mission = Number(button.dataset.phase2Mission);
      const slot = phase2LevelSlots(levelKey,loadData())[mission - 1];
      if(!slot?.activity || slot.status === "locked") return;
      state.phase2ReturnToMap = true;
      openStudentActivity(slot.activity);
    });
  });
}

function phase2UpdateBlockNavigation(levelKey,blockIndex){
  const data = loadData();
  $$('[data-phase2-block]').forEach(button => {
    const block = Number(button.dataset.phase2Block);
    const unlocked = phase2BlockUnlocked(levelKey,block,data);
    button.classList.toggle("active",block === blockIndex);
    button.classList.toggle("locked",!unlocked);
    button.disabled = !unlocked;
  });

  const prev = $("#phase2PrevBlockBtn");
  const next = $("#phase2NextBlockBtn");
  if(prev) prev.disabled = blockIndex <= 0;
  if(next){
    const nextUnlocked = blockIndex < 2 && phase2BlockUnlocked(levelKey,blockIndex + 1,data);
    next.disabled = blockIndex >= 2 || !nextUnlocked;
    next.textContent = blockIndex >= 2 ? "ÚLTIMO BLOCO" : "PRÓXIMOS 5 DESAFIOS →";
  }
}

function phase2RenderGameMap(){
  const levelKey = state.phase2CurrentLevel || "basic";
  const blockIndex = Math.max(0,Math.min(2,Number(state.phase2CurrentBlock || 0)));
  const meta = PHASE2_LEVELS[levelKey];

  $("#phase2MapKicker").textContent = `${meta.label.toUpperCase()} • ${meta.theme.toUpperCase()}`;
  $("#phase2MapTitle").textContent = `Missões ${String(blockIndex*5+1).padStart(2,"0")}–${String(blockIndex*5+5).padStart(2,"0")}`;
  $("#phase2MapSubtitle").textContent = "Resolva os desafios para abrir novas etapas do percurso.";

  phase2ApplySceneImage(levelKey,blockIndex);
  phase2RenderMissionLayer(levelKey,blockIndex);
  phase2UpdateBlockNavigation(levelKey,blockIndex);
}

function phase2OpenLevel(levelKey,requestedBlock=null){
  if(!PHASE2_LEVELS[levelKey]) return;
  state.phase2CurrentLevel = levelKey;
  const data = loadData();
  const recommended = phase2RecommendedBlock(levelKey,data);
  const desired = requestedBlock === null ? recommended : Number(requestedBlock);
  state.phase2CurrentBlock = phase2BlockUnlocked(levelKey,desired,data) ? desired : recommended;
  showScreen("screenStudentGameMap");
  phase2RenderGameMap();
}

function phase2ReturnToMap(){
  stopActivityTimer(true);
  if(state.phase2CurrentLevel){
    showScreen("screenStudentGameMap");
    phase2RenderGameMap();
  }else{
    showStudentDashboard();
  }
}

/* ---------- Painel individual da participação ---------- */
function phase2ParticipationHtml(levelKey){
  const meta = PHASE2_LEVELS[levelKey];
  const data = loadData();
  const stats = phase2LevelStats(levelKey,data);
  const locked = stats.slots.filter(slot => slot.status === "locked").length;
  const available = stats.slots.filter(slot => slot.status === "available").length;

  const blocks = [0,1,2].map(block => {
    const entries = stats.slots.slice(block*5,block*5+5);
    return `
      <section class="phase2-participation-block">
        <h3>Missões ${String(block*5+1).padStart(2,"0")}–${String(block*5+5).padStart(2,"0")}</h3>
        ${entries.map(entry => {
          const status = entry.activity ? entry.status : "locked";
          const title = entry.activity?.title?.replace(/^[BIA]\s*\d+\s*[-–—.:]\s*/i,"") || "Aguardando atividade";
          return `
            <div class="phase2-participation-task">
              <span class="phase2-task-number">${String(entry.number).padStart(2,"0")}</span>
              <span class="phase2-task-title">${escapeHtml(title)}</span>
              <span class="phase2-task-status ${status}">${phase2StatusLabel(status)}</span>
            </div>
          `;
        }).join("")}
      </section>
    `;
  }).join("");

  return `
    <div class="phase2-participation-summary">
      <div class="phase2-participation-stat"><span>Concluídas</span><strong>${stats.completed}</strong></div>
      <div class="phase2-participation-stat"><span>Em andamento</span><strong>${stats.progress}</strong></div>
      <div class="phase2-participation-stat"><span>Disponíveis</span><strong>${available}</strong></div>
      <div class="phase2-participation-stat"><span>Bloqueadas</span><strong>${locked}</strong></div>
    </div>
    <div class="phase2-participation-tasks">${blocks}</div>
    <div class="phase2-report-actions">
      <button class="btn btn-outline" type="button" data-phase2-report-block="0">DOCX • MISSÕES 01–05</button>
      <button class="btn btn-outline" type="button" data-phase2-report-block="1">DOCX • MISSÕES 06–10</button>
      <button class="btn btn-outline" type="button" data-phase2-report-block="2">DOCX • MISSÕES 11–15</button>
      <button class="btn btn-primary" type="button" data-phase2-report-full="1">DOCX • ${meta.label.toUpperCase()} COMPLETO</button>
    </div>
    <div class="phase2-privacy-note">
      Este painel mostra apenas o seu próprio progresso. O histórico pedagógico detalhado de rascunhos, alterações e movimentações do Material Dourado é reservado ao professor para acompanhamento pedagógico.
    </div>
  `;
}

function phase2OpenParticipation(levelKey=state.phase2CurrentLevel || "basic"){
  if(!PHASE2_LEVELS[levelKey]) levelKey = "basic";
  const meta = PHASE2_LEVELS[levelKey];
  $("#phase2ParticipationTitle").textContent = `${meta.icon} ${meta.label} — ${meta.theme}`;
  $("#phase2ParticipationSubtitle").textContent = "Veja suas 15 etapas, estados e relatórios individuais.";
  $("#phase2ParticipationBody").innerHTML = phase2ParticipationHtml(levelKey);
  $("#phase2ParticipationModal").classList.remove("hidden");
  document.body.classList.add("phase2-participation-open");

  $$('[data-phase2-report-block]',$("#phase2ParticipationBody")).forEach(button => {
    button.addEventListener("click",() => phase2DownloadStudentDocx(levelKey,Number(button.dataset.phase2ReportBlock)));
  });
  $('[data-phase2-report-full]',$("#phase2ParticipationBody"))?.addEventListener("click",() => phase2DownloadStudentDocx(levelKey,null));
}

function phase2CloseParticipation(){
  $("#phase2ParticipationModal")?.classList.add("hidden");
  document.body.classList.remove("phase2-participation-open");
}

/* ---------- DOCX individual do aluno ---------- */
function phase2DocxEscape(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;");
}

function phase2DocxRun(text,{bold=false,size=24}={}){
  const safe = phase2DocxEscape(text);
  return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${safe}</w:t></w:r>`;
}

function phase2DocxParagraph(text,bold=false,{size=24,after=40,before=0}={}){
  return `<w:p><w:pPr><w:spacing w:before="${before}" w:after="${after}"/></w:pPr>${phase2DocxRun(text,{bold,size})}</w:p>`;
}

function phase2DocxLabeledParagraph(label,value,{size=24,after=20}={}){
  return `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr>${phase2DocxRun(`${label}:`,{bold:true,size})}${phase2DocxRun(` ${value ?? "—"}`,{size})}</w:p>`;
}

function phase2DocxMultilineLabel(label,value,{size=24,after=80}={}){
  const safeText = String(value ?? "").trim() || "—";
  const lines = safeText.split(/\r?\n/);
  let xml = `<w:p><w:pPr><w:spacing w:after="16"/></w:pPr>${phase2DocxRun(`${label}:`,{bold:true,size})}</w:p>`;
  lines.forEach(line => { xml += phase2DocxParagraph(line,false,{size,after:12}); });
  xml += `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr></w:p>`;
  return xml;
}

async function phase2DownloadStudentDocx(levelKey,blockIndex=null){
  if(typeof JSZip === "undefined"){
    toast("Não foi possível gerar o DOCX porque a biblioteca de documentos não carregou.","error");
    return;
  }

  const meta = PHASE2_LEVELS[levelKey];
  const data = loadData();
  const allSlots = phase2LevelSlots(levelKey,data);
  const slots = blockIndex === null ? allSlots : allSlots.slice(blockIndex*5,blockIndex*5+5);
  const studentName = state.student?.plainName || state.student?.name || "Estudante";
  const range = blockIndex === null ? "01–15" : `${String(blockIndex*5+1).padStart(2,"0")}–${String(blockIndex*5+5).padStart(2,"0")}`;

  let body = "";
  body += phase2DocxParagraph("PROJETO EDUCACIONAL 2.0 — FASE 2",true,{size:30,after:30});
  body += phase2DocxParagraph("Relatório individual de participação",true,{size:28,after:30});
  body += phase2DocxLabeledParagraph("Conteúdo","Divisão",{size:25});
  body += phase2DocxLabeledParagraph("Nível",meta.label,{size:25});
  body += phase2DocxLabeledParagraph("Aluno",studentName,{size:25});
  body += phase2DocxLabeledParagraph("Percurso",`${meta.theme} • Missões ${range}`,{size:25});
  body += phase2DocxLabeledParagraph("Gerado em",formatDateTime(new Date().toISOString()),{size:25,after:120});

  const printable = slots.filter(slot => slot.activity);
  if(!printable.length){
    body += phase2DocxParagraph("Nenhuma atividade foi disponibilizada neste intervalo.",false,{size:24,after:80});
  }

  printable.forEach((slot,index) => {
    const status = slot.status || "locked";
    const submission = slot.submission;
    const statement = String(slot.activity?.statement || "").trim() || "—";

    body += phase2DocxParagraph(`Missão ${String(slot.number).padStart(2,"0")} — ${slot.activity?.title || "Atividade"}`,true,{size:26,after:28,before:index ? 80 : 0});
    body += phase2DocxLabeledParagraph("Enunciado",statement,{size:24,after:24});
    body += phase2DocxLabeledParagraph("Situação",phase2StatusLabel(status),{size:24,after:18});

    if(submission){
      body += phase2DocxLabeledParagraph("Tentativas",String(Number(submission.attempts || 0)),{size:24,after:18});
      body += phase2DocxLabeledParagraph("Tempo ativo",formatDuration(submission.activeSeconds || 0),{size:24,after:18});
      body += phase2DocxLabeledParagraph("Último registro",formatDateTime(submission.updatedAt || submission.accessedAt),{size:24,after:18});
      body += phase2DocxLabeledParagraph("Resposta final registrada",submission.finalAnswer || "—",{size:24,after:18});
      body += phase2DocxLabeledParagraph("Ferramenta Material Dourado utilizada",submission.materialProgress ? "Sim" : "Não",{size:24,after:26});
      body += phase2DocxMultilineLabel("Registro no rascunho",submission.scratch || "—",{size:24,after:100});
    }else{
      body += phase2DocxLabeledParagraph("Tentativas","0",{size:24,after:18});
      body += phase2DocxLabeledParagraph("Tempo ativo","0min 00s",{size:24,after:18});
      body += phase2DocxLabeledParagraph("Último registro","—",{size:24,after:18});
      body += phase2DocxLabeledParagraph("Resposta final registrada","—",{size:24,after:18});
      body += phase2DocxLabeledParagraph("Ferramenta Material Dourado utilizada","Não",{size:24,after:26});
      body += phase2DocxMultilineLabel("Registro no rascunho","—",{size:24,after:100});
    }
  });

  body += phase2DocxParagraph("Este relatório apresenta apenas os registros individuais do próprio aluno. O histórico pedagógico detalhado permanece reservado ao professor.",false,{size:20,after:20,before:80});

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.folder("_rels").file(".rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word").file("document.xml",documentXml);
  zip.folder("word").folder("_rels").file("document.xml.rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);

  const blob = await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeLevel = meta.label.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\W+/g,"_");
  anchor.href = url;
  anchor.download = `Participacao_Divisao_${safeLevel}_${range.replace("–","_")}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  toast("Relatório DOCX gerado no formato individual de participação.","success");
}

/* ---------- Transição após blocos ---------- */
function phase2ShowChallengePrompt(nextBlock){
  if(nextBlock > 2 || !state.phase2CurrentLevel) return;
  const existing = document.getElementById("phase2ChallengeOverlay");
  existing?.remove();

  const level = PHASE2_LEVELS[state.phase2CurrentLevel];
  const overlay = document.createElement("div");
  overlay.id = "phase2ChallengeOverlay";
  overlay.className = "modal";
  overlay.innerHTML = `
    <div class="modal-card phase2-challenge-card">
      <span class="eyebrow">NOVO TRECHO DESBLOQUEADO</span>
      <h2>Desafiar os próximos 5 exercícios?</h2>
      <p>Você avançou no percurso ${escapeHtml(level.label)} — ${escapeHtml(level.theme)}. Um novo cenário representa sua progressão.</p>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" data-phase2-challenge-go>SIM, CONTINUAR</button>
        <button class="btn btn-outline" type="button" data-phase2-challenge-later>AGORA NÃO</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  $('[data-phase2-challenge-go]',overlay)?.addEventListener("click",() => {
    overlay.remove();
    state.phase2CurrentBlock = nextBlock;
    phase2ReturnToMap();
  });
  $('[data-phase2-challenge-later]',overlay)?.addEventListener("click",() => overlay.remove());
}

const phase2OriginalSubmitStudentAnswer = submitStudentAnswer;
submitStudentAnswer = function(){
  const activityBefore = state.currentActivity;
  phase2OriginalSubmitStudentAnswer();

  if(!activityBefore || !state.phase2CurrentLevel) return;
  const data = loadData();
  const submission = phase2SubmissionFor(activityBefore,data);
  if(!submission?.resolved) return;

  const slot = phase2LevelSlots(state.phase2CurrentLevel,data).find(entry => entry.activity?.id === activityBefore.id);
  if(!slot) return;

  if(slot.number === 5 && phase2BlockUnlocked(state.phase2CurrentLevel,1,data)){
    setTimeout(() => phase2ShowChallengePrompt(1),450);
  }else if(slot.number === 10 && phase2BlockUnlocked(state.phase2CurrentLevel,2,data)){
    setTimeout(() => phase2ShowChallengePrompt(2),450);
  }
};

/* ---------- Histórico detalhado: somente professor ---------- */
function phase2MaterialHistoryHtml(submission){
  const history = submission?.materialProgress?.board?.history;
  if(!Array.isArray(history) || !history.length) return "";
  return `
    <details class="phase2-teacher-history">
      <summary>HISTÓRICO DO MATERIAL DOURADO (${history.length})</summary>
      <div class="phase2-teacher-history-list">
        ${history.slice(-40).map((event,index) => `
          <div class="phase2-teacher-history-event">
            <strong>${index + 1}. ${escapeHtml(event.action || "movimentação")}</strong>
            <span> • ${escapeHtml(formatDateTime(event.at))}</span>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function renderStudentDetailBucket(title,statusKey,items){
  return `
    <section class="detail-status-column" data-status="${statusKey}">
      <h4>${escapeHtml(title)} (${items.length})</h4>
      ${items.length ? `
        <div class="detail-status-list">
          ${items.map(item => {
            if(statusKey === 'not-accessed'){
              return `
                <article class="detail-activity light">
                  <span class="student-status-chip is-not-accessed detail-activity-status">Não acessada</span>
                  <h5>${escapeHtml(item.activity.title)}</h5>
                  <p>${escapeHtml(item.activity.statement)}</p>
                </article>
              `;
            }

            const submission = item.submission;
            const history = Array.isArray(submission?.scratchHistory)
              ? submission.scratchHistory
              : (submission?.scratch ? [{at:submission.updatedAt || submission.accessedAt,text:submission.scratch,reason:'rascunho anterior'}] : []);

            return `
              <article class="detail-activity">
                <span class="student-status-chip ${statusKey === 'completed' ? 'is-completed' : 'is-in-progress'} detail-activity-status">${statusKey === 'completed' ? 'Concluída' : 'Em andamento'}</span>
                <h4>${escapeHtml(item.activity.title)}</h4>
                <p><strong>Acesso:</strong> ${escapeHtml(formatDateTime(submission?.accessedAt))}</p>
                <p><strong>Tempo ativo:</strong> ${escapeHtml(formatDuration(submission?.activeSeconds || 0))}</p>
                <p><strong>Tentativas:</strong> ${submission?.attempts || 0}</p>
                <div class="scratch-current-box">
                  <span>RASCUNHO ATUAL</span>
                  <p>${submission?.scratch ? escapeHtml(submission.scratch) : 'Nenhum rascunho registrado.'}</p>
                </div>
                <details class="scratch-history-details">
                  <summary>HISTÓRICO DO RASCUNHO (${history.length})</summary>
                  <div class="scratch-history-list">
                    ${history.length ? history.map((snapshot,index) => `
                      <article class="scratch-history-item">
                        <div class="scratch-history-head"><strong>Versão ${index + 1}</strong><span>${escapeHtml(formatDateTime(snapshot.at))}</span></div>
                        <small>${escapeHtml(formatScratchReason(snapshot.reason))}</small>
                        <pre>${escapeHtml(snapshot.text || '')}</pre>
                      </article>
                    `).join('') : `<p class="scratch-history-empty">Nenhuma versão do rascunho registrada.</p>`}
                  </div>
                </details>
                ${phase2MaterialHistoryHtml(submission)}
              </article>
            `;
          }).join('')}
        </div>
      ` : `<p>Nenhuma atividade nesta situação.</p>`}
    </section>
  `;
}

/* ---------- Eventos FASE 2 ---------- */
function phase2BindEvents(){
  $("#studentDirectAccessBtn")?.addEventListener("click",phase2DirectAccess);

  $$('[data-phase2-level]').forEach(button => {
    button.addEventListener("click",() => phase2OpenLevel(button.dataset.phase2Level));
  });

  $$('[data-phase2-participation]').forEach(button => {
    button.addEventListener("click",() => phase2OpenParticipation(button.dataset.phase2Participation));
  });

  $("#phase2BackToLevelsBtn")?.addEventListener("click",showStudentDashboard);
  $("#phase2OpenParticipationBtn")?.addEventListener("click",() => phase2OpenParticipation(state.phase2CurrentLevel || "basic"));
  $("#phase2CloseParticipationBtn")?.addEventListener("click",phase2CloseParticipation);
  $("#phase2ParticipationModal")?.addEventListener("click",event => {
    if(event.target.id === "phase2ParticipationModal") phase2CloseParticipation();
  });

  $$('[data-phase2-block]').forEach(button => {
    button.addEventListener("click",() => {
      const block = Number(button.dataset.phase2Block);
      if(!phase2BlockUnlocked(state.phase2CurrentLevel,block,loadData())) return;
      state.phase2CurrentBlock = block;
      phase2RenderGameMap();
    });
  });

  $("#phase2PrevBlockBtn")?.addEventListener("click",() => {
    if(state.phase2CurrentBlock <= 0) return;
    state.phase2CurrentBlock -= 1;
    phase2RenderGameMap();
  });

  $("#phase2NextBlockBtn")?.addEventListener("click",() => {
    const next = state.phase2CurrentBlock + 1;
    if(next > 2 || !phase2BlockUnlocked(state.phase2CurrentLevel,next,loadData())) return;
    state.phase2CurrentBlock = next;
    phase2RenderGameMap();
  });

  // Na FASE 2 o botão da atividade retorna ao mapa, não à lista antiga.
  const back = $("#backToStudentDashboardBtn");
  if(back){
    const clone = back.cloneNode(true);
    back.replaceWith(clone);
    clone.addEventListener("click",phase2ReturnToMap);
  }
}

document.addEventListener("DOMContentLoaded",phase2BindEvents);

