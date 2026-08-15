(function(){
  'use strict';

  const SUPABASE_URL='https://mthupxgniuynkflmraem.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_N5IdEVdT9motGG2-DLpqOA_rAHkaucF';
  let recoveryRequested=location.hash.includes('type=recovery')||new URLSearchParams(location.search).get('type')==='recovery';
  let recoverySessionReady=false;
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  let remoteStarted=false;
  let remoteStarting=false;

  const style=document.createElement('style');
  style.textContent=`
    #authGate{position:fixed;inset:0;z-index:9999;background:#f6f8f9;display:grid;place-items:center;padding:20px}
    #authGate[hidden]{display:none}.auth-card{width:min(430px,100%);background:#fff;border:1px solid #d8e3e7;border-radius:14px;padding:24px;box-shadow:0 18px 48px #19324a20}
    .auth-card h2{font-size:23px}.auth-card form{display:block}.auth-card form[hidden]{display:none}.auth-card label{display:block;margin:12px 0}.auth-card input{display:block;width:100%;margin-top:5px}.auth-card .auth-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.auth-card .auth-actions button{flex:1 1 110px;white-space:nowrap}.auth-message{min-height:24px;color:#637583;margin-top:12px}.auth-message.error{color:#b42318}
    #accountBar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#526573}#accountBar button{padding:7px 10px}
  `;
  document.head.appendChild(style);
  const main=document.querySelector('main');
  if(main)main.hidden=true;

  const gate=document.createElement('section');
  gate.id='authGate';
  gate.innerHTML=`<div class="auth-card"><h2>工程專案管理系統</h2><p class="hint">請使用管理員提供的帳號及密碼登入。</p><form id="authForm"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><div class="auth-actions"><button type="submit">登入</button><button type="button" id="forgotPasswordBtn" class="secondary">忘記密碼</button></div></form><form id="recoveryForm" hidden><p class="hint">輸入重設信中的驗證碼，再設定至少 6 個字元的新密碼。</p><label id="recoveryEmailRow">Email<input name="email" type="email" autocomplete="email" required></label><label id="recoveryTokenRow">驗證碼<input name="token" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="10" required></label><label>新密碼<input name="password" type="password" autocomplete="new-password" minlength="6" required></label><label>再次輸入<input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required></label><div class="auth-actions"><button type="submit">驗證並更新密碼</button><button type="button" id="cancelRecoveryBtn" class="secondary">取消</button></div></form><p id="authMessage" class="auth-message"></p></div>`;
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

  function showRecovery(sessionReady=false,email=''){
    recoveryRequested=true;
    recoverySessionReady=sessionReady;
    gate.hidden=false;if(main)main.hidden=true;accountBar.hidden=true;
    document.getElementById('authForm').hidden=true;
    const form=document.getElementById('recoveryForm');
    form.hidden=false;
    form.elements.email.value=email||form.elements.email.value;
    for(const id of ['recoveryEmailRow','recoveryTokenRow']){
      const row=document.getElementById(id);row.hidden=sessionReady;
      row.querySelector('input').required=!sessionReady;
    }
    message(sessionReady?'密碼重設連結已驗證，請輸入新密碼。':'請輸入重設信中的驗證碼與新密碼。');
  }

  function showLogin(){
    recoveryRequested=false;
    recoverySessionReady=false;
    document.getElementById('authForm').hidden=false;
    document.getElementById('recoveryForm').hidden=true;
    gate.hidden=false;if(main)main.hidden=true;accountBar.hidden=true;
  }

  document.getElementById('authForm').onsubmit=async event=>{
    event.preventDefault();message('登入中…');
    const values=Object.fromEntries(new FormData(event.currentTarget));
    const {error}=await client.auth.signInWithPassword({email:values.email.trim(),password:values.password});
    if(error)message(error.message,true);else message('登入成功');
  };
  document.getElementById('forgotPasswordBtn').onclick=async()=>{
    const email=document.getElementById('authForm').elements.email;
    if(!email.reportValidity())return;
    message('正在寄送密碼重設信…');
    const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin+location.pathname});
    if(error)message(error.message,true);else{showRecovery(false,email.value.trim());message('密碼重設信已送出，請輸入信中的驗證碼。');}
  };
  document.getElementById('recoveryForm').onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.currentTarget));
    if(values.password!==values.confirmPassword){message('兩次輸入的密碼不一致。',true);return;}
    if(!recoverySessionReady){
      message('正在驗證一次性驗證碼…');
      const {error}=await client.auth.verifyOtp({email:values.email.trim(),token:values.token.trim(),type:'recovery'});
      if(error){message(error.message,true);return;}
      recoverySessionReady=true;
    }
    message('正在更新密碼…');
    const {error}=await client.auth.updateUser({password:values.password});
    if(error){message(error.message,true);return;}
    recoveryRequested=false;message('密碼已更新，正在登入…');
    const {data}=await client.auth.getSession();
    document.getElementById('authForm').hidden=false;document.getElementById('recoveryForm').hidden=true;
    await startRemote(data.session);
  };
  document.getElementById('cancelRecoveryBtn').onclick=async()=>{await client.auth.signOut();showLogin();message('已取消密碼重設。');};
  document.getElementById('signOutBtn').onclick=async()=>{const {error}=await client.auth.signOut();if(error)fail(error);};
  document.getElementById('shareProjectBtn').onclick=async()=>{
    if(!current){alert('請先選擇專案。');return;}
    const email=prompt('輸入已註冊成員的 Email：');if(!email?.trim())return;
    const role=confirm('按「確定」授予編輯權限；按「取消」授予唯讀權限。')?'editor':'viewer';
    const {error}=await client.rpc('add_project_member_by_email',{target_project_id:current.id,member_email:email.trim(),member_role:role});
    if(error)fail(error);else alert(`已加入 ${email.trim()}（${role==='editor'?'可編輯':'唯讀'}）。`);
  };

  client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>event==='PASSWORD_RECOVERY'?showRecovery(true):(!recoveryRequested&&startRemote(session)),0);});
  client.auth.getSession().then(({data,error})=>{if(error)message(error.message,true);else if(recoveryRequested&&data.session)showRecovery(true);else if(recoveryRequested)showRecovery(false);else startRemote(data.session);});
})();
