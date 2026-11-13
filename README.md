# 拼刻 Spelltick

办公时弹出词卡的英语拼写桌面工具。应用常驻托盘，定时出现时不获取焦点；点击卡片或按快捷键后开始答题。

## 下载安装

在 [Releases](https://github.com/jaredchao/spelltick/releases/latest) 下载 Mac 通用安装包，同时支持 Apple 芯片和 Intel。安装步骤见 [INSTALL.md](INSTALL.md)。

应用尚未签名和公证，首次打开需在「系统设置 → 隐私与安全性」中允许打开。Windows 代码已包含在仓库中，Windows 安装包和实机验证尚未完成。

## 功能

- 单词拼写、听写、例句挖空和整句听写。
- 内置四六级词库、程序员与职场英语词库，支持导入 CSV/TXT。
- 间隔复习、工作时段、全屏免打扰、暂停出题。
- 三套皮肤、学习记录、分词输入格、音效和可拖动词卡。
- 可选的 OpenAI 兼容接口，用于生成例句、拼写讲解和生词释义。API Key 存在系统钥匙串中。
- 学习数据存于本机，可导入和导出学习进度。

## 本地开发

需要 Node.js 22.12+、Rust 1.92.0，以及 [Tauri 2 平台依赖](https://v2.tauri.app/start/prerequisites/)。Mac 构建需要 Xcode Command Line Tools。

```sh
npm ci
npm run tauri dev
```

检查代码：

```sh
npm run typecheck
npm test
cd src-tauri
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
```

构建 Mac 通用安装包：

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run build:mac
python3 scripts/verify-macos-bundle.py
```

## GitHub 自动发布

`.github/workflows/release-macos.yml` 在推送 `v*` 标签时运行测试，构建 Mac 通用安装包，并上传 DMG、安装说明和 SHA-256 校验文件到 GitHub Releases。

发布前，将 `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 和 `src-tauri/tauri.conf.json` 的版本保持一致。提交改动后创建并推送对应标签：

```sh
git tag -a v0.1.0 -m "拼刻 Spelltick v0.1.0"
git push origin main
git push origin v0.1.0
```

也可以在 Actions 的「Release macOS」页面选择「Run workflow」，输入已存在的版本标签。工作流使用 GitHub 自带的 `GITHUB_TOKEN`，无需设置个人 Token。

## 文档与数据来源

- [开发规格](docs/SPEC.md)
- [决策记录](docs/DECISIONS.md)
- 四六级词库来自 [ECDICT](https://github.com/skywind3000/ECDICT)（[MIT 许可](src-tauri/data/LICENSE-ECDICT)）。
- Inter、JetBrains Mono 和 Source Serif 4 字体遵循 SIL Open Font License，许可文件随字体保存在仓库中。
