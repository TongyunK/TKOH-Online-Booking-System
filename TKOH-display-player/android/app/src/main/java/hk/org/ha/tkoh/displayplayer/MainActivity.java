package hk.org.ha.tkoh.displayplayer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

public class MainActivity extends Activity {
  private static final int SECRET_TAPS = 5;
  private static final long SECRET_WINDOW_MS = 2000;
  private static final int CORNER_SIZE_DP = 120;
  private static final int SETTINGS_REQUEST = 1001;

  private WebView webView;
  private ConfigStore configStore;
  private String targetUrl = "";
  private int secretTapCount = 0;
  private long secretTapWindowStart = 0;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private Runnable periodicReload;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    hideSystemUi();

    configStore = new ConfigStore(this);
    webView = new WebView(this);
    setContentView(webView);

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setUserAgentString(settings.getUserAgentString() + " TKOHDisplayPlayer/1.0");
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

    webView.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return false;
      }

      @Override
      public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        view.postDelayed(() -> view.loadUrl(targetUrl), 15000);
      }
    });

    loadDisplayFromConfig();
  }

  @Override
  protected void onDestroy() {
    stopPeriodicReload();
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
    if (requestCode == SETTINGS_REQUEST && resultCode == RESULT_OK) {
      loadDisplayFromConfig();
    }
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
    webView.loadUrl(targetUrl);
    schedulePeriodicReload(config.optInt("reloadHours", 0));
  }

  private void schedulePeriodicReload(int reloadHours) {
    stopPeriodicReload();
    if (reloadHours <= 0) return;
    periodicReload = new Runnable() {
      @Override
      public void run() {
        webView.loadUrl(targetUrl);
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
    View decor = getWindow().getDecorView();
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
