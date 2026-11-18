package com.fishing.auto;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.HardwareBuffer;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * 자동 낚시 본체.
 * 접근성 서비스 하나로: 화면 보기(스크린샷) + 대신 누르기(제스처) + 떠 있는 창(오버레이)
 */
public class FishingService extends AccessibilityService {

    // ===== 설정 =====
    static final int DEFAULT_COLOR = Color.rgb(234, 77, 77); // 빨간 클릭 바 색
    static final int TOLERANCE = 30;        // R, G, B 각각 이만큼 달라도 같은 색
    static final int CLICK_COUNT = 20;      // 입질 때 누르는 횟수
    static final long CLICK_INTERVAL = 120; // 누르는 간격(ms)
    static final long TAP_TIME = 40;        // 한 번 누를 때 시간(ms)
    static final long CAST_HOLD = 1150;     // 던질 때 꾹 누르는 시간(ms)
    static final long RECAST_DELAY = 3500;  // 성공 후 쉬는 시간(ms)
    static final long BITE_TIMEOUT = 15000; // 이 시간 안에 안 뜨면 다시 던짐(ms)
    static final long SHOT_GAP = 350;       // 화면 보기 최소 간격(안드로이드 제한 0.33초)
    static final int REGION_DP = 14;        // 색 찾을 범위(동그라미 가운데에서 위아래좌우)

    static final String TUTORIAL =
            "📖 사용법\n\n"
            + "1. 로블록스 '알 훔치기'에서 낚싯대를 들어요.\n\n"
            + "2. 화면에 동그라미 2개가 떠요.\n"
            + "   🟡 노란 동그라미 = 빨간색 찾을 곳\n"
            + "      → 직접 한 번 낚시해서 빨간 바를 띄우고,\n"
            + "         노란 동그라미를 빨간 바 위로 끌어다 놓기\n"
            + "   🔵 파란 동그라미 = 누를 곳\n"
            + "      → 낚시할 때 누르는 자리로 끌어다 놓기\n\n"
            + "3. (처음 한 번) 빨간 바가 떠 있을 때 🎨 를 누르면\n"
            + "   그 빨간색을 기억해요. (안 해도 기본 빨간색으로 돼요)\n\n"
            + "4. ▶ 를 누르면 시작!\n"
            + "   던지기(1.15초 꾹) → 빨간색 기다리기\n"
            + "   → 20번 연타 → 3.5초 쉬기 → 반복\n"
            + "   15초 동안 안 뜨면 다시 던져요.\n\n"
            + "5. ⏸ = 멈추기 / ✖ = 창 닫기\n"
            + "   (다시 띄우려면 자동 낚시 앱 → ② 버튼)\n\n"
            + "❗ '○ 색 없음'만 나오면 멈추고\n"
            + "   노란 동그라미를 빨간 바 위로 다시 옮기세요.";

    static FishingService instance;

    private WindowManager wm;
    private final Handler main = new Handler(Looper.getMainLooper());
    private SharedPreferences prefs;

    private View markCheck, markTap, panel;
    private WindowManager.LayoutParams lpCheck, lpTap, lpPanel;
    private TextView tvStatus, tvDetect, tvTutorial;
    private View swatch;
    private Button btnStart;

    private volatile boolean running = false;
    private Thread worker;
    private int targetColor;
    private int checkX, checkY, tapX, tapY;
    private long lastShot = 0;
    private int fish = 0;

    // ================= 서비스 =================
    @Override
    protected void onServiceConnected() {
        instance = this;
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        prefs = getSharedPreferences("fishing", MODE_PRIVATE);
        targetColor = prefs.getInt("color", DEFAULT_COLOR);
        showOverlay();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) { }

    @Override
    public void onInterrupt() { }

    @Override
    public void onDestroy() {
        stopFishing();
        removeOverlay();
        instance = null;
        super.onDestroy();
    }

