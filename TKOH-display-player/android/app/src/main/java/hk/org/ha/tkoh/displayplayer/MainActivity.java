package hk.org.ha.tkoh.displayplayer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * 24h 常开 kiosk：软定时回收 + 心跳看门狗 + WebView 渲染进程崩溃自愈。
 * 定时 Reload 仅 webView.reload()，禁止 clearCache（旧版每小时 clearCache+硬刷
 * 曾在部分商显机上触发 Wi‑Fi 关联掉线）。
 */
public class MainActivity extends Activity {
  private static final int SECRET_TAPS = 5;
  private static final long SECRET_WINDOW_MS = 2000;
  private static final int CORNER_SIZE_DP = 120;
  private static final int SETTINGS_REQUEST = 1001;
  private static final long FAIL_RELOAD_MS = 3000;
  private static final long FAIL_RELOAD_MAX_MS = 60_000L;
  /** 无网时禁止短间隔狂刷，避免拖垮 Wi‑Fi 驱动 */
  private static final long FAIL_RELOAD_OFFLINE_MS = 90_000L;
  /** 心跳检测间隔 */
  private static final long WATCHDOG_INTERVAL_MS = 45_000L;
  /** 连续不健康次数达到后软刷新 */
  private static final int WATCHDOG_FAIL_THRESHOLD = 2;
  /** 两次自动恢复最小间隔，防止死循环狂刷 */
  private static final long RECOVERY_COOLDOWN_MS = 90_000L;
  /** 等待首屏就绪（跨地域延迟高时避免过早露黑底） */
  private static final long CONTENT_READY_POLL_MS = 300L;
  private static final int CONTENT_READY_MAX_ATTEMPTS = 70; // ~21s
  private static final int BRAND_NAVY = 0xFF001E5C;

  private FrameLayout root;
  private WebView webView;
  private TextView loadingView;
  private ConfigStore configStore;
  private String targetUrl = "";
  private int secretTapCount = 0;
  private long secretTapWindowStart = 0;
  private boolean initialLoadStarted = false;
  private int watchdogFailCount = 0;
  private long lastRecoveryAt = 0;
  private int contentReadyAttempts = 0;
  private int failRetryAttempt = 0;
  private boolean networkCallbackRegistered = false;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private Runnable periodicReload;
  private Runnable failReload;
  private Runnable watchdogTick;
  private Runnable contentReadyPoll;
  private ConnectivityManager.NetworkCallback networkCallback;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    hideSystemUi();

    configStore = new ConfigStore(this);
    root = new FrameLayout(this);
    root.setBackgroundColor(BRAND_NAVY);

    loadingView = new TextView(this);
    loadingView.setText("Room Display Player Demo\nConnecting…");
    loadingView.setTextColor(0xFFE2E8F0);
    loadingView.setBackgroundColor(BRAND_NAVY);
    loadingView.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
    loadingView.setGravity(android.view.Gravity.CENTER);

