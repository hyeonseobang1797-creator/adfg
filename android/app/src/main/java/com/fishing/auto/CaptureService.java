package com.fishing.auto;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import java.nio.ByteBuffer;

/**
 * 안드로이드 10 이하용 화면 보기 (화면 녹화 권한 사용).
 * 안드로이드 11 이상은 접근성 스크린샷을 써서 이 서비스가 필요 없어요.
 */
public class CaptureService extends Service {

    static CaptureService instance;
    static final String EXTRA_CODE = "code";
    static final String EXTRA_DATA = "data";

    private MediaProjection projection;
    private VirtualDisplay display;
    private ImageReader reader;
    private HandlerThread thread;
    private int curW, curH;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startAsForeground();
        if (intent != null && projection == null) {
            int code = intent.getIntExtra(EXTRA_CODE, 0);
            Intent data = intent.getParcelableExtra(EXTRA_DATA);
            MediaProjectionManager mpm =
                    (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (data != null) projection = mpm.getMediaProjection(code, data);
            if (projection != null) {
                projection.registerCallback(new MediaProjection.Callback() {
                    @Override
                    public void onStop() { release(); stopSelf(); }
                }, null);
            }
        }
        instance = projection != null ? this : null;
        if (FishingService.instance != null) FishingService.instance.showOverlay();
        return START_NOT_STICKY;
    }

    private void startAsForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(
                    "fishing", "자동 낚시", NotificationManager.IMPORTANCE_LOW));
            b = new Notification.Builder(this, "fishing");
        } else {
            b = new Notification.Builder(this);
        }
        Notification n = b.setContentTitle("🎣 자동 낚시")
                .setContentText("화면에서 빨간색을 찾는 중")
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(1, n);
        }
    }

    /** 지금 화면 크기(가로/세로 포함)에 맞춰 화면 받기 준비 */
    private synchronized void ensureDisplay() {
        DisplayMetrics dm = new DisplayMetrics();
        ((WindowManager) getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(dm);
        int w = dm.widthPixels, h = dm.heightPixels;
        if (display != null && w == curW && h == curH) return;
        if (display != null) display.release();
        if (reader != null) reader.close();
        if (thread == null) { thread = new HandlerThread("capture"); thread.start(); }
        reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2);
        display = projection.createVirtualDisplay("fishing", w, h, dm.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                reader.getSurface(), null, new Handler(thread.getLooper()));
        curW = w; curH = h;
    }

    /** 화면 사진 (없으면 null) */
    synchronized Bitmap grab() {
        if (projection == null) return null;
        ensureDisplay();
        Image img = null;
        for (int i = 0; i < 10 && img == null; i++) {
            img = reader.acquireLatestImage();
            if (img == null) {
                try { Thread.sleep(50); } catch (InterruptedException e) { return null; }
            }
        }
        if (img == null) return null;
        try {
            Image.Plane p = img.getPlanes()[0];
            ByteBuffer buf = p.getBuffer();
            int pixelStride = p.getPixelStride(), rowStride = p.getRowStride();
            int w = img.getWidth(), h = img.getHeight();
            int padW = rowStride / pixelStride;
            Bitmap full = Bitmap.createBitmap(padW, h, Bitmap.Config.ARGB_8888);
            full.copyPixelsFromBuffer(buf);
            if (padW == w) return full;
            Bitmap cut = Bitmap.createBitmap(full, 0, 0, w, h);
            full.recycle();
            return cut;
        } finally {
            img.close();
        }
    }

    private synchronized void release() {
        if (display != null) display.release();
        if (reader != null) reader.close();
        display = null; reader = null;
        instance = null;
    }

    @Override
    public void onDestroy() {
        release();
        if (projection != null) projection.stop();
        projection = null;
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
