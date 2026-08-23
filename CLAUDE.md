## Confirmar antes de implementar

Se o pedido do usuário ficar ambíguo, suscetível a erro, mal explicado, ou você tiver qualquer dúvida sobre o que foi pedido, SEMPRE PERGUNTE ANTES DE IMPLEMENTAR QUALQUER COISA. Não presuma o entendimento correto e siga direto pro código — confirme primeiro.

## ponytail

Ponytail (lazy-senior-dev mode) must stay active for all coding work in this project: climb the ladder (YAGNI → reuse → stdlib → native → existing dep → one-liner → minimum code) before writing anything, keep diffs short, and mark deliberate corner-cuts with a `ponytail:` comment naming the ceiling and upgrade path.

## Concisão

Resposta curta por padrão: o código primeiro, depois no máximo 3 linhas (o que foi pulado e quando adicionar). Sem resumo do que acabou de ser feito, sem tour de features, sem justificar a simplificação em parágrafos, sem repetir o diff em prosa. Se a explicação ficar maior que o código, apague a explicação. Vale também pros arquivos gerados: nada de comentário narrando o óbvio nem doc que ninguém pediu. Relatório, walkthrough ou explicação pedida explicitamente é exceção — aí entrega completo.

## headroom

Use `headroom_compress` on large tool outputs (file reads, search results, logs, JSON) before reasoning over them, to keep context usage low. Use `headroom_retrieve` with the returned hash when the full original content is needed.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- SEMPRE rode `graphify update .` ao terminar de implementar qualquer solicitação que tenha mexido em código, antes de dar a tarefa por concluída. Não é opcional nem "quando lembrar": é o último passo de toda implementação (AST-only, sem custo de API). Se o comando falhar, avise em vez de ignorar em silêncio.

## Documentos do projeto

Estes arquivos são a memória do projeto. **Leia antes de propor ou implementar qualquer coisa** — eles guardam decisões já tomadas, e propor de novo o que já foi decidido (ou desfazer sem saber) é o desperdício mais caro aqui.

- **tasks.html** — estado técnico, fila de pendências, correções feitas e *armadilhas conhecidas*. É o documento de repasse: se você só puder ler um, leia este.
- **mundo_varrokgaard.html** e **mundo_aleto.html** — a lore e a planta das duas terras: história, elenco de criaturas, regiões, subsolo e o que **não** existe em cada uma.
- **proposta_24.html** — proposta de alinhamento das habilidades de criatura, com as decisões ainda em aberto.

Regras:

- **Mapa: o script semeia, o editor corrige.** `tools/mapas/<terra>.js` compõe e se confere; `tools/editor.html` grava só o DIFF em `maps/<terra>.patch.json`, que o script aplica no fim, antes das conferências. Rodar o script nunca apaga correção feita à mão — e por isso **não edite `maps/*.json` na mão**: ele é saída, e a próxima execução o reescreve.
- O mundo é **autoral, não gerado**. `genWorld` continua vivo só para rascunho; o mapa de verdade vem de `maps/*.json`. Antes de mexer em geração de mundo, leia a seção "A virada de mundo" do tasks.html.
- **SEMPRE atualize o tasks.html** ao terminar qualquer implementação, junto com o `graphify update .`. Não é opcional: sem isso o documento envelhece em silêncio — já aconteceu de ele passar três commits desatualizado e afirmar 32 invariantes travadas por teste das quais 18 não existiam.
- Se a lore mudar, o documento da terra é a fonte — atualize-o, não o código sozinho.

## Manter esta memória

Este arquivo entra no contexto de **toda** sessão; o tasks.html só quando alguém o abre. Por isso os dois têm trabalhos diferentes, e misturar arruína os dois — um CLAUDE.md inchado deixa de ser lido com atenção, e aí a regra que importa se perde no meio da história.

- **Aqui**: decisão que restringe trabalho futuro, regra de método, e onde as coisas moram. Curto.
- **No tasks.html**: o que foi feito, o que falta, medições, números e a história de cada correção.

