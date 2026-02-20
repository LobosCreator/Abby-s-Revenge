// Abby's Revenge
// Manual arcade loop (no physics engine).
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
    // Optional boss art (falls back to enemy if missing)
    this.load.image("boss", "assets/boss.png");
    this.load.image("gameOverScreen", "assets/game over.png");
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#7eb9ee");

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

class GameOverScene extends Phaser.Scene {
  constructor() {
    super("gameover");
  }

preload() {
    this.load.image("gameOverScreen", "assets/game over.png");
  }
  
  create(data) {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#1f1f29");

    const score = data?.score ?? 0;
    const distance = Math.floor(data?.distance ?? 0);
    const kills = data?.kills ?? 0;

    if (this.textures.exists("game over")) {
      const gameOverImage = this.add.image(width / 2, height * 0.24, "game over");
      const fitScale = Math.min((width * 0.8) / gameOverImage.width, (height * 0.28) / gameOverImage.height);
      gameOverImage.setScale(fitScale);
    } else {
      this.add.text(width / 2, height * 0.3, "GAME OVER", {
        fontFamily: "system-ui, Segoe UI, Roboto, Arial",
        fontSize: "64px",
        color: "#ffffff",
        stroke: "#6f1d1d",
        strokeThickness: 8
      }).setOrigin(0.5);
    }
    
    this.add.text(width / 2, height * 0.5, `Score: ${score}\nDistance: ${distance}m\nKills: ${kills}`, {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "28px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.78, "Press R / Space / Enter to Restart\nPress T for Title", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "24px",
      color: "#f0e68c",
      align: "center"
    }).setOrigin(0.5);

    const restart = () => this.scene.start("main");
    const title = () => this.scene.start("title");

    this.input.once("pointerdown", restart);
    this.input.keyboard.once("keydown-R", restart);
    this.input.keyboard.once("keydown-SPACE", restart);
    this.input.keyboard.once("keydown-ENTER", restart);
    this.input.keyboard.once("keydown-T", title);
  }
}

