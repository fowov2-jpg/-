package ru.uyut.upravdom;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
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
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebMessageCompat;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** Offline host. Local assets only; document transfers require the system picker. */
public class MainActivity extends Activity {
    private static final int IMPORT_FILE = 100;
    private static final int EXPORT_FILE = 101;
    private static final int MAX_DOCUMENT_BYTES = 8_000_000;
    private static final String ORIGIN = "https://appassets.androidplatform.net/";
    private WebView web;
    private OnBackInvokedCallback backCallback;
    private File pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) {
            String name=state.getString("pendingExportFile");
            if(name!=null && name.matches("upravdom-export-[A-Za-z0-9_-]+\\.json")) {
                File snapshot=new File(getCacheDir(),name);
                if(snapshot.isFile() && snapshot.length()<=MAX_DOCUMENT_BYTES)pendingExport=snapshot;
            }
        }
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
        web.getSettings().setUserAgentString(web.getSettings().getUserAgentString() + " UpravdomAndroid/0.8.3");
        // A large company must not travel inside a navigation URL. The message
        // object is available only to our HTTPS asset origin and its main frame.
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web,"UpravdomFiles",
                    java.util.Collections.singleton("https://appassets.androidplatform.net"),
                    (view,message,sourceOrigin,isMainFrame,reply)-> {
                        if(isMainFrame && "https".equals(sourceOrigin.getScheme())
                                && "appassets.androidplatform.net".equals(sourceOrigin.getHost())
                                && message.getType()==WebMessageCompat.TYPE_STRING)requestExport(message.getData());
                    });
        }
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
                    requestExport(url.getQueryParameter("data"));
                    return true;
                }
                return !"https".equals(url.getScheme()) || !"appassets.androidplatform.net".equals(url.getHost())
                        || !url.getPath().startsWith("/assets/");
            }
        });
        web.loadUrl(ORIGIN + "assets/index.html");
        // Android 16 no longer dispatches predictive Back to onBackPressed.
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
    }
    private void requestExport(String content) {
        if(pendingExport!=null)return;
        if(content==null || content.length()>MAX_DOCUMENT_BYTES){exportResult(false);return;}
        byte[] bytes=content.getBytes(StandardCharsets.UTF_8);
        if(bytes.length>MAX_DOCUMENT_BYTES){exportResult(false);return;}
        try {
            pendingExport=File.createTempFile("upravdom-export-",".json",getCacheDir());
            try(OutputStream output=new FileOutputStream(pendingExport)){output.write(bytes);}
            Intent picker=new Intent(Intent.ACTION_CREATE_DOCUMENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);picker.setType("application/json");
            picker.putExtra(Intent.EXTRA_TITLE,"upravdom-company.json");
            startActivityForResult(picker,EXPORT_FILE);
        } catch(java.io.IOException | android.content.ActivityNotFoundException | SecurityException e) {
            if(pendingExport!=null)pendingExport.delete();pendingExport=null;exportResult(false);
        }
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
                            if (bytes.size() + count > MAX_DOCUMENT_BYTES) throw new java.io.IOException("Document too large");
                            bytes.write(buffer, 0, count);
                        }
                        raw = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
                    } catch (java.io.IOException | SecurityException e) { /* Preserve current company. */ }
                    final String content = raw;
                    runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) importResult(content); });
                }, "company-import").start();
            }
        } else if (request == EXPORT_FILE) {
            final File snapshot=pendingExport;pendingExport=null;
            if(result==RESULT_OK && data!=null && data.getData()!=null && snapshot!=null) {
                final Uri destination=data.getData();
                new Thread(()->{
                    boolean success=false;
                    try(InputStream input=new FileInputStream(snapshot);
                            OutputStream output=getContentResolver().openOutputStream(destination)) {
                        if(output==null)throw new java.io.IOException("Document unavailable");
                        byte[] buffer=new byte[8192];int count;
                        while((count=input.read(buffer))!=-1)output.write(buffer,0,count);
                        success=true;
                    }catch(java.io.IOException | SecurityException e){success=false;}
                    finally{snapshot.delete();}
                    final boolean written=success;
                    runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())exportResult(written);});
                },"company-export").start();
            } else if(snapshot!=null)snapshot.delete();
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
        if (pendingExport != null) out.putString("pendingExportFile", pendingExport.getName());
    }
    @Override protected void onPause() {
        web.evaluateJavascript("window.dispatchEvent(new Event('upravdom-pause'));window.dispatchEvent(new Event('pagehide'));", null);
        web.onPause();
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override public void onBackPressed() { handleBack(); }
    private void handleBack() {
        if (web == null || isFinishing() || isDestroyed()) return;
        web.evaluateJavascript("(function(){var d=document.querySelector('dialog');if(d&&d.open){d.dispatchEvent(new Event('cancel'));d.close();return true;}return false;})()", result -> {
            if (!"true".equals(result)) moveTaskToBack(true);
        });
    }
    @Override protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        }
        if (web != null) {
            if (web.getParent() instanceof ViewGroup) ((ViewGroup) web.getParent()).removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }
}