O teste para saber onde vai: *isto muda **como** eu trabalho, ou registra **o que** aconteceu?* O primeiro vem para cá; o segundo vai para o tasks.html.

**Ao terminar qualquer trabalho, atualize os dois** — o tasks.html sempre, este arquivo quando surgir decisão ou regra nova. E regra que deixou de ser geral, **tire daqui**: este arquivo também encolhe.

## Decisões que não se re-discutem

Cada uma custou uma volta inteira de trabalho. Reabrir sem motivo novo é desperdício; o histórico de cada uma está no tasks.html.

- **O mundo é autoral, não gerado.** Mapa procedural não tem profundidade: o monstro está onde uma faixa de distância mandou, e nenhum lugar tem identidade. Autoral não significa desenhado à mão pelo dono — significa **decidido e congelado**.
- **Meça com a régua do jogo.** Medir com régua diferente é pior do que não medir: dá alarme falso, e o alarme falso esconde o verdadeiro. Já aconteceu três vezes — distância de cor medindo legibilidade quando eu queria identidade, componentes conexos com 4 vizinhos quando o jogo anda em 8, e a planta de cima julgando um lugar de andar. **Arte se julga no tamanho e na luz do jogo**: aprovar no 4× deixa passar o que não lê no 1×, e julgar tile de caverna em luz de meio-dia o deixa escuro demais para onde ele mora.
- **Piso de 192×192 para superfície.** Mapa menor lê grande na planta e minúsculo andando — Varrokgaard a 64² se atravessa em dez segundos, e foi por isso que ela caiu. A exceção é o lugar que **exige** ser pequeno (sistema de subsolo, gruta, sala), nunca o que ficou pequeno por descuido. A planta não mede distância percorrida; só andando se sabe.
- **Sombra é do MOTOR, não assada no sprite.** Elipse pálida pintada dentro do desenho entra no passe de luz junto com o objeto: escurece com ele à noite e para de separá-lo do chão — o objeto vira papel no chão. Quem prega no chão é o `dropShadow` (mancha de contato **mais** silhueta projetada, alfa seguindo o sol); o sprite só declara `cx` e `feet`. Cerca e escoramento ficam de fora porque correm em linha, e sombra projetada por tile num lance de cerca vira serrilha.
- **Objeto grande ocupa mais de um tile.** Um tile tem 32 px: poço, moinho, carroça e fonte desenhados dentro de um só serão sempre pequenos, por construção, e nenhum ajuste de desenho conserta isso. O tile declara `span: [w, h]`, a âncora (canto noroeste) desenha o objeto inteiro e os demais tiles do rastro só bloqueiam. Antes de desenhar, pergunte **quantos tiles esta coisa ocupa no mundo**, não como encolhê-la para caber em um.
- **Cor de material é constante própria, e isso vale contra o CHÃO em que a coisa se apoia.** O poço tinha pedra a distância 13 do `PAVE` sob ele e sumia dentro da calçada. Quando objeto e chão são do mesmo material, quem os separa é o objeto ser mais velho, mais molhado ou mais escuro — nunca a mesma cor em outro tom.
- **Bioma e geografia se estudam antes de desenhar.** Rio é **bacia**, não mancha: nasce em terreno alto, corre sempre para baixo, **recebe** afluente (nunca se divide), meandra no curso baixo e desemboca. Um tile solto de água no meio da mata é geologicamente impossível. E rio traz mata junto — a faixa da margem (mata-galeria) é mais densa que o entorno e forma o corredor por onde o bicho anda. Vila medieval **não tem grade**: as ruas emergem do uso, a igreja fica perto da estrada de entrada e não no centro do palco, e o padrão linear é o de aldeia feita por ordem de um senhor. Não construa bioma nem arquitetura no escuro.
- **Estrada sobre rio é ponte, e forma geométrica nunca cria terra.** As duas falham caladas: o `caminho` pinta terra sobre a água e o rio vira dique; o disco encostado na costa emenda no continente e engorda a silhueta sem desconectar nada, então a conferência passa verde. Guarde o leito e converta no fim; pinte região só onde já é terra.
- **A planta de cima não julga lugar de andar.** Ela diz se a topologia fecha e se há conteúdo inalcançável. Não diz nada sobre como é estar lá dentro — isso só se sabe jogando.
- **Um material, um significado.** Se parede, casa, mureta e pedra solta forem todas do mesmo tile, o mapa vira entulho e nada se distingue de nada.
- **Elenco fechado por terra, e não classe inteira.** Nem todo mapa precisa de toda classe, nem de uma classe inteira. **A ausência caracteriza tanto quanto a presença.**
- **Tileset feito à mão é forma, contorno e luz por objeto.** Ruído com tom sorteado por pixel lê como tinta jogada no chão. O que funciona é sempre a mesma receita: objeto discreto, paleta de poucos tons fixos (`_tons`), sombra de um lado e luz do outro, e a mesma direção de luz para todos. Luz por OBJETO costura entre tiles; luz assada no quadro inteiro é o que estraga tile. E o chão é calmo — a riqueza mora na junta entre terrenos e no que está em cima dele, não no chão ficar ocupado.
- **Descrição vira desenho literal.** Pedir "língua que afina para cima" produz um espeto. Para arte, o caminho é imagem de referência mais uma página de amostra onde o dono julga — nunca prosa.
- **Reuso é errado quando diferenciar é o requisito.** Uma fórmula só para quatro elementos deu quatro bolinhas de cores diferentes. A escada do ponytail vale para lógica, não para identidade visual. Corolário caro: **cor de material é constante própria, não a cor do tile multiplicada** — veio, entulho e musgo nasceram todos errados por escalar a cor do vizinho em vez de ter a sua.

