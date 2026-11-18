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
    | "answer-video";
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
];
