# How it works

aledloop is for drawing things that influence each other, then watching them move. No maths needed: you touch, you watch, and little by little you understand why things move the way they do.

This page explains what you see on the screen and what you can try.

---

## 1. At the start, everything is calm

Each circle (we call it a **pebble**) has a **level**, between 0 and 100%: it’s its colored part, which rises and falls like water in a glass.

When you start the simulation, **nothing moves**. That’s normal: each pebble’s starting level is a **balance**, a calm state. After a short moment, the simulation even goes **on standby**: the system is waiting for someone to disturb it.

To disturb it, tap a pebble:

- at the **top** (▲) to push it up;
- at the **bottom** (▼) to push it down.

Then watch what happens around it: that’s where it gets interesting.

---

## 2. Arrows: “when this goes up, it pushes that up… or down”

An arrow connects a **cause** to an **effect**.

- A **+** arrow means: when the cause goes up, the effect goes up too (and when it goes down, the effect goes down).
- A **−** arrow means the opposite: when the cause goes up, the effect goes down.

A **thicker** arrow is **stronger**: it pushes harder.

During the simulation, **beads** flow along the arrows. They show what is passing through:

- a chevron **pointing up** is a rise; **pointing down**, a fall;
- when it reaches the end of the arrow, the bead pushes the effect in the direction of its chevron;
- the **bigger** the bead, the harder it pushes.

On a **−** arrow, look closely: as it passes over the − badge, the bead **glows red** and **flips over**. Before, it shows which way the cause moved; after, which way it pushes the effect. It’s the − that reverses things: a rise becomes a fall, and vice versa.

Beads don’t flow the same way depending on what is at the end of the arrow:

- **towards a variable**, they leave **in packets**, only when the cause **changes**. Once the change has passed, nothing flows anymore, even if the cause stays high: the variable has already followed;
- **towards an accumulation**, they flow **continuously**, like water from a tap: as long as the cause is above (or below) its start, the accumulation keeps filling up (or draining).

When a bead reaches a variable, it leaves an **imprint** for a moment: a big ▲ or ▼ near the arrowhead, and the pebble’s chevron lights up. No need to have had your eye on the bead to know what it did.

When everything has calmed down again, the beads disappear.

---

## 3. Two kinds of elements

This is the most important idea. Each pebble is either a **variable** or an **accumulation**.

### The variable: it reacts right away

A variable follows its causes **immediately**, like the needle of a scale that moves as soon as you put something on it. If the causes calm down, so does it, straight away.

Examples: the heating, which depends on the temperature *now*; births, which depend on the population *now*; fear.

### The accumulation: it fills up little by little

You can recognize an accumulation by its **box** shape (a rectangle with rounded corners and a double outline), whereas a variable is **round**. It works like a **bathtub**:

- what comes in through the arrows is the **tap**;
- as long as the tap is running, the bathtub **keeps filling up**;
- when you turn off the tap, it **stays at the same level** (it doesn’t drain by itself).

Examples: a population, the temperature of a room, the money in an account, the CO₂ in the air.

**What you can observe:** tap a variable, its effects move right away and stop. Tap the cause of an accumulation, it rises… and keeps rising as long as the cause is pushing.

It’s thanks to accumulations that things take **time**, and so that a system has a **rhythm**.

---

## 4. Time passing

Each diagram has a **time unit**: minutes for a thermostat, months for a shop, years for the climate. You set it next to each duration.

During the simulation, at the bottom of the screen:

- the **clock** shows the time elapsed;
- **Space** pauses or resumes, like a video;
- the **×1** button changes the speed (at ×1, one time unit passes in one second): a click speeds up, **Shift + click** (or a long press on a tablet) slows down. On the keyboard: **>** faster, **<** slower (or **+** and **−**);
- ↺ puts everything back to the start;
- ⏭ **jumps ahead in one go** by the whole **simulation duration**;
- 📈 shows the **charts**;
- the **Present** button starts the diagram’s story, if it has one: handy when you don’t know where to begin.

The **charts** tell the story: each pebble has its own line, in its color. Slide your finger (or the mouse) over them to read the values at a given moment. Each pebble also has its own little curve just below it.

The simulation **never stops by itself**. The **simulation duration** (set above the charts) is the width of the **window**: at first, the curves are drawn from left to right; once the duration is exceeded, they **scroll**, and the oldest values disappear.

Tick **“Stop at the end”** to do as in Insight Maker: the simulation stops after the duration (a message says so), and the charts keep the whole history from the start. ▶ lets you carry on anyway.

**Tip:** pause the simulation at the start, tap a few pebbles, then press ⏭. You immediately see what your gesture will cause over the years.

---

## 5. Delays

Some arrows carry **two little marks** and a duration, for example “3 years”: that’s a **delay**. The effect isn’t felt right away, it arrives **gradually**.

It’s like the hot water in the shower: you turn the tap, but the water takes a while to warm up. It doesn’t go from cold to hot all at once: it gets lukewarm, then hot.

On a delayed link, the beads move **more slowly**: they take the length of the delay to travel.

Roughly, after the stated duration, a little more than half of the effect has arrived; after twice that, almost all of it.

---

## 6. Loops

A **loop** is when a chain of arrows comes back to where it started: A acts on B, which acts on C, which acts… on A. The effect comes back to its own cause.

In the middle of each loop, a label shows its type:

