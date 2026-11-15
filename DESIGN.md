---
name: 家帳 Family Ledger
description: 夫妻兩人隨手記帳的暖色生活帳本：暖米底、大圓角白卡、唯一的珊瑚動作色。
colors:
  warm-ground: "#FFF4E6"
  card-white: "#FFFFFF"
  on-accent: "#FFFFFF"
  coral-action: "#C8401A"
  coral-action-soft: "#FDE6DA"
  family-green: "#177F58"
  family-green-soft: "#DEF3E9"
  personal-blue: "#2F6FD1"
  personal-blue-soft: "#E4EDFC"
  cocoa-ink: "#2B241F"
  cocoa-muted: "#60554D"
  cocoa-quiet: "#70635A"
  milk-tea-line: "#ECE0D0"
  milk-tea-strong-line: "#DACAB7"
  milk-tea-surface: "#F7ECDF"
  oat-tint: "#FFF9F2"
  expense-red: "#D64538"
  income-green: "#177F58"
  caution-amber: "#E09214"
  warm-shadow: "#5C3A1E"
  night-ground: "#181310"
  night-card: "#251E1A"
  night-on-accent: "#1C140F"
  night-coral-action: "#FF8A60"
  night-family-green: "#5CD2A0"
  night-personal-blue: "#80ACFF"
  night-ink: "#F4EDE5"
  night-line: "#423730"
typography:
  display:
    fontFamily: "\"Nunito Variable\", \"PingFang TC\", \"Noto Sans TC\", \"Microsoft JhengHei\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: "2.25rem"
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "\"Nunito Variable\", \"PingFang TC\", \"Noto Sans TC\", \"Microsoft JhengHei\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "\"Nunito Variable\", \"PingFang TC\", \"Noto Sans TC\", \"Microsoft JhengHei\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: "1.75rem"
  body:
    fontFamily: "\"Nunito Variable\", \"PingFang TC\", \"Noto Sans TC\", \"Microsoft JhengHei\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    fontFeature: "\"tnum\""
  label:
    fontFamily: "\"Nunito Variable\", \"PingFang TC\", \"Noto Sans TC\", \"Microsoft JhengHei\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1rem"
rounded:
  md: "6px"
  lg: "14px"
  xl: "20px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.coral-action}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "48px"
  button-fab:
    backgroundColor: "{colors.coral-action}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "16px 20px"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "48px"
  chip-segment-selected:
    backgroundColor: "{colors.cocoa-ink}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  chip-segment:
    backgroundColor: "{colors.milk-tea-surface}"
    textColor: "{colors.cocoa-muted}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  chip-ledger-family:
    backgroundColor: "{colors.family-green-soft}"
    textColor: "{colors.family-green}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  chip-ledger-personal:
    backgroundColor: "{colors.personal-blue-soft}"
    textColor: "{colors.personal-blue}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  input-text:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  nav-bottom:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.cocoa-quiet}"
    typography: "{typography.label}"
    rounded: "{rounded.2xl}"
  nav-bottom-active:
    textColor: "{colors.coral-action}"
---

# Design System: 家帳 Family Ledger

## Overview

**Creative North Star: "廚房桌上的帳本"**

家帳像一件放在餐桌上的生活用品，而不是銀行後台。暖米色的地面（#FFF4E6）上擺著一張張大圓角白卡，每張卡只講一件事：這個月家庭花了多少、個人花了多少、預算還剩多少。文字是深可可色，不是黑；邊框和次表面是奶茶色，不是冷灰。深色模式是可可棕夜色（#181310），不是純黑，跟隨手機系統自動切換。

整個畫面只有一個「會發亮」的顏色：深珊瑚橘。它只出現在能按的東西上，記一筆、儲存、當前分頁、焦點框。家庭綠與個人藍是帳本的身分證，用來一眼分出「這是哪本帳」，從不當按鈕色。密度偏鬆，手機單手操作優先；所有數字等寬，金額上下對齊。

觸感來自一個簽名動作：按下回彈。所有按鈕、連結、摺疊標題按下時縮到 96%，放開時以帶過衝的彈簧曲線彈回，讓每一次點擊都有「按到了」的回應。這個系統明確拒絕記帳 App 的預設：冷灰底配一排同色按鈕。

**Key Characteristics:**
- 暖米底＋白卡＋可可字，中性色整組是暖色調
- 單一動作色（深珊瑚），只給可按的元素
- 家庭綠／個人藍只做帳本身分辨識
- Nunito 圓潤字型＋系統繁中，全站等寬數字
- 大圓角（14／20／24px）與暖棕色柔和陰影
- 簽名動作：按下回彈（scale .96，彈簧曲線）
- 淺色＋可可夜色深色模式，全部由 CSS 變數切換

