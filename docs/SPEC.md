# 英语拼写弹窗 · 开发规格（MVP）

> 一个常驻后台的桌面小工具：办公时不定时从屏幕角落弹出一张小卡片，给出中文释义或播放发音，让用户拼写英文单词或句子。答完卡片收起，用户继续工作。
>
> 平台：macOS + Windows。用户：作者本人和朋友。不做账号、不做服务器，数据全部存在本地。

---

## 1. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 桌面壳 | **Tauri 2** | 安装包小，常驻后台占内存少 |
| 前端 | React 18 + TypeScript + Vite | |
| 样式 | CSS 变量 + CSS Modules | 皮肤系统靠 CSS 变量切换，不用 Tailwind |
| 存储 | SQLite（`tauri-plugin-sql` 或 Rust 侧 `rusqlite`） | 单文件，放在系统应用数据目录 |
| 全局快捷键 | `tauri-plugin-global-shortcut` | |
| 开机自启 | `tauri-plugin-autostart` | |
| 托盘 | Tauri 2 内置 tray API | |
| 发音 | WebView 内置 `speechSynthesis`（Web Speech API） | 用系统自带语音，离线可用 |
| AI | 前端直接 `fetch` OpenAI 兼容接口 `/chat/completions` | Key 只存在本地 |
| 打包 | `tauri build` → macOS `.dmg`、Windows `.exe`（NSIS） | 暂不签名（见第 15 节） |

快捷键在 macOS 上显示为 ⌘，在 Windows 上显示为 Ctrl，代码里统一用 `CommandOrControl`。

---

## 2. 窗口与进程

应用启动后**没有主窗口**，只有托盘图标。一共两个窗口：

### 2.1 弹窗窗口 `popup`
- 无边框、透明背景、始终置顶、不显示在任务栏或 Dock
- 位置：主显示器**工作区**右下角，距离边缘 24px（要避开 Windows 任务栏和 macOS Dock）
- **不抢焦点（最重要）**：弹出时窗口显示但**不获取焦点**（`focus: false`），用户正在打的字不能进入弹窗。只有用户按全局快捷键或点击卡片，才调用 `set_focus()` 进入答题
- 三种状态，窗口尺寸跟着状态变：
  - `peek` 收起提示：约 260 × 56
  - `answer` 答题：约 380 × 340
  - `feedback` 反馈：约 380 × 380

### 2.2 设置窗口 `settings`
- 普通窗口，约 820 × 624，从托盘菜单「设置…」打开
- 左侧导航四个分页：通用 / 出题 / 词库与 AI / 关于

---

## 3. 弹窗交互流程

```
[定时器到点] → 检查免打扰条件 → 不满足就延后 5 分钟再检查
                ↓ 满足
           显示 peek（不抢焦点）
                ↓
   ┌── 30 秒内无操作 → 自动收起，本题不计对错，5–10 分钟后重新出这题
   │
   └── 用户按 ⌘⇧E / 点击 → answer（获取焦点，光标在输入框）
                ↓
        Enter 提交 → feedback
        Tab   → 提示（第一次显示首字母，第二次再多显示一个字母；用过提示的题即使答对也按「勉强」计分）
        Esc   → 跳过（计为答错，但不展示讲解）
                ↓
        feedback 状态按任意键或 8 秒后 → 收起，焦点还给之前的应用
```

**答题卡内容**
- 顶部：词库名 · 题型名、发音按钮
- 题面（因题型不同而不同，见第 4 节）
- 辅助信息：词性 · 字母数 · 首字母（可设置是否默认显示）
- 输入框、提示 / 跳过 / 提交 三个按钮

**反馈卡内容**
- 对错状态
- 拼错时：用户的拼写和正确拼写上下对照，**用字符级 diff 高亮出错的字母**（diff 算法可以用 `diff` 库的 `diffChars`）
- 音标（有的话）、例句
- AI 讲解（配置了 AI 并且开启「答错讲解」时才显示，异步加载，先显示「讲解生成中…」占位，不阻塞其他内容）
- 底部：下次复习时间（例如「10 分钟后再考」）

**判题规则**
- 忽略首尾空格、忽略大小写
- 句子题：忽略末尾标点，多个连续空格视为一个；撇号 `'` 和 `’` 视为相同
- 释义里的一词多义（比如 `部署；展开`）只是题面，答案以 `term` 字段为准

---

## 4. 题型

