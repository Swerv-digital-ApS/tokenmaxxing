package dk.hanskristoffer.tokenmaxxing.companion;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.WindowInsets;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;

import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;

/** A game companion with no JS/native bridge, filesystem access, desktop helper or device token. */
public class MainActivity extends ComponentActivity {
    private WebView web;
    private TextView status;
    private boolean failed;
    private final OnBackPressedCallback back = new OnBackPressedCallback(false) {
        @Override public void handleOnBackPressed() { web.goBack(); }
    };

    @Override
    @SuppressLint("SetJavaScriptEnabled") // The existing game needs JavaScript; no native bridge is exposed.
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(27, 31, 42));
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this);
        title.setText(R.string.app_name);
        title.setTextColor(Color.WHITE);
        title.setTextSize(17);
        title.setPadding(dp(12), 0, 0, 0);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(52), 1));
        toolbar.addView(button(R.string.scan, v -> scan()));
        toolbar.addView(button(R.string.paste, v -> paste()));
        Button more = new Button(this);
        more.setText("⋮");
        more.setTextSize(22);
        more.setMinWidth(0);
        more.setContentDescription(getString(R.string.more));
        more.setOnClickListener(this::menu);
        toolbar.addView(more, new LinearLayout.LayoutParams(dp(44), dp(52)));
        root.addView(toolbar);
        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setPadding(dp(12), dp(8), dp(12), dp(8));
        status.setVisibility(View.GONE);
        root.addView(status);
        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (PairingLink.isTrusted(BuildConfig.SERVER_URL, url)) return false;
                // An off-origin navigation never gets the app's session or a native bridge.
                if (request.isForMainFrame() && request.hasGesture()) external(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                failed = false;
                status.setText(R.string.connecting);
                status.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!failed) status.setVisibility(View.GONE);
                back.setEnabled(web.canGoBack());
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    failed = true;
                    status.setText(R.string.network_error);
                    status.setVisibility(View.VISIBLE);
                }
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);
        getOnBackPressedDispatcher().addCallback(this, back);
        root.requestApplyInsets();
        web.loadUrl(PairingLink.gameUrl(BuildConfig.SERVER_URL));
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private Button button(int label, View.OnClickListener click) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setMinWidth(0);
        button.setPadding(dp(10), 0, dp(10), 0);
        button.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(52)));
        button.setOnClickListener(click);
        return button;
    }

    private void scan() {
        GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE).enableAutoZoom().build();
        GmsBarcodeScanning.getClient(this, options).startScan()
                .addOnSuccessListener(this, barcode -> pair(barcode.getRawValue()))
                .addOnFailureListener(this, error -> Toast.makeText(this, R.string.scan_error, Toast.LENGTH_LONG).show());
    }

    private void paste() {
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(24), dp(8), dp(24), dp(8));
        TextView instructions = new TextView(this);
        instructions.setText(R.string.paste_message);
        body.addView(instructions);
        EditText input = new EditText(this);
        input.setHint(R.string.code_hint);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        input.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        body.addView(input);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(R.string.paste_title).setView(body)
                .setNegativeButton(android.R.string.cancel, null).setPositiveButton(R.string.sign_in, null).create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            if (pair(input.getText().toString())) {
                ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(), 0);
                dialog.dismiss();
            } else input.setError(getString(R.string.invalid_code));
        }));
        dialog.show();
    }

    private boolean pair(String value) {
        try {
            String url = PairingLink.parse(BuildConfig.SERVER_URL, value);
            // The existing web client consumes the code once, stores its 30-day session in this
            // app's private WebView storage and immediately removes the code from URL/history.
            // A fresh query forces a document navigation even if /play is already open;
            // changing only the hash would leave the login code unconsumed.
            web.loadUrl(Uri.parse(url).buildUpon()
                    .appendQueryParameter("pair", java.util.UUID.randomUUID().toString()).build().toString());
            return true;
        } catch (IllegalArgumentException e) {
            Toast.makeText(this, R.string.invalid_code, Toast.LENGTH_LONG).show();
            return false;
        }
    }

    private void menu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add(0, 1, 0, R.string.reload);
        menu.getMenu().add(0, 2, 1, R.string.sign_out);
        menu.getMenu().add(0, 3, 2, R.string.about);
        menu.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == 1) web.loadUrl(PairingLink.gameUrl(BuildConfig.SERVER_URL));
            if (item.getItemId() == 2) new AlertDialog.Builder(this).setTitle(R.string.sign_out)
                    .setMessage(R.string.sign_out_message).setNegativeButton(android.R.string.cancel, null)
                    .setPositiveButton(R.string.sign_out, (d, which) -> signOut()).show();
            if (item.getItemId() == 3) new AlertDialog.Builder(this).setTitle(R.string.app_name)
                    .setMessage(R.string.about_message).setPositiveButton(android.R.string.ok, null).show();
            return true;
        });
        menu.show();
    }

    private void signOut() {
        if (!PairingLink.isTrusted(BuildConfig.SERVER_URL, web.getUrl())) return;
        web.evaluateJavascript("localStorage.removeItem('tokenmaxxing.session'); sessionStorage.clear();", ignored -> {
            CookieManager.getInstance().removeAllCookies(done -> {
                CookieManager.getInstance().flush();
                web.clearCache(true);
                web.clearHistory();
                web.loadUrl(PairingLink.gameUrl(BuildConfig.SERVER_URL));
            });
        });
    }

    private void external(Uri uri) {
        if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException ignored) { /* A device without a browser keeps the game open. */ }
    }

    // onPause() alone leaves the page's timers and Web Audio running, so the music would play on after Home.
    @Override protected void onPause() { web.onPause(); web.pauseTimers(); super.onPause(); }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.resumeTimers(); web.onResume(); }
    }
    @Override protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
