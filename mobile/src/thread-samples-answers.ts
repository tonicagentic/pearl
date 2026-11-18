/** Standalone answer fixtures — kept free of `@/` / RN imports for unit tests. */
type AnswerMessage = {
  readonly role: "user" | "assistant";
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly metadata?: { readonly custom?: { readonly turnId?: string } };
};

export type AnswerThreadSample = {
  readonly id:
    | "answer-web"
    | "answer-location"
    | "answer-places"
    | "answer-products"
    | "answer-brief"
    | "answer-entry"
    | "answer-pronounce"
    | "answer-phrase"
    | "answer-chord"
    | "answer-theory"
    | "answer-votes"
    | "answer-table"
    | "answer-explain"
    | "answer-recipe"
    | "answer-chart"
    | "answer-spec"
    | "answer-mermaid"
    | "answer-flight"
    | "answer-event"
    | "answer-create-event"
    | "answer-booking"
    | "answer-email-draft"
    | "answer-email-batch"
    | "answer-surf"
    | "answer-surf-pick"
    | "answer-snow"
    | "answer-mountain-pick"
    | "answer-daily"
    | "answer-video"
    | "answer-vercel-project"
    | "answer-deploy"
    | "answer-deploy-list"
    | "answer-pr"
    | "answer-pr-list"
    | "answer-issue"
    | "answer-issue-list"
    | "answer-neon-project"
    | "answer-neon-branch"
    | "answer-schema"
    | "answer-ship"
    | "answer-env-names"
    | "answer-domains"
    | "answer-slow-queries"
    | "answer-repo-pick"
    | "answer-project-pick"
    | "answer-neon-branch-pick"
    | "answer-photo-edit"
    | "answer-music-prod"
    | "answer-storyboard"
    | "answer-indicator"
    | "answer-slides"
    | "answer-pdf"
    | "answer-chess"
    | "answer-terminal"
    | "answer-audio"
    | "answer-model3d"
    | "answer-web-preview"
    | "answer-timeline"
    | "answer-comparison"
    | "answer-math"
    | "answer-score";
  readonly label: string;
  readonly group: "answer";
  readonly messages: readonly AnswerMessage[];
  readonly durationEvents: readonly unknown[];
};

const ANSWER_START = "2026-03-01T12:00:00.000Z";
const ANSWER_END = "2026-03-01T12:00:06.000Z";

function patch(
  path: string,
  value: unknown,
): string {
  return JSON.stringify({ op: "add", path, value });
}

function specBlock(
  rootId: string,
  elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }>,
): string {
  const lines = [
    "```spec",
    patch("/root", rootId),
    ...Object.entries(elements).map(([id, element]) =>
      patch(`/elements/${id}`, {
        type: element.type,
        props: element.props,
        children: element.children ?? [],
      }),
    ),
    "```",
  ];
  return lines.join("\n");
}

function durationEvents(turnId: string) {
  return [
    {
      type: "message.appended",
      data: { turnId },
      meta: { at: ANSWER_START },
    },
    {
      type: "session.completed",
      data: { turnId },
      meta: { at: ANSWER_END },
    },
  ] as const;
}

function turn(
  turnId: string,
  userText: string,
  assistantText: string,
): readonly AnswerMessage[] {
  return [
    {
      role: "user",
      content: [{ type: "text", text: userText }],
    },
    {
      role: "assistant",
      content: [{ type: "text", text: assistantText }],
      metadata: { custom: { turnId } },
    },
  ];
}

function answerSample(
  id: AnswerThreadSample["id"],
  label: string,
  userText: string,
  prose: string,
  rootId: string,
  elements: Record<
    string,
    { type: string; props: Record<string, unknown>; children?: string[] }
  >,
): AnswerThreadSample {
  const turnId = `sample-${id}`;
  return {
    id,
    label,
    group: "answer",
    durationEvents: durationEvents(turnId),
    messages: turn(
      turnId,
      userText,
      `${prose}\n\n${specBlock(rootId, elements)}`,
    ),
  };
}