## 1. PROJECT IDENTITY

THAIRA is a 2D dark-fantasy RPG.

The visual identity is inspired by classic 2D RPGs such as Tibia and RuneScape, but THAIRA must have its own visual identity. Do not blindly reproduce the interface, assets, layouts, terminology, or exact visual design of those games.

The objective is to create a cohesive game that feels handcrafted rather than procedurally or generically AI-generated.

The game should prioritize:

- Strong gameplay readability
- Clear information hierarchy
- Consistent visual language
- Functional interfaces
- Dark-fantasy atmosphere
- Pixel-art compatibility
- Efficient use of screen space
- Consistency across every system
- Professional game-development standards

Never sacrifice usability merely to make something look more elaborate.

---

# 2. CORE DEVELOPMENT PRINCIPLES

Before implementing anything, understand the existing architecture.

Do not unnecessarily rewrite working systems.

Do not create duplicate systems when an existing component, utility, manager, hook, service, or design token can be reused.

Before creating a new component:

1. Search the project for an existing equivalent.
2. Determine whether the existing component can be extended.
3. Reuse existing design tokens.
4. Reuse existing interaction patterns.
5. Only create a new component when there is a genuine functional or visual requirement.

Prefer modular systems over duplicated code.

Prefer data-driven systems over hardcoded content.

Keep gameplay logic separate from presentation whenever practical.

Do not introduce a dependency merely to solve a problem that can be solved cleanly with the existing project architecture.

Do not make unrelated changes while implementing a requested feature.

---

# 3. UI ART DIRECTION

The THAIRA interface must look like a handcrafted dark-fantasy RPG interface.

It must NOT look like:

- A SaaS dashboard
- A modern business application
- A generic web application
- A mobile application
- A futuristic sci-fi interface
- A cryptocurrency interface
- A generic AI-generated fantasy UI
- A glassmorphism interface
- A modern "gaming dashboard"
- A collection of unrelated cards
- A generic Bootstrap/Tailwind component library

Avoid excessive:

- Rounded cards
- Gradients
- Glow effects
- Glass effects
- Transparency
- Drop shadows
- Neon colors
- Decorative elements
- Floating cards
- Pills
- Excessive borders
- Excessive animations

The interface should feel like part of the physical world of THAIRA.

Visual materials may evoke:

