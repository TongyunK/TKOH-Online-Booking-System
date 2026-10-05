package hk.org.ha.tkoh.displayplayer;

import android.content.Context;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

public final class ConfigStore {
  private final Context context;
  private final File configFile;

  public ConfigStore(Context context) {
    this.context = context.getApplicationContext();
    this.configFile = new File(this.context.getFilesDir(), "config.json");
  }

  public JSONObject load() {
    if (!configFile.exists()) {
      bootstrapFromAssets();
    }
    try (FileInputStream in = new FileInputStream(configFile);
         BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
      StringBuilder sb = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) {
        sb.append(line);
      }
      return new JSONObject(sb.toString());
    } catch (Exception e) {
      return new JSONObject();
    }
  }

  public void save(JSONObject config) throws Exception {
    try (OutputStreamWriter writer = new OutputStreamWriter(
        new FileOutputStream(configFile), StandardCharsets.UTF_8)) {
      writer.write(config.toString(2));
    }
  }

  public File getConfigFile() {
    return configFile;
  }

  private void bootstrapFromAssets() {
    try (InputStream in = context.getAssets().open("config.json")) {
      try (OutputStreamWriter writer = new OutputStreamWriter(
          new FileOutputStream(configFile), StandardCharsets.UTF_8)) {
        byte[] buffer = new byte[4096];
        int read;
        while ((read = in.read(buffer)) != -1) {
          writer.write(new String(buffer, 0, read, StandardCharsets.UTF_8));
        }
      }
    } catch (Exception ignored) {
      // Leave missing file; DisplayUrl will handle empty config.
    }
  }
}
