# DesktopCat 桌面貓

![The cat's poses](docs/poses.png)

一隻住在 Windows 桌面上的貓，跟著 Claude Code 在每個對話裡做的事換姿勢：思考時頭上冒出雲朵、做事時敲鍵盤、回覆時一邊講話一邊小聲喵喵叫、做完就坐著打瞌睡，最後窩進坐墊睡覺。摸摸牠的頭，Claude 會收到你的稱讚。

A cat that lives on your Windows desktop and follows what Claude Code is doing in every conversation. [English below.](#english)

## 有什麼

**桌面貓（Windows 程式）**

- 跟著 Claude 換姿勢：等待、思考（雲朵裡輪流出現小宇宙、問號、魚和符號）、做事、講話、打瞌睡、睡覺
- Claude 需要你允許、或問你問題時，喵一聲，看著你、伸出一隻前腳輕點桌面等你回應，旁邊的對話框裡有個肉球跟著壓；一直沒人回應的話，每 3 分鐘再喵一聲。做完事時也喵一聲叫你
- 摸頭會呼嚕，Claude 會收到一句「摸了你的頭 N 下」的稱讚
- 抓住身體拖曳時，牠會像果凍一樣晃動，被抓起時小小喵一聲
- 你對 Claude 不滿意時，牠會垂頭難過，摸摸頭可以安慰牠
- 旁邊有一疊罐罐，看 Claude 的用量還剩多少：這週剩多少就有幾罐（全滿 5 罐，每用掉 20% 少一罐），最上面打開的那罐是這 5 小時，食物跟著變少，吃光就是空罐。到了重設時間會自己補滿。滑鼠移到罐罐上會顯示「這一餐剩 66%・這週剩 94%」（只有 Claude 訂閱方案才有用量）
- 外觀設定視窗（右鍵選單 →「外觀設定…」）：花色（三花、賓士、暹羅，Claude 裡的貓也會跟著換）、貓的大小、坐墊顏色（抹茶綠、奶茶米、霧粉、霧藍、薰衣草、夜空藍、莓果紅、水泥灰）、顯示罐罐、罐罐顏色、罐罐口味（鮪魚、鮭魚、雞肉、牛肉），上面有小貓的即時預覽
- 右鍵選單：顯示／隱藏、外觀設定、音效與音量、Claude 貓語氣、永遠在最上層、開機自動啟動

**Claude 外掛**

- 貓咪頭像：Claude 每段回覆旁邊會出現貓咪的臉，花色跟桌面貓一樣（在 Claude 桌面版 App 裡）
- `/cat` 打開貓的畫面
- 貓語氣：Claude 每次回覆都帶一點貓味，偶爾用貓的動作說自己在做什麼（像「嗅一嗅」「用肉球撥開」），內容照樣精簡完整。`/cat-voice 輕` 只留一點點、`/cat-voice 中` 回到預設；`/cat-voice off` 關掉、`/cat-voice on` 打開，只打 `/cat-voice` 會切換；桌面貓的右鍵選單也可以開關
- 把對話的狀態和 Claude 的用量告訴桌面貓，並把摸頭的稱讚帶回對話

## 需要

- Windows 10 或 11（64 位元）
- 新版的 Claude Code（桌面版 App 的 Code 分頁或終端機都可以）

## 安裝

**安裝桌面貓**：到 [Releases](../../releases) 下載 `DesktopCat-win32-x64.zip`，解壓縮到任何資料夾，執行裡面的 `DesktopCat.exe`。

> 這個程式沒有付費的軟體簽章，第一次打開時 Windows 可能顯示「Windows 已保護您的電腦」。按「其他資訊」→「仍要執行」即可。

## 隱私

全部在你的電腦上運作，不連網路。外掛會在 `~/.desktop-cat/` 寫入很小的狀態檔（每個對話目前在做什麼），桌面貓讀它來換姿勢；摸頭時桌面貓寫一個小檔，外掛讀到後把稱讚當成一則訊息送進對話。罐罐用的用量（5 小時和每週用了幾 %、什麼時候重設）由外掛寫在 `usage.json`。選的花色、坐墊顏色和貓語氣開關記在同一個資料夾的 `prefs.json`，兩邊共用。

## 自己從原始碼建置

```
cd desktop-app
npm install
npm test
npm run package
```

改了外掛裡的貓圖（`plugin/hooks/cats.ts`）之後，用 `npm run poses` 更新桌面貓的姿勢圖；改了罐罐的圖（`desktop-app/tools/can-art.mjs`）之後，用 `npm run cans` 更新罐罐。

## 素材與授權

程式碼依 [LICENSE](LICENSE) 授權。貓的插圖從哪裡來、音效的來源與授權，見 [CREDITS.md](CREDITS.md)。

本專案為個人作品，與 Anthropic 無關，也未經其認可。Claude 是 Anthropic 的商標。

---

## English

**DesktopCat** is a small Windows app with a cat that changes pose with what Claude Code is doing in each of your conversations: a thought cloud while it thinks, typing while it works, little chattering mews while it replies, dozing and then sleeping on its cushion when it is done. It meows when Claude needs your permission or finishes; while a permission or a question waits for you, it looks at you and taps the table with one paw, a little bubble beside it pressing a pink paw print, and meows again every three minutes until you answer. Pat its head and it purrs, and Claude receives your praise. Drag it by its body and it wobbles like jelly. A little stack of food cans beside it shows how much of your Claude usage is left: one can for every fifth of the week left (five when full), the top one open with its food going down as the five-hour window is used, filling again by itself when a window resets; hover over the cans for the figures (subscription plans only). It comes in three coats, calico, tuxedo and Siamese, and sleeps on a cushion in one of eight colours; coat, size, cushion and the cans' label and meat are picked in its appearance window (right-click → 外觀設定…).

The **Claude plugin** puts a cat's face beside each of Claude's replies, in the same coat as the desktop cat (in the Claude desktop app). It adds a `/cat` pane, tells the desktop cat what each conversation is doing and how much usage is left, and brings the head pats back to the conversation. (The praise message it sends is currently in Traditional Chinese.) It also gives Claude a cat voice: a touch of cat in every reply, now and then telling what it does the way a cat would (sniffing a file over, nudging something aside with a paw), with replies kept as concise as ever. `/cat-voice light` keeps it to a single touch and `/cat-voice medium` brings back the default; `/cat-voice off` turns it off, `/cat-voice on` back on, and `/cat-voice` alone switches it, as does "Claude 貓語氣" in the desktop cat's menu.

### Install

Download `DesktopCat-win32-x64.zip` from [Releases](../../releases), unzip it anywhere and run `DesktopCat.exe`. The app is not code-signed, so Windows SmartScreen may warn on first launch: choose "More info" → "Run anyway".

Requires Windows 10 or 11 (64-bit) and a recent Claude Code.

### Privacy

Everything runs on your computer with no network access. The plugin writes tiny status files under `~/.desktop-cat/`; the app reads them, and writes one when you pat the cat, which the plugin sends into the conversation as a message. For the cans, the plugin writes the five-hour and weekly usage (percent used, reset time) to `usage.json`. The coat, cushion colour and cat-voice choices are kept in `prefs.json` in the same folder, shared by both.

### Build

`cd desktop-app`, then `npm install`, `npm test` and `npm run package`. After changing the drawings in `plugin/hooks/cats.ts`, run `npm run poses` to rebuild the app's poses; after changing the cans in `desktop-app/tools/can-art.mjs`, run `npm run cans`.

### Credits and license

Code under [LICENSE](LICENSE). Where the cat pictures come from, and the sounds' sources and license: see [CREDITS.md](CREDITS.md). This is a personal project, not affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.
