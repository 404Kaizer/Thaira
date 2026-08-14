# Graph Report - jogo  (2026-08-10)

## Corpus Check
- 19 files · ~1,090,329 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 573 nodes · 1019 edges · 53 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- art.js
- test.js
- audio.js
- migrateLegacySave
- render2d.js
- data.js
- game.js
- world.js
- superficie-dia
- _corpo_medio
- ui.js
- hud.js
- crit
- achar
- .constructor
- sfx/manifest.json
- build_icons.py
- Áudio — procedência e licença
- CLAUDE.md
- heal
- potion
- spell_holy
- atk_distance
- atk_sword
- atk_wand
- buff
- coin
- _corpo_forte
- _corpo_medio
- death
- energy
- equip
- error
- fire
- hurt
- ice
- levelup
- loot
- rune
- shoot
- skillup
- spell_death
- spell_earth
- spell_energy
- spell_fire
- spell_ice
- stairs
- step_cave
- step_dirt
- step_grass
- step_rock
- step_sand
- step_stone

## God Nodes (most connected - your core abstractions)
1. `log()` - 31 edges
2. `castSpell()` - 22 edges
3. `bindInput()` - 21 edges
4. `frame()` - 19 edges
5. `recalc()` - 16 edges
6. `renderBars()` - 15 edges
7. `finishStart()` - 13 edges
8. `itemStats()` - 12 edges
9. `useRune()` - 12 edges
10. `updateMobs()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `renderShop()` --references--> `SHOP_STOCK`  [EXTRACTED]
  src/game.js → src/data.js
- `itemStats()` --references--> `PREFIXES`  [EXTRACTED]
  src/game.js → src/data.js
- `itemStats()` --references--> `SUFFIXES`  [EXTRACTED]
  src/game.js → src/data.js
- `fixSave()` --references--> `PREFIXES`  [EXTRACTED]
  src/game.js → src/data.js
- `fixSave()` --references--> `SUFFIXES`  [EXTRACTED]
  src/game.js → src/data.js

## Import Cycles
- None detected.

## Communities (53 total, 0 thin omitted)

### Community 0 - "art.js"
Cohesion: 0.07
Nodes (46): BORDER_CACHE, borderSprite(), _canvas(), _canvas2(), _chapado(), cloudTexture(), contactShadow(), _cracks() (+38 more)

### Community 1 - "test.js"
Cohesion: 0.04
Nodes (35): B, C, chefes, comCharm, comum, ctx, dAtk, dBal (+27 more)

### Community 2 - "audio.js"
Cohesion: 0.09
Nodes (31): ambience(), ambNodes, arp(), audioInit(), audioToggle(), audioVol(), audioVolReset(), _avisarSemSom() (+23 more)

### Community 3 - "migrateLegacySave"
Cohesion: 0.19
Nodes (15): PREFIXES, SUFFIXES, charId(), fixSave(), listCharacters(), load(), loadCharacter(), migrateLegacySave() (+7 more)

### Community 4 - "render2d.js"
Cohesion: 0.13
Nodes (32): CAM, camadaNuvem(), cloudPass(), creatureSpriteFor(), dprInt(), drawBlood(), drawEffects(), drawEntity() (+24 more)

### Community 5 - "data.js"
Cohesion: 0.07
Nodes (28): BEST_DIFF, BEST_REVEAL, BEST_STAGE, boss(), defModificada(), ELITES, HUNTS, item() (+20 more)

### Community 6 - "game.js"
Cohesion: 0.06
Nodes (115): SPELLS, abrirPicker(), addExp(), addMagic(), addSkillTry(), afterStep(), bagAdd(), bindInput() (+107 more)

### Community 7 - "world.js"
Cohesion: 0.14
Nodes (24): ambienteAgora(), CEU, climaAgora(), corDoCeu(), DIRS, distT(), ehNoite(), findPath() (+16 more)

### Community 8 - "superficie-dia"
Cohesion: 0.10
Nodes (21): abismo, caverna, superficie-dia, superficie-noite, abismo-caverna.ogg, caverna-eco.ogg, caverna-masmorra.ogg, caverna-templo.mp3 (+13 more)

### Community 9 - "_corpo_medio"
Cohesion: 0.10
Nodes (21): atk_axe, mix, n, v, atk_club, mix, n, v (+13 more)

### Community 11 - "ui.js"
Cohesion: 0.33
Nodes (13): LOOT_RARITY, bestDiff(), bestiaryKill(), bestKills(), bestStage(), bindBigMap(), drawBigMap(), lootRarity() (+5 more)

### Community 14 - "hud.js"
Cohesion: 0.38
Nodes (10): HUD, HUD_BITS, HUD_DEF(), HUD_PANELS, hudApply(), hudLoad(), hudMove(), hudOptions() (+2 more)

### Community 15 - "crit"
Cohesion: 0.22
Nodes (9): crit, mix, n, v, die, mix, n, v (+1 more)

### Community 18 - "achar"
Cohesion: 0.38
Nodes (5): main(), achar(), main(), Resolve um padrão do mapa em um caminho real, ou None., Path

### Community 19 - ".constructor"
Cohesion: 0.29
Nodes (6): Any, chain(), ctx2d(), fakeEl(), parseChildren(), vec()

### Community 20 - "sfx/manifest.json"
Cohesion: 0.33
Nodes (5): ext, rev, unequip, n, v

### Community 22 - "build_icons.py"
Cohesion: 0.60
Nodes (4): main(), paletiza(), Tira o fundo verde de assets/green_background/*.png e grava em assets/icons/.…, sem_fundo()

### Community 23 - "Áudio — procedência e licença"
Cohesion: 0.40
Nodes (4): Como trocar um som, Efeitos — `assets/sfx/`, Trilha — `assets/music/`, Áudio — procedência e licença

### Community 24 - "CLAUDE.md"
Cohesion: 0.40
Nodes (4): Confirmar antes de implementar, graphify, headroom, ponytail

### Community 25 - "heal"
Cohesion: 0.50
Nodes (4): heal, ext, n, v

### Community 26 - "potion"
Cohesion: 0.50
Nodes (4): potion, ext, n, v

### Community 27 - "spell_holy"
Cohesion: 0.50
Nodes (4): spell_holy, ext, n, v

### Community 28 - "atk_distance"
Cohesion: 0.67
Nodes (3): atk_distance, n, v

### Community 29 - "atk_sword"
Cohesion: 0.67
Nodes (3): atk_sword, n, v

### Community 30 - "atk_wand"
Cohesion: 0.67
Nodes (3): atk_wand, n, v

### Community 31 - "buff"
Cohesion: 0.67
Nodes (3): buff, n, v

### Community 32 - "coin"
Cohesion: 0.67
Nodes (3): coin, n, v

### Community 33 - "_corpo_forte"
Cohesion: 0.67
Nodes (3): _corpo_forte, n, v

### Community 34 - "_corpo_medio"
Cohesion: 0.67
Nodes (3): _corpo_medio, n, v

### Community 35 - "death"
Cohesion: 0.67
Nodes (3): death, n, v

### Community 36 - "energy"
Cohesion: 0.67
Nodes (3): energy, n, v

### Community 37 - "equip"
Cohesion: 0.67
Nodes (3): equip, n, v

### Community 38 - "error"
Cohesion: 0.67
Nodes (3): error, n, v

### Community 39 - "fire"
Cohesion: 0.67
Nodes (3): fire, n, v

### Community 40 - "hurt"
Cohesion: 0.67
Nodes (3): hurt, n, v

### Community 41 - "ice"
Cohesion: 0.67
Nodes (3): ice, n, v

### Community 42 - "levelup"
Cohesion: 0.67
Nodes (3): levelup, n, v

### Community 43 - "loot"
Cohesion: 0.67
Nodes (3): loot, n, v

### Community 44 - "rune"
Cohesion: 0.67
Nodes (3): rune, n, v

### Community 45 - "shoot"
Cohesion: 0.67
Nodes (3): shoot, n, v

### Community 46 - "skillup"
Cohesion: 0.67
Nodes (3): skillup, n, v

### Community 47 - "spell_death"
Cohesion: 0.67
Nodes (3): spell_death, n, v

### Community 48 - "spell_earth"
Cohesion: 0.67
Nodes (3): spell_earth, n, v

### Community 49 - "spell_energy"
Cohesion: 0.67
Nodes (3): spell_energy, n, v

### Community 50 - "spell_fire"
Cohesion: 0.67
Nodes (3): spell_fire, n, v

### Community 51 - "spell_ice"
Cohesion: 0.67
Nodes (3): spell_ice, n, v

### Community 52 - "stairs"
Cohesion: 0.67
Nodes (3): stairs, n, v

### Community 53 - "step_cave"
Cohesion: 0.67
Nodes (3): step_cave, n, v

### Community 54 - "step_dirt"
Cohesion: 0.67
Nodes (3): step_dirt, n, v

### Community 55 - "step_grass"
Cohesion: 0.67
Nodes (3): step_grass, n, v

### Community 56 - "step_rock"
Cohesion: 0.67
Nodes (3): step_rock, n, v

### Community 57 - "step_sand"
Cohesion: 0.67
Nodes (3): step_sand, n, v

### Community 58 - "step_stone"
Cohesion: 0.67
Nodes (3): step_stone, n, v

## Knowledge Gaps
- **222 isolated node(s):** `dia-vila.mp3`, `dia-celta.mp3`, `dia-campina.mp3`, `dia-taverna.mp3`, `dia-menestrel.mp3` (+217 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SPELLS` connect `game.js` to `data.js`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `LOOT_RARITY` connect `ui.js` to `data.js`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `dia-vila.mp3`, `dia-celta.mp3`, `dia-campina.mp3` to the rest of the system?**
  _222 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `art.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06857142857142857 - nodes in this community are weakly interconnected._
- **Should `test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `audio.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08571428571428572 - nodes in this community are weakly interconnected._
- **Should `render2d.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13068181818181818 - nodes in this community are weakly interconnected._