    // ================= 떠 있는 창 =================
    void showOverlay() {
        main.post(() -> {
            if (panel != null) return;
            DisplayMetrics dm = getResources().getDisplayMetrics();
            int w = Math.max(dm.widthPixels, dm.heightPixels);
            int h = Math.min(dm.widthPixels, dm.heightPixels);
            int size = dp(64);

            markCheck = new Marker(this, Color.rgb(255, 208, 0));
            lpCheck = params(size, size,
                    prefs.getInt("cx", w / 2 - size / 2), prefs.getInt("cy", h * 6 / 10 - size / 2));
            makeDraggable(markCheck, markCheck, lpCheck, "c");

            markTap = new Marker(this, Color.rgb(47, 127, 255));
            lpTap = params(size, size,
                    prefs.getInt("tx", w * 8 / 10 - size / 2), prefs.getInt("ty", h * 7 / 10 - size / 2));
            makeDraggable(markTap, markTap, lpTap, "t");

            lpPanel = params(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                    prefs.getInt("px", dp(8)), prefs.getInt("py", dp(8)));
            buildPanel();

            wm.addView(markCheck, lpCheck);
            wm.addView(markTap, lpTap);
            wm.addView(panel, lpPanel);
            showColor(targetColor, -1);
        });
    }

    private void removeOverlay() {
        for (View v : new View[]{markCheck, markTap, panel}) {
            if (v != null && v.isAttachedToWindow()) {
                try { wm.removeView(v); } catch (Exception ignored) { }
            }
        }
        markCheck = markTap = panel = null;
    }

    private WindowManager.LayoutParams params(int w, int h, int x, int y) {
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(w, h,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        p.gravity = Gravity.TOP | Gravity.LEFT;
        p.x = x;
        p.y = y;
        p.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        return p;
    }

    /** 손가락으로 끌어서 옮기기 */
    private void makeDraggable(View handle, View win, WindowManager.LayoutParams lp, String key) {
        final float[] start = new float[4];
        handle.setOnTouchListener((v, e) -> {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    start[0] = e.getRawX(); start[1] = e.getRawY();
                    start[2] = lp.x; start[3] = lp.y;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    lp.x = (int) (start[2] + e.getRawX() - start[0]);
                    lp.y = (int) (start[3] + e.getRawY() - start[1]);
                    if (win.isAttachedToWindow()) wm.updateViewLayout(win, lp);
                    return true;
                case MotionEvent.ACTION_UP:
                    prefs.edit().putInt(key + "x", lp.x).putInt(key + "y", lp.y).apply();
                    return true;
            }
            return false;
        });
    }

