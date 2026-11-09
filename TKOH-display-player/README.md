# TKOH Display Player

大屏不走用户浏览器，由播放器全屏打开现有 display 网页。

`config.json` 只保留两个字段：

```json
{
  "link": "https://103.68.62.241:3243/VenueBooking/Display/Merge",
  "reloadHours": 12
}
```

`link` 填写完整大屏地址。播放器会自动带上 `player=1`，页面不再弹出全屏遮罩。

### 24 小时常开建议

- **Reload hours = 12～24**：定时**软刷新**回收 WebView/Chromium 内存；不要设 0（长跑更容易卡死/黑屏）。
- 播放器内置**心跳看门狗**：页面无根节点、JS 假死、`scale` 异常过小时会自动软恢复。
- **WebView / 渲染进程崩溃**会自动重建并重新加载。
- 系统侧：关闭系统屏保与休眠；Android 保持「永不休眠」；Windows 电源设为从不关闭显示器/从不睡眠；有线网络优先。
- 服务器前端保持可访问；设备勿装省电策略杀掉后台。

## Windows

1. 编辑 `windows/config.json` 的 `link`、`reloadHours`
2. 在 `TKOH-display-player` 或 `windows` 目录执行（`package.json` 在 `windows` 里）：

```
cd TKOH-display-player
npm install
npm start
```

或：

```
cd TKOH-display-player\windows
npm install
npm start
```

若出现 `Electron failed to install correctly`，说明 Chromium 二进制没下完（常见于网络）。在 `windows` 目录执行：

```
.\install.ps1
npm start
```

或手动：

```
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
Remove-Item -Recurse -Force .\node_modules\electron -ErrorAction SilentlyContinue
npm install
npm start
```

退出：`Ctrl+Shift+Q`

打包安装包：

```
npm run pack
```

安装后可改安装目录旁的 `config.json`，不必重装。也可在播放器里 **连续点击右上角 5 次**（2 秒内）打开设置面板修改 `link`；Windows 另支持 **Ctrl+Shift+P**。开机启动请在 Windows「启动」文件夹放快捷方式。

## Android

Android 用 Android Studio 打包（不能用 `npm run pack`）。

### 打包 APK

1. 安装 [Android Studio](https://developer.android.com/studio)
2. 先改大屏地址：`android/app/src/main/assets/config.json`

```json
{
  "link": "https://103.68.62.241:3243/VenueBooking/Display/Merge",
  "reloadHours": 12
}
```

3. 打开 Android Studio → **Open** → 选本仓库的 `TKOH-display-player/android` 目录  
4. 第一次打开会自动下载 Gradle / SDK，等右下角同步完成  
5. 菜单 **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
6. 完成后点 **locate**，或到这个路径找安装包：

```
android/app/build/outputs/apk/debug/app-debug.apk
```

若要正式包：**Build → Generate Signed Bundle / APK**，选 APK，签名后得到 `app-release.apk`。

### 安装到安卓大屏

- USB 连设备后，Android Studio 点绿色 Run，或  
- 把 `app-debug.apk` 拷到大屏，用文件管理器安装（需允许「未知来源」）

### 开机全屏 / 设为桌面

视机型在系统设置里把「TKOH Display」设为默认启动器，或加入开机自启。  
App 已声明 `HOME`，部分设备首次按 Home 键时可选「始终」用本 App。

HTTP 内网地址已允许（cleartext）。首次启动会把 `assets/config.json` 复制到 App 私有目录；之后可在设备上 **连续点击右上角 5 次** 打开设置面板修改 `link`，无需重装 APK。

屏幕方向跟随设备（`fullSensor`）：单场地请装竖屏机，Merge / Tea / EV 请装横屏机。

## 注意

- 内容仍由现有前端服务器更新，播放器只负责全屏和锁引擎（Windows 锁 Electron 自带 Chromium；Android 仍用系统 WebView，需统一机型）
- 不要把登录页、Admin 配进播放器
