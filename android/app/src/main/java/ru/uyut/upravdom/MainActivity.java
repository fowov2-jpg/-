package ru.uyut.upravdom;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.FrameLayout;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** Offline host. Local assets only; document transfers require the system picker. */
public class MainActivity extends Activity {
    private static final int IMPORT_FILE = 100;
    private static final int EXPORT_FILE = 101;
    private static final String ORIGIN = "https://appassets.androidplatform.net/";
    private WebView web;
    private String pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) pendingExport = state.getString("pendingExport");
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(false);
        bars.setAppearanceLightNavigationBars(false);
        FrameLayout host = new FrameLayout(this);
        host.setBackgroundColor(0xff081820);
        web = new WebView(this);
        web.setTag("game-webview");
        web.addOnLayoutChangeListener((v, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
            if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) syncViewport();
        });
        web.setBackgroundColor(0xff081820);
        host.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        // Resize the actual WebView viewport. WebView padding does not protect HTML from edge-to-edge bars.
        ViewCompat.setOnApplyWindowInsetsListener(host, (v, insets) -> {
            Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            FrameLayout.LayoutParams layout = (FrameLayout.LayoutParams) web.getLayoutParams();
            layout.setMargins(safe.left, safe.top, safe.right, safe.bottom);
            web.setLayoutParams(layout);
            return WindowInsetsCompat.CONSUMED;
        });
        setContentView(host);
        ViewCompat.requestApplyInsets(host);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.getSettings().setUserAgentString(web.getSettings().getUserAgentString() + " UpravdomAndroid/0.8.2");
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                syncViewport();
                view.postDelayed(() -> syncViewport(), 120);
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
                return response != null ? response : new WebResourceResponse("text/plain", "UTF-8", 403,
                        "Forbidden", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("upravdom".equals(url.getScheme()) && "import".equals(url.getHost())
                        && request.isForMainFrame() && view.getUrl() != null && view.getUrl().startsWith(ORIGIN)) {
                    Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    picker.setType("*/*");
                    picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain"});
                    try { startActivityForResult(picker, IMPORT_FILE); }
                    catch (android.content.ActivityNotFoundException e) { importResult(null); }
                    return true;
                }
                if ("upravdom".equals(url.getScheme()) && "export".equals(url.getHost())
                        && request.isForMainFrame() && view.getUrl() != null && view.getUrl().startsWith(ORIGIN)) {
                    String content = url.getQueryParameter("data");
                    if (content != null && content.length() <= 2000000 && pendingExport == null) {
                        pendingExport = content;
                        Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        picker.addCategory(Intent.CATEGORY_OPENABLE);
                        picker.setType("application/json");
                        picker.putExtra(Intent.EXTRA_TITLE, "upravdom-company.json");
                        try { startActivityForResult(picker, EXPORT_FILE); }
                        catch (android.content.ActivityNotFoundException e) {
                            pendingExport = null; exportResult(false);
                        }
                    }
                    return true;
                }
                return !"https".equals(url.getScheme()) || !"appassets.androidplatform.net".equals(url.getHost())
                        || !url.getPath().startsWith("/assets/");
            }
        });
        web.loadUrl(ORIGIN + "assets/index.html");
    }
    private void syncViewport() {
        if (web == null || web.getHeight() <= 0) return;
        // Android WebView may retain an old CSS vh after switching system navigation modes.
        // Use the measured native content height so bottom labels cannot be clipped by the actual surface.
        int height = web.getHeight();
        web.evaluateJavascript("(function(){var r=document.documentElement;if(!r)return;"
                + "r.style.setProperty('--native-viewport-height',(" + height
                + "/(window.devicePixelRatio||1))+'px');window.dispatchEvent(new Event('resize'));})()", null);
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == IMPORT_FILE) {
            if (result == RESULT_OK && data != null && data.getData() != null) {
                Uri document = data.getData();
                new Thread(() -> {
                    String raw = null;
                    try (InputStream input = getContentResolver().openInputStream(document);
                            ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                        if (input == null) throw new java.io.IOException("Document unavailable");
                        byte[] buffer = new byte[8192];int count;
                        while ((count = input.read(buffer)) != -1) {
                            if (bytes.size() + count > 2000000) throw new java.io.IOException("Document too large");
                            bytes.write(buffer, 0, count);
                        }
                        raw = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
                    } catch (java.io.IOException | SecurityException e) { /* Preserve current company. */ }
                    final String content = raw;
                    runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) importResult(content); });
                }, "company-import").start();
            }
        } else if (request == EXPORT_FILE) {
            if (result == RESULT_OK && data != null && data.getData() != null && pendingExport != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new java.io.IOException("Document unavailable");
                    output.write(pendingExport.getBytes(StandardCharsets.UTF_8));
                    exportResult(true);
                } catch (java.io.IOException | SecurityException e) { exportResult(false); }
            }
            pendingExport = null;
        }
    }
    private void importResult(String raw) {
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('upravdom-import',{detail:"
                + (raw == null ? "null" : org.json.JSONObject.quote(raw)) + "}));", null);
    }
    private void exportResult(boolean success) {
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('upravdom-export-result',{detail:"
                + success + "}));", null);
    }
    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (pendingExport != null && pendingExport.length() < 100000) out.putString("pendingExport", pendingExport);
    }
    @Override protected void onPause() {
        web.evaluateJavascript("window.dispatchEvent(new Event('upravdom-pause'));window.dispatchEvent(new Event('pagehide'));", null);
        web.onPause();
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){var d=document.querySelector('dialog');if(d&&d.open){d.dispatchEvent(new Event('cancel'));d.close();return true;}return false;})()", result -> {
            if (!"true".equals(result)) moveTaskToBack(true);
        });
    }
    @Override protected void onDestroy() {
        web.destroy(); super.onDestroy();
    }
}
