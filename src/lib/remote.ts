import { type User, type RealtimeChannel } from '@supabase/supabase-js';
import { createDefaultMissions, defaultState, type Announcement, type Attendance, type Person, type RallyConfig, type RallyControl, type RallyState, type WeekMission, type WeeklyScore } from './rally';
import { supabase } from '../integrations/supabase/client';

export type UserRole = 'admin' | 'leader' | 'viewer';
export type SessionProfile = { id: string; role: UserRole; tribeId: string | null; church: string | null; email: string | null };

const fail = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

export async function loadRemoteState(): Promise<RallyState | null> {
  const user = (await supabase.auth.getUser()).data.user;
  const [rally, missions, people, attendance, scores, control, announcements] = await Promise.all([
    supabase.from('rallies_current').select('*').eq('id', 1).maybeSingle(),
    supabase.from('missions').select('*').order('week'),
    user ? supabase.from('people').select('*') : Promise.resolve({ data: [], error: null }),
    user ? supabase.from('attendance').select('*') : Promise.resolve({ data: [], error: null }),
    supabase.from('weekly_scores').select('*').order('week'),
    supabase.from('system_control').select('*').eq('id', 1).maybeSingle(),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }),
  ]);
  const row = fail(rally);
  if (!row) return null;
  const missionsRows = fail(missions);
  const scoresRows = fail(scores);
  const controlRow = fail(control);
  const announcementsRows = fail(announcements);
  const config: RallyConfig = {
    ...defaultState.config,
    id: row.rally_id, title: row.title, subtitle: row.subtitle, theme: row.theme,
    activeTribeIds: row.active_tribe_ids ?? [], currentWeek: row.current_week, totalWeeks: row.total_weeks,
    finalized: row.finalized, finalRanking: row.final_ranking ?? [], finalizedAt: row.finalized_at ?? undefined,
  };
  const peopleRows = people.error ? [] : people.data ?? [];
  const attendanceRows = attendance.error ? [] : attendance.data ?? [];
  return {
    config,
    missions: missionsRows?.length ? missionsRows.map((x) => ({ week:x.week,title:x.title,body:x.body,finalized:x.finalized,items:x.items ?? [] })) as WeekMission[] : createDefaultMissions(config.totalWeeks),
    people: peopleRows.map((x) => ({ id:x.id,kind:x.kind,name:x.name,church:x.church,whatsapp:x.whatsapp,tribeId:x.tribe_id,status:x.status,score:x.score })) as Person[],
    attendance: attendanceRows.map((x) => ({ id:x.id,personId:x.person_id,week:x.week,meeting:x.meeting,present:x.present,guests:x.guests,returned:x.returned,justification:x.justification })) as Attendance[],
    weeklyScores: (scoresRows ?? []).map((x) => ({ tribeId:x.tribe_id,week:x.week,points:x.points,submitted:x.submitted,submittedAt:x.submitted_at ?? undefined,details:x.details ?? {} })) as WeeklyScore[],
    control: controlRow ? { submissionOpen:controlRow.submission_open,systemLocked:controlRow.system_locked,lockedUntil:controlRow.locked_until ?? undefined,lastClosedWeek:controlRow.last_closed_week ?? undefined} : defaultState.control,
    announcements: (announcementsRows ?? []).map((x) => ({ id:x.id,title:x.title,body:x.body,createdAt:x.created_at })) as Announcement[],
  };
}

