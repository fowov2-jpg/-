package ru.uyut.upravdom;

import static org.junit.Assert.*;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.View;
import android.view.MotionEvent;
import android.accessibilityservice.AccessibilityService;
import androidx.lifecycle.Lifecycle;
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
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ScreenInsetsTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);

    private String shellText(String command) throws Exception {
        android.os.ParcelFileDescriptor descriptor=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
        try(java.io.InputStream input=new android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor);
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream()) {
            byte[] buffer=new byte[8192];int count;
            while((count=input.read(buffer))!=-1)bytes.write(buffer,0,count);
            return bytes.toString("UTF-8");
        }
    }
    // API 36's emulator Launcher3 can ANR while tests switch navigation modes.
    // Close ONLY that system fixture. An ANR belonging to the game must still fail.
    private void dismissLauncherAnr() throws Exception {
        if(shellText("dumpsys window windows").contains("Application Not Responding: com.android.launcher3")) {
            shellText("am force-stop com.android.launcher3");SystemClock.sleep(1000);
        }
    }
    @Before public void prepareFocusedDevice() throws Exception { dismissLauncherAnr(); }
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
            // Existing regression suite intentionally exercises the preserved 0.3 company.
            evaluate("if(document.querySelector('.campaignMenu')) location.href='?legacy=1'");
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
        dismissLauncherAnr();
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
    private void tap(String selector) throws Exception {
        dismissLauncherAnr();
        String quoted = JSONObject.quote(selector);
        boolean targetReady=false;
        for(int wait=0;wait<100;wait++) {
            if("true".equals(evaluate("(()=>{const n=document.querySelector("+quoted+");return !!n && n.getClientRects().length>0 && !n.disabled && !n.closest('dialog:not([open])');})()"))){targetReady=true;break;}
            SystemClock.sleep(100);
        }
        assertTrue("Tap target did not become available: "+selector,targetReady);
        String value = evaluate("JSON.stringify((()=>{const n=document.querySelector("+quoted+");n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:(r.left+r.width/2)*devicePixelRatio,y:(r.top+r.height/2)*devicePixelRatio};})())");
        JSONObject point = new JSONObject(new org.json.JSONTokener(value).nextValue().toString());
        int[] offset = new int[2];
        activity.getScenario().onActivity(a -> a.getWindow().getDecorView().findViewWithTag("game-webview").getLocationOnScreen(offset));
        float x=offset[0]+(float)point.getDouble("x"), y=offset[1]+(float)point.getDouble("y");long now=SystemClock.uptimeMillis();
        MotionEvent down=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0),up=MotionEvent.obtain(now,now+40,MotionEvent.ACTION_UP,x,y,0);
        InstrumentationRegistry.getInstrumentation().sendPointerSync(down);InstrumentationRegistry.getInstrumentation().sendPointerSync(up);down.recycle();up.recycle();SystemClock.sleep(160);
    }
    private void startNewCampaign() throws Exception {
        tap("[data-cmd=new]");
        for(int wait=0;wait<100;wait++) {
            if("true".equals(evaluate("!!document.querySelector('dialog[open] [data-cmd=confirmNew]')"))){tap("dialog [data-cmd=confirmNew]");return;}
            if("true".equals(evaluate("!!document.querySelector('[data-cmd=regionProceed]')")))return;
            SystemClock.sleep(100);
        }
        fail("New company neither opened confirmation nor district selection");
    }
    @Test public void allSectionsLifecycleAndDocumentPickers() throws Exception {
        waitForPage();tap("#mapBottom [data-action=settings]");tap("dialog [data-action=reset]");tap("dialog [data-action=confirmReset]");
        for(String section:new String[]{"calls","services","garage","finance"}){
            tap("#nav [data-tab="+section+"]");
            String[] pages=section.equals("services")?new String[]{"crews","people","hire"}:section.equals("garage")?new String[]{"fleet","stock","buy"}:section.equals("finance")?new String[]{"overview","contracts","goals"}:new String[]{};
            for(String page:pages){tap("#page .segmented [data-sub="+page+"]");assertEquals("true",evaluate("!!document.querySelector('#page h1') && document.documentElement.scrollWidth<=innerWidth"));}
        }
        tap("#nav [data-tab=map]");tap("[data-action=start]");SystemClock.sleep(1300);
        activity.getScenario().moveToState(Lifecycle.State.CREATED);SystemClock.sleep(1000);activity.getScenario().moveToState(Lifecycle.State.RESUMED);SystemClock.sleep(400);
        String saved=evaluate("JSON.parse(localStorage.getItem('upravdom.v1')).minute");SystemClock.sleep(1200);assertEquals("Background resumed simulation",saved,evaluate("JSON.parse(localStorage.getItem('upravdom.v1')).minute"));
        tap("#mapBottom [data-action=settings]");
        for(String action:new String[]{"export","import"}){
            // Android Back may dismiss both DocumentsUI and the underlying HTML
            // settings dialog; reopen settings before testing the next picker.
            if (!"true".equals(evaluate("!!document.querySelector('dialog[open] [data-action="+action+"]')"))) {
                tap("#mapBottom [data-action=settings]");
            }
            assertEquals("Settings dialog closed before "+action,"true",
                    evaluate("!!document.querySelector('dialog[open] [data-action="+action+"]')"));
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            tap("dialog [data-action="+action+"]");SystemClock.sleep(700);
            String foreground="no accessibility window";boolean picker=false;
            for(int wait=0;wait<40;wait++){
                android.view.accessibility.AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
                if(root!=null){foreground=String.valueOf(root.getPackageName());picker=foreground.contains("documentsui");root.recycle();if(picker)break;}
                SystemClock.sleep(250);
            }
            assertTrue("System document picker did not open for "+action+"; foreground="+foreground,picker);
            for(int back=0;back<3;back++){
                InstrumentationRegistry.getInstrumentation().getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK);SystemClock.sleep(650);
                AtomicReference<Boolean> focused=new AtomicReference<>(false);activity.getScenario().onActivity(a->focused.set(a.getWindow().getDecorView().hasWindowFocus()));if(focused.get())break;
            }
            assertEquals("Picker cancellation changed progress",saved,evaluate("JSON.parse(localStorage.getItem('upravdom.v1')).minute"));
        }
        // Predictive Back may have already closed the underlying settings sheet.
        if("true".equals(evaluate("!!document.querySelector('dialog[open] [data-action=close]')"))) tap("dialog [data-action=close]");
        // Exercise the same URI result that DocumentsUI returns, including native file reading.
        String raw = new org.json.JSONTokener(evaluate("localStorage.getItem('upravdom.v1')")).nextValue().toString();
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        ContentValues values=new ContentValues();values.put(MediaStore.Downloads.DISPLAY_NAME,"upravdom-verification.json");values.put(MediaStore.Downloads.MIME_TYPE,"application/json");values.put(MediaStore.Downloads.RELATIVE_PATH,"Download");
        Uri document=context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);assertNotNull(document);
        try {
            try(OutputStream output=context.getContentResolver().openOutputStream(document)){assertNotNull(output);output.write(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
            activity.getScenario().onActivity(a->a.onActivityResult(100,android.app.Activity.RESULT_OK,new android.content.Intent().setData(document)));
            boolean confirmation=false;
            for(int wait=0;wait<50;wait++){if("true".equals(evaluate("!!document.querySelector('dialog[open] [data-action=confirmImport]')"))){confirmation=true;break;}SystemClock.sleep(100);}
            assertTrue("Native file contents did not reach import confirmation",confirmation);tap("dialog [data-action=confirmImport]");
            assertEquals("Native import changed saved simulation time",saved,evaluate("JSON.parse(localStorage.getItem('upravdom.v1')).minute"));
        }finally{context.getContentResolver().delete(document,null,null);}
    }
    @Test public void systemPanelsNeverCoverGameControls() throws Exception {
        verify("threebutton");
        verify("gestural");
    }
    @Test public void campaignMenuPreparationMapAndLifecycle() throws Exception {
        boolean ready=false;
        for(int wait=0;wait<100;wait++){
            if("true".equals(evaluate("!!document.querySelector('.campaignMenu')"))){ready=true;break;}
            SystemClock.sleep(100);
        }
        assertTrue("Campaign menu did not load",ready);
        assertEquals("3",evaluate("document.querySelectorAll('.campaignMenu button').length"));
        startNewCampaign();
        assertEquals("20",evaluate("document.querySelectorAll('.districtZone').length"));
        tap("[data-cmd=regionProceed]");
        assertEquals("3",evaluate("document.querySelectorAll('.dispatchCrew').length"));
        tap("[data-cmd=start]");
        ready=false;
        for(int wait=0;wait<100;wait++){
            if("true".equals(evaluate("document.querySelector('#campaignMap')?.dataset.renderer==='ready'"))){ready=true;break;}
            SystemClock.sleep(100);
        }
        assertTrue("Campaign map art did not load",ready);
        assertEquals("true",evaluate("document.querySelector('.campaignBottom').getBoundingClientRect().bottom<=innerHeight+1"));
        assertEquals("999",evaluate("Number(document.querySelector('#campaignMap').dataset.positions)"));
        // The emulator keeps real game time running during UI/asset checks.
        // More calls may arrive; validate the real queue instead of assuming zero elapsed time.
        assertEquals("true",evaluate("(()=>{const s=JSON.parse(localStorage.getItem('upravdom.campaign.v4'));return s.phase==='active'&&s.cursor>=3&&s.cursor<=6&&s.calls.length===s.cursor&&new Set(s.calls.map(c=>c.mission)).size===s.cursor;})()"));
        assertEquals("true",evaluate("Number(document.querySelector('#campaignMap').dataset.trafficCount)>0"));
        String traffic=evaluate("document.querySelector('#campaignMap').dataset.traffic");SystemClock.sleep(1300);
        assertNotEquals("Traffic did not animate",traffic,evaluate("document.querySelector('#campaignMap').dataset.traffic"));
        tap("[data-cmd=pause]");traffic=evaluate("document.querySelector('#campaignMap').dataset.traffic");SystemClock.sleep(1300);
        assertEquals("Traffic moved while paused",traffic,evaluate("document.querySelector('#campaignMap').dataset.traffic"));
        activity.getScenario().moveToState(Lifecycle.State.CREATED);SystemClock.sleep(500);
        activity.getScenario().moveToState(Lifecycle.State.RESUMED);SystemClock.sleep(300);
        String minute=evaluate("JSON.parse(localStorage.getItem('upravdom.campaign.v4')).minute");
        SystemClock.sleep(1300);
        assertEquals("Campaign resumed behind lifecycle pause",minute,evaluate("JSON.parse(localStorage.getItem('upravdom.campaign.v4')).minute"));
    }
    @Test public void campaignTrainingFinanceAndNativeReportImport() throws Exception {
        boolean ready=false;
        for(int wait=0;wait<100;wait++){
            if("true".equals(evaluate("!!document.querySelector('.campaignMenu')"))){ready=true;break;}
            SystemClock.sleep(100);
        }
        assertTrue("Campaign menu did not load",ready);
        startNewCampaign();
        tap("[data-cmd=regionProceed]");tap("[data-cmd=sub][data-sub=people]");
        tap("[data-cmd=train][data-id='0']");
        assertEquals("3",evaluate("JSON.parse(localStorage.getItem('upravdom.campaign.v4')).employees[0].level"));
        assertEquals("2976000",evaluate("JSON.parse(localStorage.getItem('upravdom.campaign.v4')).money"));
        tap("[data-cmd=map]");tap("[data-cmd=finance]");
        assertEquals("true",evaluate("document.querySelector('.transactionList').textContent.includes('Обучение')"));
        evaluate("import(new URL('./campaign-engine.js',location.href).href).then(E=>{const s=E.fresh(112);E.start(s);E.tick(s,480);window.nativeReportFixture=E.encode(s);})");
        for(int wait=0;wait<50;wait++){if("true".equals(evaluate("typeof window.nativeReportFixture==='string'")))break;SystemClock.sleep(100);}
        assertEquals("Native report fixture did not finish", "true", evaluate("typeof window.nativeReportFixture==='string'"));
        String raw=new org.json.JSONTokener(evaluate("window.nativeReportFixture")).nextValue().toString();
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        ContentValues values=new ContentValues();values.put(MediaStore.Downloads.DISPLAY_NAME,"upravdom-campaign-report.json");values.put(MediaStore.Downloads.MIME_TYPE,"application/json");values.put(MediaStore.Downloads.RELATIVE_PATH,"Download");
        Uri document=context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);assertNotNull(document);
        try {
            try(OutputStream output=context.getContentResolver().openOutputStream(document)){assertNotNull(output);output.write(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
            activity.getScenario().onActivity(a->a.onActivityResult(100,android.app.Activity.RESULT_OK,new android.content.Intent().setData(document)));
            boolean imported=false;
            for(int wait=0;wait<70;wait++){if("true".equals(evaluate("!!document.querySelector('dialog[open] [data-cmd=nextDay]')"))){imported=true;break;}SystemClock.sleep(100);}
            assertTrue("Native report import did not open results: "+evaluate("document.querySelector('#toast').textContent"),imported);
            assertEquals("4",evaluate("document.querySelectorAll('.reportStats>div').length"));
            tap("dialog [data-cmd=nextDay]");
            assertEquals("2",evaluate("JSON.parse(localStorage.getItem('upravdom.campaign.v4')).day"));
            assertEquals("true",evaluate("!!document.querySelector('.campaignTabs')"));
        } finally {context.getContentResolver().delete(document,null,null);}
    }

}
