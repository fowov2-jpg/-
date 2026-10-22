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
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
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
        activity.getScenario().onActivity(a -> {
            View decor = a.getWindow().getDecorView();
            Insets bars = WindowInsetsCompat.toWindowInsetsCompat(decor.getRootWindowInsets(), decor)
                    .getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            View web = decor.findViewWithTag("game-webview");
            int[] position = new int[2], root = new int[2];
            web.getLocationOnScreen(position);decor.getLocationOnScreen(root);
            assertTrue("HTML is behind status bar", position[1] - root[1] >= bars.top);
            assertTrue("HTML is behind navigation bar", position[1] - root[1] + web.getHeight() <= decor.getHeight() - bars.bottom);
            assertTrue("Status inset was not exercised", bars.top > 0);
            assertTrue("Navigation inset was not exercised", bars.bottom > 0);
        });
        String value = evaluate("JSON.stringify((()=>{const nav=document.querySelector('#nav').getBoundingClientRect(),head=document.querySelector('#header').getBoundingClientRect(),money=document.querySelector('.headerBudget').getBoundingClientRect(),clock=document.querySelector('.headerClock').getBoundingClientRect();return {navBottom:nav.bottom,viewport:innerHeight,headTop:head.top,separate:money.right<=clock.left+1,buttons:[...document.querySelectorAll('#nav button')].length};})())");
        JSONObject layout = new JSONObject(new org.json.JSONTokener(value).nextValue().toString());
        assertEquals(5, layout.getInt("buttons"));
        assertTrue("Bottom controls leave HTML viewport", layout.getDouble("navBottom") <= layout.getDouble("viewport") + 1);
        assertTrue("Header leaves HTML viewport", layout.getDouble("headTop") >= 0);
        assertTrue("Money overlaps clock", layout.getBoolean("separate"));
        AtomicReference<File> output = new AtomicReference<>();
        activity.getScenario().onActivity(a -> output.set(new File(a.getExternalFilesDir(null), "verification")));
        File dir = output.get();assertTrue(dir.isDirectory() || dir.mkdirs());
        Bitmap shot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(shot);
        try (FileOutputStream out = new FileOutputStream(new File(dir, mode + ".png"))) { shot.compress(Bitmap.CompressFormat.PNG,100,out); }
        Bitmap preview = Bitmap.createScaledBitmap(shot, 412, Math.round(shot.getHeight() * 412f / shot.getWidth()), true);
        try (FileOutputStream out = new FileOutputStream(new File(dir, mode + ".jpg"))) { preview.compress(Bitmap.CompressFormat.JPEG,78,out); }
        preview.recycle();shot.recycle();
    }
    @Test public void systemPanelsNeverCoverGameControls() throws Exception {
        verify("threebutton");
        verify("gestural");
    }
}
