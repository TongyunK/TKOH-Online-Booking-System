package hk.org.ha.tkoh.displayplayer;

import android.net.Uri;

import org.json.JSONObject;

public final class DisplayUrl {
  private DisplayUrl() {}

  public static String build(JSONObject config) {
    String link = config.optString("link", "").trim();
    Uri uri = Uri.parse(link);
    if (uri.getQueryParameter("player") == null) {
      uri = uri.buildUpon().appendQueryParameter("player", "1").build();
    }
    return uri.toString();
  }
}