    createWebView();
    root.addView(loadingView, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
    ));
    setContentView(root);

    // Wait until WebView has a real size (common black-screen cause on some panels).
    webView.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
      @Override
      public void onGlobalLayout() {
        if (webView == null || webView.getWidth() <= 0 || webView.getHeight() <= 0) return;
        webView.getViewTreeObserver().removeOnGlobalLayoutListener(this);
        startInitialLoad();
      }
    });
    handler.postDelayed(this::startInitialLoad, 500);
  }

  @SuppressLint("SetJavaScriptEnabled")
  private void createWebView() {
    if (webView != null) {
      root.removeView(webView);
      try {
        webView.stopLoading();
        webView.destroy();
      } catch (Exception ignored) {
      }
      webView = null;
    }

    webView = new WebView(this);
    // 与品牌底色一致，避免白屏/黑屏闪一下（尤其跨境网络慢时）
    webView.setBackgroundColor(BRAND_NAVY);
    root.addView(webView, 0, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
    ));

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setUserAgentString(settings.getUserAgentString() + " TKOHDisplayPlayer/1.0");
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setTextZoom(100);
    settings.setMinimumFontSize(1);
    settings.setMinimumLogicalFontSize(1);
    settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      settings.setSafeBrowsingEnabled(false);
    }

    webView.setWebChromeClient(new WebChromeClient());
    webView.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return false;
      }

      @Override
      @SuppressWarnings("deprecation")
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return false;
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        // Chromium 错误页也会触发 finished，不要清零退避、不要当成功页处理
        if (url != null && (
            url.startsWith("chrome-error://")
                || url.startsWith("data:text/html")
                || url.contains("neterror")
        )) {
          return;
        }
        // 不立刻关遮罩：HTML 壳出来后还要拉 JS/API
        failRetryAttempt = 0;
        injectKioskHeartbeat();
        watchdogFailCount = 0;
        beginWaitForContentReady();
      }

      @Override
      public void onPageCommitVisible(WebView view, String url) {
        // 保持 Loading，直到 __tkohDisplayReady 或超时
      }

      @Override
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request == null || !request.isForMainFrame()) return;
        String desc = error != null && error.getDescription() != null
            ? error.getDescription().toString()
            : "unknown";
        onMainFrameLoadFailed(desc);
      }

      @Override
      @SuppressWarnings("deprecation")
      public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
          onMainFrameLoadFailed(description);
        }
      }

      @Override
      public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        // Chromium 渲染进程崩溃：重建 WebView 并软加载，避免整机假死黑屏
        showLoading("Display engine restarted\nRecovering…");
        handler.post(() -> {
          createWebView();
          softRecover("render-process-gone");
        });
        return true;
      }
    });
  }

  private void startInitialLoad() {
    if (initialLoadStarted || isFinishing()) return;
    initialLoadStarted = true;
    registerNetworkCallback();
    loadDisplayFromConfig();
    startWatchdog();
  }

  /**
   * 有网恢复时再软加载一次；无网时不主动狂刷 URL（旧版失败重试可导致 Wi‑Fi 掉线）。
   */
  private void registerNetworkCallback() {
    if (networkCallbackRegistered) return;
    try {
      ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return;
      networkCallback = new ConnectivityManager.NetworkCallback() {
        @Override
        public void onAvailable(Network network) {
          handler.post(() -> {
            if (webView == null || targetUrl == null || targetUrl.isEmpty()) return;
            // 遮罩可见或此前失败过：网络回来后立刻软恢复，勿 clearCache
            if (loadingView != null && loadingView.getVisibility() == View.VISIBLE) {
              failRetryAttempt = 0;
              webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
              webView.loadUrl(targetUrl);
            }
          });
        }
      };
      NetworkRequest req = new NetworkRequest.Builder()
          .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
          .build();
      cm.registerNetworkCallback(req, networkCallback);
      networkCallbackRegistered = true;
    } catch (Exception ignored) {
      /* best-effort */
    }
  }

  private void unregisterNetworkCallback() {
    if (!networkCallbackRegistered || networkCallback == null) return;
    try {
      ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm != null) cm.unregisterNetworkCallback(networkCallback);
    } catch (Exception ignored) {
      /* best-effort */
    }
    networkCallbackRegistered = false;
    networkCallback = null;
  }

  private void showLoading(String text) {
    if (loadingView == null) return;
    loadingView.setText(text);
    loadingView.setVisibility(View.VISIBLE);
    loadingView.bringToFront();
  }

  private void hideLoading() {
    if (loadingView != null) loadingView.setVisibility(View.GONE);
  }

  /**
   * 主文档加载失败（如 ERR_ADDRESS_UNREACHABLE）：用品牌遮罩盖住系统白底错误页。
   * 有网：短退避重试；无网：长间隔等待 + 等 NetworkCallback，禁止 3 秒狂刷。
   */
  private void onMainFrameLoadFailed(String desc) {
    stopContentReadyPoll();
    boolean online = isNetworkLikelyUp();
    String netHint = online
        ? "Server unreachable\n(check VPN / firewall / IP)"
        : "No network connection\nWaiting for Wi‑Fi…";
    showLoading(
        "Room Display Player Demo\n"
            + netHint + "\n"
            + desc + "\n"
            + (online ? "Retrying…" : "Will retry when online")
    );
    scheduleFailReload();
  }

  private boolean isNetworkLikelyUp() {
    try {
      ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return true;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && (
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
        );
      }
      android.net.NetworkInfo info = cm.getActiveNetworkInfo();
      return info != null && info.isConnected();
    } catch (Exception e) {
      return true;
    }
  }

  private void scheduleFailReload() {
    if (failReload != null) handler.removeCallbacks(failReload);
    boolean online = isNetworkLikelyUp();
    long delay;
    if (!online) {
      // 无网：绝不短间隔 loadUrl（旧版 clearCache+3s 重试可拖垮部分面板 Wi‑Fi）
      delay = FAIL_RELOAD_OFFLINE_MS;
    } else {
      delay = Math.min(
          FAIL_RELOAD_MAX_MS,
          FAIL_RELOAD_MS * (1L << Math.min(failRetryAttempt, 4))
      );
    }
    failRetryAttempt += 1;
    failReload = () -> {
      if (webView == null || targetUrl == null || targetUrl.isEmpty()) return;
      if (!isNetworkLikelyUp()) {
        showLoading("Room Display Player Demo\nNo network connection\nWaiting for Wi‑Fi…");
        scheduleFailReload();
        return;
      }
      webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
      webView.loadUrl(targetUrl);
    };
    handler.postDelayed(failReload, delay);
  }

  /** 页面内心跳：证明 JS 事件循环仍在跑 */
  private void injectKioskHeartbeat() {
    if (webView == null) return;
    webView.evaluateJavascript(
        "(function(){"
            + "if(window.__tkohKioskHb)return;"
            + "window.__tkohKioskHb=true;"
            + "window.__tkohAliveAt=Date.now();"
            + "setInterval(function(){window.__tkohAliveAt=Date.now();},15000);"
            + "})();",
        null
    );
  }

  private void startWatchdog() {
    stopWatchdog();
    watchdogTick = new Runnable() {
      @Override
      public void run() {
        checkPageHealth();
        handler.postDelayed(this, WATCHDOG_INTERVAL_MS);
      }
    };
    handler.postDelayed(watchdogTick, WATCHDOG_INTERVAL_MS);
  }

  private void stopWatchdog() {
    if (watchdogTick != null) {
      handler.removeCallbacks(watchdogTick);
      watchdogTick = null;
    }
  }

  private void checkPageHealth() {
    if (webView == null || isFinishing()) return;
    // 加载遮罩显示中不判健康，避免误杀
    if (loadingView != null && loadingView.getVisibility() == View.VISIBLE) return;

    webView.evaluateJavascript(
        "(function(){"
            + "try{"
            + "var alive=window.__tkohAliveAt||0;"
            + "if(alive&&(Date.now()-alive)>120000)return 'stale';"
            + "var root=document.querySelector("
            + "'.tea-display-root,.merge-display-root,.ev-display-root,"
            + ".ev-display-viewport,.venue-display-root,.calendar-month'"
            + ");"
            + "if(!root){"
            + "  root=document.querySelector('#app > div');"
            + "}"
            + "if(!root)return 'no-root';"
            + "if(root.offsetWidth<8||root.offsetHeight<8)return 'tiny';"
            + "var t=window.getComputedStyle(root).transform||'';"
            + "var m=t.match(/matrix\\(([^,]+)/);"
            + "if(m){var a=parseFloat(m[1]);if(a>0&&a<0.05)return 'tiny-scale';}"
            + "return 'ok';"
            + "}catch(e){return 'err';}"
            + "})()",
        value -> {
          String status = value == null ? "null" : value.replace("\"", "");
          if ("ok".equals(status)) {
            watchdogFailCount = 0;
            return;
          }
          watchdogFailCount += 1;
          if (watchdogFailCount >= WATCHDOG_FAIL_THRESHOLD) {
            watchdogFailCount = 0;
            softRecover("watchdog:" + status);
          }
        }
    );
  }

  private void softRecover(String reason) {
    long now = System.currentTimeMillis();
    if (now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return;
    lastRecoveryAt = now;
    if (webView == null || targetUrl == null || targetUrl.isEmpty()) return;
    showLoading("Recovering display…\n" + reason);
    webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
    webView.loadUrl(targetUrl);
  }

  private void stopContentReadyPoll() {
    if (contentReadyPoll != null) {
      handler.removeCallbacks(contentReadyPoll);
      contentReadyPoll = null;
    }
  }

  /**
   * 等页面设置 window.__tkohDisplayReady=true（首屏数据+布局完成）再关遮罩。
   * 佛山→香港等慢链路下可避免「黑屏一会才出内容」。
   */
  private void beginWaitForContentReady() {
    stopContentReadyPoll();
    contentReadyAttempts = 0;
    showLoading("Room Display Player Demo\nLoading content…\n(slow network, please wait)");
    contentReadyPoll = new Runnable() {
      @Override
      public void run() {
        if (webView == null || isFinishing()) return;
        contentReadyAttempts += 1;
        if (contentReadyAttempts > CONTENT_READY_MAX_ATTEMPTS) {
          hideLoading();
          contentReadyPoll = null;
          return;
        }
        if (contentReadyAttempts == 1 || contentReadyAttempts % 10 == 0) {
          int sec = contentReadyAttempts * (int) (CONTENT_READY_POLL_MS / 1000);
          if (sec < 1) sec = contentReadyAttempts * 300 / 1000;
          showLoading(
              "Room Display Player Demo\nLoading content…\n"
                  + "(network may be slow: " + Math.max(1, contentReadyAttempts * 300 / 1000) + "s)"
          );
        }
        webView.evaluateJavascript(
            "(function(){"
                + "try{"
                + "if(window.__tkohDisplayReady===true)return 'ready';"
                + "var root=document.querySelector("
                + "'.tea-display-root,.merge-display-root,.ev-display-root,"
                + ".ev-display-viewport,.venue-display-root'"
                + ");"
                + "if(root&&root.offsetWidth>40&&root.offsetHeight>40"
                + "&&document.body&&document.body.innerText"
                + "&&document.body.innerText.length>20)return 'ready';"
                + "return 'wait';"
                + "}catch(e){return 'wait';}"
                + "})()",
            value -> {
              String status = value == null ? "wait" : value.replace("\"", "");
              if ("ready".equals(status)) {
                hideLoading();
                contentReadyPoll = null;
                return;
              }
              if (contentReadyPoll != null) {
                handler.postDelayed(contentReadyPoll, CONTENT_READY_POLL_MS);
              }
            }
        );
      }
    };
    handler.post(contentReadyPoll);
  }

  @Override
  protected void onDestroy() {
    stopPeriodicReload();
    stopWatchdog();
    stopContentReadyPoll();
    unregisterNetworkCallback();
    if (failReload != null) handler.removeCallbacks(failReload);
    if (webView != null) {
      ViewGroup parent = (ViewGroup) webView.getParent();
      if (parent != null) parent.removeView(webView);
      webView.stopLoading();
      webView.destroy();
      webView = null;
    }
    super.onDestroy();
  }

  @Override
  public boolean dispatchTouchEvent(MotionEvent event) {
    if (event.getAction() == MotionEvent.ACTION_DOWN && isSecretCornerTap(event)) {
      long now = System.currentTimeMillis();
      if (now - secretTapWindowStart > SECRET_WINDOW_MS) {
        secretTapCount = 0;
        secretTapWindowStart = now;
      }
      secretTapCount++;
      if (secretTapCount >= SECRET_TAPS) {
        secretTapCount = 0;
        openSettings();
        return true;
      }
    }
    return super.dispatchTouchEvent(event);
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode != SETTINGS_REQUEST) return;
    if (resultCode == SettingsActivity.RESULT_EXIT) {
      finishAndRemoveTask();
      return;
    }
    if (resultCode == RESULT_OK) {
      loadDisplayFromConfig();
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    hideSystemUi();
    if (webView != null) webView.onResume();
  }

  @Override
  protected void onPause() {
    // 24h 常开：不要 webView.onPause()，否则 JS 定时器/轮询停掉，页面会「假死」
    super.onPause();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideSystemUi();
  }

  @Override
  public void onBackPressed() {
    // Kiosk: ignore back.
  }

  private boolean isSecretCornerTap(MotionEvent event) {
    DisplayMetrics metrics = getResources().getDisplayMetrics();
    float corner = CORNER_SIZE_DP * metrics.density;
    return event.getRawX() >= metrics.widthPixels - corner && event.getRawY() <= corner;
  }

  private void openSettings() {
    Intent intent = new Intent(this, SettingsActivity.class);
    startActivityForResult(intent, SETTINGS_REQUEST);
  }

  private void loadDisplayFromConfig() {
    // 默认走缓存：跨境（如内地→香港）二次打开更快；Force refresh 靠改 URL _v= 即可破缓存
    loadDisplayFromConfig(false);
  }

  private void loadDisplayFromConfig(boolean bypassCache) {
    JSONObject config = configStore.load();
    targetUrl = DisplayUrl.build(config);
    stopContentReadyPoll();
    showLoading("Room Display Player Demo\nConnecting…\n" + targetUrl);
    loadDisplayUrl(targetUrl, bypassCache);
    schedulePeriodicReload(config.optInt("reloadHours", 12));
  }

  private void loadDisplayUrl(String url, boolean bypassCache) {
    if (webView == null || url == null || url.isEmpty()) return;
    if (bypassCache) {
      try {
        webView.clearCache(true);
      } catch (Exception ignored) {
        /* best-effort */
      }
      webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    } else {
      webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
    }
    webView.loadUrl(url);
  }

  private void schedulePeriodicReload(int reloadHours) {
    stopPeriodicReload();
    if (reloadHours <= 0) return;
    // 建议 12～24：温和回收 WebView 内存；无网时跳过，避免把可用页刷成错误页
    long intervalMs = reloadHours * 60L * 60L * 1000L;
    periodicReload = new Runnable() {
      @Override
      public void run() {
        if (webView != null && targetUrl != null && !targetUrl.isEmpty()) {
          if (!isNetworkLikelyUp()) {
            // 保持当前画面，等下次周期或 NetworkCallback
            handler.postDelayed(this, intervalMs);
            return;
          }
          webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
          // 软刷新：不 clearCache、不 LOAD_NO_CACHE
          webView.reload();
        }
        handler.postDelayed(this, intervalMs);
      }
    };
    handler.postDelayed(periodicReload, intervalMs);
  }

  private void stopPeriodicReload() {
    if (periodicReload != null) {
      handler.removeCallbacks(periodicReload);
      periodicReload = null;
    }
  }

  private void hideSystemUi() {
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
    View decor = getWindow().getDecorView();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      getWindow().setDecorFitsSystemWindows(false);
      WindowInsetsController controller = getWindow().getInsetsController();
      if (controller != null) {
        controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        controller.setSystemBarsBehavior(
          WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
      }
      return;
    }
    decor.setSystemUiVisibility(
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        | View.SYSTEM_UI_FLAG_FULLSCREEN
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    );
  }
}
