import {BrowserExtension} from './BrowserExtension';
import {canViewPage} from './navigation-access';
import './sourcing-monitor.css';
import {apiResponse} from './api-response';
const SourcingSettings=lazy(()=>import('./SourcingSettings').then(m=>({default:m.SourcingSettings})));
import './roles.css';
import './search-management.css';
import {hasPermission} from './access-policy';
const RolesPanel=lazy(()=>import('./RolesPanel').then(m=>({default:m.RolesPanel})));
import {NavigationTooltip} from './NavigationTooltip';
import './engagement-workspace.css';
import {ViewStateProvider} from './ViewState';
const navigationLabel=(name:string)=>({'Teams':'Access Management','People & access':'Access Management','Daily Work':'Engagement','Pipeline':'Engagement','Organization':'Admin','Delivery Monitor':'Sourcing Monitor','Performance':'Sourcing Performance','Search assignments':'Engagement Assignments'} as Record<string,string>)[name]||name;
import './engagement-layout.css';
import {useNavigationHistory} from './useNavigationHistory';
const Backups=lazy(()=>import('./Backups').then(m=>({default:m.Backups})));
import {normalizeEngagementVisit} from './navigation-history';
const InterviewTracker=lazy(()=>import('./InterviewTracker').then(m=>({default:m.InterviewTracker})));
const EngagementAdmin=lazy(()=>import('./EngagementAdmin').then(m=>({default:m.EngagementAdmin})));
const Engagement=lazy(()=>import('./Engagement').then(m=>({default:m.Engagement})));
import {searchDisplayId} from './SearchPicker';
const Performance=lazy(()=>import('./Performance').then(m=>({default:m.Performance})));
import './role-page.css';
import {CandidateRolePage} from './RolePageView';
const PeopleAndTeams=lazy(()=>import('./PeopleAndTeams').then(m=>({default:m.PeopleAndTeams})));
import {Candidates,CandidateProfile} from './Candidates';
const MyWork=lazy(()=>import('./MyWork').then(m=>({default:m.MyWork})));
import {AccountSettings} from './AccountSettings';
import React, { useEffect, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  List, PuzzlePiece,
  IdentificationCard, Buildings, Gauge, SquaresFour, ListChecks, Chats, Database, ShieldCheck, Plugs, SlidersHorizontal,
  PushPin,
  CaretDoubleLeft,
  Briefcase,
  CalendarBlank,
  ClipboardText,
  CheckCircle,
  ChartBar,
  Users,
  ArrowRight,
  SignOut,
  MagnifyingGlass,
  Plus,
  ArrowSquareOut,
  WarningCircle,
} from "@phosphor-icons/react";
import {hasRole,roleList,roleLabel, aggregate } from "./domain";
const CompanyUniverse=lazy(()=>import('./CompanyUniverse').then(m=>({default:m.CompanyUniverse})));
import {PeerSetup} from "./PeerSetup";
const DeliveryMonitor=lazy(()=>import('./DeliveryMonitor').then(m=>({default:m.DeliveryMonitor})));
const WeeklyPlanner=lazy(()=>import('./WeeklyPlanner').then(m=>({default:m.WeeklyPlanner})));
const TeamsPanel=lazy(()=>import('./TeamsPanel').then(m=>({default:m.TeamsPanel})));
const CRMPanel=lazy(()=>import('./CRMPanel').then(m=>({default:m.CRMPanel})));
import {ResearchPanel,PublicBrief} from "./ResearchPanel";
import { Setup } from './Setup';
import "./style.css";
import "./typography.css";
import "./navigation-rail.css";
type Row = Record<string, any>;
let workspace = sessionStorage.getItem("workspace") || "xqtiv";
let expectedUser:string|null=null;
let sessionRevision=0;
const sessionChannel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('xqtiv-account'):null;
function accountChanged(){sessionRevision++;expectedUser=null;window.dispatchEvent(new Event('xqtiv-account-changed'));}
if(sessionChannel)sessionChannel.onmessage=()=>accountChanged();
async function api(path: string, body?: unknown) {
  const publicCall=['login','accept','invitation'].includes(path),expected=publicCall?null:expectedUser,revision=sessionRevision;
  const r = await fetch('/api/'+path, {...((body as any)?.action==='historical-mapping-batch'?{signal:AbortSignal.timeout(45000)}:{}),method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Workspace':workspace,...(expected?{'X-Expected-User':expected}:{})},body:body?JSON.stringify(body):undefined});
  if(r.status===401&&expected){accountChanged();throw new Error('Please sign in again.');}
  const result=await apiResponse(r);
  if(result.code==='SESSION_CHANGED'||r.status===401&&!!expected){accountChanged();throw new Error(result.error||'Please sign in again.');}
  if(!r.ok)throw Object.assign(new Error(result.error||'Request failed.'),{status:r.status});
  if(!publicCall&&revision!==sessionRevision)throw new Error('Account changed while loading. Reload this page.');
  if(['login','accept','logout'].includes(path)){sessionRevision++;expectedUser=null;sessionChannel?.postMessage({changed:true});}
  return result;
}
async function downloadBackup(path:string,body:unknown){
 const revision=sessionRevision;
 const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Workspace':workspace,...(expectedUser?{'X-Expected-User':expectedUser}:{})},body:JSON.stringify(body)});
 if(!response.ok){const result=await response.json() as any;if(response.status===401||result.code==='SESSION_CHANGED')accountChanged();throw new Error(result.error||'Download failed.');}
 const blob=await response.blob();if(revision!==sessionRevision)throw new Error('Workspace or account changed. Download cancelled.');
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${workspace}-business-backup-${new Date().toISOString().slice(0,10)}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const fmt = (n: number) => new Intl.NumberFormat().format(n);
const today = () => new Date().toLocaleDateString("en-CA");
const dateLabel = (v: string) =>
  v
    ? new Date(v + "T12:00:00").toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not recorded";
function App() {
  const [data, setData] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [candidateId,setCandidateId]=useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [modal, setModal] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [deliveryStart,setDeliveryStart]=useState<any>({view:'daily',roles:null});
  const [allocationStart,setAllocationStart]=useState<{date:string;view:'decisions'|'allocation'}>({date:'',view:'decisions'});
  const [memberships,setMemberships]=useState<Row[]>([]);
  const [teamType,setTeamType]=useState('People & teams');
  const [peopleRoleFilter,setPeopleRoleFilter]=useState('');
  const [navPinned,setNavPinned]=useState(()=>{try{return localStorage.getItem('xqtiv.navigationPinned')==='true';}catch{return false;}});
  const [navExpanded,setNavExpanded]=useState(navPinned);
  useEffect(()=>{if(!navPinned)setNavExpanded(false);},[page,navPinned]);
  const toggleNavPin=()=>{const next=!navPinned;setNavPinned(next);setNavExpanded(next);try{localStorage.setItem('xqtiv.navigationPinned',String(next));}catch{}};
  const [collapsedModules,setCollapsedModules]=useState<Record<string,boolean>>({Organization:true});
  useEffect(()=>{if(!page)return;const group=['Browser extension','Search repository','Weekly plan','Delivery Monitor','Performance'].includes(page)?'Sourcing':['Daily Work','Pipeline','Search assignments','Interview tracker'].includes(page)?'Engagement':['Candidates','Companies'].includes(page)?'Talent assets':page==='My Work'?'Work':'Organization';setCollapsedModules(previous=>({...previous,[group]:false}));},[page]);
  const [engagementStart,setEngagementStart]=useState({role:'',mapping:'',stage:''});
  const [interviewRole,setInterviewRole]=useState('');
  const [viewStates,setViewStates]=useState<Record<string,Row>>({});
  const [repoState,setRepoState]=useState<Row>({});
  const [repoRestore,setRepoRestore]=useState(0);
  const [repoTab,setRepoTab]=useState("Candidate mappings");
  const [sheetDirty, setSheetDirty] = useState(false);
  const [mappingStart,setMappingStart]=useState('');
  const [companySearch,setCompanySearch]=useState('');
  const visitLabel=(v:any)=>v.page==='Pipeline'&&v.viewStates?.Pipeline?.['Engagement.role']?(data?.searches.find((r:Row)=>r.id===v.viewStates.Pipeline['Engagement.role'])?.title||'Engagement search'):v.page==='Search repository'&&!v.selected?'Search repository':v.page==='Search repository'?(data?.searches.find((r:Row)=>r.id===v.selected)?.title||'Search repository')+' · '+(v.repoTab==='Candidate mappings'?'Candidates':v.repoTab==='Role brief'?'JD':v.repoTab==='Candidate pitch'?'Pitch':v.repoTab==='Search strategy'?'Fit criteria':v.repoTab||'Searches'):v.page==='Candidates'&&v.candidateId?(data?.research?.records.find((r:Row)=>r.id===v.candidateId)?.name||'Candidate'):navigationLabel(v.page);
  const navigation=useNavigationHistory(data?workspace+':'+data.actor.id:'',
    {page,candidateId,selected,repoTab,repoState,viewStates,deliveryStart,allocationStart,engagementStart,interviewRole,mappingStart,companySearch},
    v=>{v=normalizeEngagementVisit(v);setViewStates(v.viewStates||{});setRepoRestore(n=>n+1);setSheetDirty(false);setPage(v.page);setCandidateId(v.candidateId);setSelected(v.selected);setRepoTab(v.repoTab);setRepoState(v.repoState||{});setDeliveryStart(v.deliveryStart);setAllocationStart(v.allocationStart);setEngagementStart(v.engagementStart);setInterviewRole(v.interviewRole);setMappingStart(v.mappingStart);setCompanySearch(v.companySearch||'');},sheetDirty);
  useEffect(()=>{
    if(!data)return;
    const url=new URL(location.href),id=url.searchParams.get('candidate');
    if(!id)return;
    if(canViewPage(data.actor,'Candidates')&&data.research?.records.some((r:Row)=>r.kind==='candidate'&&r.id===id)){setPage('Candidates');setCandidateId(id);}
    url.searchParams.delete('candidate');history.replaceState(history.state,'',url);
  },[data]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(sheetDirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[sheetDirty]);
  const invite = location.pathname.startsWith('/join/') ? location.pathname.split('/')[2] : new URLSearchParams(location.hash.slice(1)).get("invite");
  const [invitation,setInvitation] = useState<Row|null>(null);
  const joining = !!invite && invitation?.status === 'active';
  const [showPassword,setShowPassword] = useState(false);
  async function load() {
    try {
      const next=await api('state');expectedUser=next.actor.id;
      setMemberships((await api('workspaces')).memberships||[]);
      setPage(current=>current||[...(hasPermission(next.actor,'planning.monitor')||hasPermission(next.actor,'reviews.partner')?['Delivery Monitor']:[]),'My Work','Delivery Monitor','Pipeline','Candidates','Companies','Search repository','Weekly plan','Performance','Interview tracker','Teams','Integrations','Backups & exports','Account settings'].find(name=>canViewPage(next.actor,name))||'Account settings');
      // Operational totals come only from candidate mappings. Historical aggregates remain in storage.
      setData({...next,entries:next.entries.map((e:Row)=>e.source==='candidates'?e:{...e,mapped:null,peer:null,partner:null,peer_at:null,partner_at:null,flag:null,automated:true,notes:''})});
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{
    const changed=()=>{setData(null);setModal(null);setInvitation(null);setViewStates({});setSheetDirty(false);setPage('');setSelected('');setError('The signed-in account changed or expired. Reload to use the current browser account, or sign in again. Use separate browser profiles for simultaneous accounts.');};
    const focus=()=>{if(expectedUser)api('session').catch(()=>{});};
    window.addEventListener('xqtiv-account-changed',changed);window.addEventListener('focus',focus);
    return()=>{window.removeEventListener('xqtiv-account-changed',changed);window.removeEventListener('focus',focus);};
  },[]);
  useEffect(()=>{
    let refreshing=false;
    const refresh=async()=>{
      if(!expectedUser||sheetDirty||modal||document.visibilityState==='hidden'||refreshing)return;
      refreshing=true;try{await load();}finally{refreshing=false;}
    };
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[sheetDirty,modal]);
  useEffect(() => {
    if (invite) {
      api('invitation',{token:invite}).then(info=>{
        setInvitation(info);
        if(info.status==='expired'||info.status==='invalid')setError('This invitation is no longer valid. Ask your administrator for a new invitation.');
      }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
    } else load();
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (!data) {
        const result = await api(joining ? "accept" : "login", {
          ...b,
          email: joining ? invitation?.email : b.email,
          token: invite,
        });
        workspace = result.memberships[0]?.tenant || "xqtiv";
        sessionStorage.setItem("workspace", workspace);
        history.replaceState({}, "", "/");
        setInvitation(null);setModal(null);setPage("");setSelected("");
        await load();
      } else {
        const body = { ...modal, ...b };
        if (modal?.kind === "invite") {
          const result = await api("invite", body);
          setModal({ kind: "invitation", url: result.url, emailStatus: result.emailStatus });
          await load();
          return;
        }
        const saved = await api("mutate", body);
        setModal(null);
        setNotice("Saved to your workspace.");
        await load();
        if(modal?.kind==='search'){setSelected(saved.id);setRepoTab("Search strategy");setPage("Search repository");}
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="loading">
        <div className="skeleton w-64 h-8" />
        <div className="skeleton w-96 h-28" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!data)
    return (
      <main className="login">
        <section className="login-story">
          <div className="brand">
            <img src="/brand/xqtiv-logo.svg" alt="XQtiv"/><span>Search Operations</span>
          </div>
          <p className="eyebrow">THE SEARCH OPERATING WORKSPACE</p>
          <h1>
            Good searches
            <br />
            start with clarity.
          </h1>
          <p>
            One place for the week's priorities, the team's daily work, and the
            reviews that move a search forward.
          </p>
          <div className="login-flow">
            <span>Plan the work</span>
            <ArrowRight />
            <span>Find the people</span>
            <ArrowRight />
            <span>Review together</span>
          </div>
        </section>
        <section className="login-form">
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h2>{joining ? `Welcome, ${invitation?.name?.split(" ")[0] || "there"}` : "Welcome back"}</h2>
          <p>
            {joining
              ? invitation?.hasAccount ? "Enter your existing password to join this workspace." : "Choose a password. That’s all you need to get started."
              : invitation?.status==='used' ? "Your invitation was already accepted. Sign in with the password you chose." : "Sign in with your invited account."}
          </p>
          <form onSubmit={save}>
            <Field name="email" label="Work email" type="email" initial={joining?invitation?.email:""} readOnly={joining} required />
            <Field
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              minLength={joining ? 12 : undefined}
              required
              autoComplete={joining && !invitation?.hasAccount ? "new-password" : "current-password"}
            />
            <button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide password':'Show password'}</button>
            {joining&&!invitation?.hasAccount&&<p className="fine">Use at least 12 characters. A memorable phrase works well.</p>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="primary">
              {busy
                ? "Opening workspace…"
                : joining
                  ? "Open my workspace"
                  : "Sign in"}
              <ArrowRight />
            </button>
          </form>
          <p className="fine">
            One browser profile shares one sign-in across tabs. Use a separate browser profile or private window to test another account. Access is invitation-only. Contact your workspace administrator for
            an invitation or help with access.
          </p>
        </section>
      </main>
    );
  const actor = data.actor,
    isAdmin = hasRole(actor,'admin'),
    planner = hasPermission(actor,'planning.allocate');
  const sBy = Object.fromEntries(data.searches.map((s: Row) => [s.id, s])),
    tBy = Object.fromEntries(data.teams.map((t: Row) => [t.id, t])),
    pBy = Object.fromEntries(data.staff.map((s: Row) => [s.id, s]));
  const filtered = data.entries.filter(
    (e: Row) =>
      (!from || e.work_date >= from) &&
      (!to || e.work_date <= to) &&
      (!selected || e.search_id === selected),
  );
  const totals = aggregate(filtered),
    flagged = filtered.filter((e: Row) => e.flag).length;
  const assignments = data.assignments.filter(
    (a: Row) =>
      (!from || a.work_date >= from) &&
      (!to || a.work_date <= to) &&
      (!selected || a.search_id === selected),
  );
  const list = data.searches.filter((s: Row) =>
    (s.title + " " + s.client + " " + s.external_id)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const queue=(data.research?.records||[]).filter((m:Row)=>m.kind==='mapping'&&['Peer review','Partner review'].includes(m.status));

  const nav: [string, React.ElementType,string][] = [
    ['My Work',ClipboardText,'Work'],
    ['Candidates',IdentificationCard,'Talent assets'],
    ['Companies',Buildings,'Talent assets'],
    ['Search repository',MagnifyingGlass,'Sourcing'],
    ['Browser extension',PuzzlePiece,'Sourcing'],
    ['Weekly plan',CalendarBlank,'Sourcing'],
    ['Delivery Monitor',Gauge,'Sourcing'],
    ['Performance',ChartBar,'Sourcing'],
    ['Pipeline',SquaresFour,'Engagement'],
    ['Interview tracker',Chats,'Engagement'],
    ['Teams',Users,'Organization'],
    ...((hasPermission(actor,'data.backup')||hasPermission(actor,'data.export'))?[['Backups & exports',Database,'Organization'] as [string,React.ElementType,string]]:[]),
    ...(hasPermission(actor,'integrations.manage')?[['Sourcing settings',SlidersHorizontal,'Organization'] as [string,React.ElementType,string],['Integrations',Plugs,'Organization'] as [string,React.ElementType,string]]:[]),
    ...(hasPermission(actor,'engagement.config')?[['Engagement Config',SlidersHorizontal,'Organization'] as [string,React.ElementType,string]]:[]),
  ];
  const open = (m: Row) => {
    setError("");
    setModal(m);
  };
  const entriesFor = (id: string) =>
    data.entries.filter((e: Row) => e.assignment_id === id);
  function cards(entries: Row[]) {
    const m = aggregate(entries as any);
    return (
      <div className="metrics">
        <Metric label="Profiles mapped" value={fmt(m.mapped)} />
        <Metric label="Team approved" value={fmt(m.peer)} />
        <Metric label="Partner approved" value={fmt(m.partner)} />
        <Metric
          label="Partner / mapped"
          value={
            m.approvalRate === null
              ? "—"
              : (m.approvalRate * 100).toFixed(1) + "%"
          }
        />
      </div>
    );
  }
  function entryRows(entries: Row[]) {
    return entries.map((e: Row) => (
      <div className="entry" key={e.id}>
        <div>
          <strong>{pBy[e.staff_id]?.name || "Removed user"}</strong>
          {e.flag && (
            <span className="flag">
              <WarningCircle />
              Needs reconciliation
            </span>
          )}
          {e.notes && <p>{e.notes}</p>}
        </div>
        <div>
          <small>Mapped</small>
          <strong>{e.mapped ?? "—"}</strong>
        </div>
        <div>
          <small>Team review</small>
          <strong>{e.peer ?? "Pending"}</strong>
        </div>
        <div>
          <small>Partner</small>
          <strong>{e.partner ?? "Pending"}</strong>
        </div>
        <div className="row-actions">
          {e.source==='candidates'&&<button onClick={()=>{setSelected(e.search_id);setRepoTab("Candidate mappings");setPage("Search repository");}}>View mappings</button>}
        </div>
      </div>
    ));
  }
  return (
    <div className={"app navigation-shell "+(navExpanded?"navigation-expanded":"navigation-collapsed")}>
      <aside className="app-sidebar" aria-label="Application sidebar" onKeyDown={e=>{if(e.key==='Escape'&&!navPinned)setNavExpanded(false);}}>
        <div className="sidebar-controls"><button aria-label={navExpanded?'Collapse navigation':'Expand navigation'} title={navExpanded?'Collapse navigation':'Expand navigation'} aria-expanded={navExpanded} aria-controls="application-navigation" onClick={()=>{if(navExpanded&&navPinned){setNavPinned(false);try{localStorage.setItem('xqtiv.navigationPinned','false');}catch{}}setNavExpanded(!navExpanded);}}>{navExpanded?<CaretDoubleLeft size={20}/>:<List size={20}/>}</button>{navExpanded&&<button aria-label={navPinned?'Unpin navigation':'Keep navigation open'} title={navPinned?'Unpin navigation':'Keep navigation open'} aria-pressed={navPinned} onClick={toggleNavPin}><PushPin size={18} weight={navPinned?'fill':'regular'}/></button>}</div>
        <div className="brand">
          <img src="/brand/xqtiv-logo.svg" alt="XQtiv"/><span>Search Operations</span>
        </div>
        <NavigationTooltip collapsed={!navExpanded}/><nav id="application-navigation" aria-label="Main navigation">
          {Array.from(new Set(nav.filter(item=>canViewPage(actor,item[0])).map(item=>item[2]))).map(group=><section className="nav-module" key={group}><button className="nav-module-toggle" aria-expanded={!collapsedModules[group]} aria-controls={'nav-'+group.replaceAll(' ','-')} onClick={()=>setCollapsedModules(previous=>({...previous,[group]:!previous[group]}))}><span>{navigationLabel(group)}</span><span aria-hidden="true">{collapsedModules[group]?'▸':'▾'}</span></button><div id={'nav-'+group.replaceAll(' ','-')} hidden={navExpanded&&!!collapsedModules[group]}>{nav.filter(item=>item[2]===group&&(canViewPage(actor,item[0]))).map(([label,Icon])=>(<React.Fragment key={label}>
            <button
              key={label}
              aria-label={navigationLabel(label)} title={!navExpanded?navigationLabel(label):undefined} aria-current={page===label?"page":undefined}
              className={page === label ? "active" : ""}
              onClick={() => {
                if (sheetDirty && !confirm("Discard unsaved changes?")) return;
                setSheetDirty(false);
                if(label==='Candidates')setCandidateId('');
                if(label==='Search repository'){setSelected('');setRepoTab('Candidate mappings');}
                if(label==='Companies')setCompanySearch('');
                if(label==='Pipeline'){setEngagementStart({role:'',mapping:'',stage:''});}
                if(label==='Interview tracker')setInterviewRole('');
                if(label==='Delivery Monitor')setDeliveryStart({view:'daily',roles:null});
                if(label==='Weekly plan')setAllocationStart({date:'',view:'decisions'});
                setMappingStart('');setPage(label);if(!navPinned)setNavExpanded(false);
                setNotice("");
              }}
            >
              <Icon size={21} weight="fill" />
              <span className="nav-item-label">{navigationLabel(label)}</span>
              {label === "Reviews" && queue.length > 0 && (
                <span className="nav-count">{queue.length}</span>
              )}
            </button>
            </React.Fragment>
          ))}</div></section>)}
        </nav>
        <div className="identity">
          <strong>{actor.name}</strong>
          {memberships.length>1?<label>Workspace<select value={workspace} onChange={async e=>{if(sheetDirty&&!confirm('Discard unsaved changes and switch workspace?'))return;sessionRevision++;workspace=e.target.value;sessionStorage.setItem('workspace',workspace);setData(null);setLoading(true);setModal(null);setSelected('');setCompanySearch('');setCandidateId('');setEngagementStart({role:'',mapping:'',stage:''});setInterviewRole('');setPage('');setSheetDirty(false);await load();}}>{memberships.map(m=><option key={m.tenant} value={m.tenant}>{m.tenant==='xqtiv'?'XQtiv':m.tenant}</option>)}</select></label>:<small>{workspace==='xqtiv'?'XQtiv':workspace}</small>}
          <small className="identity-email">{actor.email}</small>
          <small>{roleList(actor).map(r=>actor.roleNames?.[r]||roleLabel(r)).join(' · ')}</small>
          <button aria-label="Account settings" title={!navExpanded?'Account settings':undefined} className={page==='Account settings'?'active':''} onClick={()=>{if(sheetDirty&&!confirm('Discard unsaved changes?'))return;setSheetDirty(false);setPage('Account settings');}}><Users/><span className="nav-item-label">Account settings</span></button>
          <button aria-label="Sign out" title={!navExpanded?'Sign out':undefined}
            onClick={async () => {
              if (sheetDirty && !confirm("Discard unsaved changes and sign out?")) return;
              setSheetDirty(false);
              await api("logout", {});
              setData(null);setInvitation(null);setModal(null);setPage("");history.replaceState({},"","/");
            }}
          >
            <SignOut />
            <span className="nav-item-label">Sign out</span>
          </button>
        </div>
      </aside>
      <main className={"main"+(["Search repository","Companies","Candidates","Delivery Monitor","Performance","Engagement","Pipeline","Daily Work","Search assignments","Interview tracker","Engagement Config","Backups & exports"].includes(page)?" compact-workspace":"")}><Suspense fallback={<p role="status" className="muted">Loading screen…</p>}><ViewStateProvider key={page+repoRestore} state={viewStates[page]||{}} change={patch=>setViewStates(previous=>({...previous,[page]:{...previous[page],...patch}}))}>
        {!canViewPage(actor,page)?<section className="panel"><h2>Page unavailable</h2><p>Your role does not have access to this page.</p><button onClick={()=>setPage(nav.find(([name])=>canViewPage(actor,name))?.[0]||'Account settings')}>Open available page</button></section>:<>
        {!(page === "Candidates" && candidateId) && <header>
          <div>
            <h1>{page === "Search repository" && sBy[selected] ? sBy[selected].title : page==='Pipeline'?'Engagement':navigationLabel(page)}</h1>
          </div>
        </header>}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {error && !modal && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!["Browser extension","Sourcing settings","Searches","Account settings","Search repository","My Work","Delivery Monitor","Performance","Companies","Teams","Candidates","People & access","Engagement","Pipeline","Daily Work","Search assignments","Interview tracker","Engagement Config","Backups & exports"].includes(page)  && page !== "Integrations" && page !== "Weekly plan" && (
          <div className="filters">
            <label>
              From
              <input
                type="date"
                value={from}
                disabled={sheetDirty}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                value={to}
                disabled={sheetDirty}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            {<label className="search-filter">
              Search
              <select
                value={selected}
                disabled={sheetDirty}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">All searches</option>
                {data.searches.map((s: Row) => (
                  <option key={s.id} value={s.id}>
                    {s.client} · {s.title}
                  </option>
                ))}
              </select>
            </label>}
            <button
              onClick={() => {
                if (sheetDirty) return;
                setFrom("");
                setTo("");
                setSelected("");

              }}
            >
              Clear filters
            </button>
          </div>
        )}
        {page==='Sourcing settings'&&hasPermission(actor,'integrations.manage')&&<SourcingSettings data={data} api={api} reload={load} onDirty={setSheetDirty}/>}
        {page==='Account settings'&&<AccountSettings api={api} onDirty={setSheetDirty} email={actor.email} reload={load}/>}
        {page === "Integrations" && <CRMPanel partners={data.partners || []} searches={data.searches} api={api} reload={load} />}
        {page === "Searches" && (
          <>
            <div className="searchbox">
              <MagnifyingGlass size={22} />
              <input
                aria-label="Find a search"
                placeholder="Search by client, role, or CRM ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="search-list">
              {list
                .map((s: Row) => {
                  const es = data.entries.filter((e: Row) => e.search_id === s.id),
                    m = aggregate(es as any);
                  return (
                    <details className="search-card" key={s.id}>
                      <summary>
                        <span>
                          <small>
                            {s.client}{" "}
                            {s.external_id && " / CRM " + s.external_id}
                          </small>
                          <strong>{s.title}</strong>
                        </span>
                        <span className="badge">Status: {s.status||'Not set'}</span>
                        <span className="search-stat">
                          <strong>{m.mapped}</strong>
                          <small>mapped</small>
                        </span>
                        <span className="search-stat">
                          <strong>{m.partner}</strong>
                          <small>approved</small>
                        </span>
                      </summary>
                      <div className="search-detail">
                        <div className="search-meta"><span>Engagement partner: <strong>{s.partner||'Not assigned'}</strong></span>{s.start_date&&<span>Search start: {dateLabel(s.start_date)}</span>}</div>
                        {s.notes && <p>{s.notes}</p>}
                        <div className="row-actions search-actions">
                          <button onClick={()=>{setSelected(s.id);setRepoTab("Target companies");setPage("Search repository");}}>Search repository</button>

                          <button
                            onClick={() => {
                              setSelected(s.id);
                              setDeliveryStart({view:'daily',roles:[s.id]});setPage('Delivery Monitor');
                            }}
                          >
                            Sourcing work
                          </button>
                          <button
                            onClick={() => {
                              setSelected(s.id);
                              setPage("Performance");
                            }}
                          >
                            Performance
                          </button>
                          {planner && (
                            <button
                              onClick={() =>
                                (setSelected(s.id), setPage("Weekly plan"))
                              }
                            >
                              Weekly assignments
                            </button>
                          )}
                          {hasPermission(actor,'search.partner')&&<button onClick={()=>open({kind:'search-owner',...s})}>Edit engagement partner</button>}
                        </div>
                        {data.assignments.some((a:Row)=>a.search_id===s.id&&a.link)&&<details><summary>Reference links</summary><p className="fine">Legacy links to external candidate lists; not required for planning.</p>{Array.from(new Set<string>(data.assignments.filter((a:Row)=>a.search_id===s.id&&a.link).map((a:Row)=>a.link))).map(link=><a className="external-link" key={link} href={link} target="_blank" rel="noreferrer">Open candidate reference <ArrowSquareOut/></a>)}</details>}
                      </div>
                    </details>
                  );
                })}
            </div>
          </>
        )}
        {page === "Weekly plan" && <WeeklyPlanner onCandidate={id=>{setCandidateId(id);setPage("Candidates");}} data={data} api={api} reload={load} initialSearch={selected} initialDate={allocationStart.date} initialView={allocationStart.view} onDirty={setSheetDirty} onTeams={()=>setPage('Teams')}/>}
        {page==='Backups & exports'&&(hasPermission(actor,'data.backup')||hasPermission(actor,'data.export'))&&<Backups actor={actor} api={api} download={downloadBackup}/>}
        {['Pipeline','Search assignments'].includes(page)&&<Engagement onAllAssignments={()=>setPage('Search assignments')} initialRole={engagementStart.role} initialMapping={page==='Pipeline'?engagementStart.mapping:''} initialStage={engagementStart.stage} key={page+engagementStart.mapping} section={page} onInterviews={(id:string)=>{setViewStates(previous=>({...previous,'Interview tracker':{...previous['Interview tracker'],'InterviewTracker.role':id}}));setInterviewRole(id);setPage('Interview tracker');}} data={data} api={api} reload={load} onDirty={setSheetDirty} onCandidate={(id:string)=>{setCandidateId(id);setPage('Candidates');}}/>}
        {page==='Interview tracker'&&<InterviewTracker onKanban={(role:string,mapping:string)=>{setViewStates(previous=>({...previous,Pipeline:{...previous.Pipeline,'Engagement.role':role,'Engagement.unifiedLayout':'Kanban','Engagement.queueBucket':'all','Engagement.group':'all','Engagement.candidateQuery':'','Engagement.searchStatus':'all','Engagement.scope':'all','Engagement.focus':mapping}}));setEngagementStart({role,mapping:'',stage:''});setPage('Pipeline');}} key={interviewRole} initialRole={interviewRole} data={data} api={api} reload={load} onDirty={setSheetDirty} onCandidate={(id:string)=>{setCandidateId(id);setPage('Candidates');}}/>}
        {page==='Engagement Config'&&hasPermission(actor,'engagement.config')&&<EngagementAdmin data={data} api={api} reload={load} onDirty={setSheetDirty} onCandidate={(id:string)=>{setCandidateId(id);setPage('Candidates');}}/>}
        {page==='My Work'&&hasRole(data.actor,'engagement')&&<Engagement mine data={data} api={api} reload={load} onDirty={setSheetDirty} onCandidate={(id:string)=>{setCandidateId(id);setPage('Candidates');}}/>}
        {page==='My Work'&&(!hasRole(data.actor,'engagement')||hasRole(data.actor,'researcher')||hasRole(data.actor,'partner')||hasRole(data.actor,'super_admin'))&&<MyWork data={data} api={api} reload={load} onDirty={setSheetDirty} onCandidate={id=>{setCandidateId(id);setPage("Candidates");}} onOpen={(id,tab)=>{setSelected(id);setRepoTab(tab);setPage("Search repository");}}/>}
        {page==='Browser extension'&&<BrowserExtension/>}
        {page==='Search repository'&&<ResearchPanel initialState={repoState} onStateChange={setRepoState} onCreateSearch={()=>open({kind:"search"})} onTabChange={setRepoTab} onReturn={mappingStart&&navigation.back?()=>navigation.go('back'):undefined} returnLabel={navigation.back?'Back to '+visitLabel(navigation.back):undefined} initialMapping={mappingStart} onEditPartner={s=>open({kind:"search-owner",...s})} onRoleChange={setSelected} onCandidate={id=>{setCandidateId(id);setPage("Candidates");}} key={page+repoRestore} data={data} api={api} reload={load} view={page} initialRole={page==='Search repository'?selected:''} initialTab={repoTab} onDirty={setSheetDirty} onCompanies={id=>{setCompanySearch(id);setPage("Companies");}}/>}
        {page === 'Companies'&&<CompanyUniverse data={data} api={api} reload={load} onDirty={setSheetDirty} initialRole={companySearch} onOpen={id=>{setSelected(id);setRepoTab("Target companies");setPage("Search repository");}}/>}

        {page==='Candidates'&&candidateId&&<CandidateProfile key={candidateId} id={candidateId} data={data} api={api} reload={load} onDirty={setSheetDirty} backLabel={navigation.back?.page==='Search repository'?'Back to '+(sBy[navigation.back.selected]?.title||'search'):navigation.back?'Back to '+visitLabel(navigation.back):'Back to candidates'} onBack={()=>navigation.back?navigation.go('back'):setCandidateId('')} onRole={id=>{setSelected(id);setRepoTab('Candidate mappings');setPage('Search repository');}}/>}
        {page==='Candidates'&&!candidateId&&<Candidates onCandidate={setCandidateId} data={data} api={api} reload={load} onDirty={setSheetDirty} onOpen={id=>{setSelected(id);setRepoTab("Candidate mappings");setPage("Search repository");}}/>}
        {(page==='Teams'||page==='People & access')&&<div className="people-teams-workspace"><div className="research-tabs" role="group" aria-label="Access Management sections">{['People & teams',...(actor.roles?.includes('super_admin')?['Roles & permissions']:[])].map(type=><button key={type} aria-pressed={teamType===type} className={teamType===type?'primary':''} onClick={()=>{if(!sheetDirty||confirm('Discard unsaved edits?'))setTeamType(type);}}>{type}</button>)}</div>{teamType==='Roles & permissions'&&actor.roles?.includes('super_admin')?<RolesPanel api={api} reload={load} onDirty={setSheetDirty} onShowPeople={(role:string)=>{setPeopleRoleFilter(role);setTeamType('People & teams');}}/>:hasPermission(actor,'users.view')?<PeopleAndTeams data={data} api={api} reload={load} onDirty={setSheetDirty} roleFilter={peopleRoleFilter} onRoleFilterChange={setPeopleRoleFilter} onAddTeam={()=>open({kind:'team'})}/>:<TeamsPanel data={data} api={api} reload={load} onDirty={setSheetDirty} onAdd={()=>open({kind:'team'})}/>}</div>}

        {page === "Delivery Monitor" && <DeliveryMonitor api={api} reload={load} onDirty={setSheetDirty} data={data} initialState={deliveryStart} onStateChange={setDeliveryStart} initialView={deliveryStart.view} initialRoles={deliveryStart.roles} onOpen={(id,tab,mapping='')=>{setMappingStart(mapping);setSelected(id);setRepoTab(tab);setPage('Search repository');}} onCandidate={id=>{setCandidateId(id);setPage('Candidates');}}/>}
        {page === "Performance" && <Performance onOpen={(id,mapping)=>{setMappingStart(mapping);setSelected(id);setRepoTab("Candidate mappings");setPage("Search repository");}} data={data} api={api} reload={load} onDirty={setSheetDirty} onDecision={id=>{setViewStates(previous=>({...previous,'Weekly plan':{'WeeklyPlanner.roles':[id],'WeeklyPlanner.view':'decisions'}}));setSelected(id);setAllocationStart({date:'',view:'decisions'});setPage('Weekly plan');}}/>}

        <footer>
          <button onClick={() => load()}>Refresh data</button>
        </footer>
      </>}
      </ViewStateProvider></Suspense></main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="modal"
          >
            <div className="section-head">
              <h2 id="modal-title">
                {
                  (
                    {
                      search: "Create a search",
                      "search-owner": "Search engagement partner",
                      entry: "Log sourcing output",
                      review:
                        modal.stage === "peer"
                          ? "Team review"
                          : "Partner review",
                      reopen: "Reopen reviewed output",
                      invite: "Invite a colleague",
                      invitation: "Invitation ready",
                      staff: "Add a researcher",
                      team: "Add a team",
                      members: "Workspace accounts",
                    } as Record<string, string>
                  )[modal.kind]
                }
              </h2>
              <button
                aria-label="Close dialog"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Close
              </button>
            </div>
            {modal.kind === "invitation" ? (
              <>
                <p role="status">
                  {modal.emailStatus === 'accepted'
                    ? 'Invitation submitted for email delivery. You can also share the link below.'
                    : modal.emailStatus === 'unconfirmed'
                      ? 'Email delivery could not be confirmed. Your invitation is ready; copy the link below and share it privately.'
                      : 'Email invitations are not connected yet. Copy the link below and share it privately.'}
                </p>
                <p>
                  Share this single-use link privately with the intended
                  colleague. It expires in seven days.
                </p>
                <textarea readOnly value={modal.url} />
                <button
                  className="primary"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(modal.url)
                      .then(() => setNotice("Invitation copied."))
                  }
                >
                  Copy invitation
                </button>
              </>
            ) : modal.kind === "members" ? (
              <>
                {modal.members.map((m: Row) => (
                  <div className="work-row" key={m.id}>
                    <span>
                      <strong>{m.name}</strong>
                      <small>
                        {m.email} · {m.role} · {m.status==='Peer review'?'Team review':m.status}
                      </small>
                    </span>
                    {m.id !== actor.id && m.status === "active" && (
                      <button
                        onClick={async () => {
                          await api("revoke", { id: m.id });
                          setModal({ ...modal, members: await api("members") });
                        }}
                      >
                        Revoke access
                      </button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <form onSubmit={save}>
                {modal.kind === "search" && (
                  <>
                    <Field name="client" label="Client company" required />
                    <Field name="title" label="Search title" required />
                    <Field name="start_date" label="Start date" type="date" />
                    <Select name="partner_id" label="Engagement partner" values={[["","Not assigned"],...(data.partners || []).map((p:Row)=>[p.id,p.name])]}/>
                  </>
                )}
                {modal.kind === 'search-owner' && <><p>{modal.client} · {modal.title}</p>{modal.partner&&!modal.partner_id&&<p className="fine">Previously recorded: {modal.partner}. Select the partner’s account below.</p>}<Select name="partner_id" label="Engagement partner" initial={modal.partner_id || ''} values={[["","Not assigned"],...(data.partners || []).map((p:Row)=>[p.id,p.name])]}/><p className="fine">Set once for this search. Available partners are active Admin and Partner accounts. Invite missing partners from People & access.</p></>}
                {modal.kind === "entry" && (
                  <Field
                    name="mapped"
                    label="Profiles mapped"
                    type="number"
                    min={0}
                    initial={modal.mapped ?? ""}
                    required
                  />
                )}
                {modal.kind === "review" && (
                  <>
                    <p>
                      {modal.mapped ?? 0} mapped · {modal.peer ?? "Pending"}{" "}
                      peer-approved
                    </p>
                    <Field
                      name="approved"
                      label={
                        modal.stage === "peer"
                          ? "Profiles passing team review"
                          : "Profiles approved by partner"
                      }
                      type="number"
                      min={0}
                      initial={modal[modal.stage] ?? ""}
                      required
                    />
                  </>
                )}
                {modal.kind === "invite" && (
                  <>
                    <Field name="name" label="Full name" initial={modal.name} required />
                    <Field
                      name="email"
                      label="Work email"
                      initial={modal.email}
                      type="email"
                      required
                    />
                    <Select
                      name="role"
                      label="Access role"
                      values={[
                        "researcher",
                        "partner",
                        "planner",
                        "founder",
                        "admin",
                      ].map((s) => [s, s])}
                    />
                    <Select
                      name="staffId"
                      label="Link researcher (optional)"
                      initial={modal.staffId}
                      values={[
                        ["", "No staff link"],
                        ...data.staff.filter((s:Row)=>!s.archived).map((s: Row) => [s.id, s.name]),
                      ]}
                    />
                    <p className="fine">
                      Link researchers to their staff record so they can log
                      their own output. Administrator access includes all
                      workspace data and member management.
                    </p>
                  </>
                )}
                {["staff", "team"].includes(modal.kind) && (
                  <Field name="name" label="Name" required />
                )}
                {!["invite", "staff", "team", "search-owner"].includes(modal.kind) && (
                  <label>
                    Notes{" "}
                    {modal.kind === "reopen" ? "(required)" : "(optional)"}
                    <textarea
                      name="notes"
                      defaultValue={modal.notes ?? ""}
                      required={modal.kind === "reopen"}
                      rows={3}
                    />
                  </label>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button className="primary" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : modal.kind === "invite"
                      ? "Create invitation"
                      : "Save"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Field({ label, name, type = "text", initial, ...props }: any) {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={initial} {...props} />
    </label>
  );
}
function Select({ label, name, values, initial }: any) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={initial}>
        {values.map(([v, l]: string[]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function Metric({ label, value }: any) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({ title, body }: any) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(location.pathname === '/role-invite' ? <CandidateRolePage/> : location.pathname === '/brief' ? <PublicBrief/> : location.pathname === '/setup' ? <Setup /> : <App />);


