(function(){
  'use strict';

  const SUPABASE_URL='https://mthupxgniuynkflmraem.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_N5IdEVdT9motGG2-DLpqOA_rAHkaucF';
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  let remoteStarted=false;
  let remoteStarting=false;

  const style=document.createElement('style');
  style.textContent=`
    #authGate{position:fixed;inset:0;z-index:9999;background:#f6f8f9;display:grid;place-items:center;padding:20px}
    #authGate[hidden]{display:none}.auth-card{width:min(430px,100%);background:#fff;border:1px solid #d8e3e7;border-radius:14px;padding:24px;box-shadow:0 18px 48px #19324a20}
    .auth-card h2{font-size:23px}.auth-card label{display:block;margin:12px 0}.auth-card input{margin-top:5px}.auth-actions{display:flex;gap:8px;flex-wrap:wrap}.auth-message{min-height:24px;color:#637583;margin-top:12px}.auth-message.error{color:#b42318}
    #accountBar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#526573}#accountBar button{padding:7px 10px}
  `;
  document.head.appendChild(style);
  const main=document.querySelector('main');
  if(main)main.hidden=true;

  const gate=document.createElement('section');
  gate.id='authGate';
  gate.innerHTML=`<div class="auth-card"><h2>工程專案管理系統</h2><p class="hint">登入後使用 Supabase 共用專案資料。</p><form id="authForm"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><div class="auth-actions"><button type="submit">登入</button><button type="button" id="signUpBtn" class="secondary">建立帳號</button></div></form><p id="authMessage" class="auth-message"></p></div>`;
  document.body.appendChild(gate);

  const accountBar=document.createElement('div');
  accountBar.id='accountBar';
  accountBar.innerHTML='<span id="accountEmail"></span><button id="shareProjectBtn" class="secondary">分享目前專案</button><button id="signOutBtn" class="secondary">登出</button>';
  document.querySelector('header')?.appendChild(accountBar);

  const message=(text,isError=false)=>{
    const el=document.getElementById('authMessage');
    el.textContent=text||'';el.classList.toggle('error',isError);
  };
  const fail=error=>{console.error(error);alert(`雲端資料操作失敗：${error.message||error}`);};
  window.addEventListener('unhandledrejection',event=>{if(event.reason)fail(event.reason);});

  function tableFor(store){
    return {projects:'projects',materialMasters:'material_masters',laborMasters:'labor_masters'}[store];
  }
  function projectFromRow(row){return {id:Number(row.id),name:row.name,...(row.data||{}),owner_id:row.owner_id,updated_at:row.updated_at};}
  function projectPayload(value){
    const {id,name,owner_id,updated_at,created_at,...data}=value;
    data.progress??=[];data.materials??=[];data.labor??=[];data.daily??=[];
    return {name,data,updated_at:new Date().toISOString()};
  }
  function masterPayload(value){return {name:value.name,unit:value.unit,price:Number(value.price)||0,updated_at:new Date().toISOString()};}
  function unwrap(result){if(result.error)throw result.error;return result.data;}

  function installRemoteAdapter(){
    openDB=async()=>client;
    tx=()=>{throw new Error('多人版不支援同步 IndexedDB transaction，請使用雲端資料函式。');};
    all=async store=>{
      const table=tableFor(store);if(!table)throw new Error(`未知資料表：${store}`);
      const rows=unwrap(await client.from(table).select('*').order('id'))||[];
      return store==='projects'?rows.map(projectFromRow):rows.map(row=>({...row,id:Number(row.id),price:Number(row.price)}));
    };
    put=async(store,value)=>{
      const table=tableFor(store);if(!table)throw new Error(`未知資料表：${store}`);
      const payload=store==='projects'?projectPayload(value):masterPayload(value);
      if(value.id!=null){
        unwrap(await client.from(table).update(payload).eq('id',value.id));
        return Number(value.id);
      }
      const rows=unwrap(await client.from(table).insert(payload).select('id').single());
      return Number(rows.id);
    };
    remove=async(store,id)=>{
      const table=tableFor(store);if(!table)throw new Error(`未知資料表：${store}`);
      unwrap(await client.from(table).delete().eq('id',id));
    };
    window.clearStore=async store=>{
      const table=tableFor(store);if(!table)throw new Error(`未知資料表：${store}`);
      const rows=unwrap(await client.from(table).select('id'))||[];
      if(rows.length)unwrap(await client.from(table).delete().in('id',rows.map(row=>row.id)));
    };
    db=client;
  }

  async function startRemote(session){
    if(!session){
      gate.hidden=false;if(main)main.hidden=true;accountBar.hidden=true;remoteStarted=false;return;
    }
    installRemoteAdapter();
    document.getElementById('accountEmail').textContent=session.user.email||'已登入';
    gate.hidden=true;if(main)main.hidden=false;accountBar.hidden=false;
    if(remoteStarted||remoteStarting)return;
    remoteStarting=true;
    current=null;
    try{
      await init();
      remoteStarted=true;
    }catch(error){fail(error);}
    finally{remoteStarting=false;}
  }

  document.getElementById('authForm').onsubmit=async event=>{
    event.preventDefault();message('登入中…');
    const values=Object.fromEntries(new FormData(event.currentTarget));
    const {error}=await client.auth.signInWithPassword({email:values.email.trim(),password:values.password});
    if(error)message(error.message,true);else message('登入成功');
  };
  document.getElementById('signUpBtn').onclick=async()=>{
    const form=document.getElementById('authForm');
    if(!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form));message('建立帳號中…');
    const {data,error}=await client.auth.signUp({email:values.email.trim(),password:values.password,options:{emailRedirectTo:location.origin+location.pathname}});
    if(error)message(error.message,true);
    else if(data.session)message('帳號已建立並登入。');
    else message('帳號已建立，請到信箱完成驗證後再登入。');
  };
  document.getElementById('signOutBtn').onclick=async()=>{const {error}=await client.auth.signOut();if(error)fail(error);};
  document.getElementById('shareProjectBtn').onclick=async()=>{
    if(!current){alert('請先選擇專案。');return;}
    const email=prompt('輸入已註冊成員的 Email：');if(!email?.trim())return;
    const role=confirm('按「確定」授予編輯權限；按「取消」授予唯讀權限。')?'editor':'viewer';
    const {error}=await client.rpc('add_project_member_by_email',{target_project_id:current.id,member_email:email.trim(),member_role:role});
    if(error)fail(error);else alert(`已加入 ${email.trim()}（${role==='editor'?'可編輯':'唯讀'}）。`);
  };

  client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>startRemote(session),0);});
  client.auth.getSession().then(({data,error})=>{if(error)message(error.message,true);else startRemote(data.session);});
})();
