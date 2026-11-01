/**
 * RALLY-X / NEW RALLY-X (엑스 렐리 · 방구차) - Authentic Retro Arcade Recreation
 * Features:
 * - Multi-directional scrolling maze with guaranteed zero dead-ends and smooth cornering
 * - Right-side Arcade HUD with 1UP, HIGH SCORE, FUEL gauge, Live RADAR mini-map, Lives & Round flags
 * - 10 Yellow Flags (100~1000 pts), Special Flag (S - doubles subsequent flag values), Lucky Flag (L)
 * - Authentic 8-bit Pixel-Art Smoke Screen ("방구") trail that costs fuel and spins out Red Cars
 * - Web Audio API Chiptune Synthesizer playing the iconic Rally-X ("방구차") BGM & SFX
 * - Interactive 4-Way Arcade Ball-Top Joystick & Push Buttons + Color / B&W CRT Monitor Switch
 */

(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // --- Map & Viewport Dimensions ---
  const TILE = 32;
  const MAP_COLS = 29;
  const MAP_ROWS = 45;
  const WORLD_W = MAP_COLS * TILE; // 928
  const WORLD_H = MAP_ROWS * TILE; // 1440

  const VIEW_W = 448; // 14 tiles wide viewport
  const VIEW_H = 448; // 14 tiles high viewport
  const HUD_X = 448;
  const HUD_W = 160;

  // Directions: 0=UP, 1=RIGHT, 2=DOWN, 3=LEFT
  const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const OPPOSITE = [2, 3, 0, 1];

  // Tile types
  const T_ROAD = 0;
  const T_WALL = 1;
  const T_BORDER = 2;
  const T_START = 3;

  // --- Classic Rally-X 29x45 Maze Blueprint ---
  // Every road '.' is on a clean connected grid with ZERO dead-ends or pockets!
  // '#' = outer border, 'X' = hedge/wall block, '.' = road, 'S' = start/checkpoint zone
  const RAW_MAZE = [
    "#############################",
    "#.............X.............#",
    "#.XXXXX.XXXXX.X.XXXXX.XXXXX.#",
    "#.....X.X...X...X...X.X.....#",
    "#.XXX.X.X.X.XXXXX.X.X.X.XXX.#",
    "#...X.....X...X...X.....X...#",
    "#.X.XXXXX.XXX.X.XXX.XXXXX.X.#",
    "#.X.....X.....X.....X.....X.#",
    "#.XXXXX.XXXXX.X.XXXXX.XXXXX.#",
    "#...X.....X.......X.....X...#",
    "#.X.X.XXX.X.XXXXX.X.XXX.X.X.#",
    "#.X...X...X...X...X...X...X.#",
    "#.XXXXX.XXXXX.X.XXXXX.XXXXX.#",
    "#.......X.....X.....X.......#",
    "#.XXXXX.X.XXXX.XXXX.X.XXXXX.#",
    "#.X...X.......X.......X...X.#",
    "#.X.X.XXXXXXX.X.XXXXXXX.X.X.#",
    "#...X...X.....X.....X...X...#",
    "#.XXXXX.X.XXX.X.XXX.X.XXXXX.#",
    "#.X.....X.X.......X.X.....X.#",
    "#.X.XXXXX.X.XXXXX.X.XXXXX.X.#",
    "#.....X.....X...X.....X.....#",
    "#.XXX.X.XXXXX.X.XXXXX.X.XXX.#",
    "#.X...X...X...X...X...X...X.#",
    "#.X.XXXXX.X.XXXXX.X.XXXXX.X.#",
    "#...X.....X.......X.....X...#",
    "#.XXX.XXX.XXXX.XXXX.XXX.XXX.#",
    "#.....X.......X.......X.....#",
    "#.XXXXX.XXXXX.X.XXXXX.XXXXX.#",
    "#.X.....X.....X.....X.....X.#",
    "#.X.XXXXX.XXX.X.XXX.XXXXX.X.#",
    "#...X.....X...X...X.....X...#",
    "#.XXX.X.X.X.XXXXX.X.X.X.XXX.#",
    "#.....X.X...X...X...X.X.....#",
    "#.XXXXX.XXXXX.X.XXXXX.XXXXX.#",
    "#.......X.....X.....X.......#",
    "#.XXXXX.X.XXX.S.XXX.X.XXXXX.#",
    "#.X...X...X...S...X...X...X.#",
    "#.X.X.XXXXX.X.S.X.XXXXX.X.X.#",
    "#...X.......X.S.X.......X...#",
    "#.XXXXXXXXX.X.S.X.XXXXXXXXX.#",
    "#.X.........X.S.X.........X.#",
    "#.X.XXXXXXXXX.S.XXXXXXXXX.X.#",
    "#.............S.............#",
    "#############################"
  ];

  // Parse maze and sanitize any accidental 1-neighbor dead-ends so cars NEVER get trapped
  const maze = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row = [];
    const str = RAW_MAZE[r];
    for (let c = 0; c < MAP_COLS; c++) {
      const ch = str[c];
      if (ch === '#') row.push(T_BORDER);
      else if (ch === 'X') row.push(T_WALL);
      else if (ch === 'S') row.push(T_START);
      else row.push(T_ROAD);
    }
    maze.push(row);
  }

  function isWalkable(col, row) {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
    const t = maze[row][col];
    return t === T_ROAD || t === T_START;
  }

  // Ensure zero dead-ends anywhere in the maze
  for (let pass = 0; pass < 3; pass++) {
    for (let r = 1; r < MAP_ROWS - 1; r++) {
      for (let c = 1; c < MAP_COLS - 1; c++) {
        if (!isWalkable(c, r)) continue;
        let openCount = 0;
        for (let d = 0; d < 4; d++) {
          if (isWalkable(c + DX[d], r + DY[d])) openCount++;
        }
        if (openCount < 2) {
          // Open a neighbor wall (not border)
          for (let d = 0; d < 4; d++) {
            const nc = c + DX[d];
            const nr = r + DY[d];
            if (nc > 0 && nc < MAP_COLS - 1 && nr > 0 && nr < MAP_ROWS - 1 && maze[nr][nc] === T_WALL) {
              maze[nr][nc] = T_ROAD;
              break;
            }
          }
        }
      }
    }
  }

  // --- Exact Arcade MIDI Data (Extracted from Original Rally-X / New Rally-X Arcade MIDIs) ---
  const GS_LEAD = [[64,0,60],[66,60,30],[69,90,60],[73,150,90],[69,240,30],[66,270,30],[64,360,60],[66,420,30],[69,450,60],[72,510,90],[69,600,30],[66,630,30],[64,720,60],[66,780,30],[69,810,60],[73,870,90],[69,960,30],[73,990,60],[74,1050,30],[76,1080,60],[74,1140,30],[73,1170,60],[69,1230,30],[73,1260,60],[69,1320,90]];
  const GS_BASS = [[40,0,60],[52,150,60],[49,150,60],[40,360,60],[52,480,30],[48,480,30],[40,720,60],[52,870,60],[49,870,60],[52,1080,60],[50,1140,30],[49,1170,60],[45,1230,30],[49,1260,60],[45,1320,90]];
  const RX_LEAD = [[81,0,56],[81,60,56],[78,120,56],[76,180,56],[81,240,56],[84,360,116],[81,480,56],[81,540,56],[78,600,56],[76,660,56],[81,720,56],[78,840,116],[81,960,56],[81,1020,56],[78,1080,56],[76,1140,56],[81,1200,56],[84,1260,56],[86,1320,56],[87,1380,56],[88,1440,56],[87,1500,30],[88,1530,30],[87,1560,30],[88,1590,30],[87,1620,30],[88,1650,28],[88,1680,90],[88,1800,30],[86,1830,30],[85,1860,30],[83,1890,30],[81,1920,56],[81,1980,56],[78,2040,56],[76,2100,56],[81,2160,56],[84,2280,116],[81,2400,56],[81,2460,56],[78,2520,56],[76,2580,56],[81,2640,56],[78,2760,116],[81,2880,56],[81,2940,56],[78,3000,56],[76,3060,56],[81,3120,56],[84,3180,56],[86,3240,56],[87,3300,56],[93,3360,56],[88,3420,30],[86,3450,30],[85,3480,56],[81,3540,56],[79,3600,56],[80,3660,56],[81,3720,56],[86,3840,12],[88,3850,104],[85,3960,56],[88,4020,56],[90,4080,56],[85,4140,56],[88,4200,56],[90,4260,56],[85,4320,56],[83,4380,56],[81,4440,56],[78,4500,56],[81,4560,236],[78,4800,56],[81,4860,56],[83,4920,56],[81,4980,56],[85,5040,56],[83,5100,56],[81,5160,56],[83,5220,56],[85,5280,56],[81,5340,116],[78,5460,56],[76,5520,236],[86,5760,12],[88,5770,104],[85,5880,56],[88,5940,56],[90,6000,56],[85,6060,56],[88,6120,56],[90,6180,56],[85,6240,56],[83,6300,56],[81,6360,56],[78,6420,56],[81,6480,236],[78,6720,56],[81,6780,56],[83,6840,56],[81,6900,56],[85,6960,56],[83,7020,56],[81,7080,56],[83,7140,56],[85,7200,56],[81,7260,116],[78,7380,56],[76,7440,236],[81,7680,56],[79,7740,56],[76,7800,56],[81,7860,56],[80,7920,56],[76,7980,56],[74,8040,56],[76,8100,56],[74,8160,56],[72,8220,56],[69,8280,56],[74,8340,56],[73,8400,56],[69,8460,174],[74,8640,56],[72,8700,56],[69,8760,56],[67,8820,56],[69,8880,56],[72,8940,56],[74,9000,56],[75,9060,56],[76,9120,56],[80,9180,56],[76,9240,56],[74,9300,56],[73,9360,236],[81,9600,56],[79,9660,56],[76,9720,56],[81,9780,56],[80,9840,56],[76,9900,56],[74,9960,56],[76,10020,56],[74,10080,56],[72,10140,56],[69,10200,56],[74,10260,56],[73,10320,56],[69,10380,174],[74,10560,56],[72,10620,56],[69,10680,56],[67,10740,56],[69,10800,56],[72,10860,56],[74,10920,56],[75,10980,56],[76,11040,56],[80,11100,56],[76,11160,56],[74,11220,56],[73,11280,236],[86,11520,12],[88,11530,104],[85,11640,56],[88,11700,56],[90,11760,56],[85,11820,56],[88,11880,56],[90,11940,56],[85,12000,56],[83,12060,56],[81,12120,56],[78,12180,56],[81,12240,236],[78,12480,56],[81,12540,56],[83,12600,56],[81,12660,56],[85,12720,56],[83,12780,56],[81,12840,56],[83,12900,56],[85,12960,56],[81,13020,116],[78,13140,56],[76,13200,236],[86,13440,12],[88,13450,104],[85,13560,56],[88,13620,56],[90,13680,56],[85,13740,56],[88,13800,56],[90,13860,56],[85,13920,56],[83,13980,56],[81,14040,56],[78,14100,56],[81,14160,236],[78,14400,56],[81,14460,56],[83,14520,56],[81,14580,56],[85,14640,56],[83,14700,56],[81,14760,56],[83,14820,56],[85,14880,56],[81,14940,116],[78,15060,56],[76,15120,236]];
  const RX_BASS = [[38,0,56],[38,60,56],[38,120,56],[38,180,56],[38,240,56],[38,300,56],[38,360,56],[38,420,56],[38,480,56],[38,540,56],[38,600,56],[38,660,56],[38,720,56],[38,780,56],[38,840,56],[38,900,56],[38,960,56],[38,1020,56],[38,1080,56],[38,1140,56],[38,1200,56],[38,1260,56],[38,1320,56],[38,1380,56],[33,1440,56],[33,1500,56],[33,1560,56],[33,1620,114],[33,1740,56],[35,1800,56],[37,1860,56],[38,1920,56],[38,1980,56],[38,2040,56],[38,2100,56],[38,2160,56],[38,2220,56],[38,2280,56],[38,2340,56],[38,2400,56],[38,2460,56],[38,2520,56],[38,2580,56],[38,2640,56],[38,2700,56],[38,2760,56],[38,2820,56],[38,2880,56],[38,2940,56],[38,3000,56],[38,3060,56],[38,3120,56],[38,3180,56],[38,3240,56],[38,3300,56],[33,3360,56],[33,3420,56],[33,3480,56],[33,3540,114],[33,3660,56],[33,3720,56],[33,3780,56],[33,3840,56],[33,3900,56],[33,3960,56],[33,4020,56],[33,4080,56],[33,4140,56],[33,4200,56],[33,4260,56],[33,4320,56],[33,4380,56],[33,4440,56],[33,4500,56],[33,4560,56],[33,4620,56],[33,4680,56],[33,4740,56],[38,4800,56],[38,4860,56],[38,4920,56],[38,4980,56],[38,5040,56],[38,5100,56],[38,5160,56],[38,5220,56],[33,5280,56],[33,5340,56],[33,5400,56],[33,5460,56],[33,5520,56],[33,5580,56],[33,5640,56],[33,5700,56],[33,5760,56],[33,5820,56],[33,5880,56],[33,5940,56],[33,6000,56],[33,6060,56],[33,6120,56],[33,6180,56],[33,6240,56],[33,6300,56],[33,6360,56],[33,6420,56],[33,6480,56],[33,6540,56],[33,6600,56],[33,6660,56],[38,6720,56],[38,6780,56],[38,6840,56],[38,6900,56],[38,6960,56],[38,7020,56],[38,7080,56],[38,7140,56],[33,7200,56],[33,7260,56],[33,7320,56],[33,7380,56],[33,7440,56],[33,7500,56],[33,7560,56],[33,7620,56],[33,7680,56],[33,7740,56],[33,7800,56],[33,7860,56],[33,7920,56],[33,7980,56],[33,8040,56],[33,8100,56],[33,8160,56],[33,8220,56],[33,8280,56],[33,8340,56],[33,8400,56],[33,8460,56],[33,8520,56],[33,8580,56],[38,8640,56],[38,8700,56],[38,8760,56],[38,8820,56],[38,8880,56],[38,8940,56],[38,9000,56],[38,9060,56],[33,9120,56],[33,9180,56],[33,9240,56],[33,9300,56],[33,9360,56],[33,9420,56],[33,9480,56],[33,9540,56],[33,9600,56],[33,9660,56],[33,9720,56],[33,9780,56],[33,9840,56],[33,9900,56],[33,9960,56],[33,10020,56],[33,10080,56],[33,10140,56],[33,10200,56],[33,10260,56],[33,10320,56],[33,10380,56],[33,10440,56],[33,10500,56],[38,10560,56],[38,10620,56],[38,10680,56],[38,10740,56],[38,10800,56],[38,10860,56],[38,10920,56],[38,10980,56],[33,11040,56],[33,11100,56],[33,11160,56],[33,11220,56],[33,11280,56],[33,11340,56],[33,11400,56],[33,11460,56],[33,11520,56],[33,11580,56],[33,11640,56],[33,11700,56],[33,11760,56],[33,11820,56],[33,11880,56],[33,11940,56],[33,12000,56],[33,12060,56],[33,12120,56],[33,12180,56],[33,12240,56],[33,12300,56],[33,12360,56],[33,12420,56],[38,12480,56],[38,12540,56],[38,12600,56],[38,12660,56],[38,12720,56],[38,12780,56],[38,12840,56],[38,12900,56],[33,12960,56],[33,13020,56],[33,13080,56],[33,13140,56],[33,13200,56],[33,13260,56],[33,13320,56],[33,13380,56],[33,13440,56],[33,13500,56],[33,13560,56],[33,13620,56],[33,13680,56],[33,13740,56],[33,13800,56],[33,13860,56],[33,13920,56],[33,13980,56],[33,14040,56],[33,14100,56],[33,14160,56],[33,14220,56],[33,14280,56],[33,14340,56],[38,14400,56],[38,14460,56],[38,14520,56],[38,14580,56],[38,14640,56],[38,14700,56],[38,14760,56],[38,14820,56],[33,14880,56],[33,14940,56],[33,15000,56],[33,15060,56],[33,15120,56],[33,15180,56],[33,15240,56],[33,15300,56]];

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // --- Web Audio API Chiptune Sound Engine (100% Original Arcade MIDI Sequencer) ---
  class ArcadeAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.bgmTimer = null;
      this.isPlayingBgm = false;
      // 0 = New Rally-X ("방구차/사다리타기" famous chorus: ticks 3840..11520)
      // 1 = 1980 Original Rally-X ("딴-딴-따-라-딴! 딴!": ticks 0..3840)
      // 2 = Full Arcade Medley (ticks 0..15360)
      this.bgmMode = 0;
      this.activeNodes = [];
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    stopAllScheduled() {
      for (const node of this.activeNodes) {
        try { node.stop(); } catch (e) {}
      }
      this.activeNodes = [];
    }

    scheduleNoteAt(freq, startTime, duration, type = 'square', vol = 0.11) {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      const safeDur = Math.max(0.02, duration);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.004);
      gain.gain.setValueAtTime(vol * 0.85, startTime + safeDur * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + safeDur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + safeDur + 0.01);
      this.activeNodes.push(osc);
      osc.onended = () => {
        const idx = this.activeNodes.indexOf(osc);
        if (idx !== -1) this.activeNodes.splice(idx, 1);
      };
    }

    playTone(freq, duration, type = 'square', vol = 0.12, slideTo = null) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      }
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    }

    playNoise(duration, vol = 0.2, filterFreq = 800) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.Q.setValueAtTime(2.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    sfxCoin() {
      this.init();
      this.playTone(987.77, 0.08, 'square', 0.16);
      setTimeout(() => this.playTone(1318.51, 0.28, 'square', 0.16), 80);
    }

    // Authentic 1980 Namco Rally-X Game Start Fanfare (from gamestart.mid)
    sfxRoundStart() {
      this.stopBgm();
      this.stopAllScheduled();
      this.init();
      if (!this.enabled || !this.ctx) return;

      const now = this.ctx.currentTime + 0.03;
      const secPerTick = 60 / (165 * 120); // ~3.03ms per tick

      for (const [note, startTick, durTick] of GS_LEAD) {
        const st = now + startTick * secPerTick;
        const dur = durTick * secPerTick;
        this.scheduleNoteAt(midiToFreq(note), st, dur, 'square', 0.12);
        this.scheduleNoteAt(midiToFreq(note + 12), st, dur, 'triangle', 0.05);
      }

      for (const [note, startTick, durTick] of GS_BASS) {
        const st = now + startTick * secPerTick;
        const dur = durTick * secPerTick;
        this.scheduleNoteAt(midiToFreq(note + 12), st, dur, 'triangle', 0.11);
      }
    }

    // Authentic Rally-X "방구" (Smoke Puff) rhythmic chiptune sound
    sfxSmokePuff(puffIndex = 0) {
      this.init();
      const baseFreq = 240 - puffIndex * 30;
      this.playNoise(0.11, 0.24, 420 - puffIndex * 40);
      this.playTone(baseFreq, 0.11, 'sawtooth', 0.16, 85);
    }

    sfxFlag(isSpecial = false) {
      this.init();
      if (isSpecial) {
        const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        chord.forEach((f, idx) => {
          setTimeout(() => this.playTone(f, 0.14, 'square', 0.15), idx * 55);
        });
      } else {
        this.playTone(659.25, 0.08, 'square', 0.14);
        setTimeout(() => this.playTone(987.77, 0.16, 'square', 0.14), 75);
      }
    }

    sfxDizzy() {
      this.init();
      this.playTone(520, 0.09, 'triangle', 0.12, 880);
      setTimeout(() => this.playTone(880, 0.09, 'triangle', 0.12, 520), 90);
    }

    sfxBang() {
      this.stopBgm();
      this.stopAllScheduled();
      this.init();
      this.playNoise(0.55, 0.35, 220);
      this.playTone(150, 0.5, 'sawtooth', 0.22, 35);
    }

    sfxRoundClear() {
      this.stopBgm();
      this.stopAllScheduled();
      this.init();
      const notes = [
        [523.25, 120], [659.25, 120], [783.99, 120], [1046.5, 260],
        [783.99, 120], [1046.5, 420]
      ];
      let t = 0;
      notes.forEach(([f, d]) => {
        setTimeout(() => this.playTone(f, d / 1000, 'square', 0.15), t);
        t += d + 20;
      });
    }

    // Precision Lookahead Sequencer for Authentic Rally-X & New Rally-X BGM
    startBgm(isChallenging = false) {
      this.stopBgm();
      this.stopAllScheduled();
      this.init();
      if (!this.ctx) return;

      this.isPlayingBgm = true;

      // Determine tick loop boundaries based on selected BGM mode:
      // Mode 0: New Rally-X ("방구차/사다리타기" main chorus: 3840..11520)
      // Mode 1: 1980 Original Rally-X ("딴-딴-따-라-딴! 딴!": 0..3840)
      // Mode 2: Complete Arcade Medley (0..15360)
      let loopStart = 3840;
      let loopEnd = 11520;
      if (this.bgmMode === 1) {
        loopStart = 0;
        loopEnd = 3840;
      } else if (this.bgmMode === 2) {
        loopStart = 0;
        loopEnd = 15360;
      }

      const loopLen = loopEnd - loopStart;
      const bpm = isChallenging ? 162 : 150;
      const secPerTick = 60 / (bpm * 120);

      let currentTick = loopStart;
      let nextTickTime = this.ctx.currentTime + 0.04;
      const stepTicks = 6; // 20ms granularity (handles 12-tick grace notes & 30-tick trills cleanly!)

      this.bgmTimer = setInterval(() => {
        if (!this.enabled || !this.isPlayingBgm || !this.ctx) return;

        const now = this.ctx.currentTime;
        if (nextTickTime < now - 0.1) {
          nextTickTime = now;
        }

        // Schedule 120ms ahead
        while (nextTickTime < now + 0.12) {
          const windowStart = currentTick;
          const windowEnd = currentTick + stepTicks;

          // Lead Melody + Namco WSG Sub-Octave Voice
          for (let i = 0; i < RX_LEAD.length; i++) {
            const [note, s, d] = RX_LEAD[i];
            if (s >= windowStart && s < windowEnd && s >= loopStart && s < loopEnd) {
              const offsetSec = (s - windowStart) * secPerTick;
              const durSec = d * secPerTick;
              // Original MIDI Track 1 is 1 octave high (A5..F#6); play main voice at note-12 (A4..F#5) + bright harmonic at note
              this.scheduleNoteAt(midiToFreq(note - 12), nextTickTime + offsetSec, durSec, 'square', 0.11);
              this.scheduleNoteAt(midiToFreq(note), nextTickTime + offsetSec, durSec, 'square', 0.045);
            }
          }

          // Driving Arcade Bassline
          for (let i = 0; i < RX_BASS.length; i++) {
            const [note, s, d] = RX_BASS[i];
            if (s >= windowStart && s < windowEnd && s >= loopStart && s < loopEnd) {
              const offsetSec = (s - windowStart) * secPerTick;
              const durSec = d * secPerTick;
              // Shift bass up 1 octave from MIDI (D2/A1 -> D3/A2) so it punches clearly on laptop/phone speakers
              this.scheduleNoteAt(midiToFreq(note + 12), nextTickTime + offsetSec, durSec, 'triangle', 0.13);
              this.scheduleNoteAt(midiToFreq(note + 24), nextTickTime + offsetSec, durSec * 0.6, 'square', 0.035);
            }
          }

          nextTickTime += stepTicks * secPerTick;
          currentTick += stepTicks;
          if (currentTick >= loopEnd) {
            currentTick = loopStart + (currentTick - loopEnd);
          }
        }
      }, 25);
    }

    stopBgm() {
      this.isPlayingBgm = false;
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
    }
  }

  const audio = new ArcadeAudio();

  // --- Game State ---
  const STATE = {
    TITLE: 'TITLE',
    READY: 'READY',
    PLAYING: 'PLAYING',
    CRASHED: 'CRASHED',
    ROUND_CLEAR: 'ROUND_CLEAR',
    GAME_OVER: 'GAME_OVER'
  };

  let gameState = STATE.TITLE;
  let stateTimer = 0;
  let paused = false;

  let score = 0;
  let highScore = 20000;
  let credits = 2;
  let lives = 3;
  let round = 1;
  let fuel = 100;
  let specialMultiplier = 1;
  let flagsCollectedCount = 0;
  let frameCount = 0;

  // Entities
  let player = null;
  let enemies = [];
  let flags = [];
  let rocks = [];
  let smokes = [];
  let popups = [];

  // Camera
  let camX = 0;
  let camY = 0;

  // Input state
  let desiredDir = DIR.UP;
  let activeKeyDirs = new Set();

  function addPopup(x, y, text, color = '#ffd60a', duration = 55) {
    popups.push({ x, y, text, color, timer: duration });
  }

  // --- Setup Round ---
  function setupRound(resetFlagsAndRocks = true) {
    specialMultiplier = 1;
    fuel = 100;
    smokes = [];
    popups = [];

    // Player starts at the center checkpoint highway (col 14, row 39) facing UP
    // Ahead (rows 38..1) is a long straight road with plenty of intersections!
    player = {
      x: 14 * TILE + TILE / 2,
      y: 39 * TILE + TILE / 2,
      dir: DIR.UP,
      speed: 2.9,
      smokeEmitFrames: 0, // Active frames remaining while puffing smoke trail
      smokeCooldown: 0,
      invincibleTimer: 90 // 1.5s start safety so enemies never spawn-kill player
    };
    desiredDir = DIR.UP;

    // Red Enemy Pursuit Cars start down at row 43 (bottom highway), well below the player
    const isChallenging = (round % 3 === 0);
    const numEnemies = Math.min(2 + round, 6);
    enemies = [];

    const enemySpawnCols = [14, 12, 16, 10, 18, 8];
    for (let i = 0; i < numEnemies; i++) {
      const sc = enemySpawnCols[i % enemySpawnCols.length];
      enemies.push({
        x: sc * TILE + TILE / 2,
        y: 43 * TILE + TILE / 2,
        dir: DIR.UP,
        speed: 2.75 + Math.min((round - 1) * 0.08, 0.45),
        dizzyTimer: 0,
        releaseDelay: 35 + i * 45, // Staggered release after player drives off
        frozen: isChallenging
      });
    }

    if (resetFlagsAndRocks) {
      flagsCollectedCount = 0;
      flags = [];
      rocks = [];

      // Collect valid road tiles away from the starting zone
      const candidates = [];
      for (let r = 1; r < MAP_ROWS - 9; r++) {
        for (let c = 1; c < MAP_COLS - 1; c++) {
          if (maze[r][c] === T_ROAD) {
            // Do not place right in front of the player's starting column 14 below row 30
            if (c === 14 && r > 28) continue;
            candidates.push({ c, r });
          }
        }
      }

      // Shuffle candidates
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      // Pick 10 well-spaced flags
      const chosen = [];
      for (const cand of candidates) {
        if (chosen.length >= 10) break;
        const tooClose = chosen.some(f => Math.hypot(f.c - cand.c, f.r - cand.r) < 5.5);
        if (!tooClose) chosen.push(cand);
      }

      chosen.forEach((pos, idx) => {
        flags.push({
          c: pos.c,
          r: pos.r,
          x: pos.c * TILE + TILE / 2,
          y: pos.r * TILE + TILE / 2,
          collected: false,
          isSpecial: idx === 0, // 'S' Flag (Score x2)
          isLucky: idx === 1    // 'L' Flag (Fuel Bonus)
        });
      });

      // Place Rocks ONLY on tiles with >= 3 open neighbors far from start & flags so paths stay open
      const numRocks = Math.min(1 + round, 6);
      for (const cand of candidates) {
        if (rocks.length >= numRocks) break;
        if (cand.r > 32 || cand.c === 14) continue; // Never block center start highway!
        const nearFlag = flags.some(f => Math.abs(f.c - cand.c) <= 2 && Math.abs(f.r - cand.r) <= 2);
        if (nearFlag) continue;

        let openNeighbors = 0;
        for (let d = 0; d < 4; d++) {
          if (isWalkable(cand.c + DX[d], cand.r + DY[d])) openNeighbors++;
        }
        if (openNeighbors >= 3) {
          const tooCloseRock = rocks.some(rk => Math.hypot(rk.c - cand.c, rk.r - cand.r) < 7);
          if (!tooCloseRock) {
            rocks.push({
              c: cand.c,
              r: cand.r,
              x: cand.c * TILE + TILE / 2,
              y: cand.r * TILE + TILE / 2
            });
          }
        }
      }
    }

    updateCamera();
  }

  function startNewGame() {
    if (credits <= 0) credits = 1;
    credits--;
    updateCreditUI();

    score = 0;
    lives = 3;
    round = 1;
    setupRound(true);
    enterReadyState();
  }

  function enterReadyState() {
    gameState = STATE.READY;
    stateTimer = 250;
    audio.stopBgm();
    audio.sfxRoundStart();
  }

  // --- Smooth Grid Corridor Movement (Never Reverses 180° on Walls!) ---
  function moveEntityOnGrid(entity, targetDir, isPlayer = false) {
    const speed = entity.speed;
    const col = Math.floor(entity.x / TILE);
    const row = Math.floor(entity.y / TILE);
    const centerX = col * TILE + TILE / 2;
    const centerY = row * TILE + TILE / 2;

    // 1. Player explicitly pressed the 180-degree opposite direction -> Reverse immediately
    if (isPlayer && targetDir === OPPOSITE[entity.dir]) {
      entity.dir = targetDir;
    } else if (targetDir !== entity.dir) {
      // 2. 90-degree buffered turn when near tile center and target corridor is open
      const nextCol = col + DX[targetDir];
      const nextRow = row + DY[targetDir];
      const distToCenter = Math.hypot(entity.x - centerX, entity.y - centerY);
      if (distToCenter <= speed + 5.5 && isWalkable(nextCol, nextRow)) {
        entity.x = centerX;
        entity.y = centerY;
        entity.dir = targetDir;
      }
    }

    // Keep smoothly centered in the current corridor lane
    if (entity.dir === DIR.LEFT || entity.dir === DIR.RIGHT) {
      entity.y += (centerY - entity.y) * 0.5;
    } else {
      entity.x += (centerX - entity.x) * 0.5;
    }

    // Step forward
    const nx = entity.x + DX[entity.dir] * speed;
    const ny = entity.y + DY[entity.dir] * speed;

    // Check if the tile ahead of the tile center is a wall
    const nextTileCol = col + DX[entity.dir];
    const nextTileRow = row + DY[entity.dir];
    const passedCenter =
      (entity.dir === DIR.UP && ny <= centerY) ||
      (entity.dir === DIR.DOWN && ny >= centerY) ||
      (entity.dir === DIR.LEFT && nx <= centerX) ||
      (entity.dir === DIR.RIGHT && nx >= centerX);

    if (passedCenter && !isWalkable(nextTileCol, nextTileRow)) {
      // Reached a corner or T-junction wall! Snap cleanly to intersection center
      entity.x = centerX;
      entity.y = centerY;

      // Turn 90 degrees into an open perpendicular corridor (NEVER 180° backwards!)
      const perpDirs =
        entity.dir === DIR.UP || entity.dir === DIR.DOWN
          ? [DIR.LEFT, DIR.RIGHT]
          : [DIR.UP, DIR.DOWN];

      if (perpDirs.includes(targetDir) && isWalkable(col + DX[targetDir], row + DY[targetDir])) {
        entity.dir = targetDir;
      } else {
        const openPerp = perpDirs.filter(d => isWalkable(col + DX[d], row + DY[d]));
        if (openPerp.length > 0) {
          entity.dir = openPerp[0];
          if (isPlayer) desiredDir = entity.dir;
        }
      }
    } else {
      entity.x = nx;
      entity.y = ny;
    }
  }

  // --- Smoke Screen ("방구") Action ---
  // In Rally-X, pressing Smoke puffs out a trail of pixelated clouds behind the car as it drives!
  function triggerSmoke() {
    if (gameState !== STATE.PLAYING || paused) return;
    if (fuel <= 1.5 || player.smokeCooldown > 0 || player.smokeEmitFrames > 0) return;

    player.smokeEmitFrames = 24; // Emits 4 puffs over 24 frames (every 6 frames)
    player.smokeCooldown = 30;
    fuel = Math.max(0, fuel - 2.4);
  }

  function spawnSingleSmokePuff(puffIdx) {
    const backDir = OPPOSITE[player.dir];
    // Drop cloud directly behind the car's rear spoiler
    const sx = player.x + DX[backDir] * 20 + (Math.random() - 0.5) * 4;
    const sy = player.y + DY[backDir] * 20 + (Math.random() - 0.5) * 4;

    smokes.push({
      x: sx,
      y: sy,
      timer: 145,
      maxTimer: 145,
      puffIdx
    });
    audio.sfxSmokePuff(puffIdx);
  }

  // --- Camera Update ---
  function updateCamera() {
    if (!player) return;
    const targetCamX = player.x - VIEW_W / 2;
    const targetCamY = player.y - VIEW_H / 2;
    camX = Math.max(0, Math.min(WORLD_W - VIEW_W, targetCamX));
    camY = Math.max(0, Math.min(WORLD_H - VIEW_H, targetCamY));
  }

  // --- Main Game Update ---
  function update() {
    frameCount++;
    if (paused) return;

    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].timer--;
      popups[i].y -= 0.35;
      if (popups[i].timer <= 0) popups.splice(i, 1);
    }

    if (gameState === STATE.TITLE) return;

    if (gameState === STATE.READY) {
      stateTimer--;
      if (stateTimer <= 0) {
        gameState = STATE.PLAYING;
        audio.startBgm(round % 3 === 0);
      }
      return;
    }

    if (gameState === STATE.CRASHED) {
      stateTimer--;
      if (stateTimer <= 0) {
        lives--;
        if (lives < 0) {
          gameState = STATE.GAME_OVER;
          stateTimer = 180;
        } else {
          setupRound(false);
          enterReadyState();
        }
      }
      return;
    }

    if (gameState === STATE.ROUND_CLEAR) {
      if (fuel > 0) {
        const drain = Math.min(fuel, 1.5);
        fuel -= drain;
        score += Math.round(drain * 20);
        if (score > highScore) highScore = score;
        if (frameCount % 3 === 0) {
          audio.playTone(880 + (100 - fuel) * 4, 0.04, 'square', 0.09);
        }
      } else {
        stateTimer--;
        if (stateTimer <= 0) {
          round++;
          setupRound(true);
          enterReadyState();
        }
      }
      return;
    }

    if (gameState === STATE.GAME_OVER) {
      stateTimer--;
      if (stateTimer <= 0) {
        gameState = STATE.TITLE;
      }
      return;
    }

    // --- STATE.PLAYING ---
    fuel = Math.max(0, fuel - 0.028);
    if (player.smokeCooldown > 0) player.smokeCooldown--;
    if (player.invincibleTimer > 0) player.invincibleTimer--;

    // Emit trailing smoke puffs as the car drives
    if (player.smokeEmitFrames > 0) {
      if (player.smokeEmitFrames % 6 === 0) {
        const puffIndex = Math.floor((24 - player.smokeEmitFrames) / 6);
        spawnSingleSmokePuff(puffIndex);
      }
      player.smokeEmitFrames--;
    }

    player.speed = fuel > 0 ? 2.9 : 1.5;
    if (fuel <= 0) {
      enemies.forEach(e => { e.frozen = false; });
    }

    moveEntityOnGrid(player, desiredDir, true);
    updateCamera();

    // Update Smoke Clouds
    for (let i = smokes.length - 1; i >= 0; i--) {
      smokes[i].timer--;
      if (smokes[i].timer <= 0) smokes.splice(i, 1);
    }

    // Check Flag Collection
    for (const flag of flags) {
      if (!flag.collected && Math.hypot(player.x - flag.x, player.y - flag.y) < 19) {
        flag.collected = true;
        flagsCollectedCount++;

        if (flag.isSpecial) {
          specialMultiplier = 2;
        }

        const pts = flagsCollectedCount * 100 * specialMultiplier;
        score += pts;

        if (flag.isLucky) {
          const luckyBonus = Math.round(fuel * 10) * specialMultiplier;
          score += luckyBonus;
          addPopup(flag.x, flag.y - 14, `LUCKY +${luckyBonus}`, '#00f5d4', 70);
        }

        if (score > highScore) highScore = score;

        addPopup(
          flag.x,
          flag.y,
          flag.isSpecial ? `${pts} (S x2!)` : `${pts}`,
          flag.isSpecial ? '#ff4d6d' : '#ffd60a'
        );
        audio.sfxFlag(flag.isSpecial || flag.isLucky);

        if (flagsCollectedCount >= flags.length) {
          gameState = STATE.ROUND_CLEAR;
          stateTimer = 95;
          audio.stopBgm();
          audio.sfxRoundClear();
          return;
        }
      }
    }

    // Check Rock Collision
    for (const rk of rocks) {
      if (Math.hypot(player.x - rk.x, player.y - rk.y) < 16) {
        triggerPlayerCrash();
        return;
      }
    }

    // Update Red Enemy Cars
    for (const en of enemies) {
      if (en.releaseDelay > 0) {
        en.releaseDelay--;
        continue;
      }
      if (en.frozen) continue;

      // Check if enemy drives into a smoke cloud
      if (en.dizzyTimer <= 0) {
        for (const sm of smokes) {
          if (Math.hypot(en.x - sm.x, en.y - sm.y) < 20) {
            en.dizzyTimer = 150;
            audio.sfxDizzy();
            addPopup(en.x, en.y - 10, 'SPIN!', '#e9ecef', 45);
            break;
          }
        }
      }

      if (en.dizzyTimer > 0) {
        en.dizzyTimer--;
        if (en.dizzyTimer % 5 === 0) {
          en.dir = (en.dir + 1) % 4;
        }
      } else {
        const col = Math.floor(en.x / TILE);
        const row = Math.floor(en.y / TILE);
        const centerX = col * TILE + TILE / 2;
        const centerY = row * TILE + TILE / 2;

        let chosenDir = en.dir;
        if (Math.hypot(en.x - centerX, en.y - centerY) <= en.speed + 2.5) {
          const possibleDirs = [DIR.UP, DIR.RIGHT, DIR.DOWN, DIR.LEFT].filter(d => {
            if (d === OPPOSITE[en.dir]) return false;
            const nc = col + DX[d];
            const nr = row + DY[d];
            if (!isWalkable(nc, nr)) return false;
            const hasRock = rocks.some(rk => rk.c === nc && rk.r === nr);
            return !hasRock;
          });

          if (possibleDirs.length > 0) {
            possibleDirs.sort((d1, d2) => {
              const dist1 = Math.hypot((col + DX[d1]) * TILE - player.x, (row + DY[d1]) * TILE - player.y);
              const dist2 = Math.hypot((col + DX[d2]) * TILE - player.x, (row + DY[d2]) * TILE - player.y);
              return dist1 - dist2;
            });

            if (Math.random() < 0.72 || possibleDirs.length === 1) {
              chosenDir = possibleDirs[0];
            } else {
              chosenDir = possibleDirs[1];
            }
          }
        }

        moveEntityOnGrid(en, chosenDir, false);
      }

      // Check Enemy vs Player Collision (respecting brief spawn invincibility)
      if (player.invincibleTimer <= 0 && Math.hypot(player.x - en.x, player.y - en.y) < 17) {
        triggerPlayerCrash();
        return;
      }
    }
  }

  function triggerPlayerCrash() {
    gameState = STATE.CRASHED;
    stateTimer = 110;
    audio.stopBgm();
    audio.sfxBang();
  }

  // --- Rendering ---
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Left Scrolling Playfield Viewport (448x448)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();

    // Classic Rally-X desert-tan road background
    ctx.fillStyle = '#d8c383';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const startCol = Math.max(0, Math.floor(camX / TILE));
    const endCol = Math.min(MAP_COLS - 1, Math.ceil((camX + VIEW_W) / TILE));
    const startRow = Math.max(0, Math.floor(camY / TILE));
    const endRow = Math.min(MAP_ROWS - 1, Math.ceil((camY + VIEW_H) / TILE));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const sx = Math.floor(c * TILE - camX);
        const sy = Math.floor(r * TILE - camY);
        const tile = maze[r][c];

        if (tile === T_BORDER) {
          ctx.fillStyle = '#b5451b';
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = '#e07a5f';
          ctx.fillRect(sx + 2, sy + 2, TILE - 6, TILE - 6);
          ctx.fillStyle = '#6f1d1b';
          ctx.fillRect(sx + 6, sy + 6, TILE - 12, TILE - 12);
        } else if (tile === T_WALL) {
          ctx.fillStyle = '#b55400';
          ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = '#1b9e3e';
          ctx.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#70e000';
          ctx.fillRect(sx + 6, sy + 6, 4, 4);
          ctx.fillRect(sx + 18, sy + 8, 4, 4);
          ctx.fillRect(sx + 10, sy + 20, 4, 4);
          ctx.fillRect(sx + 22, sy + 18, 4, 4);
        } else if (tile === T_START) {
          if (r === 38) {
            // Checkered start line right ahead of player spawn
            for (let ck = 0; ck < 4; ck++) {
              ctx.fillStyle = ck % 2 === 0 ? '#ffffff' : '#111111';
              ctx.fillRect(sx + ck * 8, sy + 12, 8, 8);
              ctx.fillStyle = ck % 2 === 1 ? '#ffffff' : '#111111';
              ctx.fillRect(sx + ck * 8, sy + 20, 8, 8);
            }
          } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
          }
        }
      }
    }

    // Draw Rocks
    for (const rk of rocks) {
      const rx = rk.x - camX;
      const ry = rk.y - camY;
      if (rx < -TILE || rx > VIEW_W + TILE || ry < -TILE || ry > VIEW_H + TILE) continue;
      drawRockSprite(rx, ry);
    }

    // Draw Flags
    for (const fl of flags) {
      if (fl.collected) continue;
      const fx = fl.x - camX;
      const fy = fl.y - camY;
      if (fx < -TILE || fx > VIEW_W + TILE || fy < -TILE || fy > VIEW_H + TILE) continue;
      drawFlagSprite(fx, fy, fl.isSpecial, fl.isLucky);
    }

    // Draw Authentic 8-Bit Pixel-Art Smoke Clouds ("방구 모양")
    for (const sm of smokes) {
      const sx = sm.x - camX;
      const sy = sm.y - camY;
      if (sx < -TILE || sx > VIEW_W + TILE || sy < -TILE || sy > VIEW_H + TILE) continue;
      drawPixelSmokeSprite(sx, sy, sm.timer, sm.maxTimer, sm.puffIdx);
    }

    // Draw Exhaust Jet behind Player Car while actively emitting smoke
    if (player && player.smokeEmitFrames > 0 && gameState === STATE.PLAYING) {
      drawExhaustJet(player.x - camX, player.y - camY, player.dir);
    }

    // Draw Red Enemy Cars
    for (const en of enemies) {
      const ex = en.x - camX;
      const ey = en.y - camY;
      if (ex < -TILE || ex > VIEW_W + TILE || ey < -TILE || ey > VIEW_H + TILE) continue;
      drawCarSprite(ex, ey, en.dir, '#ef233c', '#ffccd5', en.dizzyTimer > 0);
    }

    // Draw Player Blue Car
    if (player) {
      const px = player.x - camX;
      const py = player.y - camY;
      if (gameState === STATE.CRASHED) {
        drawBangExplosion(px, py);
      } else {
        drawCarSprite(px, py, player.dir, '#0066ff', '#90e0ef', false);
      }
    }

    // Draw Floating Score Popups
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const pop of popups) {
      const px = pop.x - camX;
      const py = pop.y - camY;
      ctx.fillStyle = '#000';
      ctx.fillText(pop.text, px + 2, py + 2);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, px, py);
    }

    drawPlayfieldOverlays();
    ctx.restore();

    // 2. Right-Side Arcade HUD & Radar
    drawHudAndRadar();
  }

  /**
   * Authentic 1980 Namco Rally-X 8-Bit Pixel-Art Smoke Puff ("방구 구름 도트")
   * Drawn on a crisp 2px pixel grid with animated billowing lobes and retro cyan/gray shading dots!
   */
  const SMOKE_BITMAP_A = [
    "....WWWW....",
    "..WWWWWWWW..",
    ".WWWBBBBWWW.",
    "WWWWBWWBWWWW",
    "WWWBWWWWBWWW",
    "WWWWWWWWWWWW",
    "WWBWWWWWWBWW",
    "WWWBWWWWBWWW",
    ".WWWWWWWWWW.",
    "..WWBBBBWW..",
    "...WWWWWW...",
    "............"
  ];

  const SMOKE_BITMAP_B = [
    "...WWWWWW...",
    ".WWWWWWWWWW.",
    "WWWBWWWWBWWW",
    "WWBWWWWWWBWW",
    "WWWWWWWWWWWW",
    "WWWWBWWBWWWW",
    "WWWBWWWWBWWW",
    ".WWWBBBBWWW.",
    "..WWWWWWWW..",
    "...WW..WW...",
    "............",
    "............"
  ];

  function drawPixelSmokeSprite(x, y, timer, maxTimer, puffIdx) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));

    // Expanding scale when first puffed, shrinking slightly right as it vanishes
    const age = maxTimer - timer;
    let scale = 2.2;
    if (age < 8) scale = 1.4 + age * 0.1;
    else if (timer < 25) scale = 1.2 + (timer / 25) * 1.0;

    // Blink during last 20 frames like original 80s arcade sprites
    if (timer < 20 && Math.floor(timer / 2) % 2 === 0) {
      ctx.restore();
      return;
    }

    // 2-frame pixel wiggle animation
    const frameA = Math.floor((frameCount + puffIdx * 5) / 6) % 2 === 0;
    const bitmap = frameA ? SMOKE_BITMAP_A : SMOKE_BITMAP_B;
    const pSize = scale;
    const offset = (12 * pSize) / 2;

    for (let r = 0; r < 12; r++) {
      const rowStr = bitmap[r];
      for (let c = 0; c < 12; c++) {
        const ch = rowStr[c];
        if (ch === '.') continue;
        // 'W' = crisp arcade white cloud pixel, 'B' = classic Namco bluish-gray inner puff contour pixel
        ctx.fillStyle = ch === 'W' ? '#ffffff' : '#7289da';
        ctx.fillRect(
          Math.round(c * pSize - offset),
          Math.round(r * pSize - offset),
          Math.ceil(pSize),
          Math.ceil(pSize)
        );
      }
    }

    ctx.restore();
  }

  // Draw the little cone-shaped exhaust puff right behind the car bumper when spraying smoke
  function drawExhaustJet(px, py, carDir) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(carDir * (Math.PI / 2));
    // Car rear is at +y (12px)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, 13, 6, 4);
    ctx.fillRect(-6, 17, 12, 4);
    ctx.fillStyle = '#7289da';
    ctx.fillRect(-4, 18, 8, 2);
    ctx.restore();
  }

  function drawFlagSprite(x, y, isSpecial, isLucky) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-9, -12, 3, 24);
    ctx.fillStyle = '#333333';
    ctx.fillRect(-11, 10, 7, 3);

    const blink = Math.floor(frameCount / 8) % 2 === 0;
    ctx.fillStyle = isSpecial && blink ? '#ff9f1c' : '#ffd60a';
    ctx.beginPath();
    ctx.moveTo(-6, -12);
    ctx.lineTo(12, -5);
    ctx.lineTo(-6, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d90429';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (isSpecial || isLucky) {
      ctx.font = 'bold 9px "Press Start 2P", monospace';
      ctx.fillStyle = isSpecial ? '#d90429' : '#00509d';
      ctx.textAlign = 'center';
      ctx.fillText(isSpecial ? 'S' : 'L', 2, 11);
    }
    ctx.restore();
  }

  function drawRockSprite(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#4a4e69';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9a8c98';
    ctx.fillRect(-6, -7, 9, 5);
    ctx.fillRect(-8, -2, 7, 6);
    ctx.fillStyle = '#22223b';
    ctx.fillRect(1, 2, 6, 5);
    ctx.restore();
  }

  function drawCarSprite(x, y, dir, bodyColor, accentColor, isDizzy) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dir * (Math.PI / 2));

    // Black open-wheel tires
    ctx.fillStyle = '#111111';
    ctx.fillRect(-11, -9, 4, 6);
    ctx.fillRect(7, -9, 4, 6);
    ctx.fillRect(-12, 4, 5, 7);
    ctx.fillRect(7, 4, 5, 7);

    // Main body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-7, -11, 14, 22);

    // Front wing
    ctx.fillStyle = accentColor;
    ctx.fillRect(-9, -12, 18, 3);

    // Rear wing
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-9, 9, 18, 3);

    // Driver cockpit
    ctx.fillStyle = '#111111';
    ctx.fillRect(-4, -3, 8, 7);
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    if (isDizzy) {
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 1.4);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBangExplosion(x, y) {
    ctx.save();
    ctx.translate(x, y);

    const spikes = 10;
    const outerR = 26 + (frameCount % 6);
    const innerR = 13;
    ctx.fillStyle = frameCount % 4 < 2 ? '#ff2a2a' : '#ffd60a';
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / spikes;
      const vx = Math.cos(angle) * r;
      const vy = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText('BANG!', 2, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BANG!', 0, 3);

    ctx.restore();
  }

  function drawPlayfieldOverlays() {
    ctx.textAlign = 'center';

    if (gameState === STATE.TITLE) {
      ctx.fillStyle = 'rgba(8, 10, 18, 0.84)';
      ctx.fillRect(28, 48, VIEW_W - 56, VIEW_H - 96);
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 3;
      ctx.strokeRect(28, 48, VIEW_W - 56, VIEW_H - 96);

      ctx.font = 'bold 26px "Press Start 2P", monospace';
      ctx.fillStyle = '#d90429';
      ctx.fillText('RALLY-X', VIEW_W / 2 + 3, 108);
      ctx.fillStyle = '#ffd60a';
      ctx.fillText('RALLY-X', VIEW_W / 2, 105);

      ctx.font = 'bold 15px "Noto Sans KR", sans-serif';
      ctx.fillStyle = '#90e0ef';
      ctx.fillText('추억의 오락실 명작 · 엑스 렐리 (방구차)', VIEW_W / 2, 136);

      drawFlagSprite(115, 185, false, false);
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText('FLAG: 100 ~ 1000 PTS', 142, 188);

      drawFlagSprite(115, 222, true, false);
      ctx.fillStyle = '#ffd60a';
      ctx.fillText('SPECIAL (S): SCORE x2!', 142, 225);

      drawCarSprite(115, 260, DIR.RIGHT, '#0066ff', '#90e0ef', false);
      drawPixelSmokeSprite(82, 260, 100, 145, 0);
      ctx.fillStyle = '#90e0ef';
      ctx.fillText('YOU: BLUE Car + SMOKE(방구)', 142, 264);

      drawCarSprite(115, 298, DIR.RIGHT, '#ef233c', '#ffccd5', false);
      ctx.fillStyle = '#ffccd5';
      ctx.fillText('ENEMY: RED Pursuit Car', 142, 302);

      ctx.textAlign = 'center';
      if (Math.floor(frameCount / 22) % 2 === 0) {
        ctx.font = 'bold 12px "Press Start 2P", monospace';
        ctx.fillStyle = '#06d6a0';
        ctx.fillText('PRESS 1P START OR SPACE', VIEW_W / 2, 355);
      }
    } else if (gameState === STATE.READY) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(64, 165, VIEW_W - 128, 110);
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 2;
      ctx.strokeRect(64, 165, VIEW_W - 128, 110);

      ctx.font = 'bold 14px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffd60a';
      if (round % 3 === 0) {
        ctx.fillText('CHALLENGING STAGE!', VIEW_W / 2, 205);
      } else {
        ctx.fillText(`ROUND ${round}`, VIEW_W / 2, 205);
      }
      ctx.fillStyle = '#00f5d4';
      ctx.fillText('READY!', VIEW_W / 2, 242);
    } else if (gameState === STATE.ROUND_CLEAR) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.76)';
      ctx.fillRect(60, 165, VIEW_W - 120, 110);
      ctx.strokeStyle = '#06d6a0';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 165, VIEW_W - 120, 110);

      ctx.font = 'bold 14px "Press Start 2P", monospace';
      ctx.fillStyle = '#06d6a0';
      ctx.fillText(`ROUND ${round} CLEAR!`, VIEW_W / 2, 205);
      ctx.font = 'bold 11px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffd60a';
      ctx.fillText('FUEL BONUS COUNTING...', VIEW_W / 2, 242);
    } else if (gameState === STATE.GAME_OVER) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(74, 175, VIEW_W - 148, 95);
      ctx.strokeStyle = '#ef233c';
      ctx.lineWidth = 2;
      ctx.strokeRect(74, 175, VIEW_W - 148, 95);

      ctx.font = 'bold 18px "Press Start 2P", monospace';
      ctx.fillStyle = '#ef233c';
      ctx.fillText('GAME OVER', VIEW_W / 2, 230);
    }

    if (paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.font = 'bold 18px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffd60a';
      ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
    }
  }

  // --- Right-Side Arcade HUD & Radar Mini-Map ---
  function drawHudAndRadar() {
    ctx.fillStyle = '#050608';
    ctx.fillRect(HUD_X, 0, HUD_W, VIEW_H);

    ctx.fillStyle = '#e63946';
    ctx.fillRect(HUD_X, 0, 4, VIEW_H);

    const cx = HUD_X + HUD_W / 2 + 2;
    ctx.textAlign = 'center';

    // HIGH SCORE
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.fillStyle = '#ef233c';
    ctx.fillText('HIGH SCORE', cx, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(highScore).padStart(6, '0'), cx, 44);

    // 1UP Score & x2 Badge
    ctx.fillStyle = '#00b4d8';
    ctx.fillText('1UP', cx - 22, 70);
    if (specialMultiplier === 2) {
      ctx.fillStyle = '#ffd60a';
      ctx.fillText('x2!', cx + 28, 70);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(score).padStart(6, '0'), cx, 88);

    // FUEL Gauge
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.fillText('FUEL', cx, 114);

    const barX = HUD_X + 18;
    const barY = 122;
    const barW = 128;
    const barH = 14;
    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barW, barH);

    const fuelRatio = Math.max(0, Math.min(1, fuel / 100));
    const isLowFuel = fuel < 25 && Math.floor(frameCount / 6) % 2 === 0;
    ctx.fillStyle = fuel < 25 ? (isLowFuel ? '#ff0000' : '#800000') : '#ffd60a';
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * fuelRatio, barH - 4);

    // --- RADAR MINI-MAP ---
    const radarW = 126;
    const radarH = 204;
    const radarX = HUD_X + Math.floor((HUD_W - radarW) / 2) + 2;
    const radarY = 152;

    ctx.fillStyle = '#000814';
    ctx.fillRect(radarX, radarY, radarW, radarH);
    ctx.strokeStyle = '#00b4d8';
    ctx.lineWidth = 2;
    ctx.strokeRect(radarX, radarY, radarW, radarH);

    // Viewport indicator on radar
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      radarX + (camX / WORLD_W) * radarW,
      radarY + (camY / WORLD_H) * radarH,
      (VIEW_W / WORLD_W) * radarW,
      (VIEW_H / WORLD_H) * radarH
    );

    // Remaining Flags on Radar
    for (const fl of flags) {
      if (fl.collected) continue;
      const fx = radarX + (fl.x / WORLD_W) * radarW;
      const fy = radarY + (fl.y / WORLD_H) * radarH;
      if (fl.isSpecial) {
        ctx.fillStyle = Math.floor(frameCount / 6) % 2 === 0 ? '#ffffff' : '#ffd60a';
        ctx.fillRect(fx - 2.5, fy - 2.5, 5, 5);
      } else {
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(fx - 2, fy - 2, 4, 4);
      }
    }

    // Red Enemy Cars on Radar
    ctx.fillStyle = '#ff2a2a';
    for (const en of enemies) {
      const ex = radarX + (en.x / WORLD_W) * radarW;
      const ey = radarY + (en.y / WORLD_H) * radarH;
      ctx.fillRect(ex - 2, ey - 2, 4, 4);
    }

    // Player Car on Radar
    if (player && Math.floor(frameCount / 4) % 2 === 0) {
      const px = radarX + (player.x / WORLD_W) * radarW;
      const py = radarY + (player.y / WORLD_H) * radarH;
      ctx.fillStyle = '#00f5d4';
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    }

    // Bottom HUD: Remaining Lives & Round
    const livesY = 385;
    for (let i = 0; i < Math.min(lives, 5); i++) {
      drawCarSprite(HUD_X + 30 + i * 26, livesY, DIR.UP, '#0066ff', '#90e0ef', false);
    }

    drawFlagSprite(HUD_X + 34, 422, false, false);
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd60a';
    ctx.textAlign = 'left';
    ctx.fillText(`ROUND ${round}`, HUD_X + 54, 427);
  }

  // --- Interactive Arcade Joystick & UI Controls ---
  const joystickShaft = document.getElementById('joystick-shaft');
  const dpadButtons = document.querySelectorAll('.dpad-dir');
  const btnSmoke = document.getElementById('btn-smoke');
  const btnBoostMonitor = document.getElementById('btn-boost-monitor');
  const btnColor = document.getElementById('btn-color');
  const btnBw = document.getElementById('btn-bw');
  const btnCrt = document.getElementById('btn-crt');
  const crtWrapper = document.getElementById('crt-Wrapper');
  const monitorBadge = document.getElementById('monitor-badge');
  const creditCountEl = document.getElementById('credit-count');

  function updateCreditUI() {
    creditCountEl.textContent = String(credits).padStart(2, '0');
  }

  function setDirectionInput(dir) {
    desiredDir = dir;
    updateJoystickVisual(dir);
  }

  function updateJoystickVisual(dir) {
    const offset = 22;
    let tx = 0;
    let ty = 0;
    if (dir === DIR.UP) ty = -offset;
    else if (dir === DIR.DOWN) ty = offset;
    else if (dir === DIR.LEFT) tx = -offset;
    else if (dir === DIR.RIGHT) tx = offset;

    joystickShaft.style.transform = `translate(${tx}px, ${ty}px)`;

    const dirNames = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    dpadButtons.forEach(btn => {
      btn.classList.toggle('pressed', dir !== null && btn.dataset.dir === dirNames[dir]);
    });
  }

  // Monitor Color vs B&W Mode Switch
  let isBwMode = false;
  function setMonitorMode(bw) {
    isBwMode = bw;
    crtWrapper.classList.toggle('bw-mode', isBwMode);
    crtWrapper.classList.toggle('color-mode', !isBwMode);
    btnColor.classList.toggle('active', !isBwMode);
    btnBw.classList.toggle('active', isBwMode);
    monitorBadge.textContent = isBwMode ? 'B&W MONOCHROME CRT' : 'COLOR CRT';
  }

  btnColor.addEventListener('click', () => setMonitorMode(false));
  btnBw.addEventListener('click', () => setMonitorMode(true));
  btnBoostMonitor.addEventListener('click', () => setMonitorMode(!isBwMode));

  btnCrt.addEventListener('click', () => {
    crtWrapper.classList.toggle('crt-scanlines');
    btnCrt.classList.toggle('active', crtWrapper.classList.contains('crt-scanlines'));
  });

  document.getElementById('btn-coin').addEventListener('click', () => {
    credits = Math.min(99, credits + 1);
    updateCreditUI();
    audio.sfxCoin();
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    if (gameState === STATE.TITLE || gameState === STATE.GAME_OVER) {
      startNewGame();
    }
  });

  const btnBgmStyle = document.getElementById('btn-bgm-style');
  const bgmLabels = [
    '🎵 BGM: 뉴 랠리X (방구차)',
    '🎵 BGM: 80년 원조 랠리X',
    '🎵 BGM: 풀 버전 (원조+뉴)'
  ];
  if (btnBgmStyle) {
    btnBgmStyle.addEventListener('click', () => {
      audio.bgmMode = (audio.bgmMode + 1) % 3;
      btnBgmStyle.textContent = bgmLabels[audio.bgmMode];
      // Immediately preview or restart BGM with the newly selected theme!
      audio.startBgm(round % 3 === 0);
    });
  }

  const btnSound = document.getElementById('btn-sound');
  btnSound.addEventListener('click', () => {
    audio.enabled = !audio.enabled;
    btnSound.classList.toggle('active', audio.enabled);
    btnSound.textContent = audio.enabled ? '🔊 SOUND ON' : '🔇 SOUND OFF';
  });

  const btnPause = document.getElementById('btn-pause');
  btnPause.addEventListener('click', () => {
    if (gameState === STATE.PLAYING) {
      paused = !paused;
      btnPause.classList.toggle('active', paused);
    }
  });

  function handleSmokePress(e) {
    if (e) e.preventDefault();
    btnSmoke.classList.add('pressed');
    if (gameState === STATE.TITLE || gameState === STATE.GAME_OVER) {
      startNewGame();
    } else {
      triggerSmoke();
    }
  }
  function handleSmokeRelease() {
    btnSmoke.classList.remove('pressed');
  }

  btnSmoke.addEventListener('mousedown', handleSmokePress);
  btnSmoke.addEventListener('touchstart', handleSmokePress, { passive: false });
  window.addEventListener('mouseup', handleSmokeRelease);
  window.addEventListener('touchend', handleSmokeRelease);

  const dirMap = { UP: DIR.UP, RIGHT: DIR.RIGHT, DOWN: DIR.DOWN, LEFT: DIR.LEFT };
  dpadButtons.forEach(btn => {
    const activate = e => {
      e.preventDefault();
      const d = dirMap[btn.dataset.dir];
      if (d !== undefined) setDirectionInput(d);
    };
    btn.addEventListener('mousedown', activate);
    btn.addEventListener('touchstart', activate, { passive: false });
  });

  const joystickZone = document.getElementById('joystick-zone');
  let draggingStick = false;

  function handleStickPointer(clientX, clientY) {
    const rect = joystickZone.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    if (Math.hypot(dx, dy) < 10) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirectionInput(dx > 0 ? DIR.RIGHT : DIR.LEFT);
    } else {
      setDirectionInput(dy > 0 ? DIR.DOWN : DIR.UP);
    }
  }

  joystickZone.addEventListener('pointerdown', e => {
    draggingStick = true;
    joystickZone.setPointerCapture(e.pointerId);
    handleStickPointer(e.clientX, e.clientY);
  });

  joystickZone.addEventListener('pointermove', e => {
    if (draggingStick) {
      handleStickPointer(e.clientX, e.clientY);
    }
  });

  joystickZone.addEventListener('pointerup', () => {
    draggingStick = false;
    updateJoystickVisual(null);
  });

  window.addEventListener('keydown', e => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }

    if (code === 'ArrowUp' || code === 'KeyW') {
      activeKeyDirs.add(DIR.UP);
      setDirectionInput(DIR.UP);
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      activeKeyDirs.add(DIR.RIGHT);
      setDirectionInput(DIR.RIGHT);
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      activeKeyDirs.add(DIR.DOWN);
      setDirectionInput(DIR.DOWN);
    } else if (code === 'ArrowLeft' || code === 'KeyA') {
      activeKeyDirs.add(DIR.LEFT);
      setDirectionInput(DIR.LEFT);
    } else if (code === 'Space' || code === 'KeyZ' || code === 'KeyX') {
      handleSmokePress();
    } else if (code === 'Digit5' || code === 'ShiftLeft' || code === 'ShiftRight') {
      credits = Math.min(99, credits + 1);
      updateCreditUI();
      audio.sfxCoin();
    } else if (code === 'Digit1' || code === 'Enter') {
      if (gameState === STATE.TITLE || gameState === STATE.GAME_OVER) {
        startNewGame();
      }
    } else if (code === 'KeyC') {
      setMonitorMode(false);
    } else if (code === 'KeyB') {
      setMonitorMode(true);
    } else if (code === 'KeyP') {
      if (gameState === STATE.PLAYING) paused = !paused;
    } else if (code === 'KeyM') {
      btnSound.click();
    } else if (code === 'KeyN') {
      if (btnBgmStyle) btnBgmStyle.click();
    }
  });

  window.addEventListener('keyup', e => {
    const code = e.code;
    if (code === 'ArrowUp' || code === 'KeyW') activeKeyDirs.delete(DIR.UP);
    if (code === 'ArrowRight' || code === 'KeyD') activeKeyDirs.delete(DIR.RIGHT);
    if (code === 'ArrowDown' || code === 'KeyS') activeKeyDirs.delete(DIR.DOWN);
    if (code === 'ArrowLeft' || code === 'KeyA') activeKeyDirs.delete(DIR.LEFT);
    if (code === 'Space' || code === 'KeyZ' || code === 'KeyX') handleSmokeRelease();

    if (activeKeyDirs.size === 0) {
      updateJoystickVisual(null);
    } else {
      const lastDir = Array.from(activeKeyDirs).pop();
      updateJoystickVisual(lastDir);
    }
  });

  // --- Main 60FPS Game Loop ---
  setupRound(true);

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
