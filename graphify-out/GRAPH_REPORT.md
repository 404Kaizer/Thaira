# Graph Report - Jogo  (2026-09-06)

## Corpus Check
- 93 files · ~8,281,090 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2538 nodes · 3844 edges · 164 communities (156 shown, 8 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 233 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3f987432`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Tela de ajuda / comandos (#help)
- art.js
- test.js
- aplicaPreset (carrega modelo do preset)
- audio.js
- game.js
- data.js
- drawFloor
- _corpo_morte
- world.js
- abismo
- Orc Animation Sprite Sheet
- _corpo_medio
- updateMobs
- Ancestral Hunter Set Sheet (4x4 icon atlas on magenta key)
- Combat Stance System (attack / balanced / defense selector)
- Weapon Equipment Slot
- Golden Guardian Set (Thaira equipment set: blackened plate, gold lion heraldry, red gems)
- combate
- compor.js
- Energy Sorcerer Front Walk and Idle Reference Sheet
- Flat Monochrome Glyph Icon Style
- build_ref_estilo.py
- ui.js
- cssCol
- Axe Icon (Double-Bladed Wood Axe)
- sfx/manifest.json
- skinAtual
- hud.js
- Golden Guardian Set Reference Sheet
- crit
- Thaira Sound Toggle Icon Sheet (on + off)
- build_criaturas.py
- corrige_oliva.py
- 6. Folha de animação (personagem e criatura)
- .constructor
- build_icons.py
- Áudio — procedência e licença
- renderHotbar
- item
- heal
- potion
- spell_holy
- atk_distance
- build_magias.py
- die
- castSpell
- coin
- _corpo_forte
- varrokgaard.js
- energy
- equip
- error
- fire
- hurt
- fixSave
- freesound.py
- loot
- ui_click
- ui_close
- skillup
- bindInput
- cast_aoe
- cast_bolt
- _corpo_medio
- bag
- stairs
- eat
- ice
- death
- frame
- unequip
- UI Sound On Icon (speaker with sound waves)
- laco (render loop do visualizador 3D)
- COINS
- build_skins.py
- build_terreno.py
- cast_conjure
- rune
- cast_taunt
- cast_wave
- hab_area
- mob
- defModificada
- serve.py
- spell_ice
- package.json
- main.js
- lootEV
- superficie-dia
- criaturas.js
- _mulberry
- silhouette
- _canvas2
- log
- Texturas de UI — o que gerar
- arraste.js
- hab_cura
- congela_mapa.js
- emTerra
- superficie-noite
- Sessão 2026-08-29 — auditoria gráfica por time (luz, sombra, clima)
- Rodada 5 — tile, parede e objeto · 2026-08-31
- caverna
- levelup
- confere_folha.py
- hab_fase
- fakeEl
- hab_lento
- combate-abismo
- itemStats
- hab_mana
- spell_death
- spell_earth
- spell_fire
- spell_physical
- _canvas
- objects_01_22
- objects_01_01
- objects_01_02
- objects_01_03
- objects_01_04
- objects_01_05
- objects_01_06
- objects_01_07
- objects_01_08
- objects_01_09
- objects_01_10
- objects_01_11
- objects_01_12
- objects_01_13
- objects_01_14
- objects_01_15
- objects_01_16
- objects_01_17
- objects_01_18
- objects_01_19
- objects_01_20
- objects_01_21
- objects_01_23
- objects_01_24
- objects_01_25
- objects_01_26
- objects_01_27
- objects_01_28
- objects_01_29
- objects_01_30
- objects_01_31
- objects_01_32
- objects_01_33
- objects_01_34
- objects_01_35
- objects_01_36
- objects_01_37
- objects_01_38
- objetos/manifest.json
- objetos.js
- render2d.js
- tingido
- _criaturaCrua
- drawWorld
- nevoaPass
- w2s
- test_tools.js

## God Nodes (most connected - your core abstractions)
1. `superficie-dia` - 107 edges
2. `superficie-noite` - 91 edges
3. `caverna` - 55 edges
4. `log()` - 40 edges
5. `abismo` - 32 edges
6. `_canvas2()` - 31 edges
7. `castSpell()` - 29 edges
8. `bindInput()` - 29 edges
9. `frame()` - 27 edges
10. `combate` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Vitrine KayKit (visualizador 3D de personagens)` --references--> `tileTexture()`  [EXTRACTED]
  tools/amostra/kaykit.html → src/art.js
- `useItem()` --indirect_call--> `P()`  [INFERRED]
  src/game.js → tests/test_tools.js
- `updateMobs()` --indirect_call--> `P()`  [INFERRED]
  src/game.js → tests/test_tools.js
- `playerAttack()` --indirect_call--> `P()`  [INFERRED]
  src/game.js → tests/test_tools.js
- `hitPlayer()` --indirect_call--> `P()`  [INFERRED]
  src/game.js → tests/test_tools.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Fluxo de entrada: seleção -> criação -> mundo -> morte** — index_menu_screen, index_create_screen, index_voc_carousel, index_death_screen [EXTRACTED 1.00]
- **Janelas modais que compartilham o padrão .win** — index_loot_win, index_shop_win, index_best_win, index_map_win, index_pick_win, index_ui_win, index_win_flex_column [EXTRACTED 1.00]
- **Convenções de agente do projeto (ponytail, headroom, graphify, confirmar, concisão)** — claude_ponytail, claude_headroom, claude_graphify, claude_concisao, claude_confirmar_antes_de_implementar, agents_ponytail, agents_headroom, agents_graphify, agents_confirmar_antes_de_implementar [EXTRACTED 1.00]
- **Ferramentas de amostra de arte do Thaira (avaliar asset antes de entrar no jogo)** — tools_amostra_kaykit_vitrine, tools_amostra_ranger_previa, tools_amostra_sprite_tester_tester, tools_audicao_auditor [INFERRED 0.85]
- **Fluxo de skin por preset: carregar modelo, clonar materiais, pintar por faixa de altura** — tools_amostra_kaykit_presets, tools_amostra_kaykit_aplicapreset, tools_amostra_kaykit_preparapecas, tools_amostra_kaykit_pintapreset, tools_amostra_kaykit_skin_por_peca [EXTRACTED 1.00]
- **Fluxo de curadoria de áudio: ouvir, classificar por ambiente/ganho, exportar manifestos** — tools_audicao_d, tools_audicao_tocar, tools_audicao_saidamus, tools_audicao_saidasfx, tools_audicao_manifest_music, tools_audicao_manifest_sfx [EXTRACTED 1.00]
- **Combat Stance Selector Icon Set (attack / balanced / defense)** — assets_green_background_stance_attack_stanceattackicon, assets_green_background_stance_balanced_stancebalancedicon, assets_green_background_stance_defense_stancedefenseicon, assets_green_background_stance_attack_combatstancesystem [INFERRED 0.95]
- **HUD Navigation Icon Row (bestiary, map, shop, settings)** — assets_green_background_ui_bestiary_bestiaryicon, assets_green_background_ui_map_mapicon, assets_green_background_ui_shop_shopicon, assets_green_background_ui_settings_settingsicon [INFERRED 0.75]
- **Binary Toggle Icon Pairs (follow/stand, sound on/off)** — assets_green_background_ui_follow_followicon, assets_green_background_ui_stand_standicon, assets_green_background_ui_sound_on_soundonicon, assets_green_background_ui_sound_off_soundofficon [INFERRED 0.85]
- **Thaira character animation sheet set (orc, ranger, warrior share the _anim.png atlas convention)** — assets_green_background__folhas_orc_anim_sheet, assets_green_background__folhas_ranger_anim_sheet, assets_green_background__folhas_warrior_anim_sheet, assets_green_background__folhas_warrior_anim_thaira_sprite_atlas [INFERRED 0.95]
- **Orc three-state animation cycle (walk, idle, attack rows across four facings)** — assets_green_background__folhas_orc_anim_walk_row, assets_green_background__folhas_orc_anim_idle_row, assets_green_background__folhas_orc_anim_attack_row, assets_green_background__folhas_orc_anim_four_direction_columns [EXTRACTED 1.00]
- **Warrior defeat state progression (idle to death sequence to skeletal undead variant)** — assets_green_background__folhas_warrior_anim_idle_row, assets_green_background__folhas_warrior_anim_death_row, assets_green_background__folhas_warrior_anim_skeleton_row, assets_green_background__folhas_warrior_anim_four_by_four_grid [INFERRED 0.85]
- **Thaira sound toggle: on state, off state, and the mute-toggle control they form** — assets_green_background__juntos_ui_sound_on___ui_sound_off_sheet, assets_green_background__juntos_ui_sound_on___ui_sound_off_ui_sound_on, assets_green_background__juntos_ui_sound_on___ui_sound_off_ui_sound_off, assets_green_background__juntos_ui_sound_on___ui_sound_off_audio_mute_toggle [INFERRED 0.85]
- **GG Golden Lion Legendary Equipment Set** — assets_icons_gg_amulet_ggamuleticon, assets_icons_gg_armor_ggarmoricon, assets_icons_gg_axe_ggaxeicon, assets_icons_gg_boots_ggbootsicon [INFERRED 0.95]
- **Weapon Slot Icon Family** — assets_icons_axe_axeicon, assets_icons_bow_bowicon, assets_icons_dagger_daggericon, assets_icons_gg_axe_ggaxeicon [INFERRED 0.85]
- **Ornate Gold Lion Armor Set (helmet, legs, shield, ring share black/gold/red palette and lion motif)** — assets_icons_gg_helmet_helmeticon, assets_icons_gg_legs_legsicon, assets_icons_gg_shield_shieldicon, assets_icons_gg_ring_ringicon [INFERRED 0.85]
- **Two-Handed Weapon Icon Family (greataxe, greatsword, halberd, maul, mace)** — assets_icons_gg_greataxe_greataxeicon, assets_icons_gg_greatsword_greatswordicon, assets_icons_gg_halberd_halberdicon, assets_icons_gg_maul_maulicon, assets_icons_gg_mace_maceicon [INFERRED 0.85]
- **Thaira Combat Stance Icon Set (attack / balanced / defense)** — assets_icons_stance_attack_stanceattackicon, assets_icons_stance_balanced_stancebalancedicon, assets_icons_stance_defense_stancedefenseicon [INFERRED 0.95]
- **Thaira Equipment / Inventory Item Icon Set** — assets_icons_sword_swordicon, assets_icons_shield_shieldicon, assets_icons_rune_fire_runefireicon [INFERRED 0.85]
- **Thaira UI Control Button Icon Set (bestiary, follow, map, settings, shop, sound)** — assets_icons_ui_bestiary_uibestiaryicon, assets_icons_ui_follow_uifollowicon, assets_icons_ui_map_uimapicon, assets_icons_ui_settings_uisettingsicon, assets_icons_ui_shop_uishopicon, assets_icons_ui_sound_off_uisoundofficon [INFERRED 0.95]
- **Ancestral Hunter Set — all equipment pieces** — assets_skins_sets_ancestral_hunter_set_ancestral_hunter_amulet_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_armor_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_backpack_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_boots_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_bow_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_hood_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_legs_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_quiver_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_ring_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_shield_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_set_ancestral_hunter_set_theme [EXTRACTED 1.00]
- **Golden Guardian set pieces (armor slots plus weapon variants sharing lion-and-gold heraldry)** — assets_skins_sets_golden_guardian_set_golden_guardian_helmet_helmet, assets_skins_sets_golden_guardian_set_golden_guardian_armor_armor, assets_skins_sets_golden_guardian_set_golden_guardian_legs_legs, assets_skins_sets_golden_guardian_set_golden_guardian_graves_graves, assets_skins_sets_golden_guardian_set_golden_guardian_backpack_backpack, assets_skins_sets_golden_guardian_set_golden_guardian_amulet_amulet, assets_skins_sets_golden_guardian_set_golden_guardian_ring_ring, assets_skins_sets_golden_guardian_set_golden_guardian_alabard_alabard, assets_skins_sets_golden_guardian_set_golden_guardian_mace_mace, assets_skins_sets_golden_guardian_set_golden_guardian_maul_maul, assets_skins_sets_golden_guardian_set_golden_guardian_ohaxe_ohaxe, assets_skins_sets_golden_guardian_set_golden_guardian_ohsword_ohsword [EXTRACTED 1.00]
- **Golden Guardian Set: individual piece sprites cut from the master reference sheet** — assets_skins_sets_golden_guardian_set_golden_guardian_set_sheet, assets_skins_sets_golden_guardian_set_golden_guardian_shield_shield, assets_skins_sets_golden_guardian_set_golden_guardian_thaxe_thaxe, assets_skins_sets_golden_guardian_set_golden_guardian_thsword_thsword [EXTRACTED 1.00]
- **Shared visual language: gilded lion head, blackened steel, gold filigree, ruby cabochon** — assets_skins_sets_golden_guardian_set_golden_guardian_set_lion_head_motif, assets_skins_sets_golden_guardian_set_golden_guardian_thsword_gold_ruby_palette, assets_skins_sets_golden_guardian_set_golden_guardian_shield_shield, assets_skins_sets_golden_guardian_set_golden_guardian_thaxe_thaxe, assets_skins_sets_golden_guardian_set_golden_guardian_thsword_thsword [INFERRED 0.85]

## Communities (164 total, 8 thin omitted)

### Community 0 - "Tela de ajuda / comandos (#help)"
Cohesion: 0.06
Nodes (48): Confirmar antes de implementar, graphify, headroom, ponytail, assets/build_sfx.py (montador de efeitos), Kenney (fonte de pacotes de áudio CC0), assets/music/manifest.json, OpenGameArt (fonte de SFX e trilha CC0) (+40 more)

### Community 1 - "art.js"
Cohesion: 0.03
Nodes (58): BORDER_CACHE, CAMPO_CACHE, CAMPO_DRAW, CAMPO_EIXO_Y, CAMPO_GIRA, carregaTerrenos(), CERCA_CACHE, CRIA_CACHE (+50 more)

### Community 2 - "test.js"
Cohesion: 0.04
Nodes (42): apAtk, apDef, B, C, chefes, comCharm, comum, ctx (+34 more)

### Community 3 - "aplicaPreset (carrega modelo do preset)"
Cohesion: 0.05
Nodes (46): aplicaPreset (carrega modelo do preset), carrega (baixa GLB com cache), Conjunto mínimo de animações: idle, walk, attack, hit, death, Comparação com o boneco procedural e a grade de 1 tile, HEROIS (catálogo de aventureiros KayKit), montaAnims (botões por clipe do GLB), montaPecas (lista de peças com swatches), PALETA_3D (paleta de cores para pintar peças) (+38 more)

### Community 4 - "audio.js"
Cohesion: 0.07
Nodes (39): ambience(), ambNodes, arp(), audioInit(), audioToggle(), audioVol(), audioVolReset(), _avisarSemSom() (+31 more)

### Community 5 - "game.js"
Cohesion: 0.05
Nodes (48): arrastaJanela(), BONUS_LABEL, BUFF_DESC, BUFF_ICO, BUFF_LABEL, BUFF_RUIM, CLIMA_AVISO, cycleVoc() (+40 more)

### Community 6 - "data.js"
Cohesion: 0.03
Nodes (55): AH, AI, BEST_DIFF, BEST_REVEAL, BEST_STAGE, BIOMA_POOLS, BO, CAMPO_ACIMA (+47 more)

### Community 7 - "drawFloor"
Cohesion: 0.15
Nodes (17): chamaTremor(), cumeTelhado(), cxDo(), drawCampos(), drawEntity(), drawFloor(), dropShadow(), faixaTelhado() (+9 more)

### Community 8 - "_corpo_morte"
Cohesion: 0.40
Nodes (5): _corpo_morte, de, lp, tom, v

### Community 9 - "world.js"
Cohesion: 0.06
Nodes (61): POIS, abrigado(), ambienteAgora(), ambienteDe(), calcDentro(), calcDistAgua(), carregaMundo(), CEU (+53 more)

### Community 10 - "abismo"
Cohesion: 0.06
Nodes (32): abismo, Cursed.mp3, Dance of the Undead.mp3, Dark.mp3, Dead Can Dance.mp3, Deadlands.mp3, Deep Wildy.mp3, Everlasting Fire.mp3 (+24 more)

### Community 11 - "Orc Animation Sprite Sheet"
Cohesion: 0.14
Nodes (21): Orc ATTACK Animation Row, Four-Direction Frame Grouping (side-left, front, back, side-right within each row), Orc IDLE Animation Row, Magenta Chroma-Key Background Convention, Orc (Axe-Wielding Green Humanoid Enemy), Row-Labeled Sheet Layout (WALK / IDLE / ATTACK captions baked into image), Orc Animation Sprite Sheet, Orc WALK Animation Row (+13 more)

### Community 12 - "_corpo_medio"
Cohesion: 0.10
Nodes (21): atk_axe, mix, n, v, atk_club, mix, n, v (+13 more)

### Community 13 - "updateMobs"
Cohesion: 0.20
Nodes (18): acordar(), campoEm(), criaCampo(), evitaCampo(), noTemplo(), occupied(), passoAte(), passoDeFuga() (+10 more)

### Community 14 - "Ancestral Hunter Set Sheet (4x4 icon atlas on magenta key)"
Cohesion: 0.33
Nodes (16): Ancestral Hunter Amulet (neck slot icon), Ancestral Hunter Armor (chest slot icon), Ancestral Hunter Backpack (back slot icon), Ancestral Hunter Boots (feet slot icon), Ancestral Hunter Bow (main-hand weapon icon), Ancestral Hunter Hood (head slot icon), Ancestral Hunter Legs (legs slot icon; art depicts a leaf mantle, not greaves), Ancestral Hunter Quiver (ammo/off-hand slot icon) (+8 more)

### Community 15 - "Combat Stance System (attack / balanced / defense selector)"
Cohesion: 0.19
Nodes (15): Combat Stance System (attack / balanced / defense selector), Attack Stance Icon (crossed swords, green-screen source art), Balanced Stance Icon (shield paired with sword, green-screen source art), Defense Stance Icon (bare heater shield, green-screen source art), Bestiary Icon (bookmarked tome with fanged orc skull on the cover), Companion Command Mode (follow vs stand ground), Follow Command Icon (running human pictogram), World Map Icon (folded treasure map with mountains, forest, lake, dashed route to an X) (+7 more)

### Community 16 - "Weapon Equipment Slot"
Cohesion: 0.19
Nodes (15): Greataxe Icon (ornate gold double-bladed battleaxe), Painted Semi-Realistic Fantasy MMO Icon Style, Greatsword Icon (broad steel blade, gold crossguard, red gem), Halberd Icon (polearm with dark axe head and spike), Ornate Helmet Icon (black and gold great helm with red plume), Ornate Gold Lion Equipment Set (black plate, gold filigree, red accents, lion motif), Weapon Equipment Slot, Leg Armor Icon (gold-trimmed black plate greaves with red cloth) (+7 more)

### Community 17 - "Golden Guardian Set (Thaira equipment set: blackened plate, gold lion heraldry, red gems)"
Cohesion: 0.38
Nodes (15): Golden Guardian Halberd (two-handed polearm skin: dark shaft, gold-filigreed steel axe head with heraldic crest), Golden Guardian Amulet (neck slot skin: braided gold chain, lion-face shield pendant with red gems), Red Gem Accent (ruby inlay used across the set), Golden Guardian Armor (chest slot skin: dark steel cuirass, gold lion breastplate, red tabard), Golden Guardian Set (Thaira equipment set: blackened plate, gold lion heraldry, red gems), Lion Head Crest Motif (shared golden guardian emblem), Golden Guardian Backpack (back slot skin: brown leather rucksack with gold lion faceplate and bedroll), Golden Guardian Greaves (feet slot skin: dark plated boots with gold lion knee guards) (+7 more)

### Community 18 - "combate"
Cohesion: 0.09
Nodes (23): combate, Attack1.mp3, Attack2.mp3, Attack3.mp3, Attack4.mp3, Attack5.mp3, Attack6.mp3, Castlewars.mp3 (+15 more)

### Community 19 - "compor.js"
Cohesion: 0.05
Nodes (48): andavel(), aplicaPatch(), caminho(), componentes(), conferObjetos(), conta(), ctx, decoBloqueia() (+40 more)

### Community 20 - "Energy Sorcerer Front Walk and Idle Reference Sheet"
Cohesion: 0.35
Nodes (12): Black Knight Archetype (dark plate melee), Reference Material, Not Shipped Assets, Black Knight Reference Sprite Sheet, Energy Sorcerer Archetype (lightning caster), Magenta Chroma-Key Background, Energy Sorcerer Front Walk and Idle Reference Sheet, Four-Row Directional Frame Grid, High-Detail 2.5D Pixel Art Style (+4 more)

### Community 21 - "Flat Monochrome Glyph Icon Style"
Cohesion: 0.32
Nodes (14): Painted Equipment Icon Art Style, Fire Rune Icon, Shield Icon, Flat Monochrome Glyph Icon Style, Attack Stance Icon, Balanced Stance Icon, Defense Stance Icon, Sword Icon (+6 more)

### Community 22 - "build_ref_estilo.py"
Cohesion: 0.67
Nodes (3): main(), Monta a tira de referência de ESTILO: assets/skins/_ref_estilo.png python…, recorta()

### Community 23 - "ui.js"
Cohesion: 0.08
Nodes (55): IMBUEMENTS, LOOT_RARITY, aplicaCam(), arrastoEmTiles(), bestDiff(), bestiaryKill(), bestKills(), bestStage() (+47 more)

### Community 24 - "cssCol"
Cohesion: 0.27
Nodes (12): bloodSpray(), cssCol(), estadoIco(), estiloEstado(), impacto(), manchaChao(), marcaEstado(), renderStatus() (+4 more)

### Community 25 - "Axe Icon (Double-Bladed Wood Axe)"
Cohesion: 0.24
Nodes (11): Armor Icon (Steel Plate Cuirass), Axe Icon (Double-Bladed Wood Axe), Bone Icon (Loot Material), Boots Icon (Buckled Travel Boots), Bow Icon (Recurve Wooden Bow), Dagger Icon (Gold-Hilted Dagger), Gem Icon (Faceted Blue Gemstone), GG Amulet Icon (Golden Lion Shield Pendant) (+3 more)

### Community 26 - "sfx/manifest.json"
Cohesion: 0.11
Nodes (18): atk_sword, n, v, atk_wand, n, v, buff, n (+10 more)

### Community 27 - "skinAtual"
Cohesion: 0.67
Nodes (3): skinAtual(), skinConjunto(), skinDoDegrau()

### Community 28 - "hud.js"
Cohesion: 0.26
Nodes (11): HUD, HUD_BITS, HUD_DEF(), HUD_PANELS, hudApply(), hudLoad(), hudMove(), hudOptions() (+3 more)

### Community 29 - "Golden Guardian Set Reference Sheet"
Cohesion: 0.40
Nodes (10): Golden Guardian Equipment Slot Taxonomy (Mochila, Amuleto, Anel, Elmo, Armadura, Calca, Botas, Escudo, weapons), Lion-Head Heraldic Motif (Guardiao Dourado theme), Golden Guardian Set Reference Sheet, 15-Slot Sheet Layout, 384x256px Magenta Chroma Cells, Off-Hand Shield Slot, Golden Guardian Shield (Escudo) Skin Icon, Golden Guardian Two-Handed Axe (Machado Duplo) Skin Icon, Two-Handed Weapon Slot (+2 more)

### Community 30 - "crit"
Cohesion: 0.40
Nodes (5): crit, mix, n, v, _corpo_forte

### Community 31 - "Thaira Sound Toggle Icon Sheet (on + off)"
Cohesion: 0.39
Nodes (8): Audio Mute Toggle (two-state UI control), Chroma-Key Green Background Convention, Combined Two-State Sprite Sheet Packing, Flat White Monochrome Glyph Style, Thaira Sound Toggle Icon Sheet (on + off), Thaira Browser RPG HUD / Settings Controls, ui_sound_off (speaker with X / muted), ui_sound_on (speaker with sound waves)

### Community 32 - "build_criaturas.py"
Cohesion: 0.11
Nodes (25): main(), alinha(), cabe(), confere(), eixo(), _erode(), folha(), linha() (+17 more)

### Community 33 - "corrige_oliva.py"
Cohesion: 0.60
Nodes (4): corrige(), hsv(), main(), Tira o cast OLIVA de uma armadura que deveria ser preta, poupando o dourado.…

### Community 34 - "6. Folha de animação (personagem e criatura)"
Cohesion: 0.07
Nodes (29): 1. Arte nova (item, troféu, equipamento), 2. Item novo, 3. Criatura nova, 4. Hunt nova, 5. Conjunto com bônus por peça, 6. Folha de animação (personagem e criatura), 7. As cinco skins de cada vocação, ANTES de julgar passada: meça por COR, não por silhueta (+21 more)

### Community 35 - ".constructor"
Cohesion: 0.40
Nodes (4): Any, chain(), ctx2d(), vec()

### Community 36 - "build_icons.py"
Cohesion: 0.60
Nodes (4): main(), paletiza(), Tira o fundo verde de assets/green_background/*.png e grava em assets/icons/.…, sem_fundo()

### Community 37 - "Áudio — procedência e licença"
Cohesion: 0.40
Nodes (4): Como trocar um som, Efeitos — `assets/sfx/`, Trilha — `assets/music/`, Áudio — procedência e licença

### Community 38 - "renderHotbar"
Cohesion: 0.18
Nodes (14): SPELLS, abrirPicker(), HOT_KEYS_DEFAULT, hotAjusta(), hotDefault(), hotEntry(), hotKeyLabel(), knownSpells() (+6 more)

### Community 39 - "item"
Cohesion: 0.28
Nodes (8): conjunto(), GG(), item(), rune(), spriteImg(), spriteOf(), ICONES, ICONES2X

### Community 40 - "heal"
Cohesion: 0.50
Nodes (4): heal, ext, n, v

### Community 41 - "potion"
Cohesion: 0.50
Nodes (4): potion, ext, n, v

### Community 42 - "spell_holy"
Cohesion: 0.50
Nodes (4): spell_holy, ext, n, v

### Community 43 - "atk_distance"
Cohesion: 0.67
Nodes (3): atk_distance, n, v

### Community 44 - "build_magias.py"
Cohesion: 0.16
Nodes (41): cast_aoe(), cast_bolt(), cast_conjure(), cast_taunt(), cast_wave(), coloca(), confere(), env() (+33 more)

### Community 45 - "die"
Cohesion: 0.40
Nodes (5): die, mix, n, v, _corpo_morte

### Community 46 - "castSpell"
Cohesion: 0.21
Nodes (17): DANO_TIPOS, abrirMagia(), castSpell(), custoDe(), damageFormula(), estadoDaMagia(), fichaLinhas(), magiaHTML() (+9 more)

### Community 47 - "coin"
Cohesion: 0.50
Nodes (4): coin, ext, n, v

### Community 48 - "_corpo_forte"
Cohesion: 0.67
Nodes (3): _corpo_forte, n, v

### Community 49 - "varrokgaard.js"
Cohesion: 0.02
Nodes (64): achados, alvo, archotes, BOSQUE, buracos, C, CABO, CAMPO (+56 more)

### Community 50 - "energy"
Cohesion: 0.67
Nodes (3): energy, n, v

### Community 51 - "equip"
Cohesion: 0.67
Nodes (3): equip, n, v

### Community 52 - "error"
Cohesion: 0.67
Nodes (3): error, n, v

### Community 53 - "fire"
Cohesion: 0.67
Nodes (3): fire, n, v

### Community 54 - "hurt"
Cohesion: 0.67
Nodes (3): hurt, n, v

### Community 55 - "fixSave"
Cohesion: 0.21
Nodes (17): askConfirm(), charId(), deleteCharacter(), exportarPersonagens(), fixSave(), importarPersonagens(), listCharacters(), load() (+9 more)

### Community 56 - "freesound.py"
Cohesion: 0.80
Nodes (4): baixa(), busca(), key(), pegar()

### Community 57 - "loot"
Cohesion: 0.50
Nodes (4): loot, ext, n, v

### Community 58 - "ui_click"
Cohesion: 0.50
Nodes (4): ui_click, ext, n, v

### Community 59 - "ui_close"
Cohesion: 0.50
Nodes (4): ui_close, ext, n, v

### Community 60 - "skillup"
Cohesion: 0.67
Nodes (3): skillup, n, v

### Community 61 - "bindInput"
Cohesion: 0.17
Nodes (15): alvosPerto(), bancadaFps(), bindInput(), clickTile(), corpseAt(), desocupaPorta(), distAcao(), emZonaSegura() (+7 more)

### Community 62 - "cast_aoe"
Cohesion: 0.50
Nodes (4): cast_aoe, ext, n, v

### Community 63 - "cast_bolt"
Cohesion: 0.50
Nodes (4): cast_bolt, ext, n, v

### Community 64 - "_corpo_medio"
Cohesion: 0.67
Nodes (3): _corpo_medio, n, v

### Community 65 - "bag"
Cohesion: 0.50
Nodes (4): bag, ext, n, v

### Community 66 - "stairs"
Cohesion: 0.67
Nodes (3): stairs, n, v

### Community 67 - "eat"
Cohesion: 0.50
Nodes (4): eat, ext, n, v

### Community 68 - "ice"
Cohesion: 0.67
Nodes (3): ice, n, v

### Community 69 - "death"
Cohesion: 0.67
Nodes (3): death, n, v

### Community 70 - "frame"
Cohesion: 0.18
Nodes (17): aplicaEstado(), bindMiniMap(), campoDano(), clamp(), empurrar(), fecharLoot(), frame(), lerpEntity() (+9 more)

### Community 71 - "unequip"
Cohesion: 0.67
Nodes (3): unequip, n, v

### Community 75 - "build_skins.py"
Cohesion: 0.08
Nodes (35): cor_de_fundo(), main(), quadrado(), Recorta a folha de moedas em três montes e tinge os três metais. 1. salve a…, A cor mais comum da folha. É o fundo por construção: ele é a maior área., Recorta a caixa e centraliza no slot, sem esticar., recorta_montes(), tinge() (+27 more)

### Community 76 - "build_terreno.py"
Cohesion: 0.06
Nodes (59): catalogo(), cor_material(), despolui(), encaixa(), franja_magenta(), grava_fonte(), main(), mascara_objeto() (+51 more)

### Community 77 - "cast_conjure"
Cohesion: 0.50
Nodes (4): cast_conjure, ext, n, v

### Community 78 - "rune"
Cohesion: 0.67
Nodes (3): rune, n, v

### Community 79 - "cast_taunt"
Cohesion: 0.50
Nodes (4): cast_taunt, ext, n, v

### Community 80 - "cast_wave"
Cohesion: 0.50
Nodes (4): cast_wave, ext, n, v

### Community 81 - "hab_area"
Cohesion: 0.50
Nodes (4): hab_area, ext, n, v

### Community 82 - "mob"
Cohesion: 0.67
Nodes (3): boss(), elemental(), mob()

### Community 84 - "serve.py"
Cohesion: 0.25
Nodes (8): NoCache, http.server com Cache-Control: no-store e gravacao de patch de mapa. `python -m…, Roda o script de composicao e devolve o que ele disse. O `nome` ja passou pelo…, O FORMATO DO PATCH. Gemeo do tools/patch_fmt.js, e o teste compara as duas…, TODAS as camadas: contando so `tiles`, uma sessao inteira de objeto passava…, recompoe(), serializa_patch(), soma_patch()

### Community 85 - "spell_ice"
Cohesion: 0.50
Nodes (4): spell_ice, ext, n, v

### Community 86 - "package.json"
Cohesion: 0.15
Nodes (12): electron, description, devDependencies, electron, main, name, private, scripts (+4 more)

### Community 87 - "main.js"
Cohesion: 0.10
Nodes (25): abrirEditor(), abrirJanela(), { app, BrowserWindow, Menu, dialog }, avisaPortaOcupada(), DEV, { execFile }, fs, gravaPatch() (+17 more)

### Community 88 - "lootEV"
Cohesion: 0.67
Nodes (3): lootEV(), lootQtd(), lootVal()

### Community 89 - "superficie-dia"
Cohesion: 0.02
Nodes (107): superficie-dia, Adventure.mp3, Anywhere.mp3, Arrival.mp3, Artistry.mp3, Autumn Voyage.mp3, Background.mp3, Ballad of Enchantment.mp3 (+99 more)

### Community 91 - "_mulberry"
Cohesion: 0.17
Nodes (15): campoSprite(), decoSprite(), flowTexture(), foamSprite(), _hash(), _mulberry(), nevoaTexture(), _poly() (+7 more)

### Community 92 - "silhouette"
Cohesion: 0.50
Nodes (4): FADE_CACHE, SIL_CACHE, silhouette(), silhuetaFade()

### Community 93 - "_canvas2"
Cohesion: 0.17
Nodes (27): barrilSprite(), _canvas2(), carrocaSprite(), cercaSprite(), _chapado(), _cracks(), creatureSheet(), creatureSprite() (+19 more)

### Community 94 - "log"
Cohesion: 0.10
Nodes (54): abalo(), abrirTesouro(), addExp(), addMagic(), addSkillTry(), afterStep(), alocaNo(), bagAdd() (+46 more)

### Community 95 - "Texturas de UI — o que gerar"
Cohesion: 0.25
Nodes (7): 1. `leather_dark.png` — superfície de painel, 2. `stone_dark.png` — moldura externa, 3. `grain.png` — grão geral, A armadilha que a arte precisa respeitar, O que NÃO gerar por enquanto, Regras que valem para os três arquivos, Texturas de UI — o que gerar

### Community 96 - "arraste.js"
Cohesion: 0.25
Nodes (3): arrItemDaCelula(), arrZona(), ZONAS

### Community 97 - "hab_cura"
Cohesion: 0.50
Nodes (4): hab_cura, ext, n, v

### Community 98 - "congela_mapa.js"
Cohesion: 0.18
Nodes (10): alvo, ctx, dir, fs, kb, mapa, path, raiz (+2 more)

### Community 99 - "emTerra"
Cohesion: 0.67
Nodes (3): discoTerra(), emTerra(), MAR

### Community 100 - "superficie-noite"
Cohesion: 0.02
Nodes (91): superficie-noite, 7th Realm.mp3, Alone.mp3, Back to Life.mp3, Beyond.mp3, Complication.mp3, Dangerous.mp3, Dangerous Road.mp3 (+83 more)

### Community 101 - "Sessão 2026-08-29 — auditoria gráfica por time (luz, sombra, clima)"
Cohesion: 0.11
Nodes (17): 1. O que o dono pediu, 2.1 Máscara de telhado alinhada — `telhadoNaLuz`, 2.2 Clima por tile — `recorteCeu`, 2.3 `cantoDoTile` e `janelaDeTiles`, 2.4 Duas réguas novas em `tests/test.js`, 2. Estado: o que ENTROU no código, 3. Confirmado, medido e AINDA ABERTO, 4. Propostas do Designer 2D, ainda NÃO triadas (+9 more)

### Community 102 - "Rodada 5 — tile, parede e objeto · 2026-08-31"
Cohesion: 0.17
Nodes (11): As duas decisões que valem para a rodada, Como retomar, CORREÇÃO — entra direto, Designer 2D — o que voltou (medido, 2026-08-31), Estado, honesto, HIPÓTESES DERRUBADAS — não gaste a volta de novo, Já sabido — não gaste volta trazendo como achado novo, MUDANÇA DE ESTRUTURA — proposta, parada (+3 more)

### Community 103 - "caverna"
Cohesion: 0.04
Nodes (55): caverna, Big Chords.mp3, Brimstail's Scales.mp3, Cave Background.mp3, Cave of the Beasts.mp3, Cave of the Goblins.mp3, Cavern.mp3, Cellar Song.mp3 (+47 more)

### Community 104 - "levelup"
Cohesion: 0.67
Nodes (3): levelup, n, v

### Community 105 - "confere_folha.py"
Cohesion: 0.43
Nodes (7): bota_a_frente(), difere(), main(), norm(), Confere uma folha recém-gerada ANTES de cortar. python assets/confere_folha.py…, Numa vista frontal, a bota à frente é a que desce mais., separa()

### Community 106 - "hab_fase"
Cohesion: 0.50
Nodes (4): hab_fase, ext, n, v

### Community 108 - "hab_lento"
Cohesion: 0.50
Nodes (4): hab_lento, ext, n, v

### Community 109 - "combate-abismo"
Cohesion: 0.13
Nodes (14): combate-abismo, Army of Darkness.mp3, Creature Cruelty.mp3, Dagannoth Dawn.mp3, Dance of Death.mp3, Fear and Loathing.mp3, Mage Arena.mp3, Method of Madness.mp3 (+6 more)

### Community 110 - "itemStats"
Cohesion: 0.13
Nodes (19): PREFIXES, SUFFIXES, cellsVazias(), CELULA, descLoot(), fmtBon(), itemCell(), itemStats() (+11 more)

### Community 111 - "hab_mana"
Cohesion: 0.50
Nodes (4): hab_mana, ext, n, v

### Community 112 - "spell_death"
Cohesion: 0.50
Nodes (4): spell_death, ext, n, v

### Community 113 - "spell_earth"
Cohesion: 0.50
Nodes (4): spell_earth, ext, n, v

### Community 114 - "spell_fire"
Cohesion: 0.50
Nodes (4): spell_fire, ext, n, v

### Community 115 - "spell_physical"
Cohesion: 0.50
Nodes (4): spell_physical, ext, n, v

### Community 116 - "_canvas"
Cohesion: 0.27
Nodes (11): bordaProf(), borderSprite(), _canvas(), CLOUD_CACHE, cloudTexture(), contactShadow(), edgeMask(), edgeShadow() (+3 more)

### Community 117 - "objects_01_22"
Cohesion: 0.15
Nodes (13): objects_01_22, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 118 - "objects_01_01"
Cohesion: 0.15
Nodes (13): objects_01_01, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 119 - "objects_01_02"
Cohesion: 0.15
Nodes (13): objects_01_02, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 120 - "objects_01_03"
Cohesion: 0.15
Nodes (13): objects_01_03, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 121 - "objects_01_04"
Cohesion: 0.15
Nodes (13): objects_01_04, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 122 - "objects_01_05"
Cohesion: 0.15
Nodes (13): objects_01_05, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 123 - "objects_01_06"
Cohesion: 0.15
Nodes (13): objects_01_06, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 124 - "objects_01_07"
Cohesion: 0.15
Nodes (13): objects_01_07, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 125 - "objects_01_08"
Cohesion: 0.15
Nodes (13): objects_01_08, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 126 - "objects_01_09"
Cohesion: 0.15
Nodes (13): objects_01_09, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 127 - "objects_01_10"
Cohesion: 0.15
Nodes (13): objects_01_10, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 128 - "objects_01_11"
Cohesion: 0.15
Nodes (13): objects_01_11, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 129 - "objects_01_12"
Cohesion: 0.15
Nodes (13): objects_01_12, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 130 - "objects_01_13"
Cohesion: 0.15
Nodes (13): objects_01_13, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 131 - "objects_01_14"
Cohesion: 0.15
Nodes (13): objects_01_14, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 132 - "objects_01_15"
Cohesion: 0.15
Nodes (13): objects_01_15, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 133 - "objects_01_16"
Cohesion: 0.15
Nodes (13): objects_01_16, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 134 - "objects_01_17"
Cohesion: 0.15
Nodes (13): objects_01_17, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 135 - "objects_01_18"
Cohesion: 0.15
Nodes (13): objects_01_18, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 136 - "objects_01_19"
Cohesion: 0.15
Nodes (13): objects_01_19, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 137 - "objects_01_20"
Cohesion: 0.15
Nodes (13): objects_01_20, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 138 - "objects_01_21"
Cohesion: 0.15
Nodes (13): objects_01_21, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 139 - "objects_01_23"
Cohesion: 0.15
Nodes (13): objects_01_23, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 140 - "objects_01_24"
Cohesion: 0.15
Nodes (13): objects_01_24, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 141 - "objects_01_25"
Cohesion: 0.15
Nodes (13): objects_01_25, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 142 - "objects_01_26"
Cohesion: 0.15
Nodes (13): objects_01_26, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 143 - "objects_01_27"
Cohesion: 0.15
Nodes (13): objects_01_27, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 144 - "objects_01_28"
Cohesion: 0.15
Nodes (13): objects_01_28, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 145 - "objects_01_29"
Cohesion: 0.15
Nodes (13): objects_01_29, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 146 - "objects_01_30"
Cohesion: 0.15
Nodes (13): objects_01_30, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 147 - "objects_01_31"
Cohesion: 0.15
Nodes (13): objects_01_31, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 148 - "objects_01_32"
Cohesion: 0.15
Nodes (13): objects_01_32, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 149 - "objects_01_33"
Cohesion: 0.15
Nodes (13): objects_01_33, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 150 - "objects_01_34"
Cohesion: 0.15
Nodes (13): objects_01_34, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 151 - "objects_01_35"
Cohesion: 0.15
Nodes (13): objects_01_35, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 152 - "objects_01_36"
Cohesion: 0.15
Nodes (13): objects_01_36, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 153 - "objects_01_37"
Cohesion: 0.15
Nodes (13): objects_01_37, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 154 - "objects_01_38"
Cohesion: 0.15
Nodes (13): objects_01_38, artW, c, cx, escuroNaBase, feet, franja, h (+5 more)

### Community 155 - "objetos/manifest.json"
Cohesion: 0.29
Nodes (6): objects_01_39, h, png, sombra, span, w

### Community 157 - "render2d.js"
Cohesion: 0.12
Nodes (19): AGUA_CINTILO_A, balancoEm(), CAM, camadaNuvem(), ceuRGB, CHAO_ESCALA, CHAO_ITEM, CHAO_MOEDA (+11 more)

### Community 159 - "_criaturaCrua"
Cohesion: 0.18
Nodes (13): bloomPass(), _criaturaCrua(), facingOf(), frameOf(), halo(), HALO_CACHE, haloGrad(), lightPass() (+5 more)

### Community 160 - "drawWorld"
Cohesion: 0.18
Nodes (12): ceuNorm(), derivaAvanca(), dprInt(), drawWorld(), entityBucket(), gradeEmGL(), gradePass(), gradeShader() (+4 more)

### Community 161 - "nevoaPass"
Cohesion: 0.19
Nodes (13): cantoDoTile(), ceuNoTile(), daCasa(), ehParede(), faceExposta(), janelaDeTiles(), nevoaDens(), nevoaHora() (+5 more)

### Community 162 - "w2s"
Cohesion: 0.21
Nodes (12): creatureSpriteFor(), drawBlood(), drawEffects(), evToCanvas(), hoverTile(), paraCss(), plateAnchor(), project() (+4 more)

### Community 163 - "test_tools.js"
Cohesion: 0.18
Nodes (9): a, b, conta(), falhas, fs, html, path, pincel (+1 more)

## Ambiguous Edges - Review These
- `graphify` → `Thaira — RPG isométrico (shell da aplicação)`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to
- `DIRECTIONS (esquerda, frente, trás, direita como colunas)` → `Layout da spritesheet: linha = animação, coluna = frame/direção`  [AMBIGUOUS]
  tools/amostra/sprite-tester.html · relation: conceptually_related_to
- `World Map Icon (folded treasure map with mountains, forest, lake, dashed route to an X)` → `Companion Command Mode (follow vs stand ground)`  [AMBIGUOUS]
  assets/green_background/ui_map.png · relation: conceptually_related_to
- `Orc Animation Sprite Sheet` → `Warrior Death Sequence (kneel, collapse, fall, prone corpse)`  [AMBIGUOUS]
  assets/green_background/_folhas/warrior_anim.png · relation: conceptually_related_to
- `Magenta Chroma-Key Background Convention` → `Flat Green Background Variant (folder-matching key color, not magenta)`  [AMBIGUOUS]
  assets/green_background/_folhas/ranger_anim.png · relation: semantically_similar_to
- `Basic Helmet Icon (plain steel crusader great helm)` → `Painted Semi-Realistic Fantasy MMO Icon Style`  [AMBIGUOUS]
  assets/icons/helmet.png · relation: conceptually_related_to
- `Fire Rune Icon` → `Bestiary Button Icon`  [AMBIGUOUS]
  assets/icons/ui_bestiary.png · relation: conceptually_related_to
- `Ancestral Hunter Legs (legs slot icon; art depicts a leaf mantle, not greaves)` → `Ancestral Hunter Set Sheet (4x4 icon atlas on magenta key)`  [AMBIGUOUS]
  assets/skins/sets/ancestral_hunter_set/ancestral_hunter_legs.png · relation: references
- `Ancestral Hunter Shield (off-hand slot icon)` → `Ranger / Archer Archetype (bow-and-quiver light-armor loadout)`  [AMBIGUOUS]
  assets/skins/sets/ancestral_hunter_set/ancestral_hunter_shield.png · relation: conceptually_related_to
- `Four-Row Directional Frame Grid` → `Energy Sorcerer Front Walk and Idle Reference Sheet`  [AMBIGUOUS]
  tools/amostra/energy_sorcerer_front_walk_and_idle.png · relation: conceptually_related_to

## Knowledge Gaps
- **1327 isolated node(s):** `Adventure.mp3`, `Anywhere.mp3`, `Arrival.mp3`, `Artistry.mp3`, `Autumn Voyage.mp3` (+1322 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `graphify` and `Thaira — RPG isométrico (shell da aplicação)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `DIRECTIONS (esquerda, frente, trás, direita como colunas)` and `Layout da spritesheet: linha = animação, coluna = frame/direção`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `World Map Icon (folded treasure map with mountains, forest, lake, dashed route to an X)` and `Companion Command Mode (follow vs stand ground)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Orc Animation Sprite Sheet` and `Warrior Death Sequence (kneel, collapse, fall, prone corpse)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Magenta Chroma-Key Background Convention` and `Flat Green Background Variant (folder-matching key color, not magenta)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Basic Helmet Icon (plain steel crusader great helm)` and `Painted Semi-Realistic Fantasy MMO Icon Style`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Fire Rune Icon` and `Bestiary Button Icon`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._