    private void buildPanel() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(8), dp(6), dp(8), dp(8));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(225, 25, 28, 34));
        bg.setCornerRadius(dp(12));
        box.setBackground(bg);

        TextView title = new TextView(this);
        title.setText("🎣 자동 낚시  ✋");
        title.setTextColor(Color.WHITE);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(14);
        box.addView(title);

        tvStatus = small("동그라미를 옮기고 ▶");
        box.addView(tvStatus);

        LinearLayout colorRow = new LinearLayout(this);
        colorRow.setGravity(Gravity.CENTER_VERTICAL);
        swatch = new View(this);
        colorRow.addView(swatch, new LinearLayout.LayoutParams(dp(14), dp(14)));
        tvDetect = small("");
        tvDetect.setPadding(dp(6), 0, 0, 0);
        colorRow.addView(tvDetect);
        box.addView(colorRow);

        LinearLayout row = new LinearLayout(this);
        row.setPadding(0, dp(4), 0, 0);
        btnStart = smallButton("▶", "#3AA060", v -> toggle());
        row.addView(btnStart);
        row.addView(smallButton("🎨", "#555555", v -> pickColor()));
        row.addView(smallButton("📖", "#555555", v ->
                tvTutorial.setVisibility(tvTutorial.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE)));
        row.addView(smallButton("✖", "#884444", v -> { stopFishing(); removeOverlay(); }));
        box.addView(row);

        tvTutorial = small(TUTORIAL);
        tvTutorial.setTextSize(12);
        tvTutorial.setPadding(0, dp(6), 0, 0);
        tvTutorial.setVisibility(View.GONE);
        box.addView(tvTutorial);

        panel = box;
        makeDraggable(title, box, lpPanel, "p");   // 제목(✋)을 끌면 창이 움직임
    }

    private TextView small(String s) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextColor(Color.rgb(220, 220, 220));
        t.setTextSize(12);
        return t;
    }

    private Button smallButton(String s, String color, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextSize(15);
        b.setAllCaps(false);
        b.setTextColor(Color.WHITE);
        b.setMinWidth(0); b.setMinimumWidth(0); b.setMinHeight(0); b.setMinimumHeight(0);
        b.setPadding(0, 0, 0, 0);
        GradientDrawable d = new GradientDrawable();
        d.setColor(Color.parseColor(color));
        d.setCornerRadius(dp(8));
        b.setBackground(d);
        b.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(44), dp(40));
        lp.rightMargin = dp(5);
        b.setLayoutParams(lp);
        return b;
    }

    private void status(String s) { main.post(() -> { if (tvStatus != null) tvStatus.setText(s); }); }

    /** found: 1 = 감지, 0 = 없음, -1 = 표시 안 함 */
    private void showColor(int c, int found) {
        main.post(() -> {
            if (swatch == null) return;
            swatch.setBackgroundColor(c);
            String rgb = "RGB(" + Color.red(c) + "," + Color.green(c) + "," + Color.blue(c) + ")";
            if (found == 1) {
                tvDetect.setText("● 색 감지됨 " + rgb);
                tvDetect.setTextColor(Color.rgb(90, 220, 110));
            } else if (found == 0) {
                tvDetect.setText("○ 색 없음 " + rgb);
                tvDetect.setTextColor(Color.rgb(255, 110, 110));
            } else {
                tvDetect.setText("찾을 색 " + rgb);
                tvDetect.setTextColor(Color.rgb(220, 220, 220));
            }
        });
    }

    private int[] centerOf(View v) {
        int[] loc = new int[2];
        v.getLocationOnScreen(loc);
        return new int[]{loc[0] + v.getWidth() / 2, loc[1] + v.getHeight() / 2};
    }

    // ================= 시작 / 정지 =================
    private void toggle() {
        if (running) {
            stopFishing();
            return;
        }
        int[] c = centerOf(markCheck), t = centerOf(markTap);
        checkX = c[0]; checkY = c[1]; tapX = t[0]; tapY = t[1];
        // 동그라미가 화면에 찍히거나 터치를 막지 않게 잠깐 숨김
        if (markCheck.isAttachedToWindow()) wm.removeView(markCheck);
        if (markTap.isAttachedToWindow()) wm.removeView(markTap);
        running = true;
        btnStart.setText("⏸");
        status("시작!");
        worker = new Thread(this::loop, "fishing");
        worker.start();
    }

    private void stopFishing() {
        running = false;
        if (worker != null) worker.interrupt();
        worker = null;
        main.post(() -> {
            if (btnStart != null) btnStart.setText("▶");
            if (markCheck != null && !markCheck.isAttachedToWindow()) wm.addView(markCheck, lpCheck);
            if (markTap != null && !markTap.isAttachedToWindow()) wm.addView(markTap, lpTap);
            if (tvStatus != null) tvStatus.setText("정지함 (" + fish + "마리)");
        });
    }

    /** 🎨 노란 동그라미 가운데의 색을 '찾을 색'으로 저장 */
    private void pickColor() {
        if (running) return;
        int[] c = centerOf(markCheck);
        status("색 찍는 중...");
        new Thread(() -> {
            Bitmap b = shot();
            if (b == null) { status("화면을 못 봤어요. 다시 🎨"); return; }
            long r = 0, g = 0, bl = 0; int n = 0;
            for (int dx = -2; dx <= 2; dx++) for (int dy = -2; dy <= 2; dy++) {
                int x = c[0] + dx, y = c[1] + dy;
                if (x < 0 || y < 0 || x >= b.getWidth() || y >= b.getHeight()) continue;
                int p = b.getPixel(x, y);
                r += Color.red(p); g += Color.green(p); bl += Color.blue(p); n++;
            }
            b.recycle();
            if (n == 0) { status("동그라미가 화면 밖이에요"); return; }
            targetColor = Color.rgb((int) (r / n), (int) (g / n), (int) (bl / n));
            prefs.edit().putInt("color", targetColor).apply();
            status("색 저장 완료!");
            showColor(targetColor, -1);
        }).start();
    }

    // ================= 낚시 =================
    private void loop() {
        while (running) {
            try {
                fishOnce();
            } catch (InterruptedException e) {
                return;
            } catch (Exception e) {
                status("에러: " + e.getMessage());
                try { Thread.sleep(1000); } catch (InterruptedException ie) { return; }
            }
        }
    }

    private void fishOnce() throws InterruptedException {
        status("던지기 (1.15초 꾹)");
        press(tapX, tapY, CAST_HOLD);
        Thread.sleep(CAST_HOLD + 300);

        long start = SystemClock.uptimeMillis();
        while (running && !colorFound()) {
            if (SystemClock.uptimeMillis() - start > BITE_TIMEOUT) {
                status("15초 동안 안 뜸 → 다시 던짐");
                return;
            }
        }
        if (!running) return;

        status("입질! " + CLICK_COUNT + "번 연타");
        for (int i = 0; i < CLICK_COUNT && running; i++) {
            press(tapX, tapY, TAP_TIME);
            Thread.sleep(CLICK_INTERVAL);
        }

        long end = SystemClock.uptimeMillis();
        while (running && colorFound() && SystemClock.uptimeMillis() - end < 5000) { }

        if (running) {
            fish++;
            status("성공! (" + fish + "마리) 3.5초 쉬기");
            Thread.sleep(RECAST_DELAY);
        }
    }

    /** 노란 동그라미 자리 주변에 찾을 색이 있나? */
    private boolean colorFound() throws InterruptedException {
        long wait = SHOT_GAP - (SystemClock.uptimeMillis() - lastShot);
        if (wait > 0) Thread.sleep(wait);
        Bitmap b = shot();
        if (b == null) return false;
        int r = dp(REGION_DP);
        int x0 = Math.max(0, checkX - r), y0 = Math.max(0, checkY - r);
        int x1 = Math.min(b.getWidth(), checkX + r), y1 = Math.min(b.getHeight(), checkY + r);
        int best = 999, bestColor = Color.BLACK;
        if (x1 > x0 && y1 > y0) {
            int w = x1 - x0, h = y1 - y0;
            int[] px = new int[w * h];
            b.getPixels(px, 0, w, x0, y0, w, h);
            int tr = Color.red(targetColor), tg = Color.green(targetColor), tb = Color.blue(targetColor);
            for (int p : px) {
                int gap = Math.max(Math.abs(Color.red(p) - tr),
                        Math.max(Math.abs(Color.green(p) - tg), Math.abs(Color.blue(p) - tb)));
                if (gap < best) { best = gap; bestColor = p; if (gap == 0) break; }
            }
        }
        b.recycle();
        boolean ok = best <= TOLERANCE;
        showColor(bestColor, ok ? 1 : 0);
        return ok;
    }

    /** 화면 사진 (실패하면 null) */
    private Bitmap shot() {
        final Bitmap[] out = new Bitmap[1];
        final CountDownLatch done = new CountDownLatch(1);
        lastShot = SystemClock.uptimeMillis();
        main.post(() -> takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(),
                new TakeScreenshotCallback() {
                    @Override
                    public void onSuccess(ScreenshotResult result) {
                        HardwareBuffer hb = result.getHardwareBuffer();
                        try {
                            Bitmap hw = Bitmap.wrapHardwareBuffer(hb, result.getColorSpace());
                            if (hw != null) {
                                out[0] = hw.copy(Bitmap.Config.ARGB_8888, false);
                                hw.recycle();
                            }
                        } finally {
                            hb.close();
                            done.countDown();
                        }
                    }

                    @Override
                    public void onFailure(int errorCode) {
                        done.countDown();
                    }
                }));
        try {
            done.await(3, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return out[0];
    }

    /** (x, y)를 ms 동안 누르기 */
    private void press(int x, int y, long ms) {
        Path p = new Path();
        p.moveTo(x, y);
        GestureDescription g = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(p, 0, ms))
                .build();
        main.post(() -> dispatchGesture(g, null, null));
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    /** 가운데가 뚫린 동그라미 (가운데 색을 가리지 않게) */
    static class Marker extends View {
        private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint shadow = new Paint(Paint.ANTI_ALIAS_FLAG);

        Marker(android.content.Context c, int color) {
            super(c);
            float d = c.getResources().getDisplayMetrics().density;
            ring.setStyle(Paint.Style.STROKE);
            ring.setStrokeWidth(4 * d);
            ring.setColor(color);
            shadow.setStyle(Paint.Style.STROKE);
            shadow.setStrokeWidth(7 * d);
            shadow.setColor(Color.argb(140, 0, 0, 0));
        }

        @Override
        protected void onDraw(Canvas c) {
            float cx = getWidth() / 2f, cy = getHeight() / 2f;
            float r = Math.min(cx, cy) - shadow.getStrokeWidth();
            c.drawCircle(cx, cy, r, shadow);
            c.drawCircle(cx, cy, r, ring);
            // 가운데를 가리키는 짧은 눈금 4개 (가운데는 비워 둠)
            float in = r * 0.55f;
            c.drawLine(cx - r, cy, cx - in, cy, ring);
            c.drawLine(cx + in, cy, cx + r, cy, ring);
            c.drawLine(cx, cy - r, cx, cy - in, ring);
            c.drawLine(cx, cy + r, cx, cy + in, ring);
        }
    }
}