- **B** (**balancing** loop): it resists changes and brings things back to calm;
- **R** (**reinforcing** loop): it amplifies changes, like a snowball.

To tell which: count the **−** arrows in the loop. An **odd** number means B; an **even** number (or zero) means R.

Tap a label: the inspector describes the loop, and the **“Its rhythm”** box predicts how it will behave.

### 6.1 The loop that brings calm back

The **thermostat** example: when it’s too hot, the heating goes down; the room cools; the heating comes back up a little. The temperature **gently returns** to its starting level, without overshooting it.

The stronger the arrows, the faster the return. “Its rhythm” gives the loop’s **reaction time**: the time it needs to cover most of the way.

### 6.2 With a delay, it overshoots and oscillates

Now imagine the radiator takes a long time to heat up. When the room is finally back at the right temperature, the heating is still reacting to what was happening before: the room **overshoots**, gets too cold, then too hot… It **oscillates**.

That’s exactly what happens in a shower where the hot water takes a while to come: you turn too far, it’s scalding, you turn back, it’s freezing…

What matters is the delay **compared** with the loop’s reaction time:

| The delay is… | What you observe |
|---|---|
| short | a smooth return to calm |
| medium | it overshoots, oscillates a little, then calms down |
| long | the oscillations grow, up to the edges |

No need to guess: “Its rhythm” tells you from which delay the loop will oscillate, and from when it will run away.

**Try this:** in the thermostat example, lengthen the radiator’s delay, little by little, and watch the charts.

### 6.3 The loop that runs away

In a **reinforcing** loop, each lap amplifies the change: more rabbits, more births, so even more rabbits. It **doubles** regularly: 2, 4, 8, 16… It’s the **snowball**, or the interest on a debt piling up.

“Its rhythm” tells you how often it doubles.

It doesn’t last forever: a pebble can’t go beyond 100%, and another loop often ends up putting on the brakes.

### 6.4 Leaks

An accumulation can have a **return to balance**: it drains (or fills) by itself towards its starting level, like a **leaking bathtub**.

A leak is a **brake**. On a loop that runs away, it’s a tug of war between the loop and the leaks:

- if the loop wins, it runs away anyway;
- if the leaks win, it doesn’t run away… but the slightest change is **amplified**. “Its rhythm” says by how much.

When this number is large, the system is **fragile**: it is close to tipping over, and it comes back to calm very slowly when disturbed. It’s a sign that often heralds a tipping point.

### 6.5 Two reservoirs bouncing the ball back and forth

When a balancing loop contains **two accumulations**, they bounce the ball back and forth, like a **swing** or a spring: it **oscillates** by itself, for a long time.

It’s the cycle of **rabbits and foxes**: lots of rabbits, so the foxes multiply; they eat the rabbits, which become scarce; the foxes go hungry and decline; the rabbits come back… and so on.

A leak on one of the two acts as a **shock absorber**: the oscillations die down little by little.

### 6.6 The loop with no rhythm

If a loop has **no accumulation and no delay**, everything in it happens at the same instant: it has no rhythm of its own, which doesn’t look like anything real. Its label is circled with **red dots**, and a message warns you when the simulation starts.

To fix it, turn one of its pebbles into an **accumulation**, or add a **delay** to an arrow.

---

## 7. Special behaviors

A few settings, under “Behavior” in the inspector, make a pebble more surprising.

- **The edges.** A level never goes below 0% or above 100%. A loop that runs away therefore ends up hitting the ceiling.
- **Saturation.** The fuller the pebble, the harder it is for it to rise (and likewise downwards). A reinforcing loop then draws an **S-curve**: slow at first, very fast in the middle, then slowing down as it nears the maximum. It’s the curve of an epidemic or a spreading fad.
- **Tipping.** A red dotted line marks a **point of no return**. Once it is crossed, the pebble locks at its maximum, a **padlock** appears, and nothing can bring it back down. Only ↺ resets it.
- **Release.** The accumulation fills up silently, passing nothing on… then, at the threshold, it **empties all at once** and passes on everything it held back. Like a toilet flush, or the stress in rock that ends in an earthquake.
- **▲ ▼ on an accumulation**: it’s like pouring in a bucket of water, or taking one out. **On a variable**: it’s like turning a dial, which stays turned (unless it has a return to balance).

---

## 8. Experiments to try

Open the **example library** (the “Examples” button) and try:

- **Thermostat**: lengthen the radiator’s delay until the temperature oscillates more and more.
- **Rabbits and foxes**: tap the rabbits just once, then watch the two curves chase each other for years.
- **Sea ice**: raise the CO₂. Bringing it back to its start quickly is enough to save the sea ice. Bringing it back too late is not: the padlock appears.
- **Bank run**: a small rumor is enough… and the bank drains even after the rumor has died down.
- **Any example**: change an arrow’s strength or a pebble’s kind, and compare the charts before and after.

A good question to ask yourself every time: **“what will happen if I touch here?”** Make your prediction, then check.

---

## 9. What aledloop doesn’t do

- **It doesn’t predict the future.** It shows **mechanisms**: why a system oscillates, runs away or calms down. Levels are reference points (0 to 100%), not real measurements.
- **Effects add up, they don’t multiply.** For example, “infections depend on the number of sick people **multiplied** by the number of healthy people” can only be approximated. A more precise version, with real equations (as in Insight Maker), will come later.
