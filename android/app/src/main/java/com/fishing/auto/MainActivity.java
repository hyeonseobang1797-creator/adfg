package com.fishing.auto;

import android.app.Activity;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** 앱을 열면 나오는 화면: 접근성 켜기 + 사용법 */
public class MainActivity extends Activity {

    private TextView state;
    private static final int REQ_CAPTURE = 7;

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req != REQ_CAPTURE) return;
        if (result != RESULT_OK || data == null) {
            Toast.makeText(this, "화면 권한이 있어야 빨간색을 찾을 수 있어요", Toast.LENGTH_LONG).show();
            return;
        }
        Intent svc = new Intent(this, CaptureService.class)
                .putExtra(CaptureService.EXTRA_CODE, result)
                .putExtra(CaptureService.EXTRA_DATA, data);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc); else startService(svc);
        Toast.makeText(this, "로블록스로 가세요!", Toast.LENGTH_SHORT).show();
        moveTaskToBack(true);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        int pad = dp(18);

        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);
        scroll.addView(root);

        TextView title = text("🎣 자동 낚시", 26, true);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView sub = text("로블록스 '알 훔치기' 자동 낚시", 14, false);
        sub.setGravity(Gravity.CENTER);
        sub.setTextColor(Color.GRAY);
        root.addView(sub);

        state = text("", 17, true);
        state.setGravity(Gravity.CENTER);
        state.setPadding(0, dp(18), 0, dp(10));
        root.addView(state);

        root.addView(button("① 접근성 켜기", "#2F7FC0", v -> {
            Toast.makeText(this, "'설치된 앱' → '자동 낚시' → 켜기", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
        }));

        root.addView(button("② 낚시 창 띄우기", "#3AA060", v -> {
            if (FishingService.instance == null) {
                Toast.makeText(this, "먼저 ① 접근성을 켜 주세요", Toast.LENGTH_LONG).show();
            } else if (Build.VERSION.SDK_INT < 30 && CaptureService.instance == null) {
                // 안드로이드 10 이하: 화면 녹화 권한을 받아야 빨간색을 볼 수 있음
                Toast.makeText(this, "'지금 시작'을 눌러 주세요", Toast.LENGTH_LONG).show();
                MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
                startActivityForResult(mpm.createScreenCaptureIntent(), REQ_CAPTURE);
            } else {
                FishingService.instance.showOverlay();
                Toast.makeText(this, "로블록스로 가세요!", Toast.LENGTH_SHORT).show();
                moveTaskToBack(true);
            }
        }));

        root.addView(button("접근성이 회색으로 안 켜질 때", "#777777", v -> {
            Toast.makeText(this, "오른쪽 위 ⋮ → '제한된 설정 허용'", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getPackageName())));
        }));

        TextView how = text(FishingService.TUTORIAL, 15, false);
        how.setPadding(0, dp(20), 0, 0);
        how.setLineSpacing(0, 1.25f);
        root.addView(how);

        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (FishingService.instance != null) {
            state.setText("✅ 접근성 켜짐 — ② 를 누르세요");
            state.setTextColor(Color.parseColor("#3AA060"));
        } else {
            state.setText("❌ 접근성 꺼짐 — ① 을 누르세요");
            state.setTextColor(Color.parseColor("#E03030"));
        }
    }

    private TextView text(String s, int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button button(String s, String color, View.OnClickListener l) {
        Button btn = new Button(this);
        btn.setText(s);
        btn.setTextSize(17);
        btn.setAllCaps(false);
        btn.setTextColor(Color.WHITE);
        btn.setBackgroundColor(Color.parseColor(color));
        btn.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(58));
        lp.topMargin = dp(10);
        btn.setLayoutParams(lp);
        return btn;
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }
}
