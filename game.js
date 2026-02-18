class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  preload() {
    this.load.image("titleScreen", "assets/title.png");

    // Preload game assets
    this.load.image("player", "assets/cat_player.png");
    this.load.image("enemy", "assets/cat_enemy.png");
    this.load.image("treat", "assets/treat.png");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#070b18");

    const img = this.add.image(width / 2, height / 2, "titleScreen");

    // Fit with margin so text never gets clipped
    const fit = Math.min(width / img.width, height / img.height) * 0.92;
    img.setScale(fit);

    const prompt = this.sys.game.device.input.touch ? "Tap to start" : "Press any key to start";

    const startText = this.add.text(width / 2, height * 0.9, prompt, {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "22px",
      color: "#ffffff"
    }).setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0.2,
      duration: 650,
      yoyo: true,
      repeat: -1
    });

    const startGame = () => this.scene.start("main");

    this.input.once("pointerdown", startGame);
    this.input.keyboard.once("keydown", startGame);
  }
}

class MainScene extends Phaser.Scene {
  constructor() {
    super("main");
    this.score = 0;
    this.lives = 3;

    this.gameOver = false;

    this.fireCooldownMs = 150;
    this.lastShotAt = 0;

    this.stars = [];
  }

  preload() {
    // assets loaded in TitleScene
  }

  create() {
    const { width, height } = this.scale;

    // Starfield background
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        s: 1 + Math.random() * 2,
        v: 40 + Math.random() * 140
      });
    }
    this.starGfx = this.add.graphics().setDepth(0);

    // Debug markers for enemies
    this.enemyGfx = this.add.graphics().setDepth(999);

    // Player
    this.player = this.physics.add.sprite(width / 2, height * 0.82, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDamping(true);
    this.player.setDrag(0.9);
    this.player.setMaxVelocity(420);

    // Use display size instead of scale to handle PNGs with huge transparent padding
    this.player.setDisplaySize(90, 90);
    this.player.body.setSize(this.player.width * 0.55, this.player.height * 0.6, true);

    // Groups
    this.bullets = this.physics.add.group({ defaultKey: "treat", maxSize: 120 });
    this.enemies = this.physics.add.group();

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,R");

    // UI
    this.ui = this.add.text(14, 12, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "18px",
      color: "#ffffff"
    }).setDepth(10);

    this.debugText = this.add.text(14, 36, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "14px",
      color: "#ffffff"
    }).setDepth(10);

    this.overText = this.add.text(width / 2, height / 2, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "48px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setDepth(10);

    // Collisions
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, null, this);

    // Spawn enemies frequently for testing
    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        if (!this.gameOver) this.spawnEnemy();
      }
    });

    // Touch: tap to shoot
    this.input.on("pointerdown", () => {
      if (!this.gameOver) this.tryShoot();
    });

    this.updateUI();

    // Spawn one immediately so you see it right away
    this.spawnEnemy();
  }

  updateUI() {
    this.ui.setText(`Score: ${this.score}   Lives: ${this.lives}`);
  }

  tryShoot() {
    const now = this.time.now;
    if (now - this.lastShotAt < this.fireCooldownMs) return;
    this.lastShotAt = now;

    const b = this.bullets.get(this.player.x, this.player.y - 55);
    if (!b) return;

    b.setActive(true).setVisible(true).setAlpha(1);
    b.setDepth(80);

    // Use display size so treat always shows
    b.setDisplaySize(22, 28);

    b.body.enable = true;
    b.setVelocity(0, -720);
  }

  spawnEnemy() {
    const { width } = this.scale;

    // Force center spawn ON screen
    const x = Math.floor(width / 2);

    const e = this.physics.add.sprite(x, 60, "enemy");
    e.setActive(true).setVisible(true).setAlpha(1);
    e.setDepth(60);

    // Use display size to avoid huge transparent padding issues
    e.setDisplaySize(120, 120);

    e.setVelocity(0, 180);

    // Reasonable hitbox
    e.body.setSize(e.width * 0.6, e.height * 0.6, true);

    this.enemies.add(e);
  }

  onBulletHitEnemy(bullet, enemy) {
    bullet.disableBody(true, true);
    enemy.disableBody(true, true);
    this.score += 100;
    this.updateUI();
  }

  onPlayerHitEnemy(player, enemy) {
    enemy.disableBody(true, true);
    this.lives -= 1;
    this.updateUI();

    if (this.lives <= 0) {
      this.gameOver = true;
      this.overText.setText("Game Over\nPress R to Restart");
    }
  }

  update(time, delta) {
    const { width, height } = this.scale;

    // Debug counters
    const enemyLoaded = this.textures.exists("enemy");
    this.debugText.setText(
      `EnemyLoaded: ${enemyLoaded}  Enemies: ${this.enemies.countActive(true)}  Bullets: ${this.bullets.countActive(true)}`
    );

    // Restart
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.scene.restart();
      return;
    }
    if (this.gameOver) return;

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

    // Enemy position markers (red dots) so you can see where enemies are even if sprite is invisible
    this.enemyGfx.clear();
    this.enemyGfx.fillStyle(0xff0000, 1);
    this.enemies.children.iterate((e) => {
      if (e && e.active) this.enemyGfx.fillCircle(e.x, e.y, 6);
    });

    // Movement
    const accel = 900;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;

    this.player.setAccelerationX(left ? -accel : right ? accel : 0);
    this.player.setAccelerationY(up ? -accel : down ? accel : 0);

    // Shooting
    if (this.cursors.space.isDown || this.keys.SPACE.isDown) this.tryShoot();

    // Cleanup bullets
    this.bullets.children.iterate((b) => {
      if (b && b.active && b.y < -60) b.disableBody(true, true);
    });

    // Cleanup enemies off screen
    this.enemies.children.iterate((e) => {
      if (e && e.active && e.y > height + 120) e.disableBody(true, true);
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 900,
  height: 600,
  physics: { default: "arcade", arcade: { debug: false } },
  scene: [TitleScene, MainScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
});
