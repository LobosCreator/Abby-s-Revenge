// Abby's Revenge
// Guaranteed baseline: NO physics engine.
// Manual movement + manual collisions.
// Assets in /assets (exact names):
// title.png, cat_player.png, cat_enemy.png, treat.png

class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  preload() {
    this.load.image("titleScreen", "assets/title.png");
    this.load.image("player", "assets/cat_player.png");
    this.load.image("enemy", "assets/cat_enemy.png");
    this.load.image("treat", "assets/treat.png");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#070b18");

    const img = this.add.image(width / 2, height / 2, "titleScreen");
    const fit = Math.min(width / img.width, height / img.height) * 0.92;
    img.setScale(fit);

    const prompt = this.sys.game.device.input.touch ? "Tap to start" : "Press Space to start";
    const startText = this.add.text(width / 2, height * 0.9, prompt, {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "22px",
      color: "#ffffff"
    }).setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0.25,
      duration: 700,
      yoyo: true,
      repeat: -1
    });

    const start = () => this.scene.start("main");
    this.input.once("pointerdown", start);
    this.input.keyboard.once("keydown-SPACE", start);
    this.input.keyboard.once("keydown-ENTER", start);
  }
}

class MainScene extends Phaser.Scene {
  constructor() {
    super("main");

    this.score = 0;
    this.lives = 3;

    this.fireCooldownMs = 160;
    this.lastShotAt = 0;

    this.spawnEveryMs = 900;
    this.spawnTimerMs = 0;

    this.invulnUntil = 0;
    this.gameOver = false;

    this.touch = { left: false, right: false, up: false, down: false, shoot: false };

    this.stars = [];
    this.bullets = [];
    this.enemies = [];
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#070b18");

    // Starfield
    this.starGfx = this.add.graphics();
    this.stars = [];
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        s: 1 + Math.random() * 2,
        v: 40 + Math.random() * 160
      });
    }

    // Player (manual position)
    this.player = this.add.image(width / 2, height * 0.82, "player");
    this.player.setDisplaySize(96, 96);
    this.playerSpeed = 420; // px/sec

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,R");

    // UI
    this.ui = this.add.text(14, 12, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "18px",
      color: "#ffffff"
    });

    this.overText = this.add.text(width / 2, height / 2, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "44px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);

    // Touch controls on touch devices
    if (this.sys.game.device.input.touch) this.createTouchControls();

    this.updateUI();

    // Spawn one immediately so you see gameplay right away
    this.spawnEnemy();
  }

  createTouchControls() {
    const { width, height } = this.scale;

    const makeBtn = (x, y, label) => {
      const bg = this.add.circle(x, y, 34, 0xffffff, 0.14).setDepth(50);
      const txt = this.add.text(x, y, label, {
        fontFamily: "system-ui, Segoe UI, Roboto, Arial",
        fontSize: "16px",
        color: "#ffffff"
      }).setOrigin(0.5).setDepth(51);

      bg.setInteractive({ useHandCursor: false });

      return { bg, txt };
    };

    const left = makeBtn(70, height - 90, "◀");
    const right = makeBtn(150, height - 90, "▶");
    const up = makeBtn(110, height - 140, "▲");
    const down = makeBtn(110, height - 40, "▼");
    const shoot = makeBtn(width - 90, height - 90, "F");

    const setPress = (key, v) => (this.touch[key] = v);

    const bind = (btn, key) => {
      btn.bg.on("pointerdown", () => setPress(key, true));
      btn.bg.on("pointerup", () => setPress(key, false));
      btn.bg.on("pointerout", () => setPress(key, false));
    };

    bind(left, "left");
    bind(right, "right");
    bind(up, "up");
    bind(down, "down");
    bind(shoot, "shoot");
  }

  updateUI() {
    this.ui.setText(`Score: ${this.score}   Lives: ${this.lives}`);
  }

  shoot() {
    const now = this.time.now;
    if (now - this.lastShotAt < this.fireCooldownMs) return;
    this.lastShotAt = now;

    const b = this.add.image(this.player.x, this.player.y - 55, "treat");
    b.setDisplaySize(24, 30);
    b.vy = -720; // px/sec
    this.bullets.push(b);
  }

  spawnEnemy() {
    const { width } = this.scale;
    const x = Phaser.Math.Between(80, width - 80);

    const e = this.add.image(x, -60, "enemy");
    e.setDisplaySize(110, 110);
    e.vy = Phaser.Math.Between(140, 220);
    this.enemies.push(e);
  }

  // Simple AABB collision using display sizes
  overlaps(a, b) {
    const aw = a.displayWidth || 0;
    const ah = a.displayHeight || 0;
    const bw = b.displayWidth || 0;
    const bh = b.displayHeight || 0;

    return (
      Math.abs(a.x - b.x) * 2 < (aw + bw) &&
      Math.abs(a.y - b.y) * 2 < (ah + bh)
    );
  }

  endGame() {
    this.gameOver = true;
    this.overText.setText("Game Over\nPress R to Restart");
  }

  restart() {
    this.scene.restart();
  }

  update(time, delta) {
    const { width, height } = this.scale;
    const dt = delta / 1000;

    // Restart
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.restart();
      return;
    }

    // Stars
    this.starGfx.clear();
    this.starGfx.fillStyle(0xffffff, 0.85);
    for (const s of this.stars) {
      s.y += s.v * dt;
      if (s.y > height) {
        s.y = -5;
        s.x = Math.random() * width;
      }
      this.starGfx.fillRect(s.x, s.y, s.s, s.s);
    }

    if (this.gameOver) return;

    // Spawn timer
    this.spawnTimerMs += delta;
    if (this.spawnTimerMs >= this.spawnEveryMs) {
      this.spawnTimerMs = 0;
      this.spawnEnemy();
      this.spawnEveryMs = Math.max(350, this.spawnEveryMs * 0.992);
    }

    // Movement input
    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touch.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touch.right;
    const up = this.cursors.up.isDown || this.keys.W.isDown || this.touch.up;
    const down = this.cursors.down.isDown || this.keys.S.isDown || this.touch.down;

    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);

    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;

    this.player.x = Phaser.Math.Clamp(this.player.x + mx * this.playerSpeed * dt, 40, width - 40);
    this.player.y = Phaser.Math.Clamp(this.player.y + my * this.playerSpeed * dt, 60, height - 40);

    // Shooting
    const wantShoot = this.cursors.space.isDown || this.keys.SPACE.isDown || this.touch.shoot;
    if (wantShoot) this.shoot();

    // Move bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.y < -80) {
        b.destroy();
        this.bullets.splice(i, 1);
      }
    }

    // Move enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.y += e.vy * dt;
      if (e.y > height + 140) {
        e.destroy();
        this.enemies.splice(i, 1);
      }
    }

    // Bullet vs enemy collisions
    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const e = this.enemies[ei];
      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        const b = this.bullets[bi];
        if (this.overlaps(e, b)) {
          e.destroy();
          b.destroy();
          this.enemies.splice(ei, 1);
          this.bullets.splice(bi, 1);
          this.score += 100;
          this.updateUI();
          break;
        }
      }
    }

    // Enemy vs player collisions (with invuln)
    const now = this.time.now;
    if (now >= this.invulnUntil) {
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (this.overlaps(e, this.player)) {
          e.destroy();
          this.enemies.splice(ei, 1);

          this.lives -= 1;
          this.invulnUntil = now + 1200;

          this.tweens.add({
            targets: this.player,
            alpha: 0.2,
            duration: 80,
            yoyo: true,
            repeat: 9,
            onComplete: () => this.player.setAlpha(1)
          });

          this.updateUI();
          if (this.lives <= 0) this.endGame();
          break;
        }
      }
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 900,
  height: 600,
  backgroundColor: "#070b18",
  scene: [TitleScene, MainScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
});
