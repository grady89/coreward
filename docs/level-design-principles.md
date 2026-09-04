# Level design principles for Coreward's vaults

What I read, what I took from it, where the sources disagree and which side
this game takes — then the checklist every room is graded against.

This is not a summary of the reading. It is a set of rules with numbers in
them, chosen for *this* controller, whose measurements live in
[movement-metrics.md](movement-metrics.md).

---

## Part 1 — What the craft says

### Nintendo's four steps (kishōtenketsu)

Koichi Hayashida's framing, brought to Nintendo by Miyamoto out of manga
panel structure: **introduce → develop → twist → conclude**. A mechanic is
taught somewhere failure is free, developed under mild stakes, *twisted* by
recombination with something already known, then thrown away. The canonical
worked example is 3D World's Cakewalk Flip: flip-panels shown over flat safe
ground, then as a staircase with a net below, then with skull-bell shockwaves
forcing the jumps and the net removed, then verticality as the payoff.

The load-bearing part is not the four beats. It is **"a clear concept in the
beginning, and that's carried through absolutely all the way"** — one idea per
unit, and the unit ends when the idea is exhausted.

Sources: [Game Developer — the secret to Mario level design](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design),
[Nintendo Life](https://www.nintendolife.com/news/2015/03/video_nintendos_four_step_stage_design_is_why_you_love_super_mario_games_so_much),
[Chris Norman on kishōtenketsu & hakoniwa](https://openedsource.medium.com/kish%C5%8Dtenketsu-hakoniwa-dd5a568da169).

### Maddy Thorson on Celeste

The room is the unit. Hundreds of short screens sustain flow *because* failure
is cheap — instant respawn is not a mercy, it is what licenses the difficulty.
The line I keep coming back to: difficulty is composed **"from combinations
rather than surprise."** And recovery is designed, not left over: failure must
be cheap *and informative*.

Layering: the main line is the game, strawberries sit on harder lines, B-sides
recombine at higher intensity, C-sides are short and brutal, goldens demand a
clean run. Difficulty is a set of optional *routes*, not a slider.

Sources: [Level Design Workshop: Designing Celeste (GDC)](https://www.youtube.com/watch?v=4RlpMhBKNr0),
[summary](https://gamedesign.gg/watch/designing-celeste/),
[Tadeas Jun on 2D level design](https://www.tadeasjun.com/blog/2d-level-design/).

### Yacht Club on Shovel Knight

Two things worth stealing. **"No unitaskers allowed!"** — every enemy and
object must serve several purposes and interact with the others; a noun that
does one thing in one room is waste. And the checkpoint economy: they rejected
invisible Mega Man checkpoints *and* pay-per-use ones, landing on a lamp you
can **smash for treasure**, permanently giving up the respawn. The checkpoint
became a wager rather than a convenience.

They also scope hard: ~26 regular rooms and ~6 secret rooms per level, ~5
enemies and ~5 objects, so pacing is a budget rather than a hope.

Sources: [Specter of Torment level design deep dive](https://www.yachtclubgames.com/blog/specter-of-torment-level-design-deep-dive-1-5/),
[Check Point Design](https://www.yachtclubgames.com/blog/check-point-design/).

### Hollow Knight's terrain

Team Cherry removed pass-through platforms entirely: *every* surface is solid
and predictable. The payoff is cognitive — the player never spends attention
asking what a platform will do, so all of it goes to navigation. Geometry is
the lock: high ledges want the double jump, shafts want the claw, wide gaps
want the dash.

Source: [The hidden genius behind Hollow Knight's terrain design](https://ludonauta.itch.io/platformer-essentials/devlog/1084669/the-hidden-genius-behind-hollow-knights-terrain-design),
[PC Gamer on metroidvania maps](https://www.pcgamer.com/how-to-design-a-great-metroidvania-map/).

### Rhythm as a formal object

Smith et al.'s *Launchpad* generator formalises what good designers do by
feel: levels decompose into **rhythm groups** — short, non-overlapping sets of
components enclosing one area of challenge — and rhythmic obstacle placement
produces a rhythmic sequence of *player actions*, which makes each individual
input easier to time. Rhythm is not decoration on top of difficulty; it is
what makes difficulty legible.

Sources: [Launchpad (UCSC)](https://users.soe.ucsc.edu/~ejw/papers/Smith-Launchpad-TCIAIG-2011.pdf),
[Analysis and application of rhythm in 2D platformer levels (Oulu)](https://oulurepo.oulu.fi/bitstream/10024/42597/1/nbnfioulu-202306212719.pdf).

### Forgiveness windows

Coyote time and jump buffering are a pair: one forgives being late off the
ledge, the other forgives being early on the landing. Celeste's coyote window
is widely cited at **5 frames**; the practical band for a tight precision
platformer is **70–100 ms coyote, 70–110 ms buffer**.

Coreward sits at **coyote 6f (100 ms), buffer 7.2f (120 ms)** — at or just
past the generous end of "tight precision". That is a deliberate choice and it
means gap tolerances here can be marginally tighter than Celeste's without
being unfair. It does **not** license single-frame inputs.

Sources: [GameJuice on forgiving controls](https://www.gamejuice.co.uk/articles/coyote-time-input-buffering),
[Input buffering and coyote time primer](https://gamineai.com/blog/input-buffering-and-coyote-time-in-2d-a-godot-4-and-unity-friendly-timing-primer).

### The anti-patterns

Kaizo and troll levels are instructive as a photographic negative. Their
signature moves: hidden blocks placed exactly where a player will jump,
enemies dropped from off-screen, instant-death rooms, dying *after* the goal.
The common thread is that the information needed to survive **does not exist
on screen before the commitment**, so the only route to mastery is
memorisation by elimination.

This is the line between hard and unfair, and it is a hard line: difficulty
may come from precision and from reading, never from information withheld.

Sources: [Kaizo Mario Maker Wiki — troll levels](https://kaizomariomaker.fandom.com/wiki/Troll_Level),
[Kaizo levels](https://kaizomariomaker.fandom.com/wiki/Kaizo_Level),
[Wikipedia — Kaizo](https://en.wikipedia.org/wiki/Kaizo).

---

## Part 2 — Where the sources disagree, and what this game does

**1. Where does the teaching arc live — the level, or the room?**

Nintendo runs introduce/develop/twist/conclude across a whole five-minute
stage. Thorson runs a complete idea inside a ten-second screen and composes
difficulty by stacking screens.

*They cannot both be the unit.* Coreward's rooms are 60–180 s and already
partitioned into camera-locked **chambers** of ≤22 columns, which cut rather
than pan. That structure is a gift and it settles the argument:

> **The chamber is the room (Celeste). The four chambers are the four steps
> (Nintendo).** One idea per vault, one of the four beats per chamber, and
> Celeste-grade density *within* each chamber.

This is not a compromise; it is what the camera already enforces.

**2. Free respawn, or a checkpoint you gamble?**

Celeste's instant free respawn licenses brutal difficulty. Shovel Knight makes
the checkpoint a wager you can cash in.

Coreward's sconce is *already* Shovel Knight's lamp, inverted: you spend
position and your one spark to **buy** the checkpoint instead of smashing it
for treasure. So the Shovel Knight economy is the right model and Celeste's is
not available to us — **but only if the wager is real.** A sconce that costs
nothing to reach is a Celeste checkpoint wearing a Shovel Knight hat. Rule 6
below exists to enforce this.

**3. "No unitaskers" vs "never introduce two things at once."**

Not actually a conflict, once separated: *no unitaskers* is a rule about the
**kit** (every noun must combine with the others, or cut it), *one at a time*
is a rule about **introduction order**. Coreward's kit was lint-locked in V3
and every noun already combines. So the standing obligation is the second one.

**4. Difficulty from surprise, or from combination?**

Thorson says combination. Kaizo says surprise. This game takes Thorson's side
without qualification, and rule 8 makes it testable.

---

## Part 3 — The checklist

Every room is graded against these. A room that fails any of 1–4 or 8 is
**rebuild**, not revise.

### 1 · Chain, don't stop

Design in **phrases of 3–5 inputs** with a deliberate breath between them.
A landing spot must also be a launch spot.

> **Test (mechanical):** the harness walks the golden path and records the
> longest run of consecutive frames where the solution requires *no* input
> and the body is grounded. More than **30 frames (0.5 s) of grounded
> idle between challenges** inside a chamber is a stop, and stops are counted.
> A chamber with more stops than phrases has failed.

Coreward-specific teeth: **air speed is 5.0 t/s and ground walk is 3.6 t/s.**
The game is 39 % faster in the air. Chaining is not just more elegant here, it
is mechanically rewarded, and a room full of stops is a room that runs at
two-thirds speed. Build to that.

### 2 · Teach → develop → twist → conclude

One new idea per vault, mapped onto its chambers. Never two at once.

> **Test:** each chamber's element census, diffed against the previous
> chamber's. Chamber A introduces exactly one noun the vault has not used.
> The last chamber introduces **zero** — already enforced by the P4 climax
> census lint.

### 3 · Read-ahead

The player sees the challenge before committing. No blind drops, no leaps of
faith, no hazard entering frame from off-screen at speed.

> **Test:** for every required drop of more than one storey (>2.68 tiles), the
> landing must be inside the same camera chamber as the launch, or marked by
> motes. Camera chambers are ≤22 columns and cut rather than pan, so "inside
> the chamber" is a real guarantee. Blind drops across a cut are a fail.

### 4 · Rhythm and pacing

Alternate tension and release. A hard phrase is followed by ground the player
can cross at full speed.

> **Test:** no chamber may be uniform. Per chamber, the harness reports beats
> and their spacing; a chamber whose beat spacing has near-zero variance is
> flagged flat regardless of its difficulty.

### 5 · Telegraph with the environment

Hazards legible from silhouette and motion before they matter. Motes are the
breadcrumb: they mark every required arc, every safe drop, every shelf edge in
the dark. Use them to bait the greedy line too, not only to mark the safe one.

> **Test:** every required arc over 0.7× has motes within 1 tile of its apex.
> Every hazard volume reaching into a dark region is self-luminous — already
> enforced by the `dark hazards emissive` lint.

### 6 · Reward the skilled line

Most chambers get a safe route and a greedy one. The greedy line runs on the
**spark → wall-jump** chain, because that is this game's hardest and best
combo. Optional sconces sit on the greedy line, or against the direction of
momentum where only a player in control can turn around and take them.

> **Test:** the harness solves each chamber twice — once minimising risk, once
> minimising time — and reports the gap. A chamber whose fast route is within
> 10 % of its safe route has no greedy line and is flat.

### 7 · Fail fast, retry faster

Checkpoint density tracks difficulty. Gutter-to-control is already ≤0.9 s with
a camera cut. The sconce spacing lint (≥4 tiles clear before danger, ≥5 before
a piston) protects the *approach*; this rule protects the *interval*.

> **Test:** no required sequence between two sconces may exceed ~25 s of
> golden-path time. Beyond that a death costs a re-run of solved content.

### 8 · Difficulty from precision and reading, never tedium or trickery

No memorisation of invisible information. No single-frame inputs. No hazard
that can only be learned by dying to it.

> **Test (the hard gate):** the harness reports the **input-timing margin in
> frames** for every required traversal. Anything under **6 frames** is
> flagged unfairly tight — six being the coyote window, the game's own
> declared unit of forgiveness. Anything unsolvable fails outright.

---

## The unit of measurement

Every distance in a design document or map comment is written as a fraction of
the **running jump: 5.45 tiles across, 2.68 up**. "A 0.7× gap" is a sentence
with a number in it. "A big gap" is not.