export function subscribeRemoteState(onChange:(state:RallyState)=>void,onError?:(error:Error)=>void) {
  let timer:number|undefined;
  const refresh=()=>{ if(timer)window.clearTimeout(timer); timer=window.setTimeout(()=>loadRemoteState().then(s=>{if(s)onChange(s);}).catch(e=>onError?.(e instanceof Error?e:new Error('Falha ao sincronizar o Rally.'))),80); };
  const channel:RealtimeChannel=supabase.channel('rally-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'rallies_current'},refresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'missions'},refresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'weekly_scores'},refresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'announcements'},refresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'system_control'},refresh)
    .subscribe((status)=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')onError?.(new Error('Supabase Realtime indisponível no momento.'));});
  return ()=>{if(timer)window.clearTimeout(timer);void supabase.removeChannel(channel);};
}

const missionPayload=(m:WeekMission)=>({week:m.week,title:m.title,body:m.body,finalized:m.finalized,items:m.items??[]});

export async function seedRemoteState(state:RallyState) {
  const {data,error}=await supabase.from('rallies_current').select('id').eq('id',1).maybeSingle();
  if(error)throw new Error(error.message); if(data)return;
  fail(await supabase.from('rallies_current').insert({id:1,rally_id:state.config.id,title:state.config.title,subtitle:state.config.subtitle,theme:state.config.theme,active_tribe_ids:state.config.activeTribeIds,current_week:state.config.currentWeek,total_weeks:state.config.totalWeeks,finalized:state.config.finalized,final_ranking:state.config.finalRanking}));
  fail(await supabase.from('missions').insert(state.missions.map(missionPayload)));
}

export async function saveConfig(c:RallyConfig) {
  fail(await supabase.from('rallies_current').update({rally_id:c.id,title:c.title,subtitle:c.subtitle,theme:c.theme,active_tribe_ids:c.activeTribeIds,current_week:c.currentWeek,total_weeks:c.totalWeeks,finalized:c.finalized,final_ranking:c.finalRanking,finalized_at:c.finalizedAt??null,updated_at:new Date().toISOString()}).eq('id',1));
  const {data,error}=await supabase.from('missions').select('week'); if(error)throw new Error(error.message);
  const existing=new Set((data??[]).map(x=>x.week)); const missing=createDefaultMissions(c.totalWeeks).filter(m=>!existing.has(m.week)).map(missionPayload);
  if(missing.length)fail(await supabase.from('missions').insert(missing));
}

export async function saveMission(m:WeekMission){fail(await supabase.from('missions').upsert({...missionPayload(m),updated_at:new Date().toISOString()},{onConflict:'week'}));}
export async function savePerson(p:Person){fail(await supabase.from('people').upsert({id:p.id,kind:p.kind,name:p.name,church:p.church,whatsapp:p.whatsapp,tribe_id:p.tribeId??null,status:p.status,score:p.score,updated_at:new Date().toISOString()},{onConflict:'id'}));}
export async function removePerson(id:string){fail(await supabase.from('people').delete().eq('id',id));}
export async function saveAttendance(a:Attendance){fail(await supabase.from('attendance').upsert({id:a.id,person_id:a.personId,week:a.week,meeting:a.meeting,present:a.present,guests:a.guests,returned:a.returned,justification:a.justification??'',updated_at:new Date().toISOString()},{onConflict:'id'}));}
export async function submitWeeklyScore(tribeId:string,week:number,points:number,details:Record<string,unknown>={}){fail(await supabase.from('weekly_scores').upsert({tribe_id:tribeId,week,points,details,submitted:true,submitted_at:new Date().toISOString()},{onConflict:'tribe_id,week'}));}
export async function publishAnnouncement(title:string,body:string){fail(await supabase.from('announcements').insert({title,body}));}
export async function finalizeWeek(state:RallyState){const week=state.config.currentWeek;fail(await supabase.from('missions').update({finalized:true,updated_at:new Date().toISOString()}).eq('week',week));fail(await supabase.from('rallies_current').update({current_week:Math.min(state.config.totalWeeks,week+1),updated_at:new Date().toISOString()}).eq('id',1));}
export async function finalizeRally(finalRanking:RallyConfig['finalRanking']){fail(await supabase.from('rallies_current').update({finalized:true,final_ranking:finalRanking,finalized_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',1));}

async function clearRows(table:'weekly_scores'|'attendance'|'missions'|'announcements'){
  const {data,error}=await supabase.from(table).select('*');if(error)throw new Error(error.message);if(!data?.length)return;
  for(const row of data){const q=table==='weekly_scores'?supabase.from(table).delete().eq('tribe_id',row.tribe_id).eq('week',row.week):supabase.from(table).delete().eq('id',row.id);fail(await q);}
}
export async function restartRally(c:RallyConfig){await Promise.all([clearRows('weekly_scores'),clearRows('attendance')]);fail(await supabase.from('rallies_current').update({rally_id:c.id,title:c.title,subtitle:c.subtitle,theme:c.theme,active_tribe_ids:c.activeTribeIds,current_week:1,total_weeks:c.totalWeeks,finalized:false,final_ranking:[],finalized_at:null,updated_at:new Date().toISOString()}).eq('id',1));fail(await supabase.from('missions').update({finalized:false,updated_at:new Date().toISOString()}).gt('week',0));}
export async function createNewRally(current:RallyState,next:RallyConfig){fail(await supabase.from('rally_archives').insert({payload:{...current,archivedAt:new Date().toISOString()}}));await Promise.all([clearRows('weekly_scores'),clearRows('attendance'),clearRows('missions'),clearRows('announcements')]);fail(await supabase.from('rallies_current').update({rally_id:next.id,title:next.title,subtitle:next.subtitle,theme:next.theme,active_tribe_ids:next.activeTribeIds,current_week:1,total_weeks:next.totalWeeks,finalized:false,final_ranking:[],finalized_at:null,updated_at:new Date().toISOString()}).eq('id',1));fail(await supabase.from('missions').insert(createDefaultMissions(next.totalWeeks).map(missionPayload)));}

export async function signIn(email:string,password:string){const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw new Error(error.message);}
export async function signOut(){const {error}=await supabase.auth.signOut();if(error)throw new Error(error.message);}
export function subscribeAuth(callback:(user:User|null)=>void){return supabase.auth.onAuthStateChange((_event,session)=>{window.setTimeout(()=>callback(session?.user??null),0);}).data.subscription.unsubscribe;}
export async function getSessionProfile(user?:User|null):Promise<SessionProfile|null>{const current=user??(await supabase.auth.getUser()).data.user;if(!current)return null;const {data,error}=await supabase.from('profiles').select('id,role,tribe_id,church,email').eq('id',current.id).maybeSingle();if(error)throw new Error(error.message);const role=data?.role==='admin'||data?.role==='leader'||data?.role==='viewer'?data.role:current.email?.toLowerCase()==='admin@rallyfju.com'?'admin':'viewer';return{id:current.id,role,tribeId:data?.tribe_id??null,church:data?.church??null,email:current.email??data?.email??null};}
export async function saveUserProfile(uid:string,p:{role:UserRole;tribeId?:string|null;church?:string|null;email?:string|null}){fail(await supabase.from('profiles').upsert({id:uid,role:p.role,tribe_id:p.tribeId??null,church:p.church??null,email:p.email??null,updated_at:new Date().toISOString()},{onConflict:'id'}));}
export async function setSystemControl(c:Partial<RallyControl>){fail(await supabase.from('system_control').update({...(c.submissionOpen===undefined?{}:{submission_open:c.submissionOpen}),...(c.systemLocked===undefined?{}:{system_locked:c.systemLocked}),...(c.lockedUntil===undefined?{}:{locked_until:c.lockedUntil??null}),...(c.lastClosedWeek===undefined?{}:{last_closed_week:c.lastClosedWeek??null}),updated_at:new Date().toISOString()}).eq('id',1));}