- Aged iron
- Dark wood
- Leather
- Stone
- Parchment
- Old metal
- Worn cloth
- Dark glass when thematically appropriate
- Magical materials only when justified by gameplay

The UI should feel functional first and atmospheric second.

---

# 4. VISUAL LANGUAGE

THAIRA uses a restrained fantasy visual language.

### Shapes

Prefer:

- Rectangular panels
- Slightly irregular fantasy frames
- Angular shapes
- Subtle ornamental corners
- Strong silhouettes
- Simple geometric slots

Avoid making every component rounded.

Rounded corners should only be used when they have a deliberate visual purpose.

### Borders

Borders should generally be subtle.

Avoid thick generic outlines around every element.

Use different border treatments to communicate hierarchy:

- Primary window
- Secondary panel
- Interactive element
- Selected element
- Disabled element
- Warning
- Important gameplay state

Do not use the same border everywhere.

### Texture

Texture should support the material.

Examples:

- Wood texture for wooden UI
- Metal texture for forged frames
- Parchment texture for lore and documents
- Leather texture for inventory or equipment elements

Do not apply texture indiscriminately.

Do not use obvious stock textures.

Texture must remain subordinate to readability.

---

# 5. COLOR SYSTEM

The UI must use a controlled palette.

Do not invent random colors for individual screens.

Create centralized color tokens.

Conceptually:

```text
Background
Surface
Surface Elevated
Border
Border Highlight
Text Primary
Text Secondary
Text Disabled

Primary Accent
Secondary Accent

Health
Mana
Stamina

Success
Warning
Danger
Neutral

Common Item
Uncommon Item
Rare Item
Epic Item
Legendary Item
Quest
Magic
```

Colors must communicate meaning consistently throughout the game.

For example:

- Red = health, danger, damage, hostile states
- Blue = mana or magical resources where applicable
- Green = healing, positive effects, success
- Yellow/orange = warning, attention, rare information
- Purple = special/magical states when appropriate

Do not use color merely because it looks attractive.

Color should communicate information.

---

# 6. TYPOGRAPHY

Typography is part of the game's identity.

Use a display font for:

- Main titles
- Major headings
- Character/class names
- Important fantasy labels

Use a highly readable font for:

- Stats
- Inventory quantities
- Tooltips
- Quest descriptions
- Combat information
- System messages
- Detailed information

Never sacrifice readability for thematic typography.

Avoid using a decorative medieval font for every piece of text.

Do not use more fonts than necessary.

Typography hierarchy must be consistent.

---

# 7. SPACING AND PROPORTIONS

Use a consistent spacing system.

Do not randomly choose padding or margins for every component.

Define spacing tokens and reuse them.

UI should have intentional density.

THAIRA is an RPG, not a minimalist corporate application.

Information-dense interfaces are acceptable when the information is relevant.

However, do not fill empty space merely because it exists.

Empty space should be intentional.

---

# 8. COMPONENT SYSTEM

Create reusable components wherever possible.

Common UI components include:

```text
Panel
Window
Modal
Button
IconButton
Tab
Tooltip
ContextMenu
Dropdown
ProgressBar
HealthBar
ManaBar
StaminaBar
Slot
ItemSlot
EquipmentSlot
SkillSlot
HotbarSlot
Separator
Badge
Notification
QuestEntry
StatRow
CharacterAttribute
Scrollbar
Pagination
List
ListEntry
Input
SearchField
```

Every reusable component must have consistent:

- Dimensions
- Typography
- Padding
- Borders
- Hover state
- Pressed state
- Disabled state
- Selected state
- Focus state where applicable

Do not implement visually different versions of the same component unless the difference is intentional and documented.

---

# 9. INTERACTION STATES

Every interactive element should have clear states.

At minimum, consider:

```text
Default
Hover
Pressed
Selected
Disabled
Focused
Unavailable
```

States should not rely solely on color.

Use combinations of:

- Contrast
- Border
- Background
- Icon state
- Position
- Animation
- Subtle lighting
- Sound

The user should immediately understand what can be interacted with.

---

# 10. ANIMATION

