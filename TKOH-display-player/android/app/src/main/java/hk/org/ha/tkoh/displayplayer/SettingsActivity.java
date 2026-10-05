package hk.org.ha.tkoh.displayplayer;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

public class SettingsActivity extends Activity {
  private ConfigStore configStore;
  private EditText linkInput;
  private EditText reloadHoursInput;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    configStore = new ConfigStore(this);
    JSONObject config = configStore.load();

    int pad = dp(20);
    int gap = dp(10);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(pad, pad, pad, pad);
    root.setBackground(gradient(0xFF111827, 0xFF0B1220));
    root.setLayoutParams(new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    ));

    LinearLayout header = new LinearLayout(this);
    header.setOrientation(LinearLayout.HORIZONTAL);
    header.setGravity(Gravity.CENTER_VERTICAL);
    header.setPadding(0, 0, 0, dp(14));

    TextView badge = new TextView(this);
    badge.setText("TK");
    badge.setTextColor(Color.WHITE);
    badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
    badge.setGravity(Gravity.CENTER);
    badge.setBackground(rounded(0xFF16A34A, dp(10)));
    LinearLayout.LayoutParams badgeLp = new LinearLayout.LayoutParams(dp(36), dp(36));
    badgeLp.rightMargin = dp(12);
    header.addView(badge, badgeLp);

    LinearLayout titles = new LinearLayout(this);
    titles.setOrientation(LinearLayout.VERTICAL);

    TextView title = new TextView(this);
    title.setText("Display Settings");
    title.setTextColor(Color.WHITE);
    title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
    title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);

    TextView subtitle = new TextView(this);
    subtitle.setText("Configure this device's display URL");
    subtitle.setTextColor(0xFF94A3B8);
    subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);

    titles.addView(title);
    titles.addView(subtitle);
    header.addView(titles);

    TextView linkLabel = label("Link");
    linkInput = input(config.optString("link", ""),
        "http://host:port/VenueBooking/Display/Merge",
        android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);

    TextView reloadLabel = label("Reload hours (0 = off)");
    LinearLayout.LayoutParams reloadLabelLp = new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    );
    reloadLabelLp.topMargin = gap;
    reloadLabel.setLayoutParams(reloadLabelLp);

    reloadHoursInput = input(String.valueOf(config.optInt("reloadHours", 6)),
        "6",
        android.text.InputType.TYPE_CLASS_NUMBER);

    TextView hint = new TextView(this);
    hint.setText("Saved to app config.json on this device.");
    hint.setTextColor(0xFF94A3B8);
    hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
    hint.setPadding(0, dp(10), 0, dp(14));

    LinearLayout buttons = new LinearLayout(this);
    buttons.setOrientation(LinearLayout.HORIZONTAL);
    buttons.setGravity(Gravity.END);

    Button cancel = actionButton("Cancel", 0xFF1E293B);
    cancel.setOnClickListener(v -> finish());

    Button save = actionButton("Save", 0xFF16A34A);
    save.setOnClickListener(v -> saveConfig());

    LinearLayout.LayoutParams cancelLp = new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    );
    cancelLp.rightMargin = gap;
    buttons.addView(cancel, cancelLp);
    buttons.addView(save);

    root.addView(header);
    root.addView(linkLabel);
    root.addView(linkInput, fieldLp());
    root.addView(reloadLabel);
    root.addView(reloadHoursInput, fieldLp());
    root.addView(hint);
    root.addView(buttons);

    setContentView(root);
  }

  private TextView label(String text) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextColor(0xFFCBD5E1);
    view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
    view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
    view.setPadding(0, 0, 0, dp(6));
    return view;
  }

  private EditText input(String value, String hint, int inputType) {
    EditText edit = new EditText(this);
    edit.setText(value);
    edit.setHint(hint);
    edit.setSingleLine(true);
    edit.setInputType(inputType);
    edit.setTextColor(0xFF0F172A);
    edit.setHintTextColor(0xFF94A3B8);
    edit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
    edit.setPadding(dp(12), dp(12), dp(12), dp(12));
    edit.setBackground(rounded(0xFFFFFFFF, dp(10)));
    return edit;
  }

  private Button actionButton(String text, int color) {
    Button button = new Button(this);
    button.setText(text);
    button.setAllCaps(false);
    button.setTextColor(Color.WHITE);
    button.setBackground(rounded(color, dp(10)));
    button.setMinWidth(dp(96));
    button.setPadding(dp(16), dp(10), dp(16), dp(10));
    return button;
  }

  private LinearLayout.LayoutParams fieldLp() {
    return new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    );
  }

  private int dp(int value) {
    return Math.round(TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        value,
        getResources().getDisplayMetrics()
    ));
  }

  private GradientDrawable rounded(int color, int radius) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setColor(color);
    drawable.setCornerRadius(radius);
    return drawable;
  }

  private GradientDrawable gradient(int top, int bottom) {
    GradientDrawable drawable = new GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        new int[]{top, bottom}
    );
    drawable.setCornerRadius(dp(14));
    return drawable;
  }

  private void saveConfig() {
    String link = linkInput.getText().toString().trim();
    if (link.isEmpty()) {
      Toast.makeText(this, "Link is required", Toast.LENGTH_SHORT).show();
      return;
    }

    int reloadHours = 0;
    try {
      reloadHours = Integer.parseInt(reloadHoursInput.getText().toString().trim());
    } catch (NumberFormatException ignored) {
      Toast.makeText(this, "Reload hours must be a number", Toast.LENGTH_SHORT).show();
      return;
    }

    try {
      JSONObject config = new JSONObject();
      config.put("link", link);
      config.put("reloadHours", reloadHours);
      configStore.save(config);
      setResult(RESULT_OK);
      finish();
    } catch (Exception e) {
      Toast.makeText(this, "Save failed", Toast.LENGTH_SHORT).show();
    }
  }
}
