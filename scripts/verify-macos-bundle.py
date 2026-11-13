"""Check the packaged name, icon and both CPU architectures before publishing."""

from pathlib import Path
import json
import plistlib
import subprocess

root = Path(__file__).resolve().parent.parent
config = json.loads((root / "src-tauri/tauri.conf.json").read_text())
app = root / "src-tauri/target/universal-apple-darwin/release/bundle/macos" / f"{config['productName']}.app"
info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
expected = {
    "CFBundleName": config["productName"],
    "CFBundleDisplayName": config["productName"],
    "CFBundleExecutable": config["mainBinaryName"],
    "CFBundleIdentifier": config["identifier"],
    "CFBundleShortVersionString": config["version"],
    "LSUIElement": True,
}
for key, value in expected.items():
    if info.get(key) != value:
        raise SystemExit(f"Unexpected bundle value for {key}: {info.get(key)!r}")

icon = app / "Contents/Resources" / info["CFBundleIconFile"]
if icon.read_bytes() != (root / "src-tauri/icons/icon.icns").read_bytes():
    raise SystemExit("The packaged icon differs from the source icon.")

binary = app / "Contents/MacOS" / info["CFBundleExecutable"]
architectures = subprocess.check_output(["lipo", "-archs", str(binary)], text=True).split()
if set(architectures) != {"arm64", "x86_64"}:
    raise SystemExit(f"Expected a universal executable, got {architectures!r}")

print(f"Verified {config['productName']} {config['version']}: arm64 + x86_64, matching icon, tray-only app.")
