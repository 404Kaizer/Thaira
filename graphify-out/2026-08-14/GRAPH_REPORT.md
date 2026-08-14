# Graph Report - Jogo  (2026-08-14)

## Corpus Check
- 38 files · ~3,414,097 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 943 nodes · 1631 edges · 79 communities (77 shown, 2 thin omitted)
- Extraction: 87% EXTRACTED · 12% INFERRED · 1% AMBIGUOUS · INFERRED: 193 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c469c07c`
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
- render2d.js
- log
- world.js
- superficie-dia
- Orc Animation Sprite Sheet
- _corpo_medio
- killMob
- Ancestral Hunter Set Sheet (4x4 icon atlas on magenta key)
- Combat Stance System (attack / balanced / defense selector)
- Weapon Equipment Slot
- Golden Guardian Set (Thaira equipment set: blackened plate, gold lion heraldry, red gems)
- bindInput
- itemStats
- Snow Druid Reference Sprite Sheet
- Flat Monochrome Glyph Icon Style
- Knight Veteran Skin (voc_knight_veteran)
- ui.js
- frame
- GG Boots Icon (Golden Lion Greaves)
- sfx/manifest.json
- Knight Vocation - Common Skin (Front-Facing Sprite Set)
- hud.js
- Golden Guardian Set Reference Sheet
- crit
- Thaira Sound Toggle Icon Sheet (on + off)
- build_criaturas.py
- Knight Veteran Walk-Back Animation
- Como adicionar coisas em Thaira
- .constructor
- build_icons.py
- Áudio — procedência e licença
- Druid Vocation Icon (leafy wooden staff)
- atk_axe
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
- step_rock
- step_stone
- unequip
- UI Sound On Icon (speaker with sound waves)
- laco (render loop do visualizador 3D)
- renderHotbar
- build_skins.py
- build_folhas.py
- finishStart
- habilidade

## God Nodes (most connected - your core abstractions)
1. `log()` - 31 edges
2. `castSpell()` - 23 edges
3. `bindInput()` - 22 edges
4. `frame()` - 20 edges
5. `recalc()` - 17 edges
6. `renderBars()` - 15 edges
7. `killMob()` - 14 edges
8. `finishStart()` - 14 edges
9. `Golden Guardian Set (Thaira equipment set: blackened plate, gold lion heraldry, red gems)` - 14 edges
10. `useRune()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Vitrine KayKit (visualizador 3D de personagens)` --references--> `tileTexture()`  [EXTRACTED]
  tools/amostra/kaykit.html → src/art.js
- `Thaira — RPG isométrico (shell da aplicação)` --conceptually_related_to--> `graphify`  [AMBIGUOUS]
  index.html → CLAUDE.md
- `Confirmar antes de implementar` --semantically_similar_to--> `Confirmar antes de implementar`  [EXTRACTED] [semantically similar]
  CLAUDE.md → AGENTS.md
- `ponytail` --semantically_similar_to--> `ponytail`  [EXTRACTED] [semantically similar]
  CLAUDE.md → AGENTS.md
- `headroom` --semantically_similar_to--> `headroom`  [EXTRACTED] [semantically similar]
  CLAUDE.md → AGENTS.md

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
- **Boots Slot Rarity Ladder** — assets_icons_boots_leather_leatherbootsicon, assets_icons_boots_bootsicon, assets_icons_gg_boots_ggbootsicon [INFERRED 0.85]
- **Ornate Gold Lion Armor Set (helmet, legs, shield, ring share black/gold/red palette and lion motif)** — assets_icons_gg_helmet_helmeticon, assets_icons_gg_legs_legsicon, assets_icons_gg_shield_shieldicon, assets_icons_gg_ring_ringicon [INFERRED 0.85]
- **Two-Handed Weapon Icon Family (greataxe, greatsword, halberd, maul, mace)** — assets_icons_gg_greataxe_greataxeicon, assets_icons_gg_greatsword_greatswordicon, assets_icons_gg_halberd_halberdicon, assets_icons_gg_maul_maulicon, assets_icons_gg_mace_maceicon [INFERRED 0.85]
- **Thaira Combat Stance Icon Set (attack / balanced / defense)** — assets_icons_stance_attack_stanceattackicon, assets_icons_stance_balanced_stancebalancedicon, assets_icons_stance_defense_stancedefenseicon [INFERRED 0.95]
- **Thaira Equipment / Inventory Item Icon Set** — assets_icons_sword_swordicon, assets_icons_shield_shieldicon, assets_icons_rune_fire_runefireicon [INFERRED 0.85]
- **Thaira UI Control Button Icon Set (bestiary, follow, map, settings, shop, sound)** — assets_icons_ui_bestiary_uibestiaryicon, assets_icons_ui_follow_uifollowicon, assets_icons_ui_map_uimapicon, assets_icons_ui_settings_uisettingsicon, assets_icons_ui_shop_uishopicon, assets_icons_ui_sound_off_uisoundofficon [INFERRED 0.95]
- **Thaira vocation icon set (knight, ranger, druid, sorcerer)** — assets_icons_voc_knight_icon, assets_icons_voc_ranger_icon, assets_icons_voc_druid_icon, assets_icons_voc_sorcerer_icon [INFERRED 0.95]
- **Thaira flat monochrome UI glyph family** — assets_icons_ui_sound_on_icon, assets_icons_ui_stand_icon, assets_icons_voc_knight_icon [AMBIGUOUS 0.30]
- **Ancestral Hunter Set — all equipment pieces** — assets_skins_sets_ancestral_hunter_set_ancestral_hunter_amulet_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_armor_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_backpack_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_boots_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_bow_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_hood_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_legs_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_quiver_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_ring_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_shield_icon, assets_skins_sets_ancestral_hunter_set_ancestral_hunter_set_ancestral_hunter_set_theme [EXTRACTED 1.00]
- **Golden Guardian set pieces (armor slots plus weapon variants sharing lion-and-gold heraldry)** — assets_skins_sets_golden_guardian_set_golden_guardian_helmet_helmet, assets_skins_sets_golden_guardian_set_golden_guardian_armor_armor, assets_skins_sets_golden_guardian_set_golden_guardian_legs_legs, assets_skins_sets_golden_guardian_set_golden_guardian_graves_graves, assets_skins_sets_golden_guardian_set_golden_guardian_backpack_backpack, assets_skins_sets_golden_guardian_set_golden_guardian_amulet_amulet, assets_skins_sets_golden_guardian_set_golden_guardian_ring_ring, assets_skins_sets_golden_guardian_set_golden_guardian_alabard_alabard, assets_skins_sets_golden_guardian_set_golden_guardian_mace_mace, assets_skins_sets_golden_guardian_set_golden_guardian_maul_maul, assets_skins_sets_golden_guardian_set_golden_guardian_ohaxe_ohaxe, assets_skins_sets_golden_guardian_set_golden_guardian_ohsword_ohsword [EXTRACTED 1.00]
- **Golden Guardian Set: individual piece sprites cut from the master reference sheet** — assets_skins_sets_golden_guardian_set_golden_guardian_set_sheet, assets_skins_sets_golden_guardian_set_golden_guardian_shield_shield, assets_skins_sets_golden_guardian_set_golden_guardian_thaxe_thaxe, assets_skins_sets_golden_guardian_set_golden_guardian_thsword_thsword [EXTRACTED 1.00]
- **Shared visual language: gilded lion head, blackened steel, gold filigree, ruby cabochon** — assets_skins_sets_golden_guardian_set_golden_guardian_set_lion_head_motif, assets_skins_sets_golden_guardian_set_golden_guardian_thsword_gold_ruby_palette, assets_skins_sets_golden_guardian_set_golden_guardian_shield_shield, assets_skins_sets_golden_guardian_set_golden_guardian_thaxe_thaxe, assets_skins_sets_golden_guardian_set_golden_guardian_thsword_thsword [INFERRED 0.85]
- **Knight Common Skin Front-Facing Animation State Set (idle / walk / dead)** — assets_skins_voc_knight_voc_knight_commom_idle_front_01_knight_common_skin, assets_skins_voc_knight_voc_knight_commom_idle_front_01_idle_front_state, assets_skins_voc_knight_voc_knight_commom_walk_front_01_walk_front_state, assets_skins_voc_knight_voc_knight_commom_dead_front_01_dead_front_state, assets_skins_voc_knight_voc_knight_commom_idle_front_01_front_facing_direction [INFERRED 0.95]
- **Sprite Asset Conventions (naming, transparency, 4-frame loops)** — assets_skins_voc_knight_voc_knight_commom_idle_front_02_frame_naming_convention, assets_skins_voc_knight_voc_knight_commom_idle_front_03_transparent_background_convention, assets_skins_voc_knight_voc_knight_commom_idle_front_04_idle_loop_cycle, assets_skins_voc_knight_voc_knight_commom_walk_front_04_walk_loop_cycle [INFERRED 0.85]
- **Knight Veteran Animation State Set (idle / walk / dead x front / back)** — assets_skins_voc_knight_voc_knight_veteran_idle_front_01_idle_front_animation, assets_skins_voc_knight_voc_knight_veteran_idle_back_01_idle_back_animation, assets_skins_voc_knight_voc_knight_veteran_walk_back_01_walk_back_animation, assets_skins_voc_knight_voc_knight_veteran_dead_front_01_dead_front_pose, assets_skins_voc_knight_voc_knight_veteran_dead_back_01_dead_back_pose, assets_skins_voc_knight_voc_knight_veteran_idle_front_01_voc_knight_veteran_skin [EXTRACTED 1.00]
- **Loopable Frame-Sequence Convention (indexed frames cycling in place)** — assets_skins_voc_knight_voc_knight_veteran_idle_back_03_idle_loop_four_frame, assets_skins_voc_knight_voc_knight_veteran_walk_back_02_walk_cycle_alternating_step, assets_skins_voc_knight_voc_knight_veteran_idle_front_02_idle_frame_micro_variation, assets_skins_voc_knight_voc_knight_veteran_idle_front_03_frame_naming_convention [INFERRED 0.85]
- **Death State Group (single-frame prone poses with blood pool)** — assets_skins_voc_knight_voc_knight_veteran_dead_front_01_dead_front_pose, assets_skins_voc_knight_voc_knight_veteran_dead_back_01_dead_back_pose, assets_skins_voc_knight_voc_knight_veteran_dead_front_01_death_pose_blood_pool, assets_skins_voc_knight_voc_knight_veteran_idle_back_04_back_view_sword_harness [INFERRED 0.75]
- **Veteran Knight walk animation sprite set (front + back directions, 4-frame cycle, shared character design)** — assets_skins_voc_knight_voc_knight_veteran_walk_front_01_walk_front_animation, assets_skins_voc_knight_voc_knight_veteran_walk_back_03_walk_back_animation, assets_skins_voc_knight_voc_knight_veteran_walk_front_04_four_frame_walk_cycle, assets_skins_voc_knight_voc_knight_veteran_walk_front_03_directional_sprite_set, assets_skins_voc_knight_voc_knight_veteran_walk_front_01_veteran_knight_sprite [INFERRED 0.95]
- **Thaira Character Sprite Reference Set (tools/amostra)** — tools_amostra_knight_frames_sheet, tools_amostra_black_knight_frames_sheet, tools_amostra_ranger_frames_sheet, tools_amostra_snow_druid_frames_sheet, tools_amostra_energy_sorcerer_front_walk_and_idle_sheet, tools_amostra_black_knight_frames_reference_material_only [INFERRED 0.95]
- **Class Archetype Roster Covered by the Reference Sheets** — tools_amostra_knight_frames_knight_archetype, tools_amostra_black_knight_frames_black_knight_archetype, tools_amostra_ranger_frames_ranger_archetype, tools_amostra_snow_druid_frames_snow_druid_archetype, tools_amostra_energy_sorcerer_front_walk_and_idle_energy_sorcerer_archetype [INFERRED 0.85]
- **Sprite Sheet Layout Conventions** — tools_amostra_knight_frames_four_row_directional_grid, tools_amostra_ranger_frames_attack_action_row, tools_amostra_energy_sorcerer_front_walk_and_idle_magenta_chroma_key_background, tools_amostra_knight_frames_hd_pixel_art_style [INFERRED 0.85]

## Communities (79 total, 2 thin omitted)

### Community 0 - "Tela de ajuda / comandos (#help)"
Cohesion: 0.06
Nodes (48): Confirmar antes de implementar, graphify, headroom, ponytail, assets/build_sfx.py (montador de efeitos), Kenney (fonte de pacotes de áudio CC0), assets/music/manifest.json, OpenGameArt (fonte de SFX e trilha CC0) (+40 more)

### Community 1 - "art.js"
Cohesion: 0.06
Nodes (54): BORDER_CACHE, borderSprite(), _canvas(), _canvas2(), _chapado(), cloudTexture(), contactShadow(), _cracks() (+46 more)

### Community 2 - "test.js"
Cohesion: 0.04
Nodes (36): B, C, chefes, comCharm, comum, ctx, dAtk, dBal (+28 more)

### Community 3 - "aplicaPreset (carrega modelo do preset)"
Cohesion: 0.05
Nodes (46): aplicaPreset (carrega modelo do preset), carrega (baixa GLB com cache), Conjunto mínimo de animações: idle, walk, attack, hit, death, Comparação com o boneco procedural e a grade de 1 tile, HEROIS (catálogo de aventureiros KayKit), montaAnims (botões por clipe do GLB), montaPecas (lista de peças com swatches), PALETA_3D (paleta de cores para pintar peças) (+38 more)

### Community 4 - "audio.js"
Cohesion: 0.08
Nodes (33): ambience(), ambNodes, arp(), audioInit(), audioToggle(), audioVol(), audioVolReset(), _avisarSemSom() (+25 more)

### Community 5 - "game.js"
Cohesion: 0.08
Nodes (34): BONUS_LABEL, BUFF_DESC, BUFF_ICO, BUFF_LABEL, BUFF_RUIM, _corTexto(), cycleVoc(), dropItem() (+26 more)

### Community 6 - "data.js"
Cohesion: 0.05
Nodes (38): AH, AI, BEST_DIFF, BEST_REVEAL, BEST_STAGE, boss(), conjunto(), defModificada() (+30 more)

### Community 7 - "render2d.js"
Cohesion: 0.12
Nodes (36): bloomPass(), CAM, camadaNuvem(), cloudPass(), creatureSpriteFor(), _criaturaCrua(), dprInt(), drawBlood() (+28 more)

### Community 8 - "log"
Cohesion: 0.16
Nodes (32): SHOP_STOCK, addMagic(), addSkillTry(), canEquip(), castSpell(), comer(), curar(), damageFormula() (+24 more)

### Community 9 - "world.js"
Cohesion: 0.14
Nodes (24): ambienteAgora(), CEU, climaAgora(), corDoCeu(), DIRS, distT(), ehNoite(), findPath() (+16 more)

### Community 10 - "superficie-dia"
Cohesion: 0.10
Nodes (21): abismo, caverna, superficie-dia, superficie-noite, abismo-caverna.ogg, caverna-eco.ogg, caverna-masmorra.ogg, caverna-templo.mp3 (+13 more)

### Community 11 - "Orc Animation Sprite Sheet"
Cohesion: 0.14
Nodes (21): Orc ATTACK Animation Row, Four-Direction Frame Grouping (side-left, front, back, side-right within each row), Orc IDLE Animation Row, Magenta Chroma-Key Background Convention, Orc (Axe-Wielding Green Humanoid Enemy), Row-Labeled Sheet Layout (WALK / IDLE / ATTACK captions baked into image), Orc Animation Sprite Sheet, Orc WALK Animation Row (+13 more)

### Community 12 - "_corpo_medio"
Cohesion: 0.12
Nodes (17): atk_club, mix, n, v, atk_fist, mix, n, v (+9 more)

### Community 13 - "killMob"
Cohesion: 0.24
Nodes (12): abalo(), addExp(), bloodSpray(), congelar(), cssCol(), dealDamage(), fxBurst(), impacto() (+4 more)

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

### Community 18 - "bindInput"
Cohesion: 0.21
Nodes (16): afterStep(), bagAdd(), bindInput(), changeFloor(), clickTile(), corpseAt(), lootAll(), lootTile() (+8 more)

### Community 19 - "itemStats"
Cohesion: 0.19
Nodes (19): PREFIXES, SUFFIXES, askConfirm(), charId(), deleteCharacter(), descLoot(), exportarPersonagens(), fixSave() (+11 more)

### Community 20 - "Snow Druid Reference Sprite Sheet"
Cohesion: 0.31
Nodes (15): Black Knight Archetype (dark plate melee), Reference Material, Not Shipped Assets, Black Knight Reference Sprite Sheet, Energy Sorcerer Archetype (lightning caster), Magenta Chroma-Key Background, Energy Sorcerer Front Walk and Idle Reference Sheet, Four-Row Directional Frame Grid, High-Detail 2.5D Pixel Art Style (+7 more)

### Community 21 - "Flat Monochrome Glyph Icon Style"
Cohesion: 0.32
Nodes (14): Painted Equipment Icon Art Style, Fire Rune Icon, Shield Icon, Flat Monochrome Glyph Icon Style, Attack Stance Icon, Balanced Stance Icon, Defense Stance Icon, Sword Icon (+6 more)

### Community 22 - "Knight Veteran Skin (voc_knight_veteran)"
Cohesion: 0.25
Nodes (14): Dead Back Pose (knight veteran, single frame), Dead Front Pose (knight veteran, single frame), Death Pose with Blood Pool (terminal state art), Idle Back Animation (knight veteran, 4 frames), Two-Direction Sprite Set (front / back only), Four-Frame Idle Loop, Back-View Sword Harness and Cross Straps, Idle Front Animation (knight veteran, 4 frames) (+6 more)

### Community 23 - "ui.js"
Cohesion: 0.33
Nodes (13): LOOT_RARITY, bestDiff(), bestiaryKill(), bestKills(), bestStage(), bindBigMap(), drawBigMap(), lootRarity() (+5 more)

### Community 24 - "frame"
Cohesion: 0.15
Nodes (20): chuvaOuvida(), clamp(), drawMinimap(), empurrar(), frame(), lerpEntity(), noTemplo(), occupied() (+12 more)

### Community 25 - "GG Boots Icon (Golden Lion Greaves)"
Cohesion: 0.23
Nodes (12): Armor Icon (Steel Plate Cuirass), Axe Icon (Double-Bladed Wood Axe), Bone Icon (Loot Material), Boots Icon (Buckled Travel Boots), Leather Boots Icon (Plain Tan Boots), Bow Icon (Recurve Wooden Bow), Dagger Icon (Gold-Hilted Dagger), Gem Icon (Faceted Blue Gemstone) (+4 more)

### Community 26 - "sfx/manifest.json"
Cohesion: 0.17
Nodes (11): death, n, v, ext, rev, step_grass, n, v (+3 more)

### Community 27 - "Knight Vocation - Common Skin (Front-Facing Sprite Set)"
Cohesion: 0.31
Nodes (11): Dead Front Animation State (Single-Frame Prone Pose), Front Facing Direction (Camera-Facing / South), Idle Front Animation State, Knight Vocation - Common Skin (Front-Facing Sprite Set), state_direction_index Frame Filename Convention, Transparent-Background Single-Frame PNG Asset Convention, Four-Frame Idle Breathing Loop (01-04 -> 01), Walk Front Animation State (+3 more)

### Community 28 - "hud.js"
Cohesion: 0.38
Nodes (10): HUD, HUD_BITS, HUD_DEF(), HUD_PANELS, hudApply(), hudLoad(), hudMove(), hudOptions() (+2 more)

### Community 29 - "Golden Guardian Set Reference Sheet"
Cohesion: 0.40
Nodes (10): Golden Guardian Equipment Slot Taxonomy (Mochila, Amuleto, Anel, Elmo, Armadura, Calca, Botas, Escudo, weapons), Lion-Head Heraldic Motif (Guardiao Dourado theme), Golden Guardian Set Reference Sheet, 15-Slot Sheet Layout, 384x256px Magenta Chroma Cells, Off-Hand Shield Slot, Golden Guardian Shield (Escudo) Skin Icon, Golden Guardian Two-Handed Axe (Machado Duplo) Skin Icon, Two-Handed Weapon Slot (+2 more)

### Community 30 - "crit"
Cohesion: 0.22
Nodes (9): crit, mix, n, v, die, mix, n, v (+1 more)

### Community 31 - "Thaira Sound Toggle Icon Sheet (on + off)"
Cohesion: 0.39
Nodes (8): Audio Mute Toggle (two-state UI control), Chroma-Key Green Background Convention, Combined Two-State Sprite Sheet Packing, Flat White Monochrome Glyph Style, Thaira Sound Toggle Icon Sheet (on + off), Thaira Browser RPG HUD / Settings Controls, ui_sound_off (speaker with X / muted), ui_sound_on (speaker with sound waves)

### Community 32 - "build_criaturas.py"
Cohesion: 0.16
Nodes (15): main(), confere(), folha(), linha(), main(), quadros(), Monta a folha de animação de uma criatura a partir dos quadros soltos. python…, [parado, passo, passo] em caminho de arquivo, já com os remendos. (+7 more)

### Community 33 - "Knight Veteran Walk-Back Animation"
Cohesion: 0.48
Nodes (7): Knight Veteran Walk-Back Animation, Veteran Knight Character Sprite (scarred bearded mohawk warrior), Knight Vocation (voc_knight) Skin Family, Knight Veteran Walk-Front Animation, Veteran Armor Kit: steel pauldrons, leather crossbelts, back-slung sword, mail skirt, brown boots, Directional Sprite Set (front / back facing variants), Four-Frame Walk Cycle Convention (state_direction_index naming)

### Community 34 - "Como adicionar coisas em Thaira"
Cohesion: 0.22
Nodes (8): 1. Arte nova (item, troféu, equipamento), 2. Item novo, 3. Criatura nova, 4. Hunt nova, 5. Conjunto com bônus por peça, Como adicionar coisas em Thaira, Conferindo, Conjunto de equipamento

### Community 35 - ".constructor"
Cohesion: 0.29
Nodes (6): Any, chain(), ctx2d(), fakeEl(), parseChildren(), vec()

### Community 36 - "build_icons.py"
Cohesion: 0.60
Nodes (4): main(), paletiza(), Tira o fundo verde de assets/green_background/*.png e grava em assets/icons/.…, sem_fundo()

### Community 37 - "Áudio — procedência e licença"
Cohesion: 0.40
Nodes (4): Como trocar um som, Efeitos — `assets/sfx/`, Trilha — `assets/music/`, Áudio — procedência e licença

### Community 38 - "Druid Vocation Icon (leafy wooden staff)"
Cohesion: 1.00
Nodes (4): Druid Vocation Icon (leafy wooden staff), Knight Vocation Icon (sword crossed over heraldic shield), Ranger Vocation Icon (bow crossed with arrows), Sorcerer Vocation Icon (arcane wand with purple orb)

### Community 39 - "atk_axe"
Cohesion: 0.50
Nodes (4): atk_axe, mix, n, v

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

### Community 44 - "atk_sword"
Cohesion: 0.67
Nodes (3): atk_sword, n, v

### Community 45 - "atk_wand"
Cohesion: 0.67
Nodes (3): atk_wand, n, v

### Community 46 - "buff"
Cohesion: 0.67
Nodes (3): buff, n, v

### Community 47 - "coin"
Cohesion: 0.67
Nodes (3): coin, n, v

### Community 48 - "_corpo_forte"
Cohesion: 0.67
Nodes (3): _corpo_forte, n, v

### Community 49 - "_corpo_medio"
Cohesion: 0.67
Nodes (3): _corpo_medio, n, v

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

### Community 55 - "ice"
Cohesion: 0.67
Nodes (3): ice, n, v

### Community 56 - "levelup"
Cohesion: 0.67
Nodes (3): levelup, n, v

### Community 57 - "loot"
Cohesion: 0.67
Nodes (3): loot, n, v

### Community 58 - "rune"
Cohesion: 0.67
Nodes (3): rune, n, v

### Community 59 - "shoot"
Cohesion: 0.67
Nodes (3): shoot, n, v

### Community 60 - "skillup"
Cohesion: 0.67
Nodes (3): skillup, n, v

### Community 61 - "spell_death"
Cohesion: 0.67
Nodes (3): spell_death, n, v

### Community 62 - "spell_earth"
Cohesion: 0.67
Nodes (3): spell_earth, n, v

### Community 63 - "spell_energy"
Cohesion: 0.67
Nodes (3): spell_energy, n, v

### Community 64 - "spell_fire"
Cohesion: 0.67
Nodes (3): spell_fire, n, v

### Community 65 - "spell_ice"
Cohesion: 0.67
Nodes (3): spell_ice, n, v

### Community 66 - "stairs"
Cohesion: 0.67
Nodes (3): stairs, n, v

### Community 67 - "step_cave"
Cohesion: 0.67
Nodes (3): step_cave, n, v

### Community 68 - "step_dirt"
Cohesion: 0.67
Nodes (3): step_dirt, n, v

### Community 69 - "step_rock"
Cohesion: 0.67
Nodes (3): step_rock, n, v

### Community 70 - "step_stone"
Cohesion: 0.67
Nodes (3): step_stone, n, v

### Community 71 - "unequip"
Cohesion: 0.67
Nodes (3): unequip, n, v

### Community 74 - "renderHotbar"
Cohesion: 0.27
Nodes (10): SPELLS, abrirPicker(), HOT_KEYS_DEFAULT, hotDefault(), hotEntry(), hotKeyLabel(), hotUse(), knownSpells() (+2 more)

### Community 75 - "build_skins.py"
Cohesion: 0.20
Nodes (15): conjuntos(), disponiveis(), encaixa(), escreve_lista(), id_do_arquivo(), main(), Transforma a arte de assets/skins/ nos ícones que o jogo usa, sozinho. python…, Todo ícone que existe em assets/icons, e se ele tem par @2x. (+7 more)

### Community 76 - "build_folhas.py"
Cohesion: 0.50
Nodes (4): main(), Corta as folhas de arte (vários itens numa imagem só) em PNGs separados. python…, Devolve [(x, y, w, h, imagem_rgba)] na ordem de leitura., separa()

### Community 77 - "finishStart"
Cohesion: 0.24
Nodes (11): bindMiniMap(), finishStart(), refreshSpawns(), removeMob(), renderAll(), renderStance(), respawn(), restaurarBichos() (+3 more)

### Community 78 - "habilidade"
Cohesion: 0.50
Nodes (4): habilidade(), lineClear(), say(), tapaVista()

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
- `Dead Front Animation State (Single-Frame Prone Pose)` → `state_direction_index Frame Filename Convention`  [AMBIGUOUS]
  assets/skins/voc_knight/voc_knight_commom/dead_front_01.png · relation: references
- `Four-Row Directional Frame Grid` → `Energy Sorcerer Front Walk and Idle Reference Sheet`  [AMBIGUOUS]
  tools/amostra/energy_sorcerer_front_walk_and_idle.png · relation: conceptually_related_to

## Knowledge Gaps
- **261 isolated node(s):** `dia-vila.mp3`, `dia-celta.mp3`, `dia-campina.mp3`, `dia-taverna.mp3`, `dia-menestrel.mp3` (+256 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

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