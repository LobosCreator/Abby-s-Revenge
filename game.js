class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  preload() {
    this.load.image("titleScreen", "assets/title.png");

    // Preload game assets so the transition is instant
    this.load.image("player", "assets/cat_player.png");
    this.load.image("enemy", "assets/cat_enemy.png");
    this.load.image("treat", "assets/treat.png");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#070b18");

    const img = this.add.image(width / 2, height / 2, "titleScreen");

    // FIX: Fit (contain) so Abby's Revenge text is not cropped
    const fit = Math.min(width / img.width, height / img.height);
    img.setScale(fit);

    const isTouch =
      this.input.touch && this.input.touch.enabled && this.sys.game.device.input.touch;

    const prompt = isTouch ? "Tap to start" : "Press any key to start";

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
    this.fireCooldownMs = 150;
    this.lastShotAt = 0;
    this.gameOver = false;
  }

  // Assets already loaded in TitleScene
  preload() {}

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#070b18");

    this.player = this.physics.add.sprite(width / 2, height * 0.82, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDamping(true);
    this.player.setDrag(0.9);
    this.player.setMaxVelocity(400);
    this.player.setScale(this.fitSpriteScale(this.player, 90));

    this.bullets = this.physics.add.group({ defaultKey: "treat", maxSize: 80 });
    this.enemies = this.physics.add.group();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,R");

    this.ui = this.add.text(14, 12, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "18px",
      color: "#ffffff"
    }).setDepth(10);

    // NEW: live debug counter so you can confirm enemies are spawning
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

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, null, this);

    this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        if (!this.gameOver) this.spawnEnemy();
      }
    });

    // Simple touch support: tap to shoot
    this.input.on("pointerdown", () => {
      if (!this.gameOver) this.tryShoot();
    });

    this.updateUI();

    // NEW: spawn one enemy immediately so you see gameplay right away
    this.spawnEnemy();
  }

  fitSpriteScale(sprite, targetPixels) {
    const m = Math.max(sprite.width || 1, sprite.height || 1);
    return targetPixels / m;
  }

  spawnEnemy() {
    const { width } = this.scale;
    const x = Phaser.Math.Between(60, width - 60);

    const e = this.physics.add.sprite(x, -60, "enemy");

    // NEW: make enemies larger and a bit slower so they are obvious
    e.setScale(this.fitSpriteScale(e, 110));
    e.setVelocityY(160);

    e.body.setSize(e.width * 0.6, e.height * 0.6, true);

    this.enemies.add(e);
  }

  tryShoot() {
    const now = this.time.now;
    if (now - this.lastShotAt < this.fireCooldownMs) return;
    this.lastShotAt = now;

    const b = this.bullets.get(this.player.x, this.player.y - 40);
    if (!b) return;

    b.setActive(true).setVisible(true);
    b.setScale(this.fitSpriteScale(b, 25));
    b.body.enable = true;
    b.setVelocity(0, -700);
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

  updateUI() {
    this.ui.setText(`Score: ${this.score}   Lives: ${this.lives}`);
  }

  update() {
    // NEW: show counters so you can verify spawns and bullet creation
    if (this.debugText) {
      this.debugText.setText(
        `Enemies: ${this.enemies.countActive(true)}  Bullets: ${this.bullets.countActive(true)}`
      );
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.scene.restart();
      return;
    }

    if (this.gameOver) return;

    const accel = 800;

    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;

    this.player.setAccelerationX(left ? -accel : right ? accel : 0);
    this.player.setAccelerationY(up ? -accel : down ? accel : 0);

    if (this.cursors.space.isDown || this.keys.SPACE.isDown) {
      this.tryShoot();
    }

    this.bullets.children.iterate((b) => {
      if (b && b.active && b.y < -40) b.disableBody(true, true);
    });

    this.enemies.children.iterate((e) => {
      if (e && e.active && e.y > 700) e.disableBody(true, true);
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
