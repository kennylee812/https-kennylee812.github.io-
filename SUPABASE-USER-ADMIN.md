# Supabase 使用者與權限管理

本系統不開放使用者自行註冊。管理員必須先在 Supabase 建立帳號，再指定使用者可存取的專案與權限。

## 一、關閉公開註冊

1. 開啟 Supabase Dashboard。
2. 進入 **Authentication → Sign In / Providers → Email**。
3. 關閉 **Allow new users to sign up**，然後儲存。

前端已移除「建立帳號」按鈕；後端也必須關閉此設定，才能防止使用者直接呼叫註冊 API。

## 二、建立使用者帳號

1. 進入 **Authentication → Users**。
2. 按 **Add user → Create new user**。
3. 輸入使用者 Email 與初始密碼。
4. 啟用 **Auto Confirm User**，讓使用者不必再收確認信。
5. 將帳號與初始密碼安全地交給使用者。

使用者登入後，可透過「忘記密碼」變更密碼；此功能需要先設定 Custom SMTP 與 Reset password 郵件範本。

## 三、設定專案權限

權限以個別專案為單位：

- `owner`：專案擁有者，可修改、刪除專案及管理成員。
- `editor`：可查看及編輯專案。
- `viewer`：只能查看專案。

專案擁有者可以登入系統，選擇專案後使用「分享專案」功能，輸入已建立帳號的 Email，並指定「可編輯」或「唯讀」。

管理員也可以在 **SQL Editor** 執行下列 SQL 指定權限。請替換 Email、專案編號及角色：

```sql
insert into public.project_members (project_id, user_id, role)
select
  1,
  id,
  'editor'
from auth.users
where lower(email) = lower('user@example.com')
on conflict (project_id, user_id)
do update set role = excluded.role;
```

將 `editor` 改成 `viewer` 可設定唯讀權限。`project_id` 可在 `public.projects` 資料表查看。

## 四、停用使用者

進入 **Authentication → Users**，選擇使用者後執行停用或封鎖。若只要取消某個專案的權限，可在 `public.project_members` 刪除該使用者對應的紀錄。