| ID | 名称 | 题面 | 适用 |
|---|---|---|---|
| `zh2en` | 看中文写英文 | 中文释义 | 单词、句子 |
| `dictation` | 听发音拼写 | 自动播放一遍发音，题面不显示英文；可点按钮重播 | 单词 |
| `cloze` | 例句挖空 | 例句里目标词换成 `____`，附中文释义 | 有例句的单词 |
| `sentence_dictation` | 整句听写 | 播放整句发音 | 句子 |

出题时：先按「单词 : 句子」比例决定这次出单词还是句子，再从**已勾选、且适用于这条内容**的题型里随机选一种。没有例句的单词不出 `cloze`。

---

## 5. 调度

**弹出节奏（设置 →「出题」）**
- 间隔方式：`random`（默认）或 `fixed`
- 随机：每次在 `[min, max]` 分钟之间均匀随机，默认 15–45
- 固定：每 N 分钟一次，默认 30
- 工作时段：可开关，默认开，09:00–18:00；工作时段以外不弹
- 托盘里的「暂停 1 小时」「今天不再弹」要优先于以上所有设置

**免打扰（MVP 只做两项）**
1. **前台应用全屏时不弹**（开会、演示、看视频）
   - macOS：判断前台窗口的大小是否等于屏幕大小
   - Windows：`SHQueryUserNotificationState`，返回 `QUNS_BUSY` / `QUNS_RUNNING_D3D_FULL_SCREEN` / `QUNS_PRESENTATION_MODE` 时不弹
2. **用户正在打字时延后**：用系统空闲时间来判断，**不监听键盘内容**
   - macOS：`CGEventSourceSecondsSinceLastEventType`（不需要额外系统权限）
   - Windows：`GetLastInputInfo`
   - 如果最近一次输入在 3 秒以内，就延后 60 秒再检查，最多延后 5 次，之后照常弹出

这两项用 Rust 实现，作为 Tauri command 暴露给前端：`is_fullscreen_app_active()`、`seconds_since_last_input()`。

---

## 6. 间隔重复算法

使用简化版 **SM-2**。每条内容一条复习记录：`ease`（默认 2.5）、`interval_days`、`reps`、`due_at`。

答题结果映射为评分 `q`：

| 结果 | q |
|---|---|
| 答对，没用提示 | 5 |
| 答对，用了提示 | 3 |
| 答错 / 跳过 | 1 |
| 超时没理 | 不计分，不更新记录 |

更新规则：
- `q < 3`：`reps = 0`，`due_at = 现在 + 10 分钟`（当天会再考）
- `q ≥ 3`：
  - `reps == 0` → `interval = 1 天`
  - `reps == 1` → `interval = 3 天`
  - 其他 → `interval = round(interval × ease)`
  - `reps += 1`
  - `due_at = 现在 + interval`
- `ease = max(1.3, ease + 0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))`

**选题优先级**：已到期的复习题（`due_at` 最早的优先）→ 新内容（每天新内容上限默认 20 条，可设置）→ 都没有时，随机挑一条最近答错过的。

算法要写成**纯函数**并配单元测试，例如 `nextReview(record, q, now) → record`。

---

## 7. 词库

### 7.1 内置两套
1. **四六级核心词**：数据来自开源词典 **ECDICT**（MIT 协议），按它的 `tag` 字段筛出 `cet4`、`cet6` 的词；取 `word`、`phonetic`、`translation`（清洗成一两条简短释义）。词库在构建时预处理成 JSON 或 SQLite 打包进应用，不在运行时联网下载
2. **程序员 / 职场英语**：MVP 先准备约 300 条（约 200 个单词 + 100 个句子），覆盖技术文档、代码评审、邮件、会议常用表达。初版可以借助 AI 生成，但必须人工过一遍再提交

### 7.2 导入
- 支持 `.csv`、`.txt`，UTF-8
- 每行：`英文, 中文释义, 例句(可选)`。字段里有逗号时用双引号包起来（标准 CSV）
- 英文里含空格就自动判定为句子，否则判定为单词
- 导入后显示预览：「共 N 条，其中单词 X、句子 Y，有 Z 行格式错误（列出行号）」，确认后写入
- 导入的内容成为一个新词库，名字默认用文件名，可以改

### 7.3 设置页「词库与 AI」
- 每个词库一行：勾选启用、名称、来源（内置 / 导入）、已学 / 总数
- 导入的词库可以删除，内置词库不能删

---

## 8. AI（可选）