Animations should be short and functional.

Avoid excessive UI animation.

Good uses:

- Window opening
- Window closing
- Button press
- Item pickup
- Item selection
- Tooltip appearance
- Notification entrance
- Health/mana changes
- Tab transitions
- Inventory interactions

Animations should reinforce the action.

Do not animate everything.

Do not use slow modern-web transitions unless they fit the game.

Avoid:

- Excessive bouncing
- Excessive scaling
- Constant floating
- Long fades
- Unnecessary particle effects
- Animation that interferes with gameplay

Gameplay responsiveness has priority over visual spectacle.

---

# 11. HUD

The HUD must provide important information without obstructing the game world.

The HUD should prioritize:

1. Player survivability
2. Active resources
3. Combat information
4. Immediate actions
5. Relevant status effects
6. Navigation
7. Secondary information

The HUD should feel integrated with the game rather than pasted on top of it.

Common elements may include:

```text
Health
Mana
Stamina
Experience
Level
Status Effects
Hotbar
Minimap
Equipment
Combat State
Target Information
Notifications
```

Do not display information merely because the game has access to it.

Only expose information that benefits the player.

---

# 12. INVENTORY

The inventory must communicate items primarily through:

- Icon
- Slot position
- Quantity
- Rarity
- Selection state
- Tooltip

The inventory must not look like a spreadsheet.

Item slots should have a strong visual relationship with equipment slots and hotbar slots.

If the same item appears in different UI systems, its visual identity must remain consistent.

Do not create different icons or representations for the same item unless technically necessary.

---

# 13. EQUIPMENT

Equipment UI should communicate character silhouette and item placement clearly.

Equipment slots should have recognizable locations.

The player should understand the relationship between:

```text
Head
Body
Hands
Weapon
Shield
Legs
Feet
Accessory
Ring
Amulet
etc.
```

Do not overcrowd the equipment screen.

Equipment comparison must be immediately understandable.

Stat changes should be visually clear but not excessively animated.

---

# 14. MENUS

Menus must serve gameplay.

Every menu should have:

- Clear purpose
- Strong title
- Logical grouping
- Obvious navigation
- Consistent exit behavior
- Consistent visual language

Do not create menus consisting entirely of decorative cards.

Avoid unnecessary nested menus.

Prefer direct access to frequently used systems.

---

# 15. WINDOWS AND PANELS

Windows should have clear hierarchy.

A primary window may contain secondary panels.

Example:

```text
Main Window
 ├── Header
 ├── Navigation / Tabs
 ├── Content
 │    ├── Primary Panel
 │    └── Secondary Panel
 └── Footer / Actions
```

Do not create five different border styles inside one window without a reason.

The player must immediately understand:

- What screen they are on
- What information belongs together
- What can be interacted with
- What is secondary information

---

# 16. TOOLTIPS

Tooltips are extremely important for RPG systems.

Tooltips should be:

- Fast
- Readable
- Compact
- Contextual
- Consistent

Item tooltips should prioritize:

```text
Item Name
Item Type
Rarity
Primary Properties
Secondary Properties
Requirements
Description
Value / Relevant Information
```

Do not create huge tooltip windows when a compact tooltip is sufficient.

Tooltips should not cover the item or important gameplay information unnecessarily.

---

# 17. ICONOGRAPHY

Do not use emojis as gameplay icons.

Do not use arbitrary Unicode symbols when a proper game icon is appropriate.

Icons must belong to the same visual family.

Important categories should have recognizable silhouettes.

Examples:

- Sword
- Shield
- Helmet
- Potion
- Spell
- Gold
- Quest
- Character
- Inventory
- Equipment
- Skills
- Map
- Settings
- Save
- Exit

Do not mix radically different icon styles.

Avoid combining:

- Flat modern icons
- 3D icons
- Emoji
- Pixel icons
- Line icons

unless there is a deliberate documented reason.

---

# 18. PIXEL ART COMPATIBILITY

THAIRA is a 2D RPG.

UI elements must respect the visual language of the game's sprites and environment.

