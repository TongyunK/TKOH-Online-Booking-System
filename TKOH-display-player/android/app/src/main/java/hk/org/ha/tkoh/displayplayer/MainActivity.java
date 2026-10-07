package hk.org.ha.tkoh.displayplayer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import org.json.JSONObject;

public class MainActivity extends Activity {
  private static final int SECRET_TAPS = 5;
  private static final long SECRET_WINDOW_MS = 2000;
  private static final int CORNER_SIZE_DP = 120;
  private static final int SETTINGS_REQUEST = 1001;
  private static final long FAIL_RELOAD_MS = 3000;

  private FrameLayout root;
  private WebView webView;
  private TextView loadingView;
  private ConfigStore configStore;
  private String targetUrl = "";
  private int secretTapCount = 0;
  private long secretTapWindowStart = 0;
  private boolean initialLoadStarted = false;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private Runnable periodicReload;
  private Runnable failReload;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    hideSystemUi();

    configStore = new ConfigStore(this);
    root = new FrameLayout(this);
    root.setBackgroundColor(0xFF001E5C);

    webView = new WebView(this);
    webView.setBackgroundColor(Color.WHITE);
    root.addView(webView, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
    ));

    loadingView = new TextView(this);
    loadingView.setText("TKOH Display Player\nLoading display…");
    loadingView.setTextColor(0xFFE2E8F0);
    loadingView.setBackgroundColor(0xFF001E5C);
    loadingView.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
    loadingView.setGravity(android.view.Gravity.CENTER);
    root.addView(loadingView, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
    ));
    setContentView(root);

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
        hideLoading();
      }

      @Override
      public void onPageCommitVisible(WebView view, String url) {
        hideLoading();
      }

      @Override
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request == null || !request.isForMainFrame()) return;
        String desc = error != null && error.getDescription() != null
            ? error.getDescription().toString()
            : "unknown";
        showLoading("Load failed\n" + desc + "\nRetrying…");
        scheduleFailReload();
      }

      @Override
      @SuppressWarnings("deprecation")
      public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
          showLoading("Load failed\n" + description + "\nRetrying…");
          scheduleFailReload();
        }
      }
    });

    // Wait until WebView has a real size (common black-screen cause on some panels).
    webView.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
      @Override
      public void onGlobalLayout() {
        if (webView.getWidth() <= 0 || webView.getHeight() <= 0) return;
        webView.getViewTreeObserver().removeOnGlobalLayoutListener(this);
        startInitialLoad();
      }
    });
    // Fallback if layout callback never fires.
    handler.postDelayed(this::startInitialLoad, 500);
  }

  private void startInitialLoad() {
    if (initialLoadStarted || isFinishing()) return;
    initialLoadStarted = true;
    loadDisplayFromConfig();
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

  private void scheduleFailReload() {
    if (failReload != null) handler.removeCallbacks(failReload);
    failReload = () -> {
      if (webView != null && targetUrl != null && !targetUrl.isEmpty()) {
        webView.loadUrl(targetUrl);
      }
    };
    handler.postDelayed(failReload, FAIL_RELOAD_MS);
  }

  @Override
  protected void onDestroy() {
    stopPeriodicReload();
    if (failReload != null) handler.removeCallbacks(failReload);
    if (webView != null) {
      root.removeView(webView);
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
    if (webView != null) webView.onPause();
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
    JSONObject config = configStore.load();
    targetUrl = DisplayUrl.build(config);
    showLoading("TKOH Display Player\nLoading…\n" + targetUrl);
    // Do NOT block on network warm-up — a hung HEAD kept the screen black forever.
    webView.loadUrl(targetUrl);
    schedulePeriodicReload(config.optInt("reloadHours", 0));
  }

  private void schedulePeriodicReload(int reloadHours) {
    stopPeriodicReload();
    if (reloadHours <= 0) return;
    periodicReload = new Runnable() {
      @Override
      public void run() {
        if (webView != null) webView.loadUrl(targetUrl);
        handler.postDelayed(this, reloadHours * 60L * 60L * 1000L);
      }
    };
    handler.postDelayed(periodicReload, reloadHours * 60L * 60L * 1000L);
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
