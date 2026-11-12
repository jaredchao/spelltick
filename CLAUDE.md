# CLAUDE.md

## 项目
英语拼写弹窗：macOS + Windows 的常驻桌面小工具，办公时不定时弹出小卡片让用户拼写英文单词或句子。

- 完整需求：`docs/SPEC.md`（**开始任何工作前先读它**）
- 皮肤取值：`docs/design/skins.json`
- 视觉参考：`docs/design/*.dc.html`，阅读方法见 `docs/design/README.md`

## 技术栈
Tauri 2 · React 18 · TypeScript · Vite · SQLite · CSS 变量（不用 Tailwind）

## 常用命令
- 开发：`npm run tauri dev`（只有托盘图标，没有窗口）
- 前端测试：`npm test`（Vitest，单次运行）；监听模式：`npm run test:watch`
- Rust 测试：`cd src-tauri && cargo test`
- Rust 检查：`cd src-tauri && cargo clippy --all-targets`
- 类型检查：`npm run typecheck`
- 打包：`npm run tauri build`
- 重建四六级词库：`node scripts/build-ecdict.mjs`（首次会下载 ECDICT 到 `.cache/`）
- 重建程序员词库：改 `scripts/programmer-deck.tsv` 后运行 `node scripts/build-programmer.mjs`；改了内置词库要把 `src-tauri/src/db/seed.rs` 里对应的 `version` 加 1
- 开发数据库：`~/Library/Application Support/com.muluo.englishspell/spell.db`
- 决策记录：`docs/DECISIONS.md`（规格没写清、按推荐定下来的都记在这里）
- 视觉预览（不用启动 Tauri）：`npx vite --port 1430` 后打开 `http://localhost:1430/preview.html?skin=paper`，加 `&view=settings&tab=quiz` 看设置页
- 调试弹窗：开发版托盘里有「调试：5 秒后弹出」；也可以用 `SPELL_DEBUG_PEEK=8 npm run tauri dev`，启动 8 秒后弹出 peek

## 目录
- `src/core/`：纯函数和单元测试（`*.test.ts` 与源文件放在一起）
- `src/assets/fonts/`：皮肤字体 woff2
- `src/popup/`：弹窗组件；状态机在 `src/core/popupMachine.ts`
- `src/skin/`：读取 `docs/design/skins.json`，注入 CSS 变量
- `src/settingsWindow/`：设置窗口四个分页；`src/settings/` 是设置类型和读写接口
- `src-tauri/src/settings_cmd.rs`：设置、词库、导入导出命令；`src-tauri/src/scheduler/`：调度
- `src-tauri/src/popup.rs`：弹窗窗口的显示、定位、焦点（改这里前先读文件头注释）
- `src-tauri/src/tray.rs`：托盘图标与原生菜单
- `src-tauri/src/platform/`：`macos.rs` / `windows.rs`
- `src-tauri/icons/tray-template.png`：macOS 托盘单色占位图标（Windows 用应用图标）

## 版本约束
- React 固定 18.x（模板默认是 19，不要升级）
- `tauri.conf.json` 的 `app.windows` 目前为空，popup 和 settings 窗口在 M1 / M4 加入

## 工作方式
- 严格按 `docs/SPEC.md` 第 13 节的里程碑顺序推进，**一次只做一个里程碑**
- 每个里程碑开始前，先列出计划给我确认；做完后对照验收标准逐条自查，并告诉我哪些需要我在 Mac 或 Windows 上亲手测试
- 规格里没写清楚的地方，先问我，不要自己发明需求
- 规格里「不做」的功能不要做

## 代码约定
- 间隔重复算法、选题、判题、diff、CSV 解析都写成**纯函数**放在 `src/core/`，必须有单元测试
- 平台相关代码（全屏检测、空闲时间、钥匙串、选中文字）放在 `src-tauri/src/platform/`，用 `#[cfg(target_os = "...")]` 分开 macOS 和 Windows
- 组件里不写死颜色、字体、圆角，一律用 `skins.json` 里定义的 CSS 变量
- 随皮肤变化的文案从皮肤配置的 `copy` 里取，不要写死在组件里
- 快捷键统一用 `CommandOrControl`，显示时按平台转换成 ⌘ 或 Ctrl
- API Key 只存系统钥匙串，不进数据库、配置文件和日志
- 数据库结构有变化时写迁移脚本，不要直接改建表语句

## 最重要的一条
弹窗出现时**绝对不能抢走焦点**。任何改动 popup 窗口的代码，都要确认用户在别的应用里打字时，输入不会跑进弹窗。