Avoid overly smooth UI graphics when they visually conflict with pixel-art assets.

When using pixel-art UI:

- Preserve hard edges
- Avoid unintended anti-aliasing
- Respect pixel density
- Avoid fractional scaling
- Avoid blurry transforms
- Use integer-friendly dimensions where appropriate

Do not automatically pixelate every UI element.

The objective is visual cohesion, not an arbitrary pixel filter.

---

# 19. RESPONSIVE BEHAVIOR

The interface must account for the game's supported resolutions.

Do not simply scale everything proportionally.

Determine which elements should:

- Scale
- Reposition
- Collapse
- Remain fixed
- Become scrollable

Critical gameplay information must remain accessible.

Avoid interfaces that become unusable at different aspect ratios.

---

# 20. ACCESSIBILITY AND READABILITY

The UI must remain readable.

Do not use:

- Tiny text
- Low-contrast text
- Decorative fonts for important information
- Color-only indicators
- Excessive visual noise

Important information should have multiple visual cues when appropriate.

For example:

A poisoned character should not be identified only by a green icon.

Use icon + color + tooltip/state where appropriate.

---

# 21. AUDIO/UI FEEDBACK

When implementing an interaction system, consider whether it should have audio feedback.

Examples:

Button press:
- short click

Inventory interaction:
- subtle item sound

Equipment:
- appropriate equipment sound

Quest:
- distinct notification sound

Error:
- short negative feedback

Important achievement:
- stronger confirmation

Do not use the same sound for every UI action.

Audio feedback must remain subtle enough not to become irritating.

---

# 22. SCREEN COMPOSITION

Before implementing a major screen, determine its visual hierarchy.

Ask:

1. What is the player's primary objective on this screen?
2. What information is most important?
3. What action is most likely?
4. What information is secondary?
5. What can be hidden behind a tooltip?
6. What should remain visible?
7. Where should the player's eye go first?

Do not automatically center everything.

Do not automatically use a three-column card layout.

Do not automatically create a sidebar.

Do not automatically create a grid.

Choose the layout based on the gameplay requirement.

---

# 23. ANTI-AI DESIGN RULES

The following are specifically prohibited unless there is a strong design reason:

- Generic rounded cards
- Random gradients
- Excessive glow
- Purple/blue "AI aesthetic"
- Glassmorphism
- Neon borders
- Excessive drop shadows
- Excessive blur
- Generic dashboard layouts
- Stock fantasy ornaments
- Random decorative icons
- Emoji UI
- Excessive symmetrical decoration
- Repeated identical cards
- Huge headings consuming screen space
- Decorative elements with no gameplay purpose
- Random accent colors
- Modern SaaS-style buttons
- UI generated independently for each screen

If a design looks like it could belong to a random AI-generated website, reconsider it.

---

# 24. CONSISTENCY RULE

When implementing a new interface, compare it mentally against existing THAIRA interfaces.

Ask:

"Could a player immediately recognize this as THAIRA?"

If the answer is no, revise it.

New interfaces must inherit the existing visual language.

Do not redesign the entire UI simply because a new screen is being implemented.

---

# 25. DO NOT OVER-DESIGN

A common failure mode is adding visual complexity to make an interface appear more sophisticated.

Do not do this.

A professional interface is not necessarily a complicated interface.

Prefer:

```text
Clear
Consistent
Readable
Purposeful
Atmospheric
```

over:

```text
Complex
Decorative
Glowing
Animated
Overloaded
```

---

# 26. BEFORE IMPLEMENTING A NEW UI

For any significant UI feature:

### Step 1 — Inspect

Inspect the existing project architecture and UI components.

### Step 2 — Identify reuse

Find existing components, styles, tokens and utilities that should be reused.

### Step 3 — Define hierarchy

Determine the information hierarchy and primary player actions.

### Step 4 — Implement

Use the existing design system.

### Step 5 — Validate

Check:

- Alignment
- Spacing
- Typography
- Contrast
- Interaction states
- Resolution behavior
- Visual consistency
- Gameplay readability