class MainScene extends Phaser.Scene {
  constructor() {
    super("main");

    this.score = 0;
    this.lives = 10;
    this.distance = 0;

    this.fireCooldownMs = 140;
    this.lastShotAt = 0;

    this.spawnEveryMs = 980;
    this.spawnTimerMs = 0;

    this.invulnUntil = 0;
    this.gameOver = false;

    this.touch = { left: false, right: false, up: false, down: false, shoot: false };

    this.farmlandTiles = [];
    this.roadMarkers = [];
    this.clouds = [];

    this.bullets = [];
    this.enemies = [];
    this.enemyBullets = [];

    this.nextDistanceScore = 25;
    this.planesShotDown = 0;
    this.nextBossAt = 30;
    this.boss = null;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#7eb9ee");

    this.terrainGfx = this.add.graphics();
    this.roadGfx = this.add.graphics();
    this.cloudGfx = this.add.graphics();
    this.fxGfx = this.add.graphics().setDepth(70);

    this.farmlandTiles = [];
    this.roadMarkers = [];
    this.clouds = [];

    for (let i = 0; i < 44; i++) {
      const w = Phaser.Math.Between(100, 220);
      const h = Phaser.Math.Between(60, 140);
      this.farmlandTiles.push({
        x: Math.random() * (width + 220) - 110,
        y: Math.random() * height,
        w,
        h,
        v: 100 + Math.random() * 75,
        color: Phaser.Utils.Array.GetRandom([0x739f43, 0x90b95d, 0x5f8d3f, 0x9fbe6a])
      });
    }

    for (let i = 0; i < 10; i++) {
      this.roadMarkers.push({
        x: width * 0.5 + Phaser.Math.Between(-10, 10),
        y: i * (height / 10),
        w: 5,
        h: 35,
        v: 210
      });
    }

    for (let i = 0; i < 18; i++) {
      this.clouds.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 18 + Math.random() * 24,
        v: 40 + Math.random() * 32,
        alpha: 0.17 + Math.random() * 0.14
      });
    }

    this.player = this.add.image(width / 2, height * 0.8, "player");
    this.player.setDisplaySize(96, 96);
    this.playerSpeed = 430;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,R");

    this.ui = this.add.text(14, 10, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "18px",
      color: "#ffffff",
      stroke: "#1b2a14",
      strokeThickness: 3
    }).setDepth(95);

    this.overText = this.add.text(width / 2, height / 2, "", {
      fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      fontSize: "42px",
      color: "#ffffff",
      align: "center",
      stroke: "#1b2a14",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(95);

    if (this.sys.game.device.input.touch) this.createTouchControls();

    this.updateUI();
    this.spawnFormation();
  }

  createTouchControls() {
    const { width, height } = this.scale;

    const makeBtn = (x, y, label) => {
      const bg = this.add.circle(x, y, 34, 0xffffff, 0.18).setDepth(100);
      const txt = this.add.text(x, y, label, {
        fontFamily: "system-ui, Segoe UI, Roboto, Arial",
        fontSize: "16px",
        color: "#ffffff"
      }).setOrigin(0.5).setDepth(101);

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
    const bossText = this.boss ? `   Boss HP: ${this.boss.hp}` : "";
    this.ui.setText(`Score: ${this.score}   Lives: ${this.lives}   Dist: ${Math.floor(this.distance)}m   Kills: ${this.planesShotDown}${bossText}`);
  }

  drawCountryside(dt) {
    const { width, height } = this.scale;

    this.terrainGfx.clear();
    this.terrainGfx.fillStyle(0x6fb658, 1);
    this.terrainGfx.fillRect(0, 0, width, height);

    for (const tile of this.farmlandTiles) {
      tile.y += tile.v * dt;
      if (tile.y > height + tile.h) {
        tile.y = -tile.h - Phaser.Math.Between(0, 100);
        tile.x = Math.random() * (width + 220) - 110;
      }

      this.terrainGfx.fillStyle(tile.color, 0.9);
      this.terrainGfx.fillRect(tile.x, tile.y, tile.w, tile.h);

      this.terrainGfx.lineStyle(2, 0x4f742e, 0.35);
      this.terrainGfx.strokeRect(tile.x + 2, tile.y + 2, tile.w - 4, tile.h - 4);
    }

    this.roadGfx.clear();
    this.roadGfx.fillStyle(0x7b705f, 0.85);
    this.roadGfx.fillRect(width * 0.46, 0, width * 0.08, height);

    this.roadGfx.fillStyle(0xe5d28e, 0.95);
    for (const m of this.roadMarkers) {
      m.y += m.v * dt;
      if (m.y > height + m.h) m.y = -m.h;
      this.roadGfx.fillRect(m.x, m.y, m.w, m.h);
    }

    this.cloudGfx.clear();
    for (const c of this.clouds) {
      c.y += c.v * dt;
      if (c.y > height + c.r * 3) {
        c.y = -c.r * 3;
        c.x = Math.random() * width;
      }
      this.cloudGfx.fillStyle(0xffffff, c.alpha);
      this.cloudGfx.fillCircle(c.x, c.y, c.r);
      this.cloudGfx.fillCircle(c.x + c.r * 0.7, c.y + 2, c.r * 0.8);
      this.cloudGfx.fillCircle(c.x - c.r * 0.8, c.y + 4, c.r * 0.7);
    }
  }

  shoot() {
    const now = this.time.now;
    if (now - this.lastShotAt < this.fireCooldownMs) return;
    this.lastShotAt = now;

    const spread = this.score >= 2500 ? 14 : 0;
    const makeShot = (offsetX, velocityY) => {
      const b = this.add.image(this.player.x + offsetX, this.player.y - 54, "treat");
      b.setDisplaySize(22, 28);
      b.vy = velocityY;
      b.vx = offsetX * 2.2;
      this.bullets.push(b);
    };

    makeShot(0, -750);
    if (spread !== 0) {
      makeShot(-spread, -710);
      makeShot(spread, -710);
    }
  }

  spawnFormation() {
    if (this.boss) return;

    const { width } = this.scale;
    const count = Phaser.Math.Between(2, 5);
    const baseX = Phaser.Math.Between(120, width - 120);
    const spacing = Phaser.Math.Between(58, 85);
    const swayMag = Phaser.Math.Between(30, 110);
    const swaySpeed = 1.8 + Math.random() * 2.8;

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const e = this.add.image(baseX + offset, -120 - i * 30, "enemy");
      e.setDisplaySize(100, 100);
      e.baseX = e.x;
      e.vy = Phaser.Math.Between(130, 210) + this.distance * 0.02;
      e.swayMag = swayMag;
      e.swaySpeed = swaySpeed;
      e.swayOffset = Math.random() * Math.PI * 2;
      e.fireAt = this.time.now + Phaser.Math.Between(900, 2600);
      this.enemies.push(e);
    }
  }

  spawnBoss() {
    if (this.boss) return;

    for (const e of this.enemies) e.destroy();
    this.enemies = [];

    const { width } = this.scale;
    const textureKey = this.textures.exists("boss") ? "boss" : "enemy";
    const boss = this.add.image(width / 2, -140, textureKey).setDepth(40);
    boss.setDisplaySize(220, 220);
    boss.hp = 20;
    boss.vy = 70;
    boss.swayMag = 160;
    boss.swaySpeed = 1.4;
    boss.fireAt = this.time.now + 900;

    if (textureKey === "enemy") {
      boss.setTint(0xffd166);
    }

    this.boss = boss;
    this.overText.setText("BOSS INCOMING");
    this.time.delayedCall(1000, () => {
      if (!this.gameOver) this.overText.setText("");
    });
    this.updateUI();
  }

  enemyShoot(shooter, isBoss = false) {
    const b = this.add.image(shooter.x, shooter.y + 44, "treat");
    b.setDisplaySize(isBoss ? 20 : 16, isBoss ? 25 : 20);
    b.setTint(isBoss ? 0xff3d3d : 0xff6f6f);
    const aimX = (this.player.x - shooter.x) * (isBoss ? 0.9 : 0.6);
    b.vx = Phaser.Math.Clamp(aimX, -240, 240);
    b.vy = (isBoss ? 340 : 280) + Math.random() * 120;
    this.enemyBullets.push(b);
  }

  spawnExplosion(x, y, size = 40) {
    const burst = this.add.container(x, y).setDepth(80);

    for (let i = 0; i < 12; i++) {
      const dot = this.add.circle(0, 0, Phaser.Math.Between(3, 8), Phaser.Utils.Array.GetRandom([0xfff2a1, 0xffa63d, 0xff5b2e]));
      burst.add(dot);

      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(size * 0.4, size * 1.3);

      this.tweens.add({
        targets: dot,
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.4,
        duration: 320 + Math.random() * 220,
        ease: "Cubic.Out"
      });
    }

    this.tweens.add({
      targets: burst,
      alpha: 0,
      duration: 550,
      onComplete: () => burst.destroy()
    });

    this.cameras.main.shake(90, size > 70 ? 0.005 : 0.002);
  }

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

  hitPlayer() {
    if (this.time.now < this.invulnUntil) return;

    this.lives -= 1;
    this.invulnUntil = this.time.now + 1300;

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
    this.scene.start("gameover", {
        score: this.score,
        distance: this.distance,
        kills: this.planesShotDown
      });
      
    }
  }

  restart() {
    this.scene.restart();
  }

  update(time, delta) {
    const { width, height } = this.scale;
    const dt = delta / 1000;

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.restart();
      return;
    }

    this.drawCountryside(dt);

    if (this.gameOver) return;

    this.distance += dt * 95;

    this.spawnTimerMs += delta;
    if (this.spawnTimerMs >= this.spawnEveryMs) {
      this.spawnTimerMs = 0;
      this.spawnFormation();
      this.spawnEveryMs = Math.max(330, this.spawnEveryMs * 0.992);
    }

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
    this.player.y = Phaser.Math.Clamp(this.player.y + my * this.playerSpeed * dt, height * 0.46, height - 40);

    const wantShoot = this.cursors.space.isDown || this.keys.SPACE.isDown || this.touch.shoot;
    if (wantShoot) this.shoot();

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
      if (b.y < -90 || b.x < -50 || b.x > width + 50) {
        b.destroy();
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (this.overlaps(b, this.player)) {
        b.destroy();
        this.enemyBullets.splice(i, 1);
        this.hitPlayer();
        continue;
      }

      if (b.y > height + 40 || b.x < -50 || b.x > width + 50) {
        b.destroy();
        this.enemyBullets.splice(i, 1);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.y += e.vy * dt;
      e.x = e.baseX + Math.sin((time / 1000) * e.swaySpeed + e.swayOffset) * e.swayMag;

      /*
      if (time >= e.fireAt) {
        this.enemyShoot(e, false);
        e.fireAt = time + Phaser.Math.Between(1100, 2400);
      }
*/
      if (e.y > height + 130) {
        e.destroy();
        this.enemies.splice(i, 1);
        this.score += 20;
        this.updateUI();
        continue;
      }

      if (this.overlaps(e, this.player)) {
        this.spawnExplosion(e.x, e.y, 42);
        e.destroy();
        this.enemies.splice(i, 1);
        this.hitPlayer();
      }
    }

    if (this.boss) {
      const boss = this.boss;
      if (boss.y < 130) {
        boss.y += boss.vy * dt;
      } else {
        boss.y = 130 + Math.sin(time / 900) * 14;
      }
      boss.x = width / 2 + Math.sin(time / 1000 * boss.swaySpeed) * boss.swayMag;

      if (time >= boss.fireAt) {
        this.enemyShoot(boss, true);
        this.enemyShoot({ x: boss.x - 60, y: boss.y + 10 }, true);
        this.enemyShoot({ x: boss.x + 60, y: boss.y + 10 }, true);
        boss.fireAt = time + Phaser.Math.Between(650, 1200);
      }

      if (this.overlaps(boss, this.player)) {
        this.hitPlayer();
      }
    }

    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const e = this.enemies[ei];
      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        const b = this.bullets[bi];
        if (this.overlaps(e, b)) {
          this.spawnExplosion(e.x, e.y, 45);
          e.destroy();
          b.destroy();
          this.enemies.splice(ei, 1);
          this.bullets.splice(bi, 1);
          this.score += 100;
          this.planesShotDown += 1;
          this.updateUI();
          break;
        }
      }
    }

    if (this.boss) {
      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        const b = this.bullets[bi];
        if (this.overlaps(this.boss, b)) {
          b.destroy();
          this.bullets.splice(bi, 1);
          this.boss.hp -= 1;
          this.score += 120;
          this.spawnExplosion(b.x, b.y, 24);

          if (this.boss.hp <= 0) {
            this.spawnExplosion(this.boss.x, this.boss.y, 95);
            this.score += 2500;
            this.boss.destroy();
            this.boss = null;
            this.nextBossAt += 20;
          }

          this.updateUI();
          if (!this.boss) break;
        }
      }
    }

    if (!this.boss && this.planesShotDown >= this.nextBossAt) {
      this.spawnBoss();
    }

    if (this.distance >= this.nextDistanceScore) {
      this.nextDistanceScore += 25;
      this.score += 25;
      this.updateUI();
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 900,
  height: 600,
  backgroundColor: "#7eb9ee",
  scene: [TitleScene, MainScene],
  scene: [TitleScene, MainScene, GameOverScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
});
