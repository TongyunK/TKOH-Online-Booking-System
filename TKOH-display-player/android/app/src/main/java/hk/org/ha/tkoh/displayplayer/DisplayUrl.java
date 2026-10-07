package hk.org.ha.tkoh.displayplayer;

import android.net.Uri;

import org.json.JSONObject;

public final class DisplayUrl {
  private DisplayUrl() {}

  public static String build(JSONObject config) {
    String link = config.optString("link", "").trim();
    return withPlayerFlag(link);
  }

  /**
   * Append player=1 without using Uri.buildUpon(), which drops non-default
   * ports (e.g. :3200) on some Android versions → ERR_CONNECTION_REFUSED.
   */
  public static String withPlayerFlag(String link) {
    String raw = String.valueOf(link == null ? "" : link).trim();
    if (raw.isEmpty()) return raw;

    try {
      Uri uri = Uri.parse(raw);
      if (uri.getQueryParameter("player") != null) {
        return reconstruct(uri);
      }
      String rebuilt = reconstruct(uri);
      return rebuilt.contains("?")
          ? rebuilt + "&player=1"
          : rebuilt + "?player=1";
    } catch (Exception e) {
      if (raw.contains("player=")) return raw;
      return raw.contains("?") ? raw + "&player=1" : raw + "?player=1";
    }
  }

  private static String reconstruct(Uri uri) {
    String scheme = uri.getScheme();
    String host = uri.getHost();
    if (scheme == null || host == null) {
      return uri.toString();
    }

    StringBuilder sb = new StringBuilder();
    sb.append(scheme).append("://").append(host);

    int port = uri.getPort();
    if (port > 0) {
      sb.append(':').append(port);
    }

    String path = uri.getEncodedPath();
    if (path != null && !path.isEmpty()) {
      sb.append(path);
    }

    String query = uri.getEncodedQuery();
    if (query != null && !query.isEmpty()) {
      sb.append('?').append(query);
    }

    String fragment = uri.getEncodedFragment();
    if (fragment != null && !fragment.isEmpty()) {
      sb.append('#').append(fragment);
    }

    return sb.toString();
  }
}
