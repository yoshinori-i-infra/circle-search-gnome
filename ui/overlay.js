imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Gdk = '4.0';
imports.gi.versions.cairo = '1.0';

const { Gio, Gtk, Gdk, GdkPixbuf, GLib, cairo } = imports.gi;
const system = imports.system;

const imagePath = ARGV[0] || (GLib.get_home_dir() + '/.cache/circle-search/full_snapshot.png');

let pixbuf = null;
try {
    pixbuf = GdkPixbuf.Pixbuf.new_from_file(imagePath);
} catch (e) {
    printerr(`[UI Error] Failed to load snapshot image: ${e.message}`);
    system.exit(1);
}

const app = new Gtk.Application({
    application_id: 'com.huslabo.CircleSearchUI',
    flags: Gio.ApplicationFlags.FLAGS_NONE
});

app.connect('activate', (application) => {
    const window = new Gtk.ApplicationWindow({
        application: application,
        decorated: false,
        fullscreened: true
    });

    const area = new Gtk.DrawingArea();
    window.set_child(area);

    let isDragging = false;
    let points = [];
    let particles = [];
    let needsRedraw = false;
    let cachedSurface = null;
    let animTime = 0;

    const imgWidth = pixbuf.get_width();
    const imgHeight = pixbuf.get_height();

    // 重い背景描画（画像＋暗転＋カプセルUI）を1回だけ事前生成してメモリに保持する関数
    const createBackgroundCache = (winWidth, winHeight) => {
        if (winWidth <= 0 || winHeight <= 0) return;

        const surface = new cairo.ImageSurface(cairo.Format.ARGB32, winWidth, winHeight);
        const cr = new cairo.Context(surface);

        const scaleX = winWidth / imgWidth;
        const scaleY = winHeight / imgHeight;

        // 1. 元画像描画
        cr.save();
        cr.scale(scaleX, scaleY);
        Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
        cr.paint();
        cr.restore();

        // 2. 暗転マスク
        cr.setSourceRGBA(0, 0, 0, 0.45);
        cr.paint();

        // 3. カプセルバー (UIパーツも一括でキャッシュ)
        const pillW = Math.min(420, winWidth * 0.8);
        const pillH = 50;
        const pillX = (winWidth - pillW) / 2;
        const pillY = winHeight - pillH - 45;
        const radius = 25;

        cr.save();
        cr.newSubPath();
        cr.arc(pillX + radius, pillY + radius, radius, Math.PI / 2, Math.PI * 1.5);
        cr.arc(pillX + pillW - radius, pillY + radius, radius, -Math.PI / 2, Math.PI / 2);
        cr.closePath();

        // 高級感あるダークグラデーション背景
        const bgGrad = new cairo.LinearGradient(pillX, pillY, pillX, pillY + pillH);
        bgGrad.addColorStopRGBA(0, 0.12, 0.14, 0.22, 0.92);
        bgGrad.addColorStopRGBA(1, 0.06, 0.08, 0.14, 0.95);
        cr.setSource(bgGrad);
        cr.fillPreserve();

        // 輝くマルチカラーボーダー
        const borderGrad = new cairo.LinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
        borderGrad.addColorStopRGBA(0.0, 0.26, 0.65, 1.0, 0.7);
        borderGrad.addColorStopRGBA(0.5, 0.80, 0.40, 1.0, 0.8);
        borderGrad.addColorStopRGBA(1.0, 0.00, 0.90, 0.9, 0.7);
        cr.setSource(borderGrad);
        cr.setLineWidth(1.5);
        cr.stroke();

        // アイコン & テキスト
        cr.setSourceRGBA(0.95, 0.96, 1.0, 0.95);
        cr.selectFontFace("Sans", 0, 1); // Bold
        cr.setFontSize(15);
        const text = "✨ 囲んで検索 (Circle to Search)";
        const extents = cr.textExtents(text);
        cr.moveTo(pillX + (pillW - extents.width) / 2, pillY + (pillH + extents.height) / 2 - 2);
        cr.showText(text);
        cr.restore();

        cachedSurface = surface;
    };

    // ベジェ曲線描画（滑らかな曲線）
    const drawSmoothPath = (cr, pts) => {
        if (pts.length < 2) return;
        cr.moveTo(pts[0].x, pts[0].y);

        if (pts.length === 2) {
            cr.lineTo(pts[1].x, pts[1].y);
            return;
        }

        for (let i = 1; i < pts.length - 1; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];
            const p2 = pts[i + 1];

            const startX = (p0.x + p1.x) / 2;
            const startY = (p0.y + p1.y) / 2;
            const endX = (p1.x + p2.x) / 2;
            const endY = (p1.y + p2.y) / 2;

            cr.curveTo(
                startX + (2 / 3) * (p1.x - startX),
                startY + (2 / 3) * (p1.y - startY),
                endX + (2 / 3) * (p1.x - endX),
                endY + (2 / 3) * (p1.y - endY),
                endX, endY
            );
        }
        const last = pts[pts.length - 1];
        cr.lineTo(last.x, last.y);
    };

    // パーティクル生成関数
    const spawnParticles = (x, y, count = 3) => {
        const colors = [
            { r: 0.0, g: 0.85, b: 1.0 },   // Electric Cyan
            { r: 0.85, g: 0.35, b: 1.0 },  // Neon Violet
            { r: 1.0, g: 0.90, b: 0.3 },   // Stardust Gold
            { r: 1.0, g: 1.0, b: 1.0 }     // Diamond White
        ];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 2.5;
            const color = colors[Math.floor(Math.random() * colors.length)];

            particles.push({
                x: x + (Math.random() - 0.5) * 8,
                y: y + (Math.random() - 0.5) * 8,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 1.8 + Math.random() * 3.5,
                color: color,
                life: 0,
                maxLife: 20 + Math.floor(Math.random() * 25),
                isStar: Math.random() > 0.4
            });
        }
    };

    // 4点星くずキラキラ描画
    const drawStarSparkle = (cr, cx, cy, radius, color, alpha) => {
        cr.save();
        cr.setSourceRGBA(color.r, color.g, color.b, alpha);

        // 中央の輝き
        const radGrad = new cairo.RadialGradient(cx, cy, 0, cx, cy, radius * 1.8);
        radGrad.addColorStopRGBA(0.0, color.r, color.g, color.b, alpha);
        radGrad.addColorStopRGBA(1.0, color.r, color.g, color.b, 0.0);
        cr.setSource(radGrad);
        cr.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
        cr.fill();

        // 4角クロスフレア
        cr.setSourceRGBA(1.0, 1.0, 1.0, alpha * 0.9);
        cr.setLineWidth(1.0);
        cr.beginPath();
        cr.moveTo(cx - radius * 2.2, cy);
        cr.lineTo(cx + radius * 2.2, cy);
        cr.moveTo(cx, cy - radius * 2.2);
        cr.lineTo(cx, cy + radius * 2.2);
        cr.stroke();

        cr.restore();
    };

    area.set_draw_func((drawingArea, cr, winWidth, winHeight) => {
        if (!cachedSurface) {
            createBackgroundCache(winWidth, winHeight);
        }

        // 1. キャッシュ済み背景を1枚転写
        if (cachedSurface) {
            cr.setSourceSurface(cachedSurface, 0, 0);
            cr.paint();
        }

        const scaleX = winWidth / imgWidth;
        const scaleY = winHeight / imgHeight;

        // 2. 囲まれた領域のスポットライト＆ハイライト演出
        if (points.length > 3) {
            let minX = points[0].x, maxX = points[0].x;
            let minY = points[0].y, maxY = points[0].y;
            for (const pt of points) {
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
            }

            const boxW = maxX - minX;
            const boxH = maxY - minY;

            if (boxW > 10 && boxH > 10) {
                cr.save();

                // 囲みパスに沿ってクリッピング領域を作成、または角丸矩形でライトアップ
                const cornerR = Math.min(16, boxW / 4, boxH / 4);
                cr.newSubPath();
                cr.arc(minX + cornerR, minY + cornerR, cornerR, Math.PI, Math.PI * 1.5);
                cr.arc(maxX - cornerR, minY + cornerR, cornerR, -Math.PI / 2, 0);
                cr.arc(maxX - cornerR, maxY - cornerR, cornerR, 0, Math.PI / 2);
                cr.arc(minX + cornerR, maxY - cornerR, cornerR, Math.PI / 2, Math.PI);
                cr.closePath();

                // スポットライト効果: 暗転を取り除いて原画像を明るく表示
                cr.clipPreserve();
                cr.scale(scaleX, scaleY);
                Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
                cr.paint();
                cr.restore();

                // スポットライト周囲のパルス光ボーダー
                cr.save();
                cr.newSubPath();
                cr.arc(minX + cornerR, minY + cornerR, cornerR, Math.PI, Math.PI * 1.5);
                cr.arc(maxX - cornerR, minY + cornerR, cornerR, -Math.PI / 2, 0);
                cr.arc(maxX - cornerR, maxY - cornerR, cornerR, 0, Math.PI / 2);
                cr.arc(minX + cornerR, maxY - cornerR, cornerR, Math.PI / 2, Math.PI);
                cr.closePath();

                const pulseAlpha = 0.35 + 0.15 * Math.sin(animTime * 0.1);
                cr.setSourceRGBA(0.0, 0.85, 1.0, pulseAlpha);
                cr.setLineWidth(2.5);
                cr.stroke();
                cr.restore();
            }
        }

        // 3. 多重ネオングロー軌跡の描画
        if (points.length > 1) {
            // Layer A: 最外郭 紫パープル・オーラ
            cr.save();
            drawSmoothPath(cr, points);
            cr.setSourceRGBA(0.55, 0.20, 1.0, 0.25);
            cr.setLineWidth(26.0);
            cr.setLineCap(cairo.LineCap.ROUND);
            cr.setLineJoin(cairo.LineJoin.ROUND);
            cr.stroke();
            cr.restore();

            // Layer B: 中間 シアン・ネオングロー
            cr.save();
            drawSmoothPath(cr, points);
            cr.setSourceRGBA(0.0, 0.80, 1.0, 0.55);
            cr.setLineWidth(14.0);
            cr.setLineCap(cairo.LineCap.ROUND);
            cr.setLineJoin(cairo.LineJoin.ROUND);
            cr.stroke();
            cr.restore();

            // Layer C: 内核 発光ブルーコア
            cr.save();
            drawSmoothPath(cr, points);
            cr.setSourceRGBA(0.40, 0.95, 1.0, 0.90);
            cr.setLineWidth(6.0);
            cr.setLineCap(cairo.LineCap.ROUND);
            cr.setLineJoin(cairo.LineJoin.ROUND);
            cr.stroke();
            cr.restore();

            // Layer D: 最深部 ピュアホワイトコア
            cr.save();
            drawSmoothPath(cr, points);
            cr.setSourceRGBA(1.0, 1.0, 1.0, 0.98);
            cr.setLineWidth(2.0);
            cr.setLineCap(cairo.LineCap.ROUND);
            cr.setLineJoin(cairo.LineJoin.ROUND);
            cr.stroke();
            cr.restore();

            // 4. ペン先（最新カーソル位置）の輝く光球（オーブ）＆フレア演出
            const leadPt = points[points.length - 1];
            cr.save();

            // 光球ラジアルグラデーション
            const orbRadius = 22;
            const orbGrad = new cairo.RadialGradient(leadPt.x, leadPt.y, 0, leadPt.x, leadPt.y, orbRadius);
            orbGrad.addColorStopRGBA(0.0, 1.0, 1.0, 1.0, 1.0);
            orbGrad.addColorStopRGBA(0.25, 0.4, 0.9, 1.0, 0.8);
            orbGrad.addColorStopRGBA(0.65, 0.6, 0.2, 1.0, 0.45);
            orbGrad.addColorStopRGBA(1.0, 0.0, 0.8, 1.0, 0.0);
            cr.setSource(orbGrad);
            cr.arc(leadPt.x, leadPt.y, orbRadius, 0, Math.PI * 2);
            cr.fill();

            // 先端クロススターバースト
            cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);
            cr.setLineWidth(1.8);
            cr.beginPath();
            cr.moveTo(leadPt.x - 14, leadPt.y);
            cr.lineTo(leadPt.x + 14, leadPt.y);
            cr.moveTo(leadPt.x, leadPt.y - 14);
            cr.lineTo(leadPt.x, leadPt.y + 14);
            cr.stroke();

            cr.restore();
        }

        // 5. キラキラ粒子（パーティクル・スターダスト）の描画
        for (const p of particles) {
            const progress = p.life / p.maxLife;
            const alpha = Math.max(0, 1.0 - progress);
            const currentRadius = p.size * (1.0 - progress * 0.4);

            if (p.isStar) {
                drawStarSparkle(cr, p.x, p.y, currentRadius, p.color, alpha);
            } else {
                cr.save();
                const pGrad = new cairo.RadialGradient(p.x, p.y, 0, p.x, p.y, currentRadius * 1.5);
                pGrad.addColorStopRGBA(0.0, p.color.r, p.color.g, p.color.b, alpha);
                pGrad.addColorStopRGBA(1.0, p.color.r, p.color.g, p.color.b, 0.0);
                cr.setSource(pGrad);
                cr.arc(p.x, p.y, currentRadius * 1.5, 0, Math.PI * 2);
                cr.fill();
                cr.restore();
            }
        }
    });

    // モニターのV-Sync/リフレッシュレートに同期して描画およびアニメーション更新
    area.add_tick_callback(() => {
        animTime++;

        // パーティクルの物理更新
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life++;

            if (p.life >= p.maxLife) {
                particles.splice(i, 1);
            }
        }

        // ドラッグ中またはアクティブなパーティクル・アニメーションが存在する場合は描画ループ維持
        if (isDragging || particles.length > 0 || points.length > 3 || needsRedraw) {
            area.queue_draw();
            needsRedraw = false;
        }
        return GLib.SOURCE_CONTINUE;
    });

    const click = new Gtk.GestureClick();
    const motion = new Gtk.EventControllerMotion();

    click.connect('pressed', (gesture, n_press, x, y) => {
        isDragging = true;
        points = [{ x: x, y: y }];
        spawnParticles(x, y, 8);
        needsRedraw = true;
    });

    const finishSelection = () => {
        isDragging = false;
        if (points.length < 5) {
            points = [];
            particles = [];
            needsRedraw = true;
            return;
        }

        const winWidth = area.get_width();
        const winHeight = area.get_height();

        let minX = points[0].x, maxX = points[0].x;
        let minY = points[0].y, maxY = points[0].y;

        for (const pt of points) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        }

        const margin = 30;
        minX = Math.max(0, minX - margin);
        minY = Math.max(0, minY - margin);
        maxX = Math.min(winWidth, maxX + margin);
        maxY = Math.min(winHeight, maxY + margin);

        const scaleX = imgWidth / winWidth;
        const scaleY = imgHeight / winHeight;

        const x = Math.round(minX * scaleX);
        const y = Math.round(minY * scaleY);
        const w = Math.round((maxX - minX) * scaleX);
        const h = Math.round((maxY - minY) * scaleY);

        if (w > 10 && h > 10) {
            const result = JSON.stringify({ x: x, y: y, width: w, height: h });
            print(result);
            window.close();
            system.exit(0);
        } else {
            points = [];
            particles = [];
            needsRedraw = true;
        }
    };

    click.connect('released', () => {
        if (isDragging) {
            finishSelection();
        }
    });

    motion.connect('motion', (controller, x, y) => {
        if (!isDragging) return;

        const lastPt = points[points.length - 1];
        if (!lastPt) return;

        if (Math.hypot(x - lastPt.x, y - lastPt.y) >= 1.0) {
            points.push({ x: x, y: y });
            spawnParticles(x, y, 2);
            needsRedraw = true;
        }
    });

    const keyController = new Gtk.EventControllerKey();
    keyController.connect('key-pressed', (controller, keyval) => {
        if (keyval === Gdk.KEY_Escape) {
            window.close();
            system.exit(1);
        }
    });

    area.add_controller(click);
    area.add_controller(motion);
    window.add_controller(keyController);

    window.present();
});
app.run([system.programInvocationName]);