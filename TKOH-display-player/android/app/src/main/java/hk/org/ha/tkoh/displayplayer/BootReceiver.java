package hk.org.ha.tkoh.displayplayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 开机完成后拉起大屏。仍建议同时设为默认 Home，并关闭甜椒等旧播放器自启。
 */
public class BootReceiver extends BroadcastReceiver {
  private static final String QUICKBOOT_POWERON = "android.intent.action.QUICKBOOT_POWERON";
  private static final String HTC_QUICKBOOT_POWERON = "com.htc.intent.action.QUICKBOOT_POWERON";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (context == null || intent == null) return;
    String action = intent.getAction();
    if (action == null) return;
    if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
        && !QUICKBOOT_POWERON.equals(action)
        && !HTC_QUICKBOOT_POWERON.equals(action)) {
      return;
    }

    Intent launch = new Intent(context, MainActivity.class);
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    context.startActivity(launch);
  }
}