### Step 6 — Refine

Only after functionality works, refine visual details.

Do not rewrite functional code unnecessarily during visual refinement.

---

# 27. WHEN ASKED TO "MAKE IT BEAUTIFUL"

Do NOT interpret "beautiful" as:

- More gradients
- More glow
- More shadows
- More animations
- More cards
- More decoration

Instead interpret "beautiful" as:

- Better hierarchy
- Better spacing
- Better typography
- Better proportions
- Better iconography
- Better material treatment
- Better contrast
- Better consistency
- Better interaction feedback
- Better integration with the game's atmosphere

---

# 28. WHEN ASKED TO REDESIGN AN EXISTING UI

Do not immediately replace the entire interface.

First analyze:

1. What is already working?
2. What looks generic?
3. What harms usability?
4. What violates THAIRA's visual identity?
5. What can be improved without changing functionality?

Preserve working functionality unless explicitly instructed otherwise.

Make changes incrementally.

Do not introduce unrelated features.

---

# 29. CODE QUALITY

UI code must remain maintainable.

Avoid:

- Massive components
- Duplicated styles
- Hardcoded colors everywhere
- Hardcoded dimensions everywhere
- Repeated magic numbers
- Duplicate event handlers
- Unnecessary global state
- Unnecessary dependencies
- Temporary hacks left undocumented

Use centralized constants/design tokens for values that define the visual system.

Examples:

```text
COLORS
SPACING
BORDER_WIDTH
RADIUS
FONT_SIZES
ANIMATION_DURATION
UI_Z_INDEX
```

Use semantic names.

Prefer:

```text
COLOR_TEXT_PRIMARY
COLOR_PANEL_BACKGROUND
COLOR_ACCENT
```

over:

```text
#D8C27A
#171717
#5A3F2E
```

throughout individual components.

---

# 30. GAMEPLAY CODE VS UI CODE

Do not mix gameplay rules directly into visual components when avoidable.

For example:

Bad:

```text
InventoryButton directly modifies player statistics,
inventory state, UI state and save data.
```

Prefer:

```text
Inventory System
        ↓
Game State
        ↓
UI observes state
        ↓
UI triggers game actions
```

The UI should present and interact with game systems, not become the game system itself.

---

# 31. DEBUGGING

When fixing a bug:

1. Reproduce it.
2. Identify the actual cause.
3. Fix the smallest appropriate layer.
4. Verify that the fix does not break related systems.
5. Do not rewrite unrelated code.

Do not hide errors merely to make the UI appear functional.

Do not add defensive code everywhere without understanding the underlying problem.

---

# 32. VISUAL REVIEW

After implementing a significant interface, perform a visual review.

Evaluate:

### Composition
Does the screen have a clear focal point?

### Hierarchy
Can the player identify important information immediately?

### Consistency
Does it match existing THAIRA interfaces?

### Density
Is there too much or too little information?

### Authenticity
Does it look like a handcrafted RPG interface rather than a generic web UI?

### Function
Can the player understand what to do?

### Restraint
Are there unnecessary decorative effects?

If the UI fails any of these criteria, improve it before considering the task complete.

---

# 33. IMPORTANT IMPLEMENTATION RULE

Never assume that adding more visual effects improves the UI.

If uncertain between:

```text
More decoration
```

and:

```text
Better hierarchy
```

choose better hierarchy.

If uncertain between:

```text
New component
```

and:

```text
Reuse existing component
```

choose reuse.

If uncertain between:

```text
More animation
```

and:

```text
Faster interaction
```

choose faster interaction.

If uncertain between:

```text
More information
```

and:

```text
Better information hierarchy
```

choose better hierarchy.

---

# 34. FINAL RULE

THAIRA should feel like a game designed by one coherent art direction team.

Every screen, window, button, icon, tooltip, HUD element and menu must feel like it belongs to the same world.

The goal is not to make the UI impressive in isolation.

The goal is to make the entire game feel intentional.

When implementing anything new, ask:

> "Does this look like THAIRA?"

If not, change it.