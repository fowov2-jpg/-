package ru.uyut.upravdom;

import static org.junit.Assert.*;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.provider.MediaStore;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ScreenInsetsTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);

    private String evaluate(String script) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);
        activity.getScenario().onActivity(a -> {
            WebView web = a.findViewById(android.R.id.content).findViewWithTag("game-webview");
            web.evaluateJavascript(script, value -> { result.set(value); latch.countDown(); });
        });
        assertTrue("WebView did not respond", latch.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void waitForPage() throws Exception {
        for (int n = 0; n < 100; n++) {
            if ("true".equals(evaluate("!!document.querySelector('#nav button') && document.querySelector('#map').dataset.renderer==='illustrated'"))) return;
            SystemClock.sleep(100);
        }
        fail("Game UI did not load");
    }
    private void verify(String mode) throws Exception {
        // Test both native navigation modes on the same target-SDK-35 window.
        android.os.ParcelFileDescriptor command = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .executeShellCommand("cmd overlay enable-exclusive --category com.android.internal.systemui.navbar." + mode);
        command.close();
        SystemClock.sleep(1800);
        waitForPage();
        AtomicInteger nativeHeight = new AtomicInteger();
        activity.getScenario().onActivity(a -> {
            View decor = a.getWindow().getDecorView();
            assertTrue("Game is covered by a system window or ANR dialog", decor.hasWindowFocus());
            Insets bars = WindowInsetsCompat.toWindowInsetsCompat(decor.getRootWindowInsets(), decor)
                    .getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            View web = decor.findViewWithTag("game-webview");
            int[] position = new int[2], root = new int[2];
            web.getLocationOnScreen(position);decor.getLocationOnScreen(root);
            nativeHeight.set(web.getHeight());
            assertTrue("HTML is behind status bar", position[1] - root[1] >= bars.top);
            assertTrue("HTML is behind navigation bar", position[1] - root[1] + web.getHeight() <= decor.getHeight() - bars.bottom);
            assertTrue("Status inset was not exercised", bars.top > 0);
            assertTrue("Navigation inset was not exercised", bars.bottom > 0);
        });
        String value = evaluate("JSON.stringify((()=>{const nav=document.querySelector('#nav').getBoundingClientRect(),head=document.querySelector('#header').getBoundingClientRect(),money=document.querySelector('.headerBudget').getBoundingClientRect(),clock=document.querySelector('.headerClock').getBoundingClientRect();return {navBottom:nav.bottom,ratio:devicePixelRatio,viewport:innerHeight,captionBottom:Math.max(...[...document.querySelectorAll('#nav button>span:last-child')].map(n=>n.getBoundingClientRect().bottom)),headTop:head.top,separate:money.right<=clock.left+1,buttons:[...document.querySelectorAll('#nav button')].length};})())");
        JSONObject layout = new JSONObject(new org.json.JSONTokener(value).nextValue().toString());
        assertEquals(5, layout.getInt("buttons"));
        assertTrue("Bottom controls leave HTML viewport", layout.getDouble("navBottom") <= layout.getDouble("viewport") + 1);
        assertTrue("Navigation extends past the native WebView surface", layout.getDouble("navBottom") * layout.getDouble("ratio") <= nativeHeight.get() + 2);
        assertTrue("Navigation captions are clipped by the native surface", layout.getDouble("captionBottom") * layout.getDouble("ratio") <= nativeHeight.get() + 2);
        assertTrue("Header leaves HTML viewport", layout.getDouble("headTop") >= 0);
        assertTrue("Money overlaps clock", layout.getBoolean("separate"));
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        SystemClock.sleep(800);
        activity.getScenario().onActivity(a -> assertTrue("System dialog appeared before capture", a.getWindow().getDecorView().hasWindowFocus()));
        Bitmap shot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(shot);
        saveShared(shot, mode + ".png", Bitmap.CompressFormat.PNG, 100);
        Bitmap preview = Bitmap.createScaledBitmap(shot, 412, Math.round(shot.getHeight() * 412f / shot.getWidth()), true);
        saveShared(preview, mode + ".jpg", Bitmap.CompressFormat.JPEG, 78);
        preview.recycle();shot.recycle();
    }
    // Shared MediaStore images survive the test runner uninstalling the target APK.
    private void saveShared(Bitmap image, String name, Bitmap.CompressFormat format, int quality) throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
        values.put(MediaStore.Images.Media.MIME_TYPE, name.endsWith(".png") ? "image/png" : "image/jpeg");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/UpravdomVerification");
        Uri destination = context.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        assertNotNull(destination);
        try (OutputStream output = context.getContentResolver().openOutputStream(destination)) {
            assertNotNull(output);assertTrue(image.compress(format, quality, output));
        }
    }
    @Test public void systemPanelsNeverCoverGameControls() throws Exception {
        verify("threebutton");
        verify("gestural");
    }
}
