package hk.org.ha.tkoh.displayplayer;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

public class SettingsActivity extends Activity {
  static final int RESULT_EXIT = RESULT_FIRST_USER;
  private static final String DEFAULT_ORIGIN = "http://103.68.62.241:3200";
  private static final String[][] PRESETS = {
    { "Discussion Room", "/VenueBooking/Display?displayType=single&venueId=4" },
    { "Function Room", "/VenueBooking/Display?displayType=single&venueId=5" },
    { "Lecture Theatre", "/VenueBooking/Display?displayType=single&venueId=6" },
    { "Auditorium", "/VenueBooking/Display?displayType=single&venueId=7" },
    { "Tea Service", "/VenueBooking/Display/TeaService" },
    { "Venue Merge Screen", "/VenueBooking/Display/Merge" },
    { "EV Display", "/evBooking/Display" }
  };

  private ConfigStore configStore;
  private EditText linkInput;
  private EditText reloadHoursInput;
  private final java.util.ArrayList<Button> presetButtons = new java.util.ArrayList<>();
  private final java.util.ArrayList<String> presetPaths = new java.util.ArrayList<>();

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    configStore = new ConfigStore(this);
    JSONObject config = configStore.load();

    int pad = dp(20);
    int gap = dp(10);

    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(pad, pad, pad, pad);
    card.setBackground(gradient(0xFF111827, 0xFF0B1220));

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
    linkInput.addTextChangedListener(new TextWatcher() {
      @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
      @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
      @Override public void afterTextChanged(Editable s) {
        markActivePreset();
      }
    });

    LinearLayout presets = new LinearLayout(this);
    presets.setOrientation(LinearLayout.VERTICAL);
    presets.setPadding(0, dp(8), 0, dp(4));

    LinearLayout row = null;
    for (int i = 0; i < PRESETS.length; i++) {
      if (i % 2 == 0) {
        row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        presets.addView(row, fieldLp());
      }
      Button chip = presetButton(PRESETS[i][0], PRESETS[i][1]);
      presetButtons.add(chip);
      presetPaths.add(PRESETS[i][1]);
      LinearLayout.LayoutParams chipLp = new LinearLayout.LayoutParams(
          0,
          ViewGroup.LayoutParams.WRAP_CONTENT,
          1
      );
      chipLp.rightMargin = (i % 2 == 0) ? dp(8) : 0;
      chipLp.bottomMargin = dp(8);
      row.addView(chip, chipLp);
    }

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
    hint.setText("Tap a shortcut to fill the link, or type any URL.");
    hint.setTextColor(0xFF94A3B8);
    hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
    hint.setPadding(0, dp(10), 0, dp(14));

    LinearLayout buttons = new LinearLayout(this);
    buttons.setOrientation(LinearLayout.HORIZONTAL);
    buttons.setGravity(Gravity.CENTER_VERTICAL);

    Button exit = actionButton("Exit", 0xFFDC2626);
    exit.setOnClickListener(v -> {
      setResult(RESULT_EXIT);
      finish();
    });

    LinearLayout rightButtons = new LinearLayout(this);
    rightButtons.setOrientation(LinearLayout.HORIZONTAL);
    rightButtons.setGravity(Gravity.END);

    Button cancel = actionButton("Cancel", 0xFF1E293B);
    cancel.setOnClickListener(v -> finish());

    Button save = actionButton("Save", 0xFF16A34A);
    save.setOnClickListener(v -> saveConfig());

    LinearLayout.LayoutParams cancelLp = new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    );
    cancelLp.rightMargin = gap;
    rightButtons.addView(cancel, cancelLp);
    rightButtons.addView(save);

    LinearLayout.LayoutParams exitLp = new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    );
    buttons.addView(exit, exitLp);
    buttons.addView(new android.widget.Space(this), new LinearLayout.LayoutParams(0, 0, 1));
    buttons.addView(rightButtons);

    card.addView(header);
    card.addView(linkLabel);
    card.addView(linkInput, fieldLp());
    card.addView(presets);
    card.addView(reloadLabel);
    card.addView(reloadHoursInput, fieldLp());
    card.addView(hint);
    card.addView(buttons);

    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(false);
    scroll.addView(card, new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    ));

    FrameLayout overlay = new FrameLayout(this);
    overlay.setBackgroundColor(0xCC020617);
    overlay.setOnClickListener(v -> finish());

    int maxWidth = dp(720);
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int cardWidth = Math.min(maxWidth, screenWidth - dp(48));
    FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
        cardWidth,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER
    );
    scroll.setOnClickListener(v -> { /* keep panel open */ });
    overlay.addView(scroll, cardLp);

    setContentView(overlay);
    markActivePreset();
  }

  private Button presetButton(String label, String path) {
    Button button = new Button(this);
    button.setText(label);
    button.setAllCaps(false);
    button.setTextColor(Color.WHITE);
    button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
    button.setBackground(rounded(0xFF1E293B, dp(999)));
    button.setPadding(dp(8), dp(8), dp(8), dp(8));
    button.setOnClickListener(v -> {
      linkInput.setText(originFromLink() + path);
      markActivePreset();
    });
    return button;
  }

  private void markActivePreset() {
    String current = linkInput.getText().toString().trim().toLowerCase();
    for (int i = 0; i < presetButtons.size(); i++) {
      boolean active = current.contains(presetPaths.get(i).toLowerCase());
      applyPresetStyle(presetButtons.get(i), active);
    }
  }

  private void applyPresetStyle(Button button, boolean active) {
    if (active) {
      GradientDrawable bg = rounded(0xFF166534, dp(999));
      bg.setStroke(dp(1), 0xFF22C55E);
      button.setBackground(bg);
    } else {
      GradientDrawable bg = rounded(0xFF1E293B, dp(999));
      bg.setStroke(dp(1), 0xFF334155);
      button.setBackground(bg);
    }
  }

  private String originFromLink() {
    try {
      Uri uri = Uri.parse(linkInput.getText().toString().trim());
      String scheme = uri.getScheme();
      String host = uri.getHost();
      int port = uri.getPort();
      if (scheme == null || host == null) return DEFAULT_ORIGIN;
      if (port > 0) return scheme + "://" + host + ":" + port;
      return scheme + "://" + host;
    } catch (Exception e) {
      return DEFAULT_ORIGIN;
    }
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
