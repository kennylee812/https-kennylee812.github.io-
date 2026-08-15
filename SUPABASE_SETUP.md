# Supabase 多人版安裝

1. 開啟 Supabase Dashboard 的 **SQL Editor**。
2. 建立新查詢，貼上並執行 `supabase-schema.sql` 的完整內容。
3. 到 **Authentication → URL Configuration**：
   - Site URL：`https://kennylee812.github.io`
   - Redirect URL：加入 `https://kennylee812.github.io/https-kennylee812.github.io-/**`
4. 到 **Authentication → Providers → Email**，確認 Email provider 已啟用。
5. 部署前端後，使用兩個不同 Email 註冊並完成信箱驗證。
6. 專案擁有者可在網站右上角以 Email 加入已註冊使用者。

## 密碼重設

為避免郵件安全掃描器提前消耗單次 recovery link，請到 **Authentication → Email Templates → Reset Password**，將郵件內容改成只顯示 OTP 驗證碼，不要使用 `{{ .ConfirmationURL }}`：

```html
<h2>重設工程專案管理系統密碼</h2>
<p>請回到管理系統並輸入以下一次性驗證碼：</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p><a href="https://kennylee812.github.io/https-kennylee812.github.io-/%E5%B7%A5%E7%A8%8B%E5%B0%88%E6%A1%88%E7%AE%A1%E7%90%86%E7%B3%BB%E7%B5%B1.html">回到管理系統</a></p>
```

使用者在登入頁點「忘記密碼」後，系統會顯示 Email、驗證碼與新密碼欄位，並以 Supabase `verifyOtp` 的 `recovery` 類型驗證。原有 recovery link session 仍受到支援，但正式郵件建議只使用手動 OTP。

## 安全模型

- 前端只使用 Publishable key；不得加入 secret/service-role key。
- RLS 會限制專案只對擁有者與成員可見。
- `viewer` 僅能讀取；`editor` 可修改；只有擁有者能刪除專案及管理成員。
- 物料與人工主檔目前由所有已登入使用者共用及維護。

## 現有本機資料

多人版啟用後不會自動讀取 IndexedDB。先在舊版使用「匯出 JSON 備份」或「匯出完整 Excel」，登入多人版後再使用既有的 Excel 匯入功能建立中央資料。