export const ANSWER_THREAD_SAMPLES: readonly AnswerThreadSample[] = [
  answerSample(
    "answer-web",
    "Web",
    "Search for the best espresso machines under $500.",
    "Here are a few solid write-ups:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: "Espresso machines under $500", description: null },
        children: ["results"],
      },
      results: {
        type: "SearchResults",
        props: {
          kind: "web",
          items: [
            {
              title: "Breville Bambino Plus review",
              detail: "Fast heat-up and automatic milk texturing in a compact body.",
              meta: "wirecutter.com",
            },
            {
              title: "Gaggia Classic Pro buyer’s guide",
              detail: "Manual workflow favorite once you dial in grind and tamp.",
              meta: "home-barista.com",
            },
            {
              title: "De’Longhi Dedica Arte overview",
              detail: "Slim footprint for small kitchens; pressurized baskets help beginners.",
              meta: "seriouseats.com",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-location",
    "Location",
    "Where is the Ferry Building?",
    "It’s on the Embarcadero at the foot of Market Street.",
    "card",
    {
      card: {
        type: "Card",
        props: { title: "Ferry Building", description: null },
        children: ["map"],
      },
      map: {
        type: "PlaceMap",
        props: {
          title: "San Francisco Ferry Building",
          address: "1 Ferry Building, San Francisco, CA 94111",
          pins: [
            {
              label: "Ferry Building",
              x: 52,
              y: 48,
              detail: "Marketplace + ferry terminal",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-places",
    "Places",
    "Coffee near the Ferry Building?",
    "A few spots within a short walk:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: "Coffee near Ferry Building", description: null },
        children: ["map"],
      },
      map: {
        type: "PlaceMap",
        props: {
          title: null,
          address: "Around 1 Ferry Building, San Francisco",
          pins: [
            {
              label: "Blue Bottle",
              x: 40,
              y: 42,
              detail: "0.2 mi · pour-over + espresso",
            },
            {
              label: "Andytown",
              x: 58,
              y: 55,
              detail: "0.3 mi · Snowy Plover",
            },
            {
              label: "Café Reveille",
              x: 68,
              y: 38,
              detail: "0.4 mi · breakfast too",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-products",
    "Products",
    "Show me running shoes around $140.",
    "Three current options in that range:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: "Running shoes ~$140", description: null },
        children: ["results"],
      },
      results: {
        type: "SearchResults",
        props: {
          kind: "product",
          items: [
            {
              title: "Nike Pegasus 41",
              detail: "Daily trainer with ReactX foam; wide toe box option.",
              meta: "$140",
              image:
                "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=256&h=256&q=80",
            },
            {
              title: "Brooks Ghost 16",
              detail: "Soft cushioning for easy miles; stable ride.",
              meta: "$140",
              image:
                "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=256&h=256&q=80",
            },
            {
              title: "Saucony Ride 18",
              detail: "Light and snappy for tempo work mid-week.",
              meta: "$135",
              image:
                "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=256&h=256&q=80",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-brief",
    "Brief",
    "Give me a quick brief on the port strike talks.",
    "Situation brief as of this morning:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["brief"],
      },
      brief: {
        type: "NewsBrief",
        props: {
          kicker: "Labor",
          headline: "West Coast port talks extend overnight",
          dek: "Negotiators kept working past the midnight deadline; cargo is still moving under a temporary extension.",
          bullets: [
            "Both sides say wages are closer; automation language remains the sticking point.",
            "Retailers are pre-routing some holiday inventory through Gulf ports.",
            "A full walkout would idle terminals from Seattle to San Diego.",
          ],
          sources: ["AP", "WSJ", "ILWU"],
        },
      },
    },
  ),
  answerSample(
    "answer-entry",
    "Entry",
    "What is cacio e pepe?",
    "Short encyclopedia-style entry:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["entry"],
      },
      entry: {
        type: "Encyclopedia",
        props: {
          title: "Cacio e pepe",
          lead: "Roman pasta finished with pecorino Romano and black pepper; the cheese and pasta water emulsify into a glossy sauce without cream.",
          image:
            "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&h=800&q=80",
          infobox: [
            { label: "Origin", value: "Rome, Lazio" },
            { label: "Course", value: "Primo" },
            { label: "Key ingredients", value: "Pasta, pecorino, pepper" },
          ],
          sections: [
            {
              heading: "Technique",
              body: "Toast cracked pepper in the pan, then toss al dente pasta with finely grated pecorino and starchy water off the heat so the cheese melts instead of clumping.",
            },
            {
              heading: "Variants",
              body: "Some cooks add a knob of butter or a spoon of olive oil; purists keep it to cheese, pepper, and pasta water only.",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-pronounce",
    "Pronounce",
    "How do you pronounce cacio e pepe?",
    "Here’s the pronunciation:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["pronounce"],
      },
      pronounce: {
        type: "Pronounce",
        props: {
          word: "cacio e pepe",
          ipa: "ˈka.tʃo e ˈpe.pe",
          syllables: "KAH-cho eh PEH-peh",
          note: "Italian; stress on the first syllable of each word.",
          audio: null,
          lang: "it-IT",
          spoken: "cacio e pepe",
        },
      },
    },
  ),
  answerSample(
    "answer-phrase",
    "Phrase",
    "How do I say thank you in Japanese?",
    "A polite everyday version:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["phrase"],
      },
      phrase: {
        type: "Phrase",
        props: {
          sourceLanguage: "English",
          targetLanguage: "Japanese",
          phrase: "Thank you",
          translation: "ありがとうございます (arigatō gozaimasu)",
          literal: "There is difficulty (that you went through) — polite form",
          audio: null,
          lang: "ja-JP",
          spoken: "ありがとうございます",
        },
      },
    },
  ),
  answerSample(
    "answer-chord",
    "Chord",
    "Show me a G major guitar chord.",
    "Open G major:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["chord"],
      },
      chord: {
        type: "GuitarChord",
        props: {
          name: "G major",
          frets: [3, 2, 0, 0, 0, 3],
          baseFret: 1,
          voicings: [
            {
              label: "Open alt",
              frets: [3, 2, 0, 0, 3, 3],
              baseFret: 1,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-theory",
    "Theory",
    "What’s the I–V–vi–IV progression in C?",
    "Same axis progression sitting on C:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["theory"],
      },
      theory: {
        type: "TheoryBoard",
        props: {
          title: "I–V–vi–IV in C major",
          progression: ["I", "V", "vi", "IV"],
          highlightKey: "C",
          showCircle: true,
        },
      },
    },
  ),
  answerSample(
    "answer-votes",
    "Votes",
    "How did Prop 40 look statewide and by region?",
    "No is ahead overall; coastal counties are closer.",
    "card",
    {
      card: {
        type: "Card",
        props: {
          title: "Prop 40 — early returns",
          description: null,
        },
        children: ["bar", "regions"],
      },
      bar: {
        type: "ComparisonBar",
        props: {
          leftLabel: "No",
          leftValue: 54,
          rightLabel: "Yes",
          rightValue: 46,
          caption: "~68% of expected vote counted",
        },
      },
      regions: {
        type: "RegionChart",
        props: {
          title: "No share by region",
          unit: "%",
          regions: [
            { label: "Inland Empire", value: 61, hint: null },
            { label: "Central Valley", value: 58, hint: null },
            { label: "Bay Area", value: 49, hint: null },
            { label: "LA County", value: 51, hint: null },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-table",
    "Table",
    "Compare those three espresso machines side by side.",
    "Quick comparison:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: "Espresso machines", description: null },
        children: ["table"],
      },
      table: {
        type: "Table",
        props: {
          columns: ["Model", "Price", "Boiler", "Best for"],
          rows: [
            ["Bambino Plus", "$500", "ThermoJet", "Speed + milk"],
            ["Classic Pro", "$450", "Single", "Manual control"],
            ["Dedica Arte", "$300", "Thermoblock", "Small kitchens"],
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-explain",
    "Explain",
    "Explain how an emulsified cheese sauce works.",
    "Three steps:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["explainer"],
      },
      explainer: {
        type: "Explainer",
        props: {
          title: "Why cacio e pepe emulsifies",
          steps: [
            {
              heading: "Starch in the water",
              body: "Pasta water carries dissolved starch that thickens and helps fat from the cheese disperse.",
            },
            {
              heading: "Fine cheese off heat",
              body: "Finely grated pecorino melts into that slurry instead of seizing into clumps.",
            },
            {
              heading: "Toss, don’t boil",
              body: "Agitation off the burner stretches the emulsion; boiling splits it.",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-recipe",
    "Recipe",
    "Give me a short cacio e pepe recipe.",
    "Two-person skillet version:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["recipe"],
      },
      recipe: {
        type: "Recipe",
        props: {
          title: "Cacio e pepe",
          time: "20 min",
          yield: "2 servings",
          ingredients: [
            "200 g spaghetti or tonnarelli",
            "80 g pecorino Romano, finely grated",
            "1–1½ tsp freshly cracked black pepper",
            "Kosher salt for the pasta water",
          ],
          method: [
            "Boil pasta in well-salted water; reserve a cup of starchy water before draining.",
            "Toast pepper in a wide pan, then add a splash of pasta water.",
            "Add pasta and pecorino off heat, tossing and adding water until glossy.",
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-chart",
    "Chart",
    "How are runs looking this week?",
    "Week-to-date:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["chart"],
      },
      chart: {
        type: "Chart",
        props: {
          label: "Runs this week",
          value: "92",
          delta: "+34%",
          trend: "up",
          upIsGood: true,
          points: [18, 22, 19, 31, 28, 42, 38, 51, 47, 63, 58, 71, 69, 84, 92],
          visibleCount: 15,
          variant: "area",
        },
      },
    },
  ),
  answerSample(
    "answer-spec",
    "Spec",
    "What’s the Opus 5.5 model card?",
    "Quick sheet:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["spec"],
      },
      spec: {
        type: "SpecSheet",
        props: {
          title: "Opus 5.5",
          subtitle: "claude-opus-5-5",
          visibleCount: 3,
          rows: [
            { label: "context", value: "1,000,000 tokens", emphasis: null },
            { label: "input", value: "$4.00 / M", emphasis: null },
            {
              label: "best for",
              value: "Long agentic runs",
              emphasis: true,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-mermaid",
    "Mermaid",
    "Diagram the checkout flow.",
    "Simple path:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["diagram"],
      },
      diagram: {
        type: "MermaidDiagram",
        props: {
          title: "Checkout",
          streaming: false,
          code: "flowchart LR\n  Cart --> Pay --> Ship",
        },
      },
    },
  ),
  answerSample(
    "answer-flight",
    "Flight",
    "Where is UA 872?",
    "In the air:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["flight"],
      },
      flight: {
        type: "FlightTracker",
        props: {
          airline: "United",
          flightNumber: "UA 872",
          status: "On time",
          origin: "SFO",
          destination: "NRT",
          progress: 62,
          elapsed: "6h 40m elapsed",
          remaining: "4h 10m remaining",
        },
      },
    },
  ),
  answerSample(
    "answer-event",
    "Event",
    "What’s on my calendar Friday morning?",
    "Next up:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["event"],
      },
      event: {
        type: "CalendarEvent",
        props: {
          date: "Friday, July 24",
          title: "Design review",
          time: "9:00 to 9:30 AM",
          location: "Conference Room B",
        },
      },
    },
  ),
  answerSample(
    "answer-create-event",
    "Create event",
    "Block Friday for the design review.",
    "Here’s the day with the new event ready to add:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["create"],
      },
      create: {
        type: "CreateEvent",
        props: {
          day: "24",
          month: "July",
          weekday: "Friday",
          events: [
            { title: "Design review", time: "9:00 to 9:30 AM", tag: "Work" },
            { title: "Lunch with Sam", time: "12:30 to 1:30 PM", tag: "Personal" },
            { title: "Flight to Tokyo", time: "6:45 PM", tag: "Travel" },
          ],
          title: "Design review",
          start: "2026-07-24T09:00:00-07:00",
          end: "2026-07-24T09:30:00-07:00",
          location: "Conference Room B",
          calendarId: null,
        },
      },
    },
  ),
  answerSample(
    "answer-booking",
    "Booking",
    "Book a table for two Friday at 7.",
    "Reservation draft:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["booking"],
      },
      booking: {
        type: "Booking",
        props: {
          restaurant: "State Bird Provisions",
          name: "Alex",
          partySize: 2,
          date: "Friday, July 24 · 7:00 PM",
          seating: "indoor",
          reminder: true,
        },
      },
    },
  ),
  answerSample(
    "answer-email-draft",
    "Email draft",
    "Draft a thank-you to Sam.",
    "Ready to send:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["draft"],
      },
      draft: {
        type: "EmailDraft",
        props: {
          to: "sam@example.com",
          cc: null,
          bcc: null,
          subject: "Thanks for today",
          body: "Sam —\n\nAppreciate you walking through the design review. I’ll send notes tomorrow.\n\n— Alex",
          accountId: null,
          threadId: null,
        },
      },
    },
  ),
  answerSample(
    "answer-email-batch",
    "Email batch",
    "Clean up the newsletters.",
    "Proposed archive batch:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["batch"],
      },
      batch: {
        type: "EmailBatch",
        props: {
          items: [
            {
              accountId: "acct_1",
              threadId: "thread_a",
              action: "archive",
              subject: "Weekly digest",
              from: "news@example.com",
            },
            {
              accountId: "acct_1",
              threadId: "thread_b",
              action: "mark_read",
              subject: "Product updates",
              from: "hello@example.com",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-surf",
    "Surf",
    "Surf report for Ocean Beach?",
    "This morning:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["surf"],
      },
      surf: {
        type: "SurfReport",
        props: {
          spot: "Ocean Beach",
          region: "San Francisco",
          updated: "6:12 AM",
          rating: "Fair",
          summary: "Chest-high west swell with light NW wind; better on the south end.",
          wave: "3–4 ft",
          wind: "NW 8 mph",
          tide: "Rising · mid",
          periods: [
            { label: "Morning", wave: "3–4 ft", wind: "NW 8" },
            { label: "Afternoon", wave: "2–3 ft", wind: "NW 12" },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-snow",
    "Snow",
    "Snow report for Eldora?",
    "Mountain conditions:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["snow"],
      },
      snow: {
        type: "SnowReport",
        props: {
          resort: "Eldora",
          region: "Nederland, CO",
          updated: "5:40 AM",
          baseDepth: "48\"",
          newSnow: "3\" overnight",
          conditions: "Packed powder",
          liftsOpen: "10 / 12",
          trailsOpen: "61 / 88",
          trailLevels: [
            { level: "beginner", open: 18, total: 22 },
            { level: "intermediate", open: 28, total: 34 },
            { level: "advanced", open: 12, total: 24 },
            { level: "expert", open: 3, total: 8 },
          ],
          summary: "Fresh overnight on Corona; wind holds Challenge.",
          image:
            "https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&q=80",
        },
      },
    },
  ),
  answerSample(
    "answer-surf-pick",
    "Surf pick",
    "Which surf spot is best this morning?",
    "Best call:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["pick"],
      },
      pick: {
        type: "SurfSpotPick",
        props: {
          pick: "Ocean Beach",
          timeframe: "This morning",
          reason:
            "Cleanest face and lightest wind before the NW breeze fills in.",
          options: [
            {
              name: "Ocean Beach",
              rating: "Good",
              wave: "3–4 ft",
              wind: "NW 6 mph",
              note: "South end cleaner; mid-tide.",
            },
            {
              name: "Pacifica",
              rating: "Fair",
              wave: "2–3 ft",
              wind: "NW 10 mph",
              note: "A bit mushy; wind earlier.",
            },
            {
              name: "Bolinas",
              rating: "Poor–Fair",
              wave: "1–2 ft",
              wind: "Variable",
              note: "Small and inconsistent.",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-mountain-pick",
    "Mountain pick",
    "Which ski mountain should I go to today?",
    "Best call:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["pick"],
      },
      pick: {
        type: "MountainPick",
        props: {
          pick: "Eldora",
          timeframe: "Today",
          reason:
            "Closest fresh snow with most lifts spinning; less drive than Summit.",
          options: [
            {
              name: "Eldora",
              newSnow: "3\" overnight",
              baseDepth: "48\"",
              conditions: "Packed powder",
              liftsOpen: "10 / 12",
              note: "Corona skiing well; Challenge windy.",
            },
            {
              name: "Winter Park",
              newSnow: "2\" overnight",
              baseDepth: "52\"",
              conditions: "Packed powder",
              liftsOpen: "18 / 25",
              note: "More terrain, longer drive and wind on ridge.",
            },
            {
              name: "Loveland",
              newSnow: "1\" overnight",
              baseDepth: "44\"",
              conditions: "Hard pack",
              liftsOpen: "8 / 10",
              note: "Fast access but thinner coverage on steeps.",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-daily",
    "Daily",
    "What’s in today’s brief?",
    "Top stories:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["daily"],
      },
      daily: {
        type: "DailyBrief",
        props: {
          date: "Tuesday, March 3",
          title: "Morning brief",
          stories: [
            {
              headline: "Markets open mixed after jobs data",
              dek: "Futures chop as traders digest payrolls.",
              source: "Reuters",
              url: "https://example.com/markets",
              image: null,
            },
            {
              headline: "City council advances housing package",
              dek: "Vote expected next week on zoning changes.",
              source: "Local desk",
              url: null,
              image: null,
            },
            {
              headline: "Storm system heads for the Sierra",
              dek: "Heavy snow likely Thursday into Friday.",
              source: "NWS",
              url: null,
              image: null,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-video",
    "Video",
    "Show me that Big Buck Bunny clip.",
    "Here you go:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["video"],
      },
      video: {
        type: "Video",
        props: {
          title: "Big Buck Bunny",
          src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          provider: "file",
          poster: null,
        },
      },
    },
  ),
  answerSample(
    "answer-vercel-project",
    "Vercel project",
    "Show my Pearl Vercel project.",
    "Project:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["project"],
      },
      project: {
        type: "VercelProject",
        props: {
          name: "pearl",
          team: "tonicagentic",
          framework: "nextjs",
          productionUrl: "https://pearl.tonicagentic.com",
          latestDeploy: {
            state: "ready",
            env: "production",
            url: "https://pearl.tonicagentic.com",
            createdAt: "12m ago",
          },
        },
      },
    },
  ),
  answerSample(
    "answer-deploy",
    "Deploy",
    "Status of the latest preview deploy?",
    "Latest preview:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["deploy"],
      },
      deploy: {
        type: "DeploymentStatus",
        props: {
          project: "pearl",
          state: "ready",
          environment: "preview",
          url: "https://pearl-git-feat-xyz.vercel.app",
          commit: "a1b2c3d",
          branch: "feat/answer-cards",
          duration: "48s",
          createdAt: "3m ago",
        },
      },
    },
  ),
  answerSample(
    "answer-deploy-list",
    "Deploys",
    "Recent deploys for pearl?",
    "Last few:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["list"],
      },
      list: {
        type: "DeploymentList",
        props: {
          project: "pearl",
          items: [
            {
              state: "ready",
              environment: "production",
              url: "https://pearl.tonicagentic.com",
              commit: "a1b2c3d",
              branch: "main",
              createdAt: "12m ago",
            },
            {
              state: "ready",
              environment: "preview",
              url: "https://pearl-git-feat.vercel.app",
              commit: "d4e5f6a",
              branch: "feat/answer-cards",
              createdAt: "1h ago",
            },
            {
              state: "error",
              environment: "preview",
              url: null,
              commit: "99aabb",
              branch: "feat/broken",
              createdAt: "yesterday",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-pr",
    "PR",
    "What’s the status of PR 42?",
    "Pull request:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["pr"],
      },
      pr: {
        type: "PullRequest",
        props: {
          title: "Add devops answer cards",
          number: 42,
          repo: "tonicagentic/my-agent",
          state: "open",
          checks: "pass",
          url: "https://github.com/tonicagentic/my-agent/pull/42",
          author: "alex",
          branch: "feat/devops-cards",
        },
      },
    },
  ),
  answerSample(
    "answer-pr-list",
    "PRs",
    "Open PRs on my-agent?",
    "Open pull requests:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["list"],
      },
      list: {
        type: "PullRequestList",
        props: {
          repo: "tonicagentic/my-agent",
          items: [
            {
              title: "Add devops answer cards",
              number: 42,
              state: "open",
              checks: "pass",
              author: "alex",
              branch: "feat/devops-cards",
              url: null,
            },
            {
              title: "Fix mobile composer height",
              number: 41,
              state: "open",
              checks: "pending",
              author: "alex",
              branch: "fix/composer",
              url: null,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-issue",
    "Issue",
    "Open issue 18?",
    "Issue:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["issue"],
      },
      issue: {
        type: "Issue",
        props: {
          title: "Neon branch pick card",
          number: 18,
          repo: "tonicagentic/my-agent",
          state: "open",
          url: null,
          author: "alex",
          labels: ["enhancement", "ui"],
        },
      },
    },
  ),
  answerSample(
    "answer-issue-list",
    "Issues",
    "Open issues?",
    "Issues:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["list"],
      },
      list: {
        type: "IssueList",
        props: {
          repo: "tonicagentic/my-agent",
          items: [
            {
              title: "Neon branch pick card",
              number: 18,
              state: "open",
              author: "alex",
              labels: ["enhancement"],
              url: null,
            },
            {
              title: "Document EnvVarList names-only rule",
              number: 17,
              state: "open",
              author: "alex",
              labels: ["docs"],
              url: null,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-neon-project",
    "Neon project",
    "Show the Pearl Neon project.",
    "Database project:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["neon"],
      },
      neon: {
        type: "NeonProject",
        props: {
          name: "pearl",
          region: "aws-us-west-2",
          branchesOpen: "3 branches",
          defaultBranch: "main",
          compute: "idle",
        },
      },
    },
  ),
  answerSample(
    "answer-neon-branch",
    "Neon branch",
    "What’s on the preview branch?",
    "Branch:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["branch"],
      },
      branch: {
        type: "NeonBranch",
        props: {
          name: "preview/feat-cards",
          project: "pearl",
          parent: "main",
          primary: false,
          compute: "active",
          endpointHost: "ep-cool-name.us-west-2.aws.neon.tech",
        },
      },
    },
  ),
  answerSample(
    "answer-schema",
    "Schema",
    "What’s in the pearl database?",
    "Tables:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["schema"],
      },
      schema: {
        type: "SchemaOverview",
        props: {
          database: "pearl",
          tableCount: 12,
          tables: [
            { name: "user", rows: "~2.4k", detail: null },
            { name: "session", rows: "~8k", detail: null },
            { name: "chat", rows: "~1.1k", detail: "indexed on userId" },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-ship",
    "Ship",
    "Where are we on shipping the cards PR?",
    "Ship status:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["ship"],
      },
      ship: {
        type: "ShipStatus",
        props: {
          repo: "tonicagentic/my-agent",
          branch: "feat/devops-cards",
          pr: {
            number: 42,
            title: "Add devops answer cards",
            url: null,
            checks: "pass",
          },
          previewUrl: "https://pearl-git-feat.vercel.app",
          deployState: "ready",
        },
      },
    },
  ),
  answerSample(
    "answer-env-names",
    "Env names",
    "Which env vars are set on production?",
    "Names only:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["env"],
      },
      env: {
        type: "EnvVarList",
        props: {
          project: "pearl",
          environment: "production",
          names: [
            "DATABASE_URL",
            "BETTER_AUTH_SECRET",
            "VERCEL_OIDC_TOKEN",
            "AI_GATEWAY_API_KEY",
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-domains",
    "Domains",
    "Domains on pearl?",
    "Domains:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["domains"],
      },
      domains: {
        type: "DomainList",
        props: {
          project: "pearl",
          domains: [
            {
              name: "pearl.tonicagentic.com",
              verified: true,
              environment: "production",
            },
            {
              name: "pearl-staging.tonicagentic.com",
              verified: true,
              environment: "preview",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-slow-queries",
    "Slow queries",
    "Any slow queries on pearl?",
    "Slowest recently:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["slow"],
      },
      slow: {
        type: "SlowQueryList",
        props: {
          project: "pearl",
          items: [
            {
              query:
                "SELECT * FROM session WHERE user_id = $1 ORDER BY expires_at DESC",
              duration: "420ms",
              calls: "128",
              note: "missing index on expires_at",
            },
            {
              query: "SELECT count(*) FROM chat_message WHERE chat_id = $1",
              duration: "180ms",
              calls: "54",
              note: null,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-repo-pick",
    "Repo pick",
    "Which repo should I work in for the chat UI?",
    "Best repo:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["pick"],
      },
      pick: {
        type: "RepoPick",
        props: {
          pick: "tonicagentic/my-agent",
          timeframe: "This task",
          reason: "Owns Pearl chat UI, json-render catalog, and mobile inspector.",
          options: [
            {
              name: "tonicagentic/my-agent",
              detail: "Pearl agent + Expo app",
              meta: "active",
            },
            {
              name: "tonicagentic/eve",
              detail: "Framework internals only",
              meta: "upstream",
            },
            {
              name: "tonicagentic/pearl-tasks",
              detail: "Task docs, not app code",
              meta: null,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-project-pick",
    "Project pick",
    "Which Vercel project for the preview?",
    "Use:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["pick"],
      },
      pick: {
        type: "ProjectPick",
        props: {
          pick: "pearl",
          timeframe: null,
          reason: "Production Pearl deployment lives here.",
          options: [
            {
              name: "pearl",
              detail: "Next.js agent app",
              meta: "tonicagentic",
            },
            {
              name: "pearl-docs",
              detail: "Docs site only",
              meta: "tonicagentic",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-neon-branch-pick",
    "Neon pick",
    "Which Neon branch should the preview use?",
    "Branch pick:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["pick"],
      },
      pick: {
        type: "NeonBranchPick",
        props: {
          pick: "preview/feat-cards",
          timeframe: "This PR",
          reason: "Isolated schema changes without touching main.",
          options: [
            {
              name: "preview/feat-cards",
              detail: "Branched from main for this PR",
              meta: "active",
            },
            {
              name: "main",
              detail: "Production data — avoid writes",
              meta: "primary",
            },
            {
              name: "dev",
              detail: "Shared scratch branch",
              meta: "idle",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-photo-edit",
    "Photo edit",
    "What grade settings for this portrait?",
    "Suggested grade:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["photo"],
      },
      photo: {
        type: "PhotoEditSettings",
        props: {
          title: "Portrait grade",
          image:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=640&q=80",
          groups: [
            {
              name: "Exposure",
              rows: [
                { label: "Exposure", value: "+0.35" },
                { label: "Highlights", value: "-20" },
                { label: "Shadows", value: "+15" },
              ],
            },
            {
              name: "Color",
              rows: [
                { label: "Temp", value: "5200K" },
                { label: "Tint", value: "+4" },
                { label: "Vibrance", value: "+12" },
              ],
            },
            {
              name: "Detail",
              rows: [
                { label: "Clarity", value: "+8" },
                { label: "Sharpen", value: "35" },
              ],
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-music-prod",
    "Music prod",
    "Show the mix settings for the chorus.",
    "Session:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["music"],
      },
      music: {
        type: "MusicProdSettings",
        props: {
          title: "Chorus mix",
          project: "Pearl Theme",
          bpm: "118",
          key: "Am",
          tracks: [
            {
              name: "Kick",
              role: "Drums",
              level: "-6.0 dB",
              muted: false,
            },
            {
              name: "Bass",
              role: "Low end",
              level: "-8.5 dB",
              muted: false,
            },
            {
              name: "Pad",
              role: "Atmosphere",
              level: "-14.0 dB",
              muted: true,
            },
          ],
          groups: [
            {
              name: "Bus",
              rows: [
                { label: "Drum bus", value: "Glue +2" },
                { label: "Master", value: "-1.0 dBTP" },
              ],
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-storyboard",
    "Storyboard",
    "Storyboard the 15s product open.",
    "Frames:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["board"],
      },
      board: {
        type: "VideoStoryboard",
        props: {
          title: "Product open · 15s",
          aspect: "16:9",
          frames: [
            {
              label: "Logo hold",
              image: null,
              beat: "0:00",
              duration: "2s",
            },
            {
              label: "Product hero",
              image:
                "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=640&q=80",
              beat: "0:02",
              duration: "4s",
            },
            {
              label: "UI montage",
              image: null,
              beat: "0:06",
              duration: "5s",
            },
            {
              label: "CTA",
              image: null,
              beat: "0:11",
              duration: "4s",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-indicator",
    "Indicator",
    "CO₂ emissions per capita for the US over time?",
    "From Our World in Data:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["indicator"],
      },
      indicator: {
        type: "IndicatorCard",
        props: {
          title: "CO₂ emissions per capita",
          source: "Our World in Data",
          unit: "t",
          value: "14.9",
          delta: "−3% vs 2019",
          asOf: "2022",
          points: [16.2, 15.8, 15.1, 14.4, 13.9, 14.2, 14.9],
          regions: [
            { label: "United States", value: 14.9, hint: "2022" },
            { label: "EU-27", value: 6.8, hint: null },
            { label: "World", value: 4.7, hint: null },
          ],
          rows: [
            { label: "Peak year", value: "2000 · 20.2 t" },
            { label: "Change since peak", value: "−26%" },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-slides",
    "Slides",
    "Draft slides for the Pearl launch update.",
    "Deck:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["slides"],
      },
      slides: {
        type: "Slides",
        props: {
          title: "Pearl launch",
          theme: "Dark product",
          index: 1,
          slides: [
            {
              title: "Agenda",
              bullets: ["Why now", "What’s shipping", "Ask"],
              image: null,
              notes: null,
            },
            {
              title: "What’s shipping",
              bullets: [
                "Answer cards across chat",
                "Mobile inspector samples",
                "Devops + creative surfaces",
              ],
              image: null,
              notes: "Keep to 60 seconds",
            },
            {
              title: "Ask",
              bullets: ["Ship this week", "Gather feedback"],
              image: null,
              notes: null,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-pdf",
    "PDF",
    "Show the brief PDF.",
    "Artifact:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["pdf"],
      },
      pdf: {
        type: "PdfArtifact",
        props: {
          title: "W3C dummy PDF",
          src: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          pages: "1 page",
          size: "13 KB",
          updated: "sample",
        },
      },
    },
  ),
  answerSample(
    "answer-chess",
    "Chess",
    "Show the position after 1.e4 c5 2.Nf3.",
    "Sicilian after Nf3:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["chess"],
      },
      chess: {
        type: "ChessBoard",
        props: {
          title: "Open Sicilian",
          fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
          orientation: "white",
          lastMove: "g1f3",
          moves: ["e4", "c5", "Nf3"],
        },
      },
    },
  ),
  answerSample(
    "answer-terminal",
    "Terminal",
    "What did the test run print?",
    "Command output:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["term"],
      },
      term: {
        type: "TerminalBlock",
        props: {
          cwd: "~/my-agent",
          command: "pnpm vitest run composer",
          lines: [
            "RUN v4.0.5 /Users/alex/GitHub/my-agent",
            "",
            " ✓ tests/composer.test.ts (3)",
            "   ✓ mounts thread",
            "   ✓ streams reply",
            "   ✓ settles markdown",
          ],
          stderr: ["Error: snapshot mismatch in footer"],
          exitCode: 1,
          durationMs: 1840,
          truncated: false,
          visibleCount: 8,
          done: true,
          maxCollapsedLines: 4,
          variant: "ink",
        },
      },
    },
  ),
  answerSample(
    "answer-audio",
    "Audio",
    "Play the theme sting.",
    "Clip:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["audio"],
      },
      audio: {
        type: "AudioPlayback",
        props: {
          title: "Pearl sting",
          src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          artist: "SoundHelix",
          duration: "6:12",
          poster: null,
        },
      },
    },
  ),
  answerSample(
    "answer-model3d",
    "3D",
    "Show the Damaged Helmet sample.",
    "Khronos DamagedHelmet:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["model"],
      },
      model: {
        type: "Model3D",
        props: {
          title: "Damaged Helmet",
          src: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
          caption: "Drag to orbit · auto-rotate on",
          poster:
            "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/screenshot/screenshot.jpg",
          autoRotate: true,
        },
      },
    },
  ),
  answerSample(
    "answer-web-preview",
    "Preview",
    "Preview example.com in a sandbox.",
    "Live preview:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["preview"],
      },
      preview: {
        type: "WebPreview",
        props: {
          title: "example.com",
          url: "https://example.com",
        },
      },
    },
  ),
  answerSample(
    "answer-timeline",
    "Timeline",
    "Walk me through the launch day plan.",
    "Launch day:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["timeline"],
      },
      timeline: {
        type: "Timeline",
        props: {
          visibleCount: null,
          events: [
            {
              id: "freeze",
              when: "past",
              time: "09:00",
              title: "Code freeze",
              detail: "Main locked; hotfix branch only.",
            },
            {
              id: "promote",
              when: "now",
              time: "11:30",
              title: "Promote canary",
              detail: "10% traffic on the new build.",
            },
            {
              id: "announce",
              when: "future",
              time: "14:00",
              title: "Customer announce",
              detail: "Blog + changelog go live.",
            },
            {
              id: "retro",
              when: "future",
              time: "16:30",
              title: "Retro notes",
              detail: null,
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-comparison",
    "Compare",
    "Should we use Neon or PlanetScale for this app?",
    "Trade-offs:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["compare"],
      },
      compare: {
        type: "ComparisonCard",
        props: {
          traitLabels: ["Branching", "Serverless driver", "Region pick"],
          options: [
            {
              id: "neon",
              name: "Neon",
              headline: "Postgres branches + scale-to-zero",
              traits: ["Instant DB branches", "HTTP + WS drivers", "Pick region"],
            },
            {
              id: "pscale",
              name: "PlanetScale",
              headline: "Vitess MySQL with deploy requests",
              traits: [false, "Serverless driver", "Multi-region"],
            },
          ],
          recommendedId: "neon",
          reason:
            "Pick Neon if you want Postgres + branch workflows that match this stack.",
        },
      },
    },
  ),
  answerSample(
    "answer-math",
    "Math",
    "Derive the quadratic formula briefly.",
    "Completing the square:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["math"],
      },
      math: {
        type: "MathBlock",
        props: {
          label: "ax² + bx + c = 0",
          visibleSteps: null,
          steps: [
            {
              expression: "ax² + bx = −c",
              note: "Move the constant.",
            },
            {
              expression: "x² + (b/a)x = −c/a",
              note: "Divide by a.",
            },
            {
              expression: "x² + (b/a)x + (b/2a)² = −c/a + (b/2a)²",
              note: "Complete the square.",
            },
            {
              expression: "x = (−b ± √(b² − 4ac)) / (2a)",
              note: "Solve for x.",
            },
          ],
        },
      },
    },
  ),
  answerSample(
    "answer-score",
    "Score",
    "How did this design review score?",
    "Rubric:",
    "card",
    {
      card: {
        type: "Card",
        props: { title: null, description: null },
        children: ["score"],
      },
      score: {
        type: "ScoreBreakdown",
        props: {
          verdict: "ship",
          total: 8.4,
          outOf: 10,
          visibleCount: null,
          criteria: [
            {
              label: "Clarity",
              score: 9,
              weight: 0.3,
              note: "Hierarchy reads in one pass.",
            },
            {
              label: "Motion",
              score: 8,
              weight: 0.2,
              note: "Two intentional fades; no noise.",
            },
            {
              label: "Accessibility",
              score: 7.5,
              weight: 0.25,
              note: "Contrast OK; focus rings still thin.",
            },
            {
              label: "Brand fit",
              score: 9,
              weight: 0.25,
              note: null,
            },
          ],
        },
      },
    },
  ),
];