## Colors

暖色中性階打底，一個珊瑚動作色，兩個帳本身分色；每個顏色都是 `styles.css` 裡的 CSS 變數（R G B 三數），深色模式只換變數值，元件不寫 `dark:`。

### Primary
- **深珊瑚橘 Coral Action** (#C8401A；深色 #FF8A60)：唯一的動作色。用在「記一筆」浮動鈕、表單主要儲存鈕、底部導覽當前分頁、輸入框聚焦邊框與光暈、全站 `:focus-visible` 外框、游標顏色、文字選取底色。
- **淡珊瑚 Coral Soft** (#FDE6DA；深色 #4A281C)：動作色的低調底，用於需要柔和強調的可按區塊。

### Secondary
- **家庭綠 Family Green** (#177F58；深色 #5CD2A0)，搭配 **淡家庭綠** (#DEF3E9)：家庭帳本的身分色。出現在帳本卡圖示圓、帳本頁標頭「兩人都看得到」膠囊、帳本頁總額卡底色、「○○ 代記」標籤。
- **個人藍 Personal Blue** (#2F6FD1；深色 #80ACFF)，搭配 **淡個人藍** (#E4EDFC)：個人帳本的身分色，用法與家庭綠完全對稱。
- **帳本色 Ledger**（`--ledger` 變數）：圖表長條（`bg-ledger`）的顏色，預設等於家庭綠；`LedgerAnalysis` 在外層把 `--ledger` 設為 `var(--family)` 或 `var(--personal)`，讓圖表跟著帳本變色。

### Tertiary（語意狀態色）
- **支出紅** (#D64538)：交易列的支出金額、錯誤卡邊框（red-200）、錯誤訊息底（red-50）、刪除鈕 hover。
- **收入綠** (#177F58)：收入金額。
- **提醒琥珀** (#E09214)：預算接近上限、離線提示橫幅。

### Neutral
- **暖米地面 Warm Ground** (#FFF4E6；深色 #181310)：`bg-page`，整個 App 的底。
- **卡片白 Card** (#FFFFFF；深色 #251E1A)：`bg-card`，所有卡片、對話框、底部導覽、輸入框的底。
- **可可墨 Cocoa Ink** (#2B241F；深色 #F4EDE5)：`slate-900`／`ink`，標題、金額、主要文字。
- **可可灰 Cocoa Muted** (#60554D)：`slate-600`／`muted`，卡片標題、次要說明。
- **可可淡字** (#70635A)：`slate-500`，日期分組標題、備註、未選中導覽。
- **奶茶線** (#ECE0D0)：`slate-200`，卡片邊框與分隔線；**奶茶深線** (#DACAB7)：`slate-300`，輸入框邊框、虛線空狀態框。
- **奶茶次表面** (#F7ECDF)：`slate-100`，未選中的分段膠囊、交易列小標籤、圖示鈕 hover 底。
- **燕麥淡底** (#FFF9F2)：`slate-50`，極淡 hover 底。
- **暖棕陰影色** (#5C3A1E；深色純黑)：`--shadow`，所有陰影都用它調透明度。

### Named Rules
**The Slate-Is-Warm Rule.** Tailwind 的 `slate` 色階已整組重新對應到暖色中性階（`--n-50`～`--n-950`）。寫 `text-slate-500` 得到的是可可色，不是冷灰；不要再引入 `gray`、`zinc`、`neutral`、`stone` 色階。

**The White-Means-On-Accent Rule.** Tailwind 的 `white` 被重新定義為 `--on-accent`：「彩色底上的字」。淺色模式是白，深色模式是深可可（#1C140F）。卡片底一律用 `bg-card`，永遠不要寫 `bg-white`。

**The One Glow Rule.** 深珊瑚是畫面上唯一會亮的顏色，只給能按的東西。不可按的資訊不用珊瑚；家庭綠與個人藍不當按鈕色。

## Typography

**Display Font:** Nunito Variable（以 `@fontsource-variable/nunito` 自架）
**Body Font:** 同上，中文落到 PingFang TC → Noto Sans TC → Microsoft JhengHei → system-ui

**Character:** Nunito 的圓潤字端呼應大圓角卡片，讓數字顯得親切不冷硬；中文交給各平台系統字，保持清楚、不額外下載。全站 `font-variant-numeric: tabular-nums`，金額欄位天生對齊。

### Hierarchy
- **Display** (800, 1.875rem／30px, 行高 2.25rem, 字距 -0.025em)：每頁唯一的 h1 頁面標題，例如「你好，○○」「家庭帳本」。
- **Headline** (700, 1.5rem／24px，寬螢幕帳本卡放大到 1.875rem, 字距 -0.025em)：帳本卡與總額卡上的大金額。
- **Title** (700, 1rem～1.125rem)：卡片標題、摺疊區塊標題、圖表標題。
- **Body** (400–600, 0.875rem～1rem)：交易分類名（600）、備註、說明文字。輸入框強制至少 16px，避免 iOS 聚焦時自動放大。
- **Label** (600, 0.75rem)：底部導覽文字、膠囊標籤、交易列中繼資訊。

### Named Rules
**The Plain Title Rule.** 頁面標題是直接的 Display 大字，不加小字眉標（eyebrow）、不加大寫字距標籤；需要補充時在標題下方放一行 0.875rem 的可可淡字副標。

**The Tabular Money Rule.** 所有數字等寬，這是全域設定，不要在元件上關掉。

## Layout

單欄、手機優先。主內容區 `max-w-3xl`（48rem）置中，左右 16px 邊距；桌面（≥1024px）改為左側導覽＋靠左的 `max-w-4xl` 內容區，左右 40px。頁面以 grid 垂直堆疊，區塊間距 20–24px（`gap-5`／`gap-6`），卡片之間 12px（`gap-3`），卡片內距 16–20px。首頁兩本帳的卡並排成兩欄（手機也是），其他卡片在 768px 以上才兩欄。底部保留 176px（`pb-44`）給浮動「記一筆」鈕與底部導覽，底部導覽遵守 iOS safe-area。

## Elevation & Depth

暖色柔和陰影搭配細奶茶邊框的混合系統。陰影色不是黑，而是暖棕（#5C3A1E）調透明度，讓白卡像放在米色桌布上；深色模式陰影色改為純黑。卡片在靜止時只有很淡的 `sm` 陰影加 1px 奶茶邊框，浮在內容之上的元素（浮動鈕、對話框、底部導覽、表單底部固定列）才用較深的陰影。

### Shadow Vocabulary
- **貼面 sm** (`box-shadow: 0 1px 2px rgb(var(--shadow) / 0.06)`)：一般卡片、交易清單、分段切換中的選中片。
- **預設 DEFAULT** (`box-shadow: 0 2px 8px -2px rgb(var(--shadow) / 0.12)`)：略微浮起的卡。
- **浮起 md** (`box-shadow: 0 6px 16px -6px rgb(var(--shadow) / 0.18)`)：已定義為階梯中間一級，目前元件尚未使用。
- **懸浮 lg** (`box-shadow: 0 10px 28px -8px rgb(var(--shadow) / 0.30)`)：「記一筆」浮動鈕。
- **對話框 xl** (`box-shadow: 0 18px 44px -12px rgb(var(--shadow) / 0.35)`)：Modal。
- **底部導覽上緣** (`box-shadow: 0 -6px 20px -12px rgb(var(--shadow) / 0.25)`)：向上投影，把導覽列從內容中托起。

### Named Rules
**The Warm Shadow Rule.** 陰影一律透過 `--shadow` 變數上色，不寫 `rgba(0,0,0,…)`。

## Shapes

圓潤是主調。Tailwind 圓角已整組放大：`rounded-lg` 14px（按鈕、輸入框、圖示鈕）、`rounded-xl` 20px（卡片、對話框）、`rounded-2xl` 24px（底部導覽上緣）。膠囊與浮動鈕用完全圓（`rounded-full`）。分段切換內的小片用 6px（`rounded-md`），嵌在 14px 外框裡。邊框只用 1px 奶茶線；空狀態用奶茶深線的虛線框。

**The Rounded-Not-Sharp Rule.** 新元件不要用小於 14px 的圓角做容器；直角只出現在全寬的系統橫幅。

## Components

### Buttons
觸感溫暖、會回彈。
- **Shape:** 柔和圓角（14px）；浮動鈕為膠囊。
- **Primary:** 深珊瑚底、on-accent 字、600 字重、高 48px、左右 16px。表單「儲存」使用。
- **Floating Action（記一筆）:** 深珊瑚膠囊，右下角固定（底部導覽上方 96px），左右 20px、上下 16px、Plus 圖示＋「記一筆」，懸浮 lg 陰影。全 App 只有這一顆。
- **Secondary:** 卡片白底、1px 奶茶深線、可可色字，高 48px；hover 轉燕麥淡底。
- **Ghost / 圖示鈕:** 40px 見方、無底、可可淡字，hover 出奶茶次表面底；刪除鈕 hover 轉淡紅底紅字。
- **Hover / Focus / Active:** 所有可按元素共用 `:focus-visible` 2px 珊瑚外框（偏移 2px）；按下時套用簽名回彈。disabled 時 60% 不透明。

### Chips
- **分段膠囊（支出／收入、幣別篩選）:** 未選中為奶茶次表面或卡片白底＋可可灰字；選中為可可墨底＋on-accent 字（深色模式自動反轉為淺底深字）。選中狀態用墨色而非珊瑚，因為它是狀態不是行動。
- **帳本身分膠囊:** 淡家庭綠底＋家庭綠字（或淡個人藍＋個人藍），附 Users／Lock 圖示，標示「兩人都看得到」「只有你看得到」。
- **中繼標籤:** 交易列的付款方式、地點、固定收支，奶茶次表面底、可可灰字、0.75rem。

### Cards / Containers
- **Corner Style:** 20px（`rounded-xl`）。
- **Background:** `bg-card`；帳本頁總額卡改用該帳本的淡身分色當底。
- **Shadow Strategy:** 貼面 sm（見 Elevation）。
- **Border:** 1px 奶茶線；錯誤狀態改 red-200 邊框；空狀態用奶茶深線虛線。
- **Internal Padding:** 16–20px。

### Inputs / Fields
- **Style:** 卡片白底、1px 奶茶深線、14px 圓角、高 44px、左右 12px，字級至少 16px。
- **Focus:** 邊框轉深珊瑚，加 2px 30% 珊瑚光暈（`ring-action/30`）。
- **Error:** 下方淡紅底紅字訊息框。

### Navigation
- **底部導覽（< 1024px）:** 卡片白底、上緣 24px 圓角、上緣奶茶線與向上投影，5 格等寬，每格 20px lucide 圖示＋0.75rem 600 標籤。未選中可可淡字，當前分頁轉深珊瑚。
- **側邊導覽（≥ 1024px）:** 取代底部導覽；當前項目為淡珊瑚底＋深珊瑚字，其他為可可灰字、hover 燕麥淡底。

### 帳本卡 Ledger Card（Signature）
首頁兩張並排的白卡：左上 36px 圓形身分圖示（淡身分色底＋身分色 Users／Lock 圖示）與可可灰標題，下方 Headline 大金額（TWD），有美元時再加一行 1.125rem 次金額。這是「一眼分出兩本帳」的核心元件。

### 交易列 Transaction Row
清單項目在一張大白卡內以奶茶線分隔，內距 16px。左側是使用者自選的 emoji 分類圖示（1.5rem）、分類名（600）、備註（點一下展開）；下方中繼列有歸屬人色點與標籤膠囊。右側金額：支出紅加「-」，收入綠加「+」，外幣附幣別徽章；其下是編輯／刪除圖示鈕。

### 簽名動作：按下回彈 Spring Press
所有 `button`、`a[href]`、`summary` 在 `:active` 時 `transform: scale(0.96)`（按下 90ms），放開時以 `cubic-bezier(0.34, 1.3, 0.64, 1)` 用 380ms 彈回；背景、文字、陰影變化 160ms ease-out。整段包在 `@media (prefers-reduced-motion: no-preference)` 內，偏好減少動態的使用者完全不會看到。

## Do's and Don'ts

### Do:
- **Do** 用 `bg-card` 做所有卡片與表面，用 `bg-page` 做頁面底。
- **Do** 把深珊瑚（#C8401A／深色 #FF8A60）只留給可以按的東西：主要按鈕、記一筆、當前分頁、焦點。
- **Do** 用家庭綠／個人藍標示「這是哪本帳」，圖表長條用 `bg-ledger` 讓它自動跟著帳本變色。
- **Do** 新顏色一律先加成 `styles.css` 的 CSS 變數（淺色＋深色兩組值），再接到 `tailwind.config.ts`。
- **Do** 分類圖示沿用使用者自選的 emoji；它是使用者資料，不是設計圖示，屬於刻意保留的例外。介面圖示一律用 lucide。
- **Do** 頁面標題用 Display（1.875rem、800）直接寫，副標放下方一行。

### Don't:
- **Don't** 寫 `bg-white`：`white` 在本系統代表「彩色底上的字」，深色模式會變成深可可。
- **Don't** 引入冷灰（`gray`、`zinc`、`neutral`）或純黑底；深色模式是可可夜色。
- **Don't** 把家庭綠或個人藍當按鈕底色。
- **Don't** 在頁面標題上方加小字眉標或大寫字距標籤。
- **Don't** 用 `rgba(0,0,0,…)` 寫陰影，改用 `--shadow` 變數。
- **Don't** 移除 `prefers-reduced-motion` 防護，或另寫與簽名回彈衝突的按下動畫。
