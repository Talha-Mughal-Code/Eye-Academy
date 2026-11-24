# Eye Academy voice viva

A short spoken ophthalmology viva. You sign in, ask an AI examiner for findings out loud, give your diagnosis and management, and answer one follow-up question.

Built with TanStack Start, Firebase Auth and Firestore (emulators), and the Gemini Live API (`gemini-3.8-live`).

The main rule: **the model never supplies clinical values.** It only chooses *which* finding to look up. Code reads the value from `data/case.json`, the screen shows that result, and the examiner reads the same string back. Change a value in `case.json` and the app changes everywhere.

---

## Run it

Needs Node 22+, Java 21 for the Firebase emulators, and a Gemini API key from Google AI Studio (free tier).

```bash
npm install
cp .env.example .env            # then put your key in GEMINI_API_KEY

# terminal 1: Firebase emulators (Auth + Firestore)
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"   # if java isn't on your PATH
npm run emulators

# terminal 2: the app
npm run dev                     # http://localhost:3000
```

Create any email and password account on the home page (it's a local emulator), then go to **Viva**. Hold the spacebar or the mic button to talk.

| Command | What it does |
|---|---|
| `npm test` | Unit tests: findings lookup, formatting, phases, follow-up choice (20 tests) |
| `npm run test:rules` | Firestore security rules against the emulator: a second user is denied (6 tests) |
| `npm run smoke:live -- "Right gonioscopy"` | Typed question to the real Live model, no mic. Prints tool calls, the spoken reply and latency |

Restart `npm run dev` after editing `.env`.

---

## What works

- **Sign-in** with email/password or Google, on the Auth emulator.
- **Voice viva** at `/viva`:
  - Push-to-talk with the spacebar or the button.
  - A clear status badge: *Your turn: listening*, *Examiner thinking*, *Examiner speaking*. The mic is off while the examiner talks.
  - The examiner reads the opening prompt from `case.json`, then looks up findings and history with two tools (`get_finding`, `get_history`).
  - Each result appears as a card with eye, value and unit, and method. Unavailable findings show **Not available: reason** and no value.
- **Phases enforced in code**, not just in the prompt: findings, then answer, then follow-up, then done.
  - An "I'm ready to give my diagnosis" button (or saying it) moves you to the answer.
  - Lookups are blocked after the findings phase.
  - Exactly **one** follow-up is picked on the server from what you said or left out:
    - didn't mention the sulfonamide allergy or acetazolamide: asks about that;
    - said strong or early pilocarpine: asks why it may not work at very high pressure;
    - didn't mention the other eye: asks why treat the left eye;
    - otherwise uses one of the case's follow-up ideas.
  - Your reply to the follow-up ends the session.
- **Secrets stay on the server.**
  - A server function checks your Firebase ID token, then creates a single-use Gemini token that lasts a few minutes.
  - The examiner prompt and tools are locked into that token on the server, so the browser can't change them.
  - The real API key never reaches the browser.
- **Firestore rules** let only the owner create, read, update or delete an attempt. This is tested with two emulator users.
- **Latency log:** a dev-only panel with median and slowest turn, split by tool-call vs plain, plus a JSON export.

---

## Model choice and responsiveness

**Why Gemini Live (`gemini-3.8-live`):**
- It takes speech in and gives speech out in one streaming session, with function calling built in. Asking for a finding, looking it up and speaking the answer happens in one round trip.
- It supports short-lived tokens, so the browser can connect directly without ever holding the real key.
- It has push-to-talk controls (`activityStart`/`activityEnd`) and transcripts of both sides.
- It's free on the AI Studio free tier.

**Alternative considered:** a browser pipeline of speech-to-text (Web Speech API), then a Gemini text model with function calling, then `speechSynthesis` for the voice.
- **Upside:** easier to debug, transcripts you fully control, no realtime connection.
- **Downside:** three hops instead of one, so it's slower. The browser voice sounds robotic, and Web Speech recognition only works well in Chrome.
- I kept it as the fallback if Live quota or latency became a problem. Neither did.

**Measured turns:**

| Turn type | Runs | Median | Slowest |
|---|---|---|---|
| Plain (no tool) | 3 | 700 ms | 812 ms |
| With a tool call (finding lookup) | 3 | 981 ms | 1026 ms |

- **Timer start:** the moment the question is sent to the model.
- **Timer stop:** the first chunk of the examiner's audio arriving.
- **How:** these runs used `npm run smoke:live` with typed questions, so the numbers don't include speech recognition, the mic, or speaker delay.
- **In the browser:** the app times real voice turns. The timer starts when you release push-to-talk and stops when the first examiner audio is scheduled to play. Mic hardware delay is not included. Numbers show in the dev latency panel and can be exported as JSON.
- I haven't yet copied a set of real voice-turn numbers in here.

---

## Three checks

| # | Check | Input | Expected | Observed |
|---|---|---|---|---|
| 1 | Available finding | "What's the pressure in the right eye?" | Tool call `get_finding(intraocular pressure, right)`; reads *"Right intraocular pressure: 58 mmHg (Goldmann applanation, 23:55)"*; card shows Right eye, 58 mmHg | ✅ Exactly that. The model called the tool with eye = right and read the string back word for word. Same result by voice in the browser. |
| 2 | Unavailable finding | "Right gonioscopy please" | Status `unavailable`, reason about corneal oedema, no value | ✅ *"Right gonioscopy: not available (No view: corneal oedema)"*. The card is marked Not available and has no value field. |
| 3 | Citation supports revision point | A fixed trainee answer | Pages retrieved, cited chunk and excerpt; excerpt is a real substring of that page | ❌ **Not done.** The revision point wasn't built in time (see below). |

Checks 1 and 2 are also unit tests (`tests/findings.test.ts`), and can be re-run against the live model with `npm run smoke:live`. One more: "colour vision" returns *"That is not part of this case."*

**Privacy check:** `npm run test:rules` signs in as two users. User B gets `permission-denied` when trying to read, update or delete user A's attempt. 6/6 pass.

---

## Handover

**How findings are looked up:**
- `src/lib/case/findings.ts` is pure code with no AI.
- The model passes a name like "pressure" or "IOP". Code matches it to a finding label in `case.json`, using a small list of synonyms (names only, never values).
- **Ambiguity:** if you ask for an eye-specific finding without saying which eye ("what's the pressure?"), you get **both eyes**, right first. I chose this over asking back, because it's faster in a viva and still shows the correct value for each eye.
- One function, `formatFinding`, builds the text for both the screen and the spoken readback. A unit is added only when the value is a number or a short code (58 mmHg, 6/36 Snellen). Descriptive values that already include their unit are left alone, so you never get "5 mm mm" and never "null".

**Reference note:** not prepared yet. The plan was:
- extract text page by page;
- check that the printed page numbers match the PDF pages;
- chunk by heading without crossing page boundaries;
- tidy up the tables;
- rank chunks with keyword (BM25) search, boosting the acute angle closure section (pages 3–6) and down-weighting the distractor sections;
- set a minimum score below which the answer is "no support found".

**AI-assisted work, and how I checked it:** I used Claude Code throughout. One concrete example:
- **What happened:** the SDK's own warning says ephemeral tokens need API version `v1alpha`. The current Google docs say `v1beta`. The AI flagged the conflict instead of picking one.
- **How I checked it:** I wrote `scripts/live-smoke.ts`, which mints a real token, connects, asks a question and runs the tool call. `v1beta` worked end to end, so that's what the app uses.
- **Bonus:** the same script showed that a turn which only calls a tool finishes with *no audio*, and the spoken answer comes in the next turn. Without that, the UI would have flipped back to "your turn" too early, so I fixed it to stay on "Examiner thinking" until audio plays.

A second, smaller example: the AI's synonym list mapped "vision" to visual acuity, so "colour vision" came back as acuity. The `not_in_case` unit test caught it before it shipped, and I fixed it.

---

## What's left (ran out of time)

I stopped at the time limit. Not done:

1. **Saved attempts.**
   - The Firestore rules and their test are done.
   - Not done: writing each transcript line and finding as it happens, and the `/attempts` and `/attempts/$id` pages. Right now a refresh loses the session.
2. **Revision point from the reference note.** No PDF chunking, retrieval or generated revision point yet, so citation check 3 isn't done. The plan is above.
3. **`npm run check`.** A single scripted command for all three checks. Checks 1 and 2 are covered by unit tests and the smoke script for now.
4. **Real voice-turn latency numbers** from the browser panel. The table above uses typed input.

**Known limits:**
- The case file is bundled into the browser, so a determined trainee could read `examiner_notes` in dev tools.
- If the model already knows from the prompt that something isn't in the case, it sometimes says so without calling the tool. The answer is still correct.
- Push-to-talk has only been tested in Chrome on macOS.

**One improvement I'd add next:** a typed-input fallback beside the mic button. Mic permissions and noisy rooms are the most likely way a real trainee gets stuck. The Live session already accepts text (the smoke script uses it), so it's a small change.
