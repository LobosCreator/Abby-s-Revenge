class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  preload() {
    this.load.image("titleScreen", "assets/title.png");

    // Preload game assets so MainScene has everything ready
    this.load.image("player", "assets/cat_player.png");
    this.load.image("enemy", "assets/cat_enemy.png");
    this.load.image("treat", "assets/treat.png");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#070b18");

    const img = this.add.image(width / 2, height / 2, "titleScreen");

    // Fit (contain) with a safety margin so no edge text can be clipped
    const fit = Math.min(width / img.width, height / img.height) * 0.92;
    img.setScale(fit);

    const isTouch = this.sys.game.device.input.touch;
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
    this.stars = [];
  }

  preload() {
    // Assets loaded in TitleScene
  }

  create() {
    const { width, height } = this.scale;

    // Background stars so the game never looks like a blank black screen
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        s: 1 + Math.random() * 2,
        v: 40 + Math.random() * 140
      });
    }
    this.starGfx = this.add.graphics();

    this.player = this.physics.add.sprite(width / 2, height * 0.82, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDamping(true);
    this.player.setDrag(0.9);
    this.player.setMaxVelocity(420);
    this.player.setScale(this.fitSpriteScale(this.player, 90));
    this.player.body.setSize(this.player.width * 0.55, this.player.height * 0.6, true);

    this.bullets = this.physics.add.group({ defaultKey: "treat", maxSize: 80 });
    this.enemies = this.physics.add.group();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,R");

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

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, null, this);

    // Spawn loop
    this.time.addEvent({
      delay: 900,
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

    // Spawn one immediately so you can see gameplay right away
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

    // Big + slow enough to be obvious
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

  update(time, delta) {
    // Debug counters prove the game loop is running
    this.debugText.setText(
      `Enemies: ${this.enemies.countActive(true)}  Bullets: ${this.bullets.countActive(true)}`
    );

    // Restart
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.scene.restart();
      return;
    }
    if (this.gameOver) return;

    // Starfield animation
    const { width, height } = this.scale;
    this.starGfx.clear();
    this.starGfx.fillStyle(0xffffff, 0.85);
    const dt = delta / 1000;
    for (const s of this.stars) {
      s.y += s.v * dt;
      if (s.y > height) {
        s.y = -5;
        s.x = Math.random() * width;
      }
      this.starGfx.fillRect(s.x, s.y, s.s, s.s);
    }

    // Movement
    const accel = 800;

    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;

    this.player.setAccelerationX(left ? -accel : right ? accel : 0);
    this.player.setAccelerationY(up ? -accel : down ? accel : 0);

    // Shooting
    if (this.cursors.space.isDown || this.keys.SPACE.isDown) {
      this.tryShoot();
    }

    // Cleanup
    this.bullets.children.iterate((b) => {
      if (b && b.active && b.y < -40) b.disableBody(true, true);
    });

    this.enemies.children.iterate((e) => {
      if (e && e.active && e.y > height + 80) e.disableBody(true, true);
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