- 配置三项：`Base URL`、`API Key`、`模型名`，加一个「测试连接」按钮（发一条很短的请求，显示成功和耗时，或显示错误信息）
- 走 OpenAI 兼容的 `POST {base_url}/chat/completions`，DeepSeek、通义、Kimi、OpenAI 等都可以用
- **没配置时，所有 AI 相关的界面元素都隐藏**，其他功能完全不受影响
- 三个功能可以分别开关：
  1. **生成例句**：内容没有例句时，后台为它生成一句并缓存进数据库，不重复生成
  2. **答错讲解**：反馈卡里显示一两句中文讲解（词根、易混词、记忆方法），限制在 60 字以内
  3. **错词出新题**：用最近答错的词生成新的例句挖空题（默认关）
- 请求超时 10 秒，失败就静默降级，不弹错误打扰用户；错误写进本地日志
- API Key 用系统钥匙串保存（macOS Keychain / Windows Credential Manager，可以用 `keyring` crate），不要明文写进 SQLite 或配置文件

---

## 9. 皮肤系统

三套皮肤共用**同一套组件结构**，差异只来自皮肤配置。配置分三层：

1. **设计变量**：作为 CSS 变量注入到 `:root`
2. **文案**：按钮、提示语等随皮肤变化的文字
3. **结构开关**：少量布尔值或枚举

> 约束：以后新增皮肤时，只能改这三层的值，不能新增组件结构。

完整取值见 `design/skins.json`，视觉参考见 `design/*.dc.html`（阅读方法见 `design/README.md`）。

| | A · 原生极简 `native` | B · 终端代码 `terminal` | C · 纸感词卡 `paper` |
|---|---|---|---|
| 明暗 | 浅 | 深 | 浅 |
| 英文字体 | Inter | JetBrains Mono | Source Serif 4 |
| 强调色 | #2563EB | #7EE787 | #1F3A5F |
| 卡片圆角 | 14px | 8px | 18px |
| 提交按钮文案 | 提交 ↵ | [↵] 提交 | 翻面 ↵ |
| `titleBar` | false | true | false |
| `feedbackStyle` | `highlight` | `diff` | `card` |
| `inputStyle` | `box` | `prompt` | `underline` |

- 第四个选项「跟随系统」：系统浅色时用 `native`，深色时用 `terminal`
- **字体打包进应用**（woff2 放在 `src/assets/fonts`），不从 Google Fonts 加载。中文一律用系统字体：`-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
- 切换皮肤立即生效，弹窗和设置窗口同时更新（通过 Tauri 事件广播）

---

## 10. 托盘菜单

```
下一题约 12 分钟后            ← 状态行，不可点
今日 18 题 · 正确率 83%        ← 状态行，不可点
───────────────
立即来一题              ⌘⇧E
暂停 1 小时                    ← 暂停时变成「恢复（还剩 37 分钟）」
今天不再弹                     ← 生效后变成「恢复弹出」
───────────────
加入生词…               ⌘⇧A
设置…                   ⌘,
───────────────
退出
```

系统原生托盘菜单无法自定义样式，MVP 先用**原生菜单**（三套皮肤下长得一样）。设计稿里的皮肤化托盘留到以后，用自绘窗口实现。

**加入生词（⌘⇧A）**：
- 读取当前选中的文字：模拟一次复制，读剪贴板，再把剪贴板原来的内容恢复回去。macOS 上需要「辅助功能」权限，第一次使用时引导用户去授权
- 弹出一个小输入框，英文已经填好；配了 AI 就自动填中文释义，没配就让用户自己填
- 保存进「我的生词本」词库（没有就自动创建）

---

## 11. 设置项一览

| 分页 | 设置项 | 默认值 |
|---|---|---|
| 通用 | 皮肤 | `native` |
| 通用 | 唤出答题快捷键 | ⌘⇧E / Ctrl+Shift+E |
| 通用 | 加入生词快捷键 | ⌘⇧A / Ctrl+Shift+A |
| 通用 | 开机自启 | 开 |
| 通用 | 学习进度导入 / 导出 | — |
| 出题 | 间隔方式 | 随机 |
| 出题 | 间隔范围 / 固定间隔 | 15–45 / 30 分钟 |
| 出题 | 只在工作时段弹出 | 开，09:00–18:00 |
| 出题 | 全屏时不弹 | 开 |
| 出题 | 正在打字时延后 | 开 |
| 出题 | 单词 : 句子 | 7 : 3 |
| 出题 | 题型 | 前三种勾选，整句听写不勾 |
| 出题 | 每天新内容上限 | 20 |
| 词库与 AI | 词库启用 / 导入 / 删除 | 两套内置都启用 |
| 词库与 AI | Base URL / Key / 模型 | 空 |
| 词库与 AI | 三个 AI 功能开关 | 前两个开，第三个关 |

**学习进度导出**：导出成一个 `.json`（所有自建词库 + 复习记录 + 设置，**不含 API Key**）。导入时提示「会覆盖当前进度」，确认后再写入。

快捷键冲突（被其他应用占用、注册失败）时，在设置页那一行显示红字提示，不要静默失败。

---

## 12. 数据模型（SQLite）

```sql
CREATE TABLE decks (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('builtin','imported','user')),
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE items (
  id          INTEGER PRIMARY KEY,
  deck_id     INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('word','sentence')),
  term        TEXT NOT NULL,          -- 英文（答案）
  meaning     TEXT NOT NULL,          -- 中文释义（题面）
  phonetic    TEXT,
  pos         TEXT,                   -- 词性，如 v. / n.
  example     TEXT,                   -- 例句
  example_ai  INTEGER NOT NULL DEFAULT 0,  -- 例句是否由 AI 生成
  UNIQUE (deck_id, term)
);

