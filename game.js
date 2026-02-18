// Abby's Revenge
// Fresh, working baseline: Title screen + moving player + moving enemies + moving treats
// Asset names in /assets (keep exactly):
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

    this.lastShotAt = 0;
    this.fireCooldownMs = 160;

    this.gameOver = false;
    this.invulnUntil = 0;

    this.spawnDelayMs = 900;
    this.spawnTimer = 0;

    this.touch = { left: false, right: false, up: false, down: false, shoot: false };

    this.stars = [];
  }

  preload() {
    // assets loaded in TitleScene
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#070b18");

    // Starfield
    this.starGfx = this.add.graphics().setDepth(0);
    this.stars = [];
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        s: 1 + Math.random() * 2,
        v: 40 + Math.random() * 160
      });
    }

    // Player (use sprite so physics + velocity always works)
    this.player = this.physics.add.sprite(width / 2, height * 0.82, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDamping(true);
    this.player.setDrag(0.9);
    this.player.setMaxVelocity(420);

    // Force visible size regardless of PNG padding
    this.player.setDisplaySize(96, 96);
    this.player.body.setSize(60, 60, true);

    // Groups (dynamic bodies)
    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,R");

    // UI
    this.ui = this.add.text(14, 12, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "18px",
      color: "#ffffff"
    }).setDepth(10);

    this.overText = this.add.text(width / 2, height / 2, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "44px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setDepth(10);

    // Touch controls only on touch devices
    if (this.sys.game.device.input.touch) {
      this.createTouchControls();
    }

    // Collisions
    this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.hitPlayer, null, this);

    // Spawn one immediately
    this.spawnEnemy();

    this.updateUI();
  }

  createTouchControls() {
    const { width, height } = this.scale;

    const makeBtn = (x, y, label) => {
      const bg = this.add.circle(x, y, 34, 0xffffff, 0.14).setDepth(20);
      const txt = this.add.text(x, y, label, {
        fontFamily: "system-ui, Segoe UI, Roboto, Arial",
        fontSize: "16px",
        color: "#ffffff"
      }).setOrigin(0.5).setDepth(21);

      bg.setScrollFactor(0);
      txt.setScrollFactor(0);
      bg.setInteractive({ useHandCursor: false });

      return { bg, txt };
    };

    const left = makeBtn(70, height - 90, "◀");
    const right = makeBtn(150, height - 90, "▶");
    const up = makeBtn(110, height - 140, "▲");
    const down = makeBtn(110, height - 40, "▼");
    const shoot = makeBtn(width - 90, height - 90, "F");

    const setPress = (key, v) => (this.touch[key] = v);

    left.bg.on("pointerdown", () => setPress("left", true));
    left.bg.on("pointerup", () => setPress("left", false));
    left.bg.on("pointerout", () => setPress("left", false));

    right.bg.on("pointerdown", () => setPress("right", true));
    right.bg.on("pointerup", () => setPress("right", false));
    right.bg.on("pointerout", () => setPress("right", false));

    up.bg.on("pointerdown", () => setPress("up", true));
    up.bg.on("pointerup", () => setPress("up", false));
    up.bg.on("pointerout", () => setPress("up", false));

    down.bg.on("pointerdown", () => setPress("down", true));
    down.bg.on("pointerup", () => setPress("down", false));
    down.bg.on("pointerout", () => setPress("down", false));

    shoot.bg.on("pointerdown", () => setPress("shoot", true));
    shoot.bg.on("pointerup", () => setPress("shoot", false));
    shoot.bg.on("pointerout", () => setPress("shoot", false));
  }

  updateUI() {
    this.ui.setText(`Score: ${this.score}   Lives: ${this.lives}`);
  }

  spawnEnemy() {
    const { width } = this.scale;
    const x = Phaser.Math.Between(80, width - 80);

    const e = this.physics.add.sprite(x, -60, "enemy");
    e.setActive(true).setVisible(true).setAlpha(1);
    e.setDepth(5);

    e.setDisplaySize(110, 110);
    e.body.setSize(70, 70, true);

    e.setVelocity(0, Phaser.Math.Between(140, 220));

    this.enemies.add(e);
  }

  shoot() {
    const now = this.time.now;
    if (now - this.lastShotAt < this.fireCooldownMs) return;
    this.lastShotAt = now;

    const b = this.physics.add.sprite(this.player.x, this.player.y - 55, "treat");
    b.setActive(true).setVisible(true).setAlpha(1);
    b.setDepth(6);

    b.setDisplaySize(24, 30);
    b.body.setSize(16, 20, true);

    b.setVelocity(0, -720);

    this.bullets.add(b);
  }

  hitEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.destroy();
    this.score += 100;
    this.updateUI();
  }

  hitPlayer(player, enemy) {
    const now = this.time.now;
    if (now < this.invulnUntil) return;

    enemy.destroy();

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

    if (this.lives <= 0) {
      this.gameOver = true;
      this.overText.setText("Game Over\nPress R to Restart");
      this.player.setAcceleration(0, 0);
      this.player.setVelocity(0, 0);
    }
  }

  update(time, delta) {
    const { width, height } = this.scale;

    // Starfield
    const dt = delta / 1000;
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

    // Restart
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.scene.restart();
      return;
    }

    if (this.gameOver) return;

    // Spawning (time-based, frame-rate independent)
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnDelayMs) {
      this.spawnTimer = 0;
      this.spawnEnemy();
      this.spawnDelayMs = Math.max(350, this.spawnDelayMs * 0.992);
    }

    // Movement input (keyboard + touch)
    const accel = 900;

    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touch.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touch.right;
    const up = this.cursors.up.isDown || this.keys.W.isDown || this.touch.up;
    const down = this.cursors.down.isDown || this.keys.S.isDown || this.touch.down;

    this.player.setAccelerationX(left ? -accel : right ? accel : 0);
    this.player.setAccelerationY(up ? -accel : down ? accel : 0);

    // Shooting
    const wantShoot = this.cursors.space.isDown || this.keys.SPACE.isDown || this.touch.shoot;
    if (wantShoot) this.shoot();

    // Cleanup bullets
    this.bullets.children.iterate((b) => {
      if (b && b.active && b.y < -80) b.destroy();
    });

    // Cleanup enemies that leave the screen
    this.enemies.children.iterate((e) => {
      if (e && e.active && e.y > height + 140) e.destroy();
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 900,
  height: 600,
  backgroundColor: "#070b18",
  physics: { default: "arcade", arcade: { debug: false } },
  scene: [TitleScene, MainScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
});