CREATE TABLE reviews (
  item_id       INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  ease          REAL    NOT NULL DEFAULT 2.5,
  interval_days REAL    NOT NULL DEFAULT 0,
  reps          INTEGER NOT NULL DEFAULT 0,
  due_at        INTEGER NOT NULL,     -- unix 毫秒
  last_result   TEXT,
  lapses        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE attempts (
  id          INTEGER PRIMARY KEY,
  item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quiz_type   TEXT NOT NULL,
  answer      TEXT NOT NULL,
  correct     INTEGER NOT NULL,
  used_hint   INTEGER NOT NULL DEFAULT 0,
  at          INTEGER NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                 -- JSON
);
```

还没学过的内容在 `reviews` 里没有记录；第一次出题时再插入。今日答题数和正确率直接从 `attempts` 统计。

---

## 13. 开发里程碑

每完成一个里程碑都要能实际运行，并且满足验收标准，才进入下一个。

**M0 · 项目骨架**
- Tauri 2 + React + TS + Vite 跑起来；托盘图标；托盘菜单能「退出」
- 验收：`npm run tauri dev` 启动后只有托盘图标、没有主窗口

**M1 · 弹窗与不抢焦点**
- popup 窗口三种状态（先用写死的假数据）；全局快捷键；30 秒自动收起
- 验收：在文本编辑器里一直打字，弹窗出现时**打的字依然进入编辑器**；按快捷键后才能在弹窗输入。Mac 和 Windows 都要验证

**M2 · 数据与算法**
- SQLite 建表与迁移；内置两套词库打包导入；SM-2 纯函数加单元测试；选题逻辑；判题与字符级 diff
- 验收：单元测试通过；连续答题时，答错的词 10 分钟后会再次出现

**M3 · 调度与免打扰**
- 随机 / 固定间隔、工作时段、暂停、今天不再弹；全屏检测；打字检测
- 验收：全屏播放视频时不弹；托盘状态行的倒计时准确

**M4 · 设置页、导入导出、皮肤**
- 设置窗口四个分页；CSV/TXT 导入（带预览和错误行号）；学习进度导入导出；三套皮肤加跟随系统
- 验收：切换皮肤后弹窗即时变样；导入一个有错误行的 CSV，能看到具体行号

**M5 · AI 与生词**
- AI 配置和测试连接；生成例句、答错讲解、错词出新题；加入生词快捷键
- 验收：不配 Key 时界面上看不到任何 AI 元素；断网时答题流程不受影响

**M6 · 打包**
- 生成 `.dmg` 和 `.exe`；写一份给朋友看的 `INSTALL.md`
- 验收：在一台干净的电脑上能装、能用、能开机自启

---

## 14. 不做（MVP 之外）

多设备同步、账号、手机端、会议软件检测、统计报表（只保留今日题数和正确率）、自定义皮肤导入、皮肤化托盘菜单、Anki 导入、自动更新。

> 例外（2026-11-12 作者追加）：设置窗口增加只读的「学习记录」分页，列出练过的单词和句子（作答次数、答对次数、最近一次结果、下次复习时间），可搜索，可筛选「全部 / 答错过 / 已到期」。仍不做图表和趋势统计。

---

## 15. 已知风险和注意事项

- **macOS 未签名**：朋友第一次打开会被系统拦截，需要在「系统设置 → 隐私与安全性」里点「仍要打开」。在 `INSTALL.md` 里写清楚
- **Windows SmartScreen**：未签名的 exe 会提示「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」
- **不抢焦点**在两个平台上的实现方式不同，是 M1 的重点，务必两边都实际测
- **语音质量**：Windows 和 macOS 自带的英文语音不一样，优先选 `en-US` 语音，找不到再退到任意 `en-*` 语音
- **辅助功能权限**：只有「加入生词」需要，不要在启动时就申